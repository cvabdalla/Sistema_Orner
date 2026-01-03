
import React, { useState, useEffect, useMemo } from 'react';
import { AddIcon, FilterIcon, CalendarIcon, TrashIcon, ClipboardListIcon, DocumentReportIcon } from '../assets/icons';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory, FinancialTransactionType, FinanceiroPageProps, User } from '../types';
import { dataService } from '../services/dataService';

import VisaoGeral from '../components/Financeiro/VisaoGeral';
import ContasTable from '../components/Financeiro/ContasTable';
import TransactionModal from '../components/Financeiro/TransactionModal';
import DREView from '../components/Financeiro/DREView';
import CategoriasView from '../components/Financeiro/CategoriasView';
import OFXImportModal from '../components/Financeiro/OFXImportModal';
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
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dreYear, setDreYear] = useState(new Date().getFullYear());
    const [dreType, setDreType] = useState<DrePeriodType>('mensal');
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [transactionToDeleteId, setTransactionToDeleteId] = useState<string | null>(null);
    const [isDeleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
    const [isCategoryInUseModalOpen, setCategoryInUseModalOpen] = useState(false);
    const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

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
            await dataService.delete('financial_transactions', transactionToDeleteId);
            setTransactions(prev => prev.filter(t => t.id !== transactionToDeleteId));
            setTransactionToDeleteId(null);
            setDeleteModalOpen(false);
        }
    }

    const handleStatusChange = async (id: string, status: FinancialTransactionStatus) => {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
            const updatedTx = { 
                ...tx, 
                status, 
                paymentDate: status === 'pago' ? new Date().toISOString().split('T')[0] : undefined 
            };
            setTransactions(prev => prev.map(t => t.id === id ? updatedTx : t));
            await dataService.save('financial_transactions', updatedTx);
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
            setCategoryInUseModalOpen(true);
            return;
        }
        setCategoryToDeleteId(id);
        setDeleteCategoryModalOpen(true);
    };

    const confirmDeleteCategory = async () => {
        if (categoryToDeleteId) {
            await dataService.delete('financial_categories', categoryToDeleteId);
            setCategories(prev => prev.filter(c => c.id !== categoryToDeleteId));
            setCategoryToDeleteId(null);
            setDeleteCategoryModalOpen(false);
        }
    }

    const TabButton: React.FC<{tabId: FinanceiroTab, label: string}> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tabId ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
        >
            {label}
        </button>
    );

    if (view === 'categorias') {
        return (
            <div className="space-y-6">
                 <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                     <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3"><ClipboardListIcon className="w-8 h-8 text-indigo-600" /> Gestão de Categorias</h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">Adicione, edite ou remova categorias para organizar suas receitas e despesas.</p>
                    </div>
                </div>
                <CategoriasView 
                    categories={categories} 
                    onAddCategory={handleAddCategory} 
                    onUpdateCategory={handleUpdateCategory}
                    onDeleteCategory={handleDeleteCategory} 
                />
                 {isDeleteCategoryModalOpen && (
                    <Modal title="Confirmar Exclusão" onClose={() => setDeleteCategoryModalOpen(false)}>
                        <div className="space-y-6">
                            <div className="text-center">
                                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"><TrashIcon className="w-6 h-6 text-red-600" /></div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Tem certeza que deseja excluir esta categoria?</h3>
                            </div>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setDeleteCategoryModalOpen(false)} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 w-24">Não</button>
                                <button onClick={confirmDeleteCategory} className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 w-24">Sim</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {view === 'dashboard' ? (
                    <div className="bg-white dark:bg-gray-800 p-1.5 rounded-lg shadow-sm flex flex-wrap items-center gap-1 sm:gap-2">
                        <TabButton tabId="visaoGeral" label="Visão Geral" />
                        <TabButton tabId="aReceber" label="A Receber" />
                        <TabButton tabId="aPagar" label="A Pagar" />
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg text-indigo-600 dark:text-indigo-400"><DocumentReportIcon className="w-6 h-6" /></div>
                        <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">DRE Gerencial</h2><p className="text-sm text-gray-500 dark:text-gray-400">Demonstrativo de Resultado do Exercício</p></div>
                    </div>
                )}
                
                <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
                    {view === 'dre' ? (
                        <div className="flex gap-2">
                             <select value={dreYear} onChange={(e) => setDreYear(Number(e.target.value))} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-1.5 text-sm">
                                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                             </select>
                             <select value={dreType} onChange={(e) => setDreType(e.target.value as any)} className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md p-1.5 text-sm">
                                <option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option>
                             </select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1.5 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                            <CalendarIcon className="w-5 h-5 ml-2 text-gray-400" />
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer" />
                            <span className="text-gray-400">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer" />
                        </div>
                    )}

                    {view !== 'dre' && (
                        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 shadow ml-auto lg:ml-0"><AddIcon className="w-5 h-5" /><span className="hidden sm:inline">Nova Transação</span></button>
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
                         <DREView transactions={filteredTransactions.filter(t => t.status === 'pago')} categories={categories} periodType={dreType} />
                    ) : (
                        activeTab === 'visaoGeral' ? <VisaoGeral transactions={filteredTransactions} onOpenImport={() => setImportModalOpen(true)} /> :
                        <ContasTable
                            title={activeTab === 'aReceber' ? "Contas a Receber" : "Contas a Pagar"}
                            transactions={activeTab === 'aReceber' ? filteredTransactions.filter(t => t.type === 'receita') : filteredTransactions.filter(t => t.type === 'despesa')}
                            categories={categories}
                            onEdit={handleOpenModal}
                            onDelete={handleDeleteTransaction}
                            onStatusChange={handleStatusChange}
                        />
                    )}
                </div>
            )}

            {isModalOpen && <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveTransaction} transaction={editingTransaction} categories={categories} />}
            {isImportModalOpen && <OFXImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleImportTransactions} categories={categories} />}
            {isDeleteModalOpen && (
                <Modal title="Confirmar Exclusão" onClose={() => setDeleteModalOpen(false)}>
                    <div className="space-y-6 text-center">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"><TrashIcon className="w-6 h-6 text-red-600" /></div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Deseja excluir esta transação?</h3>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDeleteModalOpen(false)} className="px-6 py-2 bg-gray-200 dark:bg-gray-700 rounded-md w-24">Não</button>
                            <button onClick={confirmDeleteTransaction} className="px-6 py-2 bg-red-600 text-white rounded-md w-24">Sim</button>
                        </div>
                    </div>
                </Modal>
            )}
            {isCategoryInUseModalOpen && (
                <Modal title="Categoria em Uso" onClose={() => setCategoryInUseModalOpen(false)}>
                    <div className="p-4 text-center">
                        <p className="text-gray-600 dark:text-gray-400">Não é possível excluir esta categoria porque existem transações vinculadas a ela.</p>
                        <button onClick={() => setCategoryInUseModalOpen(false)} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-md">Entendido</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FinanceiroPage;
