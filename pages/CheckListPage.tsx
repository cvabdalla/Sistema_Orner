
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { CheckListPageProps, ChecklistEntry, StockItem, StockMovement, PurchaseRequest } from '../types';
import { 
    ClipboardCheckIcon, CheckCircleIcon, TrashIcon, 
    PlusIcon, PhotographIcon, EyeIcon, WrenchIcon,
    XCircleIcon, ArrowLeftIcon, CubeIcon, UploadIcon,
    EditIcon, ExclamationTriangleIcon, SearchIcon, FilterIcon,
    VideoCameraIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';

const ESTADOS_BR = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

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
    <label className="block text-[12px] font-bold text-gray-500 mb-1 tracking-tight">{children}</label>
);

const StandardInput = (props: any) => (
    <input 
        {...props} 
        disabled={props.disabled}
        className={`w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-sm font-semibold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-75 ${props.className || ''}`} 
    />
);

const StandardTextArea = (props: any) => (
    <textarea 
        {...props} 
        disabled={props.disabled}
        className={`w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2 text-sm font-semibold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-75 min-h-[120px] ${props.className || ''}`} 
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
                className={`py-1.5 px-2 rounded-lg border text-[11px] font-semibold transition-all ${
                    value === opt 
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm' 
                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 hover:bg-gray-50'
                } ${disabled ? 'cursor-not-allowed opacity-75' : ''}`}
            >
                {opt}
            </button>
        ))}
    </div>
);

const CheckboxList: React.FC<{ options: string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }> = ({ options, value, onChange, disabled }) => (
    <div className="space-y-1.5 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
        {options.map(opt => (
            <label key={opt} className={`flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer hover:bg-white dark:hover:bg-gray-700 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 tracking-tight">{opt}</span>
            </label>
        ))}
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
            /* FIXED: Changed MAX_SIZE to MAX_HEIGHT as MAX_SIZE was not defined */
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
        };
        img.onerror = () => resolve('');
    });
};

const CheckListPage: React.FC<CheckListPageProps> = ({ view, currentUser }) => {
    const [entries, setEntries] = useState<ChecklistEntry[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [cidades, setCIDADES] = useState<string[]>([]);
    const [isModalOpen, setModalOpen] = useState(false);
    const [isStatusModalOpen, setStatusModalOpen] = useState(false);
    const [activeStep, setActiveStep] = useState(1);
    
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
        const isAdmin = currentUser.profileId === '00000000-0000-0000-0000-000000000001';
        const currentTable = getTableName(view);
        try {
            const results = await Promise.allSettled([
                dataService.getAll<any>(currentTable, currentUser.id, isAdmin),
                dataService.getAll<StockItem>('stock_items', currentUser.id, isAdmin)
            ]);
            const rawCurrent = results[0].status === 'fulfilled' ? results[0].value : [];
            const rawStock = results[1].status === 'fulfilled' ? results[1].value : [];
            setEntries(rawCurrent.sort((a:any, b:any) => (b.date || '').localeCompare(a.date || '')));
            setStockItems(rawStock.sort((a:any, b:any) => a.name.localeCompare(b.name)));
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, [currentUser, view]);

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

    const updateStatus = async (status: 'Efetivado' | 'Perdido' | 'Finalizado') => {
        if (!statusTargetEntry) return;
        setIsSaving(true);
        try {
            const currentTable = getTableName(statusTargetEntry.type);
            const updated = { ...statusTargetEntry, status };
            
            // LÓGICA CHECK-IN: RESERVA E REPOSIÇÃO AUTOMÁTICA NA CONFIRMAÇÃO DE VENDA
            if (status === 'Efetivado' && statusTargetEntry.type === 'checkin') {
                const components = statusTargetEntry.details.componentesEstoque || [];
                const currentStock = await dataService.getAll<StockItem>('stock_items');
                
                for (const comp of components) {
                    const stockItem = currentStock.find(i => String(i.id) === String(comp.itemId));
                    if (stockItem) {
                        const newReserved = (stockItem.reservedQuantity || 0) + comp.qty;
                        const futureStock = (stockItem.quantity || 0) - newReserved;

                        const updatedStockItem = { ...stockItem, reservedQuantity: newReserved };
                        await dataService.save('stock_items', updatedStockItem);

                        if (futureStock < stockItem.minQuantity) {
                            // Cálculo: (Mínimo * 2) - Saldo Atual
                            const buyQty = (stockItem.minQuantity * 2) - stockItem.quantity;
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
                                    status: 'Pendente',
                                    clientName: `Reposição via Obra: ${statusTargetEntry.project}`,
                                    purchaseType: 'Reposição',
                                    observation: `Pedido automático: Saldo futuro (${futureStock}) abaixo do mínimo (${stockItem.minQuantity}) após reserva. Quantidade calculada: ((Min*2)-EstoqueAtual).`
                                };
                                await dataService.save('purchase_requests', autoRequest);
                            }
                        }
                    }
                }

                // Cria o registro de checkout automaticamente quando o checkin é efetivado
                const autoCheckout: ChecklistEntry = {
                    id: statusTargetEntry.id, owner_id: statusTargetEntry.owner_id, type: 'checkout',
                    project: statusTargetEntry.project, responsible: currentUser.name, date: new Date().toISOString(), status: 'Aberto',
                    details: { 
                        ...INITIAL_CHECKOUT, 
                        nomeCliente: statusTargetEntry.project, 
                        componentesEstoque: [...(statusTargetEntry.details.componentesEstoque || [])], 
                        originalCheckinId: statusTargetEntry.id 
                    }
                };
                await dataService.save('checklist_checkout', autoCheckout);
                alert(`Venda confirmada! Materiais reservados e ordem de instalação criada.`);
            }

            // LÓGICA FINALIZAÇÃO (CHECK-OUT E MANUTENCAO): BAIXA DEFINITIVA E LIMPEZA DE RESERVA
            if (status === 'Finalizado' && (statusTargetEntry.type === 'checkout' || statusTargetEntry.type === 'manutencao')) {
                const consumedComponents = statusTargetEntry.details.componentesEstoque || [];
                const currentStock = await dataService.getAll<StockItem>('stock_items');

                let reservedComponents = [];
                if (statusTargetEntry.type === 'checkout') {
                    // Busca o checkin original para saber quanto foi reservado na entrada.
                    const allCheckins = await dataService.getAll<ChecklistEntry>('checklist_checkin');
                    const originalCheckin = allCheckins.find(c => String(c.id) === String(statusTargetEntry.id));
                    reservedComponents = originalCheckin?.details?.componentesEstoque || [];
                    
                    // Atualiza o status do check-in original para 'Finalizado' para que ele suma das Reservas na tela de estoque
                    if (originalCheckin) {
                        await dataService.save('checklist_checkin', { ...originalCheckin, status: 'Finalizado' });
                    }
                }

                // Identificamos todos os IDs de itens envolvidos (sejam reservados ou consumidos)
                const allInvolvedItemIds = new Set([
                    ...consumedComponents.map((c: any) => String(c.itemId)),
                    ...reservedComponents.map((r: any) => String(r.itemId))
                ]);

                for (const itemId of allInvolvedItemIds) {
                    const stockItem = currentStock.find(i => String(i.id) === itemId);
                    if (stockItem) {
                        const reservedQty = reservedComponents.find((r: any) => String(r.itemId) === itemId)?.qty || 0;
                        const consumedQty = consumedComponents.find((c: any) => String(c.itemId) === itemId)?.qty || 0;
                        
                        const newQty = Math.max(0, (stockItem.quantity || 0) - consumedQty);
                        const updatedStockItem = {
                            ...stockItem,
                            quantity: newQty,
                            reservedQuantity: Math.max(0, (stockItem.reservedQuantity || 0) - reservedQty)
                        };
                        await dataService.save('stock_items', updatedStockItem);

                        // REGISTRO DE MOVIMENTAÇÃO NO HISTÓRICO
                        if (consumedQty > 0) {
                            const movement: StockMovement = {
                                id: `mov-${Date.now()}-${stockItem.id}`,
                                owner_id: currentUser.id,
                                itemId: String(stockItem.id),
                                quantity: consumedQty,
                                type: 'saida',
                                date: new Date().toISOString(),
                                observation: `Saída definitiva por finalização de ${statusTargetEntry.type === 'checkout' ? 'Obra' : 'Manutenção'}: ${statusTargetEntry.project}`
                            };
                            await dataService.save('stock_movements', movement);
                        }

                        // PEDIDO DE COMPRA AUTOMÁTICO SE ESTOQUE ABAIXO DO MÍNIMO APÓS BAIXA
                        if (newQty < stockItem.minQuantity) {
                            // Cálculo: (Mínimo * 2) - Saldo Atual (pós baixa)
                            const buyQty = (stockItem.minQuantity * 2) - newQty;
                            if (buyQty > 0) {
                                const autoRequest: PurchaseRequest = {
                                    id: `auto-buy-final-${Date.now()}-${stockItem.id}`,
                                    owner_id: currentUser.id,
                                    itemName: stockItem.name,
                                    quantity: buyQty,
                                    unit: stockItem.unit,
                                    requester: 'Sistema Orner (Auto)',
                                    date: new Date().toISOString(),
                                    priority: 'Alta',
                                    status: 'Pendente',
                                    clientName: 'Reposição Central',
                                    purchaseType: 'Reposição',
                                    observation: `Pedido automático: Estoque atual (${newQty}) abaixo do mínimo (${stockItem.minQuantity}) após conclusão de ${statusTargetEntry.type === 'checkout' ? 'obra' : 'manutenção'}. Quantidade calculada: ((Min*2)-EstoqueAtual).`
                                };
                                await dataService.save('purchase_requests', autoRequest);
                            }
                        }
                    }
                }
                alert(`${statusTargetEntry.type === 'checkout' ? 'Obra' : 'Manutenção'} finalizada com sucesso! Estoque e reservas atualizados.`);
            }

            await dataService.save(currentTable, updated);
            setStatusModalOpen(false);
            await loadData();
        } catch (e: any) { alert(e.message); } finally { setIsSaving(false); }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const currentTable = getTableName(activeFormType);
        const project = form.nomeCliente || form.nomeTitular || 'Sem Nome';
        const newEntry: ChecklistEntry = {
            id: editingEntryId || Date.now().toString(), owner_id: currentUser.id, type: activeFormType,
            project, responsible: form.responsavelTecnico || form.tecnicoResponsavel || currentUser.name,
            date: form.dataVisita || form.dataTermino || form.dataManutencao || new Date().toISOString(),
            status: editingEntryId ? entries.find(e => e.id === editingEntryId)?.status || 'Aberto' : 'Aberto',
            details: form
        };
        try {
            await dataService.save(currentTable, newEntry);
            await loadData();
            setModalOpen(false);
            setEditingEntryId(null);
            setIsViewOnly(false);
            setActiveStep(1);
            setForm(getInitialForm(view));
            alert("Salvo com sucesso!");
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

    if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    const renderGalleryItem = (field: string, label: string, max: number = 10) => {
        const photos = form[field] || [];
        return (
            <div key={field} className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700 space-y-3">
                <label className="text-[12px] font-bold text-gray-500 leading-tight block">{label}</label>
                {photos.length > 0 && (
                    <div className="grid grid-cols-5 gap-2 pb-2">
                        {photos.map((url: string, idx: number) => (
                            <div key={idx} className="relative aspect-square rounded-lg border bg-white overflow-hidden shadow-sm">
                                <img src={url} className="w-full h-full object-cover" alt="" />
                                {!isViewOnly && <button onClick={() => setForm((p:any)=>({...p, [field]: p[field].filter((_:any, i:any)=>i!==idx)}))} className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-0.5 shadow-lg hover:bg-red-700"><XCircleIcon className="w-3 h-3" /></button>}
                            </div>
                        ))}
                    </div>
                )}
                {!isViewOnly && photos.length < max && (
                    <button type="button" onClick={() => { setActivePhotoField(field); setMaxFilesForActiveField(max); fileInputRef.current?.click(); }} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-50 transition-all">
                        <PhotographIcon className="w-4 h-4" /><span className="text-[11px] font-bold">Anexar fotos ({photos.length}/{max})</span>
                    </button>
                )}
            </div>
        );
    };

    const renderComponentStep = () => (
        <div className="space-y-4 animate-fade-in max-h-[65vh] overflow-y-auto pr-1">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border-2 border-indigo-100 dark:border-indigo-900 shadow-sm">
                <FormLabel>{activeFormType === 'checkin' ? 'Reservar componentes do estoque' : 'Ajustar consumo real de materiais'}</FormLabel>
                {!isViewOnly && (
                    <div className="flex gap-1.5 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600 items-center">
                        <select 
                            value={tempComp.itemId} 
                            onChange={e => setTempComp({...tempComp, itemId: e.target.value})} 
                            className="flex-1 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 min-w-0"
                        >
                            <option value="">Selecionar item...</option>
                            {stockItems.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                        </select>
                        <input 
                            type="number" 
                            min="1" 
                            value={tempComp.qty} 
                            onChange={e => setTempComp({...tempComp, qty: parseInt(e.target.value) || 1})} 
                            className="w-14 rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-xs font-bold text-center dark:text-white flex-shrink-0" 
                        />
                        <button 
                            onClick={() => {
                                const item = stockItems.find(i => String(i.id) === tempComp.itemId);
                                if (item) setForm((p: any) => ({...p, componentesEstoque: [...(p.componentesEstoque || []), { itemId: String(item.id), name: item.name, qty: tempComp.qty }]}));
                                setTempComp({ itemId: '', qty: 1 });
                            }} 
                            disabled={!tempComp.itemId} 
                            className="w-9 h-9 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
                            title="Adicionar ao formulário"
                        >
                            <PlusIcon className="w-5 h-5"/>
                        </button>
                    </div>
                )}
                <div className="space-y-1.5 mt-4">
                    {(form.componentesEstoque || []).length > 0 ? (form.componentesEstoque || []).map((comp: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 dark:bg-gray-700/40 p-2.5 rounded-lg text-[10px] font-semibold border dark:border-gray-600">
                            <span className="text-gray-700 dark:text-gray-200">{comp.name}</span>
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
                                        className="w-12 bg-white dark:bg-gray-800 border rounded p-1 text-center font-black text-indigo-600"
                                    />
                                ) : (
                                    <span className="bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 rounded text-indigo-700 dark:text-indigo-300 font-black">{comp.qty} un</span>
                                )}
                                {!isViewOnly && (<button onClick={() => setForm((p:any)=>({...p, componentesEstoque: p.componentesEstoque.filter((_:any, i:any)=>i!==idx)}))} className="text-red-400 hover:text-red-600"><XCircleIcon className="w-4 h-4"/></button>)}
                            </div>
                        </div>
                    )) : (
                        <p className="text-center text-[10px] text-gray-400 italic py-2">Nenhum componente incluído.</p>
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
                    <div><h2 className="text-xl font-bold tracking-tight text-gray-800 dark:text-white">{view === 'checkin' ? 'Check-in de obra' : view === 'checkout' ? 'Check-out (Pós-instalação)' : 'Manutenção'}</h2><p className="text-[11px] text-gray-400 font-semibold tracking-wider">{view === 'checkin' ? 'Vistorias técnicas oficiais' : view === 'checkout' ? 'Documentação final de entrega' : 'Documentação para manutenções avulsas'}</p></div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => { setEditingEntryId(null); setIsViewOnly(false); setForm(getInitialForm(view)); setActiveFormType(view); setActiveStep(1); setModalOpen(true); }} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><PlusIcon className="w-4 h-4"/> Novo registro</button>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Buscar por cliente ou responsável..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-none text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"/></div>
                <div className="flex items-center gap-2"><FilterIcon className="w-4 h-4 text-gray-400" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="bg-gray-50 dark:bg-gray-700/50 border-none rounded-lg py-2 pl-3 pr-8 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"><option value="Todos">Todos status</option><option value="Aberto">Abertos</option><option value="Efetivado">Efetivados</option><option value="Finalizado">Finalizados</option><option value="Perdido">Perdidos</option></select></div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
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
                                <CheckCircleIcon className="w-5 h-5" /> {statusTargetEntry.type === 'checkin' ? 'Confirmar venda' : 'Finalizar serviço'}
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
                <Modal title={isViewOnly ? `Visualizando` : (editingEntryId ? "Editar documentação" : "Novo registro")} onClose={() => { if(!isSaving) { setModalOpen(false); setEditingEntryId(null); setIsViewOnly(false); setActiveFormType(view); } }} maxWidth="max-w-md">
                    <div className="px-1">
                        <div className="flex items-center justify-center gap-3 mb-6 border-b dark:border-gray-700 pb-4">
                            {[1, 2, 3, 4, 5].map(step => (<div key={step} className={`w-2.5 h-2.5 rounded-full transition-all ${activeStep === step ? 'bg-indigo-600 scale-125 shadow-md' : activeStep > step ? 'bg-indigo-200' : 'bg-gray-200'}`} />))}
                        </div>

                        <div className="space-y-4">
                            {activeFormType === 'checkin' && (
                                <>
                                    {activeStep === 1 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="grid grid-cols-5 gap-3">
                                                <div className="col-span-3"><FormLabel>Responsável técnico</FormLabel><StandardInput disabled={isViewOnly} placeholder="Nome do técnico" value={form.responsavelTecnico} onChange={(e: any) => setForm({...form, responsavelTecnico: e.target.value})} /></div>
                                                <div className="col-span-2"><FormLabel>Data da visita</FormLabel><StandardInput disabled={isViewOnly} type="date" value={form.dataVisita} onChange={(e: any) => setForm({...form, dataVisita: e.target.value})} /></div>
                                            </div>
                                            <div><FormLabel>Nome do titular da conta de luz</FormLabel><StandardInput disabled={isViewOnly} placeholder="Ex: João da Silva Santos" value={form.nomeTitular} onChange={(e: any) => setForm({...form, nomeTitular: e.target.value})} /></div>
                                            <div className="grid grid-cols-4 gap-3">
                                                <div className="col-span-1"><FormLabel>CEP {isLoadingCep && <span className="text-[9px] text-indigo-500 ml-2">...</span>}</FormLabel><StandardInput disabled={isViewOnly} placeholder="00000-000" value={form.cep} onChange={(e: any) => setForm({...form, cep: e.target.value})} /></div>
                                                <div className="col-span-3"><FormLabel>Endereço completo</FormLabel><StandardInput disabled={isViewOnly} placeholder="Rua, número, bairro..." value={form.enderecoCompleto} onChange={(e: any) => setForm({...form, enderecoCompleto: e.target.value})} /></div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-3">
                                                <div className="col-span-1"><FormLabel>Estado</FormLabel><select disabled={isViewOnly} value={form.estado} onChange={(e) => setForm({...form, estado: e.target.value, cidade: ''})} className="w-full rounded-lg bg-gray-50 p-2 text-sm font-semibold">{ESTADOS_BR.map(uf => <option key={uf} value={uf}>{uf}</option>)}</select></div>
                                                <div className="col-span-3"><FormLabel>Cidade</FormLabel><select disabled={!form.estado || isLoadingCidades || isViewOnly} value={form.cidade} onChange={(e) => setForm({...form, cidade: e.target.value})} className="w-full rounded-lg bg-gray-50 p-2 text-sm font-semibold">{cidades.map(cid => <option key={cid} value={cid}>{cid}</option>)}</select></div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><FormLabel>E-mail</FormLabel><StandardInput disabled={isViewOnly} type="email" value={form.emailTitular} onChange={(e: any) => setForm({...form, emailTitular: e.target.value})} /></div>
                                                <div><FormLabel>WhatsApp</FormLabel><StandardInput disabled={isViewOnly} value={form.telefoneTitular} onChange={(e: any) => setForm({...form, telefoneTitular: e.target.value})} /></div>
                                            </div>
                                        </div>
                                    )}
                                    {activeStep === 2 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="bg-gray-50 p-3 rounded-xl border">
                                                <h4 className="text-[11px] font-bold text-indigo-600 mb-3 text-center tracking-widest uppercase">Configuração dos painéis</h4>
                                                {!isViewOnly && (
                                                    <div className="flex flex-wrap items-end gap-2 mb-3">
                                                        <div className="w-16"><FormLabel>Linhas</FormLabel><StandardInput type="number" value={tempPainel.linhas} onChange={(e: any) => setTempPainel({...tempPainel, linhas: parseInt(e.target.value) || 0})} /></div>
                                                        <div className="w-16"><FormLabel>Módulos</FormLabel><StandardInput type="number" value={tempPainel.modulos} onChange={(e: any) => setTempPainel({...tempPainel, modulos: parseInt(e.target.value) || 0})} /></div>
                                                        <div className="flex-1 min-w-[120px]"><FormLabel>Orientação</FormLabel><SelectButton options={["Retrato", "Paisagem"]} value={tempPainel.orientacao} onChange={(v) => setTempPainel({...tempPainel, orientacao: v})} /></div>
                                                        <button type="button" onClick={addPainelConfig} className="p-2.5 bg-indigo-600 text-white rounded-lg"><PlusIcon className="w-4 h-4" /></button>
                                                    </div>
                                                )}
                                                <div className="space-y-1.5">
                                                    {(form.paineisConfig || []).map((p: any) => (
                                                        <div key={p.id} className="flex justify-between items-center bg-white p-2 rounded-lg border text-xs shadow-sm"><div className="flex gap-4"><span className="font-bold">{p.linhas} Linhas</span><span className="font-bold text-indigo-600">{p.modulos} mod/linha</span></div>{!isViewOnly && (<button onClick={() => setForm((prev:any)=>({...prev, paineisConfig: prev.paineisConfig.filter((x:any)=>x.id!==p.id)}))} className="text-red-400"><XCircleIcon className="w-4 h-4" /></button>)}</div>
                                                    ))}
                                                </div>
                                            </div>
                                            <div><FormLabel>Estrutura de fixação</FormLabel><SelectButton disabled={isViewOnly} cols="grid-cols-3" options={["Cerâmico", "Tégula", "Fibrocimento", "Metálico", "Telha Sanduíche", "Laje", "Solo"]} value={form.tipoTelhado} onChange={(v) => setForm({...form, tipoTelhado: v})} /></div>
                                            <div><FormLabel>Material da estrutura</FormLabel><SelectButton disabled={isViewOnly} cols="grid-cols-3" options={["Estrutura Madeira", "Estrutura Metálica", "Não Aplica"]} value={form.materialEstrutura} onChange={(v) => setForm({...form, materialEstrutura: v})} /></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><FormLabel>Área útil suficiente?</FormLabel><SelectButton disabled={isViewOnly} options={["Sim", "Não"]} value={form.areaUtilSuficiente} onChange={(v) => setForm({...form, areaUtilSuficiente: v})} /></div>
                                                <div><FormLabel>Sombreamento?</FormLabel><SelectButton disabled={isViewOnly} options={["Sim", "Não"]} value={form.sombreamento} onChange={(v) => setForm({...form, sombreamento: v})} /></div>
                                            </div>
                                            <div><FormLabel>Informe a inclinação do telhado em graus e a orientação da inclinação (Norte, Sul, Leste, Oeste, ...)</FormLabel><StandardInput disabled={isViewOnly} value={form.inclinacaoOrientacao} onChange={(e: any) => setForm({...form, inclinacaoOrientacao: e.target.value})} /></div>
                                            <div><FormLabel>Existe aterramento no local de instalação ?</FormLabel><SelectButton disabled={isViewOnly} options={["Sim", "Não"]} value={form.existeAterramentoNoLocal} onChange={(v) => setForm({...form, existeAterramentoNoLocal: v})} /></div>
                                        </div>
                                    )}
                                    {activeStep === 3 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><FormLabel>Classe do cliente</FormLabel><SelectButton options={["Residencial", "Comercial", "Rural", "Industrial"]} value={form.classeCliente} onChange={(v) => setForm({...form, classeCliente: v})} disabled={isViewOnly} /></div>
                                                <div><FormLabel>Tipo de ligação</FormLabel><SelectButton options={["Monofásica", "Bifásica", "Trifásica"]} value={form.tipoLigacaoCliente} onChange={(v) => setForm({...form, tipoLigacaoCliente: v})} disabled={isViewOnly} /></div>
                                            </div>
                                            <div><FormLabel>Qual a tensão nominal do cliente?</FormLabel><SelectButton cols="grid-cols-3" options={["127/220 V", "220/380 V", "Outro"]} value={form.tensaoNominal} onChange={(v) => setForm({...form, tensaoNominal: v})} disabled={isViewOnly} /></div>
                                            {form.tensaoNominal === 'Outro' && (<div className="animate-fade-in"><FormLabel>Especifique a tensão nominal</FormLabel><StandardInput value={form.tensaoNominalOutro} onChange={(e: any) => setForm({...form, tensaoNominalOutro: e.target.value})} disabled={isViewOnly} /></div>)}
                                            <div className="grid grid-cols-1 gap-3">
                                                <FormLabel>Cabo transversal</FormLabel>
                                                <SelectButton cols="grid-cols-4" options={["16 mm", "25 mm", "35 mm", "Outro"]} value={form.espessuraCabo} onChange={(v) => setForm({...form, espessuraCabo: v})} disabled={isViewOnly} />
                                                {form.espessuraCabo === 'Outro' && (<div className="animate-fade-in"><StandardInput placeholder="Informe o cabo transversal..." value={form.espessuraCaboOutro} onChange={(e: any) => setForm({...form, espessuraCaboOutro: e.target.value})} disabled={isViewOnly} /></div>)}
                                            </div>
                                            <div><FormLabel>Ligação entrada</FormLabel><SelectButton disabled={isViewOnly} options={["Aérea", "Subterrânea"]} value={form.tipoLigacaoEntrada} onChange={(v) => setForm({...form, tipoLigacaoEntrada: v})} /></div>
                                            {form.tipoLigacaoEntrada === 'Aérea' && (<div className="animate-fade-in"><FormLabel>Informar o comprimento do ramal de ligação</FormLabel><StandardInput value={form.comprimentoRamalAereo} onChange={(e: any) => setForm({...form, comissaoVendasValor: e.target.value})} disabled={isViewOnly} /></div>)}
                                        </div>
                                    )}
                                    {activeStep === 4 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div>
                                                <FormLabel>Cliente possui transformador exclusivo? Se sim, informar a potência em kVA</FormLabel>
                                                <SelectButton options={["Sim", "Não"]} value={form.possuiTransformador} onChange={(v) => setForm({...form, possuiTransformador: v})} disabled={isViewOnly} />
                                                {form.possuiTransformador === 'Sim' && (<div className="animate-fade-in mt-2"><FormLabel>Potência em kVA</FormLabel><StandardInput value={form.transformadorKVA} onChange={(e: any) => setForm({...form, transformadorKVA: e.target.value})} disabled={isViewOnly} /></div>)}
                                            </div>
                                            <div>
                                                <FormLabel>Qual será o local de conexão do inversor ou microinversor com a rede?</FormLabel>
                                                <SelectButton disabled={isViewOnly} cols="grid-cols-1" options={["Quadro de distribuição central", "Caixa de passagem (não existente)", "Caixa de passagem (existente)", "Outro"]} value={form.localConexaoRede} onChange={(v) => setForm({...form, localConexaoRede: v})} />
                                                {form.localConexaoRede === 'Outro' && (<div className="mt-2 animate-fade-in"><StandardInput value={form.localConexaoRedeOutro} onChange={(e: any) => setForm({...form, localConexaoRedeOutro: e.target.value})} disabled={isViewOnly} /></div>)}
                                            </div>
                                            <div>
                                                <FormLabel>Que tipo de tubulação será usada?</FormLabel>
                                                <CheckboxList 
                                                    disabled={isViewOnly} 
                                                    options={["Conduíte embutido já existente", "Eletroduto PVC antichamas", "Eletroduto galvanizado", "Eletrocalha galvanizada", "Outro"]} 
                                                    value={form.tipoTubulacao || []} 
                                                    onChange={(v) => setForm({...form, tipoTubulacao: v})} 
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 gap-3 pt-2 border-t">
                                                <div><FormLabel>Qual a corrente do disjuntor do padrão de entrada?</FormLabel><StandardInput disabled={isViewOnly} placeholder="Ex: 40A" value={form.correnteDisjuntorPadrao} onChange={(e: any) => setForm({...form, correnteDisjuntorPadrao: e.target.value})} /></div>
                                                <div><FormLabel>Informar as distancias dos postes da concessionária entre si</FormLabel><StandardInput disabled={isViewOnly} value={form.distanciaPostesConcessionaria} onChange={(e: any) => setForm({...form, distanciaPostesConcessionaria: e.target.value})} /></div>
                                                <div><FormLabel>Informar a distancia em metros do inversor até o disjuntor do sistema.</FormLabel><StandardInput disabled={isViewOnly} value={form.distanciaInversorDisjuntor} onChange={(e: any) => setForm({...form, distanciaInversorDisjuntor: e.target.value})} /></div>
                                                <div><FormLabel>Informar a distancia em metros do disjuntor do sistema até o padrão de entrada.</FormLabel><StandardInput disabled={isViewOnly} value={form.distanciaDisjuntorPadrao} onChange={(e: any) => setForm({...form, distanciaDisjuntorPadrao: e.target.value})} /></div>
                                            </div>
                                        </div>
                                    )}
                                    {activeStep === 5 && (
                                        <div className="space-y-4 animate-fade-in max-h-[65vh] overflow-y-auto">
                                            {renderComponentStep()}
                                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                                                <div>
                                                    <FormLabel>Será necessária a compra de algum material especial?</FormLabel>
                                                    <SelectButton disabled={isViewOnly} options={["Sim", "Não"]} value={form.necessitaMaterialExtra} onChange={(v) => setForm({...form, necessitaMaterialExtra: v})} />
                                                </div>
                                                {form.necessitaMaterialExtra === 'Sim' && (
                                                    <StandardTextArea disabled={isViewOnly} placeholder="Descreva aqui os materiais extras..." value={form.materialExtraDescricao} onChange={(e: any) => setForm({...form, materialExtraDescricao: e.target.value})} />
                                                )}
                                            </div>
                                            <div className="grid grid-cols-1 gap-4">
                                                {[
                                                    { field: 'fotoFachada', label: 'Foto da Fachada do Imóvel (Deve aparecer o Padrão de Entrada)' },
                                                    { field: 'fotoRamal', label: 'Foto do Ramal de Ligação (parte superior do poste onde os fios entram para residência)' },
                                                    { field: 'fotoPadraoEntrada', label: 'Foto do Padrão de Entrada (Todo o poste com o medidor em uma única imagem)' },
                                                    { field: 'fotoMedidorDisjuntor', label: 'Foto do Medidor em conjunto com o disjuntor do medidor' },
                                                    { field: 'fotoDisjuntorPadrao', label: 'Foto do Disjuntor do padrão de entrada (com o valor do disjuntor legível)' },
                                                    { field: 'fotoQuadroInversor', label: 'Foto do Quadro de Disjuntores onde será conectado o Microinversor ou o Inversor.' },
                                                    { field: 'fotoAmplaTelhado', label: 'Foto ampla do telhado onde serão fixados os painéis' },
                                                    { field: 'fotoLocalInversor', label: 'Qual local será instalado o inversor / string box ?' },
                                                ].map(item => renderGalleryItem(item.field, item.label))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {activeFormType === 'checkout' && (
                                <>
                                    {activeStep === 1 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div><FormLabel>Nome do Cliente *</FormLabel><StandardInput disabled={isViewOnly} placeholder="Sua resposta" value={form.nomeCliente} onChange={(e: any) => setForm({...form, nomeCliente: e.target.value})} /></div>
                                            <div><FormLabel>Data Término Instalação *</FormLabel><StandardInput disabled={isViewOnly} type="date" value={form.dataTermino} onChange={(e: any) => setForm({...form, dataTermino: e.target.value})} /></div>
                                        </div>
                                    )}
                                    {activeStep === 2 && (
                                        <div className="space-y-4 animate-fade-in max-h-[65vh] overflow-y-auto pr-1">
                                            {[
                                                { field: 'fotosPlacas', label: 'Fotos Placas Instaladas *', max: 10 },
                                                { field: 'fotosInversores', label: 'Fotos dos Micros Inversores / Inversor *', max: 10 },
                                                { field: 'fotosAterramento', label: 'Fotos de instalação do aterramento das Placas Solares *', max: 10 },
                                            ].map(item => renderGalleryItem(item.field, item.label, item.max))}
                                        </div>
                                    )}
                                    {activeStep === 3 && (
                                        <div className="space-y-4 animate-fade-in max-h-[65vh] overflow-y-auto pr-1">
                                            {[
                                                { field: 'fotosQuadroInterno', label: 'Foto Quadro de Energia Interno *', max: 5 },
                                                { field: 'fotosMedidor', label: 'Fotos do Medidor *', max: 5 },
                                                { field: 'fotosDisjuntorDPS', label: 'Fotos do disjuntor e DPS do medidor *', max: 5 },
                                            ].map(item => renderGalleryItem(item.field, item.label, item.max))}
                                        </div>
                                    )}
                                    {activeStep === 4 && (
                                        <div className="space-y-4 animate-fade-in">
                                            {renderGalleryItem('fotoPadraoPoste', 'Foto Padrão (Poste) com Placas de Identificação', 1)}
                                            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 space-y-4">
                                                <div><FormLabel>Concessionaria ENEL - Video de Antilhamento foi feito? *</FormLabel><SelectButton disabled={isViewOnly} options={["Sim", "Não", "N/A"]} value={form.videoAntilhamento} onChange={(v) => setForm({...form, videoAntilhamento: v})} /></div>
                                                <div><FormLabel>O link do video já foi enviado para o Youtube? *</FormLabel><SelectButton disabled={isViewOnly} options={["Sim", "Não", "N/A"]} value={form.videoYoutube} onChange={(v) => setForm({...form, videoYoutube: v})} /></div>
                                                {form.videoYoutube === 'Sim' && (
                                                    <StandardInput disabled={isViewOnly} placeholder="Cole o link aqui" value={form.linkYoutube} onChange={(e: any) => setForm({...form, linkYoutube: e.target.value})} />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {activeStep === 5 && renderComponentStep()}
                                </>
                            )}

                            {activeFormType === 'manutencao' && (
                                <>
                                    {activeStep === 1 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div><FormLabel>Nome do Cliente / Projeto</FormLabel><StandardInput disabled={isViewOnly} placeholder="Nome para identificação" value={form.nomeCliente} onChange={(e: any) => setForm({...form, nomeCliente: e.target.value})} /></div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div><FormLabel>Técnico Responsável</FormLabel><StandardInput disabled={isViewOnly} placeholder="Nome do técnico" value={form.tecnicoResponsavel} onChange={(e: any) => setForm({...form, tecnicoResponsavel: e.target.value})} /></div>
                                                <div><FormLabel>Data da Manutenção</FormLabel><StandardInput disabled={isViewOnly} type="date" value={form.dataManutencao} onChange={(e: any) => setForm({...form, dataManutencao: e.target.value})} /></div>
                                            </div>
                                            <div><FormLabel>Tipo de Manutenção</FormLabel><SelectButton disabled={isViewOnly} options={["Corretiva", "Preventiva", "Garantia"]} value={form.tipoManutencao} onChange={(v) => setForm({...form, tipoManutencao: v})} /></div>
                                        </div>
                                    )}
                                    {activeStep === 2 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div><FormLabel>Relato do Cliente (Motivo do Chamado)</FormLabel><StandardTextArea disabled={isViewOnly} placeholder="O que o cliente reportou de anormal?" value={form.relatoCliente} onChange={(e: any) => setForm({...form, relatoCliente: e.target.value})} /></div>
                                            <div><FormLabel>Diagnóstico Técnico (Situação encontrada)</FormLabel><StandardTextArea disabled={isViewOnly} placeholder="O que foi identificado ao chegar no local?" value={form.diagnosticoTecnico} onChange={(e: any) => setForm({...form, diagnosticoTecnico: e.target.value})} /></div>
                                        </div>
                                    )}
                                    {activeStep === 3 && (
                                        <div className="space-y-4 animate-fade-in">
                                            <div><FormLabel>Serviço Realizado / Ações Tomadas</FormLabel><StandardTextArea disabled={isViewOnly} placeholder="Descreva as etapas da manutenção executada..." value={form.servicoRealizado} onChange={(e: any) => setForm({...form, servicoRealizado: e.target.value})} /></div>
                                            <div><FormLabel>Status Final do Sistema</FormLabel><SelectButton disabled={isViewOnly} options={["Operacional", "Operacional Parcial", "Aguardando Peça"]} value={form.statusSistemaFinal} onChange={(v) => setForm({...form, statusSistemaFinal: v})} /></div>
                                            <div><FormLabel>Observações Finais</FormLabel><StandardTextArea disabled={isViewOnly} placeholder="Detalhes técnicos adicionais..." value={form.observacoesFinais} onChange={(e: any) => setForm({...form, observacoesFinais: e.target.value})} /></div>
                                        </div>
                                    )}
                                    {activeStep === 4 && (
                                        <div className="space-y-4 animate-fade-in max-h-[65vh] overflow-y-auto pr-1">
                                            {[
                                                { field: 'fotosAntes', label: 'Fotos do Estado Inicial (Problema) *', max: 5 },
                                                { field: 'fotosDepois', label: 'Fotos do Serviço Concluído (Solução) *', max: 5 },
                                                { field: 'fotosEquipamentos', label: 'Equipamentos (Etiquetas/Série) *', max: 5 },
                                            ].map(item => renderGalleryItem(item.field, item.label, item.max))}
                                        </div>
                                    )}
                                    {activeStep === 5 && renderComponentStep()}
                                </>
                            )}

                            <div className="flex justify-between pt-4 border-t">
                                <button disabled={activeStep === 1} onClick={() => setActiveStep(p => p - 1)} className="px-5 py-2.5 bg-gray-100 rounded-lg text-xs font-bold disabled:opacity-30">Voltar</button>
                                {activeStep < 5 ? (
                                    <button onClick={() => setActiveStep(p => p + 1)} className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md">Próximo</button>
                                ) : (
                                    !isViewOnly && <button onClick={handleSave} disabled={isSaving} className="px-8 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold shadow-md">{isSaving ? 'Gravando...' : 'Salvar'}</button>
                                )}
                            </div>
                        </div>
                    </div>
                </Modal>
            )}
            <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} ref={fileInputRef}/>
        </div>
    );
};

export default CheckListPage;
