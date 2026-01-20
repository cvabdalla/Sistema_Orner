
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

const UNITS = ["un", "mt", "kg", "cx", "par", "kit", "pç", "m²", "lt"];
const ADMIN_PROFILE_ID = '001';

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

    const [historyItemId, setHistoryItemId] = useState<string>('Todos');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [showHistorySuggestions, setShowHistorySuggestions] = useState(false);
    const historySuggestionRef = useRef<HTMLDivElement>(null);

    const [historyStart, setHistoryStart] = useState<string>('');
    const [historyEnd, setHistoryEnd] = useState<string>('');

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<PurchaseRequest | null>(null);
    const [isManualItem, setIsManualItem] = useState(false);

    const [isConfirmStatusModalOpen, setIsConfirmStatusModalOpen] = useState(false);
    const [confirmRequest, setConfirmRequest] = useState<PurchaseRequest | null>(null);
    const [nextStatus, setNextStatus] = useState<PurchaseRequestStatus | null>(null);

    const [isPriceHistoryModalOpen, setIsPriceHistoryModalOpen] = useState(false);
    const [selectedItemForHistory, setSelectedItemForHistory] = useState<StockItem | null>(null);

    const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
    const [selectedItemForReservation, setSelectedItemForReservation] = useState<StockItem | null>(null);

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

    const isAdmin = useMemo(() => 
        String(currentUser.profileId) === ADMIN_PROFILE_ID || 
        userPermissions.includes('ALL') ||
        currentUser.email.toLowerCase().includes('homologacao')
    , [currentUser, userPermissions]);

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
        } catch (e) { alert("Erro ao atualizar status"); }
        finally { setIsSaving(false); }
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
                setNfForm(prev => ({ ...prev, invoiceFile: base64, invoiceFileName: file.name }));
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
                const historyEntry: PriceHistoryEntry = { date: new Date().toISOString(), price: newUnitCost, invoiceNumber: nfForm.invoiceNumber };
                const updatedPriceHistory = [...(stockItem.priceHistory || []), historyEntry];
                await dataService.save('stock_items', { ...stockItem, quantity: newQtyTotal, averagePrice: Math.round(weightedAveragePrice * 100) / 100, priceHistory: updatedPriceHistory });
                await dataService.save('stock_movements', { id: `mov-${Date.now()}`, owner_id: currentUser.id, itemId: String(stockItem.id), quantity: request.quantity, type: 'entrada', date: new Date().toISOString(), observation: `Entrada via nf ${nfForm.invoiceNumber}` });
            }
            await dataService.save('purchase_requests', { ...request, status: 'Concluído', invoiceFile: nfForm.invoiceFile || undefined, invoiceKey: nfForm.invoiceKey || undefined, observation: `${request.observation || ''}\n[Efetivado: nf ${nfForm.invoiceNumber}]`.trim() });
            setIsNFModalOpen(false);
            setRequestToEdit(null);
            await loadData();
            alert("Compra efetivada com sucesso!");
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
                priceHistory: productToEdit ? productToEdit.priceHistory : (Number(productForm.quantity) > 0 ? [{ date: new Date().toISOString(), price: productForm.averagePrice }] : [])
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
            reader.onload = (event) => { setProductForm(prev => ({ ...prev, image: event.target?.result as string })); };
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
        if (item === 'Todos') { setHistoryItemId('Todos'); setHistorySearchTerm(''); } 
        else { setHistoryItemId(String(item.id)); setHistorySearchTerm(item.name); }
        setShowHistorySuggestions(false);
    };

    const editableFieldClass = "w-full rounded-lg border-2 border-indigo-400 dark:border-indigo-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-[13px] font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-600 transition-all shadow-sm block";
    const labelSentenceClass = "block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-0.5 ml-0.5";

    const handleManageRequest = (req: PurchaseRequest) => {
        setRequestToEdit(req);
        setRequestForm({ itemName: req.itemName, quantity: req.quantity, unit: req.unit, priority: req.priority, clientName: req.clientName || '', observation: req.observation || '', purchaseLink: req.purchaseLink || '', purchaseType: req.purchaseType || 'Reposição', requestDate: req.date });
        const inCatalog = items.some(i => i.name === req.itemName);
        setIsManualItem(!inCatalog);
        setIsRequestModalOpen(true);
    };

    const handleShowPriceHistory = (item: StockItem) => { setSelectedItemForHistory(item); setIsPriceHistoryModalOpen(true); };

    const handleShowReservations = (e: React.MouseEvent, item: StockItem) => { e.stopPropagation(); if ((item.reservedQuantity || 0) <= 0) return; setSelectedItemForReservation(item); setIsReservationModalOpen(true); };

    const priceHistoryChartData = useMemo(() => { if (!selectedItemForHistory?.priceHistory) return []; return [...selectedItemForHistory.priceHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(entry => ({ date: new Date(entry.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }), price: entry.price })); }, [selectedItemForHistory]);

    const activeReservations = useMemo(() => { if (!selectedItemForReservation) return []; const itemId = String(selectedItemForReservation.id); return checkins.filter(c => (c.status === 'Efetivado' || c.status === 'Aberto') && c.details.componentesEstoque?.some((comp: any) => String(comp.itemId) === itemId)).map(c => { const comp = c.details.componentesEstoque.find((comp: any) => String(comp.itemId) === itemId); return { project: c.project, date: c.date, qty: comp?.qty || 0, status: c.status, responsible: c.responsible }; }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); }, [selectedItemForReservation, checkins]);

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
                                <tr><th className="px-4 py-4">Foto</th><th className="px-4 py-4">Descrição</th><th className="px-4 py-4 text-right">Custo unitário</th><th className="px-4 py-4 text-center">Saldo</th><th className="px-4 py-4 text-center">Saldo mínimo</th><th className="px-4 py-4 text-center">Reservado</th><th className="px-4 py-4 text-center">Saldo futuro</th><th className="px-4 py-4 text-center">Status</th></tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {items.map(item => {
                                    const isLowStock = item.quantity <= item.minQuantity;
                                    const hasReservations = (item.reservedQuantity || 0) > 0;
                                    return (
                                        <tr key={item.id} className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer group ${isLowStock ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`} onClick={() => handleShowPriceHistory(item)}>
                                            <td className="px-4 py-3"><div className="w-10 h-10 rounded-lg border bg-white dark:bg-gray-900 flex items-center justify-center overflow-hidden">{item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <PhotographIcon className="w-5 h-5 text-gray-300" />}</div></td>
                                            <td className="px-4 py-3"><p className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">{item.name}</p><p className="text-[9px] text-gray-400 font-medium">Clique para ver histórico de custos</p></td>
                                            <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatCurrency(item.averagePrice || 0)}</td>
                                            <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white">{item.quantity}</td>
                                            <td className="px-4 py-3 text-center font-black text-orange-600">{item.minQuantity}</td>
                                            <td className={`px-4 py-3 text-center font-bold ${hasReservations ? 'text-amber-600 underline decoration-dotted hover:text-amber-700' : 'text-gray-400'}`} onClick={(e) => handleShowReservations(e, item)}>{item.reservedQuantity || 0}</td>
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
                            <div className="flex-1 w-full relative" ref={historySuggestionRef}><label className="block text-[11px] font-bold text-gray-400 mb-1.5 ml-1">Filtrar componente</label><div className="relative"><input type="text" autoComplete="off" placeholder="Digite para buscar componente..." value={historySearchTerm} onFocus={() => setShowHistorySuggestions(true)} onChange={(e) => { setHistorySearchTerm(e.target.value); setShowHistorySuggestions(true); if (e.target.value === '') setHistoryItemId('Todos'); }} className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl px-4 pr-10 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 shadow-sm" /><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40"><SearchIcon className="w-4 h-4" /></div></div>{showHistorySuggestions && (<div className="absolute top-full left-0 z-50 w-full bg-white dark:bg-gray-800 mt-1 rounded-xl shadow-2xl border border-indigo-50 dark:border-gray-700 py-2 max-h-52 overflow-y-auto custom-scrollbar animate-fade-in"><button type="button" onClick={() => handleSelectHistoryItem('Todos')} className="w-full flex items-center px-4 py-2 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-xs font-bold text-gray-700 dark:text-gray-200">Todos os componentes</button><div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>{filteredItemsForHistory.map(item => (<button key={item.id} type="button" onClick={() => handleSelectHistoryItem(item)} className="w-full flex items-center px-4 py-2.5 text-left hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all border-l-2 border-transparent hover:border-indigo-600"><div className="flex-1"><p className="text-[11px] font-bold text-gray-800 dark:text-white">{item.name}</p><p className="text-[9px] text-gray-400 font-medium">Saldo: {item.quantity} {item.unit}</p></div></button>))}{filteredItemsForHistory.length === 0 && (<p className="px-4 py-3 text-[10px] text-gray-400 italic text-center">Nenhum componente encontrado.</p>)}</div>)}</div>
                            <div className="w-full md:w-44"><label className="block text-[11px] font-bold text-gray-400 mb-1.5 ml-1">De (Data)</label><div className="relative"><CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="date" value={historyStart} onChange={(e) => setHistoryStart(e.target.value)} className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl pl-10 pr-4 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20" /></div></div>
                            <div className="w-full md:w-44"><label className="block text-[11px] font-bold text-gray-400 mb-1.5 ml-1">Até (Data)</label><div className="relative"><CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="date" value={historyEnd} onChange={(e) => setHistoryEnd(e.target.value)} className="w-full h-11 bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-700 rounded-xl pl-10 pr-4 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20" /></div></div>
                            {(historyItemId !== 'Todos' || historySearchTerm || historyStart || historyEnd) && (<button onClick={() => { setHistoryItemId('Todos'); setHistorySearchTerm(''); setHistoryStart(''); setHistoryEnd(''); }} className="h-11 px-4 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-100">Limpar</button>)}
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-400 border-b">
                                    <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Cliente / Obra</th><th className="px-6 py-4">Origem / Caminho</th><th className="px-6 py-4">Tipo</th><th className="px-6 py-4">Produto</th><th className="px-6 py-4 text-center">Quantidade</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">{filteredMovements.map(mov => (<tr key={mov.id}><td className="px-6 py-4 text-xs font-bold text-gray-500">{new Date(mov.date).toLocaleString('pt-BR')}</td><td className="px-6 py-4 text-xs font-bold text-gray-800 dark:text-gray-200">{mov.projectName || '---'}</td><td className="px-6 py-4"><span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{mov.observation || '---'}</span></td><td className="px-6 py-4">{mov.type === 'entrada' ? <span className="text-green-600 font-black text-[10px] bg-green-50 px-2 py-0.5 rounded">Entrada</span> : <span className="text-red-600 font-black text-[10px] bg-red-50 px-2 py-0.5 rounded">Saída</span>}</td><td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200">{items.find(i => String(i.id) === String(mov.itemId))?.name || '---'}</td><td className={`px-6 py-4 text-center font-black ${mov.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{mov.type === 'entrada' ? '+' : '-'}{mov.quantity}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        );
    }
    // ... resto do componente EstoquePage ...
    return <div>...</div>;
};

export default EstoquePage;
