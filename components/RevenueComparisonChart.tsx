import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

interface RevenueComparisonData {
    name: string;
    vendaSistema: number;
    manutencao: number;
    lavagem: number;
}

interface RevenueComparisonChartProps {
    data: RevenueComparisonData[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatCompact = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(value);
};

const RevenueComparisonChart: React.FC<RevenueComparisonChartProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700/50 h-[400px] flex flex-col justify-between">
        <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Comparativo de Faturamento</h3>
            <p className="text-xs text-gray-500 font-medium mt-1">Comparativo mensal entre Vendas de Sistemas, Serviços de Manutenção e Contratos de Lavagem</p>
        </div>
        <div className="flex-1 w-full mt-4 min-h-[250px]">
            {data && data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                        data={data}
                        margin={{
                            top: 10,
                            right: 10,
                            left: -20,
                            bottom: 0,
                        }}
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
                        <Bar dataKey="vendaSistema" fill="#10b981" name="Venda de Sistema" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="manutencao" fill="#3b82f6" name="Manutenção" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="lavagem" fill="#ec4899" name="Lavagem" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <p>Nenhum dado registrado para o período.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default RevenueComparisonChart;
