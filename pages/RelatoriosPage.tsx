
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
    ChartPieIcon, PrinterIcon, PlusIcon, TrashIcon, 
    CogIcon, SaveIcon, EditIcon, ClipboardListIcon, 
    CheckCircleIcon, DollarIcon, ExclamationTriangleIcon, 
    DocumentReportIcon, XCircleIcon, LockClosedIcon,
    ArrowLeftIcon, EyeIcon, CalendarIcon, TableIcon, FilterIcon, UsersIcon, ChevronDownIcon,
    UploadIcon, PhotographIcon, ClockIcon, SearchIcon, TrendUpIcon, SparklesIcon, TruckIcon, ArrowDownIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, 
    Tooltip as RechartsTooltip, Legend, BarChart, 
    Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import type { RelatoriosPageProps, ExpenseReportItem, ExpenseReport, ExpenseReportStatus, ExpenseAttachment, FinancialCategory, FinancialTransaction, Supplier } from '../types';
import { dataService } from '../services/dataService';
import { supabase } from '../supabaseClient';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">{children}</label>
);

const SectionTitle: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "bg-indigo-500" }) => (
    <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight border-b border-gray-100 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
        <span className={`w-1 h-4 ${color} rounded-full`}></span>
        {children}
    </h3>
);

interface ExtendedRelatoriosPageProps extends RelatoriosPageProps {
    onLogoUpdated?: () => void;
}

const RelatoriosPage: React.FC<ExtendedRelatoriosPageProps> = ({ view, reportToEdit, onSave, onEditReport, currentUser, onLogoUpdated }) => {
  const [solicitante, setSolicitante] = useState('');
  const [setor, setSetor] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [valorPorKm, setValorPorKm] = useState(1.20);
  
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  
  const [selectedUserFilter, setSelectedUserFilter] = useState<string[]>(['Todos']);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  
  const [statusFilterValue, setStatusFilterValue] = useState<ExpenseReportStatus | 'Todos'>('Todos');
  const [configKmValue, setConfigKmValue] = useState(1.20);
  const [configInstValue, setConfigInstValue] = useState(120.00);
  const [companyLogoValue, setCompanyLogoValue] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [editSupplierNameValue, setEditSupplierNameValue] = useState('');

  const [isEditingKm, setIsEditingKm] = useState(false);
  const [isEditingInst, setIsEditingInst] = useState(false);
  const [isEditingLogo, setIsEditingLogo] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
  const [isConfirmEfetivarHistoricoModal, setIsConfirmEfetivarHistoricoModal] = useState(false);
  const [isConfirmEfetivarStatusModal, setIsConfirmEfetivarStatusModal] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  
  const [reportInAction, setReportInAction] = useState<ExpenseReport | null>(null);
  const [hdPhoto, setHdPhoto] = useState<string | null>(null);
  
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [items, setItems] = useState<ExpenseReportItem[]>([
    { id: Date.now().toString(), date: '', description: '', km: 0, toll: 0, food: 0, components: 0, others: 0 },
  ]);
  const [attachments, setAttachments] = useState<ExpenseAttachment[]>([]);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = useMemo(() => currentUser.profileId === '001' || currentUser.profileId === '00000000-0000-0000-0000-000000000001', [currentUser]);
  const isReadOnly = useMemo(() => reportToEdit ? reportToEdit.status !== 'Rascunho' : false, [reportToEdit]);

  const loadSuppliers = useCallback(async () => {
    try {
        const isAdminUser = currentUser.profileId === '001';
        const data = await dataService.getAll<Supplier>('suppliers', currentUser.id, isAdminUser);
        if (data) setSuppliers(data.sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e) { console.error("Erro fornecedores:", e); }
  }, [currentUser]);

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    try {
        const data = await dataService.getAll<ExpenseReport>('expense_reports', currentUser.id, isAdmin);
        const sorted = (data || []).sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
        });
        setReports(sorted);
    } catch (e) { console.error("Erro relatórios:", e); } 
    finally { setIsLoading(false); }
  }, [currentUser, isAdmin]);

  const loadConfig = useCallback(async () => {
      try {
          const remoteConfigs = await dataService.getAll<any>('system_configs', undefined, true);
          const remoteKm = remoteConfigs.find(c => c.id === 'km_value');
          const remoteInst = remoteConfigs.find(c => c.id === 'installation_value');
          const remoteLogo = remoteConfigs.find(c => c.id === 'company_logo');
          
          if (remoteKm) {
              const val = parseFloat(remoteKm.value);
              setConfigKmValue(val); setValorPorKm(val);
          }
          if (remoteInst) setConfigInstValue(parseFloat(remoteInst.value));
          if (remoteLogo) setCompanyLogoValue(remoteLogo.value);

      } catch (e) { console.error("Erro configs:", e); }
  }, []);

  useEffect(() => { 
    loadReports(); loadConfig(); loadSuppliers();
    const date = new Date();
    setFilterStart(new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0]);
    setFilterEnd(new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0]);
    const handleClickOutside = (event: MouseEvent) => {
        if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) setIsUserDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [view, loadReports, loadConfig, loadSuppliers]);

  useEffect(() => {
    if (view === 'reembolso') {
        if (reportToEdit) {
            setSolicitante(reportToEdit.requester || ''); 
            setSetor(reportToEdit.sector || ''); 
            setPeriodStart(reportToEdit.periodStart || ''); 
            setPeriodEnd(reportToEdit.periodEnd || ''); 
            setItems(reportToEdit.items || []); 
            setAttachments(reportToEdit.attachments || []);
            setValorPorKm(reportToEdit.kmValueUsed || configKmValue);
        } else {
            setSolicitante(currentUser.name); 
            setSetor(''); setPeriodStart(''); setPeriodEnd(''); 
            setItems([{ id: Date.now().toString(), date: '', description: '', km: 0, toll: 0, food: 0, components: 0, others: 0 }]); 
            setAttachments([]); setValorPorKm(configKmValue);
        }
    }
  }, [view, reportToEdit, currentUser, configKmValue]);

  const handleAddSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) return;
    setIsLoading(true);
    try {
        const newSupplier: Supplier = { id: `sup-${Date.now()}`, owner_id: currentUser.id, name, active: true };
        await dataService.save('suppliers', newSupplier);
        setNewSupplierName('');
        setSuppliers(prev => [...prev, newSupplier].sort((a,b) => a.name.localeCompare(b.name)));
    } catch (e: any) { alert("Erro fornecedor."); } 
    finally { setIsLoading(false); }
  };

  const handleEditSupplierClick = (sup: Supplier) => { setEditingSupplierId(sup.id); setEditSupplierNameValue(sup.name); };

  const handleSaveSupplierEdit = async (sup: Supplier) => {
      const name = editSupplierNameValue.trim();
      if (!name) return;
      setIsLoading(true);
      try {
          const updatedSupplier = { ...sup, name };
          await dataService.save('suppliers', updatedSupplier);
          setEditingSupplierId(null);
          setSuppliers(prev => prev.map(s => s.id === sup.id ? updatedSupplier : s).sort((a,b) => a.name.localeCompare(b.name)));
      } catch (e) { alert("Erro atualizar fornecedor."); } 
      finally { setIsLoading(false); }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Deseja realmente excluir?")) return;
    setIsLoading(true);
    try {
        await dataService.delete('suppliers', id);
        setSuppliers(prev => prev.filter(s => s.id !== id));
    } catch (e) { alert("Erro excluir fornecedor."); } 
    finally { setIsLoading(false); }
  };

  const uniqueRequesters = useMemo(() => {
    const names = reports.map(r => r.requester);
    return Array.from(new Set(names)).sort();
  }, [reports]);

  const toggleUserSelection = (user: string) => {
    setSelectedUserFilter(prev => {
        if (user === 'Todos') return ['Todos'];
        const newSelection = prev.includes('Todos') ? [] : [...prev];
        if (newSelection.includes(user)) {
            const filtered = newSelection.filter(u => u !== user);
            return filtered.length === 0 ? ['Todos'] : filtered;
        } else { return [...newSelection, user]; }
    });
  };

  const analysisData = useMemo(() => {
    const filtered = reports.filter(r => {
        const date = (r.createdAt || '').split('T')[0];
        if (filterStart && date < filterStart) return false;
        if (filterEnd && date > filterEnd) return false;
        if (!selectedUserFilter.includes('Todos') && !selectedUserFilter.includes(r.requester)) return false;
        return true;
    });
    const paid = filtered.filter(r => r.status === 'Pago').reduce((acc, r) => acc + (r.totalValue || 0), 0);
    const pending = filtered.filter(r => r.status === 'Transferido' || r.status === 'Env. p/ Pagamento').reduce((acc, r) => acc + (r.totalValue || 0), 0);
    let tk=0, tt=0, tf=0, tc=0, to=0;
    filtered.forEach(r => { 
        if (r.status === 'Pago') { 
            r.items.forEach(item => {
                tk += Math.ceil(((item.km || 0) * (r.kmValueUsed || 1.20)) * 100) / 100;
                tt += (item.toll || 0); tf += (item.food || 0);
                tc += (item.components || 0); to += (item.others || 0);
            });
        } 
    });
    const pieData = [{name:'Km',value:tk},{name:'Pedágios',value:tt},{name:'Alim.',value:tf},{name:'Comp.',value:tc},{name:'Outros',value:to}].filter(d => d.value > 0);
    const monthlyGroups: Record<string, number> = {};
    filtered.filter(r => r.status === 'Pago').forEach(r => {
        const month = new Date(r.createdAt).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        monthlyGroups[month] = (monthlyGroups[month] || 0) + r.totalValue;
    });
    return { paid, pending, filteredReports: filtered, totalKmValue: tk, totalTollValue: tt, totalFoodValue: tf, totalComponentsValue: tc, totalOthersValue: to, pieData, barData: Object.entries(monthlyGroups).map(([name, value]) => ({ name, value })) };
  }, [reports, filterStart, filterEnd, selectedUserFilter]);

  const validateItemsDates = (reportItems: ExpenseReportItem[]): boolean => {
      if (!periodStart || !periodEnd) return true;
      const invalidItem = reportItems.find(item => item.date && (item.date < periodStart || item.date > periodEnd));
      if (invalidItem) {
          alert(`ERRO DE DATA: O gasto "${invalidItem.description || 'sem descrição'}" possui data fora do período.`);
          return false;
      }
      return true;
  };

  const handleEfetivarHistorico = async () => {
    if (!reportInAction) return;
    if (!validateItemsDates(reportInAction.items)) return;
    setIsLoading(true);
    try {
        await dataService.save('expense_reports', { ...reportInAction, status: 'Transferido' });
        setModalMessage("Reembolso efetivado com sucesso! Agora disponível para análise.");
        setSuccessModalOpen(true);
        await loadReports();
    } catch (e) { alert("Erro ao salvar."); } 
    finally { setIsLoading(false); setIsConfirmEfetivarHistoricoModal(false); setReportInAction(null); }
  };

  const handleEfetivarStatus = async () => {
    if (!reportInAction) return;
    setIsLoading(true);
    setIsConfirmEfetivarStatusModal(false);
    
    try {
        const reportId = reportInAction.id;
        
        if (reportInAction.isInstallmentWash) {
            const txIds = reportInAction.items.map(i => i.id);
            const { data: targetTxs } = await supabase.from('financial_transactions').select('*').in('id', txIds);
            
            if (targetTxs) {
                for (const tx of targetTxs) {
                    try {
                        await dataService.save('financial_transactions', { 
                            ...tx, 
                            invoiceSent: true, 
                            relatedReportId: reportId 
                        });
                    } catch (txErr: any) {
                        console.warn(`[RELATORIOS] Falha ao sinalizar transação técnica ${tx.id}:`, txErr.message);
                    }
                }
            }
            await dataService.save('expense_reports', { ...reportInAction, status: 'Env. p/ Pagamento' });
            setModalMessage("Aprovado! Os itens vinculados agora aparecem como 'Liberados p/ Pagar' no Financeiro.");
        } else {
            const financialCategories = await dataService.getAll<FinancialCategory>('financial_categories');
            let category = financialCategories.find(c => c.name === 'Solicitação Pagto RD');
            if (!category) {
                category = await dataService.save('financial_categories', {
                    id: `cat-reemb-${Date.now()}`, name: 'Solicitação Pagto RD', type: 'despesa',
                    classification: 'DESPESA_OPERACIONAL', group: 'Solicitações Pagto', active: true, showInDre: true
                });
            }
            const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 7);
            
            await dataService.save('financial_transactions', {
                id: `tx-reemb-${reportId}`, 
                owner_id: reportInAction.owner_id,
                description: `Solicitação: ${reportInAction.requester} (${reportInAction.period})`,
                amount: reportInAction.totalValue, 
                type: 'despesa', 
                dueDate: dueDate.toISOString().split('T')[0],
                launchDate: new Date().toISOString().split('T')[0], 
                categoryId: category.id, 
                status: 'pendente',
                relatedReportId: reportId,
                invoiceSent: true 
            });
            
            await dataService.save('expense_reports', { ...reportInAction, status: 'Env. p/ Pagamento' });
            setModalMessage("Reembolso aprovado! Transação de pagamento criada em 'Contas a Pagar'.");
        }
        setSuccessModalOpen(true);
        await loadReports();
    } catch (e: any) { 
        console.error("Erro fatal na aprovação:", e); 
        alert("Erro ao processar aprovação: " + e.message); 
    } finally { 
        setIsLoading(false); 
        setReportInAction(null); 
    }
  };

  const handleCancelarStatus = async () => {
      if (!reportInAction || !cancelReason.trim()) { alert("Informe o motivo."); return; }
      setIsLoading(true);
      try {
          await dataService.save('expense_reports', { ...reportInAction, status: 'Cancelado', cancelReason });
          
          const { data: relatedTx } = await supabase.from('financial_transactions').select('*').eq('id', `tx-reemb-${reportInAction.id}`).single();
          if (relatedTx) await dataService.save('financial_transactions', { ...relatedTx, status: 'cancelado', cancelReason: `Cancelado via RD: ${cancelReason}` });
          
          if (reportInAction.isInstallmentWash) {
              const txIds = reportInAction.items.map(i => i.id);
              const { data: targetTxs } = await supabase.from('financial_transactions').select('*').in('id', txIds);
              if (targetTxs) {
                  for (const tx of targetTxs) {
                      try { await dataService.save('financial_transactions', { ...tx, invoiceSent: false, relatedReportId: null }); } catch (e) { /* silent */ }
                  }
              }
          }
          setModalMessage("Reembolso cancelado com sucesso.");
          setSuccessModalOpen(true);
          await loadReports();
      } catch (e) { alert("Erro ao cancelar."); } 
      finally { setIsLoading(false); setIsCancelModalOpen(false); setReportInAction(null); setCancelReason(''); }
  };

  const handleSuccessModalClose = () => { setSuccessModalOpen(false); if (view === 'reembolso' && onSave) onSave(); };

  const getFileBlob = (file: ExpenseAttachment) => {
    const parts = file.data.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
    return new Blob([uInt8Array], { type: contentType });
  };

  const handleViewFile = (file: ExpenseAttachment) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
    if (isPdf) {
        const blob = getFileBlob(file);
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    } else setHdPhoto(file.data);
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

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const handleSaveKmConfig = async () => {
      setIsLoading(true);
      try {
          await dataService.save('system_configs', { id: 'km_value', value: configKmValue.toString() });
          setValorPorKm(configKmValue); setIsEditingKm(false); alert('Salvo!');
      } catch (e) { alert('Erro.'); } finally { setIsLoading(false); }
  };

  const handleSaveInstConfig = async () => {
      setIsLoading(true);
      try {
          await dataService.save('system_configs', { id: 'installation_value', value: configInstValue.toString() });
          setIsEditingInst(false); alert('Salvo!');
      } catch (e) { alert('Erro.'); } finally { setIsLoading(false); }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const img = new Image();
            img.src = reader.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 400;
                let width = img.width;
                let height = img.height;
                if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
                else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                setCompanyLogoValue(canvas.toDataURL('image/jpeg', 0.8));
            };
        };
        reader.readAsDataURL(file);
    }
  };

  const handleSaveLogo = async () => {
    setIsLoading(true);
    try {
        await dataService.save('system_configs', { id: 'company_logo', value: companyLogoValue || '' });
        setIsEditingLogo(false);
        if (onLogoUpdated) onLogoUpdated();
        alert('Identidade visual atualizada!');
    } catch (e) { alert('Erro ao salvar logo.'); } finally { setIsLoading(false); }
  };

  const renderContent = () => {
    if (view === 'config') return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200"><CogIcon className="w-6 h-6 text-white" /></div>
                    <div><h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">Configurações Gerais</h1><p className="text-[11px] text-gray-400 font-bold tracking-tight">Defina valores de referência e identidade visual</p></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                            <SectionTitle color="bg-blue-500">Valores de referência</SectionTitle>
                            <div className="space-y-4">
                                <div>
                                    <FormLabel>Valor do KM (Reembolsos)</FormLabel>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                                            <input type="number" step="0.01" value={configKmValue} onChange={e => setConfigKmValue(parseFloat(e.target.value))} disabled={!isEditingKm} className="w-full pl-9 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-70" />
                                        </div>
                                        {isEditingKm ? (
                                            <button onClick={handleSaveKmConfig} className="p-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700"><SaveIcon className="w-4 h-4" /></button>
                                        ) : (
                                            <button onClick={() => setIsEditingKm(true)} className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300"><EditIcon className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <FormLabel>Valor Instalação p/ Placa (Orçamentos)</FormLabel>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                                            <input type="number" step="0.01" value={configInstValue} onChange={e => setConfigInstValue(parseFloat(e.target.value))} disabled={!isEditingInst} className="w-full pl-9 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs font-bold text-indigo-600 outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-70" />
                                        </div>
                                        {isEditingInst ? (
                                            <button onClick={handleSaveInstConfig} className="p-2 bg-green-600 text-white rounded-lg shadow-sm hover:bg-green-700"><SaveIcon className="w-4 h-4" /></button>
                                        ) : (
                                            <button onClick={() => setIsEditingInst(true)} className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-300"><EditIcon className="w-4 h-4" /></button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
                            <div className="flex justify-between items-center">
                                <SectionTitle color="bg-indigo-500">Identidade Visual</SectionTitle>
                                {isEditingLogo ? (
                                    <button onClick={handleSaveLogo} className="p-1.5 bg-green-600 text-white rounded-lg shadow-sm"><SaveIcon className="w-4 h-4" /></button>
                                ) : (
                                    <button onClick={() => setIsEditingLogo(true)} className="p-1.5 bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg"><EditIcon className="w-4 h-4" /></button>
                                )}
                            </div>
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-32 h-32 rounded-2xl border-4 border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center justify-center overflow-hidden relative group">
                                    {companyLogoValue ? (
                                        <img src={companyLogoValue} className="max-w-full max-h-full object-contain" alt="Logo" />
                                    ) : (
                                        <PhotographIcon className="w-12 h-12 text-gray-200" />
                                    )}
                                    {isEditingLogo && (
                                        <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                            <UploadIcon className="w-8 h-8 text-white" />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                                        </label>
                                    )}
                                </div>
                                <p className="text-[10px] font-bold text-gray-400 text-center">Este logotipo será exibido na barra lateral, tela de login e documentos gerados.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900/40 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col">
                        <SectionTitle color="bg-amber-500">Fornecedores de Kits</SectionTitle>
                        <div className="flex gap-2 mb-4">
                            <input type="text" placeholder="Nome do fornecedor..." value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} className="flex-1 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                            <button onClick={handleAddSupplier} className="p-2 bg-indigo-600 text-white rounded-lg shadow-lg active:scale-95"><PlusIcon className="w-4 h-4" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto max-h-96 custom-scrollbar space-y-1.5 pr-1">
                            {suppliers.map(sup => (
                                <div key={sup.id} className="flex items-center justify-between p-2.5 bg-white dark:bg-gray-800 rounded-xl border border border-gray-100 dark:border-gray-700 group hover:border-indigo-200 transition-all">
                                    {editingSupplierId === sup.id ? (
                                        <div className="flex gap-2 w-full">
                                            <input autoFocus type="text" value={editSupplierNameValue} onChange={e => setEditSupplierNameValue(e.target.value)} className="flex-1 bg-gray-50 dark:bg-gray-900 border-none rounded p-1 text-[11px] font-bold" />
                                            <button onClick={() => handleSaveSupplierEdit(sup)} className="text-green-600"><CheckCircleIcon className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingSupplierId(null)} className="text-gray-400"><XCircleIcon className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200">{sup.name}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleEditSupplierClick(sup)} className="p-1 text-gray-400 hover:text-indigo-600"><EditIcon className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDeleteSupplier(sup.id)} className="p-1 text-gray-400 hover:text-red-600"><TrashIcon className="w-3.5 h-3.5" /></button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                            {suppliers.length === 0 && <p className="text-center py-10 text-[10px] font-bold text-gray-400 italic">Nenhum fornecedor cadastrado.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
    if (view === 'analise') return (
      <div className="space-y-6 animate-fade-in pb-10">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2 rounded-xl border border-gray-100 dark:border-gray-600">
                      <CalendarIcon className="w-4 h-4 text-gray-400" />
                      <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-transparent border-none text-[11px] font-bold outline-none dark:text-white w-28" />
                      <span className="text-gray-300 font-bold">-</span>
                      <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-transparent border-none text-[11px] font-bold outline-none dark:text-white w-28" />
                  </div>
                  <div className="relative" ref={userDropdownRef}>
                      <button onClick={() => !isUserDropdownOpen && setIsUserDropdownOpen(true)} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 min-w-[220px] transition-all hover:bg-gray-100 dark:hover:bg-gray-700">
                          <UsersIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-[11px] font-bold text-gray-700 dark:text-white truncate flex-1 text-left">{selectedUserFilter.includes('Todos') ? 'Todos os usuários' : `${selectedUserFilter.length} usuário(s) selecionado(s)`}</span>
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isUserDropdownOpen && (
                          <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2 max-h-64 overflow-y-auto custom-scrollbar animate-fade-in">
                              <label className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group">
                                  <input type="checkbox" className="hidden" checked={selectedUserFilter.includes('Todos')} onChange={() => toggleUserSelection('Todos')} />
                                  <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${selectedUserFilter.includes('Todos') ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>{selectedUserFilter.includes('Todos') && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div>
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Selecionar todos</span>
                              </label>
                              <div className="h-px bg-gray-100 dark:bg-gray-700 my-1 mx-2"></div>
                              {uniqueRequesters.map(u => (
                                  <label key={u} className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group">
                                      <input type="checkbox" className="hidden" checked={selectedUserFilter.includes(u)} onChange={() => toggleUserSelection(u)} />
                                      <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${selectedUserFilter.includes(u) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>{selectedUserFilter.includes(u) && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div>
                                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{u}</span>
                                  </label>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
              <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg active:scale-95"><PrinterIcon className="w-4 h-4" /> Imprimir relatório</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard title="Reembolsos pagos" value={formatCurrency(analysisData.paid)} icon={CheckCircleIcon} color="bg-green-500" />
              <DashboardCard title="Em aprovação" value={formatCurrency(analysisData.pending)} icon={ClockIcon} color="bg-indigo-500" />
              <DashboardCard title="Total em km" value={formatCurrency(analysisData.totalKmValue)} icon={TrendUpIcon} color="bg-blue-500" />
              <DashboardCard title="Total pedágio" value={formatCurrency(analysisData.totalTollValue)} icon={DollarIcon} color="bg-purple-500" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
                  <SectionTitle color="bg-indigo-500">Distribuição por categoria (pagas)</SectionTitle>
                  <div className="flex-1">
                      {analysisData.pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                  <Pie data={analysisData.pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                                      {analysisData.pieData.map((_, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                  </Pie>
                                  <RechartsTooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                                  <Legend verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                              </PieChart>
                          </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-gray-400 text-xs font-bold italic">Sem dados pagos.</div>)}
                  </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
                  <SectionTitle color="bg-teal-500">Evolução mensal de pagamentos</SectionTitle>
                  <div className="flex-1">
                      {analysisData.barData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analysisData.barData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                                  <YAxis hide />
                                  <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 10, 0, 0.1)' }} />
                                  <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-gray-400 text-xs font-bold italic">Sem histórico.</div>)}
                  </div>
              </div>
          </div>
      </div>
    );
    if (view === 'historico' || view === 'status') {
      const listReports = (isAdmin ? reports : reports.filter(r => r.owner_id === currentUser.id)).filter(r => statusFilterValue === 'Todos' || r.status === statusFilterValue);
      return (
          <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-10">
              <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100"><CheckCircleIcon className="w-6 h-6" /></div>
                  <div><h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{view === 'status' ? 'Status de reembolsos' : 'Histórico de reembolsos'}</h1><p className="text-[11px] text-gray-400 font-bold tracking-tight">{isAdmin ? `Visão global (${listReports.length} itens)` : `Meus reembolsos (${listReports.length} itens)`}</p></div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"><div className="max-w-xs"><FormLabel>Filtrar por status</FormLabel><div className="relative"><select value={statusFilterValue} onChange={(e) => setStatusFilterValue(e.target.value as any)} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-lg px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none shadow-sm cursor-pointer"><option value="Todos">Todos os status</option><option value="Rascunho">Rascunho</option><option value="Transferido">Transferido</option><option value="Env. p/ Pagamento">Env. p/ Pagamento</option><option value="Pago">Pago</option><option value="Cancelado">Cancelado</option></select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40"><ChevronDownIcon className="w-4 h-4" /></div></div></div></div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 dark:bg-gray-900/40 text-[10px] font-bold text-gray-400 tracking-tight border-b dark:border-gray-700">
                      <tr>
                        <th className="px-6 py-4">Data</th><th className="px-6 py-4">Solicitante</th><th className="px-6 py-4">Origem</th><th className="px-6 py-4 text-right">Valor total</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-center w-48">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {listReports.map((report) => { 
                        const canEdit = report.status === 'Rascunho'; 
                        const canEffectuateHistory = report.status === 'Rascunho'; 
                        const canEffectuateStatus = view === 'status' && report.status === 'Transferido' && isAdmin; 
                        const canCancelStatus = view === 'status' && report.status === 'Transferido' && isAdmin; 
                        return (
                          <tr key={report.id} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors">
                            <td className="px-6 py-4 text-[11px] font-bold text-gray-600 dark:text-gray-400">{new Date(report.createdAt).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                            <td className="px-6 py-4 text-xs font-black text-gray-800 dark:text-white">{report.requester}</td>
                            <td className="px-6 py-4">{report.isInstallmentWash ? <span className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-lg text-[9px] font-black border border-cyan-100 dark:border-cyan-800"><SparklesIcon className="w-3 h-3" /> Instalação/Lavagem</span> : <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[9px] font-black border border-indigo-100 dark:border-indigo-800"><DocumentReportIcon className="w-3 h-3" /> Reembolso</span>}</td>
                            <td className="px-6 py-4 text-right text-xs font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(report.totalValue)}</td>
                            <td className="px-6 py-4 text-center"><span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${report.status === 'Pago' ? 'bg-green-100 text-green-700' : report.status === 'Transferido' ? 'bg-blue-100 text-blue-700' : report.status === 'Env. p/ Pagamento' ? 'bg-orange-100 text-orange-700' : report.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{report.status}</span></td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-1.5 transition-opacity">
                                <button onClick={() => onEditReport?.(report)} className={`p-1.5 rounded-lg ${canEdit ? 'text-indigo-500 hover:bg-indigo-50' : 'text-blue-500 hover:bg-blue-50'}`} title={canEdit ? "Alterar" : "Visualizar"}>{canEdit ? <EditIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>
                                {view === 'historico' && canEffectuateHistory && (<button onClick={() => { setReportInAction(report); setIsConfirmEfetivarHistoricoModal(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Efetivar reembolso"><CheckCircleIcon className="w-4 h-4" /></button>)}
                                {canEffectuateStatus && (<button onClick={() => { setReportInAction(report); setIsConfirmEfetivarStatusModal(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Aprovar p/ pagamento"><CheckCircleIcon className="w-4 h-4" /></button>)}
                                {canCancelStatus && (<button onClick={() => { setReportInAction(report); setIsCancelModalOpen(true); }} className="p-1.5 text-red-600 hover:bg-green-50 rounded-lg" title="Cancelar reembolso"><XCircleIcon className="w-5 h-5" /></button>)}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>
      );
    }
    return (
      <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-10">
          {reportToEdit?.status === 'Cancelado' && reportToEdit.cancelReason && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-900/50 p-5 rounded-2xl flex items-start gap-4 shadow-sm animate-fade-in">
              <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-lg shrink-0"><ExclamationTriangleIcon className="w-6 h-6" /></div>
              <div><h4 className="text-sm font-black text-red-700 dark:text-red-400 tracking-tight">Reembolso cancelado</h4><p className="text-[12px] font-bold text-red-600 dark:text-red-500/80 mt-1 leading-relaxed">Motivo: <span className="text-gray-800 dark:text-gray-100">{reportToEdit.cancelReason}</span></p></div>
            </div>
          )}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><DocumentReportIcon className="w-6 h-6 text-white" /></div>
              <div><h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{isReadOnly ? 'Visualizar reembolso' : reportToEdit ? 'Alterar reembolso' : 'Novo reembolso'}</h1><div className="flex items-center gap-2 mt-0.5">{reportToEdit?.status && (<span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${reportToEdit.status === 'Pago' ? 'bg-green-100 text-green-700' : reportToEdit.status === 'Transferido' ? 'bg-blue-100 text-blue-700' : reportToEdit.status === 'Env. p/ Pagamento' ? 'bg-orange-100 text-orange-700' : reportToEdit.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{reportToEdit.status}</span>)}<span className="text-[10px] text-gray-400 font-bold tracking-tight">RD / Reembolso</span></div></div>
            </div>
            {!isReadOnly && (
              <div className="flex gap-2">
                <button onClick={async () => { 
                  if (!solicitante || !periodStart || !periodEnd) { alert("Preencha solicitante e período."); return; } 
                  setIsLoading(true);
                  try {
                    const itemsList = items.filter(i => i.date || i.description).map(i => ({...i, id: i.id || String(Math.random())}));
                    if (!validateItemsDates(itemsList)) { setIsLoading(false); return; }
                    await dataService.save('expense_reports', { id: reportToEdit?.id || String(Date.now()), owner_id: reportToEdit?.owner_id || currentUser.id, requester: solicitante, sector: setor, period: `${periodStart} a ${periodEnd}`, periodStart, periodEnd, items: itemsList, attachments, kmValueUsed: valorPorKm, status: 'Rascunho', createdAt: reportToEdit?.createdAt || new Date().toISOString(), totalValue: itemsList.reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100) + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0), 0) });
                    setModalMessage("Rascunho salvo!"); setSuccessModalOpen(true); await loadReports(); 
                  } catch (e: any) { alert("Erro rascunho: " + e.message); } finally { setIsLoading(false); }
                }} className="px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-600 border border-gray-200 rounded-xl font-bold text-xs">Salvar rascunho</button>
                <button onClick={() => { 
                  if (!solicitante || !periodStart || !periodEnd) { alert("Preencha solicitante e período."); return; } 
                  const itemsList = items.filter(i => i.date || i.description).map(i => ({...i, id: i.id || String(Math.random())})); 
                  if (!validateItemsDates(itemsList)) return; 
                  setReportInAction({ id: reportToEdit?.id || String(Date.now()), owner_id: reportToEdit?.owner_id || currentUser.id, requester: solicitante, sector: setor, period: `${periodStart} a ${periodEnd}`, periodStart, periodEnd, items: itemsList, attachments, kmValueUsed: valorPorKm, status: 'Rascunho', createdAt: reportToEdit?.createdAt || new Date().toISOString(), totalValue: itemsList.reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100) + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0), 0) }); 
                  setIsConfirmEfetivarHistoricoModal(true); 
                }} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Efetivar reembolso</button>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"><SectionTitle><span className="text-[11px] font-black text-gray-400 mr-1">01.</span> Dados do solicitante</SectionTitle><div className="grid grid-cols-1 md:grid-cols-12 gap-6"><div className="md:col-span-4"><FormLabel>Solicitante</FormLabel><div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100"><div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px]">{solicitante.substring(0, 1).toUpperCase()}</div><span className="text-xs font-black text-gray-700 dark:text-gray-200">{solicitante}</span></div></div><div className="md:col-span-4"><FormLabel>Setor / obra</FormLabel><input className="w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={setor} onChange={(e:any) => setSetor(e.target.value)} disabled={isReadOnly} /></div><div className="md:col-span-4"><FormLabel>Período</FormLabel><div className="flex items-center gap-2"><input className="w-full rounded-lg border-gray-200 bg-white dark:bg-gray-800 p-2.5 text-xs font-bold" type="date" value={periodStart} onChange={(e:any) => setPeriodStart(e.target.value)} disabled={isReadOnly} />- <input className="w-full rounded-lg border-gray-200 bg-white dark:bg-gray-800 p-2.5 text-xs font-bold" type="date" value={periodEnd} onChange={(e:any) => setPeriodEnd(e.target.value)} disabled={isReadOnly} /></div></div></div></div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"><div className="p-5 border-b flex justify-between items-center"><h3 className="text-xs font-black text-gray-800 dark:text-white flex items-center gap-2"><TableIcon className="w-4 h-4 text-indigo-600" /> Detalhamento de gastos</h3><div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black border">Custo km: R$ {valorPorKm.toFixed(2)}</div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-gray-50 dark:bg-gray-800 text-[9px] font-bold text-gray-400"><tr><th className="px-6 py-4">Data / finalidade</th><th className="px-4 py-4 text-center">Km</th><th className="px-4 py-4 text-center">Pedágio</th><th className="px-4 py-4 text-center">Alim.</th><th className="px-4 py-4 text-center">Comp.</th><th className="px-4 py-4 text-center">Outros</th><th className="px-6 py-4 text-right">Subtotal</th>{!isReadOnly && <th className="px-4 w-10"></th>}</tr></thead><tbody className="divide-y">{items.map((item) => (<tr key={item.id} className="hover:bg-indigo-50/10 group"><td className="px-6 py-3 min-w-[280px]"><div className="flex gap-2 items-center"><input type="date" value={item.date} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, date:e.target.value}:x))} disabled={isReadOnly} className="bg-transparent text-[11px] font-bold outline-none text-indigo-600" /><input type="text" value={item.description} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, description:e.target.value}:x))} disabled={isReadOnly} className="bg-transparent text-[11px] font-bold text-gray-700 dark:text-gray-200 outline-none flex-1" /></div></td><td className="px-2 py-3"><input type="number" value={item.km || ''} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, km:parseFloat(e.target.value)||0}:x))} disabled={isReadOnly} className="w-full text-center bg-transparent text-[11px] font-black text-indigo-600 outline-none" /></td>{['toll', 'food', 'components', 'others'].map(field => (<td key={field} className="px-2 py-3"><input type="number" value={(item as any)[field] || ''} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, [field]:parseFloat(e.target.value)||0}:x))} disabled={isReadOnly} className="w-full text-right bg-transparent text-[11px] font-bold outline-none" placeholder="0,00" /></td>))}<td className="px-6 py-3 text-right font-black text-gray-900 dark:text-white">{formatCurrency(Math.ceil(((item.km || 0)*valorPorKm)*100)/100 + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0))}</td>{!isReadOnly && (<td className="px-4 py-3"><button onClick={() => setItems(p => p.filter(i => i.id !== item.id))} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500"><TrashIcon className="w-4 h-4" /></button></td>)}</tr>))}</tbody></table></div>{!isReadOnly && (<div className="p-4 bg-gray-50/30"><button onClick={() => setItems([...items, { id: Date.now().toString(), date: '', description: '', km: 0, toll: 0, food: 0, components: 0, others: 0 }])} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-100 text-gray-400 hover:text-indigo-600 rounded-xl font-black text-[10px]"><PlusIcon className="w-4 h-4" /> Adicionar linha</button></div>)}</div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6"><div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"><SectionTitle color="bg-amber-500"><span className="text-[11px] font-black text-gray-400 mr-1">02.</span> Comprovantes</SectionTitle><div className="grid grid-cols-4 gap-3">{attachments.map((file, idx) => {
              const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
              return (
              <div key={idx} className="group relative aspect-square bg-gray-50 dark:bg-gray-900 rounded-xl border overflow-hidden shadow-sm flex items-center justify-center">
                  {isPdf ? <DocumentReportIcon className="w-8 h-8 text-red-500" /> : <img src={file.data} className="w-full h-full object-cover" alt="" />}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-10">
                      <button onClick={() => handleViewFile(file)} className="p-1.5 bg-white text-gray-900 rounded-full shadow-lg hover:bg-indigo-50" title="Visualizar"><EyeIcon className="w-4 h-4" /></button>
                      <button onClick={() => handleDownloadFile(file)} className="p-1.5 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700" title="Baixar"><ArrowDownIcon className="w-4 h-4" /></button>
                  </div>
              </div>
          )})} {!isReadOnly && <button onClick={() => attachmentInputRef.current?.click()} className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-indigo-100 rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"><UploadIcon className="w-6 h-6 mb-1" /><span className="text-[9px] font-black tracking-tighter">Anexar</span></button>}</div><input type="file" multiple className="hidden" ref={attachmentInputRef} accept="image/*,application/pdf" onChange={e => { const files = e.target.files; if (!files) return; (Array.from(files) as File[]).forEach(file => { const reader = new FileReader(); reader.onload = ev => { if (typeof ev.target?.result === 'string') setAttachments(p => [...p, { name: file.name, data: ev.target!.result as string }]); }; reader.readAsDataURL(file); }); e.target.value = ''; }} /></div><div className="lg:col-span-5"><div className="bg-indigo-600 rounded-xl p-6 text-white shadow-xl shadow-indigo-100 dark:shadow-none sticky top-6"><h3 className="text-sm font-black mb-6 flex items-center gap-2 opacity-80"><DollarIcon className="w-4 h-4" /> Resumo financeiro</h3><div className="space-y-3.5 mb-6">{[{ label: "Total em km", val: (items || []).reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100), 0) }, { label: "Total em pedágios", val: (items || []).reduce((acc, item) => acc + (item.toll || 0), 0) }, { label: "Total alimentação", val: (items || []).reduce((acc, item) => acc + (item.food || 0), 0) }, { label: "Compra de componentes", val: (items || []).reduce((acc, item) => acc + (item.components || 0), 0) }, { label: "Outros custos", val: (items || []).reduce((acc, item) => acc + (item.others || 0), 0) }].map(row => (<div key={row.label} className="flex justify-between items-center text-[11px] font-medium border-b border-white/10 pb-2.5 last:border-0 last:pb-0"><span className="opacity-70">{row.label}</span><span className="font-black">{formatCurrency(row.val)}</span></div>))}</div><div className="pt-5 border-t border-white/20"><p className="text-[10px] font-black opacity-60 mb-1">Valor total a receber</p><p className="text-3xl font-black leading-none">{formatCurrency((items || []).reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100) + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0), 0))}</p></div></div></div></div>
      </div>
    );
  };

  return (
    <>
        {renderContent()}
        {isConfirmEfetivarHistoricoModal && (
            <Modal title="Confirmar efetivação" onClose={() => setIsConfirmEfetivarHistoricoModal(false)}>
                <div className="text-center p-4 space-y-4">
                    <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto" />
                    <h3 className="text-sm font-bold">Deseja efetivar o reembolso?</h3>
                    <p className="text-[10px] text-gray-500">O status mudará para 'Transferido' e a edição será bloqueada.</p>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setIsConfirmEfetivarHistoricoModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold">Não</button>
                        <button onClick={handleEfetivarHistorico} disabled={isLoading} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">Sim, efetivar</button>
                    </div>
                </div>
            </Modal>
        )}
        {isConfirmEfetivarStatusModal && (
            <Modal title="Aprovar para pagamento" onClose={() => setIsConfirmEfetivarStatusModal(false)}>
                <div className="text-center p-4 space-y-4">
                    <DollarIcon className="w-12 h-12 text-indigo-600 mx-auto" />
                    <h3 className="text-sm font-bold">Deseja aprovar este reembolso?</h3>
                    <p className="text-[10px] text-gray-500">{reportInAction?.isInstallmentWash ? "Esta ação autoriza o pagamento e marca os itens vinculados como 'Liberados' no financeiro." : "Esta ação criará um lançamento no financeiro para pagamento em 7 dias."}</p>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setIsConfirmEfetivarStatusModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold">Não</button>
                        <button onClick={handleEfetivarStatus} disabled={isLoading} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg">Sim, aprovar</button>
                    </div>
                </div>
            </Modal>
        )}
        {isCancelModalOpen && (
            <Modal title="Cancelar reembolso" onClose={() => setIsCancelModalOpen(false)}>
                <div className="space-y-4">
                    <div><FormLabel>Motivo do cancelamento *</FormLabel><textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/20" placeholder="Motivo..." rows={4} /></div>
                    <div className="flex gap-3"><button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold">Voltar</button><button onClick={handleCancelarStatus} disabled={isLoading || !cancelReason.trim()} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg">Confirmar</button></div>
                </div>
            </Modal>
        )}
        {isSuccessModalOpen && (
            <Modal title="" onClose={handleSuccessModalClose}>
                <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce"><CheckCircleIcon className="w-10 h-10" /></div>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Concluído!</h3>
                    <p className="text-xs font-bold text-gray-500 px-4 leading-relaxed">{modalMessage}</p>
                    <button onClick={handleSuccessModalClose} className="w-full mt-4 py-3 bg-gray-900 text-white rounded-xl font-bold text-xs">Ok, entendi</button>
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
    </>
  );
};

export default RelatoriosPage;
