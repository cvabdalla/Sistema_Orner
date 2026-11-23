import React, { useState, useMemo, useEffect } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory } from '../../types';
import {
    EditIcon,
    CreditCardIcon,
    EyeIcon,
    CheckCircleIcon,
    XCircleIcon,
    ExclamationTriangleIcon,
    SearchIcon,
    ChevronDownIcon,
    ClockIcon,
} from '../../assets/icons';
import CreditCardDetailModal from './CreditCardDetailModal';
import Modal from '../Modal';

interface ContasTableProps {
    title: string;
    transactions: FinancialTransaction[];
    categories: FinancialCategory[];
    onEdit: (transaction: FinancialTransaction) => void;
    onCancel: (id: string) => void;
    onStatusChange: (id: string, status: FinancialTransactionStatus) => void;
    onOpenCreditCard?: () => void;
    mode?: 'receber' | 'pagar' | 'cancelados';
}

type StatusFilterOption = 'all' | 'atrasado' | 'pendente' | 'pago';
type ViewMode = 'grouped' | 'split';
type SortField = 'dueDate' | 'description' | 'category' | 'amount' | 'status';

const VIEW_MODE_STORAGE_KEY = 'orner_contas_view_mode';

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
    }).format(value);
};

const formatDate = (dateString?: string) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
};

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const getTodayStr = () => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const SplitColumnsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="3.5" width="6.25" height="13" rx="1.5" />
        <rect x="11.25" y="3.5" width="6.25" height="13" rx="1.5" />
    </svg>
);

const GroupedRowsIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2.5" y="3.5" width="15" height="3.5" rx="1" />
        <line x1="2.5" y1="10.5" x2="17.5" y2="10.5" />
        <line x1="2.5" y1="14" x2="17.5" y2="14" />
        <line x1="2.5" y1="17" x2="13" y2="17" />
    </svg>
);

const ContasTable: React.FC<ContasTableProps> = ({
    title,
    transactions,
    categories,
    onEdit,
    onCancel,
    onStatusChange,
    onOpenCreditCard,
    mode,
}) => {
    const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
            if (saved === 'split' || saved === 'grouped') return saved;
        }
        return 'grouped';
    });
    const [selectedGroup, setSelectedGroup] = useState<FinancialTransaction[] | null>(null);
    const [sortField, setSortField] = useState<SortField>('dueDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [collapsedSections, setCollapsedSections] = useState<{
        overdue: boolean;
        open: boolean;
        paid: boolean;
    }>({
        overdue: false,
        open: false,
        paid: false,
    });

    const [confirmingTx, setConfirmingTx] = useState<{
        id: string;
        type: 'receita' | 'despesa';
        description: string;
        amount: number;
        isGroup: boolean;
        originalItems?: FinancialTransaction[];
    } | null>(null);

    const handleViewModeChange = (nextMode: ViewMode) => {
        setViewMode(nextMode);
        if (typeof window !== 'undefined') {
            localStorage.setItem(VIEW_MODE_STORAGE_KEY, nextMode);
        }
    };

    const isCancelledView = useMemo(() => {
        if (mode === 'cancelados') return true;
        if (mode === 'receber' || mode === 'pagar') return false;
        return transactions.length > 0 && transactions.every((t) => t.status === 'cancelado');
    }, [mode, transactions]);

    const isReceita = useMemo(() => {
        if (mode === 'receber') return true;
        if (mode === 'pagar') return false;
        return transactions.length > 0 && transactions.some((t) => t.type === 'receita');
    }, [mode, transactions]);

    // Reseta filtros internos ao alternar entre A Receber, A Pagar e Cancelados
    useEffect(() => {
        setStatusFilter('all');
        setSearchQuery('');
    }, [mode, title]);

    const todayStr = getTodayStr();

    const getCategoryName = (categoryId: string) => {
        if (categoryId === 'cc-group') return 'Fatura consolidada';
        const cat = categories.find((c) => c.id === categoryId);
        return cat?.name || 'Sem categoria';
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortOrder(field === 'amount' ? 'desc' : 'asc');
        }
    };

    // 1. Consolida lançamentos de cartão de crédito por vencimento e normaliza descrições
    const consolidatedTransactions = useMemo(() => {
        const ccGroups: Record<string, { items: FinancialTransaction[]; dueDate: string }> = {};
        const normalTransactions: any[] = [];

        transactions.forEach((t) => {
            if (t.id.startsWith('cc-') && t.type === 'despesa' && t.status !== 'cancelado') {
                const groupKey = `CC_GROUPED_${t.dueDate}`;
                if (!ccGroups[groupKey]) {
                    ccGroups[groupKey] = { items: [], dueDate: t.dueDate };
                }
                ccGroups[groupKey].items.push(t);
            } else {
                normalTransactions.push({
                    ...t,
                    displayDescription: toTitleCase(t.description),
                    categoryName: getCategoryName(t.categoryId),
                });
            }
        });

        const groupedCC: any[] = Object.entries(ccGroups).map(([key, groupData]) => {
            const group = groupData.items;
            const totalAmount = group.reduce((sum, item) => sum + (item.amount || 0), 0);
            const allPaid = group.every((item) => item.status === 'pago');
            const anyInvoiceSent = group.some((item) => item.invoiceSent);

            return {
                id: `grouped-${key}`,
                description: 'Cartão de Crédito',
                displayDescription: 'Cartão de Crédito',
                amount: totalAmount,
                dueDate: groupData.dueDate,
                paymentDate: allPaid ? group.find((i) => i.paymentDate)?.paymentDate : undefined,
                status: allPaid ? 'pago' : 'pendente',
                categoryId: 'cc-group',
                categoryName: 'Fatura consolidada',
                type: 'despesa',
                isGrouped: true,
                invoiceSent: anyInvoiceSent,
                originalItems: group,
            };
        });

        return [...normalTransactions, ...groupedCC];
    }, [transactions, categories]);

    // 2. Aplica busca textual (antes da separação por status para refletir nos totais e seções)
    const searchFilteredTransactions = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return consolidatedTransactions;

        return consolidatedTransactions.filter((tx) => {
            const desc = String(tx.displayDescription || tx.description || '').toLowerCase();
            const cat = String(tx.categoryName || '').toLowerCase();
            const reason = String(tx.cancelReason || '').toLowerCase();
            return desc.includes(q) || cat.includes(q) || reason.includes(q);
        });
    }, [consolidatedTransactions, searchQuery]);

    // 3. Ordenação padrão compartilhada
    const sortList = (list: any[]) => {
        return [...list].sort((a, b) => {
            if (sortField === 'dueDate') {
                const dateA = String(a.dueDate || '');
                const dateB = String(b.dueDate || '');
                const cmp = dateA.localeCompare(dateB);
                if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
                const pA = a.status === 'pendente' ? 0 : 1;
                const pB = b.status === 'pendente' ? 0 : 1;
                if (pA !== pB) return pA - pB;
                return (b.amount || 0) - (a.amount || 0);
            }

            if (sortField === 'amount') {
                const cmp = (a.amount || 0) - (b.amount || 0);
                return sortOrder === 'asc' ? cmp : -cmp;
            }

            if (sortField === 'description') {
                const descA = String(a.displayDescription || a.description || '');
                const descB = String(b.displayDescription || b.description || '');
                const cmp = descA.localeCompare(descB);
                return sortOrder === 'asc' ? cmp : -cmp;
            }

            if (sortField === 'category') {
                const catA = String(a.categoryName || '');
                const catB = String(b.categoryName || '');
                const cmp = catA.localeCompare(catB);
                return sortOrder === 'asc' ? cmp : -cmp;
            }

            if (sortField === 'status') {
                const stA = String(a.status || '');
                const stB = String(b.status || '');
                const cmp = stA.localeCompare(stB);
                if (cmp !== 0) return sortOrder === 'asc' ? cmp : -cmp;
                return String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
            }

            return 0;
        });
    };

    // 4. Partição em Atrasados, Em Aberto no Mês (no prazo) e Pagos/Recebidos
    const buckets = useMemo(() => {
        const overdue: any[] = [];
        const upcomingOpen: any[] = [];
        const paid: any[] = [];
        const cancelled: any[] = [];

        searchFilteredTransactions.forEach((tx) => {
            if (tx.status === 'cancelado') {
                cancelled.push(tx);
            } else if (tx.status === 'pago') {
                paid.push(tx);
            } else if (tx.dueDate && tx.dueDate < todayStr) {
                overdue.push(tx);
            } else {
                upcomingOpen.push(tx);
            }
        });

        const sortedOverdue = sortList(overdue);
        const sortedUpcoming = sortList(upcomingOpen);
        const sortedPaid = sortList(paid);
        const sortedCancelled = sortList(cancelled);

        const overdueSum = sortedOverdue.reduce((acc, i) => acc + (i.amount || 0), 0);
        const upcomingSum = sortedUpcoming.reduce((acc, i) => acc + (i.amount || 0), 0);
        const paidSum = sortedPaid.reduce((acc, i) => acc + (i.amount || 0), 0);
        const cancelledSum = sortedCancelled.reduce((acc, i) => acc + (i.amount || 0), 0);
        const openSum = overdueSum + upcomingSum;
        const totalSum = openSum + paidSum;

        return {
            overdue: sortedOverdue,
            upcomingOpen: sortedUpcoming,
            paid: sortedPaid,
            cancelled: sortedCancelled,
            overdueSum,
            upcomingSum,
            openSum,
            paidSum,
            totalSum,
            cancelledSum,
            openCount: sortedOverdue.length + sortedUpcoming.length,
            totalCount: sortedOverdue.length + sortedUpcoming.length + sortedPaid.length,
        };
    }, [searchFilteredTransactions, sortField, sortOrder, todayStr]);

    // Percentuais para a barra de realização mensal (protegendo contra valores negativos/zero)
    const progressMetrics = useMemo(() => {
        const safePaid = Math.max(0, buckets.paidSum);
        const safeOverdue = Math.max(0, buckets.overdueSum);
        const safeUpcoming = Math.max(0, buckets.upcomingSum);
        const denominator = safePaid + safeOverdue + safeUpcoming;

        if (denominator <= 0) {
            return { paidPct: 0, overduePct: 0, upcomingPct: 0 };
        }

        const paidPct = Math.round((safePaid / denominator) * 100);
        const overduePct = Math.round((safeOverdue / denominator) * 100);
        const upcomingPct = Math.max(0, 100 - paidPct - overduePct);
        return { paidPct, overduePct, upcomingPct };
    }, [buckets]);

    const handleConfirmEffectivation = () => {
        if (!confirmingTx) return;
        if (confirmingTx.isGroup && confirmingTx.originalItems) {
            confirmingTx.originalItems.forEach((item) => onStatusChange(item.id, 'pago'));
        } else {
            onStatusChange(confirmingTx.id, 'pago');
        }
        setConfirmingTx(null);
    };

    const toggleSection = (key: 'overdue' | 'open' | 'paid') => {
        setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const paidWord = isReceita ? 'Recebido' : 'Pago';
    const paidPluralLabel = isReceita ? 'Recebidos' : 'Pagos';
    const paidSectionTitle = isReceita ? 'Já recebidos no mês' : 'Já pagos no mês';
    const paidKpiLabel = isReceita ? 'Já recebido' : 'Já pago';
    const actionLabel = isReceita ? 'Receber' : 'Pagar';

    // Renderizador de linha para a tabela agrupada em largura total
    const renderTableRow = (tx: any, section: 'overdue' | 'open' | 'paid' | 'cancelled') => {
        const isPaid = section === 'paid';
        const isCancelled = section === 'cancelled';
        const isOverdue = section === 'overdue';
        const isPending = !isPaid && !isCancelled;
        const isApprovedForPayment = Boolean(tx.invoiceSent) && isPending;

        let statusText = 'Em aberto';
        let statusTextClass = 'text-amber-700 dark:text-amber-300';
        if (isCancelled) {
            statusText = 'Cancelado';
            statusTextClass = 'text-rose-600 dark:text-rose-400';
        } else if (isPaid) {
            statusText = paidWord;
            statusTextClass = 'text-emerald-700 dark:text-emerald-400';
        } else if (isApprovedForPayment) {
            statusText = 'Liberado p/ pag.';
            statusTextClass = 'text-emerald-700 dark:text-emerald-400';
        } else if (isOverdue) {
            statusText = 'Atrasado';
            statusTextClass = 'text-rose-700 dark:text-rose-400';
        }

        const rowBg = isApprovedForPayment
            ? 'bg-emerald-50/35 dark:bg-emerald-950/15 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25'
            : isOverdue
            ? 'bg-rose-50/35 dark:bg-rose-950/15 hover:bg-rose-50/70 dark:hover:bg-rose-950/25'
            : isPaid
            ? 'bg-white dark:bg-gray-800/70 hover:bg-slate-50/80 dark:hover:bg-gray-700/40'
            : 'bg-white dark:bg-gray-800 hover:bg-slate-50/80 dark:hover:bg-gray-700/40';

        return (
            <tr key={tx.id} className={`transition-colors duration-150 ${rowBg}`}>
                <td className="py-3.5 px-5 align-middle">
                    <div className="flex items-start gap-2.5">
                        {tx.isGrouped ? (
                            <CreditCardIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                        ) : isPaid ? (
                            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : isOverdue ? (
                            <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        ) : isApprovedForPayment ? (
                            <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : null}

                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                <span
                                    className={`text-[13px] font-semibold leading-snug ${
                                        isCancelled
                                            ? 'line-through text-slate-400 dark:text-slate-500'
                                            : isOverdue
                                            ? 'text-slate-900 dark:text-white font-bold'
                                            : isPaid
                                            ? 'text-slate-700 dark:text-slate-200'
                                            : 'text-slate-900 dark:text-white'
                                    }`}
                                >
                                    {tx.displayDescription}
                                </span>
                                {isApprovedForPayment && (
                                    <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                                        · Liberado p/ pag. (OK)
                                    </span>
                                )}
                                {isOverdue && isApprovedForPayment && (
                                    <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                                        · Vencido
                                    </span>
                                )}
                            </div>
                            {tx.isGrouped && (
                                <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                                    Fatura consolidada · {tx.originalItems.length}{' '}
                                    {tx.originalItems.length === 1 ? 'item' : 'itens'}
                                </p>
                            )}
                            {isCancelled && tx.cancelReason && (
                                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                                    Motivo: {tx.cancelReason}
                                </p>
                            )}
                        </div>
                    </div>
                </td>

                <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 align-middle">
                    {tx.categoryName}
                </td>

                <td
                    className={`py-3.5 px-4 text-xs font-medium text-center tabular-nums whitespace-nowrap align-middle ${
                        isCancelled
                            ? 'text-slate-400 line-through'
                            : isOverdue
                            ? 'text-rose-700 dark:text-rose-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-300'
                    }`}
                >
                    {formatDate(tx.dueDate)}
                </td>

                <td
                    className={`py-3.5 px-4 text-[13px] font-bold text-right tabular-nums whitespace-nowrap align-middle ${
                        isCancelled
                            ? 'text-slate-400 line-through'
                            : isPaid
                            ? isReceita
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-800 dark:text-slate-200'
                            : isReceita
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : isOverdue
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-slate-900 dark:text-white'
                    }`}
                >
                    {formatCurrency(tx.amount)}
                </td>

                <td className="py-3.5 px-4 text-center whitespace-nowrap align-middle">
                    <span className={`text-xs font-semibold ${statusTextClass}`}>{statusText}</span>
                </td>

                <td className="py-3.5 px-5 text-right whitespace-nowrap align-middle">
                    <div className="flex justify-end items-center gap-1.5">
                        {isCancelled ? (
                            <button
                                onClick={() => onEdit(tx)}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                                title="Ver detalhes"
                            >
                                <EyeIcon className="w-4 h-4" />
                            </button>
                        ) : tx.isGrouped ? (
                            <>
                                {!isPaid && (
                                    <button
                                        onClick={() =>
                                            setConfirmingTx({
                                                id: tx.id,
                                                type: tx.type,
                                                description: tx.displayDescription,
                                                amount: tx.amount,
                                                isGroup: true,
                                                originalItems: tx.originalItems,
                                            })
                                        }
                                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap"
                                    >
                                        Pagar fatura
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedGroup(tx.originalItems)}
                                    className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                    title="Ver itens da fatura"
                                >
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                {isPending && (
                                    <button
                                        onClick={() =>
                                            setConfirmingTx({
                                                id: tx.id,
                                                type: tx.type,
                                                description: tx.displayDescription,
                                                amount: tx.amount,
                                                isGroup: false,
                                            })
                                        }
                                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                                            isApprovedForPayment
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white border border-emerald-200 dark:border-emerald-800'
                                        }`}
                                    >
                                        {actionLabel}
                                    </button>
                                )}
                                <button
                                    onClick={() => onEdit(tx)}
                                    className="p-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                    title="Editar lançamento"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onCancel(tx.id)}
                                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Cancelar lançamento"
                                >
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    // Renderizador compacto para a visão Lado a Lado (Split View)
    const renderSplitRow = (tx: any, section: 'overdue' | 'open' | 'paid') => {
        const isPaid = section === 'paid';
        const isOverdue = section === 'overdue';
        const isPending = !isPaid;
        const isApprovedForPayment = Boolean(tx.invoiceSent) && isPending;

        return (
            <div
                key={tx.id}
                className={`px-4 py-3 flex items-center justify-between gap-3 transition-colors duration-150 ${
                    isApprovedForPayment
                        ? 'bg-emerald-50/35 dark:bg-emerald-950/15 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25'
                        : isOverdue
                        ? 'bg-rose-50/40 dark:bg-rose-950/15 hover:bg-rose-50/75 dark:hover:bg-rose-950/25'
                        : 'bg-white dark:bg-gray-800 hover:bg-slate-50/80 dark:hover:bg-gray-700/40'
                }`}
            >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    {tx.isGrouped ? (
                        <CreditCardIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    ) : isPaid ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : isOverdue ? (
                        <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    ) : isApprovedForPayment ? (
                        <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                        <ClockIcon className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}

                    <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">
                            {tx.displayDescription}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span className="truncate max-w-[180px]">{tx.categoryName}</span>
                            <span aria-hidden="true">·</span>
                            <span
                                className={`tabular-nums ${
                                    isOverdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''
                                }`}
                            >
                                {formatDate(tx.dueDate)}
                            </span>
                            {tx.isGrouped && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                                        {tx.originalItems.length}{' '}
                                        {tx.originalItems.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </>
                            )}
                            {isApprovedForPayment && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                                        Liberado p/ pag. (OK)
                                    </span>
                                </>
                            )}
                            {isOverdue && (
                                <>
                                    <span aria-hidden="true">·</span>
                                    <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                        Atrasado
                                    </span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`text-[13px] font-bold tabular-nums whitespace-nowrap ${
                            isPaid
                                ? isReceita
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-800 dark:text-slate-200'
                                : isOverdue
                                ? 'text-rose-700 dark:text-rose-400'
                                : isReceita
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-slate-900 dark:text-white'
                        }`}
                    >
                        {formatCurrency(tx.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                        {tx.isGrouped ? (
                            <>
                                {!isPaid && (
                                    <button
                                        onClick={() =>
                                            setConfirmingTx({
                                                id: tx.id,
                                                type: tx.type,
                                                description: tx.displayDescription,
                                                amount: tx.amount,
                                                isGroup: true,
                                                originalItems: tx.originalItems,
                                            })
                                        }
                                        className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors whitespace-nowrap"
                                    >
                                        Pagar fatura
                                    </button>
                                )}
                                <button
                                    onClick={() => setSelectedGroup(tx.originalItems)}
                                    className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                    title="Ver itens da fatura"
                                >
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                            </>
                        ) : (
                            <>
                                {isPending && (
                                    <button
                                        onClick={() =>
                                            setConfirmingTx({
                                                id: tx.id,
                                                type: tx.type,
                                                description: tx.displayDescription,
                                                amount: tx.amount,
                                                isGroup: false,
                                            })
                                        }
                                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                                            isApprovedForPayment
                                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                                                : 'bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-600 dark:hover:text-white border border-emerald-200 dark:border-emerald-800'
                                        }`}
                                    >
                                        {actionLabel}
                                    </button>
                                )}
                                <button
                                    onClick={() => onEdit(tx)}
                                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                    title="Editar lançamento"
                                >
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onCancel(tx.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                    title="Cancelar lançamento"
                                >
                                    <XCircleIcon className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // Cabeçalho da tabela ordenável
    const renderTableHead = () => (
        <thead className="bg-slate-50/80 dark:bg-gray-900/40 border-b border-slate-200 dark:border-gray-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400 select-none">
            <tr>
                <th
                    onClick={() => handleSort('description')}
                    className="px-5 py-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Ordenar por descrição"
                >
                    <div className="flex items-center gap-1.5">
                        <span>Descrição</span>
                        {sortField === 'description' && (
                            <span className="text-indigo-600 dark:text-indigo-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                    </div>
                </th>
                <th
                    onClick={() => handleSort('category')}
                    className="px-4 py-3 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Ordenar por categoria"
                >
                    <div className="flex items-center gap-1.5">
                        <span>Categoria</span>
                        {sortField === 'category' && (
                            <span className="text-indigo-600 dark:text-indigo-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                    </div>
                </th>
                <th
                    onClick={() => handleSort('dueDate')}
                    className="px-4 py-3 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Ordenar por vencimento"
                >
                    <div className="flex items-center justify-center gap-1.5">
                        <span>Vencimento</span>
                        {sortField === 'dueDate' ? (
                            <span className="text-indigo-600 dark:text-indigo-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                            <span className="text-slate-300 dark:text-slate-600">⇅</span>
                        )}
                    </div>
                </th>
                <th
                    onClick={() => handleSort('amount')}
                    className="px-4 py-3 text-right cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Ordenar por valor"
                >
                    <div className="flex items-center justify-end gap-1.5">
                        <span>Valor</span>
                        {sortField === 'amount' && (
                            <span className="text-indigo-600 dark:text-indigo-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                    </div>
                </th>
                <th
                    onClick={() => handleSort('status')}
                    className="px-4 py-3 text-center cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    title="Ordenar por status"
                >
                    <div className="flex items-center justify-center gap-1.5">
                        <span>Status</span>
                        {sortField === 'status' && (
                            <span className="text-indigo-600 dark:text-indigo-400">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        )}
                    </div>
                </th>
                <th className="px-5 py-3 text-right">Ações</th>
            </tr>
        </thead>
    );

    // Visão dedicada para a aba de Cancelados
    if (isCancelledView) {
        return (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-slate-100 dark:border-gray-700 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                            {buckets.cancelled.length}{' '}
                            {buckets.cancelled.length === 1 ? 'lançamento cancelado' : 'lançamentos cancelados'} · Total{' '}
                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                {formatCurrency(buckets.cancelledSum)}
                            </span>
                        </p>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar descrição, categoria ou motivo..."
                            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 dark:bg-gray-900 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                title="Limpar busca"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full text-left border-collapse">
                        {renderTableHead()}
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-700/80">
                            {buckets.cancelled.map((tx) => renderTableRow(tx, 'cancelled'))}
                            {buckets.cancelled.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center text-xs text-slate-400 dark:text-slate-500">
                                        Nenhum lançamento cancelado encontrado neste período.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    const showOverdueSection =
        (statusFilter === 'all' || statusFilter === 'atrasado' || statusFilter === 'pendente') &&
        buckets.overdue.length > 0;
    const showUpcomingSection =
        (statusFilter === 'all' || statusFilter === 'pendente') &&
        (buckets.upcomingOpen.length > 0 || statusFilter === 'pendente');
    const showPaidSection =
        (statusFilter === 'all' || statusFilter === 'pago') &&
        (buckets.paid.length > 0 || statusFilter === 'pago');

    const hasAnyVisibleGrouped =
        (showOverdueSection && buckets.overdue.length > 0) ||
        (showUpcomingSection && buckets.upcomingOpen.length > 0) ||
        (showPaidSection && buckets.paid.length > 0);

    const showOpenColumnInSplit = statusFilter === 'all' || statusFilter === 'atrasado' || statusFilter === 'pendente';
    const showPaidColumnInSplit = statusFilter === 'all' || statusFilter === 'pago';

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden flex flex-col">
            {/* Cabeçalho + Faixa de Resumo Mensal */}
            <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-gray-700 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-baseline gap-2.5">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {buckets.totalCount} {buckets.totalCount === 1 ? 'lançamento' : 'lançamentos'}
                        </span>
                    </div>

                    {onOpenCreditCard && (
                        <button
                            onClick={onOpenCreditCard}
                            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 rounded-lg transition-colors font-semibold text-xs whitespace-nowrap shrink-0"
                        >
                            <CreditCardIcon className="w-4 h-4 shrink-0" />
                            <span>Lançar cartão</span>
                        </button>
                    )}
                </div>

                {/* 3 Métricas Executivas em Faixa Plana + Barra de Realização */}
                <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-gray-700/80">
                        <div className="pb-3 sm:pb-0 sm:pr-6">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total no período</p>
                            <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums tracking-tight mt-0.5">
                                {formatCurrency(buckets.totalSum)}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                {buckets.totalCount} {buckets.totalCount === 1 ? 'registro ativo' : 'registros ativos'}
                            </p>
                        </div>

                        <div className="py-3 sm:py-0 sm:px-6">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{paidKpiLabel}</p>
                            <div className="flex items-baseline gap-2 mt-0.5">
                                <p className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight">
                                    {formatCurrency(buckets.paidSum)}
                                </p>
                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                                    {progressMetrics.paidPct}%
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                                {buckets.paid.length} {buckets.paid.length === 1 ? 'item liquidado' : 'itens liquidados'}
                            </p>
                        </div>

                        <div className="pt-3 sm:pt-0 sm:pl-6">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Em aberto</p>
                            <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums tracking-tight mt-0.5">
                                {formatCurrency(buckets.openSum)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] tabular-nums">
                                <span className="text-slate-500 dark:text-slate-400">
                                    {buckets.openCount} {buckets.openCount === 1 ? 'item pendente' : 'itens pendentes'}
                                </span>
                                {buckets.overdue.length > 0 && (
                                    <>
                                        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">
                                            ·
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setStatusFilter((prev) => (prev === 'atrasado' ? 'all' : 'atrasado'))
                                            }
                                            className="font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                                        >
                                            {buckets.overdue.length}{' '}
                                            {buckets.overdue.length === 1 ? 'atrasado' : 'atrasados'} (
                                            {formatCurrency(buckets.overdueSum)})
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Barra visual de progresso do mês */}
                    <div className="space-y-1.5">
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-gray-700/70 overflow-hidden flex">
                            {progressMetrics.paidPct > 0 && (
                                <div
                                    style={{ width: `${progressMetrics.paidPct}%` }}
                                    className="bg-emerald-500 transition-all duration-300"
                                    title={`${paidKpiLabel}: ${progressMetrics.paidPct}%`}
                                />
                            )}
                            {progressMetrics.upcomingPct > 0 && (
                                <div
                                    style={{ width: `${progressMetrics.upcomingPct}%` }}
                                    className="bg-amber-400 transition-all duration-300"
                                    title={`Em aberto no prazo: ${progressMetrics.upcomingPct}%`}
                                />
                            )}
                            {progressMetrics.overduePct > 0 && (
                                <div
                                    style={{ width: `${progressMetrics.overduePct}%` }}
                                    className="bg-rose-500 transition-all duration-300"
                                    title={`Atrasados: ${progressMetrics.overduePct}%`}
                                />
                            )}
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                            <span>Realização do período: {progressMetrics.paidPct}%</span>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />
                                    {paidPluralLabel}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />
                                    A vencer
                                </span>
                                {buckets.overdue.length > 0 && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" />
                                        Atrasados
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Barra de Ferramentas: Busca + Filtros Segmentados + Alternador de Visualização */}
            <div className="px-5 py-3 bg-slate-50/70 dark:bg-gray-900/30 border-b border-slate-200/80 dark:border-gray-700 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                    {/* Busca rápida */}
                    <div className="relative w-full sm:w-64">
                        <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar descrição ou categoria..."
                            className="w-full pl-9 pr-8 py-1.5 text-xs bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                title="Limpar busca"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Filtros rápidos de status */}
                    <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-200/60 dark:bg-gray-800 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setStatusFilter('all')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                statusFilter === 'all'
                                    ? 'bg-white dark:bg-gray-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Todos ({buckets.totalCount})
                        </button>
                        {buckets.overdue.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setStatusFilter('atrasado')}
                                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                    statusFilter === 'atrasado'
                                        ? 'bg-white dark:bg-gray-700 text-rose-700 dark:text-rose-400 shadow-sm'
                                        : 'text-rose-600 dark:text-rose-400 hover:text-rose-800'
                                }`}
                            >
                                Atrasados ({buckets.overdue.length})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => setStatusFilter('pendente')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                statusFilter === 'pendente'
                                    ? 'bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            Em aberto ({buckets.openCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setStatusFilter('pago')}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                statusFilter === 'pago'
                                    ? 'bg-white dark:bg-gray-700 text-emerald-700 dark:text-emerald-400 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                        >
                            {paidPluralLabel} ({buckets.paid.length})
                        </button>
                    </div>
                </div>

                {/* Controles à direita: ordenação (no modo Lado a lado) + Alternador de Visualização */}
                <div className="flex items-center justify-between lg:justify-end gap-2.5 shrink-0">
                    {viewMode === 'split' && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="hidden sm:inline">Ordenar:</span>
                            <select
                                value={`${sortField}:${sortOrder}`}
                                onChange={(e) => {
                                    const [f, o] = e.target.value.split(':') as [SortField, 'asc' | 'desc'];
                                    setSortField(f);
                                    setSortOrder(o);
                                }}
                                className="bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-indigo-500"
                            >
                                <option value="dueDate:asc">Vencimento (mais antigo)</option>
                                <option value="dueDate:desc">Vencimento (mais recente)</option>
                                <option value="amount:desc">Maior valor</option>
                                <option value="amount:asc">Menor valor</option>
                                <option value="description:asc">Descrição (A–Z)</option>
                            </select>
                        </div>
                    )}

                    {/* Alternador Agrupado | Lado a lado */}
                    <div
                        className="flex items-center gap-1 p-1 bg-slate-200/60 dark:bg-gray-800 rounded-lg shrink-0"
                        role="group"
                        aria-label="Modo de visualização"
                    >
                        <button
                            type="button"
                            onClick={() => handleViewModeChange('grouped')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                viewMode === 'grouped'
                                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Exibir em seções agrupadas em largura total"
                        >
                            <GroupedRowsIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Agrupado</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleViewModeChange('split')}
                            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                                viewMode === 'split'
                                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                            }`}
                            title="Exibir Em aberto e Pagos/Recebidos lado a lado"
                        >
                            <SplitColumnsIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Lado a lado</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            {viewMode === 'grouped' ? (
                /* MODO 1: SEÇÕES AGRUPADAS EM LARGURA TOTAL */
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left border-collapse">
                        {renderTableHead()}
                        <tbody className="divide-y divide-slate-100 dark:divide-gray-700/80">
                            {/* Seção 1: Atrasados */}
                            {showOverdueSection && (
                                <>
                                    <tr
                                        onClick={() => toggleSection('overdue')}
                                        className="bg-rose-50/90 dark:bg-rose-950/35 cursor-pointer hover:bg-rose-100/70 dark:hover:bg-rose-950/50 transition-colors select-none"
                                    >
                                        <td colSpan={3} className="px-5 py-2.5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-rose-800 dark:text-rose-200">
                                                <ChevronDownIcon
                                                    className={`w-4 h-4 transition-transform duration-150 ${
                                                        collapsedSections.overdue ? '-rotate-90' : ''
                                                    }`}
                                                />
                                                <ExclamationTriangleIcon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                                <span>Atrasados</span>
                                                <span className="font-medium text-rose-600/90 dark:text-rose-300/80 tabular-nums">
                                                    · {buckets.overdue.length}{' '}
                                                    {buckets.overdue.length === 1 ? 'item' : 'itens'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs font-bold text-rose-800 dark:text-rose-200 tabular-nums whitespace-nowrap">
                                            {formatCurrency(buckets.overdueSum)}
                                        </td>
                                        <td colSpan={2} className="px-5 py-2.5 text-right text-[11px] text-rose-600 dark:text-rose-300">
                                            {collapsedSections.overdue ? 'Mostrar' : 'Recolher'}
                                        </td>
                                    </tr>
                                    {!collapsedSections.overdue &&
                                        buckets.overdue.map((tx) => renderTableRow(tx, 'overdue'))}
                                </>
                            )}

                            {/* Seção 2: Em aberto no mês */}
                            {showUpcomingSection && (
                                <>
                                    <tr
                                        onClick={() => toggleSection('open')}
                                        className="bg-amber-50/80 dark:bg-amber-950/25 cursor-pointer hover:bg-amber-100/60 dark:hover:bg-amber-950/40 transition-colors select-none"
                                    >
                                        <td colSpan={3} className="px-5 py-2.5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                                                <ChevronDownIcon
                                                    className={`w-4 h-4 transition-transform duration-150 ${
                                                        collapsedSections.open ? '-rotate-90' : ''
                                                    }`}
                                                />
                                                <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                                <span>Em aberto no mês</span>
                                                <span className="font-medium text-amber-700/90 dark:text-amber-300/80 tabular-nums">
                                                    · {buckets.upcomingOpen.length}{' '}
                                                    {buckets.upcomingOpen.length === 1 ? 'item' : 'itens'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs font-bold text-amber-900 dark:text-amber-200 tabular-nums whitespace-nowrap">
                                            {formatCurrency(buckets.upcomingSum)}
                                        </td>
                                        <td colSpan={2} className="px-5 py-2.5 text-right text-[11px] text-amber-700 dark:text-amber-300">
                                            {collapsedSections.open ? 'Mostrar' : 'Recolher'}
                                        </td>
                                    </tr>
                                    {!collapsedSections.open &&
                                        (buckets.upcomingOpen.length > 0 ? (
                                            buckets.upcomingOpen.map((tx) => renderTableRow(tx, 'open'))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                                                    Nenhuma conta a vencer neste período.
                                                </td>
                                            </tr>
                                        ))}
                                </>
                            )}

                            {/* Seção 3: Já recebidos / Já pagos no mês */}
                            {showPaidSection && (
                                <>
                                    <tr
                                        onClick={() => toggleSection('paid')}
                                        className="bg-emerald-50/80 dark:bg-emerald-950/25 cursor-pointer hover:bg-emerald-100/60 dark:hover:bg-emerald-950/40 transition-colors select-none"
                                    >
                                        <td colSpan={3} className="px-5 py-2.5">
                                            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900 dark:text-emerald-200">
                                                <ChevronDownIcon
                                                    className={`w-4 h-4 transition-transform duration-150 ${
                                                        collapsedSections.paid ? '-rotate-90' : ''
                                                    }`}
                                                />
                                                <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                                <span>{paidSectionTitle}</span>
                                                <span className="font-medium text-emerald-700/90 dark:text-emerald-300/80 tabular-nums">
                                                    · {buckets.paid.length}{' '}
                                                    {buckets.paid.length === 1 ? 'item' : 'itens'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs font-bold text-emerald-900 dark:text-emerald-200 tabular-nums whitespace-nowrap">
                                            {formatCurrency(buckets.paidSum)}
                                        </td>
                                        <td colSpan={2} className="px-5 py-2.5 text-right text-[11px] text-emerald-700 dark:text-emerald-300">
                                            {collapsedSections.paid ? 'Mostrar' : 'Recolher'}
                                        </td>
                                    </tr>
                                    {!collapsedSections.paid &&
                                        (buckets.paid.length > 0 ? (
                                            buckets.paid.map((tx) => renderTableRow(tx, 'paid'))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                                                    Nenhum lançamento liquidado neste período.
                                                </td>
                                            </tr>
                                        ))}
                                </>
                            )}

                            {/* Estado vazio geral */}
                            {!hasAnyVisibleGrouped && (
                                <tr>
                                    <td colSpan={6} className="py-16 text-center">
                                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                            Nenhum lançamento encontrado para este filtro.
                                        </p>
                                        {(searchQuery || statusFilter !== 'all') && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    setStatusFilter('all');
                                                }}
                                                className="mt-3 px-4 py-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors"
                                            >
                                                Limpar filtros
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            ) : (
                /* MODO 2: LADO A LADO (EM ABERTO vs. JÁ RECEBIDOS/PAGOS) */
                <div
                    className={`p-4 sm:p-5 bg-slate-50/50 dark:bg-gray-900/20 grid gap-5 items-start ${
                        showOpenColumnInSplit && showPaidColumnInSplit
                            ? 'grid-cols-1 xl:grid-cols-2'
                            : 'grid-cols-1'
                    }`}
                >
                    {/* Coluna Esquerda: Em Aberto (Atrasados + A Vencer) */}
                    {showOpenColumnInSplit && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2 bg-amber-50/50 dark:bg-amber-950/20">
                                <div className="flex items-center gap-2 min-w-0">
                                    <ClockIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {statusFilter === 'atrasado' ? 'Contas atrasadas' : 'Em aberto'}
                                    </h4>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                                        · {statusFilter === 'atrasado' ? buckets.overdue.length : buckets.openCount}{' '}
                                        {(statusFilter === 'atrasado' ? buckets.overdue.length : buckets.openCount) === 1
                                            ? 'item'
                                            : 'itens'}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-amber-700 dark:text-amber-300 tabular-nums whitespace-nowrap">
                                    {formatCurrency(
                                        statusFilter === 'atrasado' ? buckets.overdueSum : buckets.openSum
                                    )}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-gray-700/80">
                                {buckets.overdue.length > 0 && (
                                    <>
                                        <div className="px-4 py-2 bg-rose-50/80 dark:bg-rose-950/35 flex items-center justify-between text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                                            <span>
                                                Atrasados ({buckets.overdue.length})
                                            </span>
                                            <span className="tabular-nums">{formatCurrency(buckets.overdueSum)}</span>
                                        </div>
                                        {buckets.overdue.map((tx) => renderSplitRow(tx, 'overdue'))}
                                    </>
                                )}

                                {statusFilter !== 'atrasado' && buckets.upcomingOpen.length > 0 && (
                                    <>
                                        {buckets.overdue.length > 0 && (
                                            <div className="px-4 py-2 bg-slate-50 dark:bg-gray-900/40 flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                                <span>A vencer no mês ({buckets.upcomingOpen.length})</span>
                                                <span className="tabular-nums">
                                                    {formatCurrency(buckets.upcomingSum)}
                                                </span>
                                            </div>
                                        )}
                                        {buckets.upcomingOpen.map((tx) => renderSplitRow(tx, 'open'))}
                                    </>
                                )}

                                {(statusFilter === 'atrasado'
                                    ? buckets.overdue.length === 0
                                    : buckets.openCount === 0) && (
                                    <div className="py-14 px-6 text-center">
                                        <CheckCircleIcon className="w-8 h-8 text-emerald-500/70 mx-auto mb-2" />
                                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                            Tudo em dia por aqui
                                        </p>
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                            Nenhuma conta em aberto para o filtro selecionado.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Coluna Direita: Já Recebidos / Já Pagos no Mês */}
                    {showPaidColumnInSplit && (
                        <div className="bg-white dark:bg-gray-800 rounded-xl border border-slate-200 dark:border-gray-700 overflow-hidden">
                            <div className="px-4 py-3.5 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between gap-2 bg-emerald-50/50 dark:bg-emerald-950/20">
                                <div className="flex items-center gap-2 min-w-0">
                                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                    <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                        {paidSectionTitle}
                                    </h4>
                                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                                        · {buckets.paid.length} {buckets.paid.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>
                                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                                    {formatCurrency(buckets.paidSum)}
                                </span>
                            </div>

                            <div className="divide-y divide-slate-100 dark:divide-gray-700/80">
                                {buckets.paid.map((tx) => renderSplitRow(tx, 'paid'))}
                                {buckets.paid.length === 0 && (
                                    <div className="py-14 px-6 text-center">
                                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                            Nenhum lançamento liquidado neste período.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Modal de Confirmação de Liquidação */}
            {confirmingTx && (
                <Modal title="Efetivar operação" onClose={() => setConfirmingTx(null)}>
                    <div className="p-4 text-center space-y-6">
                        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
                            <CheckCircleIcon className="w-8 h-8" />
                        </div>
                        <div className="space-y-1.5">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                Confirmar liquidação?
                            </h3>
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {confirmingTx.description} ·{' '}
                                <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(confirmingTx.amount)}
                                </span>
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                A transação será marcada como {confirmingTx.type === 'receita' ? 'recebida' : 'paga'} e o
                                saldo da conta será atualizado.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmingTx(null)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-slate-700 dark:text-slate-200 rounded-xl font-semibold text-xs transition-colors"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleConfirmEffectivation}
                                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-xs shadow-sm transition-colors"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de Detalhes do Cartão de Crédito */}
            {selectedGroup && (
                <CreditCardDetailModal
                    isOpen={!!selectedGroup}
                    onClose={() => setSelectedGroup(null)}
                    items={selectedGroup}
                    categories={categories}
                    onUpdateStatus={onStatusChange}
                    onDeleteItem={onCancel}
                    onEditItem={onEdit}
                />
            )}
        </div>
    );
};

export default ContasTable;
