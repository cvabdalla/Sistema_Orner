
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    CubeIcon, TrashIcon, PlusIcon, 
    ExclamationTriangleIcon, DollarIcon, EditIcon, PhotographIcon, XCircleIcon,
    ArrowUpIcon, ArrowDownIcon, FilterIcon, CalendarIcon, ClipboardListIcon, ShoppingCartIcon, LinkIcon,
    EyeIcon, CheckCircleIcon, TableIcon, UploadIcon, DocumentReportIcon, ChartPieIcon, ClockIcon, TruckIcon, UsersIcon, SearchIcon, ChevronDownIcon
} from '../assets/icons';
import type { StockItem, EstoquePageProps, PurchaseRequest, StockMovement, ChecklistEntry, PriceHistoryEntry, PurchaseRequestStatus, SavedOrcamento } from '../types';
import { dataService } from '../services/dataService';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const UNITS = ["un", "cm", "mt", "kg", "cx", "par", "kit", "pç", "m²", "lt"];
const ADMIN_PROFILE_ID = '001';

// Componente para labels de formulário padronizado
const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[12px] font-bold text-gray-500 mb-1 tracking-tight">{children}</label>
);

const EstoquePage: React.FC<EstoquePageProps> = ({ view, setCurrentPage, currentUser, userPermissions }) => {
    const [items, setItems] = useState<StockItem[]>([]);
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [checkins, setCheckins] = useState<ChecklistEntry[]>([]);
    const [approvedClients, setApprovedClients] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'inventario' | 'historico'>('inventario');
    const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'Todos' | PurchaseRequestStatus>('Todos');

    // Filtros para o Histórico de Movimentação
    const [historyItemId, setHistoryItemId] = useState<string>('Todos');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [showHistorySuggestions, setShowHistorySuggestions] = useState(false);
    const historySuggestionRef = useRef<HTMLDivElement>(null);

    const [historyStart, setHistoryStart] = useState<string>('');
    const [historyEnd, setHistoryEnd] = useState<string>('');

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<PurchaseRequest | null>(null);
    const [isManualItem, setIsManualItem] = useState(false);

    // States for status transition confirmation
    const [isConfirmStatusModalOpen, setIsConfirmStatusModalOpen] = useState(false);
    const [confirmRequest, setConfirmRequest] = useState<PurchaseRequest | null>(null);
    const [nextStatus, setNextStatus] = useState<PurchaseRequestStatus | null>(null);

    // Estado para histórico de custos
    const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
    const [selectedItemForHistory, setSelectedItemForHistory] = useState<StockItem | null>(null);

    // Estado para detalhamento de reservas
    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [selectedItemForReservation, setSelectedItemForReservation] = useState<StockItem | null>(null);

    // Estado para cadastro de produtos
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productToEdit, setStockItemToEdit] = useState<StockItem | null>(null);
    const [productForm, setProductForm] = useState({
        name: '', ncm: '', quantity: 0, minQuantity: 1, unit: 'un', description: '', image: '', averagePrice: 0, isFixedInBudget: true
    });

    const [isNFModalOpen, setIsNFModalOpen] = useState(false);
    const [nfForm, setNfForm] = useState({
        invoiceNumber: '', invoiceKey: '', totalValue: 0, invoiceFile: '', invoiceFileName: ''
    });

    const [requestForm, setRequestForm] = useState({
        itemName: '', 
        quantity: 1, 
        unit: 'un', 
        priority: 'Média' as 'Baixa' | 'Média' | 'Alta', 
        clientName: '', 
        observation: '', 
        purchaseLink: '',
        purchaseType: 'Reposição' as 'Reposição' | 'Obra' | 'Avulso',
        requestDate: new Date().toISOString().split('T')[0]
    });

    const isAdmin = useMemo(() => String(currentUser.profileId) === ADMIN_PROFILE_ID || userPermissions.includes('ALL'), [currentUser, userPermissions]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [loadedItems, loadedMovements, loadedRequests, loadedOrcamentos, loadedCheckins] = await Promise.all([
                dataService.getAll<StockItem>('stock_items', currentUser.id, true),
                dataService.getAll<StockMovement>('stock_movements', currentUser.id, true),
                view === 'compras' ? dataService.getAll<PurchaseRequest>('purchase_requests', currentUser.id, isAdmin) : Promise.resolve([]),
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdmin),
                dataService.getAll<ChecklistEntry>('checklist_checkin', currentUser.id, isAdmin)
            ]);

            setItems(loadedItems.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            setMovements(loadedMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setCheckins(loadedCheckins);
            
            if (view === 'compras') {
                setRequests(loadedRequests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
                
                const clients = loadedOrcamentos
                    .filter(orc => orc.status === 'Aprovado')
                    .map(orc => {
                        if (orc.variants?.length) {
                            const p = orc.variants.find(v => v.isPrincipal) || orc.variants[0];
                            return p.formState?.nomeCliente;
                        }
                        return orc.formState?.nomeCliente;
                    })
                    .filter(name => !!name);
                
                setApprovedClients(Array.from(new Set(clients)).sort());
            }
        } catch (error) { console.error("Erro:", error); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, [currentUser, view]);

    // Clique fora das sugestões do histórico
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (historySuggestionRef.current && !historySuggestionRef.current.contains(event.target as Node)) {
                setShowHistorySuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleUpdateStatus = async () => {
        if (!confirmRequest || !nextStatus) return;
        setIsSaving(true);
        try {
            const updated = { ...confirmRequest, status: nextStatus };
            await dataService.save('purchase_requests', updated);
            await loadData();
            setIsConfirmStatusModalOpen(false);
            setConfirmRequest(null);
            setNextStatus(null);
            setIsRequestModalOpen(false);
            setRequestToEdit(null);
        } catch (e) { 
            alert("Erro ao atualizar status"); 
        }
        finally { 
            setIsSaving(false); 
        }
    };

    const triggerStatusConfirmation = (request: PurchaseRequest, status: PurchaseRequestStatus) => {
        setConfirmRequest(request);
        setNextStatus(status);
        setIsConfirmStatusModalOpen(true);
    };

    const handleSaveRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestForm.itemName.trim()) return;
        setIsSaving(true);
        try {
            const requestData: PurchaseRequest = {
                id: requestToEdit ? requestToEdit.id : String(Date.now()),
                owner_id: requestToEdit ? requestToEdit.owner_id : currentUser.id,
                itemName: requestForm.itemName,
                quantity: Number(requestForm.quantity),
                unit: requestForm.unit,
                requester: requestToEdit ? requestToEdit.requester : currentUser.name,
                date: requestForm.requestDate,
                priority: requestForm.priority,
                status: requestToEdit ? requestToEdit.status : 'Aberto',
                clientName: requestForm.purchaseType === 'Obra' ? requestForm.clientName : 'Estoque central',
                purchaseLink: requestForm.purchaseLink,
                purchaseType: requestForm.purchaseType, 
                observation: requestForm.observation
            };
            await dataService.save('purchase_requests', requestData);
            setIsRequestModalOpen(false);
            await loadData();
        } finally { setIsSaving(false); }
    };

    const handleNFFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                setNfForm(prev => ({
                    ...prev,
                    invoiceFile: base64,
                    invoiceFileName: file.name
                }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleConfirmFinalization = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestToEdit) return;
        setIsSaving(true);
        try {
            const request = requestToEdit;
            const stockItem = items.find(i => i.name.toLowerCase() === request.itemName.toLowerCase());
            
            if (stockItem) {
                const newUnitCost = nfForm.totalValue / request.quantity;
                const currentQty = stockItem.quantity || 0;
                const currentAvgPrice = stockItem.averagePrice || 0;
                const newQtyTotal = currentQty + request.quantity;
                const weightedAveragePrice = ((currentQty * currentAvgPrice) + (request.quantity * newUnitCost)) / newQtyTotal;

                const historyEntry: PriceHistoryEntry = {
                    date: new Date().toISOString(), price: newUnitCost, invoiceNumber: nfForm.invoiceNumber
                };
                const updatedPriceHistory = [...(stockItem.priceHistory || []), historyEntry];

                await dataService.save('stock_items', {
                    ...stockItem,
                    quantity: newQtyTotal,
                    averagePrice: Math.round(weightedAveragePrice * 100) / 100,
                    priceHistory: updatedPriceHistory
                });

                await dataService.save('stock_movements', {
                    id: `mov-${Date.now()}`,
                    owner_id: currentUser.id,
                    itemId: String(stockItem.id),
                    quantity: request.quantity,
                    type: 'entrada',
                    date: new Date().toISOString(),
                    observation: `Entrada via nf ${nfForm.invoiceNumber}`
                });
            }

            await dataService.save('purchase_requests', { 
                ...request, 
                status: 'Concluído',
                invoiceFile: nfForm.invoiceFile || undefined,
                invoiceKey: nfForm.invoiceKey || undefined,
                observation: `${request.observation || ''}\n[Efetivado: nf ${nfForm.invoiceNumber}]`.trim()
            });
            
            setIsNFModalOpen(false);
            setRequestToEdit(null);
            await loadData();
            alert("Compra efetivada com sucesso! estoque atualizado.");
        } finally { setIsSaving(false); }
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productForm.name.trim()) return;
        setIsSaving(true);
        try {
            const itemData: StockItem = {
                id: productToEdit ? productToEdit.id : `prod-${Date.now()}`,
                owner_id: productToEdit ? productToEdit.owner_id : currentUser.id,
                name: productForm.name,
                ncm: productForm.ncm,
                quantity: Number(productForm.quantity),
                reservedQuantity: productToEdit ? productToEdit.reservedQuantity : 0,
                minQuantity: productForm.minQuantity,
                unit: productForm.unit,
                description: productForm.description,
                image: productForm.image,
                averagePrice: productForm.averagePrice,
                isFixedInBudget: productForm.isFixedInBudget,
                priceHistory: productToEdit ? productToEdit.priceHistory : (Number(productForm.quantity) > 0 ? [{
                    date: new Date().toISOString(),
                    price: productForm.averagePrice,
                }] : [])
            };
            await dataService.save('stock_items', itemData);
            setIsProductModalOpen(false);
            await loadData();
        } finally { setIsSaving(false); }
    };

    const handleDeleteProduct = async (id: string | number) => {
        if (confirm("Deseja realmente excluir este produto?")) {
            await dataService.delete('stock_items', id);
            await loadData();
        }
    };

    const handleProductPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setProductForm(prev => ({ ...prev, image: event.target?.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const formatCurrency = (value: number) => {
        if (isNaN(value)) return 'R$ 0,00';
        const rounded = Math.ceil(value * 100) / 100;
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
    };

    const getStatusInfo = (status: PurchaseRequestStatus) => {
        switch(status) {
            case 'Aberto': return { color: 'bg-gray-100 text-gray-700', icon: PlusIcon, label: 'Aberto' };
            case 'Aprovado': return { color: 'bg-blue-100 text-blue-700', icon: CheckCircleIcon, label: 'Aprovado' };
            case 'Comprado': return { color: 'bg-indigo-100 text-indigo-700', icon: ShoppingCartIcon, label: 'Comprado' };
            case 'Em trânsito': return { color: 'bg-purple-100 text-purple-700', icon: TruckIcon, label: 'Em trânsito' };
            case 'Concluído': return { color: 'bg-green-100 text-green-700', icon: CheckCircleIcon, label: 'Concluído' };
            case 'Cancelado': return { color: 'bg-red-100 text-red-700', icon: XCircleIcon, label: 'Cancelado' };
            default: return { color: 'bg-gray-100 text-gray-400', icon: PlusIcon, label: status };
        }
    };

    const filteredRequests = useMemo(() => {
        if (purchaseStatusFilter === 'Todos') return requests;
        return requests.filter(r => r.status === purchaseStatusFilter);
    }, [requests, purchaseStatusFilter]);

    const filteredMovements = useMemo(() => {
        return movements.filter(mov => {
            const matchesItem = historyItemId === 'Todos' || String(mov.itemId) === historyItemId;
            const movDate = mov.date.split('T')[0];
            const matchesStart = !historyStart || movDate >= historyStart;
            const matchesEnd = !historyEnd || movDate <= historyEnd;
            return matchesItem && matchesStart && matchesEnd;
        });
    }, [movements, historyItemId, historyStart, historyEnd]);

    const filteredItemsForHistory = useMemo(() => {
        if (!historySearchTerm) return items;
        return items.filter(i => i.name.toLowerCase().includes(historySearchTerm.toLowerCase()));
    }, [items, historySearchTerm]);

    const handleSelectHistoryItem = (item: StockItem | 'Todos') => {
        if (item === 'Todos') {
            setHistoryItemId('Todos');
            setHistorySearchTerm('');
        } else {
            setHistoryItemId(String(item.id));
            setHistorySearchTerm(item.name);
        }
        setShowHistorySuggestions(false);
    };

    const editableFieldClass = "w-full rounded-lg border-2 border-indigo-400 dark:border-indigo-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-[13px] font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm block";
    const labelSentenceClass = "block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 ml-0.5";

    const handleManageRequest = (req: PurchaseRequest) => {
        setRequestToEdit(req);
        /* Fix: Cast req.purchaseType to the expected literal union to fix type assignment error */
        setRequestForm({
            itemName: req.itemName,
            quantity: req.quantity,
            unit: req.unit,
            priority: req.priority,
            clientName: req.clientName || '',
            observation: req.observation || '',
            purchaseLink: req.purchaseLink || '',
            purchaseType: (req.purchaseType as 'Reposição' | 'Obra' | 'Avulso') || 'Reposição',
            requestDate: req.date
        });
        const inCatalog = items.some(i => i.name === req.itemName);
        setIsManualItem(!inCatalog);
        setIsRequestModalOpen(true);
    };

    const handleShowPriceHistory = (item: StockItem) => {
        setSelectedItemForHistory(item);
        setIsPriceHistoryModalOpen(true);
    };

    const handleShowReservations = (e: React.MouseEvent, item: StockItem) => {
        e.stopPropagation();
        if ((item.reservedQuantity || 0) <= 0) return;
        setSelectedItemForReservation(item);
        setIsReservationModalOpen(true);
    };

    const priceHistoryChartData = useMemo(() => {
        if (!selectedItemForHistory?.priceHistory) return [];
        return [...selectedItemForHistory.priceHistory]
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .map(entry => ({
                date: new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
                price: entry.price
            }));
    }, [selectedItemForHistory]);

    const activeReservations = useMemo(() => {
        if (!selectedItemForReservation) return [];
        const itemId = String(selectedItemForReservation.id);
        
        return checkins
            .filter(c => (c.status === 'Efetivado' || c.status === 'Aberto') && c.details.componentesEstoque?.some((comp: any) => String(comp.itemId) === itemId))
            .map(c => {
                const comp = c.details.componentesEstoque.find((comp: any) => String(comp.itemId) === itemId);
                return {
                    project: c.project,
                    date: c.date,
                    qty: comp?.qty || 0,
                    status: c.status,
                    responsible: c.responsible
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(a.date).getTime());
    }, [selectedItemForReservation, checkins]);

    if (view === 'visao_geral') {
        const inventoryValue = items.reduce((acc, i) => acc + (i.quantity * (i.averagePrice || 0)), 0);
        return (
            <div className="space-y-6 animate-fade-in">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque geral</h2><p className="text-xs text-gray-500 font-bold mt-1">Gestão de inventário e movimentações</p></div>
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <button onClick={() => setActiveTab('inventario')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'inventario' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Inventário atual</button>
                        <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'historico' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Histórico de movimentação</button>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <DashboardCard title="Itens no catálogo" value={items.length.toString()} icon={CubeIcon} color="bg-indigo-500" />
                    <DashboardCard title="Alertas de mínimo" value={items.filter(i => i.quantity <= i.minQuantity).length.toString()} icon={ExclamationTriangleIcon} color="bg-orange-500" />
                    <DashboardCard title="Valor total do estoque" value={formatCurrency(inventoryValue)} icon={DollarIcon} color="bg-green-600" />
                </div>

                {activeTab === 'inventario' ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-500 border-b">
                                <tr>
                                    <th className="px-4 py-4">Foto</th>
                                    <th className="px-4 py-4">Descrição</th>
                                    <th className="px-4 py-4 text-right">Custo unitário</th>
                                    <th className="px-4 py-4 text-center">Saldo</th>
                                    <th className="px-4 py-4 text-center">Saldo mínimo</th>
                                    <th className="px-4 py-4 text-center">Reservado</th>
                                    <th className="px-4 py-4 text-center">Saldo futuro</th>
                                    <th className="px-4 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {items.map(item => {
                                    const isLowStock = item.quantity <= item.minQuantity;
                                    const hasReservations = (item.reservedQuantity || 0) > 0;
                                    return (
                                        <tr key={item.id} className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group ${isLowStock ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`} onClick={() => handleShowPriceHistory(item)}>
                                            <td className="px-4 py-3"><div className="w-10 h-10 rounded-lg border bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">{item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <PhotographIcon className="w-5 h-5 text-gray-300" />}</div></td>
                                            <td className="px-4 py-3">
                                                <p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.name}</p>
                                                <p className="text-[9px] text-gray-400 font-medium">Clique para ver histórico de custos</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatCurrency(item.averagePrice || 0)}</td>
                                            <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white">{item.quantity}</td>
                                            <td className="px-4 py-3 text-center font-black text-orange-600">{item.minQuantity}</td>
                                            <td 
                                                className={`px-4 py-3 text-center font-bold ${hasReservations ? 'text-amber-600 underline decoration-dotted hover:text-amber-700' : 'text-gray-400'}`}
                                                onClick={(e) => handleShowReservations(e, item)}
                                                title={hasReservations ? "Clique para ver detalhes das reservas" : ""}
                                            >
                                                {item.reservedQuantity || 0}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-indigo-600">{(item.quantity || 0) - (item.reservedQuantity || 0)}</td>
                                            <td className="px-4 py-3 text-center">{isLowStock ? <span className="text-[9px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-full">Reposição</span> : <span className="text-[9px] font-black text-green-600 bg-green-100 px-2 py-1 rounded-full">Normal</span>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-end gap-4">
                            <div className="flex-1 w-full relative" ref={historySuggestionRef}>
                                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 ml-1">Filtrar componente</label>
                                <div className="relative">
                                    <input 
                                        type="text"
                                        autoComplete="off"
                                        placeholder="Digite para buscar componente..."
                                        value={historySearchTerm}
                                        onFocus={() => setShowHistorySuggestions(true)}
                                        onChange={(e) => {
                                            setHistorySearchTerm(e.target.value);
                                            setShowHistorySuggestions(true);
                                            if (e.target.value === '') setHistoryItemId('Todos');
                                        }}
                                        className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl px-4 pr-10 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm"
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
                                        <SearchIcon className="w-4 h-4" />
                                    </div>
                                </div>

                                {setShowHistorySuggestions && (
                                    <div className="absolute top-full left-0 z-50 w-full bg-white dark:bg-gray-800 mt-1 rounded-xl shadow-2xl border border-indigo-50 dark:border-gray-700 py-2 max-h-52 overflow-y-auto custom-scrollbar animate-fade-in">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectHistoryItem('Todos')}
                                            className="w-full flex items-center px-4 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-xs font-bold text-gray-700 dark:text-gray-200"
                                        >
                                            Todos os componentes
                                        </button>
                                        <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>
                                        {filteredItemsForHistory.map(item => (
                                            <button
                                                key={item.id}
                                                type="button"
                                                onClick={() => handleSelectHistoryItem(item)}
                                                className="w-full flex items-center px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border-l-2 border-transparent hover:border-indigo-600"
                                            >
                                                <div className="flex-1">
                                                    <p className="text-[11px] font-bold text-gray-800 dark:text-white">{item.name}</p>
                                                    <p className="text-[9px] text-gray-400 font-medium">Saldo: {item.quantity} {item.unit}</p>
                                                </div>
                                            </button>
                                        ))}
                                        {filteredItemsForHistory.length === 0 && (
                                            <p className="px-4 py-3 text-[10px] text-gray-400 italic text-center">Nenhum componente encontrado.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="w-full md:w-44">
                                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 ml-1">De (Data)</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="date" 
                                        value={historyStart}
                                        onChange={(e) => setHistoryStart(e.target.value)}
                                        className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl pl-10 pr-4 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                            <div className="w-full md:w-44">
                                <label className="block text-[11px] font-bold text-gray-400 mb-1.5 ml-1">Até (Data)</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input 
                                        type="date" 
                                        value={historyEnd}
                                        onChange={(e) => setHistoryEnd(e.target.value)}
                                        className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl pl-10 pr-4 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    />
                                </div>
                            </div>
                            {(historyItemId !== 'Todos' || historySearchTerm || historyStart || historyEnd) && (
                                <button 
                                    onClick={() => { setHistoryItemId('Todos'); setHistorySearchTerm(''); setHistoryStart(''); setHistoryEnd(''); }}
                                    className="h-11 px-4 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-100"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>

                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-400 border-b">
                                    <tr>
                                        <th className="px-6 py-4">Data</th>
                                        <th className="px-6 py-4">Cliente / Obra</th>
                                        <th className="px-6 py-4">Origem / Caminho</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4">Produto</th>
                                        <th className="px-6 py-4 text-center">Quantidade</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredMovements.length > 0 ? filteredMovements.map(mov => (
                                        <tr key={mov.id}>
                                            <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(mov.date).toLocaleString('pt-BR')}</td>
                                            <td className="px-6 py-4 text-xs font-bold text-gray-800 dark:text-gray-200">{mov.projectName || '---'}</td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                    {mov.observation || '---'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">{mov.type === 'entrada' ? <span className="text-green-600 font-black text-[10px] bg-green-50 px-2 py-0.5 rounded">Entrada</span> : <span className="text-red-600 font-black text-[10px] bg-red-50 px-2 py-0.5 rounded">Saída</span>}</td>
                                            <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200">{items.find(i => String(i.id) === String(mov.itemId))?.name || '---'}</td>
                                            <td className={`px-6 py-4 text-center font-black ${mov.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{mov.type === 'entrada' ? '+' : '-'}{mov.quantity}</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic font-bold text-xs">
                                                Nenhum registro encontrado para estes filtros.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {isPriceHistoryModalOpen && selectedItemForHistory && (
                    <Modal title={`Histórico de custos - ${selectedItemForHistory.name}`} onClose={() => setIsPriceHistoryModalOpen(false)} maxWidth="max-w-2xl">
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-400">Custo médio atual</p>
                                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                                        {formatCurrency(selectedItemForHistory.averagePrice || 0)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400">Saldo em estoque</p>
                                    <p className="text-xl font-bold text-gray-700 dark:text-gray-200">{selectedItemForHistory.quantity} {selectedItemForHistory.unit}</p>
                                </div>
                            </div>

                            {priceHistoryChartData.length > 1 && (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 shadow-sm h-64">
                                    <p className="text-[10px] font-bold text-gray-400 mb-4">Evolução do custo unitário</p>
                                    <ResponsiveContainer width="100%" height="85%">
                                        <LineChart data={priceHistoryChartData}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                            <XAxis 
                                                dataKey="date" 
                                                tick={{ fontSize: 9, fill: '#94a3b8' }} 
                                                axisLine={false} 
                                                tickLine={false}
                                                dy={10}
                                            />
                                            <YAxis 
                                                hide 
                                                domain={['auto', 'auto']}
                                            />
                                            <Tooltip 
                                                contentStyle={{ fontSize: '10px', borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}
                                                formatter={(value: number) => [formatCurrency(value), "Custo"]}
                                                labelStyle={{ fontWeight: 'bold', color: '#6366f1' }}
                                            />
                                            <Line 
                                                type="monotone" 
                                                dataKey="price" 
                                                stroke="#6366f1" 
                                                strokeWidth={3} 
                                                dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                                                activeDot={{ r: 6 }}
                                                animationDuration={1000}
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            )}

                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-bold text-gray-500 border-b tracking-tighter">
                                        <tr>
                                            <th className="px-4 py-3">Data do registro</th>
                                            <th className="px-4 py-3">Nº documento/nota fiscal</th>
                                            <th className="px-4 py-3 text-right">Custo unitário</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {(selectedItemForHistory.priceHistory || []).length > 0 ? (
                                            [...(selectedItemForHistory.priceHistory || [])].reverse().map((entry, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/40">
                                                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 font-medium">
                                                        {new Date(entry.date).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 font-bold text-gray-700 dark:text-gray-200">
                                                        {entry.invoiceNumber ? `Nota fiscal ${entry.invoiceNumber}` : 'Saldo inicial'}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-indigo-600">
                                                        {formatCurrency(entry.price)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-10 text-center text-gray-400 italic">
                                                    Nenhum histórico de movimentação registrado.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <button onClick={() => setIsPriceHistoryModalOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors">Fechar histórico</button>
                        </div>
                    </Modal>
                )}

                {isReservationModalOpen && selectedItemForReservation && (
                    <Modal title={`Detalhamento de reservas - ${selectedItemForReservation.name}`} onClose={() => setIsReservationModalOpen(false)} maxWidth="max-w-xl">
                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-amber-500 text-white rounded-lg"><UsersIcon className="w-5 h-5" /></div>
                                    <div>
                                        <p className="text-[10px] font-bold text-amber-500 leading-none mb-1">Reservas ativas</p>
                                        <p className="text-xl font-black text-amber-600 dark:text-amber-400">
                                            {selectedItemForReservation.reservedQuantity} {selectedItemForReservation.unit}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400">Saldo atual</p>
                                    <p className="text-lg font-bold text-gray-700 dark:text-gray-200">{selectedItemForReservation.quantity} {selectedItemForReservation.unit}</p>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] font-bold text-gray-500 border-b tracking-tighter">
                                        <tr>
                                            <th className="px-4 py-3">Cliente / projeto</th>
                                            <th className="px-4 py-3">Data evento</th>
                                            <th className="px-4 py-3 text-center">Reserva</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {activeReservations.length > 0 ? (
                                            activeReservations.map((res, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-900/20 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <p className="font-bold text-gray-800 dark:text-gray-100">{res.project}</p>
                                                        <p className="text-[9px] text-gray-400 font-medium tracking-tight">Resp: {res.responsible}</p>
                                                    </td>
                                                    <td className="px-4 py-3 text-gray-500 font-medium">
                                                        {new Date(res.date).toLocaleDateString('pt-BR')}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-black text-amber-600">
                                                        {res.qty} {selectedItemForReservation.unit}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${res.status === 'Efetivado' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                            {res.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-4 py-10 text-center text-gray-400 italic">
                                                    Nenhuma reserva encontrada nos check-ins ativos.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            <p className="text-[10px] text-gray-400 font-bold italic px-1">
                                * Reservas são baseadas em check-ins "Efetivados" ou "Abertos" que ainda não passaram pelo check-out (Instalação).
                            </p>

                            <button onClick={() => setIsReservationModalOpen(false)} className="w-full py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors">Fechar detalhamento</button>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    if (view === 'cadastro') {
        const canManageCatalog = isAdmin || String(currentUser.profileId) === 'vendedor-001';
        return (
            <div className="space-y-6 animate-fade-in">
                <header className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cadastrar produtos</h2>
                        <p className="text-xs text-gray-500 font-bold mt-1 tracking-wide">Gerenciamento de materiais e equipamentos</p>
                    </div>
                    {canManageCatalog && (
                        <button 
                            onClick={() => {
                                setStockItemToEdit(null);
                                setProductForm({ name: '', ncm: '', quantity: 0, minQuantity: 1, unit: 'un', description: '', image: '', averagePrice: 0, isFixedInBudget: true });
                                setIsProductModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                        >
                            <PlusIcon className="w-5 h-5" /> Novo produto
                        </button>
                    )}
                </header>

                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead className="bg-gray-50/50 dark:bg-gray-700/50 font-bold text-[10px] text-gray-400 border-b dark:border-gray-700">
                                <tr>
                                    <th className="px-6 py-4 w-20">Foto</th>
                                    <th className="px-6 py-4">Descrição do produto</th>
                                    <th className="px-6 py-4 text-center">Ncm</th>
                                    <th className="px-6 py-4 text-center">Und.</th>
                                    <th className="px-6 py-4 text-center">Saldo mínimo</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {items.map(item => (
                                    <tr key={item.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="w-12 h-12 rounded-xl border-2 border-gray-100 bg-white flex items-center justify-center overflow-hidden shadow-sm">
                                                {item.image ? (
                                                    <img src={item.image} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <PhotographIcon className="w-6 h-6 text-gray-200" />
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-3">
                                            <p className="font-bold text-[13px] text-gray-800 dark:text-white leading-tight">{item.name}</p>
                                            <p className="text-[10px] text-gray-400 font-medium mt-0.5 line-clamp-1">{item.description || 'Sem descrição detalhada'}</p>
                                        </td>
                                        <td className="px-6 py-3 text-center text-[11px] font-bold text-gray-500">{item.ncm || '---'}</td>
                                        <td className="px-6 py-3 text-center text-[11px] font-bold text-gray-500">{item.unit}</td>
                                        <td className="px-6 py-3 text-center text-[13px] font-black text-orange-600">{item.minQuantity}</td>
                                        <td className="px-6 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                {canManageCatalog && (
                                                    <>
                                                        <button 
                                                            onClick={() => {
                                                                setStockItemToEdit(item);
                                                                setProductForm({ 
                                                                    name: item.name, 
                                                                    ncm: item.ncm || '', 
                                                                    quantity: item.quantity || 0,
                                                                    minQuantity: item.minQuantity, 
                                                                    unit: item.unit, 
                                                                    description: item.description || '', 
                                                                    image: item.image || '',
                                                                    averagePrice: item.averagePrice || 0,
                                                                    isFixedInBudget: !!item.isFixedInBudget
                                                                });
                                                                setIsProductModalOpen(true);
                                                            }}
                                                            className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                                        >
                                                            <EditIcon className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteProduct(item.id)}
                                                            className="p-2 text-gray-300 hover:text-red-500 transition-colors"
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {isProductModalOpen && canManageCatalog && (
                    <Modal 
                        title={productToEdit ? "Editar produto" : "Cadastrar novo produto"} 
                        onClose={() => setIsProductModalOpen(false)}
                        maxWidth="max-w-3xl"
                    >
                        <form onSubmit={handleSaveProduct} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                <div className="md:col-span-4 flex flex-col items-center">
                                    <FormLabel>Foto do produto</FormLabel>
                                    <div className="relative group w-full aspect-square mt-2">
                                        <div className="w-full h-full rounded-3xl border-4 border-dashed border-gray-100 bg-gray-50 flex items-center justify-center overflow-hidden">
                                            {productForm.image ? (
                                                <img src={productForm.image} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <PhotographIcon className="w-20 h-20 text-gray-200" />
                                            )}
                                        </div>
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-all cursor-pointer rounded-3xl opacity-0 group-hover:opacity-100">
                                            <div className="p-3 bg-white rounded-full shadow-lg text-indigo-600">
                                                <UploadIcon className="w-6 h-6" />
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleProductPhotoUpload} />
                                        </label>
                                    </div>
                                    {productForm.image && (
                                        <button 
                                            type="button" 
                                            onClick={() => setProductForm(p => ({ ...p, image: '' }))}
                                            className="mt-3 text-[10px] font-black text-red-500 tracking-tight"
                                        >
                                            Remover foto
                                        </button>
                                    )}
                                </div>

                                <div className="md:col-span-8 space-y-4">
                                    <div>
                                        <label className={labelSentenceClass}>Descrição do produto (Nome comercial)</label>
                                        <input 
                                            required 
                                            type="text" 
                                            value={productForm.name} 
                                            onChange={e => setProductForm({...productForm, name: e.target.value})} 
                                            className={editableFieldClass} 
                                            placeholder="Ex: Disjuntor bipolar 20a curva c - schneider" 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelSentenceClass}>Ncm (Classificação fiscal)</label>
                                            <input 
                                                type="text" 
                                                value={productForm.ncm} 
                                                onChange={e => setProductForm({...productForm, ncm: e.target.value})} 
                                                className={editableFieldClass} 
                                                placeholder="Ex: 8536.20.00" 
                                            />
                                        </div>
                                        <div>
                                            <label className={labelSentenceClass}>Unidade de medida</label>
                                            <select 
                                                value={productForm.unit} 
                                                onChange={e => setProductForm({...productForm, unit: e.target.value})} 
                                                className={editableFieldClass}
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelSentenceClass}>Saldo inicial</label>
                                            <input 
                                                required 
                                                type="number" 
                                                min="0"
                                                value={productForm.quantity} 
                                                onChange={e => setProductForm({...productForm, quantity: parseInt(e.target.value) || 0})} 
                                                className={editableFieldClass + " text-indigo-600"} 
                                            />
                                        </div>
                                        <div>
                                            <label className={labelSentenceClass}>Saldo mínimo (Alerta)</label>
                                            <input 
                                                required 
                                                type="number" 
                                                min="0"
                                                value={productForm.minQuantity} 
                                                onChange={e => setProductForm({...productForm, minQuantity: parseInt(e.target.value) || 0})} 
                                                className={editableFieldClass + " text-orange-600"} 
                                            />
                                        </div>
                                        <div>
                                            <label className={labelSentenceClass}>Custo Inicial</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={productForm.averagePrice || ''} 
                                                onChange={e => setProductForm({...productForm, averagePrice: parseFloat(e.target.value) || 0})} 
                                                className={editableFieldClass + " text-green-600"} 
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/40 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900 cursor-pointer hover:bg-white transition-all">
                                        <input 
                                            type="checkbox" 
                                            checked={productForm.isFixedInBudget} 
                                            onChange={e => setProductForm({...productForm, isFixedInBudget: e.target.checked})} 
                                            className="w-5 h-5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500" 
                                        />
                                        <div>
                                            <p className="text-[11px] font-black text-gray-700 dark:text-white tracking-tight">Exibir fixo no orçamento</p>
                                            <p className="text-[10px] text-gray-400 font-medium leading-none">Este item aparecerá automaticamente na tabela de orçamentos.</p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className={labelSentenceClass}>Observações / especificações técnicas</label>
                                <textarea 
                                    rows={3} 
                                    value={productForm.description} 
                                    onChange={e => setProductForm({...productForm, description: e.target.value})} 
                                    className={editableFieldClass + " resize-none font-medium text-xs"} 
                                    placeholder="Detalhes sobre fabricante, série, aplicações recomendadas, etc." 
                                />
                            </div>

                            <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                                <button 
                                    type="button" 
                                    onClick={() => setIsProductModalOpen(false)} 
                                    className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-all"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="flex-[2] py-4 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]"
                                >
                                    {isSaving ? 'Salvando...' : (productToEdit ? 'Atualizar produto' : 'Salvar novo produto')}
                                </button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
        );
    }

    if (view === 'compras') return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pedidos de compra</h2><p className="text-xs text-gray-400 font-bold mt-1">Gestão detalhada de suprimentos</p></div>
                <button onClick={() => { 
                    setRequestToEdit(null); 
                    setIsManualItem(false);
                    setRequestForm({ 
                        itemName: '', quantity: 1, unit: 'un', priority: 'Média', clientName: '', observation: '', purchaseLink: '', purchaseType: 'Reposição',
                        requestDate: new Date().toISOString().split('T')[0]
                    }); 
                    setIsRequestModalOpen(true); 
                }} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"><PlusIcon className="w-5 h-5" /> Abrir novo pedido</button>
            </header>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-3"><FilterIcon className="w-4 h-4 text-gray-400" /><span className="text-xs font-bold text-gray-500">Filtrar status:</span></div>
                <div className="flex gap-2 flex-wrap">
                    {(['Todos', 'Aberto', 'Aprovado', 'Comprado', 'Em trânsito', 'Concluído', 'Cancelado'] as const).map(f => (
                        <button key={f} onClick={() => setPurchaseStatusFilter(f)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${purchaseStatusFilter === f ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}>{f}</button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-400 border-b">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Item solicitado</th>
                            <th className="px-6 py-4 text-center">Volume</th>
                            <th className="px-6 py-4 text-center">Status atual</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredRequests.map(req => {
                            const status = getStatusInfo(req.status);
                            const StatusIcon = status.icon;
                            return (
                                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(req.date).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-6 py-4"><div className="font-bold text-gray-900 dark:text-white text-xs">{req.itemName}</div><div className="text-[10px] text-gray-400 font-medium">Solicitante: {req.requester}</div></td>
                                    <td className="px-6 py-4 text-center font-bold text-indigo-600 text-xs">{req.quantity} {req.unit}</td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black tracking-tight ${status.color}`}>
                                            <StatusIcon className="w-3.5 h-3.5" />
                                            {status.label}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handleManageRequest(req)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Gerenciar pedido"><ClipboardListIcon className="w-5 h-5"/></button>
                                            
                                            {req.status === 'Aberto' && isAdmin && (
                                                <button onClick={() => triggerStatusConfirmation(req, 'Aprovado')} className="p-1.5 text-blue-500 hover:text-blue-600 transition-colors" title="Aprovar compra">
                                                    <CheckCircleIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                            {req.status === 'Aprovado' && isAdmin && (
                                                <button onClick={() => triggerStatusConfirmation(req, 'Comprado')} className="p-1.5 text-indigo-500 hover:text-indigo-600 transition-colors" title="Marcar como comprado">
                                                    <ShoppingCartIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                            {req.status === 'Comprado' && isAdmin && (
                                                <button onClick={() => triggerStatusConfirmation(req, 'Em trânsito')} className="p-1.5 text-purple-500 hover:text-purple-600 transition-colors" title="Marcar em trânsito">
                                                    <TruckIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                            {req.status === 'Em trânsito' && isAdmin && (
                                                <button onClick={() => { setRequestToEdit(req); setIsNFModalOpen(true); setNfForm({ invoiceNumber: '', invoiceKey: '', totalValue: 0, invoiceFile: '', invoiceFileName: '' }); }} className="p-1.5 text-green-500 hover:text-green-600 transition-colors" title="Efetivar entrega (Lançar NF)">
                                                    <UploadIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {isRequestModalOpen && (
                <Modal title={requestToEdit ? "Gerenciar pedido de compra" : "Novo pedido de compra"} onClose={() => { setIsRequestModalOpen(false); setRequestToEdit(null); }} maxWidth="max-w-2xl">
                    <form onSubmit={handleSaveRequest} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className={labelSentenceClass}>Tipo de solicitação</label>
                                <div className="grid grid-cols-2 gap-1.5 p-1 bg-gray-100 dark:bg-gray-700/50 rounded-xl border-2 dark:border-gray-600">
                                    <button 
                                        type="button" 
                                        disabled={!!requestToEdit}
                                        onClick={() => {
                                            setRequestForm({...requestForm, purchaseType: 'Reposição'});
                                            setIsManualItem(false);
                                        }} 
                                        className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${requestForm.purchaseType === 'Reposição' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-200' : 'text-gray-400'} ${requestToEdit ? 'cursor-not-allowed opacity-80' : ''}`}
                                    >
                                        <CubeIcon className="w-3.5 h-3.5" /> Reposição
                                    </button>
                                    <button 
                                        type="button" 
                                        disabled={!!requestToEdit}
                                        onClick={() => setRequestForm({...requestForm, purchaseType: 'Obra'})} 
                                        className={`flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold rounded-lg transition-all ${requestForm.purchaseType === 'Obra' ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-sm border border-gray-200' : 'text-gray-400'} ${requestToEdit ? 'cursor-not-allowed opacity-80' : ''}`}
                                    >
                                        <TruckIcon className="w-3.5 h-3.5" /> Compra obra
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className={labelSentenceClass}>Data da solicitação</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="date" disabled={!!requestToEdit} value={requestForm.requestDate} onChange={e => setRequestForm({...requestForm, requestDate: e.target.value})} className={editableFieldClass + " pl-10 py-1.5 disabled:opacity-60 disabled:bg-gray-50"} />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-700/30 rounded-2xl border-2 border-indigo-100 dark:border-gray-600">
                            {(!requestToEdit && requestForm.purchaseType === 'Obra') ? (
                                <div className="flex bg-gray-100 dark:bg-gray-600/30 p-1 rounded-xl border border-gray-200 dark:border-gray-500 mb-2">
                                    <button type="button" onClick={() => setIsManualItem(false)} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${!isManualItem ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
                                        Catálogo orner
                                    </button>
                                    <button type="button" onClick={() => setIsManualItem(true)} className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${isManualItem ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>
                                        Avulso
                                    </button>
                                </div>
                            ) : (
                                <div className="mb-2 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-indigo-600 tracking-tight px-1">
                                        {isManualItem ? 'Item avulso (Fora do estoque)' : 'Catálogo orner'}
                                    </span>
                                    {requestToEdit && (
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getStatusInfo(requestToEdit.status).color}`}>
                                            Status: {getStatusInfo(requestToEdit.status).label}
                                        </span>
                                    )}
                                </div>
                            )}
                            
                            <div className="space-y-3">
                                <div className="animate-fade-in">
                                    <label className={labelSentenceClass}>{isManualItem ? 'Descrição do item' : 'Selecionar do catálogo'}</label>
                                    {isManualItem ? (
                                        <input required disabled={!!requestToEdit} autoFocus placeholder="Nome do componente ou material..." value={requestForm.itemName} onChange={e => setRequestForm({...requestForm, itemName: e.target.value})} className={editableFieldClass + " py-2 disabled:opacity-60 disabled:bg-gray-50"} />
                                    ) : (
                                        <select required disabled={!!requestToEdit} value={requestForm.itemName} onChange={e => { const p = items.find(i => i.name === e.target.value); setRequestForm({...requestForm, itemName: e.target.value, unit: p?.unit || 'un'}); }} className={editableFieldClass + " py-2 disabled:opacity-60 disabled:bg-gray-50"}>
                                            <option value="">Escolher material cadastrado...</option>
                                            {items.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelSentenceClass}>Quantidade solicitada</label>
                                        <div className="flex gap-2">
                                            <input type="number" disabled={!!requestToEdit} required min="1" value={requestForm.quantity} onChange={e => setRequestForm({...requestForm, quantity: parseFloat(e.target.value) || 0})} className={editableFieldClass + " text-center flex-1 py-1.5 disabled:opacity-60 disabled:bg-gray-50"} />
                                            <select 
                                                disabled={!!requestToEdit || !isManualItem} 
                                                required 
                                                value={requestForm.unit} 
                                                onChange={e => setRequestForm({...requestForm, unit: e.target.value})} 
                                                className="w-20 rounded-lg border-2 border-indigo-400 bg-white p-1.5 text-xs font-bold text-center outline-none shadow-sm disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelSentenceClass}>Prioridade / urgência</label>
                                        <div className="flex gap-1.5 h-[38px]">
                                            {(['Baixa', 'Média', 'Alta'] as const).map(p => (
                                                <button key={p} type="button" disabled={!!requestToEdit} onClick={() => setRequestForm({...requestForm, priority: p})} className={`flex-1 py-1 text-[10px] font-black rounded-lg border-2 transition-all ${requestForm.priority === p ? (p === 'Alta' ? 'bg-red-600 border-red-600 text-white shadow-md' : p === 'Média' ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-green-600 border-green-600 text-white shadow-md') : 'bg-white dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-600 hover:border-indigo-400'} ${requestToEdit ? 'cursor-not-allowed' : ''}`}>
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {requestForm.purchaseType === 'Obra' && (
                                <div className="animate-fade-in">
                                    <label className={labelSentenceClass}>Identificação da obra / cliente</label>
                                    <input 
                                        required 
                                        disabled={!!requestToEdit}
                                        type="text" 
                                        list="approved-clients-list"
                                        placeholder="Digite o nome ou escolha um cliente aprovado..." 
                                        value={requestForm.clientName} 
                                        onChange={e => setRequestForm({...requestForm, clientName: e.target.value})} 
                                        className={editableFieldClass + " py-2 disabled:opacity-60 disabled:bg-gray-50"} 
                                    />
                                    <datalist id="approved-clients-list">
                                        {approvedClients.map(client => (
                                            <option key={client} value={client} />
                                        ))}
                                    </datalist>
                                </div>
                            )}

                            <div>
                                <label className={labelSentenceClass}>Link de compra / referência (opcional)</label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="url" disabled={!!requestToEdit} placeholder="Cole o link do produto aqui..." value={requestForm.purchaseLink} onChange={e => setRequestForm({...requestForm, purchaseLink: e.target.value})} className={editableFieldClass + " pl-10 py-2 text-indigo-600 font-medium disabled:opacity-60 disabled:bg-gray-50"} />
                                </div>
                            </div>

                            <div>
                                <label className={labelSentenceClass}>Observações adicionais</label>
                                <textarea rows={2} disabled={!!requestToEdit} placeholder="Detalhes como marca, cor, urgência ou motivo..." value={requestForm.observation} onChange={e => setRequestForm({...requestForm, observation: e.target.value})} className={editableFieldClass + " min-h-[60px] h-auto resize-none font-medium leading-tight py-2 disabled:opacity-60 disabled:bg-gray-50"} />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                            {requestToEdit ? (
                                <>
                                    {requestToEdit.status === 'Aberto' ? (
                                        <>
                                            {isAdmin && <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Cancelado')} className="flex-1 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-colors">Cancelar pedido</button>}
                                            {isAdmin && (
                                                <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Aprovado')} className="flex-[2] py-3 bg-blue-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                                                    <CheckCircleIcon className="w-4 h-4" /> Aprovar pedido
                                                </button>
                                            )}
                                        </>
                                    ) : requestToEdit.status === 'Aprovado' ? (
                                        isAdmin && (
                                            <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Comprado')} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                                                <ShoppingCartIcon className="w-4 h-4" /> Registrar compra realizada
                                            </button>
                                        )
                                    ) : requestToEdit.status === 'Comprado' ? (
                                        isAdmin && (
                                            <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Em trânsito')} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-2">
                                                <TruckIcon className="w-4 h-4" /> Marcar em trânsito / enviado
                                            </button>
                                        )
                                    ) : requestToEdit.status === 'Em trânsito' ? (
                                        isAdmin && (
                                            <button type="button" onClick={() => { setIsRequestModalOpen(false); setIsNFModalOpen(true); setNfForm({ invoiceNumber: '', invoiceKey: '', totalValue: 0, invoiceFile: '', invoiceFileName: '' }); }} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                                                <UploadIcon className="w-4 h-4" /> Efetivar entrega (Lançar nota fiscal)
                                            </button>
                                        )
                                    ) : (
                                        <button type="button" onClick={() => { setIsRequestModalOpen(false); setRequestToEdit(null); }} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">Fechar</button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => setIsRequestModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">Cancelar</button>
                                    <button type="submit" disabled={isSaving} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-[0.98]">
                                        {isSaving ? 'Gravando...' : 'Finalizar solicitação'}
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                </Modal>
            )}

            {isNFModalOpen && requestToEdit && (
                <Modal title="Efetivar compra - nota fiscal" onClose={() => { setIsNFModalOpen(false); setRequestToEdit(null); }} maxWidth="max-w-lg">
                    <form onSubmit={handleConfirmFinalization} className="space-y-6">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <p className="text-[11px] font-bold text-indigo-600 mb-2">Item recebido</p>
                            <p className="font-bold text-gray-900 dark:text-white">{requestToEdit.itemName} - {requestToEdit.quantity} {requestToEdit.unit}</p>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className={labelSentenceClass}>Número da nota fiscal (nf-e)</label>
                                <input required type="text" placeholder="000.000.000" value={nfForm.invoiceNumber} onChange={e => setNfForm({...nfForm, invoiceNumber: e.target.value})} className={editableFieldClass} />
                            </div>
                            <div>
                                <label className={labelSentenceClass}>Chave de acesso da nota fiscal (44 dígitos)</label>
                                <input type="text" placeholder="0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000" maxLength={44} value={nfForm.invoiceKey} onChange={e => setNfForm({...nfForm, invoiceKey: e.target.value.replace(/\D/g, '')})} className={editableFieldClass.replace('font-bold', 'font-mono')} />
                            </div>
                            <div>
                                <label className={labelSentenceClass}>Valor total dos itens (R$)</label>
                                <input required type="number" step="0.01" placeholder="0,00" value={nfForm.totalValue || ''} onChange={e => setNfForm({...nfForm, totalValue: parseFloat(e.target.value) || 0})} className={editableFieldClass.replace('text-gray-800', 'text-indigo-600')} />
                            </div>
                            <div>
                                <label className={labelSentenceClass}>Anexar arquivo da nota fiscal</label>
                                <div className="flex items-center justify-center w-full">
                                    <label className={`flex flex-col items-center justify-center w-full min-h-[120px] border-4 border-dashed rounded-2xl cursor-pointer transition-colors ${nfForm.invoiceFile ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-indigo-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50'}`}>
                                        <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                                            {nfForm.invoiceFile ? (
                                                <>
                                                    <CheckCircleIcon className="w-10 h-10 text-green-500 mb-2" />
                                                    <p className="text-sm text-green-700 dark:text-green-400 font-bold truncate max-w-full">Arquivo carregado: {nfForm.invoiceFileName}</p>
                                                    <p className="text-[10px] text-green-600 dark:text-green-500 font-medium mt-1">Clique para substituir</p>
                                                </>
                                            ) : (
                                                <>
                                                    <UploadIcon className="w-10 h-10 text-indigo-400 mb-2" />
                                                    <p className="text-sm text-gray-500 dark:text-gray-400 font-bold">Clique para selecionar ou arraste o pdf/imagem</p>
                                                </>
                                            )}
                                        </div>
                                        <input type="file" className="hidden" onChange={handleNFFileUpload} accept=".pdf,image/*" />
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button type="button" onClick={() => { setIsNFModalOpen(false); setRequestToEdit(null); }} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold text-sm">Cancelar</button>
                            <button type="submit" disabled={isSaving || !nfForm.invoiceNumber} className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-green-700 transition-all active:scale-95 disabled:opacity-50">{isSaving ? 'Gravando...' : 'Confirmar e finalizar'}</button>
                        </div>
                    </form>
                </Modal>
            )}

            {isConfirmStatusModalOpen && (
                <Modal title="Confirmar ação" onClose={() => { setIsConfirmStatusModalOpen(false); setConfirmRequest(null); setNextStatus(null); }} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-50 text-indigo-600">
                            <ExclamationTriangleIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Deseja efetivar essa ação?</h3>
                        <div className="flex gap-4">
                            <button onClick={() => { setIsConfirmStatusModalOpen(false); setConfirmRequest(null); setNextStatus(null); }} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-sm">Não</button>
                            <button onClick={handleUpdateStatus} disabled={isSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20">{isSaving ? '...' : 'Sim'}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default EstoquePage;
