
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    SparklesIcon, DollarIcon, CheckCircleIcon, 
    UploadIcon, TrashIcon, ExclamationTriangleIcon,
    TableIcon, SearchIcon, CalendarIcon, SaveIcon,
    ClockIcon, ArrowLeftIcon, DocumentReportIcon,
    EyeIcon, XCircleIcon, ArrowDownIcon, UsersIcon, AddIcon,
    EditIcon, LockClosedIcon
} from '../assets/icons';
import { dataService } from '../services/dataService';
import { supabase } from '../supabaseClient';
import type { 
    FinancialTransaction, FinancialCategory, ExpenseReport, 
    User, ExpenseAttachment, InstalacaoLavagemPageProps, 
    Instalador, SavedOrcamento, UserProfile 
} from '../types';
import Modal from '../components/Modal';

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const cleanText = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const parseSafeNumber = (val: any): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    let s = String(val).trim();
    s = s.replace(/[^\d.,-]/g, '');
    if (!s) return 0;
    if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    const parsed = parseFloat(s);
    return isNaN(parsed) ? 0 : parsed;
};

export interface BreakdownItem {
    label: string;
    detail?: string;
    value: number;
    isIncluded: boolean;
    reason?: string;
}

export interface TechnicalItem {
    id: string;
    description: string;
    amount: number;
    baseAmount?: number;
    dueDate: string;
    launchDate: string;
    categoryId: string;
    categoryName: string;
    installerId?: string;
    installerName: string;
    clientName: string;
    itemType: 'INSTALACAO' | 'LAVAGEM' | 'OUTRO';
    statusPagamento: 'pendente' | 'solicitado' | 'pago';
    isFromOrcamento?: boolean;
    rawOrcamento?: SavedOrcamento;
    rawTx?: FinancialTransaction;
    breakdown?: BreakdownItem[];
    extraDesc?: string;
    extraValor?: number;
}

export const computeCostBreakdown = (
    fs?: any, 
    rawTx?: any, 
    customExtraDesc?: string, 
    customExtraValor?: number,
    customBaseAmount?: number
): BreakdownItem[] => {
    if (!fs && rawTx) {
        return [
            {
                label: rawTx.description || 'Serviço de Lavagem Técnica de Módulos',
                detail: 'Lançamento financeiro direto de lavagem',
                value: rawTx.amount || 0,
                isIncluded: true
            }
        ];
    }
    if (!fs) return [];

    const extraDesc = customExtraDesc !== undefined ? customExtraDesc : (fs.instalacao_servico_extra_desc || fs.instalacaoServicoExtraDesc || '');
    const extraValor = customExtraValor !== undefined ? customExtraValor : parseSafeNumber(fs.instalacao_servico_extra_valor || fs.instalacaoServicoExtraValor || 0);

    const breakdown: BreakdownItem[] = [];

    // Se houver valor base customizado pelo Administrador na página de Reembolso
    if (customBaseAmount !== undefined && customBaseAmount > 0) {
        breakdown.push({
            label: 'Mão de Obra de Instalação (Definida no Reembolso)',
            detail: 'Valor ajustado pelo perfil administrador para reembolso',
            value: customBaseAmount,
            isIncluded: true
        });
    } else {
        const qtd = parseSafeNumber(fs.terceiroInstalacaoQtd);
        const custo = parseSafeNumber(fs.terceiroInstalacaoCusto);
        const instalacaoMaoDeObra = qtd * custo;
        const adequacaoLocal = parseSafeNumber(fs.adequacaoLocalCusto);
        const projInst = parseSafeNumber(fs.projetoInstalacaoCusto);

        // 1. Mão de Obra de Instalação (INCLUÍDO)
        if (qtd > 0 && custo > 0) {
            breakdown.push({
                label: 'Mão de Obra de Instalação (Terceirizada)',
                detail: `${qtd} módulos / placas × ${formatCurrency(custo)}`,
                value: instalacaoMaoDeObra,
                isIncluded: true
            });
        } else if (projInst > 0) {
            breakdown.push({
                label: 'Instalação (Custo Direto do Projeto)',
                detail: 'Valor direto configurado no orçamento',
                value: projInst,
                isIncluded: true
            });
        } else if (instalacaoMaoDeObra > 0) {
            breakdown.push({
                label: 'Mão de Obra de Instalação',
                detail: `${qtd} un. × ${formatCurrency(custo)}`,
                value: instalacaoMaoDeObra,
                isIncluded: true
            });
        } else {
            breakdown.push({
                label: 'Mão de Obra de Instalação',
                detail: '0 módulos ou valor zerado',
                value: 0,
                isIncluded: true
            });
        }

        // 2. Adequação de Local / Padrão (INCLUÍDO)
        if (adequacaoLocal > 0) {
            breakdown.push({
                label: 'Adequação do Local / Padrão de Entrada',
                detail: 'Adequação técnica informada no orçamento',
                value: adequacaoLocal,
                isIncluded: true
            });
        }
    }

    // 3. Serviço Extra ou Ajuste Identificado na Instalação (INCLUÍDO)
    const hasExtra = (extraValor !== undefined && Math.abs(extraValor) > 0.001) || Boolean(extraDesc && extraDesc.trim().length > 0);
    if (hasExtra) {
        const isNegative = (extraValor || 0) < 0;
        breakdown.push({
            label: isNegative 
                ? `Ajuste / Dedução Extra: ${extraDesc || 'Desconto / Ajuste'}`
                : `Serviço Extra: ${extraDesc || 'Identificado na Instalação'}`,
            detail: isNegative
                ? 'Dedução ou acerto identificado na instalação'
                : 'Serviço adicional identificado e aprovado na obra',
            value: extraValor || 0,
            isIncluded: true
        });
    }

    return breakdown;
};

const InstalacaoLavagemPage: React.FC<InstalacaoLavagemPageProps> = ({ currentUser, reportToEdit, onSave, userPermissions }) => {
    const [allItems, setAllItems] = useState<TechnicalItem[]>([]);
    const [rawOrcamentos, setRawOrcamentos] = useState<SavedOrcamento[]>([]);
    const [allTransactions, setAllTransactions] = useState<FinancialTransaction[]>([]);
    const [categories, setCategories] = useState<FinancialCategory[]>([]);
    const [installers, setInstallers] = useState<Instalador[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);
    const [selectedInstallerFilter, setSelectedInstallerFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<'pendentes' | 'todas'>('pendentes');
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
    const [confirmDeleteExtraItem, setConfirmDeleteExtraItem] = useState<TechnicalItem | null>(null);

    // Validação de Perfil de Usuário Administrador
    const isAdmin = useMemo(() => {
        const adminProfileIds = ['001', '00000000-0000-0000-0000-000000000001'];
        if (adminProfileIds.includes(String(currentUser?.profileId))) return true;
        if (currentUser?.email?.toLowerCase() === 'cvabdalla@gmail.com') return true;
        if (userPermissions?.includes('ALL')) return true;
        const currentProfile = profiles.find(p => String(p.id) === String(currentUser?.profileId));
        if (currentProfile?.name?.toLowerCase().includes('admin')) return true;
        return currentProfile?.permissions?.includes('ALL') || false;
    }, [currentUser, profiles, userPermissions]);

    // Identificação do Instalador vinculado ao usuário logado
    const userLinkedInstaller = useMemo(() => {
        if (!currentUser) return null;
        const uEmail = (currentUser.email || '').toLowerCase().trim();
        const uName = cleanText(currentUser.name || '');

        // 1. Vínculo direto pelo campo instaladorId configurado no cadastro de usuários
        if (currentUser.instaladorId) {
            const found = installers.find(i => String(i.id) === String(currentUser.instaladorId));
            if (found) return found;
        }

        // 2. Reconhecimento automático para Davi ("comercial1@orner.com.br") e Martin ("martin@orner.com.br")
        if (uEmail === 'comercial1@orner.com.br' || uEmail.includes('davi')) {
            const found = installers.find(i => cleanText(i.nome).includes('davi'));
            if (found) return found;
        }
        if (uEmail === 'martin@orner.com.br' || uEmail.includes('martin')) {
            const found = installers.find(i => cleanText(i.nome).includes('martin'));
            if (found) return found;
        }

        // 3. Fallback por correspondência com o nome do usuário
        if (uName) {
            const found = installers.find(i => {
                const iName = cleanText(i.nome);
                return iName && (iName.includes(uName) || uName.includes(iName));
            });
            if (found) return found;
        }

        return null;
    }, [currentUser, installers]);

    // Helper para verificar se um item pertence a um instalador específico
    const isItemForInstaller = (item: TechnicalItem, inst: Instalador): boolean => {
        if (item.installerId && String(item.installerId) === String(inst.id)) return true;
        const itemInstName = cleanText(item.installerName);
        const targetName = cleanText(inst.nome);
        if (!itemInstName || itemInstName === 'nao definido') return false;
        return itemInstName === targetName || itemInstName.includes(targetName) || targetName.includes(itemInstName);
    };

    // Admin Edit Modal State (Edição de Instalador e Valor)
    const [adminEditModalItem, setAdminEditModalItem] = useState<TechnicalItem | null>(null);
    const [adminEditInstallerId, setAdminEditInstallerId] = useState<string>('');
    const [adminEditInstallerName, setAdminEditInstallerName] = useState<string>('');
    const [adminEditValueInput, setAdminEditValueInput] = useState<string>('');
    const [isSavingAdminEdit, setIsSavingAdminEdit] = useState<boolean>(false);

    const handleOpenAdminEditModal = (item: TechnicalItem) => {
        if (!isAdmin) {
            alert('Apenas usuários com perfil de Administrador podem editar instalador e valores.');
            return;
        }
        setAdminEditModalItem(item);
        
        let matchedId = item.installerId || '';
        if (!matchedId && item.installerName && item.installerName !== 'Não Definido') {
            const found = installers.find(i => i.nome.trim().toLowerCase() === item.installerName.trim().toLowerCase());
            if (found) matchedId = found.id;
        }
        setAdminEditInstallerId(matchedId);
        setAdminEditInstallerName(item.installerName || '');

        const currentBase = item.baseAmount !== undefined ? item.baseAmount : (item.amount - (item.extraValor || 0));
        setAdminEditValueInput(currentBase > 0 ? String(currentBase).replace('.', ',') : '');
    };

    const handleSaveAdminEdit = async () => {
        if (!adminEditModalItem || !isAdmin) return;
        setIsSavingAdminEdit(true);
        try {
            const newValNum = parseSafeNumber(adminEditValueInput);
            let finalInstallerName = adminEditInstallerName.trim();
            let finalInstallerId = adminEditInstallerId;

            if (finalInstallerId && finalInstallerId !== '__custom__') {
                const matched = installers.find(i => String(i.id) === String(finalInstallerId));
                if (matched) {
                    finalInstallerName = matched.nome.trim();
                }
            } else if (finalInstallerId === '__custom__') {
                finalInstallerId = '';
            }
            if (!finalInstallerName) {
                finalInstallerName = 'Não Definido';
            }

            // 1. Se for Instalação originada de orçamento
            if (adminEditModalItem.isFromOrcamento) {
                const orcId = adminEditModalItem.id.replace('tx-inst-', '');
                const foundOrc = rawOrcamentos.find(o => String(o.id) === String(orcId)) || adminEditModalItem.rawOrcamento;

                // Salva no storage local persistente específico de custom edits da página de Reembolso
                // CRÍTICO: Não altera a tabela 'orcamentos' nem as propostas originais, mantendo o orçamento intacto
                let localMap: Record<string, any> = {};
                try {
                    const localMapStr = localStorage.getItem('orner_instalacao_custom_edits') || '{}';
                    localMap = JSON.parse(localMapStr);
                    const overrideData = {
                        installerId: finalInstallerId,
                        installerName: finalInstallerName,
                        baseAmount: newValNum
                    };
                    localMap[adminEditModalItem.id] = overrideData;
                    localMap[String(orcId)] = overrideData;
                    localStorage.setItem('orner_instalacao_custom_edits', JSON.stringify(localMap));
                } catch (e) {
                    console.warn('Erro ao atualizar localStorage orner_instalacao_custom_edits:', e);
                }

                // Sincroniza em system_configs para persistência na nuvem específica da página de reembolso
                try {
                    await dataService.save('system_configs', {
                        id: 'reembolso_instalacao_custom_edits',
                        value: JSON.stringify(localMap)
                    });
                } catch (scErr) {
                    console.warn('Erro ao sincronizar custom edits em system_configs:', scErr);
                }

                const extraVal = adminEditModalItem.extraValor || 0;
                const extraDesc = adminEditModalItem.extraDesc || '';
                const newTotalAmount = newValNum + extraVal;

                // Breakdown reflete os dados ajustados para o reembolso sem alterar o objeto orcamento original
                const newBreakdown = computeCostBreakdown(foundOrc?.formState, undefined, extraDesc, extraVal, newValNum);

                setAllItems(prev => prev.map(it => {
                    if (it.id === adminEditModalItem.id) {
                        return {
                            ...it,
                            installerId: finalInstallerId || undefined,
                            installerName: finalInstallerName,
                            baseAmount: newValNum,
                            amount: newTotalAmount,
                            breakdown: newBreakdown
                        };
                    }
                    return it;
                }));

                if (modalDetailItem && modalDetailItem.id === adminEditModalItem.id) {
                    setModalDetailItem({
                        ...modalDetailItem,
                        installerId: finalInstallerId || undefined,
                        installerName: finalInstallerName,
                        baseAmount: newValNum,
                        amount: newTotalAmount,
                        breakdown: newBreakdown
                    });
                }
            } else if (adminEditModalItem.rawTx) {
                // Se for Transação Direta (Lavagem)
                const tx = adminEditModalItem.rawTx;
                const updatedTx: FinancialTransaction = {
                    ...tx,
                    amount: newValNum,
                    description: adminEditModalItem.description.includes(' - ') 
                        ? `${adminEditModalItem.description.split(' - ')[0]} - ${adminEditModalItem.clientName} (${finalInstallerName})`
                        : adminEditModalItem.description
                };

                try {
                    await dataService.save('financial_transactions', updatedTx);
                } catch (txErr) {
                    console.warn('dataService.save financial_transactions warning:', txErr);
                }

                setAllTransactions(prev => prev.map(t => t.id === tx.id ? updatedTx : t));

                setAllItems(prev => prev.map(it => {
                    if (it.id === adminEditModalItem.id) {
                        return {
                            ...it,
                            installerId: finalInstallerId || undefined,
                            installerName: finalInstallerName,
                            amount: newValNum,
                            rawTx: updatedTx,
                            breakdown: computeCostBreakdown(undefined, updatedTx)
                        };
                    }
                    return it;
                }));

                if (modalDetailItem && modalDetailItem.id === adminEditModalItem.id) {
                    setModalDetailItem({
                        ...modalDetailItem,
                        installerId: finalInstallerId || undefined,
                        installerName: finalInstallerName,
                        amount: newValNum,
                        rawTx: updatedTx,
                        breakdown: computeCostBreakdown(undefined, updatedTx)
                    });
                }
            }

            setAdminEditModalItem(null);
        } catch (e: any) {
            alert("Erro ao salvar alterações: " + (e?.message || "Tente novamente"));
        } finally {
            setIsSavingAdminEdit(false);
        }
    };

    // Hover and Modal Breakdown inspection states
    const [hoveredItemInfo, setHoveredItemInfo] = useState<{ item: TechnicalItem; rect: DOMRect } | null>(null);
    const [modalDetailItem, setModalDetailItem] = useState<TechnicalItem | null>(null);
    const hoverTimeoutRef = useRef<any>(null);

    const handleMouseEnterItem = (item: TechnicalItem, e: React.MouseEvent<HTMLElement>) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        const rect = e.currentTarget.getBoundingClientRect();
        setHoveredItemInfo({ item, rect });
    };

    const handleMouseLeaveItem = () => {
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredItemInfo(null);
        }, 300);
    };

    const handlePopoverMouseEnter = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };

    const handlePopoverMouseLeave = () => {
        setHoveredItemInfo(null);
    };
    
    // Extra Service Modal state
    const [extraServiceModalItem, setExtraServiceModalItem] = useState<TechnicalItem | null>(null);
    const [extraDescInput, setExtraDescInput] = useState<string>('');
    const [extraValorInput, setExtraValorInput] = useState<string>('');
    const [isSavingExtraService, setIsSavingExtraService] = useState<boolean>(false);

    const handleOpenExtraServiceModal = (item: TechnicalItem) => {
        setExtraServiceModalItem(item);
        setExtraDescInput(item.extraDesc || '');
        setExtraValorInput(item.extraValor !== undefined && Math.abs(item.extraValor) > 0.001 ? String(item.extraValor).replace('.', ',') : '');
    };

    const handleSaveExtraService = async () => {
        if (!extraServiceModalItem) return;
        setIsSavingExtraService(true);
        try {
            const valNum = parseSafeNumber(extraValorInput);
            const descTrim = extraDescInput.trim() || (valNum < 0 ? 'Dedução / Ajuste na Instalação' : 'Serviço Extra na Instalação');
            const orcId = extraServiceModalItem.id.replace('tx-inst-', '');

            // 1. Localiza o orçamento (em rawOrcamentos ou na referência direta do item)
            const foundOrc = rawOrcamentos.find(o => String(o.id) === String(orcId)) || extraServiceModalItem.rawOrcamento;
            
            // 2. Grava no storage local persistente específico de serviços extras (à prova de falhas)
            try {
                const localMapStr = localStorage.getItem('orner_servicos_extras') || '{}';
                const localMap = JSON.parse(localMapStr);
                if (Math.abs(valNum) > 0.001 || (descTrim && valNum !== 0)) {
                    localMap[extraServiceModalItem.id] = { desc: descTrim, valor: valNum };
                    localMap[String(orcId)] = { desc: descTrim, valor: valNum };
                } else {
                    delete localMap[extraServiceModalItem.id];
                    delete localMap[String(orcId)];
                }
                localStorage.setItem('orner_servicos_extras', JSON.stringify(localMap));
            } catch (e) {
                console.warn('Erro ao atualizar localStorage orner_servicos_extras:', e);
            }

            let updatedOrc: SavedOrcamento | undefined;
            let baseFs: any = {};

            if (foundOrc) {
                const v: any = foundOrc.variants?.find((x: any) => x.isPrincipal) || foundOrc.variants?.[0] || {};
                baseFs = { ...foundOrc.formState, ...(v.formState || {}) };

                const updatedFormState = {
                    ...(foundOrc.formState || {}),
                    instalacao_servico_extra_desc: descTrim,
                    instalacao_servico_extra_valor: valNum
                };

                const variantsToUpdate = (foundOrc.variants && foundOrc.variants.length > 0)
                    ? foundOrc.variants
                    : [{ id: 'default', name: 'Principal', isPrincipal: true, formState: {}, calculated: {} }];

                const updatedVariants = variantsToUpdate.map((vari: any, idx: number) => {
                    if (idx === 0 || vari.isPrincipal) {
                        return {
                            ...vari,
                            formState: {
                                ...(vari.formState || {}),
                                instalacao_servico_extra_desc: descTrim,
                                instalacao_servico_extra_valor: valNum
                            }
                        };
                    }
                    return vari;
                });

                updatedOrc = {
                    ...foundOrc,
                    formState: updatedFormState,
                    variants: updatedVariants,
                    instalacao_servico_extra_desc: descTrim,
                    instalacao_servico_extra_valor: valNum
                } as any;

                // Salva via dataService (atualiza cache do sistema e banco)
                try {
                    await dataService.save('orcamentos', updatedOrc!);
                } catch (saveErr) {
                    console.warn('dataService.save orcamentos warning:', saveErr);
                }

                // Tenta atualizar colunas dedicadas no Supabase (se já criadas via SQL)
                try {
                    const { error: colErr } = await supabase.from('orcamentos').update({
                        formState: updatedFormState,
                        variants: updatedVariants,
                        instalacao_servico_extra_desc: descTrim,
                        instalacao_servico_extra_valor: valNum
                    }).eq('id', orcId);

                    if (colErr) {
                        await supabase.from('orcamentos').update({
                            formState: updatedFormState,
                            variants: updatedVariants
                        }).eq('id', orcId);
                    }
                } catch (colErr) {
                    console.warn('Supabase update colunas warning:', colErr);
                }

                setRawOrcamentos(prev => prev.map(o => String(o.id) === String(orcId) ? updatedOrc! : o));
            } else {
                baseFs = {
                    instalacao_servico_extra_desc: descTrim,
                    instalacao_servico_extra_valor: valNum
                };
            }

            // 3. Recalcula o item e reflete imediatamente na tela, detalhamento e no somatório
            const qtd = parseSafeNumber(baseFs.terceiroInstalacaoQtd);
            const custo = parseSafeNumber(baseFs.terceiroInstalacaoCusto);
            const instalacaoMaoDeObra = qtd * custo;
            const adequacaoLocal = parseSafeNumber(baseFs.adequacaoLocalCusto);
            
            let baseAmount = extraServiceModalItem.baseAmount !== undefined 
                ? extraServiceModalItem.baseAmount 
                : (instalacaoMaoDeObra + adequacaoLocal);
            if (baseAmount === 0) {
                baseAmount = parseSafeNumber(baseFs.projetoInstalacaoCusto);
            }
            if (baseAmount === 0 && extraServiceModalItem.amount > 0) {
                baseAmount = Math.max(0, extraServiceModalItem.amount - (extraServiceModalItem.extraValor || 0));
            }

            const newAmount = baseAmount + valNum;
            const newBreakdown = computeCostBreakdown(baseFs, undefined, descTrim, valNum);

            setAllItems(prev => prev.map(it => {
                if (it.id === extraServiceModalItem.id) {
                    return {
                        ...it,
                        amount: newAmount,
                        baseAmount,
                        extraDesc: descTrim,
                        extraValor: valNum,
                        rawOrcamento: updatedOrc || it.rawOrcamento,
                        breakdown: newBreakdown
                    };
                }
                return it;
            }));

            // Atualiza modal de detalhamento se estiver aberto
            setModalDetailItem(prev => {
                if (prev && prev.id === extraServiceModalItem.id) {
                    return {
                        ...prev,
                        amount: newAmount,
                        baseAmount,
                        extraDesc: descTrim,
                        extraValor: valNum,
                        rawOrcamento: updatedOrc || prev.rawOrcamento,
                        breakdown: newBreakdown
                    };
                }
                return prev;
            });

            // Atualiza popover se ativo
            setHoveredItemInfo(prev => {
                if (prev && prev.item.id === extraServiceModalItem.id) {
                    return {
                        ...prev,
                        item: {
                            ...prev.item,
                            amount: newAmount,
                            baseAmount,
                            extraDesc: descTrim,
                            extraValor: valNum,
                            rawOrcamento: updatedOrc || prev.item.rawOrcamento,
                            breakdown: newBreakdown
                        }
                    };
                }
                return prev;
            });

            setExtraServiceModalItem(null);
        } catch (e: any) {
            alert("Erro ao salvar serviço extra: " + (e?.message || "Tente novamente"));
        } finally {
            setIsSavingExtraService(false);
        }
    };

    const handleRemoveExtraService = async (itemToRemove?: TechnicalItem) => {
        const targetItem = itemToRemove || extraServiceModalItem;
        if (!targetItem) return;
        setIsSavingExtraService(true);
        try {
            const orcId = targetItem.id.replace('tx-inst-', '');
            const foundOrc = rawOrcamentos.find(o => String(o.id) === String(orcId)) || targetItem.rawOrcamento;

            // 1. Limpa do storage local persistente
            try {
                const localMapStr = localStorage.getItem('orner_servicos_extras') || '{}';
                const localMap = JSON.parse(localMapStr);
                delete localMap[targetItem.id];
                delete localMap[String(orcId)];
                localStorage.setItem('orner_servicos_extras', JSON.stringify(localMap));
            } catch (e) {
                console.warn('Erro ao limpar localStorage orner_servicos_extras:', e);
            }

            let updatedOrc: SavedOrcamento | undefined;
            let baseFs: any = {};

            if (foundOrc) {
                const v: any = foundOrc.variants?.find((x: any) => x.isPrincipal) || foundOrc.variants?.[0] || {};
                baseFs = { ...foundOrc.formState, ...(v.formState || {}) };

                const updatedFormState = {
                    ...(foundOrc.formState || {}),
                    instalacao_servico_extra_desc: '',
                    instalacao_servico_extra_valor: 0
                };

                const variantsToUpdate = (foundOrc.variants && foundOrc.variants.length > 0)
                    ? foundOrc.variants
                    : [{ id: 'default', name: 'Principal', isPrincipal: true, formState: {}, calculated: {} }];

                const updatedVariants = variantsToUpdate.map((vari: any, idx: number) => {
                    if (idx === 0 || vari.isPrincipal) {
                        return {
                            ...vari,
                            formState: {
                                ...(vari.formState || {}),
                                instalacao_servico_extra_desc: '',
                                instalacao_servico_extra_valor: 0
                            }
                        };
                    }
                    return vari;
                });

                updatedOrc = {
                    ...foundOrc,
                    formState: updatedFormState,
                    variants: updatedVariants,
                    instalacao_servico_extra_desc: '',
                    instalacao_servico_extra_valor: 0
                } as any;

                try {
                    await dataService.save('orcamentos', updatedOrc!);
                } catch (saveErr) {
                    console.warn('dataService.save orcamentos warning:', saveErr);
                }

                try {
                    const { error: colErr } = await supabase.from('orcamentos').update({
                        formState: updatedFormState,
                        variants: updatedVariants,
                        instalacao_servico_extra_desc: null,
                        instalacao_servico_extra_valor: 0
                    }).eq('id', orcId);

                    if (colErr) {
                        await supabase.from('orcamentos').update({
                            formState: updatedFormState,
                            variants: updatedVariants
                        }).eq('id', orcId);
                    }
                } catch (err) {
                    console.warn('Supabase colunas remove warning:', err);
                }

                setRawOrcamentos(prev => prev.map(o => String(o.id) === String(orcId) ? updatedOrc! : o));
            }

            const qtd = parseSafeNumber(baseFs.terceiroInstalacaoQtd);
            const custo = parseSafeNumber(baseFs.terceiroInstalacaoCusto);
            const instalacaoMaoDeObra = qtd * custo;
            const adequacaoLocal = parseSafeNumber(baseFs.adequacaoLocalCusto);
            
            let baseAmount = targetItem.baseAmount !== undefined 
                ? targetItem.baseAmount 
                : (instalacaoMaoDeObra + adequacaoLocal);
            if (baseAmount === 0) {
                baseAmount = parseSafeNumber(baseFs.projetoInstalacaoCusto);
            }
            if (baseAmount === 0 && targetItem.amount > 0) {
                baseAmount = Math.max(0, targetItem.amount - (targetItem.extraValor || 0));
            }

            const newBreakdown = computeCostBreakdown(baseFs, undefined, '', 0);

            setAllItems(prev => prev.map(it => {
                if (it.id === targetItem.id) {
                    return {
                        ...it,
                        amount: baseAmount,
                        baseAmount,
                        extraDesc: '',
                        extraValor: 0,
                        rawOrcamento: updatedOrc || it.rawOrcamento,
                        breakdown: newBreakdown
                    };
                }
                return it;
            }));

            setModalDetailItem(prev => {
                if (prev && prev.id === targetItem.id) {
                    return {
                        ...prev,
                        amount: baseAmount,
                        baseAmount,
                        extraDesc: '',
                        extraValor: 0,
                        rawOrcamento: updatedOrc || prev.rawOrcamento,
                        breakdown: newBreakdown
                    };
                }
                return prev;
            });

            setHoveredItemInfo(prev => {
                if (prev && prev.item.id === targetItem.id) {
                    return {
                        ...prev,
                        item: {
                            ...prev.item,
                            amount: baseAmount,
                            baseAmount,
                            extraDesc: '',
                            extraValor: 0,
                            rawOrcamento: updatedOrc || prev.item.rawOrcamento,
                            breakdown: newBreakdown
                        }
                    };
                }
                return prev;
            });

            setExtraServiceModalItem(null);
        } catch (e: any) {
            alert("Erro ao remover serviço extra: " + (e?.message || "Tente novamente"));
        } finally {
            setIsSavingExtraService(false);
        }
    };
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Valida se o relatório fornecido é de fato um faturamento técnico de Instalação/Lavagem
    const activeReport = useMemo(() => {
        if (!reportToEdit) return null;
        const isTech = Boolean(
            reportToEdit.isInstallmentWash || 
            (reportToEdit.id && String(reportToEdit.id).startsWith('tech-')) ||
            (reportToEdit.items && reportToEdit.items.some(i => String(i.id).startsWith('tx-inst-')))
        );
        return isTech ? reportToEdit : null;
    }, [reportToEdit]);

    const isReadOnly = useMemo(() => activeReport ? activeReport.status !== 'Rascunho' : false, [activeReport]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const currentUserId = currentUser?.id || '1767988420092';

            const [txsRes, catsRes, reportsRes, configsRes, instsRes, orcsRes, profsRes] = await Promise.allSettled([
                dataService.getAll<FinancialTransaction>('financial_transactions', currentUserId, true),
                dataService.getAll<FinancialCategory>('financial_categories'),
                dataService.getAll<ExpenseReport>('expense_reports', undefined, true),
                dataService.getAll<any>('system_configs', undefined, true),
                dataService.getAll<Instalador>('instaladores'),
                dataService.getPartial<SavedOrcamento>('orcamentos', 'id, status, formState, variants, venda_etapas', undefined, true),
                dataService.getAll<UserProfile>('system_profiles', undefined, true)
            ]);

            const txs = txsRes.status === 'fulfilled' ? txsRes.value : [];
            const cats = catsRes.status === 'fulfilled' ? catsRes.value : [];
            const allReports = reportsRes.status === 'fulfilled' ? reportsRes.value : [];
            const remoteConfigs = configsRes.status === 'fulfilled' ? configsRes.value : [];
            const insts = instsRes.status === 'fulfilled' ? instsRes.value : [];
            let orcs = orcsRes.status === 'fulfilled' ? orcsRes.value : [];
            const profs = profsRes.status === 'fulfilled' ? profsRes.value : [];
            setProfiles(profs || []);

            // Se orçamentos não vieram ou falharam por lentidão da rede, tenta busca direta no Supabase
            if (!orcs || orcs.length === 0) {
                try {
                    const { data: directOrcs } = await supabase
                        .from('orcamentos')
                        .select('id, status, formState, variants, venda_etapas');
                    if (directOrcs && directOrcs.length > 0) {
                        orcs = directOrcs as any[];
                    }
                } catch (fallbackErr) {
                    console.warn('[FALLBACK] Erro na busca direta de orçamentos:', fallbackErr);
                }
            }

            setRawOrcamentos(orcs || []);

            // Tenta consultar colunas dedicadas caso já criadas no Supabase
            let extraColsMap: Record<string, { desc: string; valor: number }> = {};
            try {
                const { data: extrasData } = await supabase
                    .from('orcamentos')
                    .select('id, instalacao_servico_extra_desc, instalacao_servico_extra_valor');
                if (extrasData) {
                    extrasData.forEach((row: any) => {
                        extraColsMap[String(row.id)] = {
                            desc: row.instalacao_servico_extra_desc || '',
                            valor: parseSafeNumber(row.instalacao_servico_extra_valor)
                        };
                    });
                }
            } catch (e) {
                // Colunas ainda não criadas no Supabase SQL, formState/localStorage será utilizado
            }

            // Fallback em LocalStorage para garantir persistência total mesmo antes de executar migration no Supabase
            let localExtrasMap: Record<string, { desc: string; valor: number }> = {};
            try {
                const rawLocal = localStorage.getItem('orner_servicos_extras');
                if (rawLocal) {
                    localExtrasMap = JSON.parse(rawLocal);
                }
            } catch (e) {}

            // Carrega edições do perfil Administrador (instalador e valor) da página de Reembolso
            let localAdminEditsMap: Record<string, { installerId?: string; installerName?: string; baseAmount?: number }> = {};
            try {
                const rawLocalEdits = localStorage.getItem('orner_instalacao_custom_edits');
                if (rawLocalEdits) {
                    localAdminEditsMap = JSON.parse(rawLocalEdits);
                }
            } catch (e) {}

            const remoteAdminEdits = (remoteConfigs || []).find((c: any) => c.id === 'reembolso_instalacao_custom_edits');
            if (remoteAdminEdits && remoteAdminEdits.value) {
                try {
                    const parsedRemote = typeof remoteAdminEdits.value === 'string'
                        ? JSON.parse(remoteAdminEdits.value)
                        : remoteAdminEdits.value;
                    localAdminEditsMap = { ...parsedRemote, ...localAdminEditsMap };
                } catch (e) {}
            }

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
                    .filter(r => !activeReport || r.id !== activeReport.id)
                    .flatMap(r => (r.items || []).map(item => item.id))
            );

            // Mapeia relatórios já efetivamente PAGOS para evitar trazer qualquer coisa já quitada
            const paidReportTxIds = new Set(
                (allReports || [])
                    .filter(r => r.status === 'Pago')
                    .flatMap(r => (r.items || []).map(item => item.id))
            );

            const paidFinanceTxIds = new Set(
                (txs || [])
                    .filter(t => t.status === 'pago')
                    .map(t => t.id)
            );

            // Categoria de instalação padrão
            const instalacaoCat = (cats || []).find(c => {
                const n = (c.name || '').toLowerCase();
                return n === 'instalação' || n === 'instalacao';
            }) || (cats || []).find(c => (c.name || '').toLowerCase().includes('instal')) || { id: 'instalação-1768270771212', name: 'Instalação' };

            const items: TechnicalItem[] = [];

            // 1. Processa somente Orçamentos APROVADOS e com a flag "Instalação Finalizada" marcada
            (orcs || []).forEach(o => {
                const statusClean = (o.status || '').trim().toLowerCase();
                const etapas = (o.venda_etapas || {}) as any;
                const isApproved = statusClean === 'aprovado';
                const isFinalizada = Boolean(etapas.instalacao_finalizada);
                const txId = `tx-inst-${o.id}`;

                // Verifica se já foi efetivamente pago
                const isPaid = paidReportTxIds.has(txId) || 
                               paidFinanceTxIds.has(txId) || 
                               (Boolean(etapas.pag_instalacao) && statusClean === 'finalizado');

                // Regra estrita: Somente orçamentos classificados como Aprovados na lista de orçamentos,
                // com a flag de "Instalação Finalizada" assinalada e que ainda não foram pagos
                if (isApproved && isFinalizada && !isPaid) {
                    const v: any = o.variants?.find((x: any) => x.isPrincipal) || o.variants?.[0] || {};
                    const fs: any = { ...o.formState, ...(v.formState || {}) };

                    const clientName = (fs.nomeCliente || 'Cliente sem nome').trim();

                    let installerId = fs.instaladorId || '';
                    let installerName = '';

                    if (installerId) {
                        const found = activeInstallers.find(i => String(i.id) === String(installerId));
                        if (found) installerName = found.nome.trim();
                    }
                    if (!installerName && fs.instaladorNome) {
                        installerName = fs.instaladorNome.trim();
                    }
                    if (!installerName) {
                        installerName = 'Não Definido';
                    }

                    // Regra: Considera somente Instalação (terceiroInstalacaoQtd * terceiroInstalacaoCusto) e Adequação (adequacaoLocalCusto).
                    // Projeto/homologação, deslocamento, pedágio e visita técnica não são considerados nesta soma.
                    const qtd = parseSafeNumber(fs.terceiroInstalacaoQtd);
                    const custo = parseSafeNumber(fs.terceiroInstalacaoCusto);
                    const instalacaoMaoDeObra = qtd * custo;
                    const adequacaoLocal = parseSafeNumber(fs.adequacaoLocalCusto);

                    let baseAmount = instalacaoMaoDeObra + adequacaoLocal;
                    if (baseAmount === 0) {
                        baseAmount = parseSafeNumber(fs.projetoInstalacaoCusto);
                    }

                    // Aplica customizações salvas pelo Administrador exclusivamente para a página de Reembolso
                    const adminOverride = localAdminEditsMap[txId] || localAdminEditsMap[String(o.id)];
                    if (adminOverride) {
                        if (adminOverride.installerId) installerId = adminOverride.installerId;
                        if (adminOverride.installerName) installerName = adminOverride.installerName;
                        if (adminOverride.baseAmount !== undefined && adminOverride.baseAmount > 0) {
                            baseAmount = adminOverride.baseAmount;
                        }
                    }

                    // Extra Service
                    const extraCol = extraColsMap[String(o.id)];
                    const localExtra = localExtrasMap[`tx-inst-${o.id}`] || localExtrasMap[String(o.id)];
                    const extraDesc = (
                        extraCol?.desc || 
                        fs.instalacao_servico_extra_desc || 
                        fs.instalacaoServicoExtraDesc || 
                        (o as any).instalacao_servico_extra_desc || 
                        localExtra?.desc || 
                        ''
                    ).trim();
                    const extraValor = (extraCol && Math.abs(extraCol.valor) > 0.001)
                        ? extraCol.valor
                        : parseSafeNumber(
                            fs.instalacao_servico_extra_valor ?? 
                            fs.instalacaoServicoExtraValor ?? 
                            (o as any).instalacao_servico_extra_valor ?? 
                            localExtra?.valor ?? 
                            0
                        );

                    const amount = baseAmount + extraValor;

                    const rawEtapas: any = etapas;
                    const date = rawEtapas.instalacao_finalizada_data || rawEtapas.instalacao_data || new Date().toISOString().split('T')[0];
                    const txIdItem = `tx-inst-${o.id}`;

                    const isSolicitado = Boolean(etapas.pag_instalacao_solicitado) || usedTxIdsInOtherReports.has(txIdItem);

                    items.push({
                        id: txIdItem,
                        description: `Instalação - ${clientName}`,
                        amount: Number(amount) || 0,
                        baseAmount,
                        dueDate: date,
                        launchDate: date,
                        categoryId: instalacaoCat.id,
                        categoryName: 'Instalação',
                        installerId: installerId || undefined,
                        installerName,
                        clientName,
                        itemType: 'INSTALACAO',
                        statusPagamento: isSolicitado ? 'solicitado' : 'pendente',
                        isFromOrcamento: true,
                        rawOrcamento: o,
                        extraDesc,
                        extraValor,
                        breakdown: computeCostBreakdown(fs, undefined, extraDesc, extraValor, adminOverride ? baseAmount : undefined)
                    });
                }
            });

            // 2. Processa Transações Financeiras diretas pendentes de Lavagem
            const targetCatIds = (cats || [])
                .filter(c => {
                    const name = (c.name || '').toLowerCase();
                    return name.includes('lavagem');
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
                    const catName = cat?.name || 'Lavagem';

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
                        installerName: matchedInst ? matchedInst.nome.trim() : 'Equipe Técnica',
                        clientName: t.description.replace('Instalação - ', '').replace('Lavagem - ', ''),
                        itemType: 'LAVAGEM',
                        statusPagamento: 'pendente',
                        rawTx: t,
                        breakdown: computeCostBreakdown(undefined, t)
                    });
                }
            });

            setAllItems(items.sort((a, b) => (b.dueDate || '').localeCompare(a.dueDate || '')));

            if (activeReport && activeReport.items) {
                const draftIds = activeReport.items.map(i => i.id);
                setSelectedTxIds(draftIds);
                setAttachments(activeReport.attachments || []);
            }

        } catch (e) {
            console.error("Erro ao carregar dados técnicos:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [activeReport, currentUser?.id]);

    // Itens acessíveis conforme perfil e vínculo de instalador:
    // Administrador tem visão total de todas as obras e instaladores.
    // Instaladores (não-admin) visualizam estritamente as suas próprias instalações.
    const accessibleItems = useMemo(() => {
        if (isAdmin) return allItems;
        if (userLinkedInstaller) {
            return allItems.filter(item => isItemForInstaller(item, userLinkedInstaller));
        }
        const currentProfile = profiles.find(p => String(p.id) === String(currentUser?.profileId));
        if (currentProfile?.hasGlobalView) return allItems;
        return [];
    }, [allItems, isAdmin, userLinkedInstaller, currentUser, profiles]);

    // Lista única de nomes de instaladores presentes nos dados
    const distinctInstallers = useMemo(() => {
        if (!isAdmin && userLinkedInstaller) {
            return [userLinkedInstaller.nome.trim()];
        }
        const set = new Set<string>();
        // Adiciona instaladores cadastrados
        installers.forEach(i => set.add(i.nome.trim()));
        // Adiciona nomes que aparecem nos itens acessíveis
        accessibleItems.forEach(i => {
            if (i.installerName && i.installerName !== 'Não Definido') {
                set.add(i.installerName.trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [installers, accessibleItems, isAdmin, userLinkedInstaller]);

    // Contagem de itens por instalador
    const installerCounts = useMemo(() => {
        const counts: Record<string, { pendentes: number; total: number }> = {
            ALL: { pendentes: 0, total: 0 },
            UNASSIGNED: { pendentes: 0, total: 0 }
        };

        distinctInstallers.forEach(name => {
            counts[name] = { pendentes: 0, total: 0 };
        });

        accessibleItems.forEach(item => {
            const isPendente = item.statusPagamento === 'pendente';
            const name = item.installerName ? item.installerName.trim() : 'Não Definido';

            counts.ALL.total += 1;
            if (isPendente) counts.ALL.pendentes += 1;

            if (name !== 'Não Definido' && counts[name]) {
                counts[name].total += 1;
                if (isPendente) counts[name].pendentes += 1;
            } else {
                counts.UNASSIGNED.total += 1;
                if (isPendente) counts.UNASSIGNED.pendentes += 1;
            }
        });

        return counts;
    }, [accessibleItems, distinctInstallers]);

    // Lista filtrada pelo instalador selecionado, status e busca
    const filteredItems = useMemo(() => {
        return accessibleItems.filter(item => {
            // Filtro por status
            if (statusFilter === 'pendentes' && item.statusPagamento !== 'pendente') {
                // Em modo edição de rascunho, permite ver os itens já selecionados
                if (!reportToEdit || !selectedTxIds.includes(item.id)) {
                    return false;
                }
            }

            // Filtro por instalador (apenas para Admin que pode alternar abas de instaladores)
            if (isAdmin && selectedInstallerFilter !== 'ALL') {
                const name = item.installerName ? item.installerName.trim() : 'Não Definido';
                if (selectedInstallerFilter === 'UNASSIGNED') {
                    if (name !== 'Não Definido') return false;
                } else if (name !== selectedInstallerFilter) {
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
    }, [accessibleItems, selectedInstallerFilter, statusFilter, searchTerm, activeReport, selectedTxIds, isAdmin]);

    const selectedTotal = useMemo(() => {
        if (isReadOnly && activeReport) {
            return activeReport.totalValue || (activeReport.items || []).reduce((acc, i) => acc + (i.others || 0), 0);
        }
        return accessibleItems
            .filter(t => selectedTxIds.includes(t.id))
            .reduce((acc, curr) => acc + curr.amount, 0);
    }, [selectedTxIds, accessibleItems, isReadOnly, activeReport]);

    const toggleSelection = (id: string) => {
        if (isReadOnly) return;
        const item = accessibleItems.find(i => i.id === id);
        if (item && item.statusPagamento === 'pago') return;

        setSelectedTxIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAllVisible = () => {
        if (isReadOnly) return;
        const selectableIds = filteredItems.filter(i => i.statusPagamento !== 'pago').map(i => i.id);
        const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedTxIds.includes(id));

        if (allSelected) {
            setSelectedTxIds(prev => prev.filter(id => !selectableIds.includes(id)));
        } else {
            setSelectedTxIds(prev => Array.from(new Set([...prev, ...selectableIds])));
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
            if (activeReport && activeReport.status === 'Rascunho') {
                setIsSaving(true);
                try {
                    await dataService.delete('expense_reports', activeReport.id);
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
            alert("A Nota Fiscal (NF) ou comprovante é obrigatório para solicitar pagamento.");
            return;
        }

        setIsSaving(true);
        setIsConfirmSubmitModalOpen(false);
        setIsConfirmDraftModalOpen(false);

        try {
            const selectedItems = accessibleItems.filter(t => selectedTxIds.includes(t.id));
            const reportId = activeReport ? activeReport.id : `tech-${Date.now()}`;
            const currentUserId = currentUser?.id || '1767988420092';
            
            // 1. Garante que cada item selecionado possua uma transação financeira gravada
            for (const item of selectedItems) {
                if (item.isFromOrcamento && item.rawOrcamento) {
                    const txPayload: FinancialTransaction = {
                        id: item.id,
                        owner_id: currentUserId,
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

                    // Atualiza o orçamento com a solicitação de faturamento
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
                    await dataService.save('financial_transactions', {
                        ...item.rawTx,
                        relatedReportId: reportId,
                        invoiceSent: (status === 'Transferido')
                    });
                }
            }

            // Identifica o instalador principal se houver
            const uniqueInstallerNames = Array.from(new Set(selectedItems.map(i => i.installerName).filter(n => n && n !== 'Não Definido')));
            const requesterLabel = (!isAdmin && userLinkedInstaller)
                ? `Instalador: ${userLinkedInstaller.nome}`
                : (uniqueInstallerNames.length === 1 
                    ? `Instalador: ${uniqueInstallerNames[0]}` 
                    : (activeReport ? activeReport.requester : (currentUser?.name || 'Administrador')));

            const finalReport: ExpenseReport = {
                id: reportId,
                owner_id: activeReport ? activeReport.owner_id : currentUserId,
                requester: requesterLabel,
                sector: 'Faturamento técnico',
                period: 'Instalações Finalizadas',
                periodStart: activeReport ? activeReport.periodStart : new Date().toISOString(),
                periodEnd: activeReport ? activeReport.periodEnd : new Date().toISOString(),
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
                createdAt: activeReport ? activeReport.createdAt : new Date().toISOString(),
                totalValue: selectedTotal,
                isInstallmentWash: true
            };

            await dataService.save('expense_reports', finalReport);

            if (status === 'Transferido') {
                setModalMessage("Instalações enviadas com sucesso! As ordens foram liberadas para auditoria e pagamento no Financeiro.");
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
            {activeReport?.status === 'Cancelado' && activeReport.cancelReason && (
                <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/50 p-6 rounded-3xl flex items-start gap-5 shadow-sm animate-fade-in">
                    <div className="p-3 bg-red-600 text-white rounded-2xl shadow-lg shrink-0">
                        <ExclamationTriangleIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h4 className="text-base font-black text-red-700 dark:text-red-400 tracking-tight">Faturamento Rejeitado</h4>
                        <p className="text-sm font-bold text-red-600 dark:text-red-500/80 mt-1 leading-relaxed">
                            Motivo do Administrativo: <span className="text-gray-800 dark:text-gray-100 font-black">"{activeReport.cancelReason}"</span>
                        </p>
                        <p className="text-xs font-bold text-red-400 mt-2 opacity-80">Verifique as notas e reenvie se necessário</p>
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
                            {isReadOnly ? 'Visualizar Faturamento' : activeReport ? 'Alterar Faturamento' : 'Faturamento de Instalações'}
                        </h1>
                        <p className="text-sm text-gray-500 font-bold mt-2">
                            {activeReport 
                                ? `Registro técnico: ${activeReport.id}` 
                                : (!isAdmin && userLinkedInstaller)
                                    ? `Instalações finalizadas de ${userLinkedInstaller.nome} liberadas para pagamento`
                                    : 'Instalações finalizadas agrupadas por instalador parceiro'}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-4">
                    <button
                        type="button"
                        onClick={() => loadData()}
                        disabled={isLoading}
                        className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 hover:bg-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95 disabled:opacity-60"
                        title="Recarregar dados do banco de dados"
                    >
                        <span className={`text-sm ${isLoading ? 'animate-spin inline-block' : ''}`}>↻</span>
                        <span>{isLoading ? 'Atualizando...' : 'Atualizar Dados'}</span>
                    </button>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 mb-0.5 tracking-tighter">Total Selecionado</p>
                        <p className="text-3xl font-black text-cyan-600 leading-tight">{formatCurrency(selectedTotal)}</p>
                    </div>
                </div>
            </div>

            {/* Filtros Superiores: Abas de Status e Filtro por Instalador */}
            {!isReadOnly && (
                <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-5">
                    {/* Linha 1: Abas de Status (Aguardando Pagamento vs Todas) */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900/60 p-1.5 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('pendentes')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                    statusFilter === 'pendentes'
                                        ? 'bg-white dark:bg-gray-800 text-cyan-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <ClockIcon className="w-4 h-4" />
                                <span>Aguardando Pagamento</span>
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                                    {installerCounts.ALL?.pendentes || 0}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusFilter('todas')}
                                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                    statusFilter === 'todas'
                                        ? 'bg-white dark:bg-gray-800 text-cyan-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                                    }`}
                            >
                                <TableIcon className="w-4 h-4" />
                                <span>Todas / Histórico</span>
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                    {installerCounts.ALL?.total || 0}
                                </span>
                            </button>
                        </div>

                        {filteredItems.filter(i => i.statusPagamento !== 'pago').length > 0 && (
                            <button
                                type="button"
                                onClick={handleSelectAllVisible}
                                className="px-4 py-2 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-900/20 dark:hover:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-xl text-xs font-black transition-all border border-cyan-200 dark:border-cyan-800"
                            >
                                {filteredItems.filter(i => i.statusPagamento !== 'pago').every(i => selectedTxIds.includes(i.id))
                                    ? 'Desmarcar todos'
                                    : 'Selecionar todos disponíveis'}
                            </button>
                        )}
                    </div>

                    {/* Linha 2: Seletor de Instaladores / Indicador de Vínculo Exclusivo */}
                    {!isAdmin && userLinkedInstaller ? (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-cyan-500/10 via-cyan-500/5 to-transparent rounded-2xl border border-cyan-200 dark:border-cyan-800/60">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
                                    <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-gray-900 dark:text-white">
                                        Instalações vinculadas a: <span className="text-cyan-600 dark:text-cyan-400">{userLinkedInstaller.nome}</span>
                                    </h4>
                                    <p className="text-[11px] text-gray-500 font-medium">
                                        Você tem acesso exclusivo para visualizar e solicitar pagamento das suas próprias instalações.
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-black text-cyan-700 dark:text-cyan-300 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-cyan-100 dark:border-cyan-800 shadow-2xs self-start sm:self-auto">
                                <span>{filteredItems.length} {filteredItems.length === 1 ? 'obra disponível' : 'obras disponíveis'}</span>
                            </div>
                        </div>
                    ) : !isAdmin && !userLinkedInstaller ? (
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center gap-3">
                            <ExclamationTriangleIcon className="w-5 h-5 text-amber-600 shrink-0" />
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-200">
                                Seu usuário não está vinculado a um instalador cadastrado. Solicite ao administrador o vínculo no Cadastro de Usuários para visualizar suas instalações liberadas.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2">
                                <UsersIcon className="w-4 h-4 text-cyan-600" />
                                <span className="text-xs font-black text-gray-500 dark:text-gray-400">
                                    Filtrar por Instalador:
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedInstallerFilter('ALL')}
                                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                        selectedInstallerFilter === 'ALL'
                                            ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 scale-[1.02]'
                                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                    }`}
                                >
                                    <span>Todos os Instaladores</span>
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                        selectedInstallerFilter === 'ALL' ? 'bg-cyan-800 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200'
                                    }`}>
                                        {statusFilter === 'pendentes' ? installerCounts.ALL?.pendentes || 0 : installerCounts.ALL?.total || 0}
                                    </span>
                                </button>

                                {distinctInstallers.map(name => {
                                    const count = statusFilter === 'pendentes' ? installerCounts[name]?.pendentes || 0 : installerCounts[name]?.total || 0;
                                    const isSelected = selectedInstallerFilter === name;
                                    return (
                                        <button
                                            key={name}
                                            type="button"
                                            onClick={() => setSelectedInstallerFilter(name)}
                                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                                isSelected
                                                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30 scale-[1.02]'
                                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                            }`}
                                        >
                                            <span>{name}</span>
                                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                                                isSelected 
                                                    ? 'bg-cyan-800 text-white' 
                                                    : count > 0 
                                                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-300' 
                                                        : 'bg-gray-200 dark:bg-gray-600 text-gray-400'
                                            }`}>
                                                {count}
                                            </span>
                                        </button>
                                    );
                                })}

                                {(installerCounts.UNASSIGNED?.total > 0) && (
                                    <button
                                        type="button"
                                        onClick={() => setSelectedInstallerFilter('UNASSIGNED')}
                                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${
                                            selectedInstallerFilter === 'UNASSIGNED'
                                                ? 'bg-cyan-600 text-white shadow-md'
                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200'
                                        }`}
                                    >
                                        <span>Não atribuído</span>
                                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                                            {statusFilter === 'pendentes' ? installerCounts.UNASSIGNED?.pendentes || 0 : installerCounts.UNASSIGNED?.total || 0}
                                        </span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-8 2xl:col-span-9 space-y-4 min-w-0">
                    <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-50 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <h3 className="text-xs font-black text-gray-500 flex items-center gap-2">
                                <TableIcon className="w-4 h-4" /> 
                                {isReadOnly ? 'Itens do Faturamento' : `Instalações (${filteredItems.length} registros)`}
                            </h3>
                            {!isReadOnly && (
                                <div className="relative w-full sm:w-64">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por cliente ou obra..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 text-xs font-bold shadow-sm"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left table-auto">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 border-b">
                                    <tr>
                                        <th className="w-10 px-2.5 py-3 text-center"></th>
                                        <th className="px-3 py-3">Instalação / Obra</th>
                                        <th className="px-2.5 py-3 text-center whitespace-nowrap">Instalador</th>
                                        <th className="px-2.5 py-3 text-center whitespace-nowrap">Data Conclusão</th>
                                        <th className="px-2.5 py-3 text-center whitespace-nowrap">Status</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5 justify-end">
                                                <span>Valor Mão de Obra</span>
                                                <span 
                                                    className="p-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 hover:text-cyan-600 transition-colors cursor-help" 
                                                    title="Soma de Instalação e Adequação. Passe o mouse sobre o valor de cada linha para ver o detalhamento individual."
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {isReadOnly ? (
                                        (activeReport?.items || []).map(item => {
                                            const tx = allTransactions.find(t => t.id === item.id);
                                            const categoryName = tx 
                                                ? (categories.find(c => c.id === tx.categoryId)?.name || 'Instalação') 
                                                : 'Instalação / Lavagem';
                                            
                                            if (searchTerm && !item.description.toLowerCase().includes(searchTerm.toLowerCase())) {
                                                return null;
                                            }

                                            const orcId = item.id.replace('tx-inst-', '');
                                            const matchingTechnicalItem: TechnicalItem = allItems.find(it => it.id === item.id) || (() => {
                                                const foundOrc = rawOrcamentos.find(o => String(o.id) === String(orcId));
                                                if (foundOrc) {
                                                    const v: any = foundOrc.variants?.find((x: any) => x.isPrincipal) || foundOrc.variants?.[0] || {};
                                                    const fs: any = { ...foundOrc.formState, ...(v.formState || {}) };
                                                    const roExtraDesc = (foundOrc as any).instalacao_servico_extra_desc || fs.instalacao_servico_extra_desc || '';
                                                    const roExtraValor = parseSafeNumber((foundOrc as any).instalacao_servico_extra_valor ?? fs.instalacao_servico_extra_valor ?? 0);
                                                    return {
                                                        id: item.id,
                                                        description: item.description,
                                                        amount: Number(item.others) || 0,
                                                        dueDate: item.date,
                                                        launchDate: item.date,
                                                        categoryId: '',
                                                        categoryName: 'Instalação',
                                                        installerName: reportToEdit?.requester || 'Instalador',
                                                        clientName: item.description.replace('Instalação - ', ''),
                                                        itemType: 'INSTALACAO' as const,
                                                        statusPagamento: 'pago' as const,
                                                        isFromOrcamento: true,
                                                        rawOrcamento: foundOrc,
                                                        extraDesc: roExtraDesc,
                                                        extraValor: roExtraValor,
                                                        breakdown: computeCostBreakdown(fs, undefined, roExtraDesc, roExtraValor)
                                                    };
                                                }
                                                return {
                                                    id: item.id,
                                                    description: item.description,
                                                    amount: Number(item.others) || 0,
                                                    dueDate: item.date,
                                                    launchDate: item.date,
                                                    categoryId: '',
                                                    categoryName: 'Instalação / Lavagem',
                                                    installerName: reportToEdit?.requester || 'Instalador',
                                                    clientName: item.description.replace('Instalação - ', '').replace('Lavagem - ', ''),
                                                    itemType: 'INSTALACAO' as const,
                                                    statusPagamento: 'pago' as const,
                                                    breakdown: [
                                                        {
                                                            label: item.description,
                                                            detail: 'Valor faturado no relatório técnico',
                                                            value: Number(item.others) || 0,
                                                            isIncluded: true
                                                        }
                                                    ]
                                                };
                                            })();

                                            return (
                                                <tr 
                                                    key={item.id} 
                                                    className="bg-cyan-50/10 dark:bg-cyan-900/5 border-l-4 border-cyan-500 transition-all cursor-default"
                                                >
                                                    <td className="w-10 px-2.5 py-3.5 text-center">
                                                        <div className="w-6 h-6 rounded-lg bg-cyan-600 border-2 border-cyan-600 flex items-center justify-center shadow-md">
                                                            <CheckCircleIcon className="w-4 h-4 text-white" />
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <p className="text-xs font-black text-cyan-700 dark:text-cyan-400">{item.description}</p>
                                                        <p className="text-[9px] text-gray-400 font-bold mt-1 tracking-tighter">
                                                            {categoryName}
                                                        </p>
                                                    </td>
                                                    <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                                                            {reportToEdit?.requester || 'Instalador'}
                                                        </span>
                                                    </td>
                                                    <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                                                        <div className="flex flex-col items-center">
                                                            <CalendarIcon className="w-3.5 h-3.5 text-gray-300 mb-1" />
                                                            <span className="text-[11px] font-black text-gray-500">
                                                                {item.date ? new Date(item.date).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'Sem data'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                                                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                            Faturado
                                                        </span>
                                                    </td>
                                                    <td 
                                                        className="px-3 py-3.5 text-right whitespace-nowrap relative cursor-pointer"
                                                        onMouseEnter={(e) => handleMouseEnterItem(matchingTechnicalItem, e)}
                                                        onMouseLeave={handleMouseLeaveItem}
                                                        onClick={() => setModalDetailItem(matchingTechnicalItem)}
                                                    >
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setModalDetailItem(matchingTechnicalItem);
                                                                    }}
                                                                    className="p-1 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-all"
                                                                    title="Ver itens considerados neste total"
                                                                >
                                                                    <EyeIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <span className="text-sm font-black text-cyan-700 dark:text-cyan-400">
                                                                    {formatCurrency(item.others)}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setModalDetailItem(matchingTechnicalItem);
                                                                }}
                                                                className="text-[9px] font-bold text-gray-400 hover:text-cyan-600 transition-colors tracking-tight flex items-center gap-0.5 mt-0.5"
                                                            >
                                                                <span>Ver itens</span>
                                                                <span>▾</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        filteredItems.map(item => {
                                            const isSelected = selectedTxIds.includes(item.id);
                                            const isPaid = item.statusPagamento === 'pago';
                                            const isSolicitado = item.statusPagamento === 'solicitado';

                                            return (
                                                <tr 
                                                    key={item.id} 
                                                    onClick={() => !isPaid && toggleSelection(item.id)}
                                                    className={`transition-all ${
                                                        isPaid 
                                                            ? 'opacity-60 bg-gray-50/40 dark:bg-gray-800/20 cursor-not-allowed' 
                                                            : isSelected 
                                                                ? 'bg-cyan-50 dark:bg-cyan-900/20 border-l-4 border-cyan-500 cursor-pointer' 
                                                                : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30 cursor-pointer'
                                                    }`}
                                                >
                                                    <td className="w-10 px-2.5 py-3.5 text-center">
                                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                                            isPaid 
                                                                ? 'bg-gray-200 border-gray-300 dark:bg-gray-700 dark:border-gray-600'
                                                                : isSelected 
                                                                    ? 'bg-cyan-600 border-cyan-600 shadow-md' 
                                                                    : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700'
                                                        }`}>
                                                            {isSelected && <CheckCircleIcon className="w-4 h-4 text-white" />}
                                                            {isPaid && !isSelected && <CheckCircleIcon className="w-4 h-4 text-gray-400" />}
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-3.5">
                                                        <p className={`text-xs font-black ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                                            {item.description}
                                                        </p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                                                            <span className="text-[9px] text-gray-400 font-bold tracking-tighter">
                                                                {item.categoryName}
                                                            </span>
                                                            {item.isFromOrcamento && (
                                                                <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 text-[9px] font-black rounded">
                                                                    Obra Aprovada
                                                                </span>
                                                            )}
                                                            {item.itemType === 'INSTALACAO' && !isPaid && (() => {
                                                                const hasExtra = (item.extraValor !== undefined && Math.abs(item.extraValor) > 0.001) || Boolean(item.extraDesc && item.extraDesc.trim());
                                                                const isNegative = (item.extraValor || 0) < 0;

                                                                return hasExtra ? (
                                                                    <div className={`inline-flex items-center gap-1 p-0.5 rounded-lg border shadow-xs ${
                                                                        isNegative 
                                                                            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700' 
                                                                            : 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700'
                                                                    }`}>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleOpenExtraServiceModal(item);
                                                                            }}
                                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-black transition-colors ${
                                                                                isNegative 
                                                                                    ? 'text-rose-900 dark:text-rose-300 hover:text-rose-700' 
                                                                                    : 'text-amber-900 dark:text-amber-300 hover:text-amber-700'
                                                                            }`}
                                                                            title="Clique para editar este serviço extra ou ajuste"
                                                                        >
                                                                            <span>✎</span>
                                                                            <span className="max-w-[190px] sm:max-w-[230px] truncate">
                                                                                {isNegative ? 'Ajuste: ' : 'Extra: '}
                                                                                {item.extraDesc || 'Identificado'} ({item.extraValor && item.extraValor > 0 ? `+${formatCurrency(item.extraValor)}` : formatCurrency(item.extraValor || 0)})
                                                                            </span>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setConfirmDeleteExtraItem(item);
                                                                            }}
                                                                            className="p-1 rounded-md text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
                                                                            title="Excluir este serviço extra ou ajuste"
                                                                        >
                                                                            <TrashIcon className="w-3 h-3" />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleOpenExtraServiceModal(item);
                                                                        }}
                                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black border bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800 hover:bg-cyan-100 hover:border-cyan-400 transition-all shadow-2xs"
                                                                        title="Clique para adicionar serviço extra identificado na instalação"
                                                                    >
                                                                        <span className="text-[11px] leading-none font-bold">+</span>
                                                                        <span>Serviço Extra</span>
                                                                    </button>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                                                        {isAdmin && !isPaid ? (
                                                            <button
                                                                type="button"
                                                                onMouseEnter={(e) => {
                                                                    e.stopPropagation();
                                                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                                    setHoveredItemInfo(null);
                                                                }}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setHoveredItemInfo(null);
                                                                    handleOpenAdminEditModal(item);
                                                                }}
                                                                className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 hover:bg-cyan-200 text-cyan-900 dark:bg-cyan-900/40 dark:hover:bg-cyan-800/60 dark:text-cyan-200 border border-cyan-300/60 transition-all shadow-2xs cursor-pointer"
                                                                title="Editar instalador e valor (Acesso Administrador)"
                                                            >
                                                                <UsersIcon className="w-3 h-3 text-cyan-700 dark:text-cyan-400" />
                                                                <span>{item.installerName && item.installerName !== 'Não Definido' ? item.installerName : 'Definir Instalador'}</span>
                                                                <span className="text-[9px] text-cyan-700 dark:text-cyan-300 opacity-60 group-hover:opacity-100 transition-opacity">✎</span>
                                                            </button>
                                                        ) : item.installerName && item.installerName !== 'Não Definido' ? (
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 inline-flex items-center gap-1.5 shadow-sm">
                                                                <UsersIcon className="w-3 h-3 text-cyan-600" />
                                                                {item.installerName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-gray-400 italic">
                                                                Não atribuído
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                                                        <div className="flex flex-col items-center">
                                                            <CalendarIcon className="w-3.5 h-3.5 text-gray-300 mb-1" />
                                                            <span className="text-[11px] font-black text-gray-500">
                                                                {item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : 'Sem data'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-2.5 py-3.5 text-center whitespace-nowrap">
                                                        {isPaid ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                                                Pago
                                                            </span>
                                                        ) : isSolicitado ? (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                                                Em Auditoria
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                                                Pronto p/ Faturar
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td 
                                                        className="px-3 py-3.5 text-right whitespace-nowrap relative"
                                                        onMouseEnter={(e) => handleMouseEnterItem(item, e)}
                                                        onMouseLeave={handleMouseLeaveItem}
                                                    >
                                                        <div className="flex flex-col items-end">
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                {isAdmin && !isPaid && (
                                                                    <button
                                                                        type="button"
                                                                        onMouseEnter={(e) => {
                                                                            e.stopPropagation();
                                                                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                                                            setHoveredItemInfo(null);
                                                                        }}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setHoveredItemInfo(null);
                                                                            handleOpenAdminEditModal(item);
                                                                        }}
                                                                        className="p-1 rounded-lg text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-all cursor-pointer relative z-10"
                                                                        title="Editar valor e instalador (Acesso Administrador)"
                                                                    >
                                                                        <EditIcon className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setModalDetailItem(item);
                                                                    }}
                                                                    className="p-1 rounded-lg text-gray-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-900/30 transition-all cursor-pointer"
                                                                    title="Passe o mouse ou clique para ver itens considerados neste total"
                                                                >
                                                                    <EyeIcon className="w-3.5 h-3.5" />
                                                                </button>
                                                                <span className={`text-sm font-black transition-colors ${isSelected ? 'text-cyan-700 dark:text-cyan-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                                    {formatCurrency(item.amount)}
                                                                </span>
                                                            </div>
                                                            {item.extraValor !== undefined && Math.abs(item.extraValor) > 0.001 ? (
                                                                <span className={`text-[9px] font-bold ${item.extraValor < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                                    {item.extraValor > 0 ? `+${formatCurrency(item.extraValor)} extra` : `${formatCurrency(item.extraValor)} ajuste`}
                                                                </span>
                                                            ) : null}
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setModalDetailItem(item);
                                                                }}
                                                                className="text-[9px] font-bold text-gray-400 hover:text-cyan-600 transition-colors tracking-tight flex items-center gap-0.5 mt-0.5"
                                                            >
                                                                <span>Ver itens</span>
                                                                <span>▾</span>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center space-y-3">
                                                <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                                                <p className="text-gray-500 font-bold text-sm animate-pulse">
                                                    Consultando banco de dados e sincronizando obras finalizadas...
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    Aguarde um momento enquanto carregamos as instalações em aberto.
                                                </p>
                                            </td>
                                        </tr>
                                    ) : ((isReadOnly && (!activeReport?.items || activeReport.items.length === 0)) || (!isReadOnly && filteredItems.length === 0)) && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-20 text-center space-y-4">
                                                <ExclamationTriangleIcon className="w-12 h-12 text-gray-200 mx-auto" />
                                                <p className="text-gray-400 font-bold italic text-sm">
                                                    {selectedInstallerFilter !== 'ALL'
                                                        ? 'Não há instalações aguardando pagamento para o instalador selecionado.'
                                                        : statusFilter === 'pendentes'
                                                            ? 'Não há instalações finalizadas aguardando pagamento no momento.'
                                                            : 'Nenhuma instalação encontrada.'}
                                                </p>
                                                <div className="flex items-center justify-center gap-4 mt-2">
                                                    {selectedInstallerFilter !== 'ALL' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedInstallerFilter('ALL')}
                                                            className="text-xs font-bold text-cyan-600 hover:underline inline-block"
                                                        >
                                                            Ver todos os instaladores
                                                        </button>
                                                    )}
                                                    {statusFilter === 'pendentes' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setStatusFilter('todas')}
                                                            className="text-xs font-bold text-cyan-600 hover:underline inline-block"
                                                        >
                                                            Visualizar todas as obras / histórico concluído
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-4 2xl:col-span-3 space-y-6">
                    <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 sticky top-8">
                        <div className="flex items-center gap-3 mb-6">
                            <DocumentReportIcon className="w-6 h-6 text-cyan-600" />
                            <h3 className="text-base font-black text-gray-900 dark:text-white tracking-tight">Comprovantes e Notas Fiscais</h3>
                        </div>

                        {/* Upload de Anexos */}
                        <div className="space-y-4">
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                Anexe a Nota Fiscal (NF) ou recibo emitido pelo instalador parceiro para liberação no contas a pagar:
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
                                        {isSaving ? 'Salvando...' : (activeReport ? 'Finalizar e Enviar' : 'Solicitar Pagamento')}
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
                                        {selectedTxIds.length === 0 && activeReport ? 'Excluir Rascunho' : 'Salvar Rascunho'}
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

            {/* Popover flutuante ao passar o mouse sobre Valor Mão de Obra */}
            {hoveredItemInfo && (() => {
                const spaceAbove = hoveredItemInfo.rect.top;
                const isAbove = spaceAbove >= 260 || (window.innerHeight - hoveredItemInfo.rect.bottom < 340);
                
                // Desloca para cima com margem de segurança de 24px para nunca cobrir a linha ou o botão de editar
                const popoverStyle: React.CSSProperties = {
                    position: 'fixed',
                    ...(isAbove ? {
                        bottom: `${Math.max(16, window.innerHeight - hoveredItemInfo.rect.top + 24)}px`,
                        maxHeight: `${Math.min(420, Math.max(200, hoveredItemInfo.rect.top - 36))}px`
                    } : {
                        top: `${Math.max(16, hoveredItemInfo.rect.bottom + 24)}px`,
                        maxHeight: `${Math.min(420, Math.max(200, window.innerHeight - hoveredItemInfo.rect.bottom - 36))}px`
                    }),
                    left: `${Math.max(16, Math.min(window.innerWidth - 396, hoveredItemInfo.rect.right - 380))}px`,
                    width: '380px',
                    zIndex: 9999
                };

                return (
                    <div 
                        style={popoverStyle}
                        className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl border-2 border-cyan-500/50 p-5 text-left animate-fade-in pointer-events-auto backdrop-blur-md overflow-y-auto"
                        onMouseEnter={handlePopoverMouseEnter}
                        onMouseLeave={handlePopoverMouseLeave}
                    >
                        {/* Header Popover */}
                        <div className="flex items-start justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                            <div>
                                <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                                    <SparklesIcon className="w-3.5 h-3.5" />
                                    Composição da Mão de Obra
                                </span>
                                <h4 className="text-sm font-black text-gray-900 dark:text-white mt-0.5 leading-snug">
                                    {hoveredItemInfo.item.clientName}
                                </h4>
                                {hoveredItemInfo.item.installerName && (
                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        Instalador: <strong className="text-gray-700 dark:text-gray-200">{hoveredItemInfo.item.installerName}</strong>
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const it = hoveredItemInfo.item;
                                    setHoveredItemInfo(null);
                                    setModalDetailItem(it);
                                }}
                                className="px-2 py-1 rounded-lg text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-900/30 hover:bg-cyan-100 text-[10px] font-black transition-colors"
                                title="Abrir tela cheia"
                            >
                                ⛶ Abrir tela
                            </button>
                        </div>

                        {/* Itens Considerados */}
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-gray-500 dark:text-gray-400">
                                    Itens Considerados no Total:
                                </span>
                                <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                    Soma Considerada
                                </span>
                            </div>

                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {hoveredItemInfo.item.breakdown?.filter(b => b.isIncluded).map((b, idx) => {
                                    const isNeg = b.value < 0;
                                    return (
                                        <div key={idx} className={`flex justify-between items-center p-2.5 rounded-xl border ${isNeg ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40' : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-700/60'}`}>
                                            <div className="pr-2">
                                                <p className={`text-xs font-bold leading-tight ${isNeg ? 'text-rose-800 dark:text-rose-300' : 'text-gray-800 dark:text-gray-200'}`}>
                                                    {b.label}
                                                </p>
                                                {b.detail && (
                                                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                                                        {b.detail}
                                                    </p>
                                                )}
                                            </div>
                                            <span className={`text-xs font-black shrink-0 ${isNeg ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                {formatCurrency(b.value)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Total Highlight */}
                            <div className="pt-2.5 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                <span className="text-xs font-black text-gray-700 dark:text-gray-300">Total da Mão de Obra</span>
                                <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(
                                        (hoveredItemInfo.item.breakdown || []).filter(b => b.isIncluded).reduce((acc, b) => acc + (b.value || 0), 0)
                                    )}
                                </span>
                            </div>
                        </div>

                        <div className="mt-3 pt-2 text-center border-t border-gray-100 dark:border-gray-700">
                            <button
                                type="button"
                                onClick={() => {
                                    const it = hoveredItemInfo.item;
                                    setHoveredItemInfo(null);
                                    setModalDetailItem(it);
                                }}
                                className="text-[10px] font-black text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 hover:underline flex items-center justify-center gap-1 mx-auto"
                            >
                                <span>Clique para abrir tela completa com todos os itens</span>
                                <span>→</span>
                            </button>
                        </div>
                    </div>
                );
            })()}

            {/* Modal de Detalhamento Completo dos Itens da Mão de Obra */}
            {modalDetailItem && (() => {
                const modalCalculatedTotal = (modalDetailItem.breakdown || [])
                    .filter(b => b.isIncluded)
                    .reduce((acc, b) => acc + (b.value || 0), 0);
                const hasModalExtra = (modalDetailItem.extraValor !== undefined && Math.abs(modalDetailItem.extraValor) > 0.001) || Boolean(modalDetailItem.extraDesc && modalDetailItem.extraDesc.trim());

                return (
                    <Modal 
                        title="Detalhamento dos Itens da Mão de Obra" 
                        onClose={() => setModalDetailItem(null)} 
                        maxWidth="max-w-2xl"
                    >
                        <div className="space-y-6 p-2">
                            {/* Card Topo com Destaque do Cliente e Total */}
                            <div className="bg-gradient-to-r from-cyan-500/10 via-indigo-500/10 to-transparent p-5 rounded-3xl border border-cyan-100 dark:border-cyan-900/40">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                    <div>
                                        <span className="text-xs font-bold text-cyan-700 dark:text-cyan-400">
                                            Instalação / Obra
                                        </span>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white leading-tight">
                                            {modalDetailItem.clientName}
                                        </h3>
                                        <p className="text-xs text-gray-500 font-bold mt-1">
                                            Instalador: <span className="text-gray-800 dark:text-gray-200">{modalDetailItem.installerName || 'Não Definido'}</span> • Conclusão: {modalDetailItem.dueDate ? new Date(modalDetailItem.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Sem data'}
                                        </p>
                                    </div>
                                    <div className="text-right sm:border-l sm:border-gray-200 dark:sm:border-gray-700 sm:pl-6 shrink-0">
                                        <span className="text-xs font-bold text-gray-400 block">
                                            Valor Total Mão de Obra
                                        </span>
                                        <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                            {formatCurrency(modalCalculatedTotal)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Itens Considerados */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                                        Itens Considerados no Total ({formatCurrency(modalCalculatedTotal)})
                                    </h4>
                                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                        Somados na Mão de Obra
                                    </span>
                                </div>

                                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-sm">
                                    {modalDetailItem.breakdown?.filter(b => b.isIncluded).map((b, idx) => {
                                        const isNeg = b.value < 0;
                                        return (
                                            <div key={idx} className={`p-4 flex items-center justify-between transition-colors ${isNeg ? 'bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50/70' : 'hover:bg-gray-50/50 dark:hover:bg-gray-700/30'}`}>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`text-sm font-black ${isNeg ? 'text-rose-900 dark:text-rose-200' : 'text-gray-900 dark:text-white'}`}>
                                                            {b.label}
                                                        </span>
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${isNeg ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                                                            {isNeg ? 'Dedução / Ajuste' : 'Considerado'}
                                                        </span>
                                                    </div>
                                                    {b.detail && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                                                            {b.detail}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`text-base font-black shrink-0 ${isNeg ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {formatCurrency(b.value)}
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {/* Linha de Total */}
                                    <div className="p-4 bg-gray-50 dark:bg-gray-900/50 flex justify-between items-center font-black">
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Total Somado (Mão de Obra)</span>
                                        <span className="text-lg text-indigo-600 dark:text-indigo-400">{formatCurrency(modalCalculatedTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 flex flex-wrap gap-2 justify-between items-center">
                                <div className="flex flex-wrap items-center gap-2">
                                    {isAdmin && !isReadOnly && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const it = modalDetailItem;
                                                setModalDetailItem(null);
                                                handleOpenAdminEditModal(it);
                                            }}
                                            className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                            title="Editar instalador e valor da mão de obra (Acesso Administrador)"
                                        >
                                            <EditIcon className="w-3.5 h-3.5" />
                                            <span>Editar Instalador e Valor</span>
                                        </button>
                                    )}
                                    {modalDetailItem.itemType === 'INSTALACAO' && !isReadOnly && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const it = modalDetailItem;
                                                    setModalDetailItem(null);
                                                    handleOpenExtraServiceModal(it);
                                                }}
                                                className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                            >
                                                <span>✎</span>
                                                <span>{hasModalExtra ? 'Editar Serviço Extra / Ajuste' : 'Incluir Serviço Extra'}</span>
                                            </button>
                                            {hasModalExtra && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const it = modalDetailItem;
                                                        setModalDetailItem(null);
                                                        setConfirmDeleteExtraItem(it);
                                                    }}
                                                    className="px-3.5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-bold text-xs transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                                                    title="Excluir serviço extra"
                                                >
                                                    <TrashIcon className="w-3.5 h-3.5" />
                                                    <span>Excluir Extra</span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setModalDetailItem(null)}
                                    className="px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors cursor-pointer"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </Modal>
                );
            })()}

            {/* Modal de Inclusão / Edição de Serviço Extra ou Ajuste */}
            {extraServiceModalItem && (() => {
                const baseVal = extraServiceModalItem.baseAmount !== undefined 
                    ? extraServiceModalItem.baseAmount 
                    : (extraServiceModalItem.amount - (extraServiceModalItem.extraValor || 0));
                const typedExtraVal = parseSafeNumber(extraValorInput);
                const simulatedTotal = baseVal + typedExtraVal;
                const hasExistingExtra = Boolean((extraServiceModalItem.extraValor !== undefined && Math.abs(extraServiceModalItem.extraValor) > 0.001) || Boolean(extraServiceModalItem.extraDesc && extraServiceModalItem.extraDesc.trim()));

                return (
                    <Modal
                        title={hasExistingExtra ? "Editar Serviço Extra / Ajuste" : "Serviço Extra na Instalação"}
                        onClose={() => setExtraServiceModalItem(null)}
                        maxWidth="max-w-lg"
                    >
                        <div className="space-y-5 p-2">
                            {/* Identificação da Obra e Cliente */}
                            <div className="bg-gradient-to-r from-cyan-50 to-indigo-50 dark:from-cyan-950/40 dark:to-indigo-950/40 p-4 rounded-2xl border border-cyan-100 dark:border-cyan-900/40">
                                <span className="text-[10px] font-black tracking-wider text-cyan-700 dark:text-cyan-400">
                                    Instalação / Obra
                                </span>
                                <h3 className="text-base font-black text-gray-900 dark:text-white leading-tight mt-0.5">
                                    {extraServiceModalItem.clientName}
                                </h3>
                                <p className="text-xs text-gray-500 font-bold mt-1">
                                    Instalador: <strong className="text-gray-700 dark:text-gray-200">{extraServiceModalItem.installerName || 'Não Definido'}</strong>
                                </p>
                            </div>

                            {/* Campos: Descrição e Valor com Alternador de Acréscimo / Dedução */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-700 dark:text-gray-300 mb-1">
                                        Descrição do Serviço Extra ou Ajuste
                                    </label>
                                    <input
                                        type="text"
                                        value={extraDescInput}
                                        onChange={(e) => setExtraDescInput(e.target.value)}
                                        placeholder="Ex: Passagem de tubulação subterrânea, acerto de adiantamento..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs font-bold text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 shadow-sm"
                                        autoFocus
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Informe a descrição do serviço adicional, imprevisto ou acerto técnico da instalação.
                                    </p>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-black text-gray-700 dark:text-gray-300">
                                            Valor (R$)
                                        </label>
                                        <div className="flex items-center gap-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cur = parseSafeNumber(extraValorInput);
                                                    if (cur < 0) {
                                                        setExtraValorInput(String(Math.abs(cur)).replace('.', ','));
                                                    }
                                                }}
                                                className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${
                                                    typedExtraVal >= 0 
                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                + Acréscimo
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const cur = parseSafeNumber(extraValorInput);
                                                    if (cur > 0) {
                                                        setExtraValorInput('-' + String(Math.abs(cur)).replace('.', ','));
                                                    } else if (cur === 0 && !extraValorInput.startsWith('-')) {
                                                        setExtraValorInput('-');
                                                    }
                                                }}
                                                className={`px-2 py-0.5 rounded text-[10px] font-black transition-colors ${
                                                    typedExtraVal < 0 
                                                        ? 'bg-rose-100 text-rose-800 border border-rose-300' 
                                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                }`}
                                            >
                                                - Dedução / Ajuste
                                            </button>
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">
                                            R$
                                        </span>
                                        <input
                                            type="text"
                                            value={extraValorInput}
                                            onChange={(e) => setExtraValorInput(e.target.value)}
                                            placeholder="0,00 ou -1.100,00"
                                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-black text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 shadow-sm"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        Use valores positivos para acréscimos ou negativos (-) para deduções e acertos de valores já pagos.
                                    </p>
                                </div>
                            </div>

                            {/* Destaque do Somatório em Tempo Real */}
                            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200/80 dark:border-gray-700/80 space-y-2">
                                <div className="flex justify-between items-center text-xs font-bold text-gray-600 dark:text-gray-400">
                                    <span>Mão de Obra Base (Instalação + Adequação):</span>
                                    <span>{formatCurrency(baseVal)}</span>
                                </div>
                                <div className={`flex justify-between items-center text-xs font-bold ${typedExtraVal < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    <span>{typedExtraVal < 0 ? 'Dedução / Ajuste Informado:' : '+ Serviço Extra Informado:'}</span>
                                    <span>{formatCurrency(typedExtraVal)}</span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                                    <span className="text-xs font-black text-gray-900 dark:text-white">
                                        Novo Total da Mão de Obra:
                                    </span>
                                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(simulatedTotal)}
                                    </span>
                                </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex items-center justify-between pt-2">
                                {hasExistingExtra ? (
                                    <button
                                        type="button"
                                        disabled={isSavingExtraService}
                                        onClick={() => {
                                            const it = extraServiceModalItem;
                                            setExtraServiceModalItem(null);
                                            setConfirmDeleteExtraItem(it);
                                        }}
                                        className="px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                        <span>Excluir Extra</span>
                                    </button>
                                ) : <div />}

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={isSavingExtraService}
                                        onClick={() => setExtraServiceModalItem(null)}
                                        className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSavingExtraService}
                                        onClick={handleSaveExtraService}
                                        className="px-5 py-2.5 text-xs font-black text-white bg-cyan-600 hover:bg-cyan-700 active:scale-95 rounded-xl shadow-md transition-all inline-flex items-center gap-1.5"
                                    >
                                        {isSavingExtraService ? (
                                            <span>Salvando...</span>
                                        ) : (
                                            <>
                                                <CheckCircleIcon className="w-4 h-4" />
                                                <span>Salvar e Somar no Total</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </Modal>
                );
            })()}

            {/* Modal de Confirmação para Excluir Serviço Extra / Ajuste */}
            {confirmDeleteExtraItem && (() => {
                const isDeduction = (confirmDeleteExtraItem.extraValor || 0) < 0;
                const baseVal = confirmDeleteExtraItem.baseAmount !== undefined 
                    ? confirmDeleteExtraItem.baseAmount 
                    : (confirmDeleteExtraItem.amount - (confirmDeleteExtraItem.extraValor || 0));
                const currentVal = confirmDeleteExtraItem.amount;

                return (
                    <Modal title="Confirmar Remoção do Ajuste" onClose={() => !isSavingExtraService && setConfirmDeleteExtraItem(null)}>
                        <div className="p-6 space-y-6">
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200">
                                <ExclamationTriangleIcon className="w-7 h-7 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs space-y-1">
                                    <p className="font-black text-sm">
                                        {isDeduction ? 'Atenção: Remoção de Dedução / Desconto' : 'Remoção de Serviço Extra'}
                                    </p>
                                    <p className="leading-relaxed">
                                        {isDeduction
                                            ? 'Ao excluir esta dedução, o desconto será removido e o valor total a ser pago ao instalador voltará a ser o valor integral da mão de obra.'
                                            : 'Deseja realmente excluir este serviço extra? O valor total da mão de obra será recalculado sem este acréscimo.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3 p-4 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-bold">Instalação / Obra:</span>
                                    <span className="font-black text-gray-900 dark:text-white">{confirmDeleteExtraItem.clientName || confirmDeleteExtraItem.description}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-gray-500 font-bold">{isDeduction ? 'Ajuste / Dedução:' : 'Serviço Extra:'}</span>
                                    <span className={`font-black ${isDeduction ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        {confirmDeleteExtraItem.extraDesc || 'Identificado'} ({formatCurrency(confirmDeleteExtraItem.extraValor || 0)})
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs">
                                    <span className="text-gray-600 dark:text-gray-300 font-bold">Valor atual a pagar:</span>
                                    <span className="font-black text-gray-900 dark:text-white">{formatCurrency(currentVal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-indigo-600 dark:text-indigo-400 font-black">
                                        {isDeduction ? 'Novo valor a pagar (integral):' : 'Novo valor a pagar:'}
                                    </span>
                                    <span className="font-black text-base text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(baseVal)}
                                    </span>
                                </div>
                            </div>

                            <p className="text-center text-xs font-bold text-gray-700 dark:text-gray-200">
                                {isDeduction
                                    ? 'Deseja mesmo remover este ajuste e pagar o valor integral de ' + formatCurrency(baseVal) + '?'
                                    : 'Deseja mesmo excluir este serviço extra e atualizar o valor para ' + formatCurrency(baseVal) + '?'}
                            </p>

                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    disabled={isSavingExtraService}
                                    onClick={() => setConfirmDeleteExtraItem(null)}
                                    className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={isSavingExtraService}
                                    onClick={async () => {
                                        const it = confirmDeleteExtraItem;
                                        setConfirmDeleteExtraItem(null);
                                        await handleRemoveExtraService(it);
                                    }}
                                    className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                    <span>{isSavingExtraService ? 'Excluindo...' : (isDeduction ? 'Sim, Excluir Ajuste e Pagar Integral' : 'Sim, Excluir Extra')}</span>
                                </button>
                            </div>
                        </div>
                    </Modal>
                );
            })()}

            {/* Modal Exclusivo de Administrador: Edição de Instalador e Valor */}
            {adminEditModalItem && isAdmin && (() => {
                const currentBase = adminEditModalItem.baseAmount !== undefined 
                    ? adminEditModalItem.baseAmount 
                    : (adminEditModalItem.amount - (adminEditModalItem.extraValor || 0));
                const typedVal = parseSafeNumber(adminEditValueInput);
                const extra = adminEditModalItem.extraValor || 0;
                const finalSimulatedTotal = typedVal + extra;

                const matchedInstaller = installers.find(i => String(i.id) === String(adminEditInstallerId));

                return (
                    <Modal
                        title="Editar Instalador e Valor da Mão de Obra"
                        onClose={() => setAdminEditModalItem(null)}
                        maxWidth="max-w-lg"
                    >
                        <div className="space-y-5 p-2">
                            {/* Banner de Administrador com Identificação da Obra */}
                            <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 flex items-start justify-between gap-3">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white flex items-center gap-1 shadow-xs">
                                            <LockClosedIcon className="w-3 h-3" />
                                            Acesso Administrador
                                        </span>
                                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                            {adminEditModalItem.itemType === 'INSTALACAO' ? 'Instalação de Obra' : 'Lavagem Técnica'}
                                        </span>
                                    </div>
                                    <h4 className="text-sm font-black text-gray-900 dark:text-white">
                                        {adminEditModalItem.clientName || adminEditModalItem.description}
                                    </h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                                        Data de Conclusão: {adminEditModalItem.dueDate ? new Date(adminEditModalItem.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Não informada'}
                                    </p>
                                </div>
                            </div>

                            {/* Seleção do Instalador Cadastrado */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                        <UsersIcon className="w-3.5 h-3.5 text-indigo-600" />
                                        Instalador Responsável
                                    </label>
                                    <span className="text-[10px] font-bold text-gray-400">
                                        {installers.length} instaladores cadastrados
                                    </span>
                                </div>

                                <select
                                    value={adminEditInstallerId}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAdminEditInstallerId(val);
                                        if (val === '__custom__') {
                                            setAdminEditInstallerName('');
                                        } else if (val) {
                                            const found = installers.find(i => String(i.id) === String(val));
                                            if (found) setAdminEditInstallerName(found.nome.trim());
                                        } else {
                                            setAdminEditInstallerName('Não Definido');
                                        }
                                    }}
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-2xs"
                                >
                                    <option value="">-- Selecione um instalador cadastrado --</option>
                                    {installers.map((inst) => (
                                        <option key={inst.id} value={inst.id}>
                                            {inst.nome} {inst.cidade ? `(${inst.cidade}/${inst.uf})` : ''} {inst.whatsapp ? `• ${inst.whatsapp}` : ''}
                                        </option>
                                    ))}
                                    <option value="__custom__">Outro / Especificar manualmente...</option>
                                </select>

                                {/* Campo manual se selecionou custom ou não encontrou no cadastro */}
                                {(adminEditInstallerId === '__custom__' || (!adminEditInstallerId && adminEditInstallerName && adminEditInstallerName !== 'Não Definido')) && (
                                    <div className="pt-1.5">
                                        <input
                                            type="text"
                                            placeholder="Digite o nome do instalador..."
                                            value={adminEditInstallerName === 'Não Definido' ? '' : adminEditInstallerName}
                                            onChange={(e) => setAdminEditInstallerName(e.target.value)}
                                            className="w-full px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-gray-700 text-xs font-bold text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                                        />
                                    </div>
                                )}

                                {/* Card de Informações do Instalador Selecionado */}
                                {matchedInstaller && (
                                    <div className="p-2.5 bg-cyan-50/60 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-900/40 rounded-xl text-[11px] text-gray-600 dark:text-gray-300 flex items-center justify-between">
                                        <div>
                                            <span className="font-bold text-cyan-900 dark:text-cyan-300">{matchedInstaller.nome}</span>
                                            {matchedInstaller.documento && <span className="ml-2 text-gray-400 font-normal">Doc: {matchedInstaller.documento}</span>}
                                        </div>
                                        {matchedInstaller.whatsapp && (
                                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                                {matchedInstaller.whatsapp}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Edição do Valor da Mão de Obra */}
                            <div className="space-y-2">
                                <label className="text-xs font-black text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                                <DollarIcon className="w-3.5 h-3.5 text-indigo-600" />
                                    Valor da Mão de Obra
                                </label>

                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-black text-xs">
                                        R$
                                    </span>
                                    <input
                                        type="text"
                                        value={adminEditValueInput}
                                        onChange={(e) => setAdminEditValueInput(e.target.value)}
                                        placeholder="0,00"
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-black text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none shadow-2xs transition-all"
                                    />
                                </div>
                            </div>

                            {/* Simulador de Impacto no Faturamento */}
                            <div className="bg-gray-50 dark:bg-gray-800/80 p-3.5 rounded-2xl border border-gray-200 dark:border-gray-700 text-xs space-y-2">
                                <div className="flex justify-between items-center text-gray-600 dark:text-gray-300 font-bold">
                                    <span>Mão de Obra Base:</span>
                                    <span className="font-black text-gray-900 dark:text-white">{formatCurrency(typedVal)}</span>
                                </div>

                                {Math.abs(extra) > 0.001 && (
                                    <div className={`flex justify-between items-center ${extra < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'} font-bold`}>
                                        <span>
                                            {extra < 0 ? 'Dedução / Ajuste na Obra:' : 'Serviço Extra na Obra:'} ({adminEditModalItem.extraDesc || 'Ajuste'})
                                        </span>
                                        <span className="font-black">
                                            {extra > 0 ? `+${formatCurrency(extra)}` : formatCurrency(extra)}
                                        </span>
                                    </div>
                                )}

                                <div className="pt-2 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-sm font-black text-gray-900 dark:text-white">
                                    <span>Total Final a Pagar:</span>
                                    <span className="text-base text-indigo-600 dark:text-indigo-400">{formatCurrency(finalSimulatedTotal)}</span>
                                </div>
                            </div>

                            {/* Rodapé com botões de Ação */}
                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    disabled={isSavingAdminEdit}
                                    onClick={() => setAdminEditModalItem(null)}
                                    className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    disabled={isSavingAdminEdit}
                                    onClick={handleSaveAdminEdit}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                >
                                    <SaveIcon className="w-4 h-4" />
                                    <span>{isSavingAdminEdit ? 'Salvando...' : 'Salvar Alterações'}</span>
                                </button>
                            </div>
                        </div>
                    </Modal>
                );
            })()}
        </div>
    );
};

export default InstalacaoLavagemPage;
