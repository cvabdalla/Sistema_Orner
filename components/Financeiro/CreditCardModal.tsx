
import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../Modal';
import { PlusIcon, CreditCardIcon, SaveIcon, CogIcon, XCircleIcon, CalendarIcon, CheckCircleIcon, ExclamationTriangleIcon, EditIcon } from '../../assets/icons';
import type { FinancialCategory, FinancialTransaction, CreditCard } from '../../types';
import { dataService } from '../../services/dataService';

interface CreditCardItem {
    id: string;
    date: string;
    description: string;
    categoryId: string;
    amount: number;
}

interface CreditCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transactions: FinancialTransaction[]) => void;
    categories: FinancialCategory[];
    ownerId: string;
}

const CreditCardModal: React.FC<CreditCardModalProps> = ({ isOpen, onClose, onSave, categories, ownerId }) => {
    const [activeTab, setActiveTab] = useState<'lancamentos' | 'cartoes'>('lancamentos');
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState('');
    const [items, setItems] = useState<CreditCardItem[]>([
        { id: '1', date: new Date().toISOString().split('T')[0], description: '', categoryId: '', amount: 0 }
    ]);
    
    // Estados do Formulário de Cartão
    const [editingCardId, setEditingCardId] = useState<string | null>(null);
    const [newCardName, setNewCardName] = useState('');
    const [newCardNumber, setNewCardNumber] = useState('');
    const [newCardDueDay, setNewCardDueDay] = useState<number>(10);
    const [newCardClosingDay, setNewCardClosingDay] = useState<number>(1);
    
    // Estados de Controle
    const [isLoading, setIsLoading] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadCards();
        }
    }, [isOpen]);

    const loadCards = async () => {
        try {
            const data = await dataService.getAll<CreditCard>('credit_cards', ownerId);
            const sorted = (data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            setCards(sorted);
            
            const activeCards = sorted.filter(c => c.active);
            if (activeCards.length > 0 && !selectedCardId) {
                setSelectedCardId(activeCards[0].id);
            }
        } catch (error) {
            console.error("Erro ao carregar cartões:", error);
        }
    };

    const selectedCard = useMemo(() => cards.find(c => c.id === selectedCardId), [cards, selectedCardId]);
    
    // Apenas cartões ativos aparecem para lançamento
    const activeCards = useMemo(() => cards.filter(c => c.active), [cards]);

    const calculateDueDate = (spentDateStr: string, card: CreditCard) => {
        const spentDate = new Date(spentDateStr);
        const day = spentDate.getUTCDate();
        const month = spentDate.getUTCMonth();
        const year = spentDate.getUTCFullYear();

        let targetMonth = month;
        let targetYear = year;

        if (day > card.closing_day) {
            targetMonth++;
            if (targetMonth > 11) {
                targetMonth = 0;
                targetYear++;
            }
        }

        const due = new Date(Date.UTC(targetYear, targetMonth, card.due_day));
        return due.toISOString().split('T')[0];
    };

    const totalFatura = useMemo(() => {
        return items.reduce((sum, item) => sum + item.amount, 0);
    }, [items]);

    const handleTrySaveCard = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCardName.trim()) {
            alert("O nome do cartão é obrigatório.");
            return;
        }
        setIsConfirming(true);
    };

    const handleConfirmSave = async () => {
        setIsConfirming(false);
        setIsLoading(true);

        try {
            const lastDigitsStr = newCardNumber.trim().length >= 4 
                ? newCardNumber.trim().slice(-4) 
                : newCardNumber.trim();

            const card: CreditCard = {
                id: editingCardId || `card-${Date.now()}`,
                owner_id: ownerId,
                name: newCardName.trim(),
                card_number: newCardNumber.trim(),
                last_digits: lastDigitsStr,
                due_day: newCardDueDay,
                closing_day: newCardClosingDay,
                active: editingCardId ? (cards.find(c => c.id === editingCardId)?.active ?? true) : true
            };
            
            await dataService.save('credit_cards', card);
            
            resetForm();
            alert(editingCardId ? 'Cartão atualizado com sucesso!' : 'Cartão cadastrado com sucesso!');
            await loadCards();
        } catch (error: any) {
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setEditingCardId(null);
        setNewCardName('');
        setNewCardNumber('');
        setNewCardDueDay(10);
        setNewCardClosingDay(1);
    };

    const handleEditCard = (card: CreditCard) => {
        setEditingCardId(card.id);
        setNewCardName(card.name);
        setNewCardNumber(card.card_number || '');
        setNewCardDueDay(card.due_day);
        setNewCardClosingDay(card.closing_day);
        // Rola para o topo do formulário
        const container = document.querySelector('.overflow-y-auto');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleChangeStatus = async (card: CreditCard, isActive: boolean) => {
        try {
            const updatedCard = { ...card, active: isActive };
            await dataService.save('credit_cards', updatedCard);
            // Se o cartão foi bloqueado e estava selecionado no lançamento, limpa a seleção
            if (!isActive && selectedCardId === card.id) {
                setSelectedCardId('');
            }
            await loadCards();
        } catch (error: any) {
            alert("Erro ao alterar status: " + error.message);
        }
    };

    const handleAddItem = () => {
        setItems([...items, { 
            id: Date.now().toString(), 
            date: new Date().toISOString().split('T')[0], 
            description: '', 
            categoryId: '', 
            amount: 0 
        }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(item => item.id !== id));
        }
    };

    const handleUpdateItem = (id: string, field: keyof CreditCardItem, value: any) => {
        setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleSubmitTransactions = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCardId || !selectedCard || totalFatura <= 0) {
            alert('Preencha os gastos e selecione um cartão ativo.');
            return;
        }

        setIsLoading(true);
        try {
            const batchId = `batch-cc-${Date.now()}`;
            const cardDisplay = selectedCard.last_digits ? `${selectedCard.name} (**** ${selectedCard.last_digits})` : selectedCard.name;
            
            const newTransactions: FinancialTransaction[] = items.map(item => ({
                id: `cc-${batchId}-${item.id}`,
                owner_id: ownerId,
                description: `[Cartão: ${cardDisplay}] ${item.description}`,
                amount: item.amount,
                type: 'despesa',
                dueDate: calculateDueDate(item.date, selectedCard),
                launchDate: item.date,
                categoryId: item.categoryId,
                status: 'pendente',
                batchId: batchId
            }));

            await onSave(newTransactions);
            setItems([{ id: '1', date: new Date().toISOString().split('T')[0], description: '', categoryId: '', amount: 0 }]);
            onClose();
        } catch (error) {
            alert("Erro ao lançar faturas.");
        } finally {
            setIsLoading(false);
        }
    };

    const expenseCategories = categories.filter(c => c.type === 'despesa');

    return (
        <Modal title="Gestão de cartão de crédito" onClose={onClose} maxWidth="max-w-5xl">
            {isConfirming && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm border-2 border-indigo-500 animate-fade-in">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                                <ExclamationTriangleIcon className="w-10 h-10" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{editingCardId ? 'Confirmar alteração?' : 'Confirmar cadastro?'}</h3>
                            <p className="text-sm text-gray-500 font-medium">Deseja realmente salvar o cartão <b>"{newCardName}"</b>?</p>
                            <div className="flex gap-3 w-full pt-2">
                                <button onClick={() => setIsConfirming(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">Não</button>
                                <button onClick={handleConfirmSave} className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all">Sim, salvar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl border border-gray-200 dark:border-gray-600">
                    <button onClick={() => setActiveTab('lancamentos')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'lancamentos' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500'}`}><PlusIcon className="w-4 h-4" /> Lançar gastos</button>
                    <button onClick={() => setActiveTab('cartoes')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'cartoes' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500'}`}><CogIcon className="w-4 h-4" /> Meus cartões</button>
                </div>

                {activeTab === 'lancamentos' ? (
                    <form onSubmit={handleSubmitTransactions} className="space-y-6 animate-fade-in">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                            <label className="block text-xs font-bold text-gray-500 mb-1">Selecionar cartão ativo</label>
                            <select 
                                required
                                value={selectedCardId} 
                                onChange={(e) => setSelectedCardId(e.target.value)} 
                                className="w-full rounded-lg border-transparent bg-white dark:bg-gray-800 p-2 text-sm font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20"
                            >
                                <option value="">Selecione um cartão ativo...</option>
                                {activeCards.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name} {c.last_digits ? `(**** ${c.last_digits})` : ''} - Fecha dia {c.closing_day} / Venc. dia {c.due_day}
                                    </option>
                                ))}
                            </select>
                            {activeCards.length === 0 && (
                                <p className="mt-2 text-[10px] text-red-500 font-bold">Nenhum cartão ativo cadastrado. Vá em "Meus cartões" para ativar ou cadastrar.</p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300">Detalhamento dos gastos</h4>
                                <button type="button" onClick={handleAddItem} className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded-lg transition-colors"><PlusIcon className="w-4 h-4" /> Adicionar linha</button>
                            </div>

                            <div className="max-h-[350px] overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                {items.map((item) => {
                                    const itemDueDate = selectedCard ? calculateDueDate(item.date, selectedCard) : null;
                                    return (
                                        <div key={item.id} className="flex gap-2 items-end group animate-fade-in border-b border-gray-100 dark:border-gray-800 pb-2">
                                            <div className="w-36">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1">Data gasto</label>
                                                <input required type="date" value={item.date} onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)} className="w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                            </div>
                                            <div className="flex-1">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1">Descrição</label>
                                                <input required type="text" value={item.description} onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)} placeholder="Ex: Almoço cliente" className="w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                            </div>
                                            <div className="w-40">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1">Categoria</label>
                                                <select required value={item.categoryId} onChange={(e) => handleUpdateItem(item.id, 'categoryId', e.target.value)} className="w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/20">
                                                    <option value="">Selecione...</option>
                                                    {expenseCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                                                </select>
                                            </div>
                                            <div className="w-28">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-1 ml-1">Valor (R$)</label>
                                                <input required type="number" step="0.01" value={item.amount || ''} onChange={(e) => handleUpdateItem(item.id, 'amount', parseFloat(e.target.value) || 0)} className="w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-bold text-right outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                            </div>
                                            <div className="w-24 text-center pb-2.5">
                                                <label className="block text-[8px] font-bold text-gray-400 mb-1">Vencimento</label>
                                                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
                                                    {itemDueDate ? new Date(itemDueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--/--'}
                                                </span>
                                            </div>
                                            <button type="button" onClick={() => handleRemoveItem(item.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors mb-0.5"><XCircleIcon className="w-4 h-4" /></button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row justify-between items-center pt-6 border-t border-gray-100 dark:border-gray-700 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><CreditCardIcon className="w-6 h-6" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 tracking-tight leading-none mb-1">Total da fatura</p>
                                    <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{totalFatura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                                </div>
                            </div>
                            <div className="flex gap-3 w-full sm:w-auto">
                                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 font-bold rounded-xl text-sm transition-all hover:bg-gray-200">Cancelar</button>
                                <button type="submit" disabled={isLoading || activeCards.length === 0} className="flex-1 sm:flex-none px-10 py-3 bg-indigo-600 text-white font-bold rounded-xl text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center min-w-[160px]">{isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Lançar gastos'}</button>
                            </div>
                        </div>
                    </form>
                ) : (
                    <div className="space-y-8 animate-fade-in">
                        <div className={`p-5 rounded-2xl border border-dashed transition-all ${editingCardId ? 'bg-indigo-50 border-indigo-300 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600'}`}>
                            <div className="flex justify-between items-center mb-4">
                                <p className={`text-xs font-bold tracking-tighter ${editingCardId ? 'text-indigo-600' : 'text-gray-500'}`}>
                                    {editingCardId ? 'Editando cadastro do cartão' : 'Cadastrar novo cartão'}
                                </p>
                                {editingCardId && (
                                    <button onClick={resetForm} className="text-[10px] font-black text-red-500 hover:underline">Cancelar edição</button>
                                )}
                            </div>
                            <form onSubmit={handleTrySaveCard} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Nome do cartão (apelido)</label>
                                        <input required type="text" value={newCardName} onChange={(e) => setNewCardName(e.target.value)} placeholder="Ex: Nubank empresa..." className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2.5 text-sm font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Número do cartão (opcional)</label>
                                        <input type="text" value={newCardNumber} onChange={(e) => setNewCardNumber(e.target.value)} placeholder="Apenas para referência..." className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2.5 text-sm font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Dia fechamento</label>
                                        <input required type="number" min="1" max="31" value={newCardClosingDay} onChange={(e) => setNewCardClosingDay(parseInt(e.target.value) || 1)} className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2.5 text-sm font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Dia vencimento</label>
                                        <input required type="number" min="1" max="31" value={newCardDueDay} onChange={(e) => setNewCardDueDay(parseInt(e.target.value) || 1)} className="w-full rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 p-2.5 text-sm font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                    </div>
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button type="submit" disabled={isLoading || !newCardName.trim()} className="px-10 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2">
                                        {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <SaveIcon className="w-4 h-4" />}
                                        {isLoading ? 'Salvando...' : editingCardId ? 'Atualizar cadastro' : 'Cadastrar cartão'}
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-sm border-collapse">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-bold text-gray-400 border-b border-gray-100 dark:border-gray-600">
                                        <tr>
                                            <th className="px-6 py-4">Cartão / apelido</th>
                                            <th className="px-6 py-4">Final / número</th>
                                            <th className="px-6 py-4 text-center">Fechamento</th>
                                            <th className="px-6 py-4 text-center">Vencimento</th>
                                            <th className="px-6 py-4 text-center">Status</th>
                                            <th className="px-6 py-4 text-right">Ações</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {cards.map(card => (
                                            <tr key={card.id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/40 transition-colors ${!card.active ? 'opacity-60 bg-red-50/10' : ''}`}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`p-2 rounded-lg ${card.active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-red-50 text-red-400'}`}>
                                                            <CreditCardIcon className="w-5 h-5" />
                                                        </div>
                                                        <span className={`font-bold text-sm ${card.active ? 'text-gray-800 dark:text-gray-100' : 'text-gray-400 line-through'}`}>
                                                            {card.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                                                        {card.last_digits ? `**** ${card.last_digits}` : '---'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-xs font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-lg">
                                                        Dia {card.closing_day}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="text-xs font-black text-purple-600 bg-purple-50 dark:bg-purple-900/40 px-2.5 py-1 rounded-lg">
                                                        Dia {card.due_day}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <select 
                                                        value={card.active ? 'true' : 'false'}
                                                        onChange={(e) => handleChangeStatus(card, e.target.value === 'true')}
                                                        className={`text-[10px] font-black rounded-lg border-transparent px-2 py-1 outline-none transition-all cursor-pointer shadow-sm ${
                                                            card.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                        }`}
                                                    >
                                                        <option value="true">Ativo</option>
                                                        <option value="false">Bloqueado</option>
                                                    </select>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button 
                                                        onClick={() => handleEditCard(card)}
                                                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                                        title="Editar cadastro"
                                                    >
                                                        <EditIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        {cards.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-6 py-10 text-center text-gray-400 italic text-xs font-medium">
                                                    Nenhum cartão cadastrado no momento.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CreditCardModal;
