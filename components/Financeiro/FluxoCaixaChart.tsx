import React, { useMemo } from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';
import type { FinancialTransaction } from '../../types';

interface FluxoCaixaChartProps {
    transactions: FinancialTransaction[];
}

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatCompact = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(value);
}

const FluxoCaixaChart: React.FC<FluxoCaixaChartProps> = ({ transactions }) => {
    
    const chartData = useMemo(() => {
        const paidTransactions = transactions.filter(t => t.status === 'pago' && t.paymentDate);

        // Group transactions by month (YYYY-MM)
        const monthlyData: { [key: string]: { receita: number, despesa: number } } = {};
        paidTransactions.forEach(t => {
            const monthKey = t.paymentDate!.substring(0, 7); // "YYYY-MM"
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { receita: 0, despesa: 0 };
            }
            if (t.type === 'receita') {
                monthlyData[monthKey].receita += t.amount;
            } else {
                monthlyData[monthKey].despesa += t.amount;
            }
        });

        // Get sorted keys
        const sortedKeys = Object.keys(monthlyData).sort();

        // Format for chart
        return sortedKeys.map(key => {
            const [year, month] = key.split('-');
            const date = new Date(parseInt(year), parseInt(month) - 1, 1);
            const monthName = date.toLocaleString('pt-BR', { month: 'short', timeZone: 'UTC' });
            
            return {
                name: `${monthName.charAt(0).toUpperCase() + monthName.slice(1).replace('.', '')}/${year.slice(2)}`,
                ...monthlyData[key]
            };
        });

    }, [transactions]);

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-96">
            <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Fluxo de Caixa (Valores Realizados)</h3>
            <ResponsiveContainer width="100%" height="90%">
                <LineChart
                    data={chartData}
                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                >
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="name" tick={{ fill: '#a0aec0' }} />
                    <YAxis tick={{ fill: '#a0aec0' }} tickFormatter={(value) => formatCompact(value as number)} />
                    <Tooltip
                        contentStyle={{ 
                            backgroundColor: 'rgba(31, 41, 55, 0.8)',
                            borderColor: '#4a5568',
                            color: '#ffffff' 
                        }}
                        formatter={(value) => formatCurrency(value as number)}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="receita" stroke="#4ade80" strokeWidth={2} name="Receita" />
                    <Line type="monotone" dataKey="despesa" stroke="#f87171" strokeWidth={2} name="Despesa" />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
};

export default FluxoCaixaChart;