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
    onOpenImport?: () => void;
    onOpenCreditCard?: () => void;
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
        
        // A Receber
        const receitasPagas = activeTxs.filter(t => t.type === 'receita' && t.status === 'pago').reduce((sum, t) => sum + t.amount, 0);
        const aReceberPendente = activeTxs.filter(t => t.type === 'receita' && t.status === 'pendente').reduce((sum, t) => sum + t.amount, 0);
        const totalReceber = receitasPagas + aReceberPendente;

        // A Pagar
        const despesasPagas = activeTxs.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((sum, t) => sum + t.amount, 0);
        const aPagarPendente = activeTxs.filter(t => t.type === 'despesa' && t.status === 'pendente').reduce((sum, t) => sum + t.amount, 0);
        const totalPagar = despesasPagas + aPagarPendente;
        
        // Saldo inicial de todas as contas ativas
        const totalSaldoInicial = bankAccounts.filter(b => b.active).reduce((sum, b) => sum + (b.initialBalance || 0), 0);
        
        // Saldo Atual
        const saldoAtual = totalSaldoInicial + receitasPagas - despesasPagas;
        
        return { 
            aReceberPendente, 
            receitasPagas, 
            totalReceber,
            aPagarPendente, 
            despesasPagas, 
            totalPagar,
            saldoAtual, 
            totalSaldoInicial,
            receitasDoPeriodo: receitasPagas, 
            despesasDoPeriodo: despesasPagas, 
            resultadoDoPeriodo: receitasPagas - despesasPagas 
        };
    }, [transactions, bankAccounts]);
    
    const currentMonthMetrics = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        const firstDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const lastDayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(new Date(currentYear, currentMonth + 1, 0).getDate()).padStart(2, '0')}`;

        const monthTxs = allTransactions.filter(t => {
            if (t.status === 'cancelado') return false;
            const txDate = t.dueDate ? t.dueDate.split('T')[0] : '';
            return txDate >= firstDayStr && txDate <= lastDayStr;
        });

        const receitasPagas = monthTxs.filter(t => t.type === 'receita' && t.status === 'pago').reduce((sum, t) => sum + t.amount, 0);
        const receitasPendentes = monthTxs.filter(t => t.type === 'receita' && t.status === 'pendente').reduce((sum, t) => sum + t.amount, 0);
        const totalReceitas = receitasPagas + receitasPendentes;

        const despesasPagas = monthTxs.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((sum, t) => sum + t.amount, 0);
        const despesasPendentes = monthTxs.filter(t => t.type === 'despesa' && t.status === 'pendente').reduce((sum, t) => sum + t.amount, 0);
        const totalDespesas = despesasPagas + despesasPendentes;

        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const monthLabel = monthNames[currentMonth];

        return {
            receitasPagas,
            receitasPendentes,
            totalReceitas,
            despesasPagas,
            despesasPendentes,
            totalDespesas,
            monthLabel
        };
    }, [allTransactions]);
    
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {/* 1. A Receber (YTD) Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100/80 dark:border-gray-700/80 hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-emerald-500 to-green-400 text-white shadow-lg shadow-emerald-500/10">
                            <ArrowUpIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">A receber (YTD)</p>
                            <p className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">{formatCurrency(metrics.totalReceber)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Já recebido</p>
                            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">{formatCurrency(metrics.receitasPagas)}</p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700/50 px-1">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Em aberto</p>
                            <p className="text-[11px] font-bold text-amber-500 truncate mt-0.5">{formatCurrency(metrics.aReceberPendente)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Total</p>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate mt-0.5">{formatCurrency(metrics.totalReceber)}</p>
                        </div>
                    </div>
                </div>

                {/* 2. A Pagar (YTD) Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100/80 dark:border-gray-700/80 hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-rose-500 to-red-400 text-white shadow-lg shadow-rose-500/10">
                            <ArrowDownIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">A pagar (YTD)</p>
                            <p className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">{formatCurrency(metrics.totalPagar)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Já pago</p>
                            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-450 truncate mt-0.5">{formatCurrency(metrics.despesasPagas)}</p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700/50 px-1">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Em aberto</p>
                            <p className="text-[11px] font-bold text-amber-500 truncate mt-0.5">{formatCurrency(metrics.aPagarPendente)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Total</p>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate mt-0.5">{formatCurrency(metrics.totalPagar)}</p>
                        </div>
                    </div>
                </div>

                {/* 3. Saldo em Caixa Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100/80 dark:border-gray-700/80 hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-500 text-white shadow-lg shadow-blue-500/10">
                            <DollarIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">Saldo em caixa</p>
                            <p className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">{formatCurrency(metrics.saldoAtual)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Saldo inicial</p>
                            <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 truncate mt-0.5">{formatCurrency(metrics.totalSaldoInicial)}</p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700/50 px-1">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Variação</p>
                            <p className={`text-[11px] font-bold truncate mt-0.5 ${metrics.resultadoDoPeriodo >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {metrics.resultadoDoPeriodo > 0 ? '+' : ''}{formatCurrency(metrics.resultadoDoPeriodo)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Saldo atual</p>
                            <p className="text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate mt-0.5">{formatCurrency(metrics.saldoAtual)}</p>
                        </div>
                    </div>
                </div>

                {/* 4. Resultado do Período Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100/80 dark:border-gray-700/80 hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/10">
                            <CalendarIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">Resultado do período</p>
                            <p className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">{formatCurrency(metrics.resultadoDoPeriodo)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Receitas</p>
                            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate mt-0.5">{formatCurrency(metrics.receitasDoPeriodo)}</p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700/50 px-1">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Despesas</p>
                            <p className="text-[11px] font-bold text-rose-600 dark:text-rose-450 truncate mt-0.5">{formatCurrency(metrics.despesasDoPeriodo)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Resultado</p>
                            <p className={`text-[11px] font-bold truncate mt-0.5 ${metrics.resultadoDoPeriodo >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-rose-600'}`}>{formatCurrency(metrics.resultadoDoPeriodo)}</p>
                        </div>
                    </div>
                </div>

                {/* 5. Receitas (Mês) Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100/80 dark:border-gray-700/80 hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-teal-500 to-cyan-400 text-white shadow-lg shadow-teal-500/10">
                            <ArrowUpIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">Receitas ({currentMonthMetrics.monthLabel})</p>
                            <p className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">{formatCurrency(currentMonthMetrics.totalReceitas)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Já recebido</p>
                            <p className="text-[11px] font-bold text-teal-600 dark:text-teal-400 truncate mt-0.5">{formatCurrency(currentMonthMetrics.receitasPagas)}</p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700/50 px-1">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Em aberto</p>
                            <p className="text-[11px] font-bold text-amber-500 truncate mt-0.5">{formatCurrency(currentMonthMetrics.receitasPendentes)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Total</p>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate mt-0.5">{formatCurrency(currentMonthMetrics.totalReceitas)}</p>
                        </div>
                    </div>
                </div>

                {/* 6. Despesas (Mês) Card */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-4 border border-gray-100/80 dark:border-gray-700/80 hover:shadow-md transition-all duration-300 group hover:-translate-y-0.5">
                    <div className="flex items-center space-x-3 mb-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white shadow-lg shadow-amber-500/10">
                            <ArrowDownIcon className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tracking-wide">Despesas ({currentMonthMetrics.monthLabel})</p>
                            <p className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight mt-0.5">{formatCurrency(currentMonthMetrics.totalDespesas)}</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-2.5 mt-2.5 border-t border-gray-100 dark:border-gray-700/60">
                        <div>
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Já pago</p>
                            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-500 truncate mt-0.5">{formatCurrency(currentMonthMetrics.despesasPagas)}</p>
                        </div>
                        <div className="text-center border-x border-gray-100 dark:border-gray-700/50 px-1">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Em aberto</p>
                            <p className="text-[11px] font-bold text-orange-500 truncate mt-0.5">{formatCurrency(currentMonthMetrics.despesasPendentes)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">Total</p>
                            <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate mt-0.5">{formatCurrency(currentMonthMetrics.totalDespesas)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                {/* Aqui passamos allTransactions para o gráfico mostrar o ano inteiro */}
                <FluxoCaixaChart transactions={allTransactions} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 text-nowrap">
                            <div className="p-1.5 bg-green-100 text-green-600 rounded-lg"><ArrowUpIcon className="w-4 h-4" /></div>
                            Contas a Receber
                        </h3>
                        <div className="flex gap-4 items-center bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div className="text-center px-1">
                                <p className="text-[7px] font-bold text-gray-400 tracking-tighter">Já recebido</p>
                                <p className="text-[10px] font-black text-green-600">{formatCurrency(metrics.receitasPagas)}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
                            <div className="text-center px-1">
                                <p className="text-[7px] font-bold text-gray-400 tracking-tighter">Em aberto</p>
                                <p className="text-[10px] font-black text-orange-500">{formatCurrency(metrics.aReceberPendente)}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
                            <div className="text-center px-1">
                                <p className="text-[7px] font-bold text-gray-400 tracking-tighter">Total</p>
                                <p className="text-[10px] font-black text-gray-700 dark:text-gray-200">{formatCurrency(metrics.totalReceber)}</p>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-2.5">
                        {receitasList.length > 0 ? receitasList.map(t => <RenderItem key={t.id} t={t} />) : (
                            <p className="text-center text-gray-400 py-10 text-xs font-bold italic">Nenhuma receita para exibir.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 gap-4">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 text-nowrap">
                            <div className="p-1.5 bg-red-100 text-red-600 rounded-lg"><ArrowDownIcon className="w-4 h-4" /></div>
                            Contas a Pagar
                        </h3>
                        <div className="flex gap-4 items-center bg-gray-50 dark:bg-gray-700/30 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                            <div className="text-center px-1">
                                <p className="text-[7px] font-bold text-gray-400 tracking-tighter">Já pago</p>
                                <p className="text-[10px] font-black text-red-600">{formatCurrency(metrics.despesasPagas)}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
                            <div className="text-center px-1">
                                <p className="text-[7px] font-bold text-gray-400 tracking-tighter">Em aberto</p>
                                <p className="text-[10px] font-black text-orange-500">{formatCurrency(metrics.aPagarPendente)}</p>
                            </div>
                            <div className="w-px h-6 bg-gray-200 dark:bg-gray-600" />
                            <div className="text-center px-1">
                                <p className="text-[7px] font-bold text-gray-400 tracking-tighter">Total</p>
                                <p className="text-[10px] font-black text-gray-700 dark:text-gray-200">{formatCurrency(metrics.totalPagar)}</p>
                            </div>
                        </div>
                    </div>
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