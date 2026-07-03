
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    CubeIcon, TrashIcon, PlusIcon, 
    ExclamationTriangleIcon, DollarIcon, EditIcon, PhotographIcon, XCircleIcon,
    ArrowUpIcon, ArrowDownIcon, FilterIcon, CalendarIcon, ClipboardListIcon, ShoppingCartIcon, LinkIcon,
    EyeIcon, CheckCircleIcon, TableIcon, UploadIcon, DocumentReportIcon, ChartPieIcon, ClockIcon, TruckIcon, UsersIcon, SearchIcon, ChevronDownIcon, PrinterIcon
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

const EstoquePage: React.FC<EstoquePageProps> = ({ view, setCurrentPage, currentUser, userPermissions, companyLogo }) => {
    const [items, setItems] = useState<StockItem[]>([]);
    const [requests, setRequests] = useState<PurchaseRequest[]>([]);
    const [movements, setMovements] = useState<StockMovement[]>([]);
    const [checkins, setCheckins] = useState<ChecklistEntry[]>([]);
    const [approvedClients, setApprovedClients] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [activeTab, setActiveTab] = useState<'inventario' | 'historico'>('inventario');
    const [purchaseStatusFilter, setPurchaseStatusFilter] = useState<'Todos' | PurchaseRequestStatus>('Aberto');

    // Filtros para o Inventário
    const [inventorySearchTerm, setInventorySearchTerm] = useState('');

    // Filtros para o Histórico de Movimentação
    const [historyItemId, setHistoryItemId] = useState<string>('Todos');
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [showHistorySuggestions, setShowHistorySuggestions] = useState(false);
    const historySuggestionRef = useRef<HTMLDivElement>(null);

    const [historyStart, setHistoryStart] = useState<string>('');
    const [historyEnd, setHistoryEnd] = useState<string>('');

    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const [requestToEdit, setRequestToEdit] = useState<PurchaseRequest | null>(null);
    const [hdInvoiceFile, setHdInvoiceFile] = useState<string | null>(null);
    const [hdInvoiceFileName, setHdInvoiceFileName] = useState<string | null>(null);
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
    const [productForm, setProductForm] = useState<{
        name: string;
        ncm: string;
        quantity: number;
        minQuantity: number;
        unit: string;
        description: string;
        image: string;
        averagePrice: number;
        isFixedInBudget: boolean;
        lineStatus: 'Em linha' | 'Fora de Linha';
    }>({
        name: '', ncm: '', quantity: 0, minQuantity: 1, unit: 'un', description: '', image: '', averagePrice: 0, isFixedInBudget: true, lineStatus: 'Em linha'
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
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, true),
                dataService.getPartial<any>('checklist_checkin', 'id, owner_id, project, responsible, date, status, details->componentesEstoque', currentUser.id, true)
            ]);

            setItems(loadedItems.sort((a,b) => (a.name || '').localeCompare(b.name || '')));
            setMovements(loadedMovements.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            setCheckins((loadedCheckins || []).map((c: any) => ({
                ...c,
                details: {
                    componentesEstoque: c.componentesEstoque || []
                }
            })));
            
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

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!hdInvoiceFile) {
            setPreviewUrl(null);
            return;
        }

        if (hdInvoiceFile.startsWith('data:')) {
            try {
                const arr = hdInvoiceFile.split(',');
                const mime = arr[0].match(/:(.*?);/)?.[1] || '';
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                    u8arr[n] = bstr.charCodeAt(n);
                }
                const blob = new Blob([u8arr], { type: mime });
                const url = URL.createObjectURL(blob);
                setPreviewUrl(url);

                return () => {
                    URL.revokeObjectURL(url);
                };
            } catch (err) {
                console.error("Erro ao converter data URL em blob:", err);
                setPreviewUrl(hdInvoiceFile);
            }
        } else {
            setPreviewUrl(hdInvoiceFile);
        }
    }, [hdInvoiceFile]);

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
        let requestToConfirm = request;
        if (requestToEdit && String(requestToEdit.id) === String(request.id)) {
            requestToConfirm = {
                ...request,
                itemName: requestForm.itemName,
                quantity: Number(requestForm.quantity),
                unit: requestForm.unit,
                priority: requestForm.priority,
                clientName: requestForm.purchaseType === 'Obra' ? requestForm.clientName : 'Estoque central',
                purchaseLink: requestForm.purchaseLink,
                purchaseType: requestForm.purchaseType, 
                observation: requestForm.observation,
                date: requestForm.requestDate
            };
        }
        setConfirmRequest(requestToConfirm);
        setNextStatus(status);
        setIsConfirmStatusModalOpen(true);
    };

    const handleSaveRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestForm.itemName.trim()) return;

        // Block purchase order of "Fora de Linha" catalog items
        const targetProduct = items.find(i => String(i.name).toLowerCase() === String(requestForm.itemName).trim().toLowerCase());
        if (targetProduct && targetProduct.lineStatus === 'Fora de Linha') {
            alert("Este item está fora de linha e não permite a abertura de pedidos de compra!");
            return;
        }

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
            setRequestToEdit(null);
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
                invoiceNumber: nfForm.invoiceNumber || undefined,
                invoiceFileName: nfForm.invoiceFileName || undefined,
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
                lineStatus: productForm.lineStatus || 'Em linha',
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

    const filteredInventoryItems = useMemo(() => {
        if (!inventorySearchTerm) return items;
        const term = inventorySearchTerm.toLowerCase();
        return items.filter(i => 
            (i.name || '').toLowerCase().includes(term) || 
            (i.description || '').toLowerCase().includes(term)
        );
    }, [items, inventorySearchTerm]);

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

    const [isPrintPreviewOpen, setPrintPreviewOpen] = useState(false);

    // Efeito para injetar CSS de impressão
    useEffect(() => {
        if (!isPrintPreviewOpen) return;

        const style = document.createElement('style');
        style.id = 'print-overrides';
        style.textContent = `
            @media print {
                /* Reset de containers superiores */
                html, body {
                    height: auto !important;
                    overflow: visible !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }

                #root, main, .flex, .flex-col, .flex-1 {
                    height: auto !important;
                    overflow: visible !important;
                    display: block !important;
                    position: static !important;
                }

                /* Esconder tudo que não é essencial */
                nav, aside, header:not(#printable-area-shell header), 
                button, .no-print, .print\\:hidden,
                [class*="sidebar"], [class*="Sidebar"], [class*="Header"] {
                    display: none !important;
                }

                /* Forçar o modal a se tornar o layout principal */
                .fixed {
                    position: static !important;
                    display: block !important;
                    width: 100% !important;
                    background: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                }

                .max-w-5xl {
                    max-width: none !important;
                    width: 100% !important;
                }

                .shadow-2xl, .shadow-lg {
                    box-shadow: none !important;
                }

                /* Área de impressão */
                #printable-area-shell {
                    display: block !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    background: white !important;
                }

                /* Remover fundos de wrappers específicos */
                .bg-gray-200\\/50 {
                    background: white !important;
                    background-color: white !important;
                }

                /* REPETIÇÃO DE CABEÇALHO E RODAPÉ */
                thead {
                    display: table-header-group !important;
                }
                
                tfoot {
                    display: table-footer-group !important;
                }

                tr {
                    page-break-inside: avoid !important;
                    break-inside: avoid !important;
                }

                @page {
                    margin: 1.5cm 1cm;
                    size: Portrait;
                }

                /* Garantir que textos e bordas apareçam corretamente */
                .text-gray-900 { color: #000000 !important; }
                .text-gray-500 { color: #666666 !important; }
                .border-gray-900 { border-color: #000000 !important; }
                .bg-gray-100 { background-color: #f3f4f6 !important; }
            }
        `;
        document.head.appendChild(style);
        return () => {
            const el = document.getElementById('print-overrides');
            if (el) el.remove();
        };
    }, [isPrintPreviewOpen]);

    const handlePrintInventory = () => {
        setPrintPreviewOpen(true);
    };

    const triggerPrint = () => {
        window.focus();
        // Pequeno delay para garantir que o renderer do browser pegou os estilos injetados via useEffect
        setTimeout(() => {
            window.print();
        }, 500);
    };

    if (view === 'visao_geral') {
        const inventoryValue = items.reduce((acc, i) => acc + (i.quantity * (i.averagePrice || 0)), 0);
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="space-y-6 print:hidden">
                    <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div><h2 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque geral</h2><p className="text-xs text-gray-500 font-bold mt-1">Gestão de inventário e movimentações</p></div>
                    <div className="flex bg-white dark:bg-gray-800 p-1 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                        <button onClick={() => setActiveTab('inventario')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'inventario' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Inventário atual</button>
                        <button onClick={() => setActiveTab('historico')} className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === 'historico' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-600'}`}>Histórico de movimentação</button>
                    </div>
                </header>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <DashboardCard title="Itens no catálogo" value={items.length.toString()} icon={CubeIcon} color="bg-indigo-500" />
                    <DashboardCard title="Alertas de mínimo" value={items.filter(i => i.lineStatus !== 'Fora de Linha' && i.quantity <= i.minQuantity).length.toString()} icon={ExclamationTriangleIcon} color="bg-orange-500" />
                    <DashboardCard title="Valor total do estoque" value={formatCurrency(inventoryValue)} icon={DollarIcon} color="bg-green-600" />
                </div>

                {activeTab === 'inventario' ? (
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center gap-4">
                            <div className="relative flex-1">
                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar componente pelo nome..." 
                                    value={inventorySearchTerm} 
                                    onChange={(e) => setInventorySearchTerm(e.target.value)} 
                                    className="w-full pl-10 pr-4 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 border-none text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                                />
                            </div>
                            <button 
                                onClick={handlePrintInventory}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all shadow-md print:hidden"
                                title="Imprimir listagem para conferência"
                            >
                                <PrinterIcon className="w-4 h-4" />
                                <span className="hidden sm:inline">Imprimir Conferência</span>
                            </button>
                        </div>

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
                                    {filteredInventoryItems.length > 0 ? filteredInventoryItems.map(item => {
                                        const isDiscontinued = item.lineStatus === 'Fora de Linha';
                                        const isLowStock = !isDiscontinued && item.quantity <= item.minQuantity;
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
                                                <td className="px-4 py-3 text-center">
                                                    {isDiscontinued ? (
                                                        <span className="text-[9px] font-black text-slate-500 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full whitespace-nowrap">Fora de linha</span>
                                                    ) : isLowStock ? (
                                                        <span className="text-[9px] font-black text-rose-700 bg-rose-50 border border-rose-200 dark:bg-rose-955/30 dark:text-rose-400 dark:border-rose-900/50 px-2.5 py-1 rounded-full whitespace-nowrap animate-pulse">Reposição</span>
                                                    ) : (
                                                        <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 dark:bg-emerald-955/20 dark:text-emerald-400 dark:border-emerald-900/50 px-2.5 py-1 rounded-full whitespace-nowrap">Normal</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    }) : (
                                        <tr>
                                            <td colSpan={8} className="px-4 py-12 text-center text-gray-400 italic font-bold text-xs">
                                                Nenhum item encontrado com este nome.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
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

                                {showHistorySuggestions && (
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
                </div>

                {isPrintPreviewOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/90 backdrop-blur-sm p-4 md:p-8 print:p-0 print:bg-white print:backdrop-blur-none">
                        <div className="bg-white w-full max-w-5xl h-full rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 print:rounded-none print:shadow-none print:h-auto print:overflow-visible">
                            {/* Header do Modal */}
                            <div className="px-6 py-4 border-b flex justify-between items-center bg-gray-50 print:hidden">
                                <div>
                                    <h3 className="text-sm font-black text-gray-900 tracking-tight">Pré-visualização do Relatório</h3>
                                    <p className="text-[10px] text-gray-500 font-bold tracking-widest">Confira os dados antes de imprimir</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        onClick={() => setPrintPreviewOpen(false)}
                                        className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={triggerPrint}
                                        className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg text-xs font-black hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95 transition-all"
                                    >
                                        <PrinterIcon className="w-4 h-4" />
                                        Imprimir agora
                                    </button>
                                </div>
                            </div>

                            {/* Área de Visualização do Papel */}
                            <div className="flex-1 overflow-y-auto p-4 md:p-12 bg-gray-200/50 custom-scrollbar print:overflow-visible print:bg-white print:p-0 print:block">
                                <div className="bg-white w-full shadow-2xl mx-auto p-12 print:shadow-none print:p-0 print:m-0" id="printable-area-shell">
                                    <table className="w-full border-collapse">
                                        <thead className="repeat-header">
                                            {/* Cabeçalho do Relatório */}
                                            <tr>
                                                <th className="font-normal p-0 text-left border-none">
                                                    <div className="flex justify-between items-start border-b-4 border-gray-900 pb-6 mb-4">
                                                        <div>
                                                            <h1 className="text-3xl font-black tracking-tighter text-gray-900">Inventário de estoque</h1>
                                                            <p className="text-xs font-bold text-gray-500 mt-1 tracking-widest uppercase">Relatório para conferência física</p>
                                                            <p className="text-[10px] font-medium text-gray-400 mt-4 italic">Gerado por: {currentUser.name} em {new Date().toLocaleString('pt-BR')}</p>
                                                        </div>
                                                        <div className="text-right flex flex-col items-end">
                                                            {companyLogo ? (
                                                                <img src={companyLogo} alt="Logo" className="max-h-16 mb-2" />
                                                            ) : (
                                                                <>
                                                                    <p className="text-2xl font-black text-indigo-600 italic">Orner</p>
                                                                    <p className="text-[9px] font-black tracking-[0.2em] text-gray-400">Sistemas & Gestão</p>
                                                                </>
                                                            )}
                                                            <div className="mt-4 bg-gray-900 text-white px-3 py-1 text-[10px] font-black rounded italic">
                                                                Confidencial
                                                            </div>
                                                        </div>
                                                    </div>
                                                </th>
                                            </tr>
                                            {/* Cabeçalho da Tabela de Itens (Para repetir em todas as páginas) */}
                                            <tr className="bg-gray-100 border-y-2 border-gray-900 font-black tracking-wider text-gray-700 text-[10px]">
                                                <th className="px-3 py-3 text-left">Item / Componente</th>
                                                <th className="px-1 py-3 text-center">Un</th>
                                                <th className="px-1 py-3 text-center">Mín</th>
                                                <th className="px-1 py-3 text-center">Res</th>
                                                <th className="px-1 py-3 text-center whitespace-nowrap">Sist.</th>
                                                <th className="px-4 py-3 text-center text-indigo-700 bg-indigo-50/50 border-x border-gray-200 whitespace-nowrap">Saldo físico</th>
                                                <th className="px-2 py-3 text-center">Status</th>
                                                <th className="px-3 py-3 text-left italic text-gray-400">Notas</th>
                                            </tr>
                                        </thead>
                                        
                                        <tbody className="table-row-group">
                                            {filteredInventoryItems.map(item => {
                                                const isDiscontinued = item.lineStatus === 'Fora de Linha';
                                                const isLowStock = !isDiscontinued && item.quantity <= item.minQuantity;
                                                return (
                                                    <tr key={item.id} className="border-b border-gray-100 break-inside-avoid text-[10px]">
                                                        <td className="px-3 py-3 font-bold text-gray-900">
                                                            {item.name}
                                                            {item.description && <p className="text-[8px] font-normal text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>}
                                                        </td>
                                                        <td className="px-1 py-3 text-center font-medium text-gray-500 uppercase">{item.unit || 'UN'}</td>
                                                        <td className="px-1 py-3 text-center font-bold text-orange-600">{item.minQuantity}</td>
                                                        <td className="px-1 py-3 text-center font-bold text-amber-600">{item.reservedQuantity || 0}</td>
                                                        <td className="px-1 py-3 text-center font-black text-gray-900">{item.quantity}</td>
                                                        <td className="px-4 py-3 text-center border-x border-gray-100">
                                                            <div className="w-full h-6 border-b-2 border-gray-200 mx-auto"></div>
                                                        </td>
                                                        <td className="px-2 py-3 text-center">
                                                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${isDiscontinued ? 'bg-slate-100 text-slate-500 border-slate-200' : isLowStock ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                                                                {isDiscontinued ? 'Fora de linha' : isLowStock ? 'Repor' : 'Ok'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-3">
                                                            <div className="w-full h-6 border-b border-dashed border-gray-100"></div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>

                                        <tfoot className="repeat-footer">
                                            <tr>
                                                <td className="p-0">
                                                    <div className="mt-8 grid grid-cols-2 gap-20">
                                                        <div className="text-center">
                                                            <div className="border-b-2 border-gray-400 w-full mb-2"></div>
                                                            <p className="text-[8px] font-black text-gray-400 tracking-widest">Responsável pela conferência</p>
                                                        </div>
                                                        <div className="text-center">
                                                            <div className="border-b-2 border-gray-400 w-full mb-2"></div>
                                                            <p className="text-[8px] font-black text-gray-400 tracking-widest">Data e assinatura supervisor</p>
                                                        </div>
                                                    </div>
                                                    <footer className="mt-12 pt-4 border-t border-gray-100 flex justify-between items-center opacity-30 italic">
                                                        <p className="text-[8px] font-bold text-gray-400">© {new Date().getFullYear()} Orner Sistemas - Todos os direitos reservados.</p>
                                                        <p className="text-[8px] font-bold text-gray-400">Este documento é para fins de controle interno.</p>
                                                    </footer>
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
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
                                setProductForm({ name: '', ncm: '', quantity: 0, minQuantity: 1, unit: 'un', description: '', image: '', averagePrice: 0, isFixedInBudget: true, lineStatus: 'Em linha' });
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
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-bold text-[13px] text-gray-800 dark:text-white leading-tight">{item.name}</p>
                                                {item.lineStatus === 'Fora de Linha' ? (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 tracking-wide uppercase">Fora de Linha</span>
                                                ) : (
                                                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 tracking-wide uppercase">Em linha</span>
                                                )}
                                            </div>
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
                                                                    isFixedInBudget: !!item.isFixedInBudget,
                                                                    lineStatus: item.lineStatus || 'Em linha'
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
                        maxWidth="max-w-2xl"
                    >
                        <form onSubmit={handleSaveProduct} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                                <div className="md:col-span-4 flex flex-col items-center justify-start border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-700/50 pb-5 md:pb-0 md:pr-5">
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1">Foto do produto</label>
                                    <div className="relative group w-36 h-36 mt-1">
                                        <div className="w-full h-full rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-800/40 flex flex-col items-center justify-center overflow-hidden transition-all group-hover:bg-gray-50 dark:group-hover:bg-gray-800/60 group-hover:border-indigo-300">
                                            {productForm.image ? (
                                                <img src={productForm.image} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <div className="text-center p-3">
                                                    <PhotographIcon className="w-8 h-8 text-gray-300 mx-auto" />
                                                    <span className="text-[10px] font-bold text-gray-400 mt-1 block">Logomarca / Foto</span>
                                                </div>
                                            )}
                                        </div>
                                        <label className="absolute inset-0 flex items-center justify-center bg-black/40 transition-all cursor-pointer rounded-2xl opacity-0 group-hover:opacity-100">
                                            <div className="p-2 bg-white rounded-full shadow-lg text-indigo-600 transform scale-90 group-hover:scale-100 transition-transform">
                                                <UploadIcon className="w-4 h-4" />
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleProductPhotoUpload} />
                                        </label>
                                    </div>
                                    {productForm.image && (
                                        <button 
                                            type="button" 
                                            onClick={() => setProductForm(p => ({ ...p, image: '' }))}
                                            className="mt-2 text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline transition-colors block"
                                        >
                                            Remover foto
                                        </button>
                                    )}
                                </div>

                                <div className="md:col-span-8 space-y-3.5">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Descrição do produto (Nome comercial)</label>
                                        <input 
                                            required 
                                            type="text" 
                                            value={productForm.name} 
                                            onChange={e => setProductForm({...productForm, name: e.target.value})} 
                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400" 
                                            placeholder="Ex: Disjuntor bipolar 20a curva c - schneider" 
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">NCM (Classificação fiscal)</label>
                                            <input 
                                                type="text" 
                                                value={productForm.ncm} 
                                                onChange={e => setProductForm({...productForm, ncm: e.target.value})} 
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400" 
                                                placeholder="Ex: 8536.20.00" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Unidade de medida</label>
                                            <select 
                                                value={productForm.unit} 
                                                onChange={e => setProductForm({...productForm, unit: e.target.value})} 
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 cursor-pointer"
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Saldo inicial</label>
                                            <input 
                                                required 
                                                type="number" 
                                                min="0"
                                                value={productForm.quantity} 
                                                onChange={e => setProductForm({...productForm, quantity: parseInt(e.target.value) || 0})} 
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Saldo mínimo</label>
                                            <input 
                                                required 
                                                type="number" 
                                                min="0"
                                                value={productForm.minQuantity} 
                                                onChange={e => setProductForm({...productForm, minQuantity: parseInt(e.target.value) || 0})} 
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-orange-600 dark:text-orange-400 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5" 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Custo inicial (R$)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={productForm.averagePrice || ''} 
                                                onChange={e => setProductForm({...productForm, averagePrice: parseFloat(e.target.value) || 0})} 
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5" 
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Status de linha (Disponibilidade)</label>
                                            <select 
                                                value={productForm.lineStatus} 
                                                onChange={e => setProductForm({...productForm, lineStatus: e.target.value as 'Em linha' | 'Fora de Linha'})} 
                                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 cursor-pointer"
                                            >
                                                <option value="Em linha">🟢 Em linha</option>
                                                <option value="Fora de Linha">🔴 Fora de Linha (Descontinuado)</option>
                                            </select>
                                        </div>

                                        <div className="flex items-end">
                                            <label className="w-full flex items-center gap-2.5 p-2 bg-slate-50/50 dark:bg-gray-850/30 rounded-xl border border-gray-150 dark:border-gray-750 cursor-pointer hover:bg-white dark:hover:bg-gray-800/50 hover:shadow-sm transition-all h-[36px]">
                                                <input 
                                                    type="checkbox" 
                                                    checked={productForm.isFixedInBudget} 
                                                    onChange={e => setProductForm({...productForm, isFixedInBudget: e.target.checked})} 
                                                    className="w-4 h-4 rounded text-indigo-600 border-gray-200 dark:border-gray-700 focus:ring-indigo-500/40" 
                                                />
                                                <div>
                                                    <p className="text-[10px] font-bold text-gray-700 dark:text-gray-200 tracking-tight leading-tight">Exibir fixo no orçamento</p>
                                                    <p className="text-[9px] text-gray-400 font-medium leading-none mt-0.5">Inserir automático na listagem</p>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Observações / especificações técnicas</label>
                                <textarea 
                                    rows={2} 
                                    value={productForm.description} 
                                    onChange={e => setProductForm({...productForm, description: e.target.value})} 
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-medium shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 resize-none" 
                                    placeholder="Detalhes sobre fabricante, série, aplicações recomendadas, etc." 
                                />
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-750">
                                <button 
                                    type="button" 
                                    onClick={() => setIsProductModalOpen(false)} 
                                    className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs transition-all border border-gray-200 dark:border-gray-700"
                                >
                                    Cancelar
                                </button>
                                <button 
                                    type="submit" 
                                    disabled={isSaving}
                                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-50"
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
                                            {req.invoiceFile && (
                                                <button 
                                                    onClick={() => {
                                                        setHdInvoiceFile(req.invoiceFile || null);
                                                        setHdInvoiceFileName(req.invoiceFileName || 'nota_fiscal');
                                                    }} 
                                                    className="p-1.5 text-indigo-500 hover:text-indigo-600 transition-colors" 
                                                    title="Visualizar anexo da NF"
                                                >
                                                    <EyeIcon className="w-5 h-5"/>
                                                </button>
                                            )}
                                            
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
                <Modal title={requestToEdit ? "Gerenciar pedido de compra" : "Novo pedido de compra"} onClose={() => { setIsRequestModalOpen(false); setRequestToEdit(null); }} maxWidth="max-w-xl">
                    <form onSubmit={handleSaveRequest} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Tipo de solicitação</label>
                                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-55/60 dark:bg-gray-800/40 rounded-xl border border-gray-150 dark:border-gray-750">
                                    <button 
                                        type="button" 
                                        disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')}
                                        onClick={() => {
                                            setRequestForm({...requestForm, purchaseType: 'Reposição'});
                                            setIsManualItem(false);
                                        }} 
                                        className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${requestForm.purchaseType === 'Reposição' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-150 dark:border-gray-700' : 'text-gray-400 hover:text-gray-500'} ${!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado') ? 'cursor-not-allowed opacity-80' : ''}`}
                                    >
                                        <CubeIcon className="w-3.5 h-3.5" /> Reposição
                                    </button>
                                    <button 
                                        type="button" 
                                        disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')}
                                        onClick={() => setRequestForm({...requestForm, purchaseType: 'Obra'})} 
                                        className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-lg transition-all ${requestForm.purchaseType === 'Obra' ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-sm border border-gray-150 dark:border-gray-700' : 'text-gray-400 hover:text-gray-500'} ${!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado') ? 'cursor-not-allowed opacity-80' : ''}`}
                                    >
                                        <TruckIcon className="w-3.5 h-3.5" /> Compra obra
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Data da solicitação</label>
                                <div className="relative">
                                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="date" disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} value={requestForm.requestDate} onChange={e => setRequestForm({...requestForm, requestDate: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 pl-10 pr-4 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 disabled:opacity-60 disabled:bg-gray-50" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 p-4 bg-slate-50/50 dark:bg-gray-800/20 rounded-2xl border border-gray-150 dark:border-gray-750">
                            {(!requestToEdit && requestForm.purchaseType === 'Obra') ? (
                                <div className="flex bg-gray-100/60 dark:bg-gray-800/40 p-1 rounded-xl border border-gray-200/55 dark:border-gray-700/50 mb-2">
                                    <button type="button" onClick={() => setIsManualItem(false)} className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${!isManualItem ? 'bg-white dark:bg-gray-750 text-indigo-600 shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-500'}`}>
                                        Catálogo Orner
                                    </button>
                                    <button type="button" onClick={() => setIsManualItem(true)} className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${isManualItem ? 'bg-white dark:bg-gray-750 text-indigo-600 shadow-sm border border-gray-200/50' : 'text-gray-400 hover:text-gray-500'}`}>
                                        Avulso
                                    </button>
                                </div>
                            ) : (
                                <div className="mb-2 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-indigo-600 tracking-tight px-1">
                                        {isManualItem ? 'Item avulso (Fora do estoque)' : 'Catálogo Orner'}
                                    </span>
                                    {requestToEdit && (
                                        <div className="flex gap-2">
                                            {(!requestToEdit || (requestToEdit.status !== 'Concluído' && requestToEdit.status !== 'Cancelado')) && (
                                                <button type="button" onClick={() => setIsManualItem(!isManualItem)} className="text-[9px] font-bold text-indigo-500 hover:underline">
                                                    Alterar p/ {isManualItem ? 'Catálogo' : 'Avulso'}
                                                </button>
                                            )}
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black ${getStatusInfo(requestToEdit.status).color}`}>
                                                Status: {getStatusInfo(requestToEdit.status).label}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <div className="space-y-3">
                                <div className="animate-fade-in">
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">{isManualItem ? 'Descrição do item' : 'Selecionar do catálogo'}</label>
                                    {isManualItem ? (
                                        <input required disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} autoFocus placeholder="Nome do componente ou material..." value={requestForm.itemName} onChange={e => setRequestForm({...requestForm, itemName: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400 disabled:opacity-60 disabled:bg-gray-50" />
                                    ) : (
                                        <select required disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} value={requestForm.itemName} onChange={e => { const p = items.find(i => i.name === e.target.value); setRequestForm({...requestForm, itemName: e.target.value, unit: p?.unit || 'un'}); }} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 cursor-pointer disabled:opacity-60 disabled:bg-gray-50">
                                            <option value="">Escolher material cadastrado...</option>
                                            {items.filter(item => item.lineStatus !== 'Fora de Linha').map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                                        </select>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Quantidade solicitada</label>
                                        <div className="flex gap-2">
                                            <input type="number" disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} required min="1" value={requestForm.quantity} onChange={e => setRequestForm({...requestForm, quantity: parseFloat(e.target.value) || 0})} className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold text-center shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 disabled:opacity-60 disabled:bg-gray-50" />
                                            <select 
                                                disabled={(!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')) || !isManualItem} 
                                                required 
                                                value={requestForm.unit} 
                                                onChange={e => setRequestForm({...requestForm, unit: e.target.value})} 
                                                className="w-20 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 p-2 text-xs font-bold text-center outline-none shadow-sm cursor-pointer hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 disabled:opacity-60 disabled:bg-gray-50 disabled:cursor-not-allowed"
                                            >
                                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Prioridade / urgência</label>
                                        <div className="flex gap-1.5 h-[34px]">
                                            {(['Baixa', 'Média', 'Alta'] as const).map(p => {
                                                const isSelected = requestForm.priority === p;
                                                let activeBgStyle = "";
                                                if (isSelected) {
                                                    if (p === 'Alta') activeBgStyle = 'bg-rose-500 border-rose-500 text-white shadow-sm';
                                                    else if (p === 'Média') activeBgStyle = 'bg-amber-500 border-amber-500 text-white shadow-sm';
                                                    else activeBgStyle = 'bg-emerald-600 border-emerald-600 text-white shadow-sm';
                                                } else {
                                                    activeBgStyle = 'bg-white dark:bg-gray-800 text-gray-40 hover:text-gray-600 dark:hover:text-gray-200 text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300';
                                                }
                                                return (
                                                    <button 
                                                        key={p} 
                                                        type="button" 
                                                        disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} 
                                                        onClick={() => setRequestForm({...requestForm, priority: p})} 
                                                        className={`flex-1 py-1 text-[11px] font-bold rounded-lg border transition-all ${activeBgStyle} ${requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado') ? 'cursor-not-allowed opacity-60' : ''}`}
                                                    >
                                                        {p}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {requestForm.purchaseType === 'Obra' && (
                                <div className="animate-fade-in">
                                    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Identificação da obra / cliente</label>
                                    <input 
                                        required 
                                        disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')}
                                        type="text" 
                                        list="approved-clients-list"
                                        placeholder="Digite o nome ou escolha um cliente aprovado..." 
                                        value={requestForm.clientName} 
                                        onChange={e => setRequestForm({...requestForm, clientName: e.target.value})} 
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400 disabled:opacity-60 disabled:bg-gray-50" 
                                    />
                                    <datalist id="approved-clients-list">
                                        {approvedClients.map(client => (
                                            <option key={client} value={client} />
                                        ))}
                                    </datalist>
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Link de compra / referência (opcional)</label>
                                <div className="relative">
                                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                    <input type="url" disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} placeholder="Cole o link do produto aqui..." value={requestForm.purchaseLink} onChange={e => setRequestForm({...requestForm, purchaseLink: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800/80 pl-10 pr-4 py-2 text-xs font-medium shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400 disabled:opacity-60 disabled:bg-gray-50" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">Observações adicionais</label>
                                <textarea rows={2} disabled={!!requestToEdit && (requestToEdit.status === 'Concluído' || requestToEdit.status === 'Cancelado')} placeholder="Detalhes como marca, cor, urgência ou motivo..." value={requestForm.observation} onChange={e => setRequestForm({...requestForm, observation: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-medium shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 resize-none min-h-[50px] leading-relaxed disabled:opacity-60 disabled:bg-gray-50" />
                            </div>

                            {requestToEdit && (requestToEdit.invoiceFile || requestToEdit.invoiceKey || requestToEdit.invoiceNumber) && (
                                <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100/80 dark:border-indigo-800/40 shadow-sm animate-fade-in text-left">
                                    <div className="flex items-center gap-2 mb-3">
                                        <DocumentReportIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        <h4 className="text-xs font-extrabold text-gray-900 dark:text-white uppercase tracking-wider">Dados da Nota Fiscal (NF-e)</h4>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-3">
                                        {requestToEdit.invoiceNumber && (
                                            <div>
                                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Número da Nota Fiscal</span>
                                                <span className="font-extrabold text-gray-850 dark:text-gray-200">{requestToEdit.invoiceNumber}</span>
                                            </div>
                                        )}
                                        {requestToEdit.invoiceKey && (
                                            <div className="sm:col-span-2">
                                                <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Chave de Acesso</span>
                                                <span className="font-mono text-[10.5px] font-bold text-gray-700 dark:text-gray-300 break-all">{requestToEdit.invoiceKey.replace(/(.{4})/g, '$1 ')}</span>
                                            </div>
                                        )}
                                    </div>

                                    {requestToEdit.invoiceFile && (
                                        <div className="pt-3 border-t border-indigo-100/50 dark:border-indigo-800/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                                            <div className="flex items-center gap-2.5 self-start sm:self-auto">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-100/70 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-650 dark:text-indigo-400 font-extrabold shadow-inner shrink-0">
                                                    {(requestToEdit.invoiceFile.startsWith('data:application/pdf') || requestToEdit.invoiceFileName?.toLowerCase().endsWith('.pdf')) ? 'PDF' : 'IMG'}
                                                </div>
                                                <div className="text-left min-w-0">
                                                    <span className="block text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">Arquivo Anexado</span>
                                                    <span className="block text-xs font-bold text-gray-750 dark:text-gray-350 truncate max-w-[200px]" title={requestToEdit.invoiceFileName || 'nota_fiscal'}>
                                                        {requestToEdit.invoiceFileName || 'Nota Fiscal Digital'}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="flex gap-2 w-full sm:w-auto">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setHdInvoiceFile(requestToEdit.invoiceFile || null);
                                                        setHdInvoiceFileName(requestToEdit.invoiceFileName || 'nota_fiscal');
                                                    }}
                                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md hover:shadow-indigo-600/10 transition-all cursor-pointer"
                                                >
                                                    <EyeIcon className="w-4 h-4" /> Visualizar
                                                </button>
                                                <a
                                                    href={requestToEdit.invoiceFile}
                                                    download={requestToEdit.invoiceFileName || 'nota_fiscal.pdf'}
                                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md hover:shadow-emerald-600/10 transition-all"
                                                >
                                                    <ArrowDownIcon className="w-4 h-4" /> Baixar
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-750">
                            {requestToEdit ? (
                                <>
                                    {requestToEdit.status === 'Aberto' ? (
                                        <>
                                            {isAdmin && <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Cancelado')} className="flex-1 py-2 bg-rose-50 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-100 transition-colors border border-rose-100">Cancelar solicitação</button>}
                                            <button type="submit" disabled={isSaving} className="flex-1 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-indigo-600/10 transition-all">Salvar alterações</button>
                                            {isAdmin && (
                                                <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Aprovado')} className="flex-[1.2] py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/10 hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5">
                                                    <CheckCircleIcon className="w-4 h-4" /> Aprovar
                                                </button>
                                            )}
                                        </>
                                    ) : requestToEdit.status === 'Aprovado' ? (
                                        <>
                                            <button type="submit" disabled={isSaving} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-750 transition-all">Salvar alterações</button>
                                            {isAdmin && (
                                                <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Comprado')} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5">
                                                    <ShoppingCartIcon className="w-4 h-4" /> Registrar compra
                                                </button>
                                            )}
                                        </>
                                    ) : requestToEdit.status === 'Comprado' ? (
                                        <>
                                            <button type="submit" disabled={isSaving} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-700 transition-all">Salvar alterações</button>
                                            {isAdmin && (
                                                <button type="button" onClick={() => triggerStatusConfirmation(requestToEdit, 'Em trânsito')} className="flex-1 py-2 bg-purple-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-purple-700 transition-all flex items-center justify-center gap-1.5">
                                                    <TruckIcon className="w-4 h-4" /> Em trânsito
                                                </button>
                                            )}
                                        </>
                                    ) : requestToEdit.status === 'Em trânsito' ? (
                                        <>
                                            <button type="submit" disabled={isSaving} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-indigo-705 transition-all">Salvar alterações</button>
                                            {isAdmin && (
                                                <button type="button" onClick={() => {
                                                    const updatedReq = {
                                                        ...requestToEdit,
                                                        itemName: requestForm.itemName,
                                                        quantity: Number(requestForm.quantity),
                                                        unit: requestForm.unit,
                                                        priority: requestForm.priority,
                                                        clientName: requestForm.purchaseType === 'Obra' ? requestForm.clientName : 'Estoque central',
                                                        purchaseLink: requestForm.purchaseLink,
                                                        purchaseType: requestForm.purchaseType, 
                                                        observation: requestForm.observation,
                                                        date: requestForm.requestDate
                                                    };
                                                    setRequestToEdit(updatedReq);
                                                    setIsRequestModalOpen(false);
                                                    setIsNFModalOpen(true);
                                                    setNfForm({ invoiceNumber: '', invoiceKey: '', totalValue: 0, invoiceFile: '', invoiceFileName: '' });
                                                }} className="flex-1 py-2 bg-green-600 text-white rounded-xl font-bold text-xs shadow-md hover:bg-green-700 transition-all flex items-center justify-center gap-1.5">
                                                    <UploadIcon className="w-4 h-4" /> Lançar NF
                                                </button>
                                            )}
                                        </>
                                    ) : (
                                        <button type="button" onClick={() => { setIsRequestModalOpen(false); setRequestToEdit(null); }} className="flex-1 py-2 bg-gray-50 text-gray-500 hover:bg-gray-100 rounded-xl font-bold text-xs transition-colors border border-gray-200">Fechar</button>
                                    )}
                                </>
                            ) : (
                                <>
                                    <button type="button" onClick={() => setIsRequestModalOpen(false)} className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs transition-all border border-gray-250 dark:border-gray-700">Cancelar</button>
                                    <button type="submit" disabled={isSaving} className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-50">
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

            {hdInvoiceFile && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => { setHdInvoiceFile(null); setHdInvoiceFileName(null); }}>
                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
                        <button className="absolute top-0 right-0 p-3 text-white hover:text-indigo-400 z-[110]" onClick={(e) => { e.stopPropagation(); setHdInvoiceFile(null); setHdInvoiceFileName(null); }}><XCircleIcon className="w-10 h-10" /></button>
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
                            {hdInvoiceFile.startsWith('data:application/pdf') || hdInvoiceFileName?.toLowerCase().endsWith('.pdf') ? (
                                <div className="bg-gray-900/95 border border-gray-800 p-8 rounded-3xl max-w-lg w-full text-center space-y-6 shadow-2xl animate-zoom-in" onClick={(e) => e.stopPropagation()}>
                                    <div className="mx-auto w-20 h-20 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 shadow-inner border border-indigo-500/20">
                                        <DocumentReportIcon className="w-12 h-12" />
                                    </div>
                                    <div className="space-y-2">
                                        <h3 className="text-lg font-black text-white tracking-tight">Documento PDF Anexado</h3>
                                        <p className="text-xs text-indigo-300 font-mono bg-indigo-950/40 py-1.5 px-3 rounded-lg inline-block max-w-full truncate">{hdInvoiceFileName || 'nota_fiscal.pdf'}</p>
                                    </div>
                                    <p className="text-xs text-gray-400 leading-relaxed max-w-sm mx-auto">
                                        Para garantir sua privacidade e compatibilidade total, o navegador restringe a exibição direta de PDFs embutidos em visualizações integradas. Abra em uma nova guia ou faça o download seguro abaixo.
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                                        <a 
                                            href={previewUrl || hdInvoiceFile} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs tracking-tight transition-all shadow-lg shadow-indigo-600/15 active:scale-[0.98]"
                                        >
                                            <EyeIcon className="w-4 h-4" /> Abrir em Nova Guia
                                        </a>
                                        <a 
                                            href={previewUrl || hdInvoiceFile} 
                                            download={hdInvoiceFileName || 'nota-fiscal.pdf'}
                                            className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs tracking-tight transition-all shadow-lg shadow-emerald-600/15 active:scale-[0.98]"
                                        >
                                            <ArrowDownIcon className="w-4 h-4" /> Baixar Arquivo
                                        </a>
                                    </div>
                                </div>
                            ) : (
                                <img src={previewUrl || hdInvoiceFile} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in" alt="Nota Fiscal" />
                            )}
                        </div>
                        {!hdInvoiceFileName?.toLowerCase().endsWith('.pdf') && !hdInvoiceFile.startsWith('data:application/pdf') && (
                            <div className="flex gap-4">
                                <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = previewUrl || hdInvoiceFile; a.download = hdInvoiceFileName || 'nota-fiscal.pdf'; a.click(); }} className="px-8 py-2.5 bg-indigo-600 text-white rounded-full font-black text-xs tracking-tight shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><ArrowDownIcon className="w-4 h-4" /> Baixar Documento Anexo</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default EstoquePage;
