import React, { useMemo, useEffect, useState } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory } from '../types';
import { ExclamationTriangleIcon, CreditCardIcon } from '../assets/icons';
import { dataService } from '../services/dataService';

interface RecentTransactionsProps {
    transactions: FinancialTransaction[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return '0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(rounded);
};

const TransactionRow: React.FC<{ transaction: FinancialTransaction & { isGroup?: boolean, itemCount?: number, cardCount?: number }, categoryName: string }> = ({ transaction, categoryName }) => {
  const { description, amount, status, dueDate, type, isGroup, itemCount, cardCount } = transaction;
  
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
  const rowClasses = isGroup 
    ? 'bg-indigo-50/40 dark:bg-indigo-900/10 border-l-4 border-l-indigo-600 hover:bg-indigo-100/50'
    : dateStatus?.rowClass || 'border-l-4 border-l-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50';
  
  const formatDate = (dateString: string) => {
      if (!dateString) return '-';
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}`;
  }

  return (
    <tr className={`border-b border-gray-200 dark:border-gray-700 transition-colors ${rowClasses}`}>
      <td className="py-3 px-4">
        <div className="flex items-center">
            {isGroup ? (
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg mr-3 shadow-sm shrink-0">
                    <CreditCardIcon className="w-3.5 h-3.5" />
                </div>
            ) : dateStatus?.type === 'overdue' ? (
                <ExclamationTriangleIcon className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
            ) : (
                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mr-3 shrink-0" />
            )}
            <div className="min-w-0">
                <p className={`font-bold text-sm truncate ${isGroup ? 'text-indigo-700 dark:text-indigo-400' : 'text-gray-900 dark:text-white'}`}>
                    {description}
                </p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold tracking-tight truncate">
                    {isGroup ? `Fatura consolidada: ${itemCount} itens de ${cardCount} cartão(ões)` : categoryName}
                </p>
            </div>
        </div>
      </td>
      <td className="py-3 px-4">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{formatDate(dueDate)}</span>
            {dateStatus?.label && <span className={`text-[9px] font-bold tracking-tight ${dateStatus.textClass}`}>{dateStatus.label}</span>}
          </div>
      </td>
      <td className={`py-3 px-4 font-bold text-sm text-right ${type === 'receita' ? 'text-green-600' : isGroup ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600'}`}>
        {formatCurrency(amount)}
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`px-2 py-1 text-[9px] font-black rounded-lg shadow-sm ${status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {status === 'pago' ? 'Pago' : 'Pendente'}
        </span>
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

  const processedTransactions = useMemo(() => {
      if (!transactions || transactions.length === 0) return [];

      const result: (FinancialTransaction & { isGroup?: boolean, itemCount?: number, cardCount?: number })[] = [];
      const cardGroups = new Map<string, FinancialTransaction[]>();

      transactions.forEach(t => {
          const isCard = t.description.includes('[Cartão:');
          if (isCard) {
              const key = `${t.dueDate}_${t.status}`;
              if (!cardGroups.has(key)) cardGroups.set(key, []);
              cardGroups.get(key)!.push(t);
          } else {
              result.push(t);
          }
      });

      cardGroups.forEach((items, key) => {
          const [dueDate, status] = key.split('_');
          const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
          
          const cardNames = new Set();
          items.forEach(item => {
              const match = item.description.match(/\[Cartão:\s*(.*?)\]/);
              if (match) cardNames.add(match[1]);
          });

          result.push({
              ...items[0],
              id: `group_${key}`,
              description: 'Cartão de crédito',
              amount: totalAmount,
              isGroup: true,
              itemCount: items.length,
              cardCount: cardNames.size,
              dueDate: dueDate,
              status: status as FinancialTransactionStatus
          });
      });

      return result.sort((a, b) => {
          // Pendentes primeiro
          if (a.status === 'pendente' && b.status === 'pago') return -1;
          if (a.status === 'pago' && b.status === 'pendente') return 1;
          // Depois por data
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }).slice(0, 8);
  }, [transactions]);

  const getCatName = (id: string) => categories.find(c => c.id === id)?.name || 'Geral';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-full flex flex-col border border-gray-100 dark:border-gray-700">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Movimentações & Alertas</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Itens vencidos ou consolidados de cartão aparecem primeiro.</p>
      </div>
      <div className="overflow-x-auto flex-1 custom-scrollbar">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-bold text-gray-400 tracking-widest border-b">
            <tr>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3">Venc.</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {processedTransactions.map((tx) => (
              <TransactionRow key={tx.id} transaction={tx} categoryName={getCatName(tx.categoryId)} />
            ))}
            {processedTransactions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400 italic">Nenhuma movimentação pendente no momento.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentTransactions;