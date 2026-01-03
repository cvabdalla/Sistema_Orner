
import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import type { FinancialTransaction, FinancialCategory, FinancialTransactionType, FinancialTransactionStatus } from '../../types';

interface TransactionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (transaction: FinancialTransaction, recurrence?: { frequency: 'mensal' | 'trimestral' | 'semestral' | 'anual', occurrences: number }) => void;
    transaction: FinancialTransaction | null;
    categories: FinancialCategory[];
}

const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, transaction, categories }) => {
    
    const getInitialState = (): FinancialTransaction => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        return {
            id: transaction?.id || Date.now().toString(),
            owner_id: transaction?.owner_id || '',
            description: transaction?.description || '',
            amount: transaction?.amount || 0,
            type: transaction?.type || 'despesa' as FinancialTransactionType,
            dueDate: transaction?.dueDate || todayStr,
            launchDate: transaction?.launchDate || todayStr,
            categoryId: transaction?.categoryId || categories.find(c => c.type === (transaction?.type || 'despesa'))?.id || '',
            status: transaction?.status || 'pendente' as FinancialTransactionStatus,
            paymentDate: transaction?.paymentDate || undefined,
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
    }, [transaction, isOpen]);

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
        
        const recurrenceData = isRecurring && !transaction ? { frequency, occurrences } : undefined;
        onSave(formState, recurrenceData);
    };
    
    // Filtra e ordena as categorias alfabeticamente
    const filteredCategories = categories
        .filter(c => c.type === formState.type)
        .sort((a, b) => a.name.localeCompare(b.name));

    if (!isOpen) return null;

    const inputClasses = "mt-1 block w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2.5 text-sm font-medium text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all";
    const labelClasses = "block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-0.5";

    return (
        <Modal title={transaction ? 'Editar Transação' : 'Nova Transação'} onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label htmlFor="description" className={labelClasses}>Descrição</label>
                    <input type="text" name="description" id="description" value={formState.description} onChange={handleInputChange} required className={inputClasses} placeholder="Ex: Conta de Luz" />
                </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label htmlFor="amount" className={labelClasses}>Valor</label>
                        <input type="number" name="amount" id="amount" value={formState.amount} onChange={handleInputChange} required step="0.01" className={inputClasses} />
                    </div>
                    <div>
                        <label htmlFor="launchDate" className={labelClasses}>Data Lançamento</label>
                        <input 
                            type="date" 
                            name="launchDate" 
                            id="launchDate" 
                            value={formState.launchDate || ''} 
                            disabled 
                            className={`${inputClasses} opacity-60 cursor-not-allowed`} 
                        />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="dueDate" className={labelClasses}>Data Vencimento</label>
                        <input type="date" name="dueDate" id="dueDate" value={formState.dueDate} onChange={handleInputChange} required className={inputClasses} />
                    </div>
                     <div>
                        <label htmlFor="status" className={labelClasses}>Status</label>
                        <select name="status" id="status" value={formState.status} onChange={handleInputChange} className={inputClasses}>
                            <option value="pendente">Pendente</option>
                            <option value="pago">Pago</option>
                        </select>
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="type" className={labelClasses}>Tipo</label>
                        <select name="type" id="type" value={formState.type} onChange={handleTypeChange} className={inputClasses}>
                            <option value="receita">Receita</option>
                            <option value="despesa">Despesa</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="categoryId" className={labelClasses}>Categoria</label>
                        <select name="categoryId" id="categoryId" value={formState.categoryId} onChange={handleInputChange} required className={inputClasses}>
                            <option value="" disabled>Selecione...</option>
                            {filteredCategories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-600 space-y-3">
                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="isRecurring"
                            checked={isRecurring}
                            onChange={(e) => setIsRecurring(e.target.checked)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isRecurring" className="ml-2 block text-sm font-bold text-gray-700 dark:text-gray-300">
                            Repetir lançamento?
                        </label>
                    </div>

                    {isRecurring && !transaction && (
                        <div className="grid grid-cols-2 gap-4 animate-fade-in pt-2">
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
                                <label htmlFor="occurrences" className={labelClasses}>Ocorrências</label>
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

                <div className="flex justify-end gap-3 pt-6">
                    <button 
                        type="button" 
                        onClick={onClose} 
                        className="px-6 py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-bold text-sm hover:bg-gray-300 transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                    >
                        Salvar
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default TransactionModal;
