
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    SparklesIcon, PlusIcon, TrashIcon, EditIcon, 
    CalendarIcon, MapIcon, BoltIcon, CheckCircleIcon, 
    XCircleIcon, SearchIcon, ClockIcon, DollarIcon,
    ChevronDownIcon, HomeIcon, MapPinIcon, UsersIcon, ClipboardListIcon,
    ExclamationTriangleIcon, FilterIcon, ArrowLeftIcon, TrendUpIcon, StarIcon,
    DocumentReportIcon, PhoneIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { dataService } from '../services/dataService';
import type { User, LavagemPackage, LavagemClient, LavagemRecord, FinancialCategory, LavagemContract } from '../types';

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">{children}</label>
);

const SectionHeader: React.FC<{ icon: React.ReactElement<any>; title: string; color?: string; rightElement?: React.ReactNode }> = ({ icon, title, color = "bg-indigo-600", rightElement }) => {
    const isHex = color.startsWith('#');
    return (
        <div className="flex items-center justify-between mb-3 pb-1 border-b border-gray-100 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
                <div 
                    className={`p-1 rounded-lg text-white ${!isHex ? color : ''}`}
                    style={isHex ? { backgroundColor: color } : {}}
                >
                    {React.cloneElement(icon, { className: "w-3.5 h-3.5" })}
                </div>
                <h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 tracking-wider">{title}</h4>
            </div>
            {rightElement && <div>{rightElement}</div>}
        </div>
    );
};

const PRESET_COLORS = [
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Esmeralda', hex: '#10b981' },
    { name: 'Âmbar', hex: '#f59e0b' },
    { name: 'Rosa', hex: '#f43f5e' },
    { name: 'Céu', hex: '#0ea5e9' },
    { name: 'Violeta', hex: '#8b5cf6' },
    { name: 'Laranja', hex: '#f97316' },
    { name: 'Ouro', hex: '#d4af37' }
];

type PendingAction = {
    type: 'execute' | 'delete' | 'update';
    record: LavagemRecord;
    payload?: {
        date: string;
        status: 'scheduled' | 'executed' | 'cancelled';
    };
};

type Frequency = 'trimestral' | 'semestral' | 'anual' | 'manual';

const LavagemPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [packages, setPackages] = useState<LavagemPackage[]>([]);
    const [clients, setClients] = useState<LavagemClient[]>([]);
    const [records, setRecords] = useState<LavagemRecord[]>([]);
    const [contracts, setContracts] = useState<LavagemContract[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingCep, setIsLoadingCep] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [activeTab, setActiveTab] = useState<'timeline' | 'oportunidades'>('timeline');
    const [filterPackageId, setFilterPackageId] = useState('Todos');
    const [filterStatus, setFilterStatus] = useState('Todos');
    const [usePeriodFilter, setUsePeriodFilter] = useState(false);
    const [periodStart, setPeriodStart] = useState(new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]); 
    const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().split('T')[0]);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
    const [isWashModalOpen, setIsWashModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [isLaunchServiceModalOpen, setIsLaunchServiceModalOpen] = useState(false);
    const [isEditWashDateModalOpen, setIsEditWashDateModalOpen] = useState(false);
    const [isConfirmActionModalOpen, setIsConfirmActionModalOpen] = useState(false);
    const [isContractDetailModalOpen, setIsContractDetailModalOpen] = useState(false);

    const [editingClient, setEditingClient] = useState<LavagemClient | null>(null);
    const [editingPackage, setEditingPackage] = useState<LavagemPackage | null>(null);
    const [selectedClient, setSelectedClient] = useState<LavagemClient | null>(null);
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
    const [isClientLocked, setIsClientLocked] = useState(false);

    const [clientForm, setClientForm] = useState<Partial<LavagemClient>>({
        name: '', phone: '', cep: '', address: '', address_number: '', complement: '', city: '', plates_count: 0, installation_end_date: '', observations: ''
    });
    const [packageForm, setPackageForm] = useState({
        name: '', color: PRESET_COLORS[0].hex, wash_qty: 4, price_per_plate: 0
    });
    const [scheduleDates, setScheduleDates] = useState<string[]>([]);
    const [frequency, setFrequency] = useState<Frequency>('semestral');
    const [launchServiceForm, setLaunchServiceForm] = useState({ 
        clientId: '', 
        packageId: '',
        installationEndDate: new Date().toISOString().split('T')[0],
        travelCost: 0
    });
    const [editWashValue, setEditWashValue] = useState<{ date: string, status: 'scheduled' | 'executed' | 'cancelled' }>({ date: '', status: 'scheduled' });

    const lastFetchedCep = useRef('');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const isAdmin = String(currentUser.profileId) === '001';
            const [pkgData, cliData, recData, contractData] = await Promise.all([
                dataService.getAll<LavagemPackage>('lavagem_packages', currentUser.id, isAdmin),
                dataService.getAll<LavagemClient>('lavagem_clients', currentUser.id, isAdmin),
                dataService.getAll<LavagemRecord>('lavagem_records', currentUser.id, isAdmin),
                dataService.getAll<LavagemContract>('lavagem_contracts', undefined, true) 
            ]);
            setPackages(pkgData.sort((a, b) => (a.wash_qty - b.wash_qty) || a.name.localeCompare(b.name)));
            setClients(cliData.sort((a,b) => a.name.localeCompare(b.name)));
            setRecords(recData);
            setContracts(contractData || []);
        } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };

    useEffect(() => { loadData(); }, [currentUser.id]);

    useEffect(() => {
        const cleanCep = (clientForm.cep || '').replace(/\D/g, '');
        if (cleanCep.length === 8 && isClientModalOpen && cleanCep !== lastFetchedCep.current) {
            const fetchCep = async () => {
                setIsLoadingCep(true);
                try {
                    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
                    const data = await response.json();
                    if (!data.erro) {
                        lastFetchedCep.current = cleanCep;
                        setClientForm(prev => ({ 
                            ...prev, 
                            address: data.logradouro || prev.address, 
                            city: data.localidade || prev.city 
                        }));
                    }
                } catch (e) { console.error(e); } finally { setIsLoadingCep(false); }
            };
            fetchCep();
        }
    }, [clientForm.cep, isClientModalOpen]);

    const getClientPackageInfo = (client: LavagemClient) => {
        const pkg = packages.find(p => p.id === client.package_id);
        const clientRecords = records.filter(r => r.client_id === client.id);
        const launchDate = client.package_launch_date || '1970-01-01';
        const currentCycleRecords = clientRecords.filter(r => (r.created_at || r.date) >= launchDate);
        const executedCount = currentCycleRecords.filter(r => r.status === 'executed').length;
        const washQtyLimit = client.contract_wash_qty || pkg?.wash_qty || 0;
        const pricePerPlate = client.contract_price_per_plate || pkg?.price_per_plate || 0;
        const allScheduled = currentCycleRecords.filter(r => r.status === 'scheduled').sort((a, b) => a.date.localeCompare(b.date));
        const nextScheduled = allScheduled[0];
        const pendingToScheduleCount = Math.max(0, washQtyLimit - executedCount - allScheduled.length);
        
        const subtotalPlacas = pricePerPlate * (client.plates_count || 0);
        const contractTotalValue = (subtotalPlacas * washQtyLimit) + (client.travel_cost || 0);

        const clientContracts = contracts
            .filter(c => c.client_id === client.id)
            .sort((a, b) => b.created_at.localeCompare(a.created_at));

        const totalAccumulated = clientContracts.reduce((acc, c) => acc + Number(c.total_value), 0);

        const lastExecutedWash = clientRecords
            .filter(r => r.status === 'executed')
            .sort((a, b) => b.date.localeCompare(a.date))[0];
        
        const lastEventDate = lastExecutedWash?.date || client.installation_end_date;
        let isHighOpportunity = false;
        
        if (lastEventDate) {
            const dateObj = new Date(lastEventDate);
            const today = new Date();
            const diffTime = Math.abs(today.getTime() - dateObj.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            isHighOpportunity = diffDays >= 330;
        }

        return { 
            pkg, 
            executedCount, 
            washQtyLimit, 
            nextScheduled, 
            allScheduled, 
            currentCycleRecords, 
            pendingToScheduleCount, 
            contractTotalValue, 
            pricePerPlate,
            totalAccumulated,
            clientContracts,
            travelCost: client.travel_cost || 0,
            isHighOpportunity
        };
    };

    const visibleClientsWithInfo = useMemo(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        
        return clients.map(client => ({
            client,
            info: getClientPackageInfo(client)
        })).filter(({ client, info }) => {
            if (activeTab === 'oportunidades' && client.package_id) return false;
            if (activeTab === 'timeline' && !client.package_id) return false;
            if (searchTerm && !client.name.toLowerCase().includes(searchTerm.toLowerCase()) && !(client.city || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;

            if (activeTab === 'timeline') {
                const isFinished = info.executedCount >= info.washQtyLimit && info.washQtyLimit > 0;
                const hasOverdue = info.allScheduled.some(r => r.date < todayStr);

                if (filterStatus !== 'Todos') {
                    if (filterStatus === 'Atrasados' && !hasOverdue) return false;
                    if (filterStatus === 'Ciclo Finalizado' && !isFinished) return false;
                    if (filterStatus === 'Com agendamentos' && info.allScheduled.length === 0) return false;
                    if (filterStatus === 'Sem Agendamento' && info.pendingToScheduleCount === 0) return false;
                }

                if (usePeriodFilter) {
                    const scheduledInPeriod = info.allScheduled.some(r => r.date >= periodStart && r.date <= periodEnd);
                    const executedInPeriod = info.currentCycleRecords.some(r => r.status === 'executed' && r.date >= periodStart && r.date <= periodEnd);
                    const launchInPeriod = client.package_launch_date && client.package_launch_date.split('T')[0] >= periodStart && client.package_launch_date.split('T')[0] <= periodEnd;
                    if (!scheduledInPeriod && !executedInPeriod && !launchInPeriod) return false;
                }
            }

            if (activeTab === 'oportunidades') {
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
                const isHot = client.installation_end_date && client.installation_end_date <= oneYearAgoStr;
                if (filterStatus === 'Oportunidade 1 Ano' && !isHot) return false;
            }
            return true;
        }).sort((a, b) => {
            // Ordenação para a aba de oportunidades: Instalações mais antigas primeiro
            if (activeTab === 'oportunidades') {
                const dateA = a.client.installation_end_date || '9999-12-31';
                const dateB = b.client.installation_end_date || '9999-12-31';
                return dateA.localeCompare(dateB);
            }
            return 0;
        });
    }, [clients, packages, records, contracts, activeTab, searchTerm, filterStatus, usePeriodFilter, periodStart, periodEnd]);

    const totalArrecadado = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const visibleClientIds = new Set(visibleClientsWithInfo.map(item => item.client.id));
        return contracts.reduce((sum, contract) => {
            if (!visibleClientIds.has(contract.client_id)) return sum;
            const contractDate = contract.created_at.split('T')[0];
            const contractYear = new Date(contract.created_at).getFullYear();
            if (usePeriodFilter) {
                if (contractDate >= periodStart && contractDate <= periodEnd) return sum + Number(contract.total_value);
            } else {
                if (contractYear === currentYear) return sum + Number(contract.total_value);
            }
            return sum;
        }, 0);
    }, [contracts, visibleClientsWithInfo, usePeriodFilter, periodStart, periodEnd]);

    const hotCount = useMemo(() => {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
        return clients.filter(c => !c.package_id && c.installation_end_date && c.installation_end_date <= oneYearAgoStr).length;
    }, [clients]);

    const timelineGroups = useMemo(() => {
        if (activeTab !== 'timeline') return [];
        const groups: Record<string, { label: string, items: any[] }> = {
            'pending': { label: 'Ação necessária / Ciclos pendentes', items: [] }
        };
        visibleClientsWithInfo.forEach(item => {
            const relevantGroupingDate = item.info.nextScheduled?.date || null;
            if (relevantGroupingDate) {
                const date = new Date(relevantGroupingDate);
                const monthYearKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
                const monthLabel = date.toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                if (!groups[monthYearKey]) groups[monthYearKey] = { label: toSentenceCase(monthLabel), items: [] };
                groups[monthYearKey].items.push(item);
            } else {
                groups['pending'].items.push(item);
            }
        });
        return Object.keys(groups).sort((a, b) => a === 'pending' ? -1 : a.localeCompare(b)).map(key => ({ key, ...groups[key] })).filter(g => g.items.length > 0);
    }, [visibleClientsWithInfo, activeTab]);

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const data: LavagemClient = {
                id: editingClient ? editingClient.id : `wash-cli-${Date.now()}`,
                owner_id: currentUser.id,
                name: clientForm.name!,
                phone: clientForm.phone,
                cep: clientForm.cep!,
                address: clientForm.address!,
                address_number: clientForm.address_number!,
                complement: clientForm.complement!,
                city: clientForm.city!,
                plates_count: clientForm.plates_count!,
                observations: clientForm.observations,
                installation_end_date: clientForm.installation_end_date || undefined,
                package_id: editingClient?.package_id,
                contract_wash_qty: editingClient?.contract_wash_qty,
                contract_price_per_plate: editingClient?.contract_price_per_plate,
                package_launch_date: editingClient?.package_launch_date,
                travel_cost: editingClient?.travel_cost
            };
            await dataService.save('lavagem_clients', data);
            setIsClientModalOpen(false);
            await loadData();
        } finally { setIsSaving(false); }
    };

    const handleSavePackage = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const data: LavagemPackage = {
                id: editingPackage ? editingPackage.id : `wash-pkg-${Date.now()}`,
                owner_id: currentUser.id,
                name: packageForm.name,
                color: packageForm.color,
                wash_qty: packageForm.wash_qty,
                price_per_plate: packageForm.price_per_plate
            };
            await dataService.save('lavagem_packages', data);
            setEditingPackage(null);
            setPackageForm({ name: '', color: PRESET_COLORS[0].hex, wash_qty: 4, price_per_plate: 0 });
            await loadData();
        } finally { setIsSaving(false); }
    };

    const handleDeletePackage = async (id: string) => {
        const inUse = clients.some(c => c.package_id === id);
        if (inUse) { alert("Não é possível excluir este plano pois existem clientes vinculados a ele."); return; }
        if (confirm("Deseja realmente remover este plano?")) {
            setIsSaving(true);
            try { await dataService.delete('lavagem_packages', id); await loadData(); } finally { setIsSaving(false); }
        }
    };

    const handleEditPackage = (pkg: LavagemPackage) => {
        setEditingPackage(pkg);
        setPackageForm({ name: pkg.name, color: pkg.color, wash_qty: pkg.wash_qty, price_per_plate: pkg.price_per_plate });
    };

    const handleLaunchService = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!launchServiceForm.clientId || !launchServiceForm.packageId) return;
        const client = clients.find(c => c.id === launchServiceForm.clientId);
        const selectedPkg = packages.find(p => p.id === launchServiceForm.packageId);
        if (!client || !selectedPkg) return;
        setIsSaving(true);
        try {
            const launchDate = new Date();
            const platesTotal = selectedPkg.price_per_plate * (client.plates_count || 0);
            const contractTotal = (platesTotal * selectedPkg.wash_qty) + Number(launchServiceForm.travelCost || 0);
            await dataService.save('lavagem_clients', {
                ...client,
                package_id: selectedPkg.id,
                contract_price_per_plate: selectedPkg.price_per_plate,
                contract_wash_qty: selectedPkg.wash_qty,
                travel_cost: Number(launchServiceForm.travelCost || 0),
                installation_end_date: launchServiceForm.installationEndDate,
                package_launch_date: launchDate.toISOString()
            });
            await dataService.save('lavagem_contracts', {
                id: `cont-${Date.now()}`,
                client_id: client.id,
                package_name: selectedPkg.name,
                total_value: contractTotal,
                travel_cost: Number(launchServiceForm.travelCost || 0),
                created_at: launchDate.toISOString()
            });
            
            const categories = await dataService.getAll<FinancialCategory>('financial_categories');
            const targetCategoryName = "Receita de Mão de Obra – Lavagem";
            let categoryId = categories.find(c => c.name === targetCategoryName)?.id || 
                             categories.find(c => c.name.toLowerCase().includes('lavagem') && c.type === 'receita')?.id ||
                             categories.find(c => c.name === 'Receita de Vendas' || c.type === 'receita')?.id || '';
            
            await dataService.save('financial_transactions', {
                id: `tx-wash-${Date.now()}`,
                owner_id: currentUser.id,
                description: `Contrato Lavagem: ${selectedPkg.name} - ${client.name}`,
                amount: contractTotal,
                type: 'receita',
                dueDate: launchDate.toISOString().split('T')[0],
                launchDate: launchDate.toISOString().split('T')[0],
                categoryId: categoryId,
                status: 'pendente'
            });
            await loadData();
            setIsLaunchServiceModalOpen(false);
            alert("Plano vinculado e histórico financeiro lançado (Pendente)!");
        } finally { setIsSaving(false); }
    };

    const applyFrequency = (startDate: string, freq: Frequency) => {
        if (!startDate) return;
        const newDates = [...scheduleDates];
        newDates[0] = startDate;
        if (freq === 'manual') { setScheduleDates(newDates); return; }
        let monthsToAdd = 0;
        if (freq === 'trimestral') monthsToAdd = 3;
        else if (freq === 'semestral') monthsToAdd = 6;
        else if (freq === 'anual') monthsToAdd = 12;
        const baseDate = new Date(startDate);
        for (let i = 1; i < newDates.length; i++) {
            const nextDate = new Date(baseDate);
            nextDate.setUTCMonth(baseDate.getUTCMonth() + (i * monthsToAdd));
            newDates[i] = nextDate.toISOString().split('T')[0];
        }
        setScheduleDates(newDates);
    };

    const handleSaveFullSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClient) return;
        setIsSaving(true);
        try {
            const newRecords: LavagemRecord[] = scheduleDates.map(date => ({
                id: `wash-rec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                owner_id: currentUser.id,
                client_id: selectedClient.id,
                date: date,
                status: 'scheduled',
                created_at: new Date().toISOString()
            }));
            await dataService.saveAll('lavagem_records', newRecords);
            await loadData();
            setIsWashModalOpen(false);
            setSelectedClient(null);
        } catch (e) { console.error(e); alert("Erro ao salvar cronograma."); } finally { setIsSaving(false); }
    };

    const executePendingAction = async () => {
        if (!pendingAction) return;
        setIsSaving(true);
        try {
            if (pendingAction.type === 'execute') await dataService.save('lavagem_records', { ...pendingAction.record, status: 'executed' });
            else if (pendingAction.type === 'delete') await dataService.delete('lavagem_records', pendingAction.record.id);
            else if (pendingAction.type === 'update') await dataService.save('lavagem_records', { ...pendingAction.record, date: editWashValue.date, status: editWashValue.status });
            await loadData();
            setIsConfirmActionModalOpen(false);
            setIsEditWashDateModalOpen(false);
            setPendingAction(null);
        } finally { setIsSaving(false); }
    };

    const handleOpenLaunchModal = (clientId: string = '') => {
        const client = clients.find(c => c.id === clientId);
        setLaunchServiceForm({ 
            clientId, packageId: '', 
            installationEndDate: client?.installation_end_date || new Date().toISOString().split('T')[0],
            travelCost: 0
        });
        setIsClientLocked(!!clientId);
        setIsLaunchServiceModalOpen(true);
    };

    if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-cyan-600"></div></div>;

    const inputClass = "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm";

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <header className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 gap-6">
                <div className="flex items-center gap-5 flex-1">
                    <div className="p-4 bg-cyan-600 text-white rounded-2xl shadow-lg shadow-cyan-600/20"><SparklesIcon className="w-8 h-8" /></div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight">Gestão de Lavagens</h2>
                        <p className="text-xs text-gray-500 font-bold mt-1">Recorrência solar inteligente</p>
                    </div>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl border-2 border-indigo-100 dark:border-indigo-800 flex items-center gap-4 shadow-sm min-w-[260px]">
                    <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md"><DollarIcon className="w-6 h-6" /></div>
                    <div><p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">{usePeriodFilter ? 'Arrecadado no período' : `Arrecadado em ${new Date().getFullYear()}`}</p><p className="text-xl font-black text-indigo-700 dark:text-indigo-300 leading-none">{formatCurrency(totalArrecadado)}</p><p className="text-[8px] text-indigo-400 font-bold mt-1 uppercase tracking-tighter">* Inclui histórico completo da lista atual</p></div>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                    <button onClick={() => { setEditingPackage(null); setPackageForm({ name: '', color: PRESET_COLORS[0].hex, wash_qty: 4, price_per_plate: 0 }); setIsPackageModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl font-black text-xs hover:bg-gray-100 transition-all tracking-tight">Planos</button>
                    <button onClick={() => { setEditingClient(null); setClientForm({name:'', phone:'', cep:'', address:'', address_number:'', complement:'', city:'', plates_count:0, installation_end_date: '', observations: ''}); setIsClientModalOpen(true); }} className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-xl font-black text-xs hover:bg-gray-100 transition-all tracking-tight">Novo cliente</button>
                    <button onClick={() => handleOpenLaunchModal()} className="flex items-center gap-2 px-8 py-2.5 bg-cyan-600 text-white rounded-xl font-black text-xs shadow-xl shadow-cyan-600/20 hover:bg-cyan-700 transition-all active:scale-95">Lançar serviço</button>
                </div>
            </header>

            <div className="flex flex-col gap-4">
                <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 w-fit"><button onClick={() => setActiveTab('timeline')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'timeline' ? 'bg-cyan-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}><CalendarIcon className="w-4 h-4" /> Timeline de Serviços</button><button onClick={() => setActiveTab('oportunidades')} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-xs transition-all relative ${activeTab === 'oportunidades' ? 'bg-amber-50 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}><TrendUpIcon className="w-4 h-4" /> Carteira de Oportunidades {hotCount > 0 && (<span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white shadow-sm animate-bounce ring-2 ring-white">{hotCount}</span>)}</button></div>
                <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row items-center gap-4"><div className="relative flex-1 w-full"><SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="text" placeholder="Buscar cliente por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border-transparent text-sm font-bold outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all" /></div><div className="flex flex-wrap items-center gap-4 w-full lg:w-auto"><div className="min-w-[140px]"><FormLabel>Situação</FormLabel><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-xl p-2.5 text-[11px] font-bold dark:text-white outline-none appearance-none cursor-pointer"><option value="Todos">Todas situações</option><option value="Oportunidade 1 Ano">Oportunidade 1 Ano 🔥</option><option value="Atrasados">Em atraso ⚠️</option><option value="Com agendamentos">Com agendamentos</option><option value="Sem Agendamento">Sem agendamento</option><option value="Ciclo Finalizado">Ciclo Finalizado</option></select></div><div className="flex items-end gap-3 bg-gray-50 dark:bg-gray-900/40 p-2 rounded-2xl border border-gray-100 dark:border-gray-700"><div><FormLabel>Período</FormLabel><select value={usePeriodFilter ? 'enabled' : 'disabled'} onChange={e => setUsePeriodFilter(e.target.value === 'enabled')} className="bg-white dark:bg-gray-800 border-none rounded-lg px-3 py-1.5 text-[11px] font-bold outline-none cursor-pointer shadow-sm"><option value="disabled">Desativado</option><option value="enabled">Habilitado</option></select></div><div className={`flex items-center gap-2 transition-opacity ${usePeriodFilter ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}><div className="relative"><CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="bg-white dark:bg-gray-800 border-none rounded-lg pl-8 pr-2 py-1.5 text-[11px] font-bold outline-none shadow-sm" /></div><span className="text-gray-300 font-bold">-</span><div className="relative"><CalendarIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" /><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="bg-white dark:bg-gray-800 border-none rounded-lg pl-8 pr-2 py-1.5 text-[11px] font-bold outline-none shadow-sm" /></div></div></div></div></div>
            </div>

            {activeTab === 'timeline' ? (
                <div className="space-y-10">
                    {timelineGroups.map(group => (
                        <section key={group.key} className="relative">
                            <div className="absolute left-6 top-10 bottom-0 w-0.5 bg-gray-100 dark:bg-gray-800 hidden lg:block" />
                            <div className="flex items-center gap-4 mb-6 relative z-10"><div className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-950 shadow-md ${group.key === 'pending' ? 'bg-slate-500 text-white' : 'bg-cyan-600 text-white'}`}>{group.key === 'pending' ? <ClockIcon className="w-6 h-6" /> : <CalendarIcon className="w-6 h-6" />}</div><h3 className="text-lg font-black text-gray-800 dark:text-white tracking-tight">{group.label} <span className="ml-2 text-xs font-bold text-gray-400 bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-lg border">{group.items.length}</span></h3></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ml-0 lg:ml-16">
                                {group.items.map(({ client, info }) => {
                                    const packageColor = info.pkg?.color || '#94a3b8';
                                    const percent = info.washQtyLimit > 0 ? (info.executedCount / info.washQtyLimit) * 100 : 0;
                                    const isFinished = client.package_id && info.executedCount >= info.washQtyLimit && info.washQtyLimit > 0;
                                    const hasOverdue = info.allScheduled.some(r => r.date < (new Date().toISOString().split('T')[0]));
                                    
                                    const isHighlight = group.key === 'pending' && !client.package_id && info.isHighOpportunity;

                                    return (
                                        <div 
                                            key={client.id} 
                                            className={`bg-white dark:bg-gray-800 rounded-3xl border p-5 shadow-sm hover:shadow-xl transition-all group overflow-hidden flex flex-col relative 
                                                ${hasOverdue ? 'border-red-200 dark:border-red-900/50 ring-2 ring-red-500/10' : 
                                                  isHighlight ? 'border-amber-400 dark:border-amber-600 ring-4 ring-amber-500/10 bg-amber-50/10 shadow-lg shadow-amber-500/5' : 'border-gray-100 dark:border-gray-700'}`}
                                        >
                                            {hasOverdue && (<div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest animate-pulse z-10 shadow-sm">Atrasado</div>)}
                                            {isHighlight && (<div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest z-10 shadow-sm animate-pulse">Reativação Pendente ⚠️</div>)}
                                            
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <h4 className={`font-black ${isHighlight ? 'text-amber-800 dark:text-amber-400' : 'text-gray-800 dark:text-white'} text-base leading-tight`}>{client.name}</h4>
                                                        {info.totalAccumulated > info.contractTotalValue && <StarIcon className="w-3 h-3 text-amber-500 fill-amber-500" title="Cliente Fiel" />}
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 font-black flex items-center gap-1"><MapPinIcon className="w-3 h-3" /> {client.city || 'S/ local'} • {client.plates_count} placas</p>
                                                </div>
                                                <button onClick={() => { setEditingClient(client); setClientForm({...client, installation_end_date: client.installation_end_date || ''}); setIsClientModalOpen(true); }} className="p-1.5 text-gray-300 hover:text-cyan-600"><EditIcon className="w-4 h-4" /></button>
                                            </div>

                                            <div className="flex-1 space-y-4">
                                                {(info.allScheduled.length > 0 || info.pendingToScheduleCount > 0) ? (
                                                    <div style={{ backgroundColor: packageColor }} className="rounded-2xl text-white shadow-lg shadow-black/5 overflow-hidden">
                                                        <div className="bg-black/10 px-4 py-2 border-b border-white/10 flex justify-between items-center">
                                                            <p className="text-[9px] font-black opacity-80 tracking-wide">Cronograma do Ciclo</p>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[7px] font-bold opacity-60 uppercase">Progresso:</span>
                                                                <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-full shadow-sm">
                                                                    {info.executedCount} / {info.washQtyLimit}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="p-3 grid grid-cols-3 gap-1.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                                                            {info.allScheduled.map((record, idx) => (
                                                                <div key={record.id} className={`relative bg-white/10 hover:bg-white/20 p-1.5 rounded-lg border transition-all flex flex-col items-center justify-center text-center gap-1 ${idx === 0 ? 'border-white border-2 scale-105 shadow-md' : 'border-white/10'}`}>
                                                                    <p className="text-[9px] font-black leading-none">{new Date(record.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                                    <div className="flex items-center gap-1 mt-0.5"><button onClick={() => { setPendingAction({ type: 'execute', record: record }); setIsConfirmActionModalOpen(true); }} className="p-0.5 bg-white text-indigo-600 rounded-md shadow-sm hover:scale-110 transition-all" style={{ color: packageColor }}><CheckCircleIcon className="w-3 h-3" /></button><button onClick={() => { setPendingAction({ type: 'update', record: record }); setEditWashValue({ date: record.date, status: record.status }); setIsEditWashDateModalOpen(true); }} className="p-0.5 bg-black/20 text-white rounded-md hover:scale-110 transition-all"><EditIcon className="w-3 h-3" /></button></div>
                                                                </div>
                                                            ))}
                                                            {Array.from({ length: info.pendingToScheduleCount }).map((_, i) => (<button key={i} onClick={() => { setSelectedClient(client); const init = Array(info.pendingToScheduleCount).fill(new Date().toISOString().split('T')[0]); setScheduleDates(init); setFrequency('manual'); setIsWashModalOpen(true); }} className="bg-white/5 hover:bg-white/15 p-1.5 rounded-lg border-2 border-dashed border-white/20 transition-all flex flex-col items-center justify-center gap-1 min-h-[50px]"><PlusIcon className="w-4 h-4 text-white/40" /><span className="text-[7px] font-black opacity-40">Agendar</span></button>))}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className={`p-4 ${isHighlight ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300' : 'bg-slate-50 dark:bg-slate-900/10 border-slate-200 dark:border-slate-800'} border-2 border-dashed rounded-2xl text-center`}>
                                                        {isHighlight && (
                                                            <div className="flex flex-col items-center mb-3">
                                                                <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full text-amber-600 mb-2">
                                                                    <ExclamationTriangleIcon className="w-6 h-6" />
                                                                </div>
                                                                <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-tighter">Último evento há 1 ano!</p>
                                                            </div>
                                                        )}
                                                        <p className="text-[10px] font-black text-slate-700 dark:text-gray-400 mb-2">{isFinished ? 'Ciclo finalizado ✅' : isHighlight ? 'Oportunidade de Reativação' : 'Aguardando agenda'}</p>
                                                        <button 
                                                            onClick={() => (isFinished || isHighlight) ? handleOpenLaunchModal(client.id) : (() => { setSelectedClient(client); const init = Array(info.washQtyLimit - info.executedCount).fill(new Date().toISOString().split('T')[0]); setScheduleDates(init); setFrequency('semestral'); setIsWashModalOpen(true); })()} 
                                                            className={`w-full py-2.5 rounded-xl font-black text-[9px] uppercase tracking-wider shadow-md transition-all active:scale-95 ${isHighlight ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : isFinished ? 'bg-indigo-600 text-white' : 'bg-slate-500 text-white'}`}
                                                        >
                                                            {isFinished ? 'Renovar Plano' : isHighlight ? 'Oferecer Novo Plano' : 'Gerar cronograma'}
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="space-y-1.5 pt-2"><div className="flex justify-between items-end px-1"><div className="flex flex-col"><span className="text-[9px] font-black text-gray-400 tracking-tighter uppercase">{info.pkg?.name || '---'}</span><button onClick={() => { setSelectedClient(client); setIsContractDetailModalOpen(true); }} className="text-[11px] font-black text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1">{formatCurrency(info.contractTotalValue)}<ChevronDownIcon className="w-2.5 h-2.5 opacity-50" /></button></div><div className="flex flex-col text-right"><span className="text-[8px] font-black text-gray-400 uppercase">Inv. Total</span><button onClick={() => { setSelectedClient(client); setIsContractDetailModalOpen(true); }} className={`text-[10px] font-black flex items-center justify-end gap-1 transition-all ${info.totalAccumulated > 0 ? 'text-amber-600 hover:text-amber-700' : 'text-gray-400'}`}>{formatCurrency(info.totalAccumulated)}<DocumentReportIcon className="w-2.5 h-2.5 opacity-60" /></button></div></div><div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full transition-all duration-700 rounded-full" style={{ width: `${percent}%`, backgroundColor: isHighlight ? '#f59e0b' : packageColor }} /></div></div>
                                            </div>
                                            <div className="flex gap-2 mt-4 pt-4 border-t dark:border-gray-700"><button onClick={() => { setSelectedClient(client); setIsHistoryModalOpen(true); }} className="flex-1 py-2 text-[9px] font-black text-gray-400 border border-gray-100 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-900 transition-all tracking-tight flex items-center justify-center gap-1.5"><ClipboardListIcon className="w-3 h-3" /> Histórico de Visitas</button></div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    ))}
                    {timelineGroups.length === 0 && <div className="py-20 text-center text-gray-400 italic">Nenhum cliente ativo para os filtros selecionados.</div>}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                    {visibleClientsWithInfo.map(({ client, info }) => {
                        const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                        const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];
                        const isHot = client.installation_end_date && client.installation_end_date <= oneYearAgoStr;
                        let timeText = 'Sem data';
                        if (client.installation_end_date) {
                            const today = new Date(); const instDate = new Date(client.installation_end_date);
                            const diffDays = Math.ceil(today.getTime() - instDate.getTime()) / (1000 * 60 * 60 * 24);
                            if (diffDays >= 365) { const years = Math.floor(diffDays / 365); const months = Math.floor((diffDays % 365) / 30); timeText = `${years} ano${years > 1 ? 's' : ''}${months > 0 ? ` e ${months} m` : ''}`; }
                            else { const months = Math.floor(diffDays / 30); timeText = months > 0 ? `${months} meses` : `${Math.floor(diffDays)} dias`; }
                        }
                        return (
                            <div key={client.id} className={`bg-white dark:bg-gray-800 rounded-3xl border-2 p-5 shadow-sm hover:shadow-xl transition-all flex flex-col relative ${isHot ? 'border-amber-400 dark:border-amber-600 ring-4 ring-amber-500/5' : 'border-gray-100 dark:border-gray-700'}`}>
                                {isHot && (<div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-xl text-[8px] font-black uppercase tracking-widest animate-pulse z-10">Venda Reativada</div>)}
                                <div className="flex justify-between items-start mb-4"><div className="space-y-1"><h4 className="font-black text-gray-800 dark:text-white text-base leading-tight">{client.name}</h4><p className="text-[10px] text-gray-400 font-black flex items-center gap-1"><MapPinIcon className="w-3 h-3" /> {client.city || 'S/ local'}</p></div><button onClick={() => { setEditingClient(client); setClientForm({...client, installation_end_date: client.installation_end_date || ''}); setIsClientModalOpen(true); }} className="p-1.5 text-gray-300 hover:text-cyan-600"><EditIcon className="w-4 h-4" /></button></div>
                                <div className="flex-1 space-y-4"><div className={`p-4 rounded-2xl border-2 border-dashed ${isHot ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300' : 'bg-gray-50 dark:bg-gray-900/10 border-gray-200'} text-center`}><div className="flex items-center justify-center gap-2 mb-1"><ClockIcon className={`w-4 h-4 ${isHot ? 'text-amber-600' : 'text-gray-400'}`} /><span className={`text-[10px] font-black uppercase tracking-tighter ${isHot ? 'text-amber-600' : 'text-gray-500'}`}>Tempo de Instalação</span></div><p className={`text-xl font-black ${isHot ? 'text-amber-700 dark:text-amber-400' : 'text-gray-600'}`}>{timeText}</p><p className="text-[9px] text-gray-400 font-bold mt-1">Data: {client.installation_end_date ? new Date(client.installation_end_date).toLocaleDateString('pt-BR', {timeZone:'UTC'}) : '---'}</p></div><div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl flex justify-between items-center border border-gray-100 dark:border-gray-700"><div className="flex flex-col"><span className="text-[9px] font-bold text-gray-400">Potencial</span><span className="text-xs font-black text-gray-700 dark:text-gray-200">{client.plates_count} Placas</span></div><div className="w-px h-6 bg-gray-200 dark:bg-gray-700"></div><div className="flex flex-col text-right"><span className="text-[9px] font-bold text-gray-400">Status</span><span className={`text-[10px] font-black ${isHot ? 'text-amber-600' : 'text-gray-500'}`}>{isHot ? 'HOT 🔥' : 'Holding ❄️'}</span></div></div><button onClick={() => handleOpenLaunchModal(client.id)} className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg transition-all ${isHot ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>Lançar Plano</button></div>
                            </div>
                        );
                    })}
                    {visibleClientsWithInfo.length === 0 && <div className="col-span-full py-20 text-center text-gray-400 italic">Nenhuma oportunidade nesta carteira com os filtros atuais.</div>}
                </div>
            )}

            {isHistoryModalOpen && selectedClient && (
                <Modal title={`Histórico: ${selectedClient.name}`} onClose={() => setIsHistoryModalOpen(false)} maxWidth="max-w-2xl">
                    <div className="space-y-6 pt-2">
                        <div className="p-5 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-gray-100 dark:border-gray-800 space-y-2 shadow-inner">
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><MapPinIcon className="w-4 h-4 text-cyan-600" /> {selectedClient.address}, {selectedClient.address_number} - {selectedClient.city}</p>
                            <p className="text-xs font-black text-cyan-600">{selectedClient.plates_count} placas no sistema</p>
                        </div>
                        <div className="space-y-3">
                            <h4 className="text-[11px] font-black text-gray-400 px-1 tracking-tight">Histórico de visitas</h4>
                            <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                {records.filter(r => r.client_id === selectedClient.id).sort((a,b) => b.date.localeCompare(a.date)).map((record) => (
                                    <div key={record.id} className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md transition-all group">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-xl ${record.status === 'executed' ? 'bg-emerald-100 text-emerald-600' : 'bg-cyan-100 text-cyan-600'}`}>
                                                {record.status === 'executed' ? <CheckCircleIcon className="w-5 h-5" /> : <ClockIcon className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-gray-800 dark:text-white">Lavagem - {new Date(record.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>
                                                <p className={`text-[9px] font-bold ${record.status === 'executed' ? 'text-emerald-600' : 'text-cyan-600'}`}>{record.status === 'executed' ? 'Concluída' : 'Agendada'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { setPendingAction({ type: 'update', record: record }); setEditWashValue({ date: record.date, status: record.status }); setIsEditWashDateModalOpen(true); }} 
                                                className="p-2 text-gray-400 hover:text-indigo-600 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"
                                                title="Editar registro"
                                            >
                                                <EditIcon className="w-4 h-4"/>
                                            </button>
                                            <button 
                                                onClick={() => { setPendingAction({ type: 'delete', record: record }); setIsConfirmActionModalOpen(true); }} 
                                                className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors"
                                                title="Excluir registro"
                                            >
                                                <TrashIcon className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {records.filter(r => r.client_id === selectedClient.id).length === 0 && (<p className="text-center py-10 text-gray-400 text-xs italic font-bold">Nenhuma visita registrada para este cliente.</p>)}
                            </div>
                        </div>
                        <button onClick={() => setIsHistoryModalOpen(false)} className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-black text-xs hover:bg-gray-200 transition-all tracking-tight shadow-sm">Fechar Histórico</button>
                    </div>
                </Modal>
            )}

            {isEditWashDateModalOpen && pendingAction && (
                <Modal title="Editar Registro de Lavagem" onClose={() => setIsEditWashDateModalOpen(false)} maxWidth="max-w-sm">
                    <div className="space-y-6 pt-2">
                        <div className="space-y-4">
                            <div>
                                <FormLabel>Data da visita</FormLabel>
                                <input 
                                    type="date" 
                                    value={editWashValue.date} 
                                    onChange={(e) => setEditWashValue(prev => ({ ...prev, date: e.target.value }))} 
                                    className="w-full rounded-xl border-gray-300 bg-gray-50 dark:bg-gray-700 p-3 text-sm font-black shadow-sm dark:text-white" 
                                />
                            </div>
                            <div>
                                <FormLabel>Status do atendimento</FormLabel>
                                <select 
                                    value={editWashValue.status} 
                                    onChange={(e) => setEditWashValue(prev => ({ ...prev, status: e.target.value as any }))}
                                    className="w-full rounded-xl border-gray-300 bg-gray-50 dark:bg-gray-700 p-3 text-sm font-bold shadow-sm dark:text-white appearance-none cursor-pointer"
                                >
                                    <option value="scheduled">Agendada</option>
                                    <option value="executed">Concluída</option>
                                    <option value="cancelled">Cancelada</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                            <button onClick={() => setIsEditWashDateModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all">Cancelar</button>
                            <button onClick={executePendingAction} disabled={isSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all">Salvar alterações</button>
                        </div>
                    </div>
                </Modal>
            )}

            {isConfirmActionModalOpen && pendingAction && (
                <Modal title="Confirmar operação" onClose={() => setIsConfirmActionModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-50 text-indigo-600">
                            <ExclamationTriangleIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Confirmar ação?</h3>
                            <p className="text-xs text-gray-500 font-medium">
                                {pendingAction.type === 'execute' ? 'Deseja marcar como concluída?' : 'Deseja remover este registro?'}
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsConfirmActionModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm text-gray-500">Não</button>
                            <button onClick={executePendingAction} disabled={isSaving} className={`flex-1 py-3 rounded-xl font-bold text-sm shadow-lg text-white ${pendingAction.type === 'delete' ? 'bg-red-600' : 'bg-indigo-600'}`}>Sim, confirmar</button>
                        </div>
                    </div>
                </Modal>
            )}

            {isClientModalOpen && (<Modal title={editingClient ? "Editar cadastro de cliente" : "Novo cliente solar"} onClose={() => setIsClientModalOpen(false)} maxWidth="max-w-2xl"><form onSubmit={handleSaveClient} className="space-y-6 pt-2 animate-fade-in"><div className="space-y-4"><SectionHeader icon={<UsersIcon />} title="Identificação do Cliente" color="bg-indigo-600" /><div className="grid grid-cols-1 md:grid-cols-12 gap-4"><div className="md:col-span-8"><FormLabel>Nome completo do titular</FormLabel><div className="relative"><UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input required value={clientForm.name} onChange={e => setClientForm(prev => ({...prev, name: e.target.value}))} className={`${inputClass} pl-10`} placeholder="Ex: João da Silva" /></div></div><div className="md:col-span-4"><FormLabel>Telefone de contato</FormLabel><div className="relative"><PhoneIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input value={clientForm.phone} onChange={e => setClientForm(prev => ({...prev, phone: e.target.value}))} className={`${inputClass} pl-10`} placeholder="(00) 00000-0000" /></div></div></div></div><div className="space-y-4"><SectionHeader icon={<MapPinIcon />} title="Endereço de Instalação" color="bg-teal-600" /><div className="grid grid-cols-1 md:grid-cols-12 gap-4"><div className="md:col-span-3"><FormLabel>CEP</FormLabel><div className="relative"><input placeholder="00000-000" maxLength={9} value={clientForm.cep} onChange={e => setClientForm(prev => ({...prev, cep: e.target.value}))} className={inputClass} />{isLoadingCep && <div className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>}</div></div><div className="md:col-span-6"><FormLabel>Logradouro / Endereço</FormLabel><input required value={clientForm.address} onChange={e => setClientForm(prev => ({...prev, address: e.target.value}))} className={inputClass} placeholder="Rua, Avenida..." /></div><div className="md:col-span-3"><FormLabel>Cidade</FormLabel><input required value={clientForm.city} onChange={e => setClientForm(prev => ({...prev, city: e.target.value}))} className={inputClass} placeholder="Cidade" /></div><div className="md:col-span-3"><FormLabel>Nº</FormLabel><input required value={clientForm.address_number} onChange={e => setClientForm(prev => ({...prev, address_number: e.target.value}))} className={inputClass} placeholder="S/N" /></div><div className="md:col-span-9"><FormLabel>Complemento (Referência)</FormLabel><input value={clientForm.complement} onChange={e => setClientForm(prev => ({...prev, complement: e.target.value}))} className={inputClass} placeholder="Apto, Bloco, Travessa..." /></div></div></div><div className="space-y-4"><SectionHeader icon={<BoltIcon />} title="Configurações do Projeto" color="bg-amber-600" /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><FormLabel>Potência (Qtd. de Placas)</FormLabel><div className="relative"><BoltIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-500" /><input type="number" required value={clientForm.plates_count} onChange={e => setClientForm(prev => ({...prev, plates_count: parseInt(e.target.value) || 0}))} className={`${inputClass} pl-10 font-black text-amber-700 bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900`} /></div></div><div><FormLabel>Término da instalação original</FormLabel><div className="relative"><CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><input type="date" value={clientForm.installation_end_date} onChange={e => setClientForm(prev => ({...prev, installation_end_date: e.target.value}))} className={`${inputClass} pl-10`} /></div></div></div></div><div className="space-y-4"><SectionHeader icon={<ClipboardListIcon />} title="Notas e Observações" color="bg-gray-400" /><textarea rows={3} value={clientForm.observations} onChange={e => setClientForm(prev => ({...prev, observations: e.target.value}))} className={`${inputClass} resize-none min-h-[80px] font-medium text-xs`} placeholder="Notas técnicas ou comerciais..." /></div><div className="flex gap-3 pt-6 border-t dark:border-gray-700"><button type="button" onClick={() => setIsClientModalOpen(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-gray-200 transition-all">Cancelar</button><button type="submit" disabled={isSaving} className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">{isSaving ? 'Gravando...' : (editingClient ? 'Atualizar Cliente' : 'Salvar Cadastro')}</button></div></form></Modal>)}
            {isWashModalOpen && selectedClient && (<Modal title={`Cronograma: ${selectedClient.name}`} onClose={() => { setIsWashModalOpen(false); setSelectedClient(null); }} maxWidth="max-w-2xl"><form onSubmit={handleSaveFullSchedule} className="space-y-6 pt-2">{(() => { const info = getClientPackageInfo(selectedClient); const packageColor = info.pkg?.color || '#6366f1'; return (<><div style={{ backgroundColor: `${packageColor}10`, borderColor: packageColor }} className="p-4 rounded-2xl border-2 border-dashed"><SectionHeader icon={<ClockIcon />} title="Gerador inteligente" color={packageColor} /><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-[11px] font-bold text-gray-500 mb-1 ml-1 tracking-tight">Data da 1ª lavagem</label><input required type="date" value={scheduleDates[0] || ''} onChange={e => applyFrequency(e.target.value, frequency)} className="w-full rounded-xl bg-white p-3 text-sm font-black shadow-sm border" /></div><div><label className="block text-[11px] font-bold text-gray-500 mb-1 ml-1 tracking-tight">Frequência</label><select value={frequency} onChange={e => { setFrequency(e.target.value as Frequency); applyFrequency(scheduleDates[0], e.target.value as Frequency); }} className="w-full rounded-xl bg-white p-3 text-sm font-bold shadow-sm border"><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option><option value="manual">Manual</option></select></div></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-64 overflow-y-auto pr-1 custom-scrollbar p-1">{scheduleDates.map((date, idx) => (<div key={idx} className="relative group"><span style={{ color: packageColor }} className="absolute -top-2.5 left-3 px-1.5 bg-white text-[8px] font-black z-10 border rounded tracking-tighter">{idx + 1}ª lavagem</span><input type="date" value={date} onChange={e => { const newDates = [...scheduleDates]; newDates[idx] = e.target.value; setScheduleDates(newDates); setFrequency('manual'); }} className="w-full rounded-xl bg-gray-50 p-3 text-xs font-black outline-none border-2 border-transparent focus:border-indigo-400 transition-all" /></div>))}</div><div className="flex gap-3 pt-4 border-t"><button type="button" onClick={() => setIsWashModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">Cancelar</button><button type="submit" disabled={isSaving || !scheduleDates[0]} style={{ backgroundColor: packageColor }} className="flex-[2] py-3 text-white rounded-xl font-black text-xs shadow-lg hover:brightness-110 transition-all">Agendar cronograma</button></div></>); })()}</form></Modal>)}
            {isPackageModalOpen && (<Modal title="Gerenciar planos" onClose={() => { setIsPackageModalOpen(false); setEditingPackage(null); }} maxWidth="max-w-2xl"><div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2"><div className="space-y-4"><h4 className="text-[10px] font-black text-gray-400 uppercase border-b pb-2">Planos cadastrados</h4><div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">{packages.map(pkg => (<div key={pkg.id} className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border flex items-center justify-between group"><div className="flex items-center gap-3"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: pkg.color }}></div><div><p className="text-xs font-black text-gray-800 dark:text-white leading-tight">{pkg.name}</p><p className="text-[9px] text-gray-400 font-bold">{pkg.wash_qty} visitas • {formatCurrency(pkg.price_per_plate)}/placa</p></div></div><div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => handleEditPackage(pkg)} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"><EditIcon className="w-4 h-4" /></button><button onClick={() => handleDeletePackage(pkg.id)} className="p-1 text-gray-400 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button></div></div>))}</div></div><form onSubmit={handleSavePackage} className="space-y-4 bg-gray-50 dark:bg-gray-900/40 p-5 rounded-2xl border"><h4 className="text-[10px] font-black text-indigo-600 uppercase">{editingPackage ? 'Editar plano' : 'Novo plano'}</h4><div><FormLabel>Nome do plano</FormLabel><input required value={packageForm.name} onChange={e => setPackageForm(prev => ({...prev, name: e.target.value}))} className="w-full rounded-xl bg-white p-2.5 text-xs font-bold shadow-sm" placeholder="Ex: Anual Ouro 4x" /></div><div><FormLabel>Cor</FormLabel><div className="grid grid-cols-4 gap-1.5 mt-1">{PRESET_COLORS.map(color => (<button key={color.hex} type="button" onClick={() => setPackageForm({...packageForm, color: color.hex})} className={`h-7 rounded-lg border-2 transition-all flex items-center justify-center ${packageForm.color === color.hex ? 'border-indigo-500 scale-105' : 'border-transparent opacity-70'}`} style={{ backgroundColor: color.hex }}>{packageForm.color === color.hex && <CheckCircleIcon className="w-3 h-3 text-white" />}</button>))}</div></div><div className="grid grid-cols-2 gap-3"><div><FormLabel>Qtd. visitas</FormLabel><input type="number" required min="1" value={packageForm.wash_qty} onChange={e => setPackageForm(prev => ({...prev, wash_qty: parseInt(e.target.value) || 1}))} className="w-full rounded-xl bg-white p-2.5 text-xs font-bold" /></div><div><FormLabel>V. placa (R$)</FormLabel><input type="number" step="0.01" required value={packageForm.price_per_plate || ''} onChange={e => setPackageForm(prev => ({...prev, price_per_plate: parseFloat(e.target.value) || 0}))} className="w-full rounded-xl bg-white p-2.5 text-xs font-bold text-emerald-600" /></div></div><button type="submit" disabled={isSaving} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] shadow-lg uppercase tracking-widest">{isSaving ? 'Salvando...' : (editingPackage ? 'Atualizar' : 'Criar')}</button></form></div></Modal>)}
            {isLaunchServiceModalOpen && (<Modal title="Lançar serviço" onClose={() => setIsLaunchServiceModalOpen(false)} maxWidth="max-w-md"><form onSubmit={handleLaunchService} className="space-y-5 pt-2"><div><FormLabel>Cliente</FormLabel><select required disabled={isClientLocked} value={launchServiceForm.clientId} onChange={e => setLaunchServiceForm(prev => ({...prev, clientId: e.target.value}))} className={`w-full rounded-xl bg-gray-50 dark:bg-gray-700 p-3 text-sm font-bold shadow-sm ${isClientLocked ? 'opacity-70 cursor-not-allowed' : ''}`}><option value="">Escolha...</option>{clients.filter(c => !c.package_id || c.id === launchServiceForm.clientId).map(c => <option key={c.id} value={c.id}>{c.name} ({c.plates_count} placas)</option>)}</select></div><div><FormLabel>Término da instalação</FormLabel><input readOnly required type="date" value={launchServiceForm.installationEndDate} className="w-full rounded-xl bg-gray-100 dark:bg-gray-800 p-3 text-sm font-bold shadow-sm opacity-70 cursor-not-allowed border-none outline-none" /></div><div><FormLabel>Plano contratado</FormLabel><select required value={launchServiceForm.packageId} onChange={e => setLaunchServiceForm(prev => ({...prev, packageId: e.target.value}))} className="w-full rounded-xl bg-gray-50 p-3 text-sm font-bold shadow-sm"><option value="">Escolha...</option>{packages.map(p => <option key={p.id} value={p.id}>{p.name} ({p.wash_qty}x • {formatCurrency(p.price_per_plate)}/placa)</option>)}</select></div>{launchServiceForm.clientId && launchServiceForm.packageId && (() => { const client = clients.find(c => c.id === launchServiceForm.clientId); const pkg = packages.find(p => p.id === launchServiceForm.packageId); if (!client || !pkg) return null; const subtotalPlacas = pkg.price_per_plate * client.plates_count; const totalPlano = subtotalPlacas * pkg.wash_qty; const totalGeral = totalPlano + Number(launchServiceForm.travelCost || 0); return (<div className="p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border-2 border-indigo-100 dark:border-indigo-800 animate-fade-in"><h4 className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2"><ClipboardListIcon className="w-3 h-3" /> Memorial de cálculo</h4><div className="space-y-2"><div className="flex justify-between items-center text-[11px] font-bold text-gray-600 dark:text-gray-300"><span>Base ({client.plates_count} placas x {formatCurrency(pkg.price_per_plate)})</span><span>{formatCurrency(subtotalPlacas)} /visita</span></div><div className="flex justify-between items-center text-[11px] font-bold text-gray-600 dark:text-gray-300 border-b border-indigo-100 dark:border-indigo-800 pb-2"><span>Ciclo ({pkg.wash_qty} visitas)</span><span>{formatCurrency(totalPlano)}</span></div><div className="py-2"><label className="block text-[10px] font-black text-indigo-500 dark:text-indigo-400 mb-1 ml-0.5 uppercase">Taxa Desloc. (Opcional)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 font-bold text-xs">R$</span><input type="number" step="0.01" value={launchServiceForm.travelCost || ''} onChange={e => setLaunchServiceForm(prev => ({...prev, travelCost: parseFloat(e.target.value) || 0}))} className="w-full rounded-xl bg-white dark:bg-gray-900 p-2 pl-9 text-xs font-black text-indigo-600 dark:text-indigo-400 shadow-inner border border-indigo-100 dark:border-indigo-800 outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="0,00" /></div></div><div className="pt-2 border-t border-indigo-200 dark:border-indigo-700 flex justify-between items-center"><span className="text-[12px] font-black text-indigo-700 dark:text-indigo-300 uppercase">Investimento Total</span><span className="text-lg font-black text-indigo-800 dark:text-indigo-100">{formatCurrency(totalGeral)}</span></div></div></div>); })()}<div className="flex gap-3 pt-4 border-t"><button type="button" onClick={() => setIsLaunchServiceModalOpen(false)} className="flex-1 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-xs">Cancelar</button><button type="submit" disabled={isSaving || !launchServiceForm.packageId} className="flex-[2] py-3 bg-cyan-600 text-white rounded-xl font-black text-xs shadow-lg shadow-cyan-600/20 hover:bg-cyan-700 transition-all active:scale-95">Confirmar vínculo</button></div></form></Modal>)}
        </div>
    );
};

export default LavagemPage;
