
import React from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';

interface ChartData {
    name: string;
    receita: number;
    despesa: number;
}

interface ChartComponentProps {
    data: ChartData[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const formatCompact = (value: number) => {
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { notation: 'compact', compactDisplay: 'short', maximumFractionDigits: 2 }).format(rounded);
}

const ChartComponent: React.FC<ChartComponentProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-96">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Desempenho Financeiro (Últimos 6 Meses)</h3>
        {data && data.length > 0 ? (
            <ResponsiveContainer width="100%" height="90%">
                <BarChart
                data={data}
                margin={{
                    top: 5,
                    right: 20,
                    left: -10,
                    bottom: 5,
                }}
                >
                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                <XAxis dataKey="name" tick={{ fill: '#a0aec0' }} />
                <YAxis tick={{ fill: '#a0aec0' }} tickFormatter={(value) => formatCompact(value as number)} />
                <Tooltip
                    contentStyle={{ 
                        backgroundColor: 'rgba(31, 41, 55, 0.95)',
                        borderColor: '#4a5568',
                        color: '#ffffff',
                        borderRadius: '0.5rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value) => formatCurrency(value as number)}
                />
                <Legend />
                <Bar dataKey="receita" fill="#4ade80" name="Receita" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" fill="#f87171" name="Despesa" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>Nenhum dado financeiro registrado para o período.</p>
            </div>
        )}
    </div>
  );
};

export default ChartComponent;
