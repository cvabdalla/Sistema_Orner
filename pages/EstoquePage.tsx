
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    CubeIcon, TrashIcon, PlusIcon, 
    ExclamationTriangleIcon, DollarIcon, EditIcon, PhotographIcon, XCircleIcon,
    ArrowUpIcon, ArrowDownIcon, FilterIcon, CalendarIcon, ClipboardListIcon, ShoppingCartIcon, LinkIcon,
    EyeIcon, CheckCircleIcon, TableIcon, UploadIcon, DocumentReportIcon, ChartPieIcon
} from '../assets/icons';
import type { StockItem, EstoquePageProps, PurchaseRequest, StockMovement, ChecklistEntry, PriceHistoryEntry } from '../types';
import { dataService } from '../services/dataService';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const UNITS = ["un", "mt", "kg", "cx", "par", "kit", "pç", "m²", "lt"];
const ADMIN_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

const EstoquePage: React.FC<EstoquePageProps> = ({ view, setCurrentPage, currentUser }) => {
    const [items, setItems] = useState<StockItem[]>([]);
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [checkins, setCheckins] = useState<ChecklistEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'inventario' | 'historico'>('inventario');
    const [movementFilter, setMovementFilter] = useState<'todos' | 'entrada' | 'saida'>('todos');
    const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'Todos' | PurchaseRequest['status']>('Todos');

    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productToEdit, setProductToEdit] = useState<StockItem | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const nfFileInputRef = useRef<HTMLInputElement>(null);

    const [productForm, setProductForm] = useState({
        name: '',        
        unit: 'un',      
        quantity: 0,     
        minQuantity: 5,  
        ncm: '',
        averagePrice: 0,
        image: '',
        isFixedInBudget: false
    });

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<PurchaseRequest | null>(null);
    const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
    const [isManualItem, setIsManualItem] = useState(false);

    const [isCancelConfirmModalOpen, setIsCancelConfirmModalOpen] = useState(false);
    const [requestBeingCancelled, setRequestBeingCancelled] = useState<PurchaseRequest | null>(null);
    const [isApproveConfirmModalOpen, setIsApproveConfirmModalOpen] = useState(false);
    const [requestBeingApproved, setRequestBeingApproved] = useState<PurchaseRequest | null>(null);
    
    const [isNFModalOpen, setIsNFModalOpen] = useState(false);
    const [nfForm, setNfForm] = useState({
        invoiceNumber: '',
        invoiceKey: '',
        totalValue: 0,
        invoiceFile: ''
    });

    const [requestForm, setRequestForm] = useState({
        itemName: '',
        quantity: 1,
        unit: 'un',
        priority: 'Média' as 'Baixa' | 'Média' | 'Alta',
        clientName: '',
        observation: '',
        purchaseLink: ''
    });

    const [selectedReservationItem, setSelectedReservationItem] = useState<StockItem | null>(null);
    const [selectedHistoryItem, setSelectedHistoryItem] = useState<StockItem | null>(null);

    const isAdmin = useMemo(() => currentUser.profileId === ADMIN_PROFILE_ID, [currentUser]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const isUserAdmin = currentUser.profileId === ADMIN_PROFILE_ID;
            const loadedItems = await dataService.getAll<StockItem>('stock_items', currentUser.id, isUserAdmin);
            setItems(loadedItems.sort((a,b) => (a.name || '').localeCompare(b.name || '')));

            const loadedMovements = await dataService.getAll<StockMovement>('stock_movements', currentUser.id, isUserAdmin);
            setMovements(loadedMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));

            const loadedCheckins = await dataService.getAll<ChecklistEntry>('checklist_checkin', currentUser.id, isUserAdmin);
            setCheckins(loadedCheckins);

            if (view === 'compras') {
                const loadedRequests = await dataService.getAll<PurchaseRequest>('purchase_requests', currentUser.id, isUserAdmin);
                setRequests(loadedRequests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            }
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [currentUser, view]);

    const reservationsForItem = useMemo(() => {
        if (!selectedReservationItem) return [];
        
        return checkins
            .filter(c => c.status === 'Efetivado')
            .map(c => {
                const component = c.details.componentesEstoque?.find(
                    (comp: any) => String(comp.itemId) === String(selectedReservationItem.id)
                );
                if (component) {
                    return {
                        id: c.id,
                        clientName: c.project || c.details.nomeTitular || 'Cliente não identificado',
                        quantity: component.qty,
                        date: c.date
                    };
                }
                return null;
            })
            .filter((r): r is { id: string, clientName: string, quantity: number, date: string } => r !== null);
    }, [checkins, selectedReservationItem]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setProductForm(prev => ({ ...prev, image: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleNFFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setNfForm(prev => ({ ...prev, invoiceFile: reader.result as string }));
            reader.readAsDataURL(file);
        }
    };

    const handleOpenProductForm = (item?: StockItem) => {
        if (item) {
            setProductToEdit(item);
            setProductForm({
                name: item.name || '',
                unit: item.unit || 'un',
                quantity: item.quantity || 0,
                minQuantity: item.minQuantity || 5,
                ncm: item.ncm || '',
                averagePrice: item.averagePrice || 0,
                image: item.image || '',
                isFixedInBudget: !!item.isFixedInBudget
            });
        } else {
            setProductToEdit(null);
            setProductForm({ name: '', unit: 'un', quantity: 0, minQuantity: 5, ncm: '', averagePrice: 0, image: '', isFixedInBudget: false });
        }
        setIsProductModalOpen(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!productForm.name.trim()) return alert("A descrição do produto é obrigatória.");
        setIsSaving(true);
        const productData: StockItem = {
            id: productToEdit ? productToEdit.id : String(Date.now()),
            owner_id: currentUser.id,
            name: productForm.name,
            unit: productForm.unit,
            quantity: Number(productForm.quantity),
            minQuantity: Number(productForm.minQuantity),
            ncm: productForm.ncm,
            averagePrice: Number(productForm.averagePrice),
            image: productForm.image || undefined,
            isFixedInBudget: productForm.isFixedInBudget,
            priceHistory: productToEdit?.priceHistory || []
        };
        try {
            await dataService.save('stock_items', productData);
            setIsProductModalOpen(false);
            await loadData();
        } catch (error: any) {
            alert(`Erro ao salvar: ${error.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleProductSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedName = e.target.value;
        const product = items.find(i => i.name === selectedName);
        setRequestForm(prev => ({ 
            ...prev, 
            itemName: selectedName, 
            unit: product ? product.unit : 'un' 
        }));
    };

    const handleOpenRequestForm = (req?: PurchaseRequest) => {
        if (req) {
            setRequestToEdit(req);
            const isInCatalog = items.some(i => i.name.toLowerCase() === req.itemName.toLowerCase());
            setIsManualItem(!isInCatalog);
            
            setRequestForm({
                itemName: req.itemName,
                quantity: req.quantity,
                unit: req.unit,
                priority: req.priority,
                clientName: req.clientName || '',
                observation: req.observation || '',
                purchaseLink: req.purchaseLink || ''
            });
        } else {
            setRequestToEdit(null);
            setIsManualItem(false); 
            setRequestForm({ itemName: '', quantity: 1, unit: 'un', priority: 'Média', clientName: '', observation: '', purchaseLink: '' });
        }
        setIsRequestModalOpen(true);
    };

    const handleSaveRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestForm.itemName.trim()) { alert("Por favor, informe a descrição do item."); return; }
        setIsSaving(true);
        try {
            const finalType: 'Avulso' | 'Reposição' = isManualItem ? 'Avulso' : 'Reposição';
            
            const requestData: PurchaseRequest = {
                id: requestToEdit ? requestToEdit.id : String(Date.now()),
                owner_id: requestToEdit ? requestToEdit.owner_id : currentUser.id,
                itemName: requestForm.itemName,
                quantity: Number(requestForm.quantity),
                unit: requestForm.unit,
                requester: requestToEdit ? requestToEdit.requester : currentUser.name,
                date: requestToEdit ? requestToEdit.date : new Date().toISOString(),
                priority: requestForm.priority,
                status: requestToEdit ? requestToEdit.status : 'Pendente',
                clientName: requestForm.clientName || (isManualItem ? 'Pedido Avulso' : 'Estoque Central'),
                purchaseLink: requestForm.purchaseLink,
                purchaseType: finalType, 
                observation: requestForm.observation
            };
            await dataService.save('purchase_requests', requestData);
            setIsRequestModalOpen(false);
            setRequestToEdit(null);
            await loadData();
        } catch (error: any) {
            console.error("Erro ao salvar pedido:", error);
            alert(`Erro ao salvar pedido.`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleInitiateEfetivar = (request: PurchaseRequest) => {
        setSelectedRequest(request);
        setNfForm({ invoiceNumber: '', invoiceKey: '', totalValue: 0, invoiceFile: '' });
        setIsNFModalOpen(true);
    };

    const handleConfirmFinalization = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRequest) return;
        if (!nfForm.invoiceNumber || nfForm.totalValue <= 0) {
            alert("Preencha os dados da nota fiscal corretamente.");
            return;
        }

        setIsSaving(true);
        try {
            const request = selectedRequest;
            const stockItem = items.find(i => i.name.toLowerCase() === request.itemName.toLowerCase());
            
            if (stockItem) {
                const newUnitCost = nfForm.totalValue / request.quantity;
                const currentQty = stockItem.quantity || 0;
                const currentAvgPrice = stockItem.averagePrice || 0;
                const newQtyTotal = currentQty + request.quantity;
                const weightedAveragePrice = ((currentQty * currentAvgPrice) + (request.quantity * newUnitCost)) / newQtyTotal;

                // Atualiza histórico de preços
                const historyEntry: PriceHistoryEntry = {
                    date: new Date().toISOString(),
                    price: newUnitCost,
                    invoiceNumber: nfForm.invoiceNumber
                };
                const updatedPriceHistory = [...(stockItem.priceHistory || []), historyEntry];

                const updatedItem = {
                    ...stockItem,
                    quantity: newQtyTotal,
                    averagePrice: Math.round(weightedAveragePrice * 100) / 100,
                    priceHistory: updatedPriceHistory
                };
                await dataService.save('stock_items', updatedItem);

                const movement: StockMovement = {
                    id: `mov-${Date.now()}`,
                    owner_id: currentUser.id,
                    itemId: String(stockItem.id),
                    quantity: request.quantity,
                    type: 'entrada',
                    date: new Date().toISOString(),
                    observation: `Entrada via NF ${nfForm.invoiceNumber} (Pedido #${request.id}) - Custo Unit: ${formatCurrency(newUnitCost)} | Destino: ${request.clientName || 'Estoque'}`
                };
                await dataService.save('stock_movements', movement);
            }

            const updatedRequest: PurchaseRequest = { 
                ...request, 
                status: 'Comprado',
                invoiceFile: nfForm.invoiceFile || undefined,
                observation: `${request.observation || ''}\n[NF: ${nfForm.invoiceNumber} | Valor: ${formatCurrency(nfForm.totalValue)}]`.trim()
            };
            await dataService.save('purchase_requests', updatedRequest);
            
            setIsNFModalOpen(false);
            setSelectedRequest(null);
            await loadData();
            
            const successMsg = stockItem 
                ? "Pedido efetivado com sucesso! Saldo e preço médio atualizados." 
                : "Pedido efetivado com sucesso! (Item não vinculado ao estoque)";
            alert(successMsg);
        } catch (e) {
            console.error(e);
            alert("Erro ao processar a efetivação.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInitiateCancel = (request: PurchaseRequest) => {
        setRequestBeingCancelled(request);
        setIsCancelConfirmModalOpen(true);
    };

    const handleConfirmCancel = async () => {
        if (!requestBeingCancelled) return;
        setIsSaving(true);
        try {
            const updatedRequest: PurchaseRequest = { ...requestBeingCancelled, status: 'Cancelado' };
            await dataService.save('purchase_requests', updatedRequest);
            
            setRequests(prev => prev.map(r => String(r.id) === String(updatedRequest.id) ? updatedRequest : r));
            setIsCancelConfirmModalOpen(false);
            setRequestBeingCancelled(null);
            setSelectedRequest(null); 
            
            await loadData();
        } catch (e) {
            console.error("Erro ao cancelar pedido:", e);
            alert("Erro ao cancelar o pedido.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleInitiateApprove = (request: PurchaseRequest) => {
        setRequestBeingApproved(request);
        setIsApproveConfirmModalOpen(true);
    };

    const handleConfirmApprove = async () => {
        if (!requestBeingApproved) return;
        setIsSaving(true);
        try {
            const updatedRequest: PurchaseRequest = { ...requestBeingApproved, status: 'Aprovado' };
            await dataService.save('purchase_requests', updatedRequest);
            
            setRequests(prev => prev.map(r => String(r.id) === String(updatedRequest.id) ? updatedRequest : r));
            setIsApproveConfirmModalOpen(false);
            setRequestBeingApproved(null);
            setSelectedRequest(null); 
            
            await loadData();
        } catch (e) {
            console.error("Erro ao aprovar pedido:", e);
            alert("Erro ao aprovar o pedido.");
        } finally {
            setIsSaving(false);
        }
    };

    const filteredMovements = useMemo(() => {
        if (movementFilter === 'todos') return movements;
        return movements.filter(m => m.type === movementFilter);
    }, [movements, movementFilter]);

    const filteredRequests = useMemo(() => {
        if (purchaseStatusFilter === 'Todos') return requests;
        return requests.filter(r => r.status === purchaseStatusFilter);
    }, [requests, purchaseStatusFilter]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

    const getFinalidadeByItemName = (itemName: string) => {
        const isInCatalog = items.some(i => i.name.toLowerCase() === itemName.toLowerCase());
        return isInCatalog ? 'Reposição' : 'Avulso';
    };

    // Helper para extrair tendência de preço
    const getPriceTrend = (item: StockItem) => {
        const history = item.priceHistory || [];
        if (history.length < 2) return null;
        const last = history[history.length - 1].price;
        const prev = history[history.length - 2].price;
        if (last > prev) return { type: 'up', color: 'text-red-500' };
        if (last < prev) return { type: 'down', color: 'text-green-500' };
        return { type: 'equal', color: 'text-gray-400' };
    };

    if (view === 'visao_geral') {
        const inventoryValue = items.reduce((acc, i) => acc + (i.quantity * (i.averagePrice || 0)), 0);
        return (
            <div className="space-y-6 animate-fade-in">
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque geral</h2>
                        <p className="text-xs text-gray-500 font-bold mt-1">Gestão de inventário e movimentações</p>
                    </div>
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
                                    <th className="px-4 py-4 w-16">Foto</th>
                                    <th className="px-4 py-4">Descrição</th>
                                    <th className="px-4 py-4">NCM</th>
                                    <th className="px-4 py-4 text-center">Und.</th>
                                    <th className="px-4 py-4 text-right">Custo unitário</th>
                                    <th className="px-4 py-4 text-center">Saldo</th>
                                    <th className="px-4 py-4 text-center">Reservado</th>
                                    <th className="px-4 py-4 text-center">Mínimo</th>
                                    <th className="px-4 py-4 text-center">Saldo futuro</th>
                                    <th className="px-4 py-4 text-right">Valor total</th>
                                    <th className="px-4 py-4 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                {items.length > 0 ? items.map(item => {
                                    const isLowStock = item.quantity <= item.minQuantity;
                                    const futureStock = (item.quantity || 0) - (item.reservedQuantity || 0);
                                    const itemTotalValue = (item.quantity || 0) * (item.averagePrice || 0);
                                    const hasReservations = (item.reservedQuantity || 0) > 0;
                                    const trend = getPriceTrend(item);

                                    return (
                                        <tr key={item.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isLowStock ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                            <td className="px-4 py-3"><div className="w-10 h-10 rounded-lg border bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">{item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <PhotographIcon className="w-5 h-5 text-gray-300" />}</div></td>
                                            <td className="px-4 py-3 font-bold text-gray-900 dark:text-white">{item.name}</td>
                                            <td className="px-4 py-3 text-gray-400 font-medium text-xs">{item.ncm || '---'}</td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-400">{item.unit}</td>
                                            <td className="px-4 py-3 text-right align-middle">
                                                <button 
                                                    onClick={() => setSelectedHistoryItem(item)}
                                                    className="group relative flex flex-col items-end w-full h-5"
                                                    title="Clique para ver evolução de custos"
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span className="font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                                                            {formatCurrency(item.averagePrice || 0)}
                                                        </span>
                                                        {trend && (
                                                            <span>
                                                                {trend.type === 'up' ? <ArrowUpIcon className={`w-3 h-3 ${trend.color}`} /> : 
                                                                 trend.type === 'down' ? <ArrowDownIcon className={`w-3 h-3 ${trend.color}`} /> : 
                                                                 null}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="h-0 w-full relative">
                                                        <span className="absolute top-0 right-0 text-[9px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold whitespace-nowrap">Ver histórico</span>
                                                    </div>
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-center font-black text-gray-900 dark:text-white">{item.quantity}</td>
                                            <td className="px-4 py-3 text-center">
                                                {hasReservations ? (
                                                    <button 
                                                        onClick={() => setSelectedReservationItem(item)}
                                                        className="font-black text-indigo-600 dark:text-indigo-400 underline decoration-indigo-300 underline-offset-4 hover:text-indigo-800 transition-colors"
                                                        title="Clique para ver quem reservou"
                                                    >
                                                        {item.reservedQuantity}
                                                    </button>
                                                ) : (
                                                    <span className="font-bold text-gray-400">{item.reservedQuantity || 0}</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-bold text-gray-400">{item.minQuantity}</td>
                                            <td className={`px-4 py-3 text-center font-bold ${futureStock < 0 ? 'text-red-600' : 'text-indigo-600'}`}>
                                                {futureStock}
                                            </td>
                                            <td className="px-4 py-3 text-right font-black text-gray-700 dark:text-gray-300">{formatCurrency(itemTotalValue)}</td>
                                            <td className="px-4 py-3 text-center">{isLowStock ? <span className="text-[10px] font-black text-red-600 bg-red-100 dark:bg-red-900/40 px-3 py-1 rounded-full tracking-tighter shadow-sm">Reposição</span> : <span className="text-[10px] font-black text-green-600 bg-green-100 dark:bg-green-900/40 px-3 py-1 rounded-full tracking-tighter shadow-sm">Normal</span>}</td>
                                        </tr>
                                    );
                                }) : (<tr><td colSpan={11} className="px-6 py-12 text-center text-gray-400 italic">Nenhum produto cadastrado para exibição.</td></tr>)}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm gap-4">
                            <div className="flex items-center gap-3"><FilterIcon className="w-5 h-5 text-gray-400" /><span className="text-xs font-bold text-gray-500">Filtrar movimentações:</span></div>
                            <div className="flex gap-2 w-full sm:w-auto">{(['todos', 'entrada', 'saida'] as const).map(f => (<button key={f} onClick={() => setMovementFilter(f)} className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all ${movementFilter === f ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-gray-50 text-gray-400 border-transparent'} border`}>{f === 'todos' ? 'Ver todas' : f === 'entrada' ? 'Entradas' : 'Saídas'}</button>))}</div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                            <table className="min-w-full text-left text-sm">
                                <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-500 border-b">
                                    <tr>
                                        <th className="px-6 py-4">Data / hora</th>
                                        <th className="px-6 py-4">Tipo</th>
                                        <th className="px-6 py-4">Produto</th>
                                        <th className="px-6 py-4 text-center">Quantidade</th>
                                        <th className="px-6 py-4">Observação / referência</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {filteredMovements.length > 0 ? filteredMovements.map(mov => {
                                        const product = items.find(i => String(i.id) === String(mov.itemId));
                                        return (
                                            <tr key={mov.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                                <td className="px-6 py-4"><div className="text-gray-900 dark:text-white font-bold">{new Date(mov.date).toLocaleDateString('pt-BR')}</div><div className="text-[10px] text-gray-400 font-mono">{new Date(mov.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div></td>
                                                <td className="px-6 py-4">{mov.type === 'entrada' ? (<span className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full w-fit"><ArrowUpIcon className="w-3 h-3" /> Entrada</span>) : (<span className="flex items-center gap-1.5 text-red-600 font-bold text-[10px] bg-red-100 dark:bg-green-900/30 px-2 py-1 rounded-full w-fit"><ArrowDownIcon className="w-3 h-3" /> Saída</span>)}</td>
                                                <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200">{product?.name || 'Item não identificado'}</td>
                                                <td className={`px-6 py-4 text-center font-black text-lg ${mov.type === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{mov.type === 'entrada' ? '+' : '-'}{mov.quantity}</td>
                                                <td className="px-6 py-4 text-xs text-gray-500 italic max-w-xs truncate" title={mov.observation}>{mov.observation || 'Sem observação registrada.'}</td>
                                            </tr>
                                        );
                                    }) : (<tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Nenhuma movimentação encontrada para o filtro selecionado.</td></tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {selectedHistoryItem && (
                    <Modal 
                        title={`Evolução de custo: ${selectedHistoryItem.name}`} 
                        onClose={() => setSelectedHistoryItem(null)}
                        maxWidth="max-w-3xl"
                    >
                        <div className="space-y-6">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border dark:border-gray-700">
                                <h4 className="text-[11px] font-black text-indigo-600 mb-6 flex items-center gap-2">
                                    <ChartPieIcon className="w-4 h-4" /> Histórico de compras por NF
                                </h4>
                                
                                <div className="h-[300px] w-full">
                                    {selectedHistoryItem.priceHistory && selectedHistoryItem.priceHistory.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={selectedHistoryItem.priceHistory.map(h => ({
                                                ...h,
                                                displayDate: new Date(h.date).toLocaleDateString('pt-BR'),
                                                priceNum: h.price
                                            }))}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                <XAxis dataKey="displayDate" tick={{fontSize: 10}} stroke="#94a3b8" />
                                                <YAxis tickFormatter={(val) => `R$ ${val}`} tick={{fontSize: 10}} stroke="#94a3b8" />
                                                <Tooltip 
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                                                    formatter={(val: number) => [formatCurrency(val), 'Preço unitário']}
                                                    labelFormatter={(label) => `Data: ${label}`}
                                                />
                                                <Line 
                                                    type="monotone" 
                                                    dataKey="priceNum" 
                                                    stroke="#4f46e5" 
                                                    strokeWidth={3} 
                                                    dot={{ r: 4, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }}
                                                    activeDot={{ r: 6, strokeWidth: 0 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                            <ExclamationTriangleIcon className="w-10 h-10 mb-2" />
                                            <p className="text-xs font-bold">Nenhum histórico de NF lançado para este item.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden shadow-sm">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-gray-400 border-b">
                                        <tr>
                                            <th className="px-4 py-3">Data lançamento</th>
                                            <th className="px-4 py-3 text-center">NF-e</th>
                                            <th className="px-4 py-3 text-right">Valor unitário</th>
                                            <th className="px-4 py-3 text-center">Variação</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {[...(selectedHistoryItem.priceHistory || [])].reverse().map((entry, idx, arr) => {
                                            const nextEntry = arr[idx + 1];
                                            let diffPercent = 0;
                                            if (nextEntry) {
                                                diffPercent = ((entry.price - nextEntry.price) / nextEntry.price) * 100;
                                            }

                                            return (
                                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                    <td className="px-4 py-3 font-medium text-gray-500">{new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                                                    <td className="px-4 py-3 text-center font-bold text-gray-700 dark:text-gray-300">{entry.invoiceNumber || '---'}</td>
                                                    <td className="px-4 py-3 text-right font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(entry.price)}</td>
                                                    <td className="px-4 py-3 text-center">
                                                        {idx < arr.length - 1 ? (
                                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${diffPercent > 0 ? 'bg-red-50 text-red-600' : diffPercent < 0 ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-400'}`}>
                                                                {diffPercent > 0 ? '+' : ''}{diffPercent.toFixed(1)}%
                                                            </span>
                                                        ) : <span className="text-[10px] text-gray-300 font-bold">---</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </Modal>
                )}

                {selectedReservationItem && (
                    <Modal 
                        title={`Reservas: ${selectedReservationItem.name}`} 
                        onClose={() => setSelectedReservationItem(null)}
                        maxWidth="max-w-xl"
                    >
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">Total reservado</p>
                                    <p className="text-2xl font-black text-indigo-700 dark:text-indigo-300">{selectedReservationItem.reservedQuantity} {selectedReservationItem.unit}</p>
                                </div>
                                <CubeIcon className="w-10 h-10 text-indigo-200 dark:text-indigo-800" />
                            </div>

                            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 overflow-hidden shadow-sm">
                                <table className="min-w-full text-left text-xs">
                                    <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-gray-400 border-b">
                                        <tr>
                                            <th className="px-4 py-3">Cliente / projeto</th>
                                            <th className="px-4 py-3 text-center">Quantidade</th>
                                            <th className="px-4 py-3 text-right">Data da reserva</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                        {reservationsForItem.length > 0 ? reservationsForItem.map((res, idx) => (
                                            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">{res.clientName}</td>
                                                <td className="px-4 py-3 text-center font-black text-indigo-600 dark:text-indigo-400">{res.quantity}</td>
                                                <td className="px-4 py-3 text-right text-gray-500 font-mono">{new Date(res.date).toLocaleDateString('pt-BR')}</td>
                                            </tr>
                                        )) : (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 italic">
                                                    Nenhum check-in efetivado encontrado para este item.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end pt-2">
                                <button 
                                    onClick={() => setSelectedReservationItem(null)}
                                    className="px-6 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg font-bold text-xs"
                                >
                                    Fechar
                                </button>
                            </div>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }

    if (view === 'cadastro') return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Cadastrar produtos</h2><p className="text-xs text-gray-400 font-bold mt-1">Gerenciamento de materiais e equipamentos</p></div>
                <button onClick={() => handleOpenProductForm()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"><PlusIcon className="w-5 h-5" /> Novo produto</button>
            </header>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-500 border-b">
                        <tr>
                            <th className="px-6 py-4 w-20">Foto</th>
                            <th className="px-6 py-4">Descrição do produto</th>
                            <th className="px-6 py-4">NCM</th>
                            <th className="px-6 py-4 text-center">Und.</th>
                            <th className="px-6 py-4 text-center">Mínimo</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {items.length > 0 ? items.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                <td className="px-6 py-4"><div className="w-12 h-12 rounded border bg-gray-50 dark:bg-gray-900 flex items-center justify-center overflow-hidden">{item.image ? <img src={item.image} className="w-full h-full object-cover" alt="" /> : <PhotographIcon className="w-5 h-5 text-gray-300" />}</div></td>
                                <td className="px-6 py-4 font-bold text-gray-900 dark:text-white">{item.name}</td>
                                <td className="px-6 py-4 text-gray-400 font-medium text-xs">{item.ncm || '---'}</td>
                                <td className="px-6 py-4 text-center font-bold text-gray-500 dark:text-gray-400">{item.unit}</td>
                                <td className="px-6 py-4 text-center font-bold text-orange-600 dark:text-orange-400">{item.minQuantity}</td>
                                <td className="px-6 py-4 text-center"><div className="flex justify-center gap-2"><button onClick={() => handleOpenProductForm(item)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"><EditIcon className="w-5 h-5"/></button><button onClick={() => { if(window.confirm('Excluir este produto?')) dataService.delete('stock_items', item.id).then(loadData) }} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><TrashIcon className="w-5 h-5"/></button></div></td>
                            </tr>
                        )) : (<tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Nenhum produto cadastrado no catálogo.</td></tr>)}
                    </tbody>
                </table>
            </div>
            {isProductModalOpen && (
                <Modal title={productToEdit ? "Editar produto" : "Novo produto"} onClose={() => setIsProductModalOpen(false)} maxWidth="max-w-2xl">
                    <form onSubmit={handleSaveProduct} className="space-y-5">
                        <div className="flex items-center gap-6 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                             <div onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 border shadow-sm flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-all overflow-hidden flex-shrink-0">
                                {productForm.image ? (
                                    <img src={productForm.image} className="w-full h-full object-cover" alt="Preview" />
                                ) : (
                                    <PhotographIcon className="w-6 h-6 text-gray-300" />
                                )}
                             </div>
                             <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                             <div className="flex-1">
                                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Imagem do produto</p>
                                <p className="text-xs text-gray-500 mb-2">Selecione uma foto para identificar o item no catálogo.</p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[10px] font-bold text-indigo-600 tracking-wider bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-all">Upload</button>
                                    {productForm.image && (
                                        <button type="button" onClick={() => setProductForm(p => ({...p, image: ''}))} className="text-[10px] font-bold text-red-500 tracking-wider bg-red-50 dark:bg-red-900/30 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-all">Remover</button>
                                    )}
                                </div>
                             </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Descrição do produto</label>
                            <input 
                                required 
                                type="text"
                                placeholder="Ex: Inversor solar Deye 5kW" 
                                value={productForm.name} 
                                onChange={e => setProductForm({...productForm, name: e.target.value})} 
                                className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Unidade</label>
                                <select 
                                    value={productForm.unit} 
                                    onChange={e => setProductForm({...productForm, unit: e.target.value})} 
                                    className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                                >
                                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">NCM</label>
                                <input 
                                    type="text"
                                    placeholder="0000.00.00" 
                                    value={productForm.ncm} 
                                    onChange={e => setProductForm({...productForm, ncm: e.target.value})} 
                                    className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Saldo estoque inicial</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={productForm.quantity} 
                                    onChange={e => setProductForm({...productForm, quantity: parseFloat(e.target.value) || 0})} 
                                    className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Estoque mínimo</label>
                                <input 
                                    type="number" 
                                    value={productForm.minQuantity} 
                                    onChange={e => setProductForm({...productForm, minQuantity: parseFloat(e.target.value) || 0})} 
                                    className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Custo unitário médio (R$)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    value={productForm.averagePrice || ''} 
                                    onChange={e => setProductForm({...productForm, averagePrice: parseFloat(e.target.value) || 0})} 
                                    className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-bold text-indigo-600 dark:text-indigo-400 outline-none focus:ring-2 focus:ring-indigo-500/20" 
                                    placeholder="0,00"
                                />
                            </div>
                        </div>

                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    checked={productForm.isFixedInBudget} 
                                    onChange={e => setProductForm({...productForm, isFixedInBudget: e.target.checked})} 
                                    className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                                />
                                <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 tracking-tight">Esse item deve ser fixo na lista de materiais de orçamento?</span>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                type="button" 
                                onClick={() => setIsProductModalOpen(false)} 
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSaving} 
                                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all"
                            >
                                {isSaving ? 'Gravando...' : 'Salvar produto'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );

    if (view === 'compras') return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border dark:border-gray-700">
                <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Pedidos de compra</h2><p className="text-xs text-gray-400 font-bold mt-1">Gestão de suprimentos</p></div>
                <button onClick={() => handleOpenRequestForm()} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:bg-indigo-700 transition-all active:scale-95"><PlusIcon className="w-5 h-5" /> Novo pedido</button>
            </header>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-4">
                <div className="flex items-center gap-3">
                    <FilterIcon className="w-5 h-5 text-gray-400" />
                    <span className="text-xs font-bold text-gray-500">Filtrar por status:</span>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    {(['Todos', 'Pendente', 'Aprovado', 'Comprado', 'Cancelado'] as const).map(f => (
                        <button 
                            key={f} 
                            onClick={() => setPurchaseStatusFilter(f)} 
                            className={`flex-1 md:flex-none px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
                                purchaseStatusFilter === f 
                                ? 'bg-indigo-100 text-indigo-700 border-indigo-200 shadow-sm' 
                                : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border dark:border-gray-700 overflow-hidden">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700 font-bold text-[11px] text-gray-400 border-b">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Item solicitado</th>
                            <th className="px-6 py-4 text-center">Prioridade</th>
                            <th className="px-6 py-4 text-center">Volume</th>
                            <th className="px-6 py-4">Obra / destino</th>
                            <th className="px-6 py-4">Finalidade</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredRequests.length > 0 ? filteredRequests.map(req => {
                            const pType = getFinalidadeByItemName(req.itemName);
                            const isReposicao = pType === 'Reposição';

                            return (
                                <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-gray-900 dark:text-white font-bold text-xs">{new Date(req.date).toLocaleDateString('pt-BR')}</div>
                                        <div className="text-[9px] text-gray-400 font-mono">{new Date(req.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-gray-900 dark:text-white text-xs">{req.itemName}</div>
                                        <div className="text-[9px] text-gray-400 font-medium">{req.requester}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                                            req.priority === 'Alta' ? 'bg-red-100 text-red-600' :
                                            req.priority === 'Média' ? 'bg-orange-100 text-orange-600' :
                                            'bg-blue-100 text-blue-600'
                                        }`}>
                                            {req.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400 text-xs">{req.quantity} {req.unit}</td>
                                    <td className="px-6 py-4 text-gray-500 text-[10px] font-bold truncate max-w-[120px]">{req.clientName || '---'}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black border shadow-sm tracking-tight transition-colors ${
                                            isReposicao 
                                            ? 'bg-blue-100 text-blue-800 border-blue-200' 
                                            : 'bg-amber-100 text-amber-800 border-amber-200'
                                        }`}>
                                            {pType}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-tighter ${
                                            req.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' : 
                                            req.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 
                                            req.status === 'Comprado' ? 'bg-blue-100 text-blue-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1">
                                            {req.status === 'Pendente' && (
                                                <button onClick={() => handleOpenRequestForm(req)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar pedido">
                                                    <EditIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                            <button onClick={() => setSelectedRequest(req)} className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors" title="Ver detalhes">
                                                <EyeIcon className="w-5 h-5"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        }) : (<tr><td colSpan={8} className="px-6 py-12 text-center text-gray-400 font-bold text-[10px] tracking-widest italic">Nenhum pedido registrado para este filtro.</td></tr>)}
                    </tbody>
                </table>
            </div>

            {selectedRequest && (
                <Modal title="Detalhes do pedido de compra" onClose={() => setSelectedRequest(null)} maxWidth="max-w-2xl">
                    <div className="space-y-6">
                        <div className="flex justify-between items-start border-b pb-4 dark:border-gray-700">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">Status atual</h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    selectedRequest.status === 'Pendente' ? 'bg-yellow-100 text-yellow-700' : 
                                    selectedRequest.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 
                                    selectedRequest.status === 'Comprado' ? 'bg-blue-100 text-blue-700' :
                                    'bg-green-100 text-green-700'
                                }`}>
                                    {selectedRequest.status}
                                </span>
                            </div>
                            <div className="text-right">
                                <h4 className="text-[10px] font-bold text-gray-400 tracking-widest mb-1">Prioridade</h4>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    selectedRequest.priority === 'Alta' ? 'bg-red-50 text-red-600 border border-red-200' : 
                                    selectedRequest.priority === 'Média' ? 'bg-orange-50 text-orange-600 border border-orange-200' : 
                                    selectedRequest.priority === 'Baixa' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-gray-100'
                                }`}>
                                    {selectedRequest.priority}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 mb-1">Item solicitado</h4>
                                <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedRequest.itemName}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 mb-1">Quantidade / unidade</h4>
                                <p className="text-lg font-bold text-indigo-600">{selectedRequest.quantity} {selectedRequest.unit}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 mb-1">Solicitante</h4>
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{selectedRequest.requester}</p>
                                <p className="text-[10px] text-gray-400">{new Date(selectedRequest.date).toLocaleString('pt-BR')}</p>
                            </div>
                            <div>
                                <h4 className="text-[10px] font-bold text-gray-400 mb-1">Obra / destino</h4>
                                <p className="text-sm font-bold text-gray-700 dark:text-gray-300">{selectedRequest.clientName || '---'}</p>
                            </div>
                        </div>

                        {(selectedRequest.observation || selectedRequest.purchaseLink || selectedRequest.invoiceFile) && (
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border dark:border-gray-600">
                                <h4 className="text-[10px] font-bold text-gray-400 mb-2">Informações Adicionais</h4>
                                {selectedRequest.observation && <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mb-3">{selectedRequest.observation}</p>}
                                <div className="flex flex-wrap gap-4">
                                    {selectedRequest.purchaseLink && (
                                        <a href={selectedRequest.purchaseLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-all underline decoration-2 underline-offset-4">
                                            <LinkIcon className="w-4 h-4" /> Link de compra
                                        </a>
                                    )}
                                    {selectedRequest.invoiceFile && (
                                        <a href={selectedRequest.invoiceFile} download={`NF-${selectedRequest.itemName}.pdf`} className="flex items-center gap-2 text-xs font-bold text-green-600 hover:text-green-800 transition-all underline decoration-2 underline-offset-4">
                                            <DocumentReportIcon className="w-4 h-4" /> Ver Anexo da NF
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between gap-3 pt-6 border-t dark:border-gray-700">
                            <div className="flex gap-2">
                                {selectedRequest.status === 'Pendente' && isAdmin && (
                                    <>
                                        <button 
                                            onClick={() => handleInitiateApprove(selectedRequest)} 
                                            disabled={isSaving}
                                            className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <CheckCircleIcon className="w-4 h-4" />
                                            {isSaving ? 'Processando...' : 'Aprovar'}
                                        </button>
                                        <button 
                                            onClick={() => handleInitiateCancel(selectedRequest)} 
                                            disabled={isSaving}
                                            className="px-6 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                                        >
                                            Cancelar pedido
                                        </button>
                                    </>
                                )}
                                {selectedRequest.status === 'Aprovado' && (
                                    <>
                                        <button 
                                            onClick={() => handleInitiateEfetivar(selectedRequest)} 
                                            disabled={isSaving}
                                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center gap-2"
                                        >
                                            <CheckCircleIcon className="w-4 h-4" />
                                            Efetivar compra
                                        </button>
                                        <button 
                                            onClick={() => handleInitiateCancel(selectedRequest)} 
                                            disabled={isSaving}
                                            className="px-6 py-2.5 bg-white text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-50 transition-all disabled:opacity-50"
                                        >
                                            Cancelar pedido
                                        </button>
                                    </>
                                )}
                            </div>
                            <button onClick={() => setSelectedRequest(null)} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-lg text-xs font-bold">Fechar</button>
                        </div>
                    </div>
                </Modal>
            )}

            {isNFModalOpen && selectedRequest && (
                <Modal title="Lançamento de nota fiscal" onClose={() => setIsNFModalOpen(false)} maxWidth="max-w-lg">
                    <form onSubmit={handleConfirmFinalization} className="space-y-6">
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                            <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 tracking-widest mb-2">Item sendo efetivado</h4>
                            <p className="font-bold text-gray-900 dark:text-white">{selectedRequest.itemName}</p>
                            <p className="text-xs text-gray-500 mt-1">Quantidade: <span className="font-bold">{selectedRequest.quantity} {selectedRequest.unit}</span></p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Número da NF-e</label>
                                <input required type="text" placeholder="000.000.000" value={nfForm.invoiceNumber} onChange={e => setNfForm({...nfForm, invoiceNumber: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Chave de acesso (NF-e)</label>
                                <input type="text" placeholder="44 dígitos da nota" maxLength={44} value={nfForm.invoiceKey} onChange={e => setNfForm({...nfForm, invoiceKey: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Anexar Nota Fiscal (PDF ou Imagem)</label>
                                <div onClick={() => nfFileInputRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-500 transition-all bg-gray-50 dark:bg-gray-700/30">
                                    {nfForm.invoiceFile ? (
                                        <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                                            <CheckCircleIcon className="w-8 h-8" />
                                            <span className="text-xs font-bold">Arquivo anexado!</span>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setNfForm(p => ({...p, invoiceFile: ''})); }} className="text-red-500 hover:underline text-[10px] uppercase font-black ml-2">Remover</button>
                                        </div>
                                    ) : (
                                        <>
                                            <UploadIcon className="w-8 h-8 text-gray-400 mb-2" />
                                            <span className="text-xs text-gray-500 font-bold">Clique para selecionar o arquivo</span>
                                        </>
                                    )}
                                    <input type="file" ref={nfFileInputRef} onChange={handleNFFileChange} className="hidden" accept="image/*,.pdf" />
                                </div>
                            </div>

                            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-800">
                                <label className="block text-sm font-semibold text-green-600 dark:text-green-400 mb-1.5 text-center">Valor total dos itens na nota (R$)</label>
                                <input required type="number" step="0.01" placeholder="0,00" value={nfForm.totalValue || ''} onChange={e => setNfForm({...nfForm, totalValue: parseFloat(e.target.value) || 0})} className="w-full bg-transparent border-none text-center text-2xl font-black text-green-700 dark:text-green-300 outline-none" />
                                {nfForm.totalValue > 0 && (
                                    <p className="text-center text-[10px] text-green-500 font-bold mt-2 uppercase">Custo unitário calculado: {formatCurrency(nfForm.totalValue / selectedRequest.quantity)}</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button type="button" onClick={() => setIsNFModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl font-bold text-sm">Voltar</button>
                            <button type="submit" disabled={isSaving || nfForm.totalValue <= 0} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 hover:bg-green-700 disabled:opacity-50 transition-all">{isSaving ? 'Gravando...' : 'Confirmar e atualizar estoque'}</button>
                        </div>
                    </form>
                </Modal>
            )}

            {isCancelConfirmModalOpen && requestBeingCancelled && (
                <Modal title="Confirmar Cancelamento" onClose={() => setIsCancelConfirmModalOpen(false)} maxWidth="max-w-md">
                    <div className="p-4 text-center space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 text-red-600">
                            <ExclamationTriangleIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Você deseja cancelar a compra desse item?
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Item: <span className="font-bold text-gray-700 dark:text-gray-200">{requestBeingCancelled.itemName}</span>
                                <br />
                                Quantidade: {requestBeingCancelled.quantity} {requestBeingCancelled.unit}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsCancelConfirmModalOpen(false)}
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                            >
                                Não
                            </button>
                            <button 
                                onClick={handleConfirmCancel}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Processando...' : 'Sim'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isApproveConfirmModalOpen && requestBeingApproved && (
                <Modal title="Confirmar Aprovação" onClose={() => setIsApproveConfirmModalOpen(false)} maxWidth="max-w-md">
                    <div className="p-4 text-center space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 text-green-600">
                            <CheckCircleIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                Você deseja Aprovar a compra desse item?
                            </h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                Item: <span className="font-bold text-gray-700 dark:text-gray-200">{requestBeingApproved.itemName}</span>
                                <br />
                                Quantidade: {requestBeingApproved.quantity} {requestBeingApproved.unit}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setIsApproveConfirmModalOpen(false)}
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm hover:bg-gray-200 transition-all"
                            >
                                Não
                            </button>
                            <button 
                                onClick={handleConfirmApprove}
                                disabled={isSaving}
                                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 hover:bg-green-700 transition-all disabled:opacity-50"
                            >
                                {isSaving ? 'Processando...' : 'Sim'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isRequestModalOpen && (
                <Modal title={requestToEdit ? "Editar pedido de compra" : "Novo pedido de compra"} onClose={() => { setIsRequestModalOpen(false); setRequestToEdit(null); }} maxWidth="max-w-xl">
                    <form onSubmit={handleSaveRequest} className="space-y-4">
                        <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-md mb-4 border border-gray-200 dark:border-gray-600">
                            <button type="button" onClick={() => setIsManualItem(false)} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${!isManualItem ? 'bg-white dark:bg-gray-800 shadow-sm text-indigo-600 border border-gray-100' : 'text-gray-500'}`}>Catálogo Orner</button>
                            <button type="button" onClick={() => { setIsManualItem(true); setRequestForm(p => ({...p, itemName: ''})); }} className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all ${isManualItem ? 'bg-white dark:bg-gray-800 shadow-sm text-amber-600 border border-gray-100' : 'text-gray-500'}`}>Manual / avulso</button>
                        </div>

                        <div className={`p-4 rounded-xl border ${isManualItem ? 'bg-amber-50/50 border-amber-100' : 'bg-blue-50/50 border-blue-100'}`}>
                           <p className={`text-[10px] font-bold mb-2 ${isManualItem ? 'text-amber-600' : 'text-blue-600'}`}>
                               Finalidade selecionada: <span className="underline">{isManualItem ? 'Avulso' : 'Reposição'}</span>
                           </p>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Descrição do item</label>
                            {isManualItem ? (
                                <input required autoFocus placeholder="Ex: Curva 90 graus..." value={requestForm.itemName} onChange={e => setRequestForm({...requestForm, itemName: e.target.value})} className="w-full rounded-xl border-transparent bg-white dark:bg-gray-700/50 p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 shadow-sm" />
                            ) : (
                                <select required value={requestForm.itemName} onChange={handleProductSelectChange} className="w-full rounded-xl border-transparent bg-white dark:bg-gray-700/50 p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm">
                                    <option value="">Selecione um produto do catálogo...</option>
                                    {items.map(item => (<option key={item.id} value={item.name}>{item.name}</option>))}
                                </select>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Quantidade</label>
                                <input type="number" step="0.01" required value={requestForm.quantity} onChange={e => setRequestForm({...requestForm, quantity: parseFloat(e.target.value) || 0})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Unidade</label>
                                {isManualItem ? (
                                    <select required value={requestForm.unit} onChange={e => setRequestForm({...requestForm, unit: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20">
                                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                ) : (
                                    <input disabled value={requestForm.unit} className="w-full rounded-xl border-transparent bg-gray-100 dark:bg-gray-800 p-3 text-sm font-bold text-gray-500 cursor-not-allowed" />
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Urgência</label>
                                <select value={requestForm.priority} onChange={e => setRequestForm({...requestForm, priority: e.target.value as any})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="Baixa">Baixa (Rotina)</option>
                                    <option value="Média">Média (Em obra)</option>
                                    <option value="Alta">Alta (Urgente)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Data solicitação</label>
                                <input type="text" disabled value={requestToEdit ? new Date(requestToEdit.date).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')} className="w-full rounded-xl border-transparent bg-gray-100 dark:bg-gray-800 p-3 text-sm font-bold text-gray-500 cursor-not-allowed" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Obra / destino</label>
                            <input placeholder={isManualItem ? "Obrigatório para itens avulsos" : "Ex: Estoque geral / Obra X"} value={requestForm.clientName} onChange={e => setRequestForm({...requestForm, clientName: e.target.value})} className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" />
                        </div>

                        <div className="animate-fade-in">
                            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">Observações ou link</label>
                            <textarea 
                                placeholder="Link para compra ou detalhes extras..." 
                                value={requestForm.observation} 
                                onChange={e => setRequestForm({...requestForm, observation: e.target.value})} 
                                className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3 text-sm font-medium text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 h-24" 
                            />
                        </div>

                        <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-700 gap-3">
                            <button type="button" onClick={() => { setIsRequestModalOpen(false); setRequestToEdit(null); }} className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm">Cancelar</button>
                            <button type="submit" disabled={isSaving} className={`px-6 py-2.5 ${isManualItem ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'} text-white rounded-xl font-bold text-sm shadow-lg transition-all`}>{isSaving ? 'Gravando...' : 'Salvar pedido'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default EstoquePage;
