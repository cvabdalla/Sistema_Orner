import React, { useState, useMemo, useEffect } from 'react';
import Modal from '../Modal';
import { 
    TrashIcon, PlusIcon, CreditCardIcon, CogIcon, 
    EditIcon, CheckCircleIcon, XCircleIcon, CalendarIcon,
    DollarIcon, ExclamationTriangleIcon, TableIcon
} from '../../assets/icons';
import type { FinancialCategory, FinancialTransaction, CreditCard, BankAccount } from '../../types';
import { dataService } from '../../services/dataService';

interface CreditCardItem {
    id: string;
    date: string;
    description: string;
    categoryId: string;
    billingType: 'À vista (Único)' | 'Parcelado' | 'Recorrente (Fixo)';
    count: number; 
    amount: number;
    calculatedDueDate: string;
    errors?: { [key: string]: boolean };
}

interface CreditCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transactions: FinancialTransaction[]) => void;
    categories: FinancialCategory[];
    bankAccounts: BankAccount[];
}

const CreditCardModal: React.FC<CreditCardModalProps> = ({ isOpen, onClose, onSave, categories, bankAccounts }) => {
    const [activeTab, setActiveTab] = useState<'lancar' | 'config'>('lancar');
    const [cards, setCards] = useState<CreditCard[]>([]);
    const [selectedCardId, setSelectedCardId] = useState('');
    const [selectedBankId, setSelectedBankId] = useState('');
    const [isSavingLocal, setIsSavingLocal] = useState(false);

    // Form de lançamento
    const [items, setItems] = useState<CreditCardItem[]>([
        { id: '1', date: new Date().toISOString().split('T')[0], description: '', categoryId: '', billingType: 'À vista (Único)', count: 1, amount: 0, calculatedDueDate: '' }
    ]);

    // Form de cadastro de cartão
    const [cardForm, setCardForm] = useState<Partial<CreditCard>>({
        name: '', lastDigits: '', closingDay: 1, dueDay: 10, active: true
    });
    const [editingCardId, setEditingCardId] = useState<string | null>(null);

    const loadCards = async () => {
        try {
            const data = await dataService.getAll<CreditCard>('credit_cards');
            setCards(data);
            if (data.length > 0 && !selectedCardId) {
                const active = data.find(c => c.active);
                if (active) setSelectedCardId(active.id);
                else setSelectedCardId(data[0].id);
            }
            if (bankAccounts.length > 0 && !selectedBankId) {
                const defaultBank = bankAccounts.find(b => b.active) || bankAccounts[0];
                setSelectedBankId(defaultBank.id);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (isOpen) loadCards();
    }, [isOpen, bankAccounts]);

    const selectedCard = useMemo(() => cards.find(c => c.id === selectedCardId), [cards, selectedCardId]);

    const calculateDueDate = (expenseDate: string, card?: CreditCard): string => {
        if (!expenseDate || !card) return '';
        const [year, month, day] = expenseDate.split('-').map(Number);
        let dueMonth = month - 1;
        let dueYear = year;
        
        // Regra de fechamento
        if (day > card.closingDay) dueMonth++;
        dueMonth++; 
        
        // Forçar 12:00 para evitar desvios de fuso horário ISO
        const finalDueDate = new Date(dueYear, dueMonth, card.dueDay, 12, 0, 0);
        return finalDueDate.toISOString().split('T')[0];
    };

    const addMonths = (dateStr: string, months: number): string => {
        const [y, m, d] = dateStr.split('-').map(Number);
        const date = new Date(y, m - 1 + months, d, 12, 0, 0);
        return date.toISOString().split('T')[0];
    };

    useEffect(() => {
        if (selectedCard) {
            setItems(prev => prev.map(item => ({
                ...item,
                calculatedDueDate: calculateDueDate(item.date, selectedCard)
            })));
        }
    }, [selectedCardId, selectedCard]);

    const handleAddItem = () => {
        const lastDate = items[items.length - 1]?.date || new Date().toISOString().split('T')[0];
        setItems([...items, { 
            id: Math.random().toString(36).substr(2, 9), 
            date: lastDate, 
            description: '', 
            categoryId: '', 
            billingType: 'À vista (Único)', 
            count: 1,
            amount: 0, 
            calculatedDueDate: calculateDueDate(lastDate, selectedCard) 
        }]);
    };

    const handleRemoveItem = (id: string) => {
        if (items.length > 1) setItems(items.filter(item => item.id !== id));
    };

    const handleUpdateItem = (id: string, field: keyof CreditCardItem, value: any) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: value, errors: { ...item.errors, [field]: false } };
                if (field === 'date') newItem.calculatedDueDate = calculateDueDate(value, selectedCard);
                if (field === 'billingType' && value === 'À vista (Único)') newItem.count = 1;
                return newItem;
            }
            return item;
        }));
    };

    const totalFatura = useMemo(() => items.reduce((sum, item) => sum + (item.amount || 0), 0), [items]);

    const handleSaveTransactions = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (isSavingLocal) return;

        if (!selectedCard) {
            alert('Por favor, selecione um cartão de crédito ativo.');
            return;
        }

        if (!selectedBankId) {
            alert('Por favor, selecione a conta bancária para o débito da fatura.');
            return;
        }

        let hasErrors = false;
        const validatedItems = items.map(item => {
            const errors: any = {};
            if (!item.description.trim()) { errors.description = true; hasErrors = true; }
            if (!item.categoryId) { errors.categoryId = true; hasErrors = true; }
            if (item.amount <= 0) { errors.amount = true; hasErrors = true; }
            return { ...item, errors };
        });

        if (hasErrors) {
            setItems(validatedItems);
            alert('Preencha corretamente os campos destacados.');
            return;
        }

        setIsSavingLocal(true);
        const allTransactions: FinancialTransaction[] = [];
        const timestamp = Date.now();

        items.forEach((item, idx) => {
            const iterations = item.billingType === 'À vista (Único)' ? 1 : Math.max(1, item.count);
            for (let i = 0; i < iterations; i++) {
                const isInstallment = item.billingType === 'Parcelado';
                const effectiveAmount = isInstallment ? (item.amount / iterations) : item.amount;
                const suffix = iterations > 1 ? ` (${i + 1}/${iterations})` : '';
                const dueDate = addMonths(item.calculatedDueDate, i);

                allTransactions.push({
                    id: `cc-${timestamp}-${idx}-${i}`,
                    owner_id: '', 
                    description: `[${selectedCard.name}] ${item.description}${suffix}`,
                    amount: Math.ceil(effectiveAmount * 100) / 100,
                    type: 'despesa',
                    dueDate: dueDate,
                    bankId: selectedBankId, 
                    launchDate: new Date().toISOString().split('T')[0],
                    categoryId: item.categoryId,
                    status: 'pendente'
                });
            }
        });

        try {
            await onSave(allTransactions);
            setItems([{ id: '1', date: new Date().toISOString().split('T')[0], description: '', categoryId: '', billingType: 'À vista (Único)', count: 1, amount: 0, calculatedDueDate: '' }]);
        } catch (error) {
            console.error(error);
            alert("Erro ao processar salvamento da fatura.");
        } finally {
            setIsSavingLocal(false);
        }
    };

    const handleSaveCard = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!cardForm.name) return;
        const newCard: CreditCard = {
            id: editingCardId || Date.now().toString(),
            owner_id: '',
            name: cardForm.name!,
            lastDigits: cardForm.lastDigits || '****',
            closingDay: Number(cardForm.closingDay),
            dueDay: Number(cardForm.dueDay),
            active: cardForm.active ?? true
        };
        await dataService.save('credit_cards', newCard);
        setCardForm({ name: '', lastDigits: '', closingDay: 1, dueDay: 10, active: true });
        setEditingCardId(null);
        loadCards();
    };

    const editCard = (card: CreditCard) => {
        setEditingCardId(card.id);
        setCardForm(card);
    };

    const toggleCardStatus = async (card: CreditCard) => {
        await dataService.save('credit_cards', { ...card, active: !card.active });
        loadCards();
    };

    const expenseCategories = categories.filter(c => c.type === 'despesa').sort((a,b) => a.name.localeCompare(b.name));

    if (!isOpen) return null;

    const ChevronDownIcon = ({ className }: { className?: string }) => (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" /></svg>
    );

    return (
        <Modal title="Lançamento em cartão" onClose={onClose} maxWidth="max-w-7xl">
            <div className="space-y-4">
                <div className="flex bg-gray-50 dark:bg-gray-700/30 p-1 rounded-xl border border-gray-100 dark:border-gray-600 w-fit">
                    <button 
                        onClick={() => setActiveTab('lancar')}
                        className={`flex items-center gap-2 px-5 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'lancar' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-100 dark:border-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <PlusIcon className="w-3 h-3" /> Lançar gastos
                    </button>
                    <button 
                        onClick={() => setActiveTab('config')}
                        className={`flex items-center gap-2 px-5 py-1.5 text-[10px] font-bold rounded-lg transition-all ${activeTab === 'config' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-100 dark:border-gray-700' : 'text-gray-400 hover:text-gray-600'}`}
                    >
                        <CogIcon className="w-3 h-3" /> Configurar cartões
                    </button>
                </div>

                {activeTab === 'lancar' ? (
                    <div className="animate-fade-in space-y-4">
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-8 relative overflow-hidden p-4 bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl text-white shadow-sm border border-slate-600">
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[9px] font-bold tracking-widest opacity-60">Escolha o cartão</p>
                                        <div className="relative">
                                            <select 
                                                value={selectedCardId}
                                                onChange={(e) => setSelectedCardId(e.target.value)}
                                                className="appearance-none bg-white/10 border border-white/10 rounded-xl py-1.5 px-3 pr-8 text-xs font-bold outline-none focus:ring-1 focus:ring-white/30 cursor-pointer"
                                            >
                                                {cards.length === 0 && <option value="">Nenhum cartão cadastrado</option>}
                                                {cards.filter(c => c.active).map(c => (
                                                    <option key={c.id} value={c.id} className="text-gray-900">
                                                        {c.name} (**** {c.lastDigits})
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none opacity-60" />
                                        </div>
                                    </div>
                                    {selectedCard && (
                                        <div className="flex gap-6">
                                            <div><p className="text-[9px] font-bold opacity-60 tracking-tighter">Fechamento</p><p className="text-xs font-black">Dia {selectedCard.closingDay}</p></div>
                                            <div><p className="text-[9px] font-bold opacity-60 tracking-tighter">Vencimento</p><p className="text-xs font-black">Dia {selectedCard.dueDay}</p></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="lg:col-span-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                                <p className="text-[9px] font-bold text-indigo-400 tracking-widest uppercase mb-1">Banco para débito</p>
                                <div className="relative">
                                    <select 
                                        value={selectedBankId}
                                        onChange={(e) => setSelectedBankId(e.target.value)}
                                        className="w-full appearance-none bg-white dark:bg-gray-800 border border-indigo-100 dark:border-gray-700 rounded-xl py-1.5 px-3 pr-8 text-xs font-bold text-indigo-700 dark:text-indigo-300 outline-none shadow-sm cursor-pointer"
                                    >
                                        <option value="">Selecionar banco...</option>
                                        {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.accountName}</option>)}
                                    </select>
                                    <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-40 text-indigo-600" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <h4 className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Detalhamento dos gastos</h4>
                                <button 
                                    onClick={handleAddItem} 
                                    className="flex items-center gap-1 text-[10px] font-black text-indigo-500 hover:text-indigo-600 transition-colors"
                                >
                                    <PlusIcon className="w-3 h-3" /> Adicionar item
                                </button>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                <table className="w-full text-left">
                                    <thead className="bg-gray-50/50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700">
                                        <tr className="text-[9px] font-black text-gray-400 tracking-tighter">
                                            <th className="py-2.5 pl-4">Data</th>
                                            <th className="py-2.5">Descrição</th>
                                            <th className="py-2.5">Categoria</th>
                                            <th className="py-2.5">Cobrança</th>
                                            <th className="py-2.5 text-center">Parcelas</th>
                                            <th className="py-2.5 text-right">Valor total</th>
                                            <th className="py-2.5 text-center">Vencimento</th>
                                            <th className="py-2.5 pr-4"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                        {items.map(item => (
                                            <tr key={item.id} className="hover:bg-indigo-50/10 dark:hover:bg-indigo-900/5 transition-colors">
                                                <td className="py-2 pl-4 w-32">
                                                    <input 
                                                        type="date" 
                                                        value={item.date} 
                                                        onChange={(e) => handleUpdateItem(item.id, 'date', e.target.value)} 
                                                        className="w-full bg-transparent border-none p-1 text-[11px] font-bold text-gray-600 dark:text-gray-300 outline-none" 
                                                    />
                                                </td>
                                                <td className="py-2">
                                                    <input 
                                                        type="text" 
                                                        value={item.description} 
                                                        onChange={(e) => handleUpdateItem(item.id, 'description', e.target.value)} 
                                                        placeholder="Ex: Almoço..." 
                                                        className={`w-full rounded-lg px-2 py-1 text-[11px] font-bold outline-none transition-all ${item.errors?.description ? 'bg-red-50 text-red-600' : 'bg-transparent text-gray-700 dark:text-white focus:bg-gray-50 dark:focus:bg-gray-700'}`} 
                                                    />
                                                </td>
                                                <td className="py-2 w-40">
                                                    <select 
                                                        value={item.categoryId} 
                                                        onChange={(e) => handleUpdateItem(item.id, 'categoryId', e.target.value)} 
                                                        className={`w-full bg-transparent border-none px-1 py-1 text-[11px] font-bold outline-none ${item.errors?.categoryId ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}
                                                    >
                                                        <option value="">Selecione...</option>
                                                        {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                    </select>
                                                </td>
                                                <td className="py-2 w-32">
                                                    <select 
                                                        value={item.billingType} 
                                                        onChange={(e) => handleUpdateItem(item.id, 'billingType', e.target.value)} 
                                                        className="w-full bg-transparent border-none px-1 py-1 text-[11px] font-bold text-gray-500 dark:text-gray-400 outline-none"
                                                    >
                                                        <option value="À vista (Único)">À vista</option>
                                                        <option value="Parcelado">Parcelado</option>
                                                        <option value="Recorrente (Fixo)">Recorrente</option>
                                                    </select>
                                                </td>
                                                <td className="py-2 w-20 text-center">
                                                    {item.billingType !== 'À vista (Único)' ? (
                                                        <input 
                                                            type="number" 
                                                            min="2" 
                                                            value={item.count} 
                                                            onChange={(e) => handleUpdateItem(item.id, 'count', parseInt(e.target.value) || 1)} 
                                                            className="w-10 text-center bg-indigo-50 dark:bg-indigo-900/30 rounded p-0.5 text-[11px] font-black text-indigo-600 outline-none" 
                                                        />
                                                    ) : (
                                                        <span className="text-gray-300 text-[10px] font-bold">---</span>
                                                    )}
                                                </td>
                                                <td className="py-2 w-28">
                                                    <input 
                                                        type="number" 
                                                        step="0.01" 
                                                        value={item.amount || ''} 
                                                        onChange={(e) => handleUpdateItem(item.id, 'amount', parseFloat(e.target.value) || 0)} 
                                                        className={`w-full text-right bg-transparent border-none px-1 py-1 text-[11px] font-black outline-none ${item.errors?.amount ? 'text-red-500' : 'text-gray-800 dark:text-white'}`} 
                                                        placeholder="0,00"
                                                    />
                                                </td>
                                                <td className="py-2 w-28 text-center">
                                                    <span className="text-[9px] font-black text-gray-500 bg-gray-50 dark:bg-gray-700 px-2 py-0.5 rounded-lg border border-gray-100 dark:border-gray-600 shadow-sm">
                                                        {item.calculatedDueDate ? new Date(item.calculatedDueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '--/--/--'}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-4 text-right w-8">
                                                    <button onClick={() => handleRemoveItem(item.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex flex-col md:flex-row justify-between items-center bg-gray-50 dark:bg-gray-900/30 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-indigo-500 border border-gray-100 dark:border-gray-700">
                                    <DollarIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-gray-400 tracking-widest">Total dos lançamentos</p>
                                    <p className="text-xl font-black text-gray-800 dark:text-white leading-none mt-1">
                                        {totalFatura.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto">
                                <button onClick={onClose} className="flex-1 md:flex-none px-6 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                                <button 
                                    onClick={handleSaveTransactions}
                                    disabled={isSavingLocal}
                                    className="flex-1 md:flex-none px-10 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingLocal ? 'Processando...' : 'Confirmar e salvar'}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in space-y-5">
                        <form onSubmit={handleSaveCard} className="p-5 bg-white dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700 space-y-4 shadow-sm">
                            <div className="flex items-center gap-2 text-indigo-500">
                                <CreditCardIcon className="w-4 h-4" />
                                <h4 className="text-[10px] font-black tracking-widest">Configuração do novo cartão</h4>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 mb-1.5 ml-1">Identificação</label>
                                    <input required type="text" placeholder="Ex: Nubank..." value={cardForm.name} onChange={e => setCardForm({...cardForm, name: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 mb-1.5 ml-1">Dígitos finais</label>
                                    <input type="text" placeholder="1234" maxLength={4} value={cardForm.lastDigits} onChange={e => setCardForm({...cardForm, lastDigits: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 mb-1.5 ml-1">Fechamento (Dia)</label>
                                    <input required type="number" min="1" max="31" value={cardForm.closingDay} onChange={e => setCardForm({...cardForm, closingDay: parseInt(e.target.value) || 1})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-black text-center text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                </div>
                                <div>
                                    <label className="block text-[9px] font-black text-gray-400 mb-1.5 ml-1">Vencimento (Dia)</label>
                                    <input required type="number" min="1" max="31" value={cardForm.dueDay} onChange={e => setCardForm({...cardForm, dueDay: parseInt(e.target.value) || 1})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-900 p-2.5 text-xs font-black text-center text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-1">
                                {editingCardId && (
                                    <button type="button" onClick={() => { setEditingCardId(null); setCardForm({name:'', lastDigits:'', closingDay:1, dueDay:10}); }} className="px-4 py-2 text-[9px] font-black text-gray-400 hover:text-gray-600 tracking-widest">Cancelar edição</button>
                                )}
                                <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[11px] shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">
                                    {editingCardId ? <EditIcon className="w-3.5 h-3.5" /> : <PlusIcon className="w-3.5 h-3.5" />}
                                    {editingCardId ? 'Atualizar cartão' : 'Salvar novo cartão'}
                                </button>
                            </div>
                        </form>

                        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-gray-50 dark:bg-gray-900/40 text-[9px] font-black text-gray-400 tracking-tighter border-b">
                                    <tr>
                                        <th className="px-6 py-4">Descrição do cartão</th>
                                        <th className="px-6 py-4">Numeração</th>
                                        <th className="px-6 py-4 text-center">Dias (F/V)</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                        <th className="px-6 py-4 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                    {cards.length > 0 ? cards.map(card => (
                                        <tr key={card.id} className="hover:bg-gray-50 dark:hover:bg-indigo-900/5 transition-colors">
                                            <td className="px-6 py-3 font-black text-gray-700 dark:text-gray-200 text-xs">{card.name}</td>
                                            <td className="px-6 py-3 text-gray-400 font-mono text-[10px]">**** {card.lastDigits}</td>
                                            <td className="px-6 py-3">
                                                <div className="flex justify-center gap-1.5">
                                                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 rounded-lg text-[8px] font-black border border-blue-100 dark:border-blue-900">Fech. {card.closingDay}</span>
                                                    <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-500 dark:text-purple-400 rounded-lg text-[8px] font-black border border-purple-100 dark:border-purple-900">Venc. {card.dueDay}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3 text-center">
                                                <button 
                                                    onClick={() => toggleCardStatus(card)}
                                                    className={`px-3 py-0.5 rounded-full text-[9px] font-black border transition-all ${card.active ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}
                                                >
                                                    {card.active ? 'Ativo' : 'Inativo'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex justify-end gap-1">
                                                    <button onClick={() => editCard(card)} className="p-1.5 text-gray-400 hover:text-indigo-500 transition-colors"><EditIcon className="w-4 h-4" /></button>
                                                    <button onClick={async () => { if(confirm('Remover cartão?')) { await dataService.delete('credit_cards', card.id); loadCards(); } }} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"><TrashIcon className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic text-[11px]">Nenhum cartão para gerenciar.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default CreditCardModal;