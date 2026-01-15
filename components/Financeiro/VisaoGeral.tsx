import React, { useMemo, useEffect, useState } from 'react';
import type { FinancialTransaction, CreditCard, FinancialCategory, BankAccount } from '../../types';
import DashboardCard from '../DashboardCard';
import FluxoCaixaChart from './FluxoCaixaChart';
import { DollarIcon, ArrowUpIcon, ArrowDownIcon, CalendarIcon, UploadIcon, CreditCardIcon, CheckCircleIcon } from '../../assets/icons';
import { dataService } from '../../services/dataService';
import CreditCardDetailModal from './CreditCardDetailModal';

interface VisaoGeralProps {
    transactions: FinancialTransaction[];
    allTransactions: FinancialTransaction[]; // Adicionado para o gráfico ver o ano todo
    bankAccounts: BankAccount[];
    onOpenImport: () => void;
    onOpenCreditCard: () => void;
    onEditTransaction?: (transaction: FinancialTransaction) => void;
    onCancelTransaction?: (id: string) => void;
}

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const VisaoGeral: React.FC<VisaoGeralProps> = ({ transactions, allTransactions, bankAccounts, onOpenImport, onOpenCreditCard, onEditTransaction, onCancelTransaction }) => {
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<FinancialTransaction[] | null>(null);

    useEffect(() => {
        dataService.getAll<CreditCard>('credit_cards').then(setCards);
        dataService.getAll<FinancialCategory>('financial_categories').then(setCategories);
    }, []);
    
    const metrics = useMemo(() => {
        const activeTxs = transactions.filter(t => t.status !== 'cancelado');
        const aReceberPendente = activeTxs.filter(t => t.type === 'receita' && t.status === 'pendente').reduce((sum, t) => sum + t.amount, 0);
        const aPagarPendente = activeTxs.filter(t => t.type === 'despesa' && t.status === 'pendente').reduce((sum, t) => sum + t.amount, 0);
        
        // Saldo inicial de todas as contas ativas
        const totalSaldoInicial = bankAccounts.filter(b => b.active).reduce((sum, b) => sum + (b.initialBalance || 0), 0);
        
        // Movimentação realizada dentro do filtro de data
        const receitasPagas = activeTxs.filter(t => t.type === 'receita' && t.status === 'pago').reduce((sum, t) => sum + t.amount, 0);
        const despesasPagas = activeTxs.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((sum, t) => sum + t.amount, 0);
        
        const saldoAtual = totalSaldoInicial + receitasPagas - despesasPagas;
        const receitasDoPeriodo = receitasPagas;
        const despesasDoPeriodo = despesasPagas;
        
        return { aReceberPendente, aPagarPendente, saldoAtual, receitasDoPeriodo, despesasDoPeriodo, resultadoDoPeriodo: receitasDoPeriodo - despesasDoPeriodo };
    }, [transactions, bankAccounts]);
    
    const processList = (type: 'receita' | 'despesa') => {
        const list = transactions.filter(t => t.type === type && t.status !== 'cancelado');
        
        const ccGroups: Record<string, FinancialTransaction[]> = {};
        const normals: any[] = [];

        list.forEach(t => {
            if (t.id.startsWith('cc-') && t.type === 'despesa') {
                const groupKey = `ALL_CC_${t.dueDate}`;
                if (!ccGroups[groupKey]) ccGroups[groupKey] = [];
                ccGroups[groupKey].push(t);
            } else {
                normals.push({ ...t, displayDescription: toSentenceCase(t.description), isCC: false });
            }
        });

        const groupedCC = Object.entries(ccGroups).map(([key, items]) => {
            const keyParts = key.split('_');
            const dueDate = keyParts[keyParts.length - 1];
            const allPaid = items.every(i => i.status === 'pago');
            const maxPaymentDate = allPaid ? items.reduce((max, cur) => {
                const curDate = cur.paymentDate || cur.dueDate;
                return curDate > max ? curDate : max;
            }, items[0].paymentDate || items[0].dueDate) : undefined;
            
            return {
                id: `vg-grouped-cc-${key}`,
                displayDescription: 'Cartão de Crédito',
                amount: items.reduce((sum, i) => sum + i.amount, 0),
                dueDate: dueDate,
                paymentDate: maxPaymentDate,
                status: allPaid ? 'pago' : 'pendente',
                type: 'despesa',
                isCC: true,
                count: items.length,
                originalItems: items
            };
        });

        return [...normals, ...groupedCC].sort((a, b) => {
            const priorityA = String(a.status).toLowerCase() === 'pendente' ? 0 : 1;
            const priorityB = String(b.status).toLowerCase() === 'pendente' ? 0 : 1;
            if (priorityA !== priorityB) return priorityA - priorityB;
            if (String(a.status).toLowerCase() === 'pendente') return String(a.dueDate).localeCompare(String(b.dueDate));
            const dateA = a.paymentDate || a.dueDate;
            const dateB = b.paymentDate || b.dueDate;
            return String(dateB).localeCompare(String(dateA));
        }).slice(0, 12);
    };

    const receitasList = useMemo(() => processList('receita'), [transactions, cards]);
    const despesasList = useMemo(() => processList('despesa'), [transactions, cards]);

    const RenderItem: React.FC<{ t: any }> = ({ t }) => {
        const isPaid = t.status === 'pago';
        return (
            <div 
                onClick={t.isCC ? () => setSelectedGroup(t.originalItems) : undefined}
                className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                    isPaid 
                    ? 'bg-gray-50/80 dark:bg-gray-700/20 border-transparent opacity-80' 
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 shadow-sm hover:border-indigo-300'
                } ${t.isCC ? 'cursor-pointer' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                        isPaid 
                        ? 'bg-gray-200 text-gray-500' 
                        : t.type === 'receita' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                        {isPaid ? <CheckCircleIcon className="w-4 h-4" /> : t.type === 'receita' ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                    </div>
                    <div>
                        <p className={`font-bold text-[12px] leading-tight ${isPaid ? 'text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>
                            {t.displayDescription} {t.isCC ? <span className="text-[10px] text-indigo-500 font-black ml-1">({t.count})</span> : null}
                        </p>
                        <p className="text-[9px] text-gray-400 font-bold mt-0.5">
                            {isPaid ? (t.type === 'receita' ? 'Recebido em: ' : 'Pago em: ') : 'Vence em: '}
                            {new Date(isPaid ? (t.paymentDate || t.dueDate) : t.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                        </p>
                    </div>
                </div>
                <div className={`text-right font-black text-xs ${
                    isPaid ? 'text-gray-400' : t.type === 'receita' ? 'text-green-600' : 'text-red-600'
                }`}>
                    {formatCurrency(t.amount)}
                </div>
            </div>
        );
    };

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
                <DashboardCard title="A Receber (Pendente)" value={formatCurrency(metrics.aReceberPendente)} icon={ArrowUpIcon} color="bg-green-500" />
                <DashboardCard title="A Pagar (Pendente)" value={formatCurrency(metrics.aPagarPendente)} icon={ArrowDownIcon} color="bg-red-500" />
                <DashboardCard title="Saldo em Caixa (Líquido)" value={formatCurrency(metrics.saldoAtual)} icon={DollarIcon} color="bg-blue-600" />
                <DashboardCard title="Receitas Realizadas" value={formatCurrency(metrics.receitasDoPeriodo)} icon={ArrowUpIcon} color="bg-teal-500" />
                <DashboardCard title="Despesas Realizadas" value={formatCurrency(metrics.despesasDoPeriodo)} icon={ArrowDownIcon} color="bg-orange-500" />
                <DashboardCard title="Resultado do Período" value={formatCurrency(metrics.resultadoDoPeriodo)} icon={CalendarIcon} color="bg-purple-500" />
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                {/* Aqui passamos allTransactions para o gráfico mostrar o ano inteiro */}
                <FluxoCaixaChart transactions={allTransactions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold mb-5 text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 text-green-600 rounded-lg"><ArrowUpIcon className="w-4 h-4" /></div>
                        Contas a Receber
                    </h3>
                    <div className="space-y-2.5">
                        {receitasList.length > 0 ? receitasList.map(t => <RenderItem key={t.id} t={t} />) : (
                            <p className="text-center text-gray-400 py-10 text-xs font-bold italic">Nenhuma receita para exibir.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <h3 className="text-lg font-bold mb-5 text-gray-900 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><ArrowDownIcon className="w-4 h-4" /></div>
                        Contas a Pagar
                    </h3>
                    <div className="space-y-2.5">
                        {despesasList.length > 0 ? despesasList.map(t => <RenderItem key={t.id} t={t} />) : (
                            <p className="text-center text-gray-400 py-10 text-xs font-bold italic">Nenhuma despesa para exibir.</p>
                        )}
                    </div>
                </div>
            </div>

            {selectedGroup && (
                <CreditCardDetailModal 
                    isOpen={!!selectedGroup} 
                    onClose={() => setSelectedGroup(null)} 
                    items={selectedGroup} 
                    categories={categories}
                    onUpdateStatus={() => {}} 
                    onDeleteItem={onCancelTransaction || (() => {})}
                    onEditItem={onEditTransaction}
                />
            )}
        </div>
    );
};

export default VisaoGeral;