import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ChecklistEntry, StockItem, StockMovement, PurchaseRequest, CheckListPageProps, SavedOrcamento } from '../types';
import { 
    ClipboardCheckIcon, CheckCircleIcon, TrashIcon, 
    PlusIcon, PhotographIcon, EyeIcon, WrenchIcon,
    XCircleIcon, ArrowLeftIcon, CubeIcon, UploadIcon,
    EditIcon, ExclamationTriangleIcon, SearchIcon, FilterIcon,
    VideoCameraIcon, UsersIcon, CalendarIcon, TruckIcon, ClipboardListIcon,
    MapIcon, HomeIcon, BoltIcon, CogIcon, CameraIcon, ChevronDownIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';

const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];
const ADMIN_PROFILE_ID = '001';

interface PainelConfig {
    id: string;
    linhas: number;
    modulos: number;
    orientacao: string;
}

const INITIAL_CHECKIN = {
    responsavelTecnico: '',
    dataVisita: new Date().toISOString().split('T')[0],
    nomeTitular: '',
    emailTitular: '',
    telefoneTitular: '',
    enderecoCompleto: '',
    cep: '',
    estado: '',
    cidade: '',
    paineisConfig: [] as PainelConfig[],
    tipoTelhado: 'Cerâmico',
    materialEstrutura: 'Estrutura Madeira',
    areaUtilSuficiente: 'Sim',
    inclinacaoOrientacao: '',
    sombreamento: 'Não',
    existeAterramentoNoLocal: 'Sim',
    classeCliente: 'Residencial',
    tipoLigacaoCliente: 'Monofásica',
    espessuraCabo: '16 mm',
    espessuraCaboOutro: '',
    correnteDisjuntor: '',
    correnteDisjuntorPadrao: '',
    tensaoNominal: '127/220 V',
    tensaoNominalOutro: '',
    tipoLigacaoEntrada: 'Aérea',
    comprimentoRamalAereo: '',
    possuiTransformador: 'Não',
    transformadorKVA: '',
    medidasTerreno: '',
    distanciaPostesConcessionaria: '',
    localConexaoRede: 'Quadro de distribution central',
    localConexaoRedeOutro: '',
    distanciaInversorDisjuntor: '',
    distanciaDisjuntorPadrao: '',
    tipoTubulacao: [] as string[],
    necessitaAvaliacaoCivil: 'Não',
    componentesEstoque: [] as { itemId: string, name: string, qty: number }[],
    necessitaMaterialExtra: 'Não',
    materialExtraDescricao: '',
    fotoFachada: [] as string[],
    fotoRamal: [] as string[],
    fotoPadraoEntrada: [] as string[],
    fotoMedidorDisjuntor: [] as string[],
    fotoDisjuntorPadrao: [] as string[],
    fotoQuadroInversor: [] as string[],
    fotoAmplaTelhado: [] as string[],
    fotoLocalInversor: [] as string[],
};

const INITIAL_CHECKOUT = {
    nomeCliente: '',
    dataTermino: new Date().toISOString().split('T')[0],
    fotosPlacas: [] as string[],
    fotosInversores: [] as string[],
    fotosAterramento: [] as string[],
    fotosQuadroInterno: [] as string[],
    fotosMedidor: [] as string[],
    fotosDisjuntorDPS: [] as string[],
    fotoPadraoPoste: [] as string[],
    videoAntilhamento: 'Não',
    videoYoutube: 'Não',
    linkYoutube: '',
    componentesEstoque: [] as { itemId: string, name: string, qty: number }[],
    originalCheckinId: ''
};

const INITIAL_MANUTENCAO = {
    nomeCliente: '',
    tecnicoResponsavel: '',
    dataManutencao: new Date().toISOString().split('T')[0],
    tipoManutencao: 'Corretiva',
    relatoCliente: '',
    diagnosticoTecnico: '',
    servicoRealizado: '',
    statusSistemaFinal: 'Operacional',
    fotosAntes: [] as string[],
    fotosDepois: [] as string[],
    fotosEquipamentos: [] as string[],
    componentesEstoque: [] as { itemId: string, name: string, qty: number }[],
    observacoesFinais: ''
};

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">{children}</label>
);

const StandardInput = (props: any) => (
    <input 
        {...props} 
        disabled={props.disabled}
        className={`w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-75 ${props.className || ''}`} 
    />
);

const StandardTextArea = (props: any) => (
    <textarea 
        {...props} 
        disabled={props.disabled}
        className={`w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-75 min-h-[100px] ${props.className || ''}`} 
    />
);

const SelectButton: React.FC<{ options: string[]; value: string; onChange: (v: string) => void; cols?: string; disabled?: boolean }> = ({ options, value, onChange, cols = "grid-cols-2", disabled }) => (
    <div className={`grid ${cols} gap-1.5`}>
        {options.map(opt => (
            <button
                key={opt}
                type="button"
                disabled={disabled}
                onClick={() => onChange(opt)}
                className={`py-1.5 px-2 rounded-lg border-2 text-[10px] font-bold transition-all min-h-[36px] flex items-center justify-center text-center break-words whitespace-normal leading-tight ${
                    value === opt 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                    : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 text-gray-500 hover:border-indigo-200'
                } ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
            >
                {opt}
            </button>
        ))}
    </div>
);

const CheckboxList: React.FC<{ options: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }> = ({ options, value, onChange, disabled }) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
        {options.map(opt => (
            <label key={opt} className={`flex items-center gap-2 p-2 rounded-lg transition-all cursor-pointer bg-white dark:bg-gray-800 border ${value?.includes(opt) ? 'border-indigo-400' : 'border-transparent'} hover:border-indigo-100 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <input 
                    type="checkbox" 
                    checked={(value || []).includes(opt)} 
                    disabled={disabled}
                    onChange={() => {
                        const current = value || [];
                        if (current.includes(opt)) onChange(current.filter(v => v !== opt));
                        else onChange([...current, opt]);
                    }}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 transition-all"
                />
                <span className="text-[10px] font-bold text-gray-700 dark:text-gray-200 tracking-tight leading-none">{opt}</span>
            </label>
        ))}
    </div>
);

// Fix: Specifying React.ReactElement<any> for the icon prop to allow className property in React.cloneElement
const SectionHeader: React.FC<{ icon: React.ReactElement<any>; title: string; color?: string; rightElement?: React.ReactNode }> = ({ icon, title, color = "bg-indigo-600", rightElement }) => (
    <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100 dark:border-gray-700/50">
        <div className="flex items-center gap-2">
            <div className={`p-1 rounded-lg text-white ${color}`}>
                {/* Fix: Using any generic for icon to resolve TS error with className prop */}
                {React.cloneElement(icon, { className: "w-3 h-3" })}
            </div>
            <h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 tracking-widest">{title}</h4>
        </div>
        {rightElement && <div>{rightElement}</div>}
    </div>
);

const compressImage = (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
        if (!base64Str) return resolve('');
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85)); 
        };
        img.onerror = () => resolve('');
    });
};

const CheckListPage: React.FC<CheckListPageProps> = ({ view, currentUser }) => {
    const [entries, setEntries] = useState<ChecklistEntry[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
    const [allCheckins, setAllCheckins] = useState<ChecklistEntry[]>([]);
    const [cidades, setCIDADES] = useState<string[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [isStatusModalOpen, setStatusModalOpen] = useState(false);
    const [activeStep, setActiveStep] = useState(1);
    
    const [hdPhoto, setHdPhoto] = useState<string | null>(null);

    const [showNameSuggestions, setShowNameSuggestions] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);

    const getTableName = (type: string) => {
        switch(type) {
            case 'checkin': return 'checklist_checkin';
            case 'checkout': return 'checklist_checkout';
            case 'manutencao': return 'checklist_manutencao';
            default: return 'checklist_entries';
        }
    };

    const getInitialForm = (type: string) => {
        if (type === 'checkin') return { ...INITIAL_CHECKIN };
        if (type === 'manutencao') return { ...INITIAL_MANUTENCAO };
        return { ...INITIAL_CHECKOUT };
    };

    const [activeFormType, setActiveFormType] = useState<'checkin' | 'checkout' | 'manutencao'>(view);
    const [form, setForm] = useState<any>(getInitialForm(view));
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingCidades, setIsLoadingCidades] = useState(false);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [isViewOnly, setIsViewOnly] = useState(false);
    const [statusTargetEntry, setStatusTargetEntry] = useState<ChecklistEntry | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activePhotoField, setActivePhotoField] = useState<string | null>(null);
    const [maxFilesForActiveField, setMaxFilesForActiveField] = useState(10);
    const [isSaving, setIsSaving] = useState(false);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'Todos' | 'Aberto' | 'Efetivado' | 'Perdido' | 'Finalizado'>('Todos');

    const loadData = async () => {
        setIsLoading(true);
        const isAdmin = String(currentUser.profileId) === ADMIN_PROFILE_ID;
        
        const currentTable = getTableName(view);
        try {
            const results = await Promise.allSettled([
                dataService.getAll<any>(currentTable, currentUser.id, isAdmin),
                dataService.getAll<StockItem>('stock_items', currentUser.id, true),
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdmin),
                dataService.getAll<ChecklistEntry>('checklist_checkin', currentUser.id, isAdmin)
            ]);
            
            const rawCurrent = results[0].status === 'fulfilled' ? results[0].value : [];
            const rawStock = results[1].status === 'fulfilled' ? results[1].value : [];
            const rawOrcamentos = results[2].status === 'fulfilled' ? results[2].value : [];
            const rawAllCheckins = results[3].status === 'fulfilled' ? results[3].value : [];
            
            setEntries(rawCurrent.sort((a:any, b:any) => (b.date || '').localeCompare(a.date || '')));
            setStockItems(rawStock.sort((a:any, b:any) => a.name.localeCompare(b.name)));
            setOrcamentos(rawOrcamentos);
            setAllCheckins(rawAllCheckins);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, [currentUser, view]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowNameSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const approvedClientsData = useMemo(() => {
        const clientsWithExistingCheckin = new Set(
            allCheckins
                .filter(c => c.status !== 'Perdido')
                .map(c => c.project)
        );

        return orcamentos
            .filter(orc => orc.status === 'Aprovado')
            .map(orc => {
                const variant = orc.variants?.find(v => v.isPrincipal) || orc.variants?.[0] || { formState: orc.formState };
                const fs = variant.formState || {};
                return {
                    name: fs.nomeCliente || 'Sem nome',
                    email: fs.emailTitular || '',
                    phone: fs.telefoneTitular || ''
                };
            })
            .filter(c => c.name !== 'Sem nome' && !clientsWithExistingCheckin.has(c.name))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [orcamentos, allCheckins]);

    const filteredApprovedClients = useMemo(() => {
        const search = (form.nomeTitular || '').toLowerCase();
        if (!search) return approvedClientsData;
        return approvedClientsData.filter(c => c.name.toLowerCase().includes(search));
    }, [approvedClientsData, form.nomeTitular]);

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = (e.project || '').toLowerCase().includes(searchQuery.toLowerCase()) || (e.responsible || '').toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = statusFilter === 'Todos' || (e.status || 'Aberto').toLowerCase() === statusFilter.toLowerCase();
            return matchesSearch && matchesStatus;
        });
    }, [entries, searchQuery, statusFilter]);

    useEffect(() => {
        const cleanCep = (form.cep || '').replace(/\D/g, '');
        if (cleanCep.length === 8 && !isViewOnly && activeFormType === 'checkin') {
            const fetchCep = async () => {
                setIsLoadingCep(true);
                try {
                    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                    const data = await response.json();
                    if (!data.erro) { setForm((prev: any) => ({ ...prev, enderecoCompleto: `${data.logradouro}${data.bairro ? ', ' + data.bairro : ''}`, estado: data.uf, cidade: data.localidade })); }
                } catch (error) { console.error(error); } finally { setIsLoadingCep(false); }
            };
            fetchCep();
        }
    }, [form.cep, isViewOnly, activeFormType]);

    useEffect(() => {
        if (!form.estado || activeFormType !== 'checkin') { setCIDADES([]); return; }
        const fetchCidades = async () => {
            setIsLoadingCidades(true);
            try {
                const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${form.estado}/municipios`);
                const data = await response.json();
                setCIDADES(data.map((c: any) => c.nome).sort());
            } catch (error) { console.error(error); setCIDADES([]); } finally { setIsLoadingCidades(false); }
        };
        fetchCidades();
    }, [form.estado, activeFormType]);

    const handleEdit = (entry: ChecklistEntry) => {
        setEditingEntryId(entry.id);
        setIsViewOnly(false);
        setForm({ ...entry.details });
        setActiveFormType(entry.type);
        setActiveStep(1);
        setModalOpen(true);
    };

    const handleView = (entry: ChecklistEntry) => {
        setEditingEntryId(entry.id);
        setIsViewOnly(true);
        setForm({ ...entry.details });
        setActiveFormType(entry.type);
        setActiveStep(1);
        setModalOpen(true);
    };

    const handleOpenStatus = (entry: ChecklistEntry) => {
        setStatusTargetEntry(entry);
        setStatusModalOpen(true);
    };

    const processStockDeduction = async (targetEntry: ChecklistEntry) => {
        const [currentStock, allRequests] = await Promise.all([
            dataService.getAll<StockItem>('stock_items'),
            dataService.getAll<PurchaseRequest>('purchase_requests')
        ]);
        
        const hasPendingRequest = (itemName: string) => {
            return allRequests.some(r => r.itemName.toLowerCase() === itemName.toLowerCase() && !['Concluído', 'Cancelado'].includes(r.status));
        };

        const consumedComponents = targetEntry.details.componentesEstoque || [];
        let reservedComponents = [];
        
        if (targetEntry.type === 'checkout') {
            const allCheckinsData = await dataService.getAll<ChecklistEntry>('checklist_checkin');
            const originalCheckin = allCheckinsData.find(c => String(c.id) === String(targetEntry.id));
            reservedComponents = originalCheckin?.details?.componentesEstoque || [];
        }

        const allInvolvedItemIds = new Set([
            ...consumedComponents.map((c: any) => String(c.itemId)), 
            ...reservedComponents.map((r: any) => String(r.itemId))
        ]);

        for (const itemId of allInvolvedItemIds) {
            const stockItem = currentStock.find(i => String(i.id) === itemId);
            if (stockItem) {
                const reservedQty = reservedComponents.find((r: any) => String(r.itemId) === itemId)?.qty || 0;
                const consumedQty = consumedComponents.find((c: any) => String(c.itemId) === itemId)?.qty || 0;
                
                const currentQty = stockItem.quantity || 0;
                const newQty = Math.max(0, currentQty - consumedQty);
                const newReserved = Math.max(0, (stockItem.reservedQuantity || 0) - reservedQty);
                
                const updatedStockItem = { 
                    ...stockItem, 
                    quantity: newQty, 
                    reservedQuantity: newReserved
                };
                
                await dataService.save('stock_items', updatedStockItem);

                // Geração de pedido de compra se abaixo do mínimo
                // Fórmula solicitada: (Mínimo * 2) - Saldo Atual
                if (newQty < stockItem.minQuantity && !hasPendingRequest(stockItem.name)) {
                    const buyQty = (stockItem.minQuantity * 2) - newQty;
                    if (buyQty > 0) {
                        const autoRequest: PurchaseRequest = {
                            id: `auto-buy-${Date.now()}-${stockItem.id}`,
                            owner_id: currentUser.id,
                            itemName: stockItem.name,
                            quantity: buyQty,
                            unit: stockItem.unit,
                            requester: 'Sistema Orner (Auto)',
                            date: new Date().toISOString(),
                            priority: 'Alta',
                            status: 'Aberto',
                            clientName: `Reposição via ${targetEntry.type === 'manutencao' ? 'Manutenção' : 'Obra'}: ${targetEntry.project}`,
                            purchaseType: 'Reposição',
                            observation: `Pedido automático gerado por conclusão de serviço. Saldo pós-baixa (${newQty}) abaixo do mínimo (${stockItem.minQuantity}). Fórmula aplicada: (Mínimo*2)-Atual.`
                        };
                        await dataService.save('purchase_requests', autoRequest);
                    }
                }

                if (consumedQty > 0) {
                    const originPath = targetEntry.type === 'manutencao' ? 'Manutenção' : 'Check-out (Instalação)';
                    const movement: StockMovement = { 
                        id: `mov-${Date.now()}-${stockItem.id}`, 
                        owner_id: currentUser.id, 
                        itemId: String(stockItem.id), 
                        quantity: consumedQty, 
                        type: 'saida', 
                        date: new Date().toISOString(), 
                        projectName: targetEntry.project, 
                        observation: originPath
                    };
                    await dataService.save('stock_movements', movement);
                }
            }
        }
    };

    const updateStatus = async (status: 'Efetivado' | 'Perdido' | 'Finalizado') => {
        if (!statusTargetEntry) return;
        setIsSaving(true);
        try {
            const currentTable = getTableName(statusTargetEntry.type);
            const updated = { ...statusTargetEntry, status };

            if (status === 'Efetivado' && statusTargetEntry.type === 'checkin') {
                const currentStock = await dataService.getAll<StockItem>('stock_items');
                const components = statusTargetEntry.details.componentesEstoque || [];
                for (const comp of components) {
                    const stockItem = currentStock.find(i => String(i.id) === String(comp.itemId));
                    if (stockItem) {
                        const updatedStockItem = { 
                            ...stockItem, 
                            reservedQuantity: (stockItem.reservedQuantity || 0) + comp.qty 
                        };
                        await dataService.save('stock_items', updatedStockItem);
                    }
                }
                const autoCheckout: ChecklistEntry = { 
                    id: statusTargetEntry.id, 
                    owner_id: statusTargetEntry.owner_id, 
                    type: 'checkout', 
                    project: statusTargetEntry.project, 
                    responsible: currentUser.name, 
                    date: new Date().toISOString(), 
                    status: 'Aberto', 
                    details: { ...INITIAL_CHECKOUT, nomeCliente: statusTargetEntry.project, componentesEstoque: [...(statusTargetEntry.details.componentesEstoque || [])], originalCheckinId: statusTargetEntry.id } 
                };
                await dataService.save('checklist_checkout', autoCheckout);
                alert(`Venda confirmada! Materiais reservados.`);
            }

            if (status === 'Finalizado' && (statusTargetEntry.type === 'checkout' || statusTargetEntry.type === 'manutencao')) {
                await processStockDeduction(statusTargetEntry);
                
                if (statusTargetEntry.type === 'checkout') {
                    const allCheckinsData = await dataService.getAll<ChecklistEntry>('checklist_checkin');
                    const originalCheckin = allCheckinsData.find(c => String(c.id) === String(statusTargetEntry.id));
                    if (originalCheckin) await dataService.save('checklist_checkin', { ...originalCheckin, status: 'Finalizado' });

                    const allOrcamentosData = await dataService.getAll<SavedOrcamento>('orcamentos');
                    const targetOrcamento = allOrcamentosData.find(o => {
                        const variant = o.variants?.find(v => v.isPrincipal) || o.variants?.[0] || { formState: o.formState };
                        return variant.formState?.nomeCliente === statusTargetEntry.project;
                    });
                    if (targetOrcamento) await dataService.save('orcamentos', { ...targetOrcamento, status: 'Finalizado' });
                }
            }

            await dataService.save(currentTable, updated);
            setStatusModalOpen(false);
            await loadData();
        } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const currentTable = getTableName(activeFormType);
        const project = form.nomeCliente || form.nomeTitular || 'Sem nome';
        
        let targetStatus = editingEntryId ? entries.find(e => e.id === editingEntryId)?.status || 'Aberto' : 'Aberto';
        
        if (activeFormType === 'manutencao' && targetStatus === 'Aberto') {
            if (confirm("Deseja salvar e já FINALIZAR este registro de manutenção? (Isso dará baixa imediata no estoque)")) {
                targetStatus = 'Finalizado';
            }
        }

        const newEntry: ChecklistEntry = {
            id: editingEntryId || Date.now().toString(), 
            owner_id: currentUser.id, 
            type: activeFormType,
            project, 
            responsible: form.responsavelTecnico || form.tecnicoResponsavel || currentUser.name,
            date: form.dataVisita || form.dataTermino || form.dataManutencao || new Date().toISOString(),
            status: targetStatus,
            details: form
        };

        try {
            if (targetStatus === 'Finalizado') {
                await processStockDeduction(newEntry);
            }
            await dataService.save(currentTable, newEntry);
            await loadData();
            setModalOpen(false);
            setEditingEntryId(null);
            setIsViewOnly(false);
            setActiveStep(1);
            setForm(getInitialForm(view));
            alert(targetStatus === 'Finalizado' ? "Manutenção finalizada e estoque baixado!" : "Salvo com sucesso!");
        } catch(e: any) { alert(`Erro ao salvar.`); } finally { setIsSaving(false); }
    };

    const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || !activePhotoField) return;
        const currentPhotos = form[activePhotoField] || [];
        const filesToProcess = (Array.from(files) as File[]).slice(0, maxFilesForActiveField - currentPhotos.length);
        filesToProcess.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const compressedBase64 = await compressImage(reader.result as string);
                if (compressedBase64) { setForm((prev: any) => ({ ...prev, [activePhotoField]: [...(prev[activePhotoField] || []), compressedBase64] })); }
            };
            reader.readAsDataURL(file);
        });
        e.target.value = '';
        setActivePhotoField(null);
    };

    const [tempComp, setTempComp] = useState({ itemId: '', qty: 1 });
    const [tempPainel, setTempPainel] = useState<PainelConfig>({ id: '', linhas: 1, modulos: 1, orientacao: 'Retrato' });

    const addPainelConfig = () => {
        if (isViewOnly) return;
        setForm((prev: any) => ({ ...prev, paineisConfig: [...(prev.paineisConfig || []), { ...tempPainel, id: `p-${Date.now()}` }] }));
        setTempPainel({ id: '', linhas: 1, modulos: 1, orientacao: 'Retrato' });
    };

    const selectClientFromSuggestions = (client: any) => {
        setForm({
            ...form,
            nomeTitular: client.name,
            emailTitular: client.email || form.emailTitular,
            telefoneTitular: client.phone || form.telefoneTitular
        });
        setShowNameSuggestions(false);
    };

    const renderGalleryItem = (field: string, label: string, max: number = 10) => {
        const photos = form[field] || [];
        return (
            <div key={field} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 space-y-2">
                <label className="text-[10px] font-bold text-gray-500 leading-tight block tracking-tight">{label}</label>
                {photos.length > 0 && (
                    <div className="grid grid-cols-4 gap-1.5 pb-1">
                        {photos.map((url: string, idx: number) => (
                            <div key={idx} className="relative aspect-square rounded-lg border border-white bg-white overflow-hidden shadow-sm cursor-pointer group">
                                <img 
                                    src={url} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105" 
                                    alt="" 
                                    onClick={() => setHdPhoto(url)}
                                />
                                {!isViewOnly && <button onClick={() => setForm((p:any)=>({...p, [field]: p[field].filter((_:any, i:any)=>i!==idx)}))} className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 shadow-sm hover:bg-red-700 transition-all z-10"><XCircleIcon className="w-3 h-3" /></button>}
                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity" onClick={() => setHdPhoto(url)}>
                                    <EyeIcon className="w-4 h-4 text-white drop-shadow-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                {!isViewOnly && photos.length < max && (
                    <button type="button" onClick={() => { setActivePhotoField(field); setMaxFilesForActiveField(max); fileInputRef.current?.click(); }} className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-600 hover:border-indigo-400 transition-all group">
                        <PhotographIcon className="w-4 h-4" /><span className="text-[10px] font-bold tracking-tight">Anexar fotos ({photos.length}/{max})</span>
                    </button>
                )}
            </div>
        );
    };

    const renderComponentStep = () => (
        <div className="space-y-4 animate-fade-in max-h-[60vh] overflow-y-auto pr-1">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm">
                <SectionHeader icon={<CubeIcon />} title={activeFormType === 'checkin' ? 'Reservar componentes do estoque' : 'Ajustar consumo real de materiais'} />
                {!isViewOnly && (
                    <div className="flex gap-1.5 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-700 items-center">
                        <select 
                            value={tempComp.itemId} 
                            onChange={e => setTempComp({...tempComp, itemId: e.target.value})} 
                            className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-1 focus:ring-indigo-500 min-w-0"
                        >
                            <option value="">Selecionar item...</option>
                            {stockItems.map(i => <option key={i.id} value={String(i.id)}>{i.name}</option>)}
                        </select>
                        <input 
                            type="number" 
                            min="1" 
                            value={tempComp.qty} 
                            onChange={e => setTempComp({...tempComp, qty: parseInt(e.target.value) || 1})} 
                            className="w-24 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs font-bold text-center dark:text-white flex-shrink-0" 
                        />
                        <button 
                            onClick={() => {
                                const item = stockItems.find(i => String(i.id) === tempComp.itemId);
                                if (item) setForm((p: any) => ({...p, componentesEstoque: [...(p.componentesEstoque || []), { itemId: String(item.id), name: item.name, qty: tempComp.qty }]}));
                                setTempComp({ itemId: '', qty: 1 });
                            }} 
                            disabled={!tempComp.itemId} 
                            className="w-9 h-9 bg-indigo-600 text-white rounded-lg font-bold shadow hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
                        >
                            <PlusIcon className="w-5 h-5"/>
                        </button>
                    </div>
                )}
                <div className="space-y-1.5 mt-4">
                    {(form.componentesEstoque || []).length > 0 ? (form.componentesEstoque || []).map((comp: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-lg text-[11px] font-bold border border-transparent hover:border-indigo-100 transition-all">
                            <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                                <span className="text-gray-700 dark:text-gray-200">{comp.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                                {!isViewOnly ? (
                                    <input 
                                        type="number" 
                                        value={comp.qty} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setForm((p:any) => ({
                                                ...p, 
                                                componentesEstoque: p.componentesEstoque.map((c:any, i:number) => i === idx ? {...c, qty: val} : c)
                                            }));
                                        }}
                                        className="w-24 bg-white dark:bg-gray-900 border border-indigo-100 rounded-md p-1 text-center font-bold text-indigo-600"
                                    />
                                ) : (
                                    <span className="bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 rounded text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">{comp.qty} un</span>
                                )}
                                {!isViewOnly && (<button onClick={() => setForm((p:any)=>({...p, componentesEstoque: p.componentesEstoque.filter((_:any, i:any)=>i!==idx)}))} className="text-red-400 hover:text-red-600 transition-colors"><XCircleIcon className="w-4 h-4"/></button>)}
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-[10px] text-gray-400 font-bold italic py-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-dashed">Nenhum componente incluído.</p>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">{view === 'checkin' ? <ClipboardCheckIcon className="w-8 h-8"/> : view === 'checkout' ? <CheckCircleIcon className="w-8 h-8" /> : <WrenchIcon className="w-8 h-8" />}</div>
                    <div><h2 className="text-xl font-bold text-gray-800 dark:text-white">{view === 'checkin' ? 'Check-in de obra' : view === 'checkout' ? 'Check-out (Pós-instalação)' : 'Manutenção'}</h2><p className="text-[11px] text-gray-400 font-semibold tracking-wider">{view === 'checkin' ? 'Vistorias técnicas oficiais' : view === 'checkout' ? 'Documentação final de entrega' : 'Documentação para manutenções avulsas'}</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setEditingEntryId(null); setIsViewOnly(false); setForm(getInitialForm(view)); setActiveFormType(view); setActiveStep(1); setModalOpen(true); }} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><PlusIcon className="w-4 h-4"/> Novo registro</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Buscar por cliente ou responsável..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-none text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"/></div>
                <div className="flex items-center gap-2"><FilterIcon className="w-4 h-4 text-gray-400" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg py-2 pl-3 pr-8 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="Todos">Todos status</option><option value="Aberto">Abertos</option><option value="Efetivado">Efetivados</option><option value="Finalizado">Finalizados</option><option value="Perdido">Perdidos</option></select></div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-500 border-b">
                            <tr><th className="px-6 py-4 text-center">Data</th><th className="px-6 py-4">Projeto / cliente</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-right">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredEntries.map(entry => (
                                <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 text-gray-500 font-semibold text-center whitespace-nowrap">{entry.date ? new Date(entry.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '---'}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900 dark:text-white text-xs">{entry.project}</td>
                                    <td className="px-6 py-4 text-gray-500 text-xs font-medium">{entry.responsible}</td>
                                    <td className="px-6 py-4 text-center"><span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${(entry.status || 'Aberto').toLowerCase() === 'efetivado' ? 'bg-green-100 text-green-700' : (entry.status || 'Aberto').toLowerCase() === 'finalizado' ? 'bg-purple-100 text-purple-700' : (entry.status || 'Aberto').toLowerCase() === 'perdido' ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-blue-600'}`}>{entry.status || 'Aberto'}</span></td>
                                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                                        <button onClick={() => handleView(entry)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Visualizar formulário"><EyeIcon className="w-5 h-5"/></button>
                                        {(entry.status || 'Aberto').toLowerCase() === 'aberto' && (
                                            <>
                                                <button onClick={() => handleEdit(entry)} className="p-1.5 text-gray-400 hover:text-indigo-600" title="Editar informações">
                                                    <EditIcon className="w-5 h-5"/>
                                                </button>
                                                <button onClick={() => handleOpenStatus(entry)} className="p-1.5 text-gray-400 hover:text-green-600" title={entry.type === 'checkin' ? "Confirmar venda" : "Finalizar obra/serviço"}>
                                                    <CheckCircleIcon className="w-5 h-5"/>
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {isStatusModalOpen && statusTargetEntry && (
                <Modal title={statusTargetEntry.type === 'checkin' ? "Confirmar venda" : "Finalizar serviço"} onClose={() => setStatusModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-50 text-indigo-600">
                            <ClipboardCheckIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                {statusTargetEntry.type === 'checkin' ? 'Deseja efetivar este projeto?' : 'Confirmar conclusão do atendimento?'}
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Cliente: <span className="font-bold text-gray-700 dark:text-gray-200">{statusTargetEntry.project}</span></p>
                            {(statusTargetEntry.type === 'checkout' || statusTargetEntry.type === 'manutencao') && (
                                <p className="text-[10px] text-red-500 font-bold bg-red-50 p-2 rounded">Isso dará baixa definitiva no estoque!</p>
                            )}
                        </div>
                        <div className="flex flex-col gap-3">
                            <button 
                                onClick={() => updateStatus(statusTargetEntry.type === 'checkin' ? 'Efetivado' : 'Finalizado')}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                            >
                                <div className="flex items-center gap-2">
                                    <CheckCircleIcon className="w-5 h-5" /> 
                                    {statusTargetEntry.type === 'checkin' ? 'Confirmar venda' : 'Finalizar serviço'}
                                </div>
                            </button>
                            {statusTargetEntry.type === 'checkin' && (
                                <button 
                                    onClick={() => updateStatus('Perdido')}
                                    className="w-full py-3 bg-white dark:bg-gray-800 text-red-600 border border-red-200 dark:border-red-900/50 rounded-xl font-bold text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition-all flex items-center justify-center gap-2"
                                >
                                    <XCircleIcon className="w-5 h-5" /> Cancelar venda (Venda perdida)
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={() => setStatusModalOpen(false)}
                            className="text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 pt-2"
                        >
                            Voltar
                        </button>
                    </div>
                </Modal>
            )}

            {isModalOpen && (
                <Modal 
                    title={isViewOnly ? `Visualizando ${activeFormType === 'checkin' ? 'check-in' : activeFormType === 'checkout' ? 'check-out' : 'manutenção'}` : (editingEntryId ? "Editar documentação" : "Novo registro")} 
                    onClose={() => { if(!isSaving) { setModalOpen(false); setEditingEntryId(null); setIsViewOnly(false); setActiveFormType(view); } }} 
                    maxWidth="max-w-2xl"
                >
                    <div className="px-1">
                        <div className="flex items-center justify-center gap-2 mb-8 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-inner">
                            {[1, 2, 3, 4, 5].map(step => (
                                <div key={step} className="flex items-center">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${activeStep === step ? 'bg-indigo-600 text-white shadow-lg scale-110' : activeStep > step ? 'bg-green-50 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700'}`}>
                                        {activeStep > step ? <CheckCircleIcon className="w-4 h-4" /> : step}
                                    </div>
                                    {step < 5 && <div className={`w-5 sm:w-10 h-0.5 mx-1 rounded-full ${activeStep > step ? 'bg-green-400' : 'bg-gray-100 dark:bg-gray-700'}`} />}
                                </div>
                            ))}
                        </div>

                        <div className="space-y-6">
                            {activeFormType === 'checkin' && (
                                <div className="animate-fade-in space-y-6">
                                    {activeStep === 1 && (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<CalendarIcon />} title="Identificação da visita" color="bg-indigo-600" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div><FormLabel>Responsável técnico</FormLabel><StandardInput placeholder="Nome do técnico" value={form.responsavelTecnico} onChange={(e:any)=>setForm({...form, responsavelTecnico: e.target.value})} disabled={isViewOnly} /></div>
                                                    <div><FormLabel>Data da visita</FormLabel><StandardInput type="date" value={form.dataVisita} onChange={(e:any)=>setForm({...form, dataVisita: e.target.value})} disabled={isViewOnly} /></div>
                                                </div>
                                            </div>
                                            
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<UsersIcon />} title="Informações do titular" color="bg-blue-600" />
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-12 relative" ref={suggestionRef}>
                                                        <FormLabel>Nome do titular da conta de luz</FormLabel>
                                                        <div className="relative">
                                                            <input 
                                                                type="text"
                                                                autoComplete="off"
                                                                placeholder="Digite o nome completo do cliente" 
                                                                value={form.nomeTitular} 
                                                                onFocus={() => !isViewOnly && setShowNameSuggestions(true)}
                                                                onChange={(e) => {
                                                                    setForm({...form, nomeTitular: e.target.value});
                                                                    if (!isViewOnly) setShowNameSuggestions(true);
                                                                }} 
                                                                disabled={isViewOnly}
                                                                className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all pr-10"
                                                            />
                                                            {!isViewOnly && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={() => setShowNameSuggestions(!showNameSuggestions)}
                                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600"
                                                                >
                                                                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showNameSuggestions ? 'rotate-180' : ''}`} />
                                                                </button>
                                                            )}
                                                        </div>

                                                        {showNameSuggestions && !isViewOnly && filteredApprovedClients.length > 0 && (
                                                            <div className="absolute top-full left-0 z-50 w-full bg-white dark:bg-gray-800 mt-1 rounded-xl shadow-2xl border border-indigo-50 dark:border-gray-700 py-2 max-h-52 overflow-y-auto custom-scrollbar animate-fade-in">
                                                                <p className="px-4 py-1.5 text-[9px] font-black text-indigo-500 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 mb-1">Clientes aptos para vistoria técnica</p>
                                                                {filteredApprovedClients.map((client, idx) => (
                                                                    <button
                                                                        key={idx}
                                                                        type="button"
                                                                        onClick={() => selectClientFromSuggestions(client)}
                                                                        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group border-l-2 border-transparent hover:border-indigo-600"
                                                                    >
                                                                        <div>
                                                                            <p className="text-[11px] font-bold text-gray-800 dark:text-white group-hover:text-indigo-700 transition-colors">{client.name}</p>
                                                                            <p className="text-[9px] text-gray-400 font-medium">{client.email || 'Sem e-mail'} • {client.phone || 'Sem telefone'}</p>
                                                                        </div>
                                                                        <CheckCircleIcon className="w-3.5 h-3.5 text-indigo-200 group-hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-all" />
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="md:col-span-7"><FormLabel>E-mail</FormLabel><StandardInput type="email" placeholder="email@exemplo.com" value={form.emailTitular} onChange={(e:any)=>setForm({...form, emailTitular: e.target.value})} disabled={isViewOnly} /></div>
                                                    <div className="md:col-span-5"><FormLabel>WhatsApp</FormLabel><StandardInput placeholder="(00) 00000-0000" value={form.telefoneTitular} onChange={(e:any)=>setForm({...form, telefoneTitular: e.target.value})} disabled={isViewOnly} /></div>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<MapIcon />} title="Localização da obra" color="bg-teal-600" />
                                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                    <div className="md:col-span-4"><FormLabel>Cep</FormLabel><div className="relative"><StandardInput maxLength={9} placeholder="00000-000" value={form.cep} onChange={(e:any)=>setForm({...form, cep: e.target.value})} disabled={isViewOnly} />{isLoadingCep && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>}</div></div>
                                                    <div className="md:col-span-8"><FormLabel>Endereço completo</FormLabel><StandardInput placeholder="Rua, número, bairro..." value={form.enderecoCompleto} onChange={(e:any)=>setForm({...form, enderecoCompleto: e.target.value})} disabled={isViewOnly} /></div>
                                                    <div className="md:col-span-4"><FormLabel>Estado</FormLabel><select className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={form.estado} onChange={(e:any)=>setForm({...form, estado: e.target.value})} disabled={isViewOnly}><option value="">Selecione</option>{ESTADOS_BR.map(uf=><option key={uf} value={uf}>{uf}</option>)}</select></div>
                                                    <div className="md:col-span-8"><FormLabel>Cidade</FormLabel><div className="relative"><select className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-xs font-semibold dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50" value={form.cidade} onChange={(e:any)=>setForm({...form, cidade: e.target.value})} disabled={isViewOnly || !form.estado || isLoadingCidades}><option value="">{isLoadingCidades ? 'Carregando...' : 'Selecione a cidade'}</option>{cidades.map(c=><option key={c} value={c}>{c}</option>)}</select></div></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeStep === 2 && (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<CogIcon />} title="Configuração de painéis" color="bg-indigo-600" />
                                                {!isViewOnly && (
                                                    <div className="flex flex-wrap items-end gap-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-indigo-100 dark:border-indigo-900 mb-5">
                                                        <div className="w-20"><FormLabel>Linhas</FormLabel><StandardInput type="number" value={tempPainel.linhas} onChange={(e:any)=>setTempPainel({...tempPainel, linhas: parseInt(e.target.value)||1})} /></div>
                                                        <div className="w-20"><FormLabel>Módulos</FormLabel><StandardInput type="number" value={tempPainel.modulos} onChange={(e:any)=>setTempPainel({...tempPainel, modulos: parseInt(e.target.value)||1})} /></div>
                                                        <div className="flex-1 min-w-[100px]"><FormLabel>Orientação</FormLabel><select className="w-full rounded-lg border-transparent bg-white dark:bg-gray-800 p-2 text-xs font-bold dark:text-white" value={tempPainel.orientacao} onChange={(e:any)=>setTempPainel({...tempPainel, orientacao: e.target.value})}><option value="Retrato">Retrato</option><option value="Paisagem">Paisagem</option></select></div>
                                                        <button type="button" onClick={addPainelConfig} className="bg-indigo-600 text-white p-2 rounded-lg shadow hover:bg-indigo-700 transition-all"><PlusIcon className="w-5 h-5"/></button>
                                                    </div>
                                                )}
                                                <div className="space-y-1.5">
                                                    {(form.paineisConfig || []).map((p: any, idx: number) => (
                                                        <div key={p.id} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-lg border border-transparent hover:border-indigo-100">
                                                            <div className="flex items-center gap-3 text-[10px] font-bold tracking-tight">
                                                                <span className="bg-white dark:bg-gray-900 px-2 py-0.5 rounded border shadow-sm">Fileira {idx+1}</span>
                                                                <span className="text-gray-500">{p.linhas} Linhas x {p.modulos} mod/linha ({p.orientacao})</span>
                                                            </div>
                                                            {!isViewOnly && <button onClick={()=>setForm({...form, paineisConfig: form.paineisConfig.filter((_:any, i:any)=>i!==idx)})} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4"/></button>}
                                                        </div>
                                                    ))}
                                                    {(form.paineisConfig || []).length === 0 && <p className="text-center py-4 text-[10px] font-bold text-gray-400 italic">Nenhuma configuração adicionada.</p>}
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<HomeIcon />} title="Estrutura de fixação" color="bg-orange-600" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div><FormLabel>Estrutura de fixação</FormLabel><SelectButton cols="grid-cols-2" options={["Cerâmico", "Tégula", "Fibrocimento", "Metálico", "Telha sanduíche", "Laje", "Solo"]} value={form.tipoTelhado} onChange={v=>setForm({...form, tipoTelhado: v})} disabled={isViewOnly} /></div>
                                                        <div><FormLabel>Material da estrutura</FormLabel><SelectButton cols="grid-cols-2" options={["Estrutura madeira", "Estrutura metálica", "Não aplica"]} value={form.materialEstrutura} onChange={v=>setForm({...form, materialEstrutura: v})} disabled={isViewOnly} /></div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div><FormLabel>Área útil suficiente?</FormLabel><SelectButton options={["Sim", "Não"]} value={form.areaUtilSuficiente} onChange={v=>setForm({...form, areaUtilSuficiente: v})} disabled={isViewOnly} /></div>
                                                            <div><FormLabel>Sombreamento?</FormLabel><SelectButton options={["Sim", "Não"]} value={form.sombreamento} onChange={v=>setForm({...form, sombreamento: v})} disabled={isViewOnly} /></div>
                                                        </div>
                                                        <div><FormLabel>Informe a inclinação do telhado em graus e a orientação da inclinação (Norte, sul, leste, oeste...)</FormLabel><StandardInput value={form.inclinacaoOrientacao} onChange={(e:any)=>setForm({...form, inclinacaoOrientacao: e.target.value})} disabled={isViewOnly} /></div>
                                                        <div><FormLabel>Existe aterramento no local de instalação?</FormLabel><SelectButton options={["Sim", "Não"]} value={form.existeAterramentoNoLocal} onChange={v=>setForm({...form, existeAterramentoNoLocal: v})} disabled={isViewOnly} /></div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeStep === 3 && (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<BoltIcon />} title="Padrão de entrada e ligação" color="bg-yellow-500" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div className="grid grid-cols-1 gap-4">
                                                            <div><FormLabel>Classe do cliente</FormLabel><SelectButton options={["Residencial", "Comercial", "Rural", "Industrial"]} value={form.classeCliente} onChange={v=>setForm({...form, classeCliente: v})} disabled={isViewOnly} /></div>
                                                            <div><FormLabel>Tipo de ligação</FormLabel><SelectButton options={["Monofásica", "Bifásica", "Trifásica"]} value={form.tipoLigacaoCliente} onChange={v=>setForm({...form, tipoLigacaoCliente: v})} disabled={isViewOnly} /></div>
                                                        </div>
                                                        <div><FormLabel>Qual a tensão nominal do cliente?</FormLabel><SelectButton cols="grid-cols-2" options={["127/220 V", "220/380 V", "Outro"]} value={form.tensaoNominal} onChange={v=>setForm({...form, tensaoNominal: v})} disabled={isViewOnly} />{form.tensaoNominal === 'Outro' && <StandardInput placeholder="Especifique a tensão nominal" className="mt-2" value={form.tensaoNominalOutro} onChange={(e:any)=>setForm({...form, tensaoNominalOutro: e.target.value})} disabled={isViewOnly} />}</div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div><FormLabel>Cabo transversal</FormLabel><SelectButton cols="grid-cols-3" options={["16 mm", "25 mm", "35 mm", "Outro"]} value={form.espessuraCabo} onChange={v=>setForm({...form, espessuraCabo: v})} disabled={isViewOnly} />{form.espessuraCabo === 'Outro' && <StandardInput placeholder="Informe o cabo transversal..." className="mt-2" value={form.espessuraCaboOutro} onChange={(e:any)=>setForm({...form, espessuraCaboOutro: e.target.value})} disabled={isViewOnly} />}</div>
                                                        <div><FormLabel>Ligação entrada</FormLabel><SelectButton options={["Aérea", "Subterrânea"]} value={form.tipoLigacaoEntrada} onChange={v=>setForm({...form, tipoLigacaoEntrada: v})} disabled={isViewOnly} />{form.tipoLigacaoEntrada === 'Aérea' && <div className="mt-3"><FormLabel>Informar o comprimento do ramal de ligação</FormLabel><StandardInput placeholder="Ex: 15 metros" value={form.comprimentoRamalAereo} onChange={(e:any)=>setForm({...form, comprimentoRamalAereo: e.target.value})} disabled={isViewOnly} /></div>}</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeStep === 4 && (
                                        <div className="space-y-6">
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<ClipboardListIcon />} title="Infraestrutura e conexão" color="bg-purple-600" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div><FormLabel>Potência do transformador (kva)</FormLabel><SelectButton options={["Sim", "Não"]} value={form.possuiTransformador} onChange={v=>setForm({...form, possuiTransformador: v})} disabled={isViewOnly} />{form.possuiTransformador === 'Sim' && <div className="mt-3"><FormLabel>Potência em kva</FormLabel><StandardInput type="number" placeholder="Ex: 75" value={form.transformadorKVA} onChange={(e:any)=>setForm({...form, transformadorKVA: e.target.value})} disabled={isViewOnly} /></div>}</div>
                                                        <div><FormLabel>Local de conexão do inversor</FormLabel><SelectButton cols="grid-cols-1" options={["Quadro de distribuição central", "Caixa de passagem (não existente)", "Caixa de passagem (existente)", "Outro"]} value={form.localConexaoRede} onChange={v=>setForm({...form, localConexaoRede: v})} disabled={isViewOnly} />{form.localConexaoRede === 'Outro' && <StandardInput placeholder="Especifique o local" className="mt-2" value={form.localConexaoRedeOutro} onChange={(e:any)=>setForm({...form, localConexaoRedeOutro: e.target.value})} disabled={isViewOnly} />}</div>
                                                    </div>
                                                    <div className="space-y-4">
                                                        <div><FormLabel>Tubulação</FormLabel><CheckboxList options={["Conduíte embutido já existente", "Eletroduto pvc antichamas", "Eletroduto galvanizado", "Eletrocalha galvanizada", "Outro"]} value={form.tipoTubulacao} onChange={v=>setForm({...form, tipoTubulacao: v})} disabled={isViewOnly} /></div>
                                                        <div><FormLabel>Qual a corrente do disjuntor do padrão de entrada do cliente ?</FormLabel><StandardInput placeholder="Ex: 40a" value={form.correnteDisjuntorPadrao} onChange={(e:any)=>setForm({...form, correnteDisjuntorPadrao: e.target.value})} disabled={isViewOnly} /></div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<MapIcon />} title="Logística e distâncias" color="bg-blue-600" />
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div><FormLabel>Informar as distancias dos postes da concessionária entre si</FormLabel><StandardInput value={form.distanciaPostesConcessionaria} onChange={(e:any)=>setForm({...form, distanciaPostesConcessionaria: e.target.value})} disabled={isViewOnly} /></div>
                                                    <div><FormLabel>Informar a distancia em metros do Inversor/Microinversores até o disjuntor do sistema</FormLabel><StandardInput value={form.distanciaInversorDisjuntor} onChange={(e:any)=>setForm({...form, distanciaInversorDisjuntor: e.target.value})} disabled={isViewOnly} /></div>
                                                    <div className="md:col-span-2"><FormLabel>Informar a distancia em metros do disjuntor do sistema até o padrão de entrada do imóvel.</FormLabel><StandardInput value={form.distanciaDisjuntorPadrao} onChange={(e:any)=>setForm({...form, distanciaDisjuntorPadrao: e.target.value})} disabled={isViewOnly} /></div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {activeStep === 5 && (
                                        <div className="space-y-6">
                                            {renderComponentStep()}
                                            
                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<PlusIcon />} title="Materiais especiais" color="bg-indigo-600" />
                                                <div className="space-y-4">
                                                    <div><FormLabel>Compra de material especial?</FormLabel><SelectButton options={["Sim", "Não"]} value={form.necessitaMaterialExtra} onChange={v=>setForm({...form, necessitaMaterialExtra: v})} disabled={isViewOnly} /></div>
                                                    {form.necessitaMaterialExtra === 'Sim' && (
                                                        <div className="animate-fade-in"><FormLabel>Descrição materiais extras</FormLabel><StandardTextArea placeholder="Liste itens e especificações..." value={form.materialExtraDescricao} onChange={(e:any)=>setForm({...form, materialExtraDescricao: e.target.value})} disabled={isViewOnly} /></div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                                <SectionHeader icon={<CameraIcon />} title="Galeria técnica" color="bg-pink-600" />
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    {renderGalleryItem('fotoFachada', 'Foto da Fachada do Imóvel (Deve aparecer o Padrão de Entrada)')}
                                                    {renderGalleryItem('fotoRamal', 'Foto do Ramal de Ligação (parte superior do poste onde os fios entram para residência)')}
                                                    {renderGalleryItem('fotoPadraoEntrada', 'Foto do Padrão de Entrada (Todo o poste com o medidor em uma única imagem)')}
                                                    {renderGalleryItem('fotoMedidorDisjuntor', 'Foto do Medidor em conjunto com o disjuntor do medidor')}
                                                    {renderGalleryItem('fotoDisjuntorPadrao', 'Foto do Disjuntor do padrão de entrada (com o valor do disjuntor legível)')}
                                                    {renderGalleryItem('fotoQuadroInversor', 'Foto do Quadro de Disjuntores onde será conectado o Microinversor ou o Inversor.')}
                                                    {renderGalleryItem('fotoAmplaTelhado', 'Foto ampla do telhado onde serão fixados os painéis')}
                                                    {renderGalleryItem('fotoLocalInversor', 'Qual local será instalado o inversor / string box')}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeFormType === 'checkout' && (
                                <div className="animate-fade-in space-y-6">
                                    {activeStep === 1 && (
                                        <div className="space-y-4">
                                            <div><FormLabel>Nome do cliente *</FormLabel><StandardInput value={form.nomeCliente} onChange={(e:any)=>setForm({...form, nomeCliente: e.target.value})} disabled={isViewOnly} /></div>
                                            <div><FormLabel>Data término instalação *</FormLabel><StandardInput type="date" value={form.dataTermino} onChange={(e:any)=>setForm({...form, dataTermino: e.target.value})} disabled={isViewOnly} /></div>
                                        </div>
                                    )}
                                    {activeStep === 2 && (
                                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                            {renderGalleryItem('fotosPlacas', 'Fotos Placas Instaladas')}
                                            {renderGalleryItem('fotosInversores', 'Fotos dos Micros Inversores / Inversor')}
                                            {renderGalleryItem('fotosAterramento', 'Fotos de instalação do aterramento das Placas Solares')}
                                        </div>
                                    )}
                                    {activeStep === 3 && (
                                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                            {renderGalleryItem('fotosQuadroInterno', 'Foto Quadro de Energia Interno ( se foi usado mais de um, incluir fotos de todos)')}
                                            {renderGalleryItem('fotosMedidor', 'Medidor concessionária *')}
                                            {renderGalleryItem('fotosDisjuntorDPS', 'Fotos do disjuntor e DPS do medidor')}
                                        </div>
                                    )}
                                    {activeStep === 4 && (
                                        <div className="space-y-4">
                                            {renderGalleryItem('fotoPadraoPoste', 'Foto Padrão (Poste) com as Placas de Identificação', 1)}
                                            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-4">
                                                <div><FormLabel>Vídeo de antilhamento (Enel)? *</FormLabel><SelectButton options={["Sim", "Não", "Não é enel"]} value={form.videoAntilhamento} onChange={v=>setForm({...form, videoAntilhamento: v})} disabled={isViewOnly} /></div>
                                                <div><FormLabel>Link vídeo Youtube? *</FormLabel><SelectButton options={["Sim", "Não", "Não é enel"]} value={form.videoYoutube} onChange={v=>setForm({...form, videoYoutube: v})} disabled={isViewOnly} /></div>
                                                {form.videoYoutube === 'Sim' && <StandardInput placeholder="Cole o link aqui" value={form.linkYoutube} onChange={(e:any)=>setForm({...form, linkYoutube: e.target.value})} disabled={isViewOnly} />}
                                            </div>
                                        </div>
                                    )}
                                    {activeStep === 5 && renderComponentStep()}
                                </div>
                            )}

                            {activeFormType === 'manutencao' && (
                                <div className="animate-fade-in space-y-6">
                                    {activeStep === 1 && (
                                        <div className="space-y-4">
                                            <div><FormLabel>Nome do cliente / projeto</FormLabel><StandardInput value={form.nomeCliente} onChange={(e:any)=>setForm({...form, nomeCliente: e.target.value})} disabled={isViewOnly} /></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><FormLabel>Técnico responsável</FormLabel><StandardInput value={form.tecnicoResponsavel} onChange={(e:any)=>setForm({...form, tecnicoResponsavel: e.target.value})} disabled={isViewOnly} /></div>
                                                <div><FormLabel>Data da manutenção</FormLabel><StandardInput type="date" value={form.dataManutencao} onChange={(e:any)=>setForm({...form, dataManutencao: e.target.value})} disabled={isViewOnly} /></div>
                                            </div>
                                            <div><FormLabel>Tipo de manutenção</FormLabel><SelectButton options={["Corretiva", "Preventiva", "Garantia"]} value={form.tipoManutencao} onChange={v=>setForm({...form, tipoManutencao: v})} disabled={isViewOnly} /></div>
                                        </div>
                                    )}
                                    {activeStep === 2 && (
                                        <div className="space-y-4">
                                            <div><FormLabel>Relato do cliente</FormLabel><StandardTextArea placeholder="O que o cliente reportou?" value={form.relatoCliente} onChange={(e:any)=>setForm({...form, relatoCliente: e.target.value})} disabled={isViewOnly} /></div>
                                            <div><FormLabel>Diagnóstico técnico</FormLabel><StandardTextArea placeholder="Situação encontrada?" value={form.diagnosticoTecnico} onChange={(e:any)=>setForm({...form, diagnosticoTecnico: e.target.value})} disabled={isViewOnly} /></div>
                                        </div>
                                    )}
                                    {activeStep === 3 && (
                                        <div className="space-y-4">
                                            <div><FormLabel>Serviço realizado</FormLabel><StandardTextArea placeholder="Descrição da execução..." value={form.servicoRealizado} onChange={(e:any)=>setForm({...form, servicoRealizado: e.target.value})} disabled={isViewOnly} /></div>
                                            <div><FormLabel>Status final sistema</FormLabel><SelectButton options={["Operacional", "Operacional parcial", "Aguardando peça"]} value={form.statusSistemaFinal} onChange={v=>setForm({...form, statusSistemaFinal: v})} disabled={isViewOnly} /></div>
                                            <div><FormLabel>Observações finais</FormLabel><StandardTextArea placeholder="Detalhes técnicos adicionais..." value={form.observacoesFinais} onChange={(e:any)=>setForm({...form, observacoesFinais: e.target.value})} disabled={isViewOnly} /></div>
                                        </div>
                                    )}
                                    {activeStep === 4 && (
                                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                                            {renderGalleryItem('fotosAntes', 'Problema inicial *', 5)}
                                            {renderGalleryItem('fotosDepois', 'Serviço concluído *', 5)}
                                            {renderGalleryItem('fotosEquipamentos', 'Equipamentos/Série *', 5)}
                                        </div>
                                    )}
                                    {activeStep === 5 && renderComponentStep()}
                                </div>
                            )}

                            <div className="flex justify-between items-center pt-8 border-t border-gray-100 dark:border-gray-700 mt-4">
                                <button type="button" onClick={() => activeStep > 1 ? setActiveStep(activeStep - 1) : setModalOpen(false)} className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-[11px] hover:bg-gray-200 transition-all flex items-center gap-1.5"><ArrowLeftIcon className="w-4 h-4"/> {activeStep === 1 ? 'Cancelar' : 'Voltar'}</button>
                                <div className="flex gap-2">
                                    {activeStep < 5 ? (
                                        <button type="button" onClick={() => setActiveStep(activeStep + 1)} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-[11px] shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-1.5">Próximo passo <span className="opacity-50">→</span></button>
                                    ) : (
                                        !isViewOnly && (
                                            <button type="button" onClick={handleSave} disabled={isSaving} className="px-8 py-2 bg-green-600 text-white rounded-xl font-bold text-[11px] shadow-lg hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50">
                                                {isSaving ? 'Gravando...' : (activeFormType === 'manutencao' ? 'Finalizar e baixar estoque' : 'Finalizar registro')}
                                            </button>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handlePhotoUpload} />
                </Modal>
            )}

            {hdPhoto && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setHdPhoto(null)}
                >
                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
                        <button 
                            className="absolute top-0 right-0 p-3 text-white hover:text-indigo-400 transition-colors z-[110]"
                            onClick={(e) => { e.stopPropagation(); setHdPhoto(null); }}
                        >
                            <XCircleIcon className="w-10 h-10" />
                        </button>
                        
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                            <img 
                                src={hdPhoto} 
                                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in" 
                                alt="Visualização HD" 
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>

                        <div className="bg-white/10 px-6 py-2 rounded-full backdrop-blur-md">
                            <p className="text-white text-[11px] font-black tracking-widest uppercase">Visualização em Alta Definição</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CheckListPage;