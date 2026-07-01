import React from 'react';
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from 'recharts';

interface SalesChartData {
    name: string;
    precoVenda: number;
    custoSistema: number;
}

interface SalesChartComponentProps {
    data: SalesChartData[];
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

const SalesChartComponent: React.FC<SalesChartComponentProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg h-[400px] flex flex-col justify-between">
        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
            <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">Evolução de Vendas (Últimos 6 Meses)</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">Histórico recente de preço de venda e custo do sistema</p>
            </div>
        </div>
        {data && data.length > 0 ? (
            <div className="flex-1 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                    data={data}
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
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 'bold' }} 
                        tickFormatter={(value) => formatCompact(value as number)} 
                    />
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
                    <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 600, paddingTop: '10px' }} />
                    <Line 
                        type="monotone" 
                        dataKey="precoVenda" 
                        stroke="#10b981" 
                        name="Preço de Venda" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                    />
                    <Line 
                        type="monotone" 
                        dataKey="custoSistema" 
                        stroke="#f57c00" 
                        name="Custo do Sistema" 
                        strokeWidth={3}
                        dot={{ r: 4, strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                    />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        ) : (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <p>Nenhum dado de vendas registrado para o período.</p>
            </div>
        )}
    </div>
  );
};

export default SalesChartComponent;
