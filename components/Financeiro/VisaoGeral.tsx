
import React, { useMemo } from 'react';
import type { FinancialTransaction } from '../../types';
import DashboardCard from '../DashboardCard';
import FluxoCaixaChart from './FluxoCaixaChart';
import { DollarIcon, ArrowUpIcon, ArrowDownIcon, CalendarIcon, UploadIcon } from '../../assets/icons';

interface VisaoGeralProps {
    transactions: FinancialTransaction[];
    onOpenImport: () => void;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const VisaoGeral: React.FC<VisaoGeralProps> = ({ transactions, onOpenImport }) => {
    
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
        // Nota: A página pai já filtra as transações pelo período selecionado.
        // Aqui apenas somamos o que foi pago dentro dessas transações filtradas.
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
        // Mostra os próximos vencimentos dentre as transações filtradas
        const today = new Date().toISOString().split('T')[0];
        return transactions
            .filter(t => t.status === 'pendente' && t.dueDate >= today)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .slice(0, 5);
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <button
                    onClick={onOpenImport}
                    className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all shadow-sm"
                >
                    <UploadIcon className="w-5 h-5" />
                    <span>Importar Extrato (OFX)</span>
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <DashboardCard title="Resultado do Período" value={formatCurrency(metrics.resultadoDoPeriodo)} icon={CalendarIcon} color="bg-purple-500" />
                <DashboardCard title="Receitas (Período)" value={formatCurrency(metrics.receitasDoPeriodo)} icon={ArrowUpIcon} color="bg-teal-500" />
                <DashboardCard title="Despesas (Período)" value={formatCurrency(metrics.despesasDoPeriodo)} icon={ArrowDownIcon} color="bg-orange-500" />
                
                <DashboardCard title="Saldo Líquido (Filtro)" value={formatCurrency(metrics.saldoAtual)} icon={DollarIcon} color="bg-blue-500" />
                <DashboardCard title="A Receber (Pendente)" value={formatCurrency(metrics.aReceberPendente)} icon={ArrowUpIcon} color="bg-green-500" />
                <DashboardCard title="A Pagar (Pendente)" value={formatCurrency(metrics.aPagarPendente)} icon={ArrowDownIcon} color="bg-red-500" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3">
                    <FluxoCaixaChart transactions={transactions} />
                </div>
                 <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Próximos Vencimentos (Seleção)</h3>
                    <div className="space-y-4">
                        {proximosVencimentos.length > 0 ? proximosVencimentos.map(t => (
                            <div key={t.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-100">{t.description}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Vence em: {new Date(t.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                    </p>
                                </div>
                                <div className={`text-right font-bold ${t.type === 'receita' ? 'text-green-500' : 'text-red-500'}`}>
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
