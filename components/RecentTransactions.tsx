
import React, { useMemo, useEffect, useState } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory } from '../types';
import { ExclamationTriangleIcon } from '../assets/icons';
import { dataService } from '../services/dataService';

interface RecentTransactionsProps {
    transactions: FinancialTransaction[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const TransactionRow: React.FC<{ transaction: FinancialTransaction, categoryName: string }> = ({ transaction, categoryName }) => {
  const { description, amount, status, dueDate, type } = transaction;
  
  const getDateStatusInfo = (dueDate: string, status: FinancialTransactionStatus) => {
        if (status === 'pago') return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [y, m, d] = dueDate.split('-').map(Number);
        const due = new Date(y, m - 1, d);
        const diffTime = due.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
            return { type: 'overdue', label: `Vencido (${Math.abs(diffDays)}d)`, rowClass: 'bg-red-50 dark:bg-red-900/10 border-l-4 border-l-red-500', textClass: 'text-red-600 dark:text-red-400' };
        } else if (diffDays === 0) {
            return { type: 'urgent', label: 'Vence hoje', rowClass: 'bg-orange-50 dark:bg-orange-900/10 border-l-4 border-l-orange-500', textClass: 'text-orange-600 dark:text-orange-400' };
        } else if (diffDays <= 3) {
            return { type: 'warning', label: `Vence em ${diffDays}d`, rowClass: 'bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-400', textClass: 'text-yellow-600 dark:text-yellow-400' };
        }
        return { type: 'normal', label: null, rowClass: 'border-l-4 border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50', textClass: 'text-gray-500 dark:text-gray-400' };
  };

  const dateStatus = getDateStatusInfo(dueDate, status);
  const rowClasses = dateStatus?.rowClass || 'border-l-4 border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50';
  
  const formatDate = (dateString: string) => {
      if (!dateString) return '-';
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}`;
  }

  return (
    <tr className={`border-b border-gray-200 dark:border-gray-700 transition-colors ${rowClasses}`}>
      <td className="py-3 px-4">
        <div className="flex items-center">
            {dateStatus?.type === 'overdue' && <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />}
            <div>
                <p className="font-semibold text-gray-900 dark:text-white text-sm truncate max-w-[150px] sm:max-w-[200px]">{description}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{categoryName}</p>
            </div>
        </div>
      </td>
      <td className="py-3 px-4">
          <div className="flex flex-col">
            <span className="text-sm text-gray-700 dark:text-gray-300">{formatDate(dueDate)}</span>
            {dateStatus?.label && <span className={`text-[10px] font-bold ${dateStatus.textClass}`}>{dateStatus.label}</span>}
          </div>
      </td>
      <td className={`py-3 px-4 font-semibold text-sm ${type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
        {type === 'receita' ? '+' : '-'} {formatCurrency(amount).replace('R$', '').trim()}
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`px-2 py-1 text-[10px] font-bold rounded-full capitalize ${status === 'pago' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{status}</span>
      </td>
    </tr>
  );
};

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions }) => {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);

  useEffect(() => {
    const loadCats = async () => {
        const data = await dataService.getAll<FinancialCategory>('financial_categories');
        setCategories(data);
    };
    loadCats();
  }, []);

  const sortedTransactions = useMemo(() => {
      if (!transactions || transactions.length === 0) return [];
      return [...transactions].sort((a, b) => {
          if (a.status === 'pendente' && b.status === 'pago') return -1;
          if (a.status === 'pago' && b.status === 'pendente') return 1;
          if (a.status === 'pendente') return a.dueDate.localeCompare(b.dueDate);
          return (b.paymentDate || b.dueDate).localeCompare(a.paymentDate || a.dueDate);
      }).slice(0, 6);
  }, [transactions]);

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name || 'Geral';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Movimentações & Alertas</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Itens vencidos ou próximos do vencimento aparecem primeiro.</p>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-700 dark:text-gray-400 tracking-wider">
            <tr><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Vencimento</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3 text-center">Status</th></tr>
          </thead>
          <tbody>
            {sortedTransactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} categoryName={getCatName(tx.categoryId)} />
            ))}
            {sortedTransactions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">Nenhuma transação registrada.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransactions;
