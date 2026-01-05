
import React, { useState, useMemo } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory } from '../../types';
import { TrashIcon, EditIcon, FilterIcon, ExclamationTriangleIcon, EyeIcon, CreditCardIcon } from '../../assets/icons';
import Modal from '../Modal';

interface ContasTableProps {
    title: string;
    transactions: FinancialTransaction[];
    categories: FinancialCategory[];
    onEdit: (transaction: FinancialTransaction) => void;
    onDelete: (id: string) => void;
    onStatusChange: (id: string, status: FinancialTransactionStatus) => void;
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const ContasTable: React.FC<ContasTableProps> = ({ title, transactions, categories, onEdit, onDelete, onStatusChange }) => {
    const [statusFilter, setStatusFilter] = useState<FinancialTransactionStatus | 'all'>('all');
    const [viewingGroupInfo, setViewingGroupInfo] = useState<{ dueDate: string, status: FinancialTransactionStatus } | null>(null);
    const [batchDetailModalOpen, setBatchDetailModalOpen] = useState(false);
    
    const getCategoryName = (categoryId: string) => {
        return categories.find(c => c.id === categoryId)?.name || 'Geral';
    };

    const processedTransactions = useMemo(() => {
        const result: (FinancialTransaction & { isGroupSummary?: boolean, itemCount?: number, cardCount?: number })[] = [];
        const dateGroups = new Map<string, FinancialTransaction[]>();

        const initialFiltered = transactions.filter(t => statusFilter === 'all' || t.status === statusFilter);

        initialFiltered.forEach(t => {
            const isCard = t.description.includes('[Cartão:');
            if (isCard) {
                // BUG FIX: O agrupamento deve considerar a data E o status
                const key = `${t.dueDate}_${t.status}`;
                if (!dateGroups.has(key)) dateGroups.set(key, []);
                dateGroups.get(key)!.push(t);
            } else {
                result.push(t);
            }
        });

        dateGroups.forEach((items, key) => {
            const [dueDate, status] = key.split('_');
            const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
            const cardNames = new Set();
            items.forEach(item => {
                const match = item.description.match(/\[Cartão:\s*(.*?)\]/);
                if (match) cardNames.add(match[1]);
            });

            result.push({
                ...items[0], 
                id: `due_group_${key}`, 
                description: `Cartão de crédito`,
                amount: totalAmount,
                isGroupSummary: true,
                itemCount: items.length,
                cardCount: cardNames.size,
                dueDate: dueDate,
                status: status as FinancialTransactionStatus
            });
        });

        return result.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [transactions, statusFilter]);

    const getDateStatusInfo = (dueDate: string, status: FinancialTransactionStatus) => {
        if (status === 'pago') return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [y, m, d] = dueDate.split('-').map(Number);
        const due = new Date(y, m - 1, d);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                type: 'overdue', label: `Vencido há ${Math.abs(diffDays)} dia(s)`,
                rowClass: 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500',
                badgeClass: 'text-red-700 bg-red-100 dark:bg-red-900/30'
            };
        } else if (diffDays === 0) {
            return {
                type: 'urgent', label: 'Vence hoje',
                rowClass: 'bg-orange-50 dark:bg-orange-900/10 border-l-4 border-l-orange-500',
                badgeClass: 'text-orange-700 bg-orange-100 dark:bg-orange-900/30'
            };
        } else if (diffDays <= 3) {
            return {
                type: 'warning', label: `Vence em ${diffDays} dia(s)`,
                rowClass: 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-400',
                badgeClass: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30'
            };
        }
        return {
            type: 'normal', label: null,
            rowClass: 'bg-white dark:bg-gray-800 border-l-4 border-l-transparent border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50',
            badgeClass: ''
        };
    };

    const groupTransactionsByCard = useMemo((): Record<string, FinancialTransaction[]> => {
        if (!viewingGroupInfo) return {};
        // BUG FIX: Filtrar também pelo status para não mostrar itens pagos em faturas pendentes
        const items = transactions.filter(t => 
            t.description.includes('[Cartão:') && 
            t.dueDate === viewingGroupInfo.dueDate &&
            t.status === viewingGroupInfo.status
        );
        const grouped: Record<string, FinancialTransaction[]> = {};
        
        items.forEach(it => {
            const match = it.description.match(/\[Cartão:\s*(.*?)\]/);
            const cardName = match ? match[1] : 'Cartão Indefinido';
            if (!grouped[cardName]) grouped[cardName] = [];
            grouped[cardName].push(it);
        });
        return grouped;
    }, [viewingGroupInfo, transactions]);

    const handleOpenDetails = (dueDate: string, status: FinancialTransactionStatus) => {
        setViewingGroupInfo({ dueDate, status });
        setBatchDetailModalOpen(true);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col border border-gray-100 dark:border-gray-700">
            <div className="p-6 flex justify-between items-center border-b dark:border-gray-700">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">{title}</h3>
                <div className="flex items-center gap-2">
                    <FilterIcon className="text-gray-400 w-4 h-4" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-gray-50 dark:bg-gray-700 border-none text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg p-2"
                    >
                        <option value="all">Todos os status</option>
                        <option value="pendente">Pendentes</option>
                        <option value="pago">Pagos</option>
                    </select>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-bold text-gray-400 border-b">
                        <tr>
                            <th className="px-6 py-4">Descrição do lançamento</th>
                            <th className="px-6 py-4">Categoria</th>
                            <th className="px-6 py-4 text-center">Vencimento</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {processedTransactions.map((tx) => {
                            const dateStatus = getDateStatusInfo(tx.dueDate, tx.status);
                            const rowClass = tx.isGroupSummary 
                                ? 'bg-indigo-50/30 dark:bg-indigo-900/10 border-l-4 border-l-indigo-600 hover:bg-indigo-100/50 cursor-pointer' 
                                : dateStatus?.rowClass || 'bg-white dark:bg-gray-800 border-l-4 border-l-transparent';
                            
                            return (
                                <tr 
                                    key={tx.id} 
                                    className={`${rowClass} transition-colors group`}
                                    onClick={() => tx.isGroupSummary && handleOpenDetails(tx.dueDate, tx.status)}
                                >
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-3">
                                            {tx.isGroupSummary ? (
                                                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                                                    <CreditCardIcon className="w-4 h-4" />
                                                </div>
                                            ) : (
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                            )}
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-sm ${tx.isGroupSummary ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-800 dark:text-white'}`}>
                                                    {tx.description}
                                                </span>
                                                {tx.isGroupSummary && (
                                                    <span className="text-[10px] font-bold text-gray-400 tracking-tight">
                                                        Consolidado: {tx.itemCount} itens de {tx.cardCount} cartão(ões)
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-6 text-xs text-gray-500 font-bold">
                                        {tx.isGroupSummary ? 'Cartão de crédito' : getCategoryName(tx.categoryId)}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className="font-bold text-gray-700 dark:text-gray-300 text-xs">{formatDate(tx.dueDate)}</span>
                                        {dateStatus?.label && (
                                            <div className={`text-[9px] font-black px-1.5 py-0.5 rounded mt-1 mx-auto w-fit ${dateStatus.badgeClass}`}>
                                                {dateStatus.label}
                                            </div>
                                        )}
                                    </td>
                                    <td className={`py-4 px-6 font-bold text-right text-sm ${tx.isGroupSummary ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                                        {formatCurrency(tx.amount)}
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${tx.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {tx.status === 'pago' ? 'Pago' : 'Pendente'}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex justify-center gap-2">
                                            {tx.status === 'pendente' && (
                                                <button 
                                                    onClick={() => onStatusChange(tx.id, 'pago')} 
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-all ${
                                                        tx.isGroupSummary ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-green-600 text-white hover:bg-green-700'
                                                    }`}
                                                >
                                                    {tx.isGroupSummary ? 'Quitar fatura' : 'Pagar'}
                                                </button>
                                            )}
                                            {tx.isGroupSummary ? (
                                                <button onClick={() => handleOpenDetails(tx.dueDate, tx.status)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="Ver detalhado">
                                                    <EyeIcon className="w-4 h-4"/>
                                                </button>
                                            ) : (
                                                <button onClick={() => onEdit(tx)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg"><EditIcon className="w-4 h-4"/></button>
                                            )}
                                            <button onClick={() => onDelete(tx.id)} className="p-1.5 text-gray-300 hover:text-red-600 rounded-lg"><TrashIcon className="w-4 h-4"/></button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {batchDetailModalOpen && viewingGroupInfo && (
                <Modal title="Detalhamento das faturas" onClose={() => setBatchDetailModalOpen(false)} maxWidth="max-w-3xl">
                    <div className="space-y-6">
                        <div className={`p-5 rounded-2xl border flex justify-between items-center ${viewingGroupInfo.status === 'pago' ? 'bg-green-50 border-green-100 dark:bg-green-900/20' : 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100'}`}>
                            <div>
                                <h4 className={`text-[10px] font-bold tracking-tight mb-1 ${viewingGroupInfo.status === 'pago' ? 'text-green-500' : 'text-indigo-500'}`}>
                                    Total {viewingGroupInfo.status === 'pago' ? 'pago' : 'vencimento'} em {formatDate(viewingGroupInfo.dueDate)}
                                </h4>
                                <p className={`text-3xl font-black ${viewingGroupInfo.status === 'pago' ? 'text-green-700 dark:text-green-300' : 'text-indigo-700 dark:text-indigo-300'}`}>
                                    {formatCurrency((Object.values(groupTransactionsByCard).flat() as FinancialTransaction[]).reduce((acc, curr) => acc + curr.amount, 0))}
                                </p>
                            </div>
                            <CreditCardIcon className={`w-10 h-10 ${viewingGroupInfo.status === 'pago' ? 'text-green-200' : 'text-indigo-200'}`} />
                        </div>

                        <div className="space-y-4">
                            {Object.entries(groupTransactionsByCard).map(([cardName, items]) => {
                                const typedItems = items as FinancialTransaction[];
                                return (
                                    <div key={cardName} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                        <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-2 border-b flex justify-between items-center">
                                            <h5 className="text-xs font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${viewingGroupInfo.status === 'pago' ? 'bg-green-500' : 'bg-indigo-500'}`} /> {cardName}
                                            </h5>
                                            <span className={`text-[10px] font-bold ${viewingGroupInfo.status === 'pago' ? 'text-green-600' : 'text-indigo-600'}`}>
                                                Subtotal: {formatCurrency(typedItems.reduce((a, b) => a + b.amount, 0))}
                                            </span>
                                        </div>
                                        <table className="min-w-full text-left text-xs">
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                {typedItems.map(it => (
                                                    <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                        <td className="px-4 py-2.5 text-gray-400 font-medium">{it.launchDate ? formatDate(it.launchDate) : '---'}</td>
                                                        <td className="px-4 py-2.5 font-bold text-gray-700 dark:text-gray-200">{it.description.replace(/\[Cartão:.*?\]\s*/, '')}</td>
                                                        <td className={`px-4 py-2.5 text-right font-bold ${viewingGroupInfo.status === 'pago' ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                                            {formatCurrency(it.amount)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className="flex justify-end gap-3 pt-2">
                            <button onClick={() => setBatchDetailModalOpen(false)} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-lg font-bold text-xs">Fechar</button>
                            {viewingGroupInfo.status === 'pendente' && (
                                <button 
                                    onClick={() => { onStatusChange(`due_group_${viewingGroupInfo.dueDate}_pendente`, 'pago'); setBatchDetailModalOpen(false); }} 
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all"
                                >
                                    Quitar todas agora
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ContasTable;
