
import React, { useState, useMemo, useEffect } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory, CreditCard } from '../../types';
import { TrashIcon, EditIcon, FilterIcon, CreditCardIcon, EyeIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, DollarIcon, SparklesIcon } from '../../assets/icons';
import { dataService } from '../../services/dataService';
import CreditCardDetailModal from './CreditCardDetailModal';
import Modal from '../Modal';

interface ContasTableProps {
    title: string;
    transactions: FinancialTransaction[];
    categories: FinancialCategory[];
    onEdit: (transaction: FinancialTransaction) => void;
    onCancel: (id: string) => void;
    onStatusChange: (id: string, status: FinancialTransactionStatus) => void;
}

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

const ContasTable: React.FC<ContasTableProps> = ({ title, transactions, categories, onEdit, onCancel, onStatusChange }) => {
    const [statusFilter, setStatusFilter] = useState<FinancialTransactionStatus | 'all'>('all');
    const [selectedGroup, setSelectedGroup] = useState<FinancialTransaction[] | null>(null);
    const [cards, setCards] = useState<CreditCard[]>([]);
    
    const [confirmingTx, setConfirmingTx] = useState<{id: string, type: 'receita' | 'despesa', isGroup: boolean, originalItems?: any} | null>(null);

    useEffect(() => {
        dataService.getAll<CreditCard>('credit_cards').then(setCards);
    }, []);
    
    const processedTransactions = useMemo(() => {
        const filtered = transactions.filter(t => statusFilter === 'all' || t.status === statusFilter);
        const ccGroups: Record<string, { items: FinancialTransaction[], dueDate: string }> = {};
        const normalTransactions: any[] = [];

        filtered.forEach(t => {
            if (t.id.startsWith('cc-') && t.type === 'despesa' && t.status !== 'cancelado') {
                const groupKey = `CC_GROUPED_${t.dueDate}`;
                if (!ccGroups[groupKey]) {
                    ccGroups[groupKey] = { items: [], dueDate: t.dueDate };
                }
                ccGroups[groupKey].items.push(t);
            } else {
                normalTransactions.push({ ...t, displayDescription: t.description });
            }
        });

        const groupedCC: any[] = Object.entries(ccGroups).map(([key, groupData]) => {
            const group = groupData.items;
            const totalAmount = group.reduce((sum, item) => sum + item.amount, 0);
            const allPaid = group.every(item => item.status === 'pago');
            const anyInvoiceSent = group.some(item => item.invoiceSent);
            
            return {
                id: `grouped-${key}`,
                description: `Cartão de Crédito`,
                displayDescription: `Cartão de Crédito`,
                amount: totalAmount,
                dueDate: groupData.dueDate,
                status: allPaid ? 'pago' : 'pendente',
                categoryId: 'cc-group',
                type: 'despesa',
                isGrouped: true,
                invoiceSent: anyInvoiceSent,
                originalItems: group
            };
        });

        return [...normalTransactions, ...groupedCC].sort((a, b) => {
            const priorityA = String(a.status).toLowerCase() === 'pendente' ? 0 : 1;
            const priorityB = String(b.status).toLowerCase() === 'pendente' ? 0 : 1;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            if (String(a.status).toLowerCase() === 'pendente') {
                return String(a.dueDate).localeCompare(String(b.dueDate));
            } else {
                const dateA = a.paymentDate || a.dueDate;
                const dateB = b.paymentDate || b.dueDate;
                return String(dateB).localeCompare(String(dateA));
            }
        });
    }, [transactions, statusFilter, cards]);

    const totalExibido = useMemo(() => {
        return processedTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    }, [processedTransactions]);
    
    const getCategoryName = (categoryId: string) => {
        if (categoryId === 'cc-group') return 'Fatura consolidada';
        const cat = categories.find(c => c.id === categoryId);
        return cat?.name || 'N/A';
    };

    const isTechnicalCategory = (categoryId: string) => {
        const catName = categories.find(c => c.id === categoryId)?.name?.toLowerCase() || '';
        return catName.includes('lavagem') || catName.includes('instalação') || catName.includes('instalacao');
    };

    const handleConfirmEffectivation = () => {
        if (!confirmingTx) return;
        if (confirmingTx.isGroup) {
            confirmingTx.originalItems.forEach((item: FinancialTransaction) => onStatusChange(item.id, 'pago'));
        } else {
            onStatusChange(confirmingTx.id, 'pago');
        }
        setConfirmingTx(null);
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-50 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                        <DollarIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <div className="flex flex-col">
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-0.5">Total exibido</span>
                            <span className="text-sm font-black text-indigo-700 dark:text-indigo-300 leading-none">
                                {formatCurrency(totalExibido)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <FilterIcon className="text-gray-500 dark:text-gray-400 w-4 h-4" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-[11px] font-bold rounded-lg block p-2 outline-none"
                    >
                        <option value="all">Todos os status</option>
                        <option value="pendente">Pendentes</option>
                        <option value="pago">Liquidados</option>
                        <option value="cancelado">Cancelados</option>
                    </select>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] text-gray-500 font-black uppercase tracking-tight">
                        <tr>
                            <th className="px-6 py-4">Descrição</th>
                            <th className="px-6 py-4">Categoria</th>
                            <th className="px-6 py-4 text-center">Vencimento</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {processedTransactions.map((tx) => {
                            const isPaid = tx.status === 'pago';
                            const isCancelled = tx.status === 'cancelado';
                            const isPending = !isPaid && !isCancelled;
                            const isApprovedForPayment = tx.invoiceSent && isPending;
                            const isTech = isTechnicalCategory(tx.categoryId);
                            
                            // Determinação do rótulo de status
                            let statusLabel = 'Pendente';
                            if (isCancelled) statusLabel = 'Cancelado';
                            else if (isPaid) statusLabel = tx.type === 'receita' ? 'Recebido' : 'Pago';
                            else if (isApprovedForPayment) statusLabel = 'Liberado p/ Pagar';

                            const actionLabel = tx.type === 'receita' ? 'Receber' : 'Pagar';

                            // Estilização dinâmica da linha
                            const rowStateClass = isApprovedForPayment 
                                ? 'bg-emerald-50/40 dark:bg-emerald-900/10 border-l-4 border-l-emerald-500' 
                                : isPaid 
                                    ? 'bg-gray-50/50 dark:bg-gray-900/10 opacity-70 border-l-4 border-l-transparent' 
                                    : isCancelled 
                                        ? 'bg-red-50/20 opacity-50 border-l-4 border-l-transparent' 
                                        : `bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-indigo-900/10 border-l-4 ${isPending ? (tx.type === 'receita' ? 'border-l-green-500' : 'border-l-red-500') : 'border-l-transparent'}`;

                            return (
                                <tr key={tx.id} className={`transition-all duration-200 ${rowStateClass}`}>
                                    <td className="py-4 px-6">
                                        <div className="flex items-center gap-2">
                                            {isApprovedForPayment && (
                                                <div className="relative flex h-3 w-3 mr-1" title="Pagamento autorizado via faturamento técnico">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
                                                </div>
                                            )}

                                            {tx.isGrouped ? <CreditCardIcon className="w-4 h-4 text-indigo-500" /> : null}
                                            
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-[13px] font-bold ${isCancelled ? 'line-through text-gray-400' : 'text-gray-900 dark:text-white'} ${isApprovedForPayment ? 'text-emerald-800 dark:text-emerald-400' : ''}`}>
                                                        {tx.displayDescription}
                                                    </span>
                                                    {isTech && isApprovedForPayment && (
                                                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded text-[8px] font-black border border-cyan-200 dark:border-cyan-800 uppercase tracking-tighter">
                                                            <SparklesIcon className="w-2.5 h-2.5" /> Técnico OK
                                                        </span>
                                                    )}
                                                </div>
                                                {tx.isGrouped && (
                                                    <span className="text-[9px] text-indigo-500 font-black mt-0.5">
                                                        Fatura consolidada: {tx.originalItems.length} itens
                                                    </span>
                                                )}
                                            </div>
                                            
                                            {isCancelled && tx.cancelReason && (
                                                <div className="group relative ml-2">
                                                    <ExclamationTriangleIcon className="w-4 h-4 text-red-500 cursor-help" />
                                                    <div className="absolute left-0 top-6 hidden group-hover:block z-50 w-64 p-3 bg-red-600 text-white text-[10px] font-bold rounded-lg shadow-xl animate-fade-in">
                                                        Motivo: {tx.cancelReason}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>

                                    <td className="py-4 px-6 text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {getCategoryName(tx.categoryId)}
                                    </td>

                                    <td className={`py-4 px-6 font-bold text-center ${isPaid || isCancelled ? 'text-gray-400' : 'text-gray-700 dark:text-gray-200'}`}>
                                        {formatDate(tx.dueDate)}
                                    </td>

                                    <td className={`py-4 px-6 font-black text-right ${isPaid || isCancelled ? 'text-gray-400' : tx.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(tx.amount)}
                                    </td>

                                    <td className="py-4 px-6 text-center">
                                        <span className={`px-3 py-1 text-[9px] font-black rounded-full shadow-sm tracking-tight border transition-all ${
                                            isCancelled ? 'bg-red-50 text-red-600 border-red-100' : 
                                            isPaid ? 'bg-green-50 text-green-700 border-green-100' : 
                                            isApprovedForPayment ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/30' : 
                                            'bg-yellow-50 text-yellow-700 border-yellow-100'
                                        }`}>
                                            {statusLabel}
                                        </span>
                                    </td>

                                    <td className="py-4 px-6 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            {isCancelled ? (
                                                <span className="text-[10px] font-bold text-gray-400 italic">---</span>
                                            ) : tx.isGrouped ? (
                                                <>
                                                    <button onClick={() => setSelectedGroup(tx.originalItems)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Ver detalhes">
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    {!isPaid && (
                                                        <button onClick={() => setConfirmingTx({id: tx.id, type: tx.type, isGroup: true, originalItems: tx.originalItems})} className={`text-[9px] font-black px-3 py-1.5 rounded-lg shadow-sm transition-all ${isApprovedForPayment ? 'bg-emerald-700 text-white hover:bg-emerald-800' : 'bg-green-600 text-white hover:bg-green-700'}`}>
                                                            Pagar fatura
                                                        </button>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    {tx.status === 'pendente' && (
                                                        <button 
                                                            onClick={() => setConfirmingTx({id: tx.id, type: tx.type, isGroup: false})} 
                                                            className={`font-black text-[10px] px-3 py-1.5 rounded-lg border-2 transition-all mr-1 ${
                                                                isApprovedForPayment 
                                                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-md' 
                                                                : 'bg-white text-green-600 border-green-100 hover:bg-green-50'
                                                            }`}
                                                        >
                                                            {actionLabel}
                                                        </button>
                                                    )}
                                                    <button 
                                                        onClick={() => onEdit(tx)} 
                                                        className="p-2 text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all" 
                                                        title="Editar lançamento"
                                                    >
                                                        <EditIcon className="w-5 h-5" />
                                                    </button>
                                                    <button 
                                                        onClick={() => onCancel(tx.id)} 
                                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all" 
                                                        title="Cancelar/Excluir"
                                                    >
                                                        <XCircleIcon className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {processedTransactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-20 text-center text-gray-400 italic font-bold text-sm">
                                    Nenhum registro encontrado para este filtro.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {confirmingTx && (
                <Modal title="Efetivar Operação" onClose={() => setConfirmingTx(null)}>
                    <div className="p-4 text-center space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600 shadow-inner">
                            <CheckCircleIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-gray-900 dark:text-white tracking-tight">Confirmar liquidação?</h3>
                            <p className="text-xs text-gray-500 font-medium">A transação será marcada como PAGA e o saldo da conta será atualizado.</p>
                        </div>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setConfirmingTx(null)} 
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest"
                            >
                                Voltar
                            </button>
                            <button 
                                onClick={handleConfirmEffectivation} 
                                className="flex-1 py-3 bg-green-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-green-600/20 active:scale-95 transition-all"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

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
