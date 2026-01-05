
import React, { useMemo } from 'react';
import type { FinancialTransaction } from '../../types';
import DashboardCard from '../DashboardCard';
import FluxoCaixaChart from './FluxoCaixaChart';
import { DollarIcon, ArrowUpIcon, ArrowDownIcon, CalendarIcon, UploadIcon, CreditCardIcon } from '../../assets/icons';

interface VisaoGeralProps {
    transactions: FinancialTransaction[];
    onOpenImport: () => void;
    onOpenCreditCard: () => void;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const VisaoGeral: React.FC<VisaoGeralProps> = ({ transactions, onOpenImport, onOpenCreditCard }) => {
    
    const metrics = useMemo(() => {
        // Pendentes (Considera o filtro de data aplicado na página pai)
        const aReceberPendente = transactions
            .filter(t => t.type === 'receita' && t.status === 'pendente')
            .reduce((sum, t) => sum + t.amount, 0);

        const aPagarPendente = transactions
            .filter(t => t.type === 'despesa' && t.status === 'pendente')
            .reduce((sum, t) => sum + t.amount, 0);
            
        // Saldo do filtro atual (Pago - Pago)
        const saldoAtual = transactions
            .filter(t => t.status === 'pago')
            .reduce((sum, t) => sum + (t.type === 'receita' ? t.amount : -t.amount), 0);
            
        // Receitas do Período (Realizado)
        const receitasDoPeriodo = transactions
            .filter(t => t.type === 'receita' && t.status === 'pago')
            .reduce((sum, t) => sum + t.amount, 0);

        // Despesas do Período (Realizado)
        const despesasDoPeriodo = transactions
            .filter(t => t.type === 'despesa' && t.status === 'pago')
            .reduce((sum, t) => sum + t.amount, 0);

        const resultadoDoPeriodo = receitasDoPeriodo - despesasDoPeriodo;

        return { aReceberPendente, aPagarPendente, saldoAtual, receitasDoPeriodo, despesasDoPeriodo, resultadoDoPeriodo };
    }, [transactions]);
    
    const proximosVencimentos = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        // APENAS PENDENTES
        const pending = transactions.filter(t => t.status === 'pendente' && t.dueDate >= today);
        
        const result: (FinancialTransaction & { isGroup?: boolean })[] = [];
        const cardGroups = new Map<string, FinancialTransaction[]>();

        pending.forEach(t => {
            const isCard = t.description.includes('[Cartão:');
            if (isCard) {
                const key = t.dueDate;
                if (!cardGroups.has(key)) cardGroups.set(key, []);
                cardGroups.get(key)!.push(t);
            } else {
                result.push(t);
            }
        });

        cardGroups.forEach((items, dueDate) => {
            const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
            result.push({
                ...items[0],
                id: `pv_group_${dueDate}`,
                description: 'Cartão de crédito',
                amount: totalAmount,
                isGroup: true
            });
        });

        return result
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 5);
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end gap-3">
                <button
                    onClick={onOpenCreditCard}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-100 transition-all shadow-sm"
                >
                    <CreditCardIcon className="w-5 h-5" />
                    <span className="text-sm font-bold">Lançar cartão</span>
                </button>
                <button
                    onClick={onOpenImport}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-all shadow-sm"
                >
                    <UploadIcon className="w-5 h-5" />
                    <span className="text-sm font-bold">Importar extrato</span>
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <DashboardCard title="Resultado do período" value={formatCurrency(metrics.resultadoDoPeriodo)} icon={CalendarIcon} color="bg-purple-500" />
                <DashboardCard title="Receitas (período)" value={formatCurrency(metrics.receitasDoPeriodo)} icon={ArrowUpIcon} color="bg-teal-500" />
                <DashboardCard title="Despesas (período)" value={formatCurrency(metrics.despesasDoPeriodo)} icon={ArrowDownIcon} color="bg-orange-500" />
                
                <DashboardCard title="Saldo líquido (filtro)" value={formatCurrency(metrics.saldoAtual)} icon={DollarIcon} color="bg-blue-500" />
                <DashboardCard title="A receber (pendente)" value={formatCurrency(metrics.aReceberPendente)} icon={ArrowUpIcon} color="bg-green-500" />
                <DashboardCard title="A pagar (pendente)" value={formatCurrency(metrics.aPagarPendente)} icon={ArrowDownIcon} color="bg-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    <FluxoCaixaChart transactions={transactions} />
                </div>
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Próximos vencimentos (seleção)</h3>
                    <div className="space-y-4">
                        {proximosVencimentos.length > 0 ? proximosVencimentos.map(t => (
                            <div key={t.id} className={`flex items-center justify-between p-3 rounded-lg ${t.isGroup ? 'bg-indigo-50/40 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                                <div className="flex items-center gap-3">
                                    {t.isGroup && (
                                        <div className="p-1.5 bg-indigo-600 text-white rounded-lg shadow-sm">
                                            <CreditCardIcon className="w-4 h-4" />
                                        </div>
                                    )}
                                    <div>
                                        <p className={`font-semibold ${t.isGroup ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-800 dark:text-gray-100'}`}>{t.description}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                            Vence em: {new Date(t.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                        </p>
                                    </div>
                                </div>
                                <div className={`text-right font-bold ${t.type === 'receita' ? 'text-green-500' : t.isGroup ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500'}`}>
                                    {formatCurrency(t.amount)}
                                </div>
                            </div>
                        )) : (
                            <p className="text-center text-gray-500 dark:text-gray-400 py-4">Nenhum vencimento no período.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VisaoGeral;
