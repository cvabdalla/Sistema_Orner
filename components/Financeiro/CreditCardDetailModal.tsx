import React, { useMemo } from 'react';
import Modal from '../Modal';
import { TrashIcon, CheckCircleIcon, CreditCardIcon, EditIcon, UsersIcon } from '../../assets/icons';
import type { FinancialTransaction, FinancialCategory, FinancialTransactionStatus } from '../../types';

interface CreditCardDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    items: FinancialTransaction[];
    categories: FinancialCategory[];
    onUpdateStatus: (id: string, status: FinancialTransactionStatus) => void;
    onDeleteItem: (id: string) => void;
    onEditItem?: (item: FinancialTransaction) => void;
}

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const toSentenceCase = (str: string) => {
    if (!str) return '';
    // Remove o prefixo [Cartão (**** Digitos)] ou apenas [Cartão] da descrição se existir
    const cleanDesc = str.replace(/\[.*?\]\s?/, '');
    const clean = cleanDesc.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const CreditCardDetailModal: React.FC<CreditCardDetailModalProps> = ({ 
    isOpen, onClose, items, categories, onUpdateStatus, onDeleteItem, onEditItem 
}) => {
    const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name || 'N/A';
    const totalGeral = items.reduce((sum, i) => sum + i.amount, 0);

    // Agrupamento multinível: Cliente -> Cartão Único (Chave completa) -> Itens
    const groupedData = useMemo(() => {
        const clients: Record<string, Record<string, FinancialTransaction[]>> = {};

        items.forEach(item => {
            const cardMatch = item.description.match(/\[(.*?)\]/);
            
            if (cardMatch) {
                const fullCardInfo = cardMatch[1];
                const nameMatch = fullCardInfo.match(/^(.*?)(?:\s?\(|$)/);
                const clientName = nameMatch ? nameMatch[1].trim() : fullCardInfo.trim();

                if (!clients[clientName]) clients[clientName] = {};
                if (!clients[clientName][fullCardInfo]) {
                    clients[clientName][fullCardInfo] = [];
                }
                clients[clientName][fullCardInfo].push(item);
            } else {
                // FALLBACK: Se o item não tiver colchetes (ex: foi editado manualmente), 
                // ele entra em um grupo genérico para não "sumir" da fatura.
                const clientName = "Lançamentos Manuais / Outros";
                const fullCardInfo = "Descrição alterada (Sem vínculo de cartão)";

                if (!clients[clientName]) clients[clientName] = {};
                if (!clients[clientName][fullCardInfo]) {
                    clients[clientName][fullCardInfo] = [];
                }
                clients[clientName][fullCardInfo].push(item);
            }
        });

        return clients;
    }, [items]);

    return (
        <Modal title="Detalhamento da Fatura" onClose={onClose} maxWidth="max-w-6xl">
            <div className="space-y-8 pb-4">
                {/* Resumo Geral da Fatura (Topo) */}
                <div className="flex items-center justify-between p-6 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20 text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                            <CreditCardIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-indigo-100 tracking-widest leading-none mb-1 uppercase">Fatura Consolidada (Geral)</p>
                            <p className="text-3xl font-black">{formatCurrency(totalGeral)}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-indigo-200 uppercase">Vencimento em</p>
                        <p className="text-lg font-black">
                            {items.length > 0 ? new Date(items[0].dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '---'}
                        </p>
                    </div>
                </div>

                {/* Listagem Agrupada por Cliente */}
                <div className="space-y-12">
                    {Object.entries(groupedData).map(([clientName, uniqueCards]) => (
                        <div key={clientName} className="space-y-6">
                            {/* Cabeçalho do Cliente Titular */}
                            <div className="flex items-center gap-3 px-1">
                                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg shadow-sm">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <h3 className="text-xl font-black text-gray-800 dark:text-white tracking-tight uppercase">
                                    {clientName}
                                </h3>
                                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-700 ml-2"></div>
                            </div>

                            {/* Quadros de cada cartão individual do cliente */}
                            <div className="grid grid-cols-1 gap-6">
                                {Object.entries(uniqueCards).map(([fullCardKey, cardItems]) => {
                                    const subtotalCard = cardItems.reduce((sum, item) => sum + item.amount, 0);
                                    
                                    // Tenta extrair apenas os dígitos para o rótulo do quadro
                                    const digitsMatch = fullCardKey.match(/\((.*?)\)/);
                                    const cardLabel = digitsMatch ? digitsMatch[1] : fullCardKey;

                                    return (
                                        <div key={fullCardKey} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-all">
                                            {/* Cabeçalho do Quadro do Cartão */}
                                            <div className="px-5 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white dark:bg-gray-700 text-indigo-500 rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-600 shadow-sm">
                                                        <CreditCardIcon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-black text-gray-400 dark:text-gray-500 tracking-widest uppercase">Cartão: <span className="text-gray-800 dark:text-white font-mono">{cardLabel}</span></h4>
                                                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">{cardItems.length} lançamentos vinculados</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-gray-400 uppercase mb-0.5 tracking-tighter">Subtotal do Cartão</p>
                                                    <p className={`text-lg font-black ${subtotalCard < 0 ? 'text-green-600' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                        {formatCurrency(subtotalCard)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Tabela de Lançamentos deste cartão específico */}
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left text-sm">
                                                    <thead className="bg-gray-50/50 dark:bg-gray-900/20 text-[9px] font-black text-gray-400 border-b dark:border-gray-700">
                                                        <tr>
                                                            <th className="px-5 py-3">Descrição do Lançamento</th>
                                                            <th className="px-5 py-3 w-32">Categoria</th>
                                                            <th className="px-5 py-3 text-right w-28">Valor</th>
                                                            <th className="px-5 py-3 text-center w-24">Status</th>
                                                            <th className="px-5 py-3 text-right w-24">Ações</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                                        {cardItems.map(item => (
                                                            <tr key={item.id} className="hover:bg-indigo-50/20 dark:hover:bg-gray-900/40 transition-colors">
                                                                <td className="px-5 py-3">
                                                                    <p className="font-bold text-gray-800 dark:text-gray-200 text-[11px]">{toSentenceCase(item.description)}</p>
                                                                    <p className="text-[8px] text-gray-400 font-bold tracking-tighter uppercase">Venc: {item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : '---'}</p>
                                                                </td>
                                                                <td className="px-5 py-3">
                                                                    <span className="text-[9px] font-black text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded uppercase">{getCategoryName(item.categoryId)}</span>
                                                                </td>
                                                                <td className={`px-5 py-3 text-right font-black text-xs ${item.amount < 0 ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
                                                                    {formatCurrency(item.amount)}
                                                                </td>
                                                                <td className="px-5 py-3 text-center">
                                                                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-tighter ${item.status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                        {item.status === 'pago' ? (item.type === 'receita' ? 'Recebido' : 'Pago') : 'Pendente'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-3 text-right">
                                                                    <div className="flex justify-end gap-1">
                                                                        {onEditItem && (
                                                                            <button 
                                                                                type="button"
                                                                                onClick={(e) => { e.stopPropagation(); onClose(); onEditItem(item); }}
                                                                                className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                                                title="Editar lançamento"
                                                                            >
                                                                                <EditIcon className="w-4 h-4" />
                                                                            </button>
                                                                        )}
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(item.id, item.status === 'pago' ? 'pendente' : 'pago'); }}
                                                                            className={`p-1.5 rounded-lg transition-colors ${item.status === 'pago' ? 'text-gray-300' : 'text-green-600 hover:bg-green-50'}`}
                                                                            title={item.status === 'pago' ? 'Estornar' : 'Efetivar'}
                                                                        >
                                                                            <CheckCircleIcon className="w-4 h-4" />
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => { 
                                                                                e.stopPropagation(); 
                                                                                // O onDeleteItem agora é responsável por fechar o modal ou processar a exclusão
                                                                                onDeleteItem(item.id);
                                                                                // Fechamos o modal para que o Dashboard/Financeiro possa processar a recarga ou o próximo modal
                                                                                onClose();
                                                                            }}
                                                                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                            title="Remover item"
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
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Rodapé do Modal */}
                <div className="flex justify-end pt-6 border-t dark:border-gray-700">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all uppercase tracking-widest shadow-sm"
                    >
                        Fechar Detalhamento
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default CreditCardDetailModal;