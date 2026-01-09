import React, { useMemo } from 'react';
import Modal from '../Modal';
import { TrashIcon, CheckCircleIcon, CreditCardIcon } from '../../assets/icons';
import type { FinancialTransaction, FinancialCategory, FinancialTransactionStatus } from '../../types';

interface CreditCardDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: FinancialTransaction[];
    categories: FinancialCategory[];
    onUpdateStatus: (id: string, status: FinancialTransactionStatus) => void;
    onDeleteItem: (id: string) => void;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const cleanDesc = str.replace(/\[.*?\]\s?/, '');
    const clean = cleanDesc.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const CreditCardDetailModal: React.FC<CreditCardDetailModalProps> = ({ 
    isOpen, onClose, items, categories, onUpdateStatus, onDeleteItem 
}) => {
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';
    const total = items.reduce((sum, i) => sum + i.amount, 0);

    const groupedByCard = useMemo(() => {
        const groups: Record<string, FinancialTransaction[]> = {};
        items.forEach(item => {
            const cardMatch = item.description.match(/\[(.*?)\]/);
            const cardName = cardMatch ? cardMatch[1] : 'Cartão de crédito';
            if (!groups[cardName]) groups[cardName] = [];
            groups[cardName].push(item);
        });
        return groups;
    }, [items]);

    return (
        <Modal title="Detalhamento da Fatura" onClose={onClose} maxWidth="max-w-4xl">
            <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                            <CreditCardIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-indigo-400 tracking-widest leading-none mb-1">Total acumulado</p>
                            <p className="text-2xl font-black text-gray-900 dark:text-white">{formatCurrency(total)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400">Vencimento</p>
                        <p className="text-sm font-black text-gray-700 dark:text-gray-200">
                            {new Date(items[0].dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                        </p>
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Fix: Explicitly cast Object.entries to avoid 'unknown' type inference error on cardItems */}
                    {(Object.entries(groupedByCard) as [string, FinancialTransaction[]][]).map(([cardName, cardItems]) => (
                        <div key={cardName} className="space-y-3">
                            <div className="flex items-center gap-2 border-b dark:border-gray-700 pb-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                                <h4 className="text-xs font-black text-gray-400 tracking-widest">Gastos no cartão: {cardName}</h4>
                                {/* Fix: cardItems.length now recognized as property of FinancialTransaction[] */}
                                <span className="ml-auto text-[10px] font-bold text-gray-400">{cardItems.length} lançamentos</span>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[9px] font-black text-gray-400 border-b dark:border-gray-700">
                                        <tr>
                                            <th className="px-4 py-3">Item / descrição</th>
                                            <th className="px-4 py-3">Categoria</th>
                                            <th className="px-4 py-3 text-right">Valor</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-right w-24">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {/* Fix: cardItems.map now recognized as method of FinancialTransaction[] */}
                                        {cardItems.map(item => (
                                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                                <td className="px-4 py-3">
                                                    <p className="font-bold text-gray-800 dark:text-gray-200 text-xs">{toSentenceCase(item.description)}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold tracking-tighter">Data: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : '---'}</p>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-[10px] font-bold text-gray-500">{getCategoryName(item.categoryId)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-right font-black text-gray-900 dark:text-white text-xs">
                                                    {formatCurrency(item.amount)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${item.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                        {item.status === 'pago' ? (item.type === 'receita' ? 'Recebido' : 'Pago') : 'Pendente'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <button 
                                                            onClick={() => onUpdateStatus(item.id, item.status === 'pago' ? 'pendente' : 'pago')}
                                                            className={`p-1.5 rounded-lg transition-colors ${item.status === 'pago' ? 'text-gray-300' : 'text-green-600 hover:bg-green-50'}`}
                                                            title={item.status === 'pago' ? 'Estornar' : 'Efetivar'}
                                                        >
                                                            <CheckCircleIcon className="w-4 h-4" />
                                                        </button>
                                                        <button 
                                                            onClick={() => { if(confirm('Excluir este item?')) onDeleteItem(item.id); }}
                                                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-end pt-4 border-t dark:border-gray-700">
                    <button 
                        onClick={onClose}
                        className="px-8 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                    >
                        Fechar Visualização
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CreditCardDetailModal;