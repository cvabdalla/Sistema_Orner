import React, { useState, useMemo, useEffect } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory, CreditCard } from '../../types';
import { TrashIcon, EditIcon, FilterIcon, CreditCardIcon, EyeIcon, CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, DollarIcon } from '../../assets/icons';
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
    
    // Estado para o modal de confirmação de efetivação
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
                const cardMatch = t.description.match(/\[(.*?)\]/);
                const cardName = cardMatch ? cardMatch[1] : 'Cartão';
                const card = cards.find(c => c.name === cardName);
                const closingDay = card ? card.closingDay : '0';
                
                const groupKey = `CC_GROUPED_${t.dueDate}_${closingDay}`;
                
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
                originalItems: group
            };
        });

        return [...normalTransactions, ...groupedCC].sort((a, b) => {
            // Prioridade de Status: Pendente primeiro (Peso 0) vs Outros (Peso 1)
            const priorityA = String(a.status).toLowerCase() === 'pendente' ? 0 : 1;
            const priorityB = String(b.status).toLowerCase() === 'pendente' ? 0 : 1;

            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // Desempate por data
            if (String(a.status).toLowerCase() === 'pendente') {
                return String(a.dueDate).localeCompare(String(b.dueDate));
            } else {
                const dateA = a.paymentDate || a.dueDate;
                const dateB = b.paymentDate || b.dueDate;
                return String(dateB).localeCompare(String(dateA)); // Recentes primeiro no histórico
            }
        });
    }, [transactions, statusFilter, cards]);

    // Cálculo do total dinâmico com base no que está visível
    const totalExibido = useMemo(() => {
        return processedTransactions.reduce((acc, curr) => acc + curr.amount, 0);
    }, [processedTransactions]);
    
    const getCategoryName = (categoryId: string) => {
        if (categoryId === 'cc-group') return 'Fatura consolidada';
        return categories.find(c => c.id === categoryId)?.name || 'N/A';
    };

    const handleConfirmEffectivation = () => {
        if (!confirmingTx) return;

        if (confirmingTx.isGroup) {
            const newStatus = 'pago'; 
            confirmingTx.originalItems.forEach((item: FinancialTransaction) => onStatusChange(item.id, newStatus));
        } else {
            onStatusChange(confirmingTx.id, 'pago');
        }
        setConfirmingTx(null);
    };

    const handleCancelGroup = (group: any) => {
        if (confirm(`Deseja realmente cancelar todos os ${group.originalItems.length} lançamentos deste grupo?`)) {
            group.originalItems.forEach((item: FinancialTransaction) => onCancel(item.id));
        }
    };

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-50 dark:border-gray-700">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                    {/* Badge de Total */}
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
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-[11px] font-bold rounded-lg block p-2"
                    >
                        <option value="all">Todos os status</option>
                        <option value="pendente">Pendentes</option>
                        <option value="pago">Liquidados</option>
                        <option value="cancelado">Cancelados</option>
                    </select>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] text-gray-500 tracking-widest font-black">
                        <tr>
                            <th className="px-6 py-3">Descrição</th>
                            <th className="px-6 py-3">Categoria</th>
                            <th className="px-6 py-4">Vencimento</th>
                            <th className="px-6 py-3 text-right">Valor</th>
                            <th className="px-6 py-3 text-center">Status</th>
                            <th className="px-6 py-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {processedTransactions.map((tx) => {
                            const isPaid = tx.status === 'pago';
                            const isCancelled = tx.status === 'cancelado';
                            const statusLabel = isCancelled ? 'Cancelado' : isPaid ? (tx.type === 'receita' ? 'Recebido' : 'Pago') : 'Pendente';
                            const actionLabel = tx.type === 'receita' ? 'Receber' : 'Pagar';

                            return (
                                <tr 
                                    key={tx.id} 
                                    className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-indigo-900/10 transition-colors ${
                                        isPaid ? 'bg-green-50/30 dark:bg-green-900/5' : 
                                        isCancelled ? 'bg-red-50/20 opacity-70 grayscale-[0.5]' : ''
                                    }`}
                                >
                                    <td className={`py-4 px-6 font-bold ${isPaid || isCancelled ? 'text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                                        <div className="flex items-center gap-2">
                                            {tx.isGrouped ? <CreditCardIcon className="w-4 h-4 text-indigo-500" /> : null}
                                            <span className={isCancelled ? 'line-through decoration-red-400' : ''}>
                                                {tx.displayDescription}
                                            </span>
                                            {tx.isGrouped && (
                                                <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded font-black">
                                                    {tx.originalItems.length} itens
                                                </span>
                                            )}
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
                                    <td className="py-4 px-6 text-gray-500 dark:text-gray-400 text-xs font-medium">{getCategoryName(tx.categoryId)}</td>
                                    <td className={`py-4 px-6 font-bold ${isPaid || isCancelled ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>{formatDate(tx.dueDate)}</td>
                                    <td className={`py-4 px-6 font-black text-right ${isPaid || isCancelled ? 'text-gray-400' : tx.type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(tx.amount)}</td>
                                    <td className="py-4 px-6 text-center">
                                        <span className={`px-2.5 py-1 text-[10px] font-black rounded-full ${isCancelled ? 'bg-red-100 text-red-700' : isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {statusLabel}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-center">
                                        <div className="flex justify-center gap-1">
                                            {isCancelled ? (
                                                <span className="text-[10px] font-bold text-gray-400 italic">Sem ações</span>
                                            ) : tx.isGrouped ? (
                                                <>
                                                    <button onClick={() => setSelectedGroup(tx.originalItems)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Ver detalhes">
                                                        <EyeIcon className="w-5 h-5" />
                                                    </button>
                                                    {!isPaid && (
                                                        <button onClick={() => setConfirmingTx({id: tx.id, type: tx.type, isGroup: true, originalItems: tx.originalItems})} className="text-[10px] font-black text-green-600 hover:underline px-2">
                                                            Pagar fatura
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleCancelGroup(tx)} className="p-2 text-gray-400 hover:text-red-600" title="Cancelar grupo"><XCircleIcon className="w-5 h-5" /></button>
                                                </>
                                            ) : (
                                                <>
                                                    {tx.status === 'pendente' && (
                                                        <button onClick={() => setConfirmingTx({id: tx.id, type: tx.type, isGroup: false})} className="text-green-600 font-bold text-[10px] hover:underline px-2">{actionLabel}</button>
                                                    )}
                                                    <button onClick={() => onEdit(tx)} className="p-2 text-gray-400 hover:text-indigo-600" title="Editar"><EditIcon className="w-5 h-5" /></button>
                                                    <button onClick={() => onCancel(tx.id)} className="p-2 text-gray-400 hover:text-red-600" title="Cancelar"><XCircleIcon className="w-5 h-5" /></button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {processedTransactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-gray-400 italic font-bold text-sm">
                                    Nenhum registro encontrado para este filtro.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {confirmingTx && (
                <Modal title="Confirmar operação" onClose={() => setConfirmingTx(null)}>
                    <div className="p-4 text-center space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600">
                            <CheckCircleIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deseja efetivar a operação?</h3>
                        <div className="flex gap-4">
                            <button 
                                onClick={() => setConfirmingTx(null)} 
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm"
                            >
                                Não
                            </button>
                            <button 
                                onClick={handleConfirmEffectivation} 
                                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20"
                            >
                                Sim
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