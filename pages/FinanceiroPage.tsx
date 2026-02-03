
import React, { useState, useEffect, useMemo } from 'react';
import { AddIcon, FilterIcon, CalendarIcon, TrashIcon, ClipboardListIcon, DocumentReportIcon, ExclamationTriangleIcon, CreditCardIcon, XCircleIcon, TableIcon } from '../assets/icons';
import type { FinancialTransaction, FinancialTransactionStatus, FinancialCategory, FinancialTransactionType, FinanceiroPageProps, User, ExpenseReport, BankAccount } from '../types';
import { dataService } from '../services/dataService';

import VisaoGeral from '../components/Financeiro/VisaoGeral';
import ContasTable from '../components/Financeiro/ContasTable';
import TransactionModal from '../components/Financeiro/TransactionModal';
import DREView from '../components/Financeiro/DREView';
import CategoriasView from '../components/Financeiro/CategoriasView';
import BancosView from '../components/Financeiro/BancosView';
import OFXImportModal from '../components/Financeiro/OFXImportModal';
import CreditCardModal from '../components/Financeiro/CreditCardModal';
import Modal from '../components/Modal';

type FinanceiroTab = 'visaoGeral' | 'aReceber' | 'aPagar' | 'cancelados';
export type DrePeriodType = 'mensal' | 'trimestral' | 'semestral' | 'anual';

const FinanceiroPage: React.FC<FinanceiroPageProps> = ({ view, currentUser }) => {
    const [activeTab, setActiveTab] = useState<FinanceiroTab>('visaoGeral');
    const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);
    const [forcedModalType, setForcedModalType] = useState<FinancialTransactionType | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isCreditCardModalOpen, setCreditCardModalOpen] = useState(false);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [dreYear, setDreYear] = useState(new Date().getFullYear());
    const [dreType, setDreType] = useState<DrePeriodType>('mensal');
    const [isCCGrouped, setIsCCGrouped] = useState(true);
    const [isGroupedByManagerial, setIsGroupedByManagerial] = useState(false);
    const [selectedBankFilter, setSelectedBankFilter] = useState('all');

    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
    const [transactionToCancelId, setTransactionToCancelId] = useState<string | null>(null);
    const [cancelReason, setCancelReason] = useState('');

    const [isDeleteCategoryModalOpen, setDeleteCategoryModalOpen] = useState(false);
    const [isCategoryInUseModalOpen, setCategoryInUseModalOpen] = useState(false);
    const [categoryToDeleteId, setCategoryToDeleteId] = useState<string | null>(null);

    const ADMIN_PROFILE_ID = '001';

    // Hook para gerenciar as datas automáticas por aba
    useEffect(() => {
        if (view !== 'dre' && view !== 'bancos') {
            const now = new Date();
            const year = now.getFullYear();
            const month = now.getMonth();
            
            const formatDate = (d: Date) => {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${y}-${m}-${day}`;
            };

            const lastDayOfMonth = new Date(year, month + 1, 0);

            if (activeTab === 'visaoGeral') {
                // Início do ano até fim do mês vigente
                setStartDate(`${year}-01-01`);
                setEndDate(formatDate(lastDayOfMonth));
            } else {
                // Início do mês vigente até fim do mês vigente
                const firstDayOfMonth = new Date(year, month, 1);
                setStartDate(formatDate(firstDayOfMonth));
                setEndDate(formatDate(lastDayOfMonth));
            }
        }
    }, [view, activeTab]);

    useEffect(() => {
        if (view === 'dre') {
            const start = `${dreYear}-01-01`;
            const end = `${dreYear}-12-31`;
            setStartDate(start);
            setEndDate(end);
        }
    }, [view, dreYear]);

    const loadData = async () => {
        setIsLoading(true);
        if (!currentUser) return;

        try {
            const isAdmin = currentUser.profileId === ADMIN_PROFILE_ID;
            const [txs, cats, banks] = await Promise.all([
                dataService.getAll<FinancialTransaction>('financial_transactions', currentUser.id, isAdmin),
                dataService.getAll<FinancialCategory>('financial_categories'),
                dataService.getAll<BankAccount>('bank_accounts', currentUser.id, isAdmin)
            ]);
            setTransactions(txs || []);
            setCategories(cats || []);
            setBankAccounts(banks || []);
        } catch (error) {
            console.error("Erro ao carregar dados financeiros:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser]);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const txDate = t.dueDate ? t.dueDate.split('T')[0] : '';
            if (!txDate) return false;
            if (startDate && txDate < startDate) return false;
            if (endDate && txDate > endDate) return false;
            if (selectedBankFilter !== 'all' && t.bankId !== selectedBankFilter) return false;
            return true;
        });
    }, [transactions, startDate, endDate, selectedBankFilter]);

    const handleOpenModal = (transaction?: FinancialTransaction, initialType?: FinancialTransactionType) => {
        setEditingTransaction(transaction || null);
        setForcedModalType(initialType);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setEditingTransaction(null);
        setForcedModalType(undefined);
        setModalOpen(false);
    };

    const handleBatchSaveTransactions = async (newTransactions: FinancialTransaction[]) => {
        if (!currentUser) return;
        const txsWithOwner = newTransactions.map(tx => ({ ...tx, owner_id: currentUser.id }));
        
        try {
            await dataService.saveAll('financial_transactions', txsWithOwner);
            await loadData();
            setCreditCardModalOpen(false);
            setActiveTab('aPagar');
            alert(`${newTransactions.length} lançamentos realizados com sucesso!`);
        } catch (e) {
            console.error(e);
            alert("Erro ao processar salvamento da fatura.");
        }
    };

    const handleSaveTransaction = async (transaction: FinancialTransaction, recurrence?: { frequency: 'mensal' | 'trimestral' | 'semestral' | 'anual', occurrences: number }) => {
        if (!currentUser) return;
        const baseTx = { ...transaction, owner_id: transaction.owner_id || currentUser.id };
        const transactionsToSave: FinancialTransaction[] = [];

        if (editingTransaction) {
            transactionsToSave.push(baseTx);
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
                    id: i === 0 ? baseTx.id : `rec-${Date.now()}-${i}`,
                    description: `${baseTx.description}${suffix}`,
                    dueDate: formattedDate,
                    status: i === 0 ? baseTx.status : 'pendente',
                    paymentDate: (i === 0 && baseTx.status === 'pago') ? baseTx.paymentDate : undefined
                });
            }
        } else {
            transactionsToSave.push(baseTx);
        }

        try {
            await dataService.saveAll('financial_transactions', transactionsToSave);
            
            // Sincronização de status com relatórios de reembolso ao salvar via modal
            for (const tx of transactionsToSave) {
                if (tx.status === 'pago') {
                    await syncReportStatus(tx.id, tx.relatedReportId);
                }
            }
            
            await loadData();
            handleCloseModal();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar transação.");
        }
    };
    
    const handleCancelRequest = (id: string) => {
        setTransactionToCancelId(id);
        setCancelReason('');
        setIsCancelModalOpen(true);
    };

    const confirmCancelTransaction = async () => {
        if (!transactionToCancelId || !cancelReason.trim()) {
            alert("Por favor, informe o motivo do cancelamento.");
            return;
        }

        const tx = transactions.find(t => t.id === transactionToCancelId);
        if (tx) {
            const updatedTx = { 
                ...tx, 
                status: 'cancelado' as FinancialTransactionStatus, 
                cancelReason: cancelReason 
            };
            try {
                await dataService.save('financial_transactions', updatedTx);
                
                // Se for um reembolso cancelado no financeiro, reflete no relatório
                const reportId = tx.relatedReportId || (tx.id.startsWith('tx-reemb-') ? tx.id.replace('tx-reemb-', '') : null);
                
                if (reportId) {
                    const allReports = await dataService.getAll<ExpenseReport>('expense_reports');
                    const report = allReports.find(r => r.id === reportId);
                    if (report) {
                        await dataService.save('expense_reports', { 
                            ...report, 
                            status: 'Cancelado',
                            cancelReason: `Cancelado via Financeiro: ${cancelReason}`
                        });
                    }
                }
                await loadData();
                setIsCancelModalOpen(false);
                setTransactionToCancelId(null);
                setCancelReason('');
            } catch (e) {
                console.error(e);
                alert("Erro ao cancelar transação.");
            }
        }
    };

    const syncReportStatus = async (txId: string, relatedReportId?: string) => {
        const reportId = relatedReportId || (txId.startsWith('tx-reemb-') ? txId.replace('tx-reemb-', '') : null);
        if (!reportId) return;
        try {
            const allReports = await dataService.getAll<ExpenseReport>('expense_reports');
            const report = allReports.find(r => r.id === reportId);
            if (!report) return;
            if (report.isInstallmentWash) {
                const allTxs = await dataService.getAll<FinancialTransaction>('financial_transactions');
                const relatedTxs = allTxs.filter(t => t.relatedReportId === reportId);
                const allPaid = relatedTxs.every(t => t.id === txId || t.status === 'pago');
                if (allPaid) {
                    await dataService.save('expense_reports', { ...report, status: 'Pago' });
                }
            } else {
                await dataService.save('expense_reports', { ...report, status: 'Pago' });
            }
        } catch (e) {
            console.warn("[SYNC] Falha ao sincronizar status do relatório:", e);
        }
    };

    const handleStatusChange = async (id: string, status: FinancialTransactionStatus) => {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
            const updatedTx = { 
                ...tx, 
                status, 
                paymentDate: status === 'pago' ? new Date().toISOString().split('T')[0] : undefined 
            };
            setTransactions(prev => prev.map(t => t.id === id ? updatedTx : t));
            try {
                await dataService.save('financial_transactions', updatedTx);
                if (status === 'pago') {
                    await syncReportStatus(id, tx.relatedReportId);
                }
            } catch (e) {
                console.error("Erro ao atualizar status:", e);
                loadData(); 
            }
        }
    };

    const handleAddCategory = async (data: Partial<FinancialCategory>) => {
        if (!data.name || !data.type) return;
        const newCategory: FinancialCategory = {
            id: data.name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
            name: data.name,
            type: data.type,
            classification: data.classification || (data.type === 'receita' ? 'RECEITA_VENDA' : 'DESPESA_OPERACIONAL'),
            group: data.group,
            showInDre: data.showInDre ?? true,
            active: data.active ?? true
        };
        await dataService.save('financial_categories', newCategory);
        setCategories(prev => [...prev, newCategory]);
    };

    const handleUpdateCategory = async (id: string, data: Partial<FinancialCategory>) => {
        const category = categories.find(c => c.id === id);
        if (!category) return;
        const updatedCategory = { ...category, ...data };
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
    };

    const TabButton: React.FC<{tabId: FinanceiroTab, label: string}> = ({ tabId, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeTab === tabId ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
        >
            {label}
        </button>
    );

    if (view === 'categorias') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3"><ClipboardListIcon className="w-8 h-8 text-indigo-600" /> Gestão de categorias</h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-semibold tracking-wide">Organize suas receitas e despesas por grupo.</p>
                    </div>
                </div>
                <CategoriasView 
                    categories={categories} 
                    onAddCategory={handleAddCategory} 
                    onUpdateCategory={handleUpdateCategory}
                    onDeleteCategory={handleDeleteCategory} 
                />
                {isDeleteCategoryModalOpen && (
                    <Modal title="Confirmar exclusão" onClose={() => setDeleteCategoryModalOpen(false)}>
                        <div className="space-y-6 text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4"><TrashIcon className="w-6 h-6 text-red-600" /></div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Deseja remover esta categoria permanentemente?</h3>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => setDeleteCategoryModalOpen(false)} className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-xs font-bold w-24">Não</button>
                                <button onClick={confirmDeleteCategory} className="px-6 py-2 bg-red-600 text-white rounded-lg text-xs font-bold w-24 shadow-lg shadow-red-600/20">Sim</button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    if (view === 'bancos') {
        return <BancosView currentUser={currentUser} />;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {view === 'dashboard' ? (
                    <div className="bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-wrap items-center gap-1 sm:gap-2">
                        <TabButton tabId="visaoGeral" label="Visão Geral" />
                        <TabButton tabId="aReceber" label="A Receber" />
                        <TabButton tabId="aPagar" label="A Pagar" />
                        <TabButton tabId="cancelados" label="Cancelados" />
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm"><DocumentReportIcon className="w-7 h-7" /></div>
                        <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">DRE gerencial</h2><p className="text-[12px] text-gray-500 dark:text-gray-400 font-semibold tracking-tight">Demonstrativo de resultado</p></div>
                    </div>
                )}
                
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    {view === 'dre' && (
                        <div className="flex flex-wrap items-center gap-3 ml-auto">
                             <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 h-11 shadow-sm">
                                <TableIcon className="w-4 h-4 text-gray-400" />
                                <select 
                                    value={selectedBankFilter} 
                                    onChange={(e) => setSelectedBankFilter(e.target.value)} 
                                    className="bg-transparent text-xs font-bold shadow-none outline-none focus:ring-0 border-none pr-8 py-0"
                                >
                                    <option value="all">Todos os bancos</option>
                                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.accountName}</option>)}
                                </select>
                             </div>

                             <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-1.5 px-4 shadow-sm h-11">
                                <button 
                                    onClick={() => setIsGroupedByManagerial(!isGroupedByManagerial)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isGroupedByManagerial ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isGroupedByManagerial ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Agrupar por grupo gerencial</span>
                             </div>

                             <div className="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl p-1.5 px-4 shadow-sm h-11">
                                <button 
                                    onClick={() => setIsCCGrouped(!isCCGrouped)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isCCGrouped ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCCGrouped ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Agrupar gastos de cartão</span>
                             </div>
                             
                             <select 
                                value={dreYear} 
                                onChange={(e) => setDreYear(Number(e.target.value))} 
                                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 h-11 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                             >
                                {[2023, 2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                             </select>

                             <select 
                                value={dreType} 
                                onChange={(e) => setDreType(e.target.value as any)} 
                                className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl px-4 h-11 text-xs font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                             >
                                <option value="mensal">Mensal</option>
                                <option value="trimestral">Trimestral</option>
                                <option value="semestral">Semestral</option>
                                <option value="anual">Anual</option>
                             </select>
                        </div>
                    )}

                    {view !== 'dre' && (
                        <div className="flex items-center gap-2">
                             <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <TableIcon className="w-4 h-4 ml-2 text-gray-400" />
                                <select 
                                    value={selectedBankFilter} 
                                    onChange={(e) => setSelectedBankFilter(e.target.value)} 
                                    className="bg-transparent border-none text-[11px] font-bold text-gray-600 dark:text-gray-200 focus:ring-0 p-1.5 cursor-pointer"
                                >
                                    <option value="all">Todos os bancos</option>
                                    {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.accountName}</option>)}
                                </select>
                             </div>

                            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                                <CalendarIcon className="w-4 h-4 ml-2 text-gray-400" />
                                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer w-full sm:w-auto" />
                                <span className="text-gray-400">-</span>
                                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer w-full sm:w-auto" />
                            </div>
                            <button onClick={() => handleOpenModal(undefined, activeTab === 'aReceber' ? 'receita' : activeTab === 'aPagar' ? 'despesa' : undefined)} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 font-bold text-xs transition-all active:scale-95"><AddIcon className="w-5 h-5" /><span className="hidden sm:inline">Nova transação</span></button>
                        </div>
                    )}
                </div>
            </div>
            
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="animate-fade-in">
                    {view === 'dre' ? (
                         <DREView 
                            transactions={filteredTransactions.filter(t => t.status === 'pago')} 
                            categories={categories} 
                            periodType={dreType}
                            isCCGrouped={isCCGrouped}
                            isGroupedByManagerial={isGroupedByManagerial}
                        />
                    ) : (
                        activeTab === 'visaoGeral' ? (
                            <VisaoGeral 
                                transactions={filteredTransactions.filter(t => t.status !== 'cancelado')} 
                                allTransactions={transactions.filter(t => t.status !== 'cancelado')}
                                bankAccounts={bankAccounts}
                                onOpenImport={() => setImportModalOpen(true)} 
                                onOpenCreditCard={() => setCreditCardModalOpen(true)}
                                onEditTransaction={(tx) => handleOpenModal(tx)}
                                onCancelTransaction={handleCancelRequest}
                            />
                        ) : (
                            <ContasTable
                                title={activeTab === 'aReceber' ? "Contas a Receber" : activeTab === 'aPagar' ? "Contas a Pagar" : "Lançamentos Cancelados"}
                                transactions={
                                    activeTab === 'aReceber' 
                                    ? filteredTransactions.filter(t => t.type === 'receita' && t.status !== 'cancelado') 
                                    : activeTab === 'aPagar'
                                    ? filteredTransactions.filter(t => t.type === 'despesa' && t.status !== 'cancelado')
                                    : filteredTransactions.filter(t => t.status === 'cancelado')
                                }
                                categories={categories}
                                onEdit={(tx) => handleOpenModal(tx)}
                                onCancel={handleCancelRequest}
                                onStatusChange={handleStatusChange}
                            />
                        )
                    )}
                </div>
            )}

            {isModalOpen && <TransactionModal isOpen={isModalOpen} onClose={handleCloseModal} onSave={handleSaveTransaction} transaction={editingTransaction} initialType={forcedModalType} categories={categories} bankAccounts={bankAccounts} />}
            {isImportModalOpen && <OFXImportModal isOpen={isImportModalOpen} onClose={() => setImportModalOpen(false)} onImport={handleBatchSaveTransactions} categories={categories} />}
            {isCreditCardModalOpen && <CreditCardModal isOpen={isCreditCardModalOpen} onClose={() => setCreditCardModalOpen(false)} onSave={handleBatchSaveTransactions} categories={categories} bankAccounts={bankAccounts} currentUser={currentUser} />}
            
            {isCancelModalOpen && (
                <Modal title="Cancelar transação" onClose={() => setIsCancelModalOpen(false)}>
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                                <XCircleIcon className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Deseja cancelar esta transação?</h3>
                            <p className="text-[11px] text-gray-500 mt-1">Informe o motivo para prosseguir.</p>
                        </div>
                        
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 mb-1 ml-0.5">Justificativa do cancelamento</label>
                            <textarea 
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                className="w-full rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/20"
                                placeholder="Descreva por que esta transação está sendo cancelada..."
                                rows={4}
                            />
                        </div>

                        <div className="flex justify-center gap-4">
                            <button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm text-gray-500">Voltar</button>
                            <button 
                                onClick={confirmCancelTransaction} 
                                disabled={!cancelReason.trim()}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/20 disabled:opacity-50"
                            >
                                Confirmar cancelamento
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isCategoryInUseModalOpen && (
                <Modal title="Categoria em uso" onClose={() => setCategoryInUseModalOpen(false)}>
                    <div className="p-4 text-center space-y-4">
                        <ExclamationTriangleIcon className="w-12 h-12 text-amber-500 mx-auto" />
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-400">Não é possível excluir esta categoria pois existem transações vinculadas a ela.</p>
                        <button onClick={() => setCategoryInUseModalOpen(false)} className="mt-4 px-8 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold">Entendido</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default FinanceiroPage;
