
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    SparklesIcon, DollarIcon, CheckCircleIcon, 
    UploadIcon, TrashIcon, ExclamationTriangleIcon,
    TableIcon, SearchIcon, CalendarIcon, SaveIcon,
    ClockIcon, ArrowLeftIcon, DocumentReportIcon,
    EyeIcon, XCircleIcon, ArrowDownIcon
} from '../assets/icons';
import { dataService } from '../services/dataService';
import type { FinancialTransaction, FinancialCategory, ExpenseReport, User, ExpenseAttachment, InstalacaoLavagemPageProps } from '../types';
import Modal from '../components/Modal';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const InstalacaoLavagemPage: React.FC<InstalacaoLavagemPageProps> = ({ currentUser, reportToEdit, onSave }) => {
    const [pendingTransactions, setPendingTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
    const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
    const [isConfirmDraftModalOpen, setIsConfirmDraftModalOpen] = useState(false);
    const [isConfirmSubmitModalOpen, setIsConfirmSubmitModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [hdPhoto, setHdPhoto] = useState<string | null>(null);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isReadOnly = useMemo(() => reportToEdit ? reportToEdit.status !== 'Rascunho' : false, [reportToEdit]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [txs, cats, allReports] = await Promise.all([
                dataService.getAll<FinancialTransaction>('financial_transactions', currentUser.id, true),
                dataService.getAll<FinancialCategory>('financial_categories'),
                dataService.getAll<ExpenseReport>('expense_reports', undefined, true)
            ]);

            const usedTxIdsInOtherReports = new Set(
                allReports
                    .filter(r => r.status !== 'Cancelado')
                    .filter(r => !reportToEdit || r.id !== reportToEdit.id)
                    .flatMap(r => (r.items || []).map(item => item.id))
            );

            const targetCatIds = cats
                .filter(c => {
                    const name = (c.name || '').toLowerCase();
                    return name.includes('lavagem') || name.includes('instalação') || name.includes('instalacao');
                })
                .map(c => c.id);

            const filteredTxs = txs.filter(t => 
                t.type === 'despesa' && 
                t.status === 'pendente' && 
                targetCatIds.includes(t.categoryId) &&
                !usedTxIdsInOtherReports.has(t.id)
            );

            setPendingTransactions(filteredTxs.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
            setCategories(cats);

            if (reportToEdit && reportToEdit.items) {
                const draftIds = reportToEdit.items.map(i => i.id);
                setSelectedTxIds(draftIds);
                setAttachments(reportToEdit.attachments || []);
            }

        } catch (e) {
            console.error("Erro ao carregar dados:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [reportToEdit]);

    const selectedTotal = useMemo(() => {
        return pendingTransactions
            .filter(t => selectedTxIds.includes(t.id))
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [selectedTxIds, pendingTransactions]);

    const toggleSelection = (id: string) => {
        if (isReadOnly) return;
        setSelectedTxIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        (Array.from(files) as File[]).forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
                if (typeof event.target?.result === 'string') {
                    setAttachments(prev => [...prev, { name: file.name, data: event.target!.result as string }]);
                }
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
    };

    const getFileBlob = (file: ExpenseAttachment) => {
        const parts = file.data.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    };

    const handleViewFile = (file: ExpenseAttachment) => {
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
        if (isPdf) {
            const blob = getFileBlob(file);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } else {
            setHdPhoto(file.data);
        }
    };

    const handleDownloadFile = (file: ExpenseAttachment) => {
        const blob = getFileBlob(file);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleSaveAction = async (status: 'Transferido' | 'Rascunho') => {
        if (selectedTxIds.length === 0) {
            if (reportToEdit && reportToEdit.status === 'Rascunho') {
                setIsSaving(true);
                try {
                    await dataService.delete('expense_reports', reportToEdit.id);
                    setModalMessage("Rascunho excluído com sucesso.");
                    setIsConfirmDraftModalOpen(false);
                    setSuccessModalOpen(true);
                    return;
                } catch (e) {
                    alert("Erro ao excluir rascunho.");
                } finally {
                    setIsSaving(false);
                }
            } else {
                alert("Selecione pelo menos um lançamento.");
            }
            return;
        }
        
        if (status === 'Transferido' && attachments.length === 0) {
            alert("A Nota Fiscal (NF) é obrigatória para enviar.");
            return;
        }

        setIsSaving(true);
        setIsConfirmSubmitModalOpen(false);
        setIsConfirmDraftModalOpen(false);

        try {
            const selectedItems = pendingTransactions.filter(t => selectedTxIds.includes(t.id));
            const reportId = reportToEdit ? reportToEdit.id : `tech-${Date.now()}`;
            
            const finalReport: ExpenseReport = {
                id: reportId,
                owner_id: reportToEdit ? reportToEdit.owner_id : currentUser.id,
                requester: reportToEdit ? reportToEdit.requester : currentUser.name,
                sector: 'Faturamento técnico',
                period: 'Lançamentos técnicos',
                periodStart: reportToEdit ? reportToEdit.periodStart : new Date().toISOString(),
                periodEnd: reportToEdit ? reportToEdit.periodEnd : new Date().toISOString(),
                items: selectedItems.map(t => ({
                    id: t.id,
                    date: t.dueDate,
                    description: t.description,
                    km: 0,
                    toll: 0,
                    food: 0,
                    components: 0,
                    others: t.amount
                })),
                attachments: attachments,
                kmValueUsed: 0,
                status: status,
                createdAt: reportToEdit ? reportToEdit.createdAt : new Date().toISOString(),
                totalValue: selectedTotal,
                isInstallmentWash: true
            };

            await dataService.save('expense_reports', finalReport);

            if (status === 'Transferido') {
                setModalMessage("Solicitação enviada para auditoria! O financeiro será liberado assim que o administrativo aprovar o relatório.");
            } else {
                setModalMessage("Rascunho atualizado com sucesso.");
            }

            setSuccessModalOpen(true);
        } catch (e: any) {
            console.error("Erro ao salvar:", e);
            alert("Erro ao processar a operação: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSuccessModalClose = () => {
        setSuccessModalOpen(false);
        if (onSave) onSave();
    };

    const filteredList = pendingTransactions.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* Banner de Cancelamento */}
            {reportToEdit?.status === 'Cancelado' && reportToEdit.cancelReason && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/50 p-6 rounded-3xl flex items-start gap-5 shadow-sm animate-fade-in">
                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shrink-0">
                        <ExclamationTriangleIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-base font-black text-red-700 dark:text-red-400 tracking-tight">Faturamento Rejeitado</h4>
                        <p className="text-sm font-bold text-red-600 dark:text-red-500/80 mt-1 leading-relaxed">
                            Motivo do Administrativo: <span className="text-gray-800 dark:text-gray-100 font-black">"{reportToEdit.cancelReason}"</span>
                        </p>
                        <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mt-3 opacity-70">Verifique as notas e reenvie se necessário</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-cyan-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-600/20">
                        <SparklesIcon className="w-10 h-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                            {isReadOnly ? 'Visualizar faturamento' : reportToEdit ? 'Alterar Faturamento' : 'Instalações / Lavagens'}
                        </h1>
                        <p className="text-sm text-gray-500 font-bold mt-2">
                            {reportToEdit ? `Registro técnico: ${reportToEdit.id}` : 'Faturamento Técnico Independente'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <p className="text-[10px] font-black text-gray-400 mb-1 tracking-tighter">Total Selecionado</p>
                    <p className="text-3xl font-black text-cyan-600">{formatCurrency(selectedTotal)}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h3 className="text-xs font-black text-gray-500 flex items-center gap-2">
                                <TableIcon className="w-4 h-4" /> {isReadOnly ? 'Itens do faturamento' : 'Lançamentos disponíveis'}
                            </h3>
                            {!isReadOnly && (
                                <div className="relative w-full sm:w-64">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Filtrar lançamentos..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-xs font-bold shadow-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 border-b">
                                    <tr>
                                        <th className="px-6 py-4 w-12"></th>
                                        <th className="px-4 py-4">Descrição do débito</th>
                                        <th className="px-4 py-4 text-center">Vencimento</th>
                                        <th className="px-6 py-4 text-right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredList.map(tx => {
                                        const isSelected = selectedTxIds.includes(tx.id);
                                        if (isReadOnly && !isSelected) return null;

                                        return (
                                            <tr 
                                                key={tx.id} 
                                                onClick={() => toggleSelection(tx.id)}
                                                className={`cursor-pointer transition-all ${isSelected ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}
                                            >
                                                <td className="px-6 py-5 text-center">
                                                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-600 border-cyan-600 shadow-md' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'}`}>
                                                        {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <p className={`text-xs font-black ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-800 dark:text-gray-200'}`}>{tx.description}</p>
                                                    <p className="text-[9px] text-gray-400 font-bold mt-1 tracking-tighter">
                                                        {categories.find(c => c.id === tx.categoryId)?.name || 'Não informado'}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-5 text-center">
                                                    <div className="flex flex-col items-center">
                                                        <CalendarIcon className="w-3.5 h-3.5 text-gray-300 mb-1" />
                                                        <span className="text-[11px] font-black text-gray-500">{new Date(tx.dueDate).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</span>
                                                    </div>
                                                </td>
                                                <td className={`px-6 py-5 text-right text-sm font-black ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-indigo-600'}`}>
                                                    {formatCurrency(tx.amount)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {filteredList.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-20 text-center space-y-4">
                                                <ExclamationTriangleIcon className="w-12 h-12 text-gray-200 mx-auto" />
                                                <p className="text-gray-400 font-bold italic text-sm">Não há lançamentos técnicos pendentes.</p>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 sticky top-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><UploadIcon className="w-5 h-5" /></div>
                            <h3 className="text-sm font-black text-gray-800 dark:text-white">Anexo Obrigatório</h3>
                        </div>

                        <div className="space-y-4">
                            <p className="text-[11px] text-gray-500 font-bold leading-relaxed">Para solicitar o pagamento, anexe a Nota Fiscal ou comprovante (PDF ou Imagem).</p>
                            
                            <div className="grid grid-cols-2 gap-3">
                                {attachments.map((file, idx) => {
                                    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
                                    
                                    return (
                                        <div key={idx} className="relative aspect-square rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 overflow-hidden group shadow-sm bg-gray-50 flex items-center justify-center">
                                            {isPdf ? (
                                                <div className="flex flex-col items-center text-center p-2">
                                                    <DocumentReportIcon className="w-10 h-10 text-red-500 mb-1" />
                                                    <span className="text-[8px] font-black text-gray-500 truncate max-w-full">{file.name}</span>
                                                </div>
                                            ) : (
                                                <img src={file.data} className="w-full h-full object-cover" alt="" />
                                            )}
                                            
                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                                                <button 
                                                    onClick={() => handleViewFile(file)}
                                                    className="p-1.5 bg-white text-gray-900 rounded-full hover:bg-indigo-50 shadow-lg"
                                                    title="Visualizar"
                                                >
                                                    <EyeIcon className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDownloadFile(file)}
                                                    className="p-1.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 shadow-lg"
                                                    title="Baixar arquivo"
                                                >
                                                    <ArrowDownIcon className="w-4 h-4" />
                                                </button>
                                                {!isReadOnly && (
                                                    <button 
                                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                                                        className="p-1.5 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-lg"
                                                        title="Excluir"
                                                    >
                                                        <TrashIcon className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {!isReadOnly && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-2xl border-2 border-dashed border-cyan-300 dark:border-cyan-800 bg-cyan-50/30 dark:bg-cyan-900/10 flex flex-col items-center justify-center gap-2 hover:border-cyan-500 hover:bg-cyan-50 transition-all group"
                                    >
                                        <UploadIcon className="w-8 h-8 text-cyan-500 group-hover:scale-110 transition-transform" />
                                        <span className="text-[10px] font-black text-cyan-600 tracking-tighter">Anexar NF</span>
                                    </button>
                                )}
                            </div>
                            <input type="file" className="hidden" ref={fileInputRef} multiple accept="image/*,application/pdf" onChange={handleFileUpload} />
                        </div>

                        <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-700 space-y-4">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[11px] font-black text-gray-400">Saldo Fechado</span>
                                <span className="text-2xl font-black text-cyan-600 leading-none">{formatCurrency(selectedTotal)}</span>
                            </div>
                            
                            {!isReadOnly ? (
                                <div className="flex flex-col gap-3">
                                    <button 
                                        onClick={() => setIsConfirmSubmitModalOpen(true)}
                                        disabled={isSaving || selectedTxIds.length === 0 || attachments.length === 0}
                                        className={`w-full py-4 rounded-2xl font-black text-sm shadow-xl transition-all flex items-center justify-center gap-3 ${
                                            selectedTxIds.length > 0 && attachments.length > 0
                                            ? 'bg-indigo-600 text-white shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                                        }`}
                                    >
                                        <SaveIcon className="w-5 h-5" /> 
                                        {isSaving ? 'Salvando...' : (reportToEdit ? 'Finalizar e Enviar' : 'Solicitar Pagamento')}
                                    </button>

                                    <button 
                                        onClick={() => setIsConfirmDraftModalOpen(true)}
                                        disabled={isSaving}
                                        className={`w-full py-3 rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-2 ${
                                            !isSaving
                                            ? 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'
                                            : 'bg-gray-50 dark:bg-gray-900/40 text-gray-300 cursor-not-allowed'
                                        }`}
                                    >
                                        <ClockIcon className="w-4 h-4" /> 
                                        {selectedTxIds.length === 0 && reportToEdit ? 'Excluir Rascunho' : 'Salvar Rascunho'}
                                    </button>
                                </div>
                            ) : (
                                <button 
                                    onClick={onSave}
                                    className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all flex items-center justify-center gap-3"
                                >
                                    <ArrowLeftIcon className="w-5 h-5" /> Voltar ao histórico
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isConfirmDraftModalOpen && (
                <Modal title={selectedTxIds.length === 0 && reportToEdit ? "Confirmar exclusão" : "Salvar Rascunho"} onClose={() => setIsConfirmDraftModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${selectedTxIds.length === 0 ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                            {selectedTxIds.length === 0 ? <TrashIcon className="w-10 h-10" /> : <ClockIcon className="w-10 h-10" />}
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {selectedTxIds.length === 0 && reportToEdit ? 'Deseja excluir este rascunho?' : 'Deseja salvar o formulário?'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                {selectedTxIds.length === 0 && reportToEdit 
                                    ? 'Isso liberará as linhas financeiras para novos formulários.' 
                                    : 'Você poderá editá-lo novamente no menu de Histórico.'}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsConfirmDraftModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-sm">Não</button>
                            <button 
                                onClick={() => handleSaveAction('Rascunho')} 
                                disabled={isSaving} 
                                className={`flex-1 py-3 text-white rounded-xl font-bold text-sm shadow-lg ${selectedTxIds.length === 0 ? 'bg-red-600' : 'bg-indigo-600'}`}
                            >
                                {isSaving ? '...' : 'Sim, confirmar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isConfirmSubmitModalOpen && (
                <Modal title="Confirmar Operação" onClose={() => setIsConfirmSubmitModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-50 text-green-600">
                            <CheckCircleIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Efetivar e enviar ao financeiro?</h3>
                            <p className="text-sm text-gray-500 font-medium leading-relaxed px-4">
                                Esta ação autorizará o pagamento e marcará os lançamentos como <strong>Liberados</strong> no financeiro.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsConfirmSubmitModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-sm">Não, revisar</button>
                            <button 
                                onClick={() => handleSaveAction('Transferido')} 
                                disabled={isSaving} 
                                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all"
                            >
                                {isSaving ? 'Gravando...' : 'Sim, efetivar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isSuccessModalOpen && (
                <Modal title="" onClose={handleSuccessModalClose}>
                    <div className="text-center py-10 space-y-6 animate-fade-in">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-lg shadow-green-100">
                            <CheckCircleIcon className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-gray-900">Sucesso!</h3>
                            <p className="text-sm font-bold text-gray-500 px-8 leading-relaxed">{modalMessage}</p>
                        </div>
                        <button 
                            onClick={handleSuccessModalClose}
                            className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-black transition-all active:scale-95"
                        >
                            Fechar e concluir
                        </button>
                    </div>
                </Modal>
            )}

            {hdPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setHdPhoto(null)}>
                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
                        <button className="absolute top-0 right-0 p-3 text-white hover:text-indigo-400 z-[110]" onClick={(e) => { e.stopPropagation(); setHdPhoto(null); }}><XCircleIcon className="w-10 h-10" /></button>
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden"><img src={hdPhoto} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in" alt="" onClick={(e) => e.stopPropagation()} /></div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InstalacaoLavagemPage;
