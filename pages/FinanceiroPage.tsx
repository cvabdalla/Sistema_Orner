
import React, { useState, useEffect, useMemo } from 'react';
import { AddIcon, FilterIcon, CalendarIcon, TrashIcon, ClipboardListIcon, DocumentReportIcon, CreditCardIcon } from '../assets/icons';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory, FinancialTransactionType, FinanceiroPageProps, User } from '../types';
import { dataService } from '../services/dataService';

import VisaoGeral from '../components/Financeiro/VisaoGeral';
import ContasTable from '../components/Financeiro/ContasTable';
import TransactionModal from '../components/Financeiro/TransactionModal';
import DREView from '../components/Financeiro/DREView';
import CategoriasView from '../components/Financeiro/CategoriasView';
import OFXImportModal from '../components/Financeiro/OFXImportModal';
import CreditCardModal from '../components/Financeiro/CreditCardModal';
import Modal from '../components/Modal';

type FinanceiroTab = 'visaoGeral' | 'aReceber' | 'aPagar';
export type DrePeriodType = 'mensal' | 'trimestral' | 'semestral' | 'anual';

const FinanceiroPage: React.FC<FinanceiroPageProps> = ({ view, currentUser }) => {
    const [activeTab, setActiveTab] = useState<FinanceiroTab>('visaoGeral');
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isCreditCardModalOpen, setCreditCardModalOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dreYear, setDreYear] = useState(new Date().getFullYear());
    const [dreType, setDreType] = useState<DrePeriodType>('mensal');
    const [dreGroupCards, setDreGroupCards] = useState(true); // Novo estado para agrupamento
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);

    useEffect(() => {
        if (view !== 'dre') {
            const date = new Date();
            const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
            const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            const formatDate = (d: Date) => {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };
            setStartDate(formatDate(firstDay));
            setEndDate(formatDate(lastDay));
        }
    }, [view]);

    useEffect(() => {
        if (view === 'dre') {
            const start = `${dreYear}-01-01`;
            const end = `${dreYear}-12-31`;
            setStartDate(start);
            setEndDate(end);
        }
    }, [view, dreYear]);

    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            if (!currentUser) return;

            try {
                const txs = await dataService.getAll<FinancialTransaction>(
                    'financial_transactions',
                    currentUser.id,
                    currentUser.profileId === '00000000-0000-0000-0000-000000000001'
                );
                setTransactions(txs || []);

                const cats = await dataService.getAll<FinancialCategory>('financial_categories');
                setCategories(cats || []);
            } catch (error) {
                console.error("Erro ao carregar dados financeiros:", error);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [currentUser]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = t.dueDate ? t.dueDate.split('T')[0] : '';
            if (!txDate) return false;
            if (startDate && txDate < startDate) return false;
            if (endDate && txDate > endDate) return false;
            return true;
        });
    }, [transactions, startDate, endDate]);

    const handleOpenModal = (transaction?: FinancialTransaction) => {
        setEditingTransaction(transaction || null);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingTransaction(null);
        setModalOpen(false);
    };

    const handleImportTransactions = async (newTransactions: FinancialTransaction[]) => {
        if (!currentUser) return;
        const txsWithOwner = newTransactions.map(tx => ({ ...tx, owner_id: currentUser.id }));
        for (const tx of txsWithOwner) {
            await dataService.save('financial_transactions', tx);
        }
        setTransactions(prev => [...prev, ...txsWithOwner]);
    };

    const handleBatchSaveTransactions = async (newTransactions: FinancialTransaction[]) => {
        if (!currentUser) return;
        const txsWithOwner = newTransactions.map(tx => ({ ...tx, owner_id: currentUser.id }));
        
        setIsLoading(true);
        try {
            for (const tx of txsWithOwner) {
                await dataService.save('financial_transactions', tx);
            }
            setTransactions(prev => [...prev, ...txsWithOwner]);
            setCreditCardModalOpen(false);
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar faturas do cartão.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveTransaction = async (transaction: FinancialTransaction, recurrence?: { frequency: 'mensal' | 'trimestral' | 'semestral' | 'anual', occurrences: number }) => {
        if (!currentUser) return;
        const baseTx = { ...transaction, owner_id: currentUser.id };
        const transactionsToSave: FinancialTransaction[] = [];

        if (editingTransaction) {
            transactionsToSave.push(baseTx);
            setTransactions(prev => prev.map(t => t.id === baseTx.id ? baseTx : t));
        } else if (recurrence) {
            let monthsToAddPerStep = 0;
            switch(recurrence.frequency) {
                case 'mensal': monthsToAddPerStep = 1; break;
                case 'trimestral': monthsToAddPerStep = 3; break;
                case 'semestral': monthsToAddPerStep = 6; break;
                case 'anual': monthsToAddPerStep = 12; break;
            }

            const baseDateParts = baseTx.dueDate.split('-').map(Number);
            const baseDate = new Date(baseDateParts[0], baseDateParts[1] - 1, baseDateParts[2], 12, 0, 0);

            for (let i = 0; i < recurrence.occurrences; i++) {
                const nextDate = new Date(baseDate);
                nextDate.setMonth(baseDate.getMonth() + (i * monthsToAddPerStep));
                const y = nextDate.getFullYear();
                const m = String(nextDate.getMonth() + 1).padStart(2, '0');
                const d = String(nextDate.getDate()).padStart(2, '0');
                const formattedDate = `${y}-${m}-${d}`;
                const suffix = i > 0 ? ` (${i + 1}/${recurrence.occurrences})` : ` (1/${recurrence.occurrences})`;

                transactionsToSave.push({
                    ...baseTx,
                    id: i === 0 ? baseTx.id : `${baseTx.id}-${i}`,
                    description: `${baseTx.description}${suffix}`,
                    dueDate: formattedDate,
                    status: i === 0 ? baseTx.status : 'pendente',
                    paymentDate: (i === 0 && baseTx.status === 'pago') ? baseTx.paymentDate : undefined
                });
            }
            setTransactions(prev => [...prev, ...transactionsToSave]);
        } else {
            transactionsToSave.push(baseTx);
            setTransactions(prev => [...prev, baseTx]);
        }

        for (const tx of transactionsToSave) {
            await dataService.save('financial_transactions', tx);
        }
        handleCloseModal();
    };
    
    const handleDeleteTransaction = (id: string) => {
        setTransactionToDeleteId(id);
        setDeleteModalOpen(true);
    }

    const confirmDeleteTransaction = async () => {
        if (transactionToDeleteId) {
            const isDueGroup = transactionToDeleteId.startsWith('due_group_');
            
            if (isDueGroup) {
                // BUG FIX: Parse correto do ID composto (Ex: due_group_2023-10-10_pendente)
                const groupKey = transactionToDeleteId.replace('due_group_', '');
                const parts = groupKey.split('_');
                const dueDate = parts[0];
                const originalStatus = parts[1];
                
                const groupItems = transactions.filter(t => 
                    t.description.includes('[Cartão:') && 
                    t.dueDate === dueDate && 
                    t.status === originalStatus
                );

                for (const item of groupItems) {
                    await dataService.delete('financial_transactions', item.id);
                }
                setTransactions(prev => prev.filter(t => !groupItems.some(gi => gi.id === t.id)));
            } else {
                await dataService.delete('financial_transactions', transactionToDeleteId);
                setTransactions(prev => prev.filter(t => t.id !== transactionToDeleteId));
            }
            
            setTransactionToDeleteId(null);
            setDeleteModalOpen(false);
        }
    }

    const handleStatusChange = async (id: string, status: FinancialTransactionStatus) => {
        const isDueGroup = id.startsWith('due_group_');
        const paymentDate = status === 'pago' ? new Date().toISOString().split('T')[0] : undefined;

        if (isDueGroup) {
            // BUG FIX: Parse correto do ID composto (Ex: due_group_2023-10-10_pendente)
            const groupKey = id.replace('due_group_', '');
            const parts = groupKey.split('_');
            const dueDate = parts[0];
            const originalStatus = parts[1];

            const groupItems = transactions.filter(t => 
                t.description.includes('[Cartão:') && 
                t.dueDate === dueDate && 
                t.status === originalStatus
            );
            
            const itemIds = groupItems.map(i => i.id);
            setTransactions(prev => prev.map(t => itemIds.includes(t.id) ? { ...t, status, paymentDate } : t));
            
            for (const item of groupItems) {
                await dataService.save('financial_transactions', { ...item, status, paymentDate });
            }
        } else {
            const tx = transactions.find(t => t.id === id);
            if (tx) {
                const updatedTx = { ...tx, status, paymentDate };
                setTransactions(prev => prev.map(t => t.id === id ? updatedTx : t));
                await dataService.save('financial_transactions', updatedTx);
            }
        }
    };

    const handleAddCategory = async (name: string, type: FinancialTransactionType) => {
        const newCategory: FinancialCategory = {
            id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
            name,
            type
        };
        await dataService.save('financial_categories', newCategory);
        setCategories(prev => [...prev, newCategory]);
    };

    const handleUpdateCategory = async (id: string, newName: string) => {
        const category = categories.find(c => c.id === id);
        if (!category) return;

        const updatedCategory = { ...category, name: newName };
        setCategories(prev => prev.map(c => c.id === id ? updatedCategory : c));
        await dataService.save('financial_categories', updatedCategory);
    };

    const handleDeleteCategory = async (id: string) => {
        const isUsed = transactions.some(t => t.categoryId === id);
        if (isUsed) {
            alert("Categoria em uso por transações existentes.");
            return;
        }
        await dataService.delete('financial_categories', id);
        setCategories(prev => prev.filter(c => c.id !== id));
    };

    const TabButton: React.FC<{tabId: FinanceiroTab, label: string}> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-bold rounded-md transition-colors ${
                activeTab === tabId ? 'bg-indigo-600 text-white shadow' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    if (view === 'categorias') {
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                     <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3"><ClipboardListIcon className="w-8 h-8 text-indigo-600" /> Gestão de categorias</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Organize suas receitas e despesas.</p>
                    </div>
                </div>
                <CategoriasView 
                    categories={categories} 
                    onAddCategory={handleAddCategory} 
                    onUpdateCategory={handleUpdateCategory}
                    onDeleteCategory={handleDeleteCategory} 
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {view === 'dashboard' ? (
                    <div className="bg-white dark:bg-gray-800 p-1.5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-1 sm:gap-2">
                        <TabButton tabId="visaoGeral" label="Visão geral" />
                        <TabButton tabId="aReceber" label="A receber" />
                        <TabButton tabId="aPagar" label="A pagar" />
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-indigo-600 dark:text-indigo-400"><DocumentReportIcon className="w-6 h-6" /></div>
                        <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">DRE gerencial</h2><p className="text-sm text-gray-500 dark:text-gray-400">Demonstrativo de resultado</p></div>
                    </div>
                )}
                
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {view === 'dre' ? (
                        <div className="flex items-center gap-4">
                             <label className="flex items-center gap-2 cursor-pointer group bg-white dark:bg-gray-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:border-indigo-300 transition-colors">
                                <div className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        className="sr-only peer" 
                                        checked={dreGroupCards}
                                        onChange={() => setDreGroupCards(!dreGroupCards)}
                                    />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                                </div>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300 select-none">Agrupar gastos de cartão</span>
                             </label>

                             <select value={dreYear} onChange={(e) => setDreYear(Number(e.target.value))} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold">
                                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                             </select>
                             <select value={dreType} onChange={(e) => setDreType(e.target.value as any)} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 text-xs font-bold">
                                <option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option>
                             </select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm">
                            <CalendarIcon className="w-4 h-4 ml-2 text-gray-400" />
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer" />
                            <span className="text-gray-400">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer" />
                        </div>
                    )}

                    {view !== 'dre' && (
                        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 font-bold text-sm ml-auto lg:ml-0 transition-all active:scale-95"><AddIcon className="w-5 h-5" /><span className="hidden sm:inline">Nova transação</span></button>
                    )}
                </div>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div>
                    {view === 'dre' ? (
                         <DREView transactions={filteredTransactions.filter(t => t.status === 'pago')} categories={categories} periodType={dreType} groupCards={dreGroupCards} />
                    ) : (
                        activeTab === 'visaoGeral' ? (
                            <VisaoGeral 
                                transactions={filteredTransactions} 
                                onOpenImport={() => setImportModalOpen(true)} 
                                onOpenCreditCard={() => setCreditCardModalOpen(true)}
                            />
                        ) : (
                            <ContasTable
                                title={activeTab === 'aReceber' ? "Contas a receber" : "Contas a pagar"}
                                transactions={activeTab === 'aReceber' ? filteredTransactions.filter(t => t.type === 'receita') : filteredTransactions.filter(t => t.type === 'despesa')}
                                categories={categories}
                                onEdit={handleOpenModal}
                                onDelete={handleDeleteTransaction}
                                onStatusChange={handleStatusChange}
                            />
                        )
                    )}
                </div>
            )}

            {isModalOpen && <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveTransaction} transaction={editingTransaction} categories={categories} />}
            {isImportModalOpen && <OFXImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleImportTransactions} categories={categories} />}
            {isCreditCardModalOpen && <CreditCardModal isOpen={isCreditCardModalOpen} onClose={() => setCreditCardModalOpen(false)} onSave={handleBatchSaveTransactions} categories={categories} ownerId={currentUser.id} />}
            
            {isDeleteModalOpen && (
                <Modal title="Confirmar exclusão" onClose={() => setDeleteModalOpen(false)}>
                    <div className="space-y-6 text-center p-4">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 mb-4"><TrashIcon className="w-8 h-8 text-red-600" /></div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deseja excluir este lançamento?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {transactionToDeleteId?.startsWith('due_group_') ? 'Isso removerá a fatura consolidada e todos os gastos de cartões desse vencimento.' : 'Esta ação não poderá ser desfeita.'}
                            </p>
                        </div>
                        <div className="flex justify-center gap-3 pt-4">
                            <button onClick={() => setDeleteModalOpen(false)} className="flex-1 px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs">Não, cancelar</button>
                            <button onClick={confirmDeleteTransaction} className="flex-1 px-6 py-2.5 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 hover:bg-red-700">Sim, excluir</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FinanceiroPage;
