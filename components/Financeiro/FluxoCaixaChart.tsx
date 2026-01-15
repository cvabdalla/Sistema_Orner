import React, { useMemo } from 'react';
import { 
    ResponsiveContainer, BarChart, Bar, 
    CartesianGrid, XAxis, YAxis, Tooltip, Legend, Cell
} from 'recharts';
import type { FinancialTransaction } from '../../types';

interface FluxoCaixaChartProps {
    transactions: FinancialTransaction[];
}

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatCompact = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 1 }).format(value);
}

const MONTHS = [
    'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
    'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const FluxoCaixaChart: React.FC<FluxoCaixaChartProps> = ({ transactions }) => {
    
    const chartData = useMemo(() => {
        const currentYear = new Date().getFullYear();
        
        // Filtra apenas transações pagas
        const yearTransactions = transactions.filter(t => {
            if (t.status !== 'pago') return false;
            
            // Tenta usar a data de pagamento, se não houver, usa a de vencimento
            const dateToUse = t.paymentDate || t.dueDate;
            if (!dateToUse) return false;

            return dateToUse.startsWith(String(currentYear));
        });

        // Inicializa o array com os 12 meses zerados
        const data = MONTHS.map(name => ({
            name,
            receita: 0,
            despesa: 0,
            resultado: 0
        }));

        // Acumula os valores
        yearTransactions.forEach(t => {
            const dateToUse = t.paymentDate || t.dueDate;
            const monthIndex = parseInt(dateToUse.split('-')[1]) - 1;
            
            if (monthIndex >= 0 && monthIndex < 12) {
                if (t.type === 'receita') {
                    data[monthIndex].receita += t.amount;
                } else {
                    data[monthIndex].despesa += t.amount;
                }
                data[monthIndex].resultado = data[monthIndex].receita - data[monthIndex].despesa;
            }
        });

        return data;
    }, [transactions]);

    const currentYear = new Date().getFullYear();

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-[450px] flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Fluxo de Caixa {currentYear}</h3>
                    <p className="text-xs text-gray-500 font-medium">Comparativo mensal de entradas e saídas realizadas</p>
                </div>
                
                <div className="flex items-center gap-6 bg-gray-50 dark:bg-gray-700/50 px-4 py-2 rounded-xl border border-gray-100 dark:border-gray-700 shadow-inner">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-green-500 shadow-sm shadow-green-500/30" />
                        <span className="text-[10px] font-black text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entradas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-red-500 shadow-sm shadow-red-500/30" />
                        <span className="text-[10px] font-black text-gray-500 dark:text-gray-300 uppercase tracking-wider">Saídas</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        barGap={4}
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
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                            tickFormatter={(value) => formatCompact(value as number)} 
                        />
                        <Tooltip
                            cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                            contentStyle={{ 
                                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                                borderColor: '#374151',
                                borderRadius: '12px',
                                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '12px'
                            }}
                            itemStyle={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 0' }}
                            labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontWeight: 'bold', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                            formatter={(value: number, name: string) => [
                                <span className={name === 'Entradas' ? 'text-green-400' : 'text-red-400'}>{formatCurrency(value)}</span>, 
                                name
                            ]}
                        />
                        <Bar 
                            dataKey="receita" 
                            name="Entradas" 
                            fill="#22c55e" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={35}
                        />
                        <Bar 
                            dataKey="despesa" 
                            name="Saídas" 
                            fill="#ef4444" 
                            radius={[4, 4, 0, 0]} 
                            maxBarSize={35}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-center">
                <p className="text-[10px] font-bold text-gray-400 italic">
                    * Os valores acima representam lançamentos liquidados, usando data de pagamento (ou vencimento como alternativa).
                </p>
            </div>
        </div>
    );
};

export default FluxoCaixaChart;