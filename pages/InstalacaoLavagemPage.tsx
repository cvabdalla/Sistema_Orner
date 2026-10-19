
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    SparklesIcon, DollarIcon, CheckCircleIcon, 
    UploadIcon, TrashIcon, ExclamationTriangleIcon,
    TableIcon, SearchIcon, CalendarIcon, SaveIcon,
    ClockIcon, ArrowLeftIcon, DocumentReportIcon,
    EyeIcon, XCircleIcon, ArrowDownIcon, UsersIcon
} from '../assets/icons';
import { dataService } from '../services/dataService';
import type { 
    FinancialTransaction, FinancialCategory, ExpenseReport, 
    User, ExpenseAttachment, InstalacaoLavagemPageProps, 
    Instalador, SavedOrcamento 
} from '../types';
import Modal from '../components/Modal';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

export interface TechnicalItem {
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    launchDate: string;
    categoryId: string;
    categoryName: string;
    installerId?: string;
    installerName?: string;
    clientName?: string;
    itemType: 'INSTALACAO' | 'LAVAGEM' | 'OUTRO';
    isFromOrcamento?: boolean;
    rawOrcamento?: SavedOrcamento;
    rawTx?: FinancialTransaction;
}

const InstalacaoLavagemPage: React.FC<InstalacaoLavagemPageProps> = ({ currentUser, reportToEdit, onSave }) => {
    const [pendingItems, setPendingItems] = useState<TechnicalItem[]>([]);
    const [allTransactions, setAllTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [installers, setInstallers] = useState<Instalador[]>([]);
    const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
    const [selectedInstallerFilter, setSelectedInstallerFilter] = useState<string>('ALL');
    const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [configKmValue, setConfigKmValue] = useState(1.20);
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
            const [txs, cats, allReports, remoteConfigs, insts, orcs] = await Promise.all([
                dataService.getAll<FinancialTransaction>('financial_transactions', currentUser.id, true),
                dataService.getAll<FinancialCategory>('financial_categories'),
                dataService.getAll<ExpenseReport>('expense_reports', undefined, true),
                dataService.getAll<any>('system_configs', undefined, true),
                dataService.getAll<Instalador>('instaladores'),
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, true)
            ]);

            const remoteKm = (remoteConfigs || []).find((c: any) => c.id === 'km_value');
            if (remoteKm) {
                setConfigKmValue(parseFloat(remoteKm.value) || 1.20);
            }

            const activeInstallers = (insts || []).filter(i => i && i.ativo !== false);
            setInstallers(activeInstallers);
            setCategories(cats || []);
            setAllTransactions(txs || []);

            const usedTxIdsInOtherReports = new Set(
                (allReports || [])
                    .filter(r => r.status !== 'Cancelado')
                    .filter(r => !reportToEdit || r.id !== reportToEdit.id)
                    .flatMap(r => (r.items || []).map(item => item.id))
            );

            // Categoria de instalação padrão
            const instalacaoCat = (cats || []).find(c => {
                const n = (c.name || '').toLowerCase();
                return n === 'instalação' || n === 'instalacao';
            }) || (cats || []).find(c => (c.name || '').toLowerCase().includes('instal')) || { id: 'instalação-1768270771212', name: 'Instalação' };

            const items: TechnicalItem[] = [];

            // 1. Instalações finalizadas a partir dos Orçamentos / Obras
            (orcs || []).forEach(o => {
                const etapas = o.venda_etapas || {};
                // Verifica se a instalação foi finalizada e ainda não foi paga
                if (etapas.instalacao_finalizada && !etapas.pag_instalacao) {
                    const v: any = o.variants?.find((x: any) => x.isPrincipal) || o.variants?.[0] || {};
                    const fs: any = { ...o.formState, ...(v.formState || {}) };
                    const calc: any = v.calculated || {};

                    const clientName = fs.nomeCliente || 'Cliente sem nome';
                    const installerId = fs.instaladorId || '';
                    const matchedInst = activeInstallers.find(i => String(i.id) === String(installerId));
                    const installerName = matchedInst ? matchedInst.nome : (fs.instaladorNome || (installerId ? 'Instalador Parceiro' : 'Não Definido'));

                    let amount = calc.totalInstalacao || 0;
                    if (!amount || amount === 0) {
                        const qtd = parseFloat(fs.terceiroInstalacaoQtd) || 0;
                        const custo = parseFloat(fs.terceiroInstalacaoCusto) || 0;
                        amount = qtd * custo;
                    }
                    if (!amount || amount === 0) {
                        amount = parseFloat(fs.projetoInstalacaoCusto) || 0;
                    }

                    const rawEtapas: any = etapas;
                    const rawOrc: any = o;
                    const date = rawEtapas.instalacao_finalizada_data || rawEtapas.instalacao_data || (rawOrc.createdAt ? rawOrc.createdAt.split('T')[0] : new Date().toISOString().split('T')[0]);
                    const txId = `tx-inst-${o.id}`;

                    if (!usedTxIdsInOtherReports.has(txId)) {
                        items.push({
                            id: txId,
                            description: `Instalação - ${clientName}`,
                            amount: Number(amount) || 0,
                            dueDate: date,
                            launchDate: date,
                            categoryId: instalacaoCat.id,
                            categoryName: 'Instalação',
                            installerId: installerId,
                            installerName: installerName,
                            clientName: clientName,
                            itemType: 'INSTALACAO',
                            isFromOrcamento: true,
                            rawOrcamento: o
                        });
                    }
                }
            });

            // 2. Transações avulsas da tabela financial_transactions (Lavagens ou Instalações diretas)
            const targetCatIds = (cats || [])
                .filter(c => {
                    const name = (c.name || '').toLowerCase();
                    return name.includes('lavagem') || name.includes('instalação') || name.includes('instalacao');
                })
                .map(c => c.id);

            (txs || []).forEach(t => {
                if (
                    t.type === 'despesa' && 
                    t.status === 'pendente' && 
                    targetCatIds.includes(t.categoryId) &&
                    !usedTxIdsInOtherReports.has(t.id) &&
                    !items.some(it => it.id === t.id)
                ) {
                    const cat = (cats || []).find(c => c.id === t.categoryId);
                    const catName = cat?.name || 'Instalação / Lavagem';
                    const isWash = catName.toLowerCase().includes('lavagem');

                    // Tenta identificar se o instalador está no texto da descrição
                    let matchedInst = activeInstallers.find(i => 
                        t.description.toLowerCase().includes(i.nome.toLowerCase().trim())
                    );

                    items.push({
                        id: t.id,
                        description: t.description,
                        amount: t.amount,
                        dueDate: t.dueDate,
                        launchDate: t.launchDate,
                        categoryId: t.categoryId,
                        categoryName: catName,
                        installerId: matchedInst ? matchedInst.id : undefined,
                        installerName: matchedInst ? matchedInst.nome : undefined,
                        itemType: isWash ? 'LAVAGEM' : 'INSTALACAO',
                        rawTx: t
                    });
                }
            });

            setPendingItems(items.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '')));

            if (reportToEdit && reportToEdit.items) {
                const draftIds = reportToEdit.items.map(i => i.id);
                setSelectedTxIds(draftIds);
                setAttachments(reportToEdit.attachments || []);
            }

        } catch (e) {
            console.error("Erro ao carregar dados técnicos:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [reportToEdit]);

    // Contagem de itens por instalador
    const installerCounts = useMemo(() => {
        const counts: Record<string, number> = { ALL: pendingItems.length, UNASSIGNED: 0 };
        installers.forEach(inst => {
            counts[inst.id] = 0;
        });

        pendingItems.forEach(item => {
            if (item.installerId && counts[item.installerId] !== undefined) {
                counts[item.installerId] = (counts[item.installerId] || 0) + 1;
            } else {
                counts.UNASSIGNED = (counts.UNASSIGNED || 0) + 1;
            }
        });

        return counts;
    }, [pendingItems, installers]);

    // Lista filtrada pelo instalador selecionado e busca
    const filteredItems = useMemo(() => {
        return pendingItems.filter(item => {
            // Filtro por instalador
            if (selectedInstallerFilter !== 'ALL') {
                if (selectedInstallerFilter === 'UNASSIGNED') {
                    if (item.installerId && installers.some(i => i.id === item.installerId)) {
                        return false;
                    }
                } else if (item.installerId !== selectedInstallerFilter) {
                    return false;
                }
            }

            // Filtro por termo de busca
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const matchDesc = item.description.toLowerCase().includes(term);
                const matchClient = (item.clientName || '').toLowerCase().includes(term);
                const matchInst = (item.installerName || '').toLowerCase().includes(term);
                if (!matchDesc && !matchClient && !matchInst) return false;
            }

            return true;
        });
    }, [pendingItems, selectedInstallerFilter, searchTerm, installers]);

    const selectedTotal = useMemo(() => {
        if (isReadOnly && reportToEdit) {
            return reportToEdit.totalValue || (reportToEdit.items || []).reduce((acc, i) => acc + (i.others || 0), 0);
        }
        return pendingItems
            .filter(t => selectedTxIds.includes(t.id))
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [selectedTxIds, pendingItems, isReadOnly, reportToEdit]);

    const toggleSelection = (id: string) => {
        if (isReadOnly) return;
        setSelectedTxIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAllVisible = () => {
        if (isReadOnly) return;
        const visibleIds = filteredItems.map(i => i.id);
        const allVisibleSelected = visibleIds.every(id => selectedTxIds.includes(id));

        if (allVisibleSelected) {
            setSelectedTxIds(prev => prev.filter(id => !visibleIds.includes(id)));
        } else {
            setSelectedTxIds(prev => Array.from(new Set([...prev, ...visibleIds])));
        }
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
                alert("Selecione pelo menos uma instalação ou serviço.");
                return;
            }
            return;
        }
        
        if (status === 'Transferido' && attachments.length === 0) {
            alert("A Nota Fiscal (NF) ou comprovante é obrigatório para enviar para pagamento.");
            return;
        }

        setIsSaving(true);
        setIsConfirmSubmitModalOpen(false);
        setIsConfirmDraftModalOpen(false);

        try {
            const selectedItems = pendingItems.filter(t => selectedTxIds.includes(t.id));
            const reportId = reportToEdit ? reportToEdit.id : `tech-${Date.now()}`;
            
            // 1. Para itens originados de Orçamentos, cria a transação financeira correspondente
            // e vincula ao relatório para que o financeiro visualize
            for (const item of selectedItems) {
                if (item.isFromOrcamento && item.rawOrcamento) {
                    const txPayload: FinancialTransaction = {
                        id: item.id,
                        owner_id: currentUser.id || '1767988420092',
                        description: item.description,
                        amount: item.amount,
                        type: 'despesa',
                        dueDate: item.dueDate,
                        launchDate: item.launchDate,
                        categoryId: item.categoryId,
                        status: 'pendente',
                        relatedReportId: reportId,
                        invoiceSent: (status === 'Transferido')
                    };
                    await dataService.save('financial_transactions', txPayload);

                    // Atualiza o orçamento com a informação de pagamento solicitado
                    const updatedOrc = {
                        ...item.rawOrcamento,
                        venda_etapas: {
                            ...(item.rawOrcamento.venda_etapas || {}),
                            pag_instalacao_solicitado: true,
                            pag_instalacao_report_id: reportId
                        }
                    };
                    await dataService.save('orcamentos', updatedOrc);
                } else if (item.rawTx) {
                    // Atualiza transação avulsa existente com o relatedReportId
                    await dataService.save('financial_transactions', {
                        ...item.rawTx,
                        relatedReportId: reportId,
                        invoiceSent: (status === 'Transferido')
                    });
                }
            }

            // Identifica o instalador principal se houver
            const uniqueInstallerNames = Array.from(new Set(selectedItems.map(i => i.installerName).filter(Boolean)));
            const requesterLabel = uniqueInstallerNames.length === 1 
                ? `Instalador: ${uniqueInstallerNames[0]}` 
                : (reportToEdit ? reportToEdit.requester : currentUser.name);

            const finalReport: ExpenseReport = {
                id: reportId,
                owner_id: reportToEdit ? reportToEdit.owner_id : (currentUser.id || '1767988420092'),
                requester: requesterLabel,
                sector: 'Faturamento técnico',
                period: 'Instalações / Lavagens',
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
                kmValueUsed: configKmValue,
                status: status,
                createdAt: reportToEdit ? reportToEdit.createdAt : new Date().toISOString(),
                totalValue: selectedTotal,
                isInstallmentWash: true
            };

            await dataService.save('expense_reports', finalReport);

            if (status === 'Transferido') {
                setModalMessage("Instalações enviadas com sucesso! As ordens foram liberadas para conferência e pagamento no Financeiro.");
            } else {
                setModalMessage("Rascunho atualizado com sucesso.");
            }

            setSuccessModalOpen(true);
        } catch (e: any) {
            console.error("Erro ao salvar faturamento de instalações:", e);
            alert("Erro ao processar a operação: " + (e?.message || 'Verifique sua conexão.'));
        } finally {
            setIsSaving(false);
        }
    };

    const handleSuccessModalClose = () => {
        setSuccessModalOpen(false);
        if (onSave) onSave();
    };

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

            {/* Cabeçalho */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-5">
                    <div className="w-16 h-16 bg-cyan-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-600/20">
                        <SparklesIcon className="w-10 h-10" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                            {isReadOnly ? 'Visualizar Faturamento' : reportToEdit ? 'Alterar Faturamento' : 'Faturamento de Instalações e Serviços'}
                        </h1>
                        <p className="text-sm text-gray-500 font-bold mt-2">
                            {reportToEdit ? `Registro técnico: ${reportToEdit.id}` : 'Selecione as instalações finalizadas por instalador para enviar ao pagamento'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <p className="text-[10px] font-black text-gray-400 mb-1 tracking-tighter">Total Selecionado</p>
                    <p className="text-3xl font-black text-cyan-600">{formatCurrency(selectedTotal)}</p>
                </div>
            </div>

            {/* Filtro por Instalador */}
            {!isReadOnly && (
                <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <UsersIcon className="w-4 h-4 text-cyan-600" />
                            <span className="text-xs font-black text-gray-700 dark:text-gray-200 uppercase tracking-wider">
                                Filtrar por Instalador
                            </span>
                        </div>
                        {filteredItems.length > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectAllVisible}
                                className="text-[11px] font-black text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 hover:underline"
                            >
                                {filteredItems.every(i => selectedTxIds.includes(i.id)) ? 'Desmarcar todos' : 'Selecionar todos visíveis'}
                            </button>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setSelectedInstallerFilter('ALL')}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                selectedInstallerFilter === 'ALL'
                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                            }`}
                        >
                            <span>Todos os Instaladores</span>
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                selectedInstallerFilter === 'ALL' ? 'bg-cyan-800 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                            }`}>
                                {installerCounts.ALL || 0}
                            </span>
                        </button>

                        {installers.map(inst => {
                            const count = installerCounts[inst.id] || 0;
                            const isSelected = selectedInstallerFilter === inst.id;
                            return (
                                <button
                                    key={inst.id}
                                    type="button"
                                    onClick={() => setSelectedInstallerFilter(inst.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                        isSelected
                                            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>{inst.nome}</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                        isSelected ? 'bg-cyan-800 text-white' : count > 0 ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300' : 'bg-gray-200 dark:bg-gray-600 text-gray-500'
                                    }`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}

                        {(installerCounts.UNASSIGNED > 0) && (
                            <button
                                type="button"
                                onClick={() => setSelectedInstallerFilter('UNASSIGNED')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                    selectedInstallerFilter === 'UNASSIGNED'
                                        ? 'bg-cyan-600 text-white shadow-md'
                                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                }`}
                            >
                                <span>Sem instalador</span>
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                                    {installerCounts.UNASSIGNED}
                                </span>
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-6 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h3 className="text-xs font-black text-gray-500 flex items-center gap-2">
                                <TableIcon className="w-4 h-4" /> {isReadOnly ? 'Itens do Faturamento' : 'Instalações Finalizadas Disponíveis'}
                            </h3>
                            {!isReadOnly && (
                                <div className="relative w-full sm:w-64">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por cliente ou instalador..." 
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
                                        <th className="px-6 py-4 w-12 text-center"></th>
                                        <th className="px-4 py-4">Descrição da Instalação / Obra</th>
                                        <th className="px-4 py-4">Instalador Responsável</th>
                                        <th className="px-4 py-4 text-center">Data Conclusão</th>
                                        <th className="px-6 py-4 text-right">Valor da Mão de Obra</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {isReadOnly ? (
                                        (reportToEdit?.items || []).map(item => {
                                            const tx = allTransactions.find(t => t.id === item.id);
                                            const categoryName = tx 
                                                ? (categories.find(c => c.id === tx.categoryId)?.name || 'Instalação') 
                                                : 'Instalação / Lavagem';
                                            
                                            if (searchTerm && !item.description.toLowerCase().includes(searchTerm.toLowerCase())) {
                                                return null;
                                            }

                                            return (
                                                <tr 
                                                    key={item.id} 
                                                    className="bg-cyan-50/10 dark:bg-cyan-900/5 border-l-4 border-cyan-500 transition-all cursor-default"
                                                >
                                                    <td className="px-6 py-5 text-center">
                                                        <div className="w-6 h-6 rounded-lg bg-cyan-600 border-2 border-cyan-600 flex items-center justify-center shadow-md">
                                                            <CheckCircleIcon className="w-4 h-4 text-white" />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <p className="text-xs font-black text-cyan-700 dark:text-cyan-400">{item.description}</p>
                                                        <p className="text-[9px] text-gray-400 font-bold mt-1 tracking-tighter">
                                                            {categoryName}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                                                            {reportToEdit?.requester || 'Instalador'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-5 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <CalendarIcon className="w-3.5 h-3.5 text-gray-300 mb-1" />
                                                            <span className="text-[11px] font-black text-gray-500">
                                                                {item.date ? new Date(item.date).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'Sem data'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-5 text-right text-sm font-black text-cyan-700 dark:text-cyan-400">
                                                        {formatCurrency(item.others)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        filteredItems.map(item => {
                                            const isSelected = selectedTxIds.includes(item.id);
                                            return (
                                                <tr 
                                                    key={item.id} 
                                                    onClick={() => toggleSelection(item.id)}
                                                    className={`cursor-pointer transition-all ${isSelected ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}
                                                >
                                                    <td className="px-6 py-5 text-center">
                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-cyan-600 border-cyan-600 shadow-md' : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'}`}>
                                                            {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        <p className={`text-xs font-black ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                                            {item.description}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <span className="text-[9px] text-gray-400 font-bold tracking-tighter">
                                                                {item.categoryName}
                                                            </span>
                                                            {item.isFromOrcamento && (
                                                                <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[8px] font-black rounded uppercase">
                                                                    Obra Concluída
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-5">
                                                        {item.installerName ? (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 inline-flex items-center gap-1.5">
                                                                <UsersIcon className="w-3 h-3 text-cyan-600" />
                                                                {item.installerName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-400 italic">
                                                                Sem instalador
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-5 text-center">
                                                        <div className="flex flex-col items-center">
                                                            <CalendarIcon className="w-3.5 h-3.5 text-gray-300 mb-1" />
                                                            <span className="text-[11px] font-black text-gray-500">
                                                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'Sem data'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className={`px-6 py-5 text-right text-sm font-black ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-indigo-600'}`}>
                                                        {formatCurrency(item.amount)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    {((isReadOnly && (!reportToEdit?.items || reportToEdit.items.length === 0)) || (!isReadOnly && filteredItems.length === 0)) && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-20 text-center space-y-4">
                                                <ExclamationTriangleIcon className="w-12 h-12 text-gray-200 mx-auto" />
                                                <p className="text-gray-400 font-bold italic text-sm">
                                                    {isReadOnly ? 'Nenhum item encontrado neste faturamento.' : 'Não há instalações finalizadas pendentes para este instalador.'}
                                                </p>
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
                            <DocumentReportIcon className="w-6 h-6 text-cyan-600" />
                            <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">Comprovantes e Notas Fiscais</h3>
                        </div>

                        {/* Upload de Anexos */}
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                Anexe a Nota Fiscal ou Recibo emitido pelo instalador parceiro para liberação no contas a pagar:
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                                {attachments.map((file, idx) => {
                                    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
                                    return (
                                        <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-2">
                                            {isPdf ? (
                                                <div className="text-center">
                                                    <DocumentReportIcon className="w-8 h-8 text-red-500 mx-auto mb-1" />
                                                    <span className="text-[9px] font-bold text-gray-500 block truncate max-w-[80px]">{file.name}</span>
                                                </div>
                                            ) : (
                                                <img src={file.data} alt="" className="w-full h-full object-cover" />
                                            )}

                                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                <button 
                                                    onClick={() => handleViewFile(file)}
                                                    className="p-1.5 bg-white text-gray-900 rounded-full hover:bg-gray-100 shadow-lg"
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
                                <span className="text-[11px] font-black text-gray-400">Total Selecionado</span>
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
                                    <ArrowLeftIcon className="w-5 h-5" /> Voltar ao Histórico
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modais de Confirmação */}
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
