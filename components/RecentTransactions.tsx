import React, { useMemo, useEffect, useState } from 'react';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory, CreditCard } from '../types';
import { ExclamationTriangleIcon, CreditCardIcon, EyeIcon } from '../assets/icons';
import { dataService } from '../services/dataService';
import CreditCardDetailModal from './Financeiro/CreditCardDetailModal';

interface RecentTransactionsProps {
    transactions: FinancialTransaction[];
}

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const TransactionRow: React.FC<{ transaction: any, categoryName: string, onViewDetails?: () => void }> = ({ transaction, categoryName, onViewDetails }) => {
  const { description, amount, status, dueDate, type, isCC, originalItems } = transaction;
  
  const formatDate = (dateString: string) => {
      if (!dateString) return '-';
      const [y, m, d] = dateString.split('-');
      return `${d}/${m}`;
  }

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50 group">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
            {isCC ? <CreditCardIcon className="w-4 h-4 text-indigo-500 shrink-0" /> : null}
            <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 dark:text-white text-[12px] tracking-tight truncate">{description}</p>
                <p className="text-[9px] text-gray-400 font-bold">{toSentenceCase(categoryName)}</p>
            </div>
            {isCC && (
                <button 
                    onClick={onViewDetails}
                    className="opacity-0 group-hover:opacity-100 p-1 bg-indigo-50 text-indigo-600 rounded transition-all"
                    title="Ver detalhes da fatura"
                >
                    <EyeIcon className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
      </td>
      <td className="py-3 px-4 text-[11px] font-bold text-gray-600 dark:text-gray-400">
          {formatDate(dueDate)}
      </td>
      <td className={`py-3 px-4 font-black text-xs text-right ${type === 'receita' ? 'text-green-600' : 'text-red-600'}`}>
        {formatCurrency(amount)}
      </td>
      <td className="py-3 px-4 text-center">
        <span className={`px-2 py-0.5 text-[8px] font-black rounded-full ${status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{toSentenceCase(status)}</span>
      </td>
    </tr>
  );
};

const RecentTransactions: React.FC<RecentTransactionsProps> = ({ transactions }) => {
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<FinancialTransaction[] | null>(null);

  useEffect(() => {
    dataService.getAll<FinancialCategory>('financial_categories').then(setCategories);
    dataService.getAll<CreditCard>('credit_cards').then(setCards);
  }, []);

  const sortedTransactions = useMemo(() => {
      if (!transactions || transactions.length === 0) return [];
      
      const ccGroups: Record<string, FinancialTransaction[]> = {};
      const normals: any[] = [];

      transactions.forEach(t => {
          if (t.id.startsWith('cc-') && t.type === 'despesa') {
              const cardMatch = t.description.match(/\[(.*?)\]/);
              const cardName = cardMatch ? cardMatch[1] : '';
              const card = cards.find(c => c.name === cardName);
              const closingDay = card ? card.closingDay : '0';
              const groupKey = `${t.dueDate}_${closingDay}`;

              if (!ccGroups[groupKey]) ccGroups[groupKey] = [];
              ccGroups[groupKey].push(t);
          } else {
              normals.push({ ...t, description: toSentenceCase(t.description), isCC: false });
          }
      });

      const groupedCC = Object.entries(ccGroups).map(([key, items]) => {
          const [dueDate] = key.split('_');
          return {
              id: `grouped-dashboard-${key}`,
              description: 'Cartão de crédito',
              amount: items.reduce((sum, i) => sum + i.amount, 0),
              dueDate: dueDate,
              type: 'despesa',
              status: items.every(i => i.status === 'pago') ? 'pago' : 'pendente',
              categoryId: 'cc-group',
              isCC: true,
              originalItems: items
          };
      });

      return [...normals, ...groupedCC].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 10);
  }, [transactions, cards]);

  const getCatName = (id: string) => {
      if (id === 'cc-group') return 'Fatura cartão';
      return categories.find(c => c.id === id)?.name || 'Geral';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden h-full flex flex-col">
      <div className="p-6 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Próximos vencimentos</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold">Resumo organizado e agrupado.</p>
      </div>
      <div className="overflow-x-auto flex-1">
        <table className="min-w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-[9px] font-black text-gray-400 tracking-widest">
            <tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Data</th><th className="px-4 py-3 text-right">Valor</th><th className="px-4 py-3 text-center">Status</th></tr>
          </thead>
          <tbody>
            {sortedTransactions.map((tx) => (
              <TransactionRow 
                key={tx.id} 
                transaction={tx} 
                categoryName={getCatName(tx.categoryId)} 
                onViewDetails={tx.isCC ? () => setSelectedGroup(tx.originalItems) : undefined}
              />
            ))}
            {sortedTransactions.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400 italic">Nada para exibir.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedGroup && (
          <CreditCardDetailModal 
            isOpen={!!selectedGroup}
            onClose={() => setSelectedGroup(null)}
            items={selectedGroup}
            categories={categories}
            onUpdateStatus={async (id, status) => {
                const tx = transactions.find(t => t.id === id);
                if (tx) await dataService.save('financial_transactions', { ...tx, status });
            }}
            onDeleteItem={async (id) => {
                await dataService.delete('financial_transactions', id);
            }}
          />
      )}
    </div>
  );
};

export default RecentTransactions;