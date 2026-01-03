
import React, { useState, useMemo } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory } from '../../types';
import { TrashIcon, EditIcon, FilterIcon, ExclamationTriangleIcon } from '../../assets/icons';

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
    
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => statusFilter === 'all' || t.status === statusFilter);
    }, [transactions, statusFilter]);
    
    const getCategoryName = (categoryId: string) => {
        return categories.find(c => c.id === categoryId)?.name || 'N/A';
    };

    // Função para calcular o status do prazo e metadados visuais
    const getDateStatusInfo = (dueDate: string, status: FinancialTransactionStatus) => {
        if (status === 'pago') return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [y, m, d] = dueDate.split('-').map(Number);
        const due = new Date(y, m - 1, d); // Cria data local
        
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return {
                type: 'overdue',
                label: `Vencido há ${Math.abs(diffDays)} dia(s)`,
                rowClass: 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500 hover:bg-red-100 dark:hover:bg-red-900/20',
                badgeClass: 'text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300'
            };
        } else if (diffDays === 0) {
            return {
                type: 'urgent',
                label: 'Vence hoje',
                rowClass: 'bg-orange-50 dark:bg-orange-900/10 border-l-4 border-l-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/20',
                badgeClass: 'text-orange-700 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-300'
            };
        } else if (diffDays <= 3) {
            return {
                type: 'warning',
                label: `Vence em ${diffDays} dia(s)`,
                rowClass: 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/20',
                badgeClass: 'text-yellow-700 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-300'
            };
        }

        // Padrão
        return {
            type: 'normal',
            label: null,
            rowClass: 'bg-white dark:bg-gray-800 border-l-4 border-l-transparent border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50',
            badgeClass: ''
        };
    };

    // Estatísticas para o banner de alerta
    const alertStats = useMemo(() => {
        let overdue = 0;
        let upcoming = 0;

        filteredTransactions.forEach(tx => {
            const info = getDateStatusInfo(tx.dueDate, tx.status);
            if (info?.type === 'overdue') overdue++;
            if (info?.type === 'urgent' || info?.type === 'warning') upcoming++;
        });

        return { overdue, upcoming };
    }, [filteredTransactions]);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden flex flex-col">
            {/* Banner de Alerta */}
            {(alertStats.overdue > 0 || alertStats.upcoming > 0) && (
                <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800 p-4 flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div>
                        <h4 className="text-sm font-semibold text-orange-900 dark:text-orange-200">Atenção Necessária</h4>
                        <ul className="text-xs text-orange-800 dark:text-orange-300 mt-1 list-disc list-inside">
                            {alertStats.overdue > 0 && <li>Você tem <strong>{alertStats.overdue}</strong> transação(ões) vencida(s).</li>}
                            {alertStats.upcoming > 0 && <li>Você tem <strong>{alertStats.upcoming}</strong> transação(ões) vencendo em breve.</li>}
                        </ul>
                    </div>
                </div>
            )}

            <div className="p-6 flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h3>
                <div className="flex items-center gap-2">
                    <FilterIcon className="text-gray-500 dark:text-gray-400" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as any)}
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2"
                    >
                        <option value="all">Todos os Status</option>
                        <option value="pendente">Pendente</option>
                        <option value="pago">Pago</option>
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-700 dark:text-gray-400 uppercase tracking-wider">
                        <tr>
                            <th scope="col" className="px-6 py-3">Descrição</th>
                            <th scope="col" className="px-6 py-3">Categoria</th>
                            <th scope="col" className="px-6 py-3">Vencimento</th>
                            <th scope="col" className="px-6 py-3">Valor</th>
                            <th scope="col" className="px-6 py-3">Status</th>
                            <th scope="col" className="px-6 py-3 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.map((tx) => {
                            const dateStatus = getDateStatusInfo(tx.dueDate, tx.status);
                            const rowClass = dateStatus?.rowClass || 'bg-white dark:bg-gray-800 border-l-4 border-l-transparent border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50';
                            
                            return (
                                <tr key={tx.id} className={`border-b transition-colors ${rowClass}`}>
                                    <td className="py-4 px-6 font-medium text-gray-900 dark:text-white">
                                        {tx.description}
                                        {dateStatus?.type === 'overdue' && (
                                            <span className="ml-2 inline-flex items-center text-red-600 dark:text-red-400" title="Vencido">
                                                <ExclamationTriangleIcon className="w-4 h-4" />
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-4 px-6 text-gray-500 dark:text-gray-400">{getCategoryName(tx.categoryId)}</td>
                                    <td className="py-4 px-6">
                                        <div className="flex flex-col items-start">
                                            <span className={`text-base ${(dateStatus && dateStatus.type !== 'normal') ? 'font-bold' : 'text-gray-500 dark:text-gray-400'}`}>
                                                {formatDate(tx.dueDate)}
                                            </span>
                                            {dateStatus && dateStatus.label && (
                                                <span className={`text-xs px-2 py-0.5 rounded-full mt-1 font-medium ${dateStatus.badgeClass}`}>
                                                    {dateStatus.label}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className={`py-4 px-6 font-semibold ${tx.type === 'receita' ? 'text-green-500' : 'text-red-500'}`}>{formatCurrency(tx.amount)}</td>
                                    <td className="py-4 px-6">
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                                            tx.status === 'pago' 
                                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' 
                                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300'
                                        }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="py-4 px-6 text-center space-x-2">
                                        {tx.status === 'pendente' && (
                                            <button onClick={() => onStatusChange(tx.id, 'pago')} className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 font-semibold text-xs uppercase tracking-wide">
                                                {tx.type === 'receita' ? 'Receber' : 'Pagar'}
                                            </button>
                                        )}
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onEdit(tx); }} 
                                            className="p-2 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400" 
                                            title="Editar"
                                        >
                                            <EditIcon />
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); onDelete(tx.id); }} 
                                            className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400" 
                                            title="Excluir"
                                        >
                                            <TrashIcon />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
                 {filteredTransactions.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">Nenhuma transação encontrada.</p>
                 )}
            </div>
        </div>
    );
};

export default ContasTable;
