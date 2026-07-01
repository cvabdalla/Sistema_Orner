import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, BarChart, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar, Line } from 'recharts';
import type { SalesSummaryItem } from '../types';

interface YearlySalesComparisonChartProps {
    sales: SalesSummaryItem[];
    historicalRevenues?: any[];
}

const MONTHS_PT = [
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
];

const MONTHS_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatCompact = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(value);
};

const YearlySalesComparisonChart: React.FC<YearlySalesComparisonChartProps> = ({ sales: rawSales, historicalRevenues = [] }) => {
    const currentYearStr = new Date().getFullYear().toString();
    const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
    const [selectedMonth, setSelectedMonth] = useState<string>('Todos');
    const [selectedYears, setSelectedYears] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [hasInitializedYears, setHasInitializedYears] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const sales = useMemo(() => {
        return (rawSales || []).filter(s => {
            const statusStr = (s.status || '').trim().toLowerCase();
            return statusStr === 'aprovado' || statusStr === 'finalizado';
        });
    }, [rawSales]);

    // Extrair os anos únicos presentes nos dados de vendas e no histórico
    const availableYears = useMemo(() => {
        const yearsSet = new Set<string>();
        yearsSet.add(currentYearStr);
        
        sales.forEach(s => {
            if (s.date) {
                const year = s.date.split('-')[0];
                if (year && year.length === 4) {
                    yearsSet.add(year);
                }
            }
        });

        historicalRevenues.forEach(h => {
            if (h.year) {
                yearsSet.add(h.year.toString());
            }
        });

        return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
    }, [sales, historicalRevenues, currentYearStr]);

    // Inicializar selectedYears com todos os availableYears quando disponíveis
    useEffect(() => {
        if (availableYears.length > 0 && !hasInitializedYears) {
            setSelectedYears(availableYears);
            setHasInitializedYears(true);
        }
    }, [availableYears, hasInitializedYears]);

    // Fechar dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Calcular os dados com base nos filtros
    const chartData = useMemo(() => {
        if (selectedMonth === 'Todos') {
            // Comparação mensal de todos os anos disponíveis
            return MONTHS_SHORT.map((monthName, index) => {
                const targetMonthNum = index + 1;
                const monthData: any = { name: monthName };

                availableYears.forEach(yearStr => {
                    const yearNum = parseInt(yearStr, 10);

                    // Se o ano não estiver selecionado, não incluir os dados no cálculo da escala
                    if (selectedYears.length > 0 && !selectedYears.includes(yearStr)) {
                        monthData[yearStr] = undefined;
                        return;
                    }

                    // Vendas reais do ano
                    const realSales = sales.filter(s => {
                        if (!s.date) return false;
                        const parts = s.date.split('-');
                        return parseInt(parts[0], 10) === yearNum && parseInt(parts[1], 10) === targetMonthNum;
                    }).reduce((sum, current) => sum + (current.closedValue || 0), 0);

                    // Vendas históricas do ano
                    const histSales = historicalRevenues
                        .filter(h => h.year === yearNum && h.month === targetMonthNum)
                        .reduce((sum, current) => sum + Number(current.venda_sistema || 0), 0);

                    monthData[yearStr] = realSales + histSales;
                });

                return monthData;
            });
        } else {
            // Comparação de um mês específico ao longo dos últimos anos
            const targetMonthNum = parseInt(selectedMonth, 10);
            
            // Reverter a ordem dos anos para que fiquem cronológicos no gráfico e filtrar pelos selecionados
            const yearsInOrder = [...availableYears].reverse().filter(y => {
                return selectedYears.length === 0 || selectedYears.includes(y);
            });

            return yearsInOrder.map(yearStr => {
                const yearNum = parseInt(yearStr, 10);
                
                // Vendas reais
                const monthSalesReal = sales.filter(s => {
                    if (!s.date) return false;
                    const parts = s.date.split('-');
                    return parseInt(parts[0], 10) === yearNum && parseInt(parts[1], 10) === targetMonthNum;
                }).reduce((sum, current) => sum + (current.closedValue || 0), 0);

                // Vendas históricas
                const monthSalesHist = historicalRevenues
                    .filter(h => h.year === yearNum && h.month === targetMonthNum)
                    .reduce((sum, current) => sum + Number(current.venda_sistema || 0), 0);

                return {
                    name: yearStr,
                    'Vendas': monthSalesReal + monthSalesHist
                };
            });
        }
    }, [sales, historicalRevenues, selectedYear, selectedMonth, availableYears, selectedYears]);

    // Obter o ano ativo destacado (o de maior valor dentre os selecionados)
    const activeSelectedYear = useMemo(() => {
        if (selectedYears.length === 0) return currentYearStr;
        const sorted = [...selectedYears].sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
        return sorted[0];
    }, [selectedYears, currentYearStr]);

    // Ordenar anos cronologicamente para renderização das linhas e legenda
    const yearsSortedAsc = useMemo(() => {
        return [...availableYears].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    }, [availableYears]);

    // Obter cores harmônicas e consistentes para cada ano
    const getYearColor = (yearStr: string) => {
        if (yearStr === activeSelectedYear) return '#4f46e5'; // Azul Indigo destacado para o ano ativo destacado
        
        const otherYears = yearsSortedAsc.filter(y => y !== activeSelectedYear);
        const idx = otherYears.indexOf(yearStr);
        const palette = [
            '#10b981', // Verde Esmeralda
            '#0ea5e9', // Azul Piscina/Céu
            '#f59e0b', // Laranja/Âmbar
            '#f43f5e', // Rosa/Cereja
            '#8b5cf6', // Violeta/Roxo
            '#14b8a6', // Teal
            '#ec4899', // Pink
            '#64748b'  // Cinza Slate
        ];
        return palette[idx % palette.length] || '#9ca3af';
    };

    // Calcular os ticks e domínio customizados para o eixo Y com escala square root (sqrt)
    const { yAxisTicks, yAxisDomain } = useMemo(() => {
        // Encontrar o valor máximo nos dados atuais do gráfico
        let maxVal = 0;
        chartData.forEach((item: any) => {
            Object.keys(item).forEach(key => {
                if (key !== 'name' && typeof item[key] === 'number') {
                    if (item[key] > maxVal) {
                        maxVal = item[key];
                    }
                }
            });
        });

        // Valores de escala pré-definidos que cobrem o pedido do usuário
        const potentialTicks = [
            0,
            10000,
            20000,
            50000,
            100000,
            200000,
            300000,
            400000,
            500000,
            600000,
            750000,
            1000000,
            1250000,
            1500000,
            2000000,
            3000000
        ];

        // Se o valor máximo for muito pequeno ou zero, definir um padrão mínimo
        const effectiveMax = maxVal > 0 ? maxVal : 100000;

        // Filtrar ticks que são menores ou iguais ao máximo real (com uma folga de 15% para o topo)
        const ticks = potentialTicks.filter(t => t <= effectiveMax * 1.15);

        // Sempre garantir que o primeiro tick maior que o máximo seja incluído para fechar a escala de forma bonita
        const nextTick = potentialTicks.find(t => t > effectiveMax);
        if (nextTick && !ticks.includes(nextTick)) {
            ticks.push(nextTick);
        }

        // Se por algum motivo a lista ficou vazia ou sem o 0, garantir valores mínimos corretos
        if (!ticks.includes(0)) ticks.unshift(0);

        const domainMax = ticks[ticks.length - 1];

        return {
            yAxisTicks: ticks,
            yAxisDomain: [0, domainMax]
        };
    }, [chartData]);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700/50 h-[420px] flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg font-black text-gray-950 dark:text-white tracking-tight">Comparativo de Vendas por Ano</h3>
                    <p className="text-xs font-semibold text-gray-400 mt-1">Compare o faturamento de vendas de sistemas entre diferentes períodos</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    {/* Seletor de Ano (Combo Box multi-seleção de anos específicos) */}
                    <div className="flex flex-col relative" ref={dropdownRef}>
                        <label className="text-[10px] font-bold text-gray-500 mb-1">Anos para Comparar</label>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 flex items-center justify-between gap-2 min-w-[140px]"
                        >
                            <span className="truncate max-w-[110px]">
                                {selectedYears.length === 0 
                                    ? 'Nenhum' 
                                    : selectedYears.length === availableYears.length 
                                        ? 'Todos os Anos' 
                                        : selectedYears.sort((a, b) => parseInt(b, 10) - parseInt(a, 10)).join(', ')}
                            </span>
                            <svg className={`w-3.5 h-3.5 text-gray-500 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute top-full right-0 mt-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 py-1.5 min-w-[150px] max-h-48 overflow-y-auto animate-fadeIn">
                                {availableYears.map(year => {
                                    const isChecked = selectedYears.includes(year);
                                    return (
                                        <label 
                                            key={year} 
                                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-200 transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => {
                                                    if (isChecked) {
                                                        if (selectedYears.length > 1) {
                                                            setSelectedYears(selectedYears.filter(y => y !== year));
                                                        }
                                                    } else {
                                                        setSelectedYears([...selectedYears, year]);
                                                    }
                                                }}
                                                className="rounded text-indigo-600 focus:ring-indigo-500 border-gray-300 dark:border-gray-600 h-4 w-4"
                                            />
                                            <span>{year}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Seletor de Mês */}
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-gray-500 mb-1">Filtrar Mês</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="Todos">Todos os Meses</option>
                            {MONTHS_PT.map(m => (
                                <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="h-72 mt-4">
                {selectedMonth === 'Todos' ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                            data={chartData}
                            margin={{
                                top: 15,
                                right: 10,
                                left: -20,
                                bottom: 0,
                             }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} 
                                dy={10}
                            />
                            <YAxis 
                                scale="sqrt" 
                                domain={yAxisDomain} 
                                ticks={yAxisTicks} 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                                tickFormatter={(value) => formatCompact(value as number)} 
                            />
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                                    borderColor: '#374151',
                                    color: '#ffffff',
                                    borderRadius: '1rem',
                                    padding: '12px',
                                    fontSize: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                }}
                                formatter={(value) => formatCurrency(value as number)}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '10px' }} />
                            {yearsSortedAsc.map(yearStr => {
                                const isSelected = yearStr === activeSelectedYear;
                                if (selectedYears.length > 0 && !selectedYears.includes(yearStr)) {
                                    return null;
                                }
                                return (
                                    <Line 
                                        key={yearStr}
                                        type="monotone" 
                                        dataKey={yearStr} 
                                        stroke={getYearColor(yearStr)} 
                                        name={`Vendas em ${yearStr}`} 
                                        strokeWidth={isSelected ? 3.5 : 2}
                                        strokeDasharray={isSelected ? undefined : "3 3"}
                                        dot={{ r: isSelected ? 4 : 3, strokeWidth: isSelected ? 2 : 1 }}
                                        activeDot={{ r: isSelected ? 6 : 5 }}
                                    />
                                );
                            })}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                            data={chartData}
                            margin={{
                                top: 15,
                                right: 10,
                                left: -20,
                                bottom: 0,
                            }}
                        >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                            <XAxis 
                                dataKey="name" 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 'bold' }} 
                                dy={10}
                            />
                            <YAxis 
                                scale="sqrt" 
                                domain={yAxisDomain} 
                                ticks={yAxisTicks} 
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                                tickFormatter={(value) => formatCompact(value as number)} 
                            />
                            <Tooltip
                                contentStyle={{ 
                                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                                    borderColor: '#374151',
                                    color: '#ffffff',
                                    borderRadius: '1rem',
                                    padding: '12px',
                                    fontSize: '12px',
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)'
                                }}
                                formatter={(value) => formatCurrency(value as number)}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '10px' }} />
                            <Bar 
                                dataKey="Vendas" 
                                fill="#818cf8" 
                                name={`Vendas de ${MONTHS_PT.find(m => m.value === selectedMonth)?.label}`} 
                                radius={[6, 6, 0, 0]}
                                barSize={40}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};

export default YearlySalesComparisonChart;
