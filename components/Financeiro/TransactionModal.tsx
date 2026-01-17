
import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import { 
    DollarIcon, CalendarIcon, ClipboardListIcon, 
    ArrowUpIcon, ArrowDownIcon, ClockIcon, SaveIcon, 
    CheckCircleIcon, LockClosedIcon, ExclamationTriangleIcon, TableIcon
} from '../../assets/icons';
import type { FinancialTransaction, FinancialCategory, FinancialTransactionType, FinancialTransactionStatus, BankAccount } from '../../types';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: FinancialTransaction, recurrence?: { frequency: 'mensal' | 'trimestral' | 'semestral' | 'anual', occurrences: number }) => void;
    transaction: FinancialTransaction | null;
    initialType?: FinancialTransactionType;
    categories: FinancialCategory[];
    bankAccounts: BankAccount[];
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, transaction, initialType, categories, bankAccounts }) => {
    
    const getInitialState = (): FinancialTransaction => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Ensure type is narrowed correctly from FinancialTransactionType to match what's expected
        const type = (transaction?.type || initialType || 'despesa') as FinancialTransactionType;

        return {
            id: transaction?.id || Date.now().toString(),
            owner_id: transaction?.owner_id || '',
            description: transaction?.description || '',
            amount: transaction?.amount || 0,
            type: type,
            dueDate: transaction?.dueDate || todayStr,
            launchDate: transaction?.launchDate || todayStr,
            categoryId: transaction?.categoryId || categories.find(c => c.type === type)?.id || '',
            bankId: transaction?.bankId || bankAccounts.find(b => b.active)?.id || '',
            status: transaction?.status || 'pendente' as FinancialTransactionStatus,
            paymentDate: transaction?.paymentDate || undefined,
            cancelReason: transaction?.cancelReason || undefined
        };
    };

    const [formState, setFormState] = useState<FinancialTransaction>(getInitialState());
    const [isRecurring, setIsRecurring] = useState(false);
    const [frequency, setFrequency] = useState<'mensal' | 'trimestral' | 'semestral' | 'anual'>('mensal');
    const [occurrences, setOccurrences] = useState(2);

    useEffect(() => {
        setFormState(getInitialState());
        setIsRecurring(false);
        setFrequency('mensal');
        setOccurrences(2);
    }, [transaction, initialType, isOpen, bankAccounts]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({...prev, [name]: name === 'amount' ? parseFloat(value) : value}));
    };

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newType = e.target.value as FinancialTransactionType;
        setFormState(prev => ({
            ...prev,
            type: newType,
            categoryId: categories.find(c => c.type === newType)?.id || '',
        }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(!formState.description || formState.amount < 0) {
            alert('Por favor, preencha a descrição e o valor.');
            return;
        }
        if(!formState.bankId) {
            alert('Por favor, selecione o banco para a movimentação.');
            return;
        }
        
        const recurrenceData = isRecurring && !transaction ? { frequency, occurrences } : undefined;
        onSave(formState, recurrenceData);
    };
    
    const filteredCategories = categories
        .filter(c => c.type === formState.type)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-950 p-3 text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/15 focus:border-indigo-600 transition-all shadow-sm placeholder:text-gray-400";
    const labelClasses = "flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 ml-1";
    
    const isTypeLocked = !!initialType && !transaction;
    const isCancelled = formState.status === 'cancelado';

    return (
        <Modal title={transaction ? (isCancelled ? 'Visualizar Cancelado' : 'Alterar lançamento') : 'Novo lançamento financeiro'} onClose={onClose} maxWidth="max-w-xl">
            {/* BANNER DE CANCELAMENTO */}
            {isCancelled && formState.cancelReason && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/50 p-4 rounded-2xl flex items-start gap-3 shadow-sm mb-6 animate-fade-in">
                    <div className="p-2 bg-red-600 text-white rounded-lg shrink-0">
                        <ExclamationTriangleIcon className="w-5 h-5" />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-red-700 dark:text-red-400 tracking-tight">Lançamento Cancelado</h4>
                        <p className="text-[11px] font-bold text-red-600 dark:text-red-500/80 mt-0.5 leading-relaxed">
                            Motivo: <span className="text-gray-800 dark:text-gray-100">{formState.cancelReason}</span>
                        </p>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 mb-8 bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-800 shadow-sm">
                <div className={`p-3.5 rounded-2xl shadow-xl ${formState.type === 'receita' ? 'bg-green-500' : formState.type === 'resultado' ? 'bg-indigo-500' : 'bg-red-500'} text-white`}>
                    {formState.type === 'receita' ? <ArrowUpIcon className="w-6 h-6" /> : formState.type === 'resultado' ? <TableIcon className="w-6 h-6" /> : <ArrowDownIcon className="w-6 h-6" />}
                </div>
                <div>
                    <h4 className="text-sm font-black text-gray-800 dark:text-white leading-none">
                        {transaction ? 'Informações do registro' : 'Cadastrando nova movimentação'}
                    </h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mt-1.5">
                        {isCancelled ? 'Este registro está inativo e não pode ser editado.' : 'Preencha os campos destacados abaixo para manter o caixa em dia.'}
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-5">
                    <div>
                        <label htmlFor="description" className={labelClasses}>
                            <ClipboardListIcon className="w-3.5 h-3.5" /> Descrição da transação
                        </label>
                        <input 
                            type="text" 
                            name="description" 
                            id="description" 
                            value={formState.description} 
                            onChange={handleInputChange} 
                            disabled={isCancelled}
                            required 
                            className={`${inputClasses} ${isCancelled ? 'opacity-70 grayscale' : ''}`} 
                            placeholder="Ex: Recebimento Projeto Solar - Cliente João" 
                        />
                    </div>

                    <div>
                        <label htmlFor="bankId" className={labelClasses}>
                            <TableIcon className="w-3.5 h-3.5" /> Banco / Conta destino
                        </label>
                        <select 
                            name="bankId" 
                            id="bankId" 
                            value={formState.bankId} 
                            onChange={handleInputChange} 
                            disabled={isCancelled}
                            required 
                            className={`${inputClasses} cursor-pointer ${isCancelled ? 'opacity-70 grayscale' : ''}`}
                        >
                            <option value="">Selecione a conta bancária...</option>
                            {bankAccounts.map(bank => (
                                <option key={bank.id} value={bank.id}>{bank.accountName}</option>
                            ))}
                        </select>
                    </div>
                     
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="amount" className={labelClasses}>
                                <DollarIcon className="w-3.5 h-3.5" /> Valor (R$)
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-black text-xs">R$</span>
                                <input 
                                    type="number" 
                                    name="amount" 
                                    id="amount" 
                                    value={formState.amount || ''} 
                                    onChange={handleInputChange} 
                                    disabled={isCancelled}
                                    required 
                                    step="0.01" 
                                    className={`${inputClasses} pl-10 text-indigo-700 dark:text-indigo-400 ${isCancelled ? 'opacity-70 grayscale' : ''}`} 
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="launchDate" className={labelClasses}>
                                <ClockIcon className="w-3.5 h-3.5" /> Data de lançamento
                            </label>
                            <input 
                                type="date" 
                                name="launchDate" 
                                id="launchDate" 
                                value={formState.launchDate || ''} 
                                disabled 
                                className={`${inputClasses} opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700`} 
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="dueDate" className={labelClasses}>
                                <CalendarIcon className="w-3.5 h-3.5" /> Data de vencimento
                            </label>
                            <input 
                                type="date" 
                                name="dueDate" 
                                id="dueDate" 
                                value={formState.dueDate} 
                                onChange={handleInputChange} 
                                disabled={isCancelled}
                                required 
                                className={`${inputClasses} ${isCancelled ? 'opacity-70 grayscale' : ''}`} 
                            />
                        </div>
                        <div>
                            <label htmlFor="status" className={labelClasses}>
                                <CheckCircleIcon className="w-3.5 h-3.5" /> Status atual
                            </label>
                            <select 
                                name="status" 
                                id="status" 
                                value={formState.status} 
                                onChange={handleInputChange} 
                                disabled={isCancelled}
                                className={`${inputClasses} cursor-pointer ${isCancelled ? 'opacity-70 grayscale bg-red-50/10' : ''}`}
                            >
                                <option value="pendente">Pendente</option>
                                <option value="pago">Realizado / Pago</option>
                                {isCancelled && <option value="cancelado">Cancelado</option>}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div className="relative">
                            <label htmlFor="type" className={labelClasses}>
                                <FilterIcon className="w-3.5 h-3.5" /> Tipo
                            </label>
                            <div className="relative">
                                <select 
                                    name="type" 
                                    id="type" 
                                    value={formState.type} 
                                    onChange={handleTypeChange} 
                                    disabled={isTypeLocked || isCancelled}
                                    className={`${inputClasses} cursor-pointer ${(isTypeLocked || isCancelled) ? 'bg-indigo-50 dark:bg-indigo-950/40 cursor-not-allowed border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-400' : ''}`}
                                >
                                    <option value="receita">Receita (+)</option>
                                    <option value="despesa">Despesa (-)</option>
                                    <option value="resultado">Resultado (±)</option>
                                </select>
                                {(isTypeLocked || isCancelled) && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 bg-indigo-600 text-white px-2.5 py-1 rounded-lg text-[9px] font-black shadow-sm">
                                        <LockClosedIcon className="w-2.5 h-2.5" /> Travado
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <label htmlFor="categoryId" className={labelClasses}>
                                <ClipboardListIcon className="w-3.5 h-3.5" /> Categoria
                            </label>
                            <select 
                                name="categoryId" 
                                id="categoryId" 
                                value={formState.categoryId} 
                                onChange={handleInputChange} 
                                disabled={isCancelled}
                                required 
                                className={`${inputClasses} cursor-pointer ${isCancelled ? 'opacity-70 grayscale' : ''}`}
                            >
                                <option value="" disabled>Selecione uma categoria...</option>
                                {filteredCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {!transaction && (
                    <div className={`p-5 rounded-2xl border-2 transition-all shadow-sm ${isRecurring ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-400 dark:border-indigo-700' : 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-800'}`}>
                        <label className="flex items-center cursor-pointer group">
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    id="isRecurring"
                                    checked={isRecurring}
                                    onChange={(e) => setIsRecurring(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:bg-indigo-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </div>
                            <div className="ml-4">
                                <p className="text-xs font-black text-gray-800 dark:text-gray-100 tracking-tight">Recorrência (parcelamento/fixos)</p>
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5">Deseja repetir este lançamento mensalmente?</p>
                            </div>
                        </label>

                        {isRecurring && !transaction && (
                            <div className="grid grid-cols-2 gap-5 animate-fade-in pt-6 mt-5 border-t border-indigo-200 dark:border-indigo-800">
                                <div>
                                    <label htmlFor="frequency" className={labelClasses}>Frequência</label>
                                    <select
                                        id="frequency"
                                        value={frequency}
                                        onChange={(e) => setFrequency(e.target.value as any)}
                                        className={inputClasses}
                                    >
                                        <option value="mensal">Mensal</option>
                                        <option value="trimestral">Trimestral</option>
                                        <option value="semestral">Semestral</option>
                                        <option value="anual">Anual</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="occurrences" className={labelClasses}>Quantidade</label>
                                    <input
                                        type="number"
                                        id="occurrences"
                                        min="2"
                                        max="60"
                                        value={occurrences}
                                        onChange={(e) => setOccurrences(parseInt(e.target.value) || 2)}
                                        className={inputClasses}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex gap-4 pt-4 border-t dark:border-gray-800">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-2xl font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                    >
                        {isCancelled ? 'Fechar' : 'Cancelar'}
                    </button>
                    {!isCancelled && (
                        <button 
                            type="submit" 
                            className="flex-[2] flex items-center justify-center gap-2 py-4 bg-indigo-600 text-white rounded-2xl font-bold text-sm shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-[0.98] transition-all"
                        >
                            <SaveIcon className="w-5 h-5" /> 
                            {transaction ? 'Confirmar alteração' : 'Efetivar lançamento'}
                        </button>
                    )}
                </div>
            </form>
        </Modal>
    );
};

const FilterIcon = ({ className }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
);

export default TransactionModal;
