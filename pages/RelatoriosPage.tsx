
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
    ChartPieIcon, PrinterIcon, PlusIcon, TrashIcon, 
    CogIcon, SaveIcon, EditIcon, ClipboardListIcon, 
    CheckCircleIcon, DollarIcon, ExclamationTriangleIcon, 
    DocumentReportIcon, XCircleIcon, LockClosedIcon,
    ArrowLeftIcon, EyeIcon, CalendarIcon, TableIcon, FilterIcon, UsersIcon, ChevronDownIcon,
    UploadIcon, PhotographIcon, ClockIcon, SearchIcon, TrendUpIcon, SparklesIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { 
    ResponsiveContainer, PieChart, Pie, Cell, 
    Tooltip as RechartsTooltip, Legend, BarChart, 
    Bar, XAxis, YAxis, CartesianGrid 
} from 'recharts';
import type { RelatoriosPageProps, ExpenseReportItem, ExpenseReport, ExpenseReportStatus, ExpenseAttachment, FinancialCategory, FinancialTransaction } from '../types';
import { dataService } from '../services/dataService';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">{children}</label>
);

const SectionTitle: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = "bg-indigo-500" }) => (
    <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide border-b border-gray-100 dark:border-gray-700 pb-2 mb-4 flex items-center gap-2">
        <span className={`w-1 h-4 ${color} rounded-full`}></span>
        {children}
    </h3>
);

const RelatoriosPage: React.FC<RelatoriosPageProps> = ({ view, reportToEdit, onSave, onEditReport, currentUser }) => {
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

  const [isEditingKm, setIsEditingKm] = useState(false);
  const [isEditingInst, setIsEditingInst] = useState(false);

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

  const isAdmin = useMemo(() => currentUser.profileId === '001' || currentUser.profileId === '00000000-0000-0000-0000-000000000001', [currentUser]);

  const isReadOnly = useMemo(() => reportToEdit ? reportToEdit.status !== 'Rascunho' : false, [reportToEdit]);

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
    } catch (e) { 
        console.error("Erro ao carregar relatórios:", e); 
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, isAdmin]);

  const loadConfig = useCallback(async () => {
      try {
          const remoteConfigs = await dataService.getAll<any>('system_configs', undefined, true);
          const remoteKm = remoteConfigs.find(c => c.id === 'km_value');
          const remoteInst = remoteConfigs.find(c => c.id === 'installation_value');

          if (remoteKm) {
              const val = parseFloat(remoteKm.value);
              setConfigKmValue(val);
              setValorPorKm(val);
          }
          if (remoteInst) {
              const val = parseFloat(remoteInst.value);
              setConfigInstValue(val);
          }
      } catch (e) {
          console.error("Erro ao sincronizar configurações remotas:", e);
      }
  }, []);

  useEffect(() => { 
    loadReports(); 
    loadConfig();

    const date = new Date();
    const filterStartDefault = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const filterEndDefault = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    setFilterStart(filterStartDefault);
    setFilterEnd(filterEndDefault);

    const handleClickOutside = (event: MouseEvent) => {
        if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
            setIsUserDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [view, loadReports, loadConfig]);

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
            setSetor(''); 
            setPeriodStart(''); 
            setPeriodEnd(''); 
            setItems([{ id: Date.now().toString(), date: '', description: '', km: 0, toll: 0, food: 0, components: 0, others: 0 }]); 
            setAttachments([]);
            setValorPorKm(configKmValue);
        }
    }
  }, [view, reportToEdit, currentUser, configKmValue]);

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
        } else {
            return [...newSelection, user];
        }
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
    
    let totalKmValue = 0;
    let totalTollValue = 0;
    let totalFoodValue = 0;
    let totalComponentsValue = 0;
    let totalOthersValue = 0;

    filtered.forEach(r => { 
        if (r.status === 'Pago') { 
            r.items.forEach(item => {
                totalKmValue += Math.ceil(((item.km || 0) * (r.kmValueUsed || 1.20)) * 100) / 100;
                totalTollValue += (item.toll || 0);
                totalFoodValue += (item.food || 0);
                totalComponentsValue += (item.components || 0);
                totalOthersValue += (item.others || 0);
            });
        } 
    });

    const pieData = [
        { name: 'Km rodado', value: totalKmValue },
        { name: 'Pedágios', value: totalTollValue },
        { name: 'Alimentação', value: totalFoodValue },
        { name: 'Componentes', value: totalComponentsValue },
        { name: 'Outros', value: totalOthersValue }
    ].filter(d => d.value > 0);

    const monthlyGroups: Record<string, number> = {};
    filtered.filter(r => r.status === 'Pago').forEach(r => {
        const month = new Date(r.createdAt).toLocaleString('pt-BR', { month: 'short', year: '2-digit' });
        monthlyGroups[month] = (monthlyGroups[month] || 0) + r.totalValue;
    });

    const barData = Object.entries(monthlyGroups).map(([name, value]) => ({ name, value }));

    return { paid, pending, filteredReports: filtered, totalKmValue, totalTollValue, totalFoodValue, totalComponentsValue, totalOthersValue, pieData, barData };
  }, [reports, filterStart, filterEnd, selectedUserFilter]);

  const validateItemsDates = (reportItems: ExpenseReportItem[]): boolean => {
      if (!periodStart || !periodEnd) return true;
      const invalidItem = reportItems.find(item => {
          if (!item.date) return false;
          return item.date < periodStart || item.date > periodEnd;
      });
      if (invalidItem) {
          const itemDate = new Date(invalidItem.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
          const start = new Date(periodStart).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
          const end = new Date(periodEnd).toLocaleDateString('pt-BR', {timeZone: 'UTC'});
          alert(`ERRO DE DATA: O gasto "${invalidItem.description || 'sem descrição'}" possui data (${itemDate}) fora do período de referência informado (${start} a ${end}).`);
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
        setModalMessage("Solicitação de pagamento efetivada com sucesso! Agora disponível para análise.");
        setSuccessModalOpen(true);
        await loadReports();
    } catch (e: any) { 
        console.error(e); 
        alert("Erro ao salvar no banco de dados. Verifique a conexão.");
    } finally { 
        setIsLoading(false); 
        setIsConfirmEfetivarHistoricoModal(false);
        setReportInAction(null);
    }
  };

  const handleEfetivarStatus = async () => {
    if (!reportInAction) return;
    setIsLoading(true);
    try {
        if (reportInAction.isInstallmentWash) {
            // Sincroniza flag de invoiceSent nos lançamentos financeiros originais para destacar no sinaleiro
            const txIds = reportInAction.items.map(i => i.id);
            const allTxs = await dataService.getAll<FinancialTransaction>('financial_transactions');
            const targetTxs = allTxs.filter(t => txIds.includes(t.id));
            
            for (const tx of targetTxs) {
                await dataService.save('financial_transactions', { ...tx, invoiceSent: true, relatedReportId: reportInAction.id });
            }
        } else {
            const financialCategories = await dataService.getAll<FinancialCategory>('financial_categories');
            let category = financialCategories.find(c => c.name === 'Solicitação Pagto RD');
            if (!category) {
                category = await dataService.save('financial_categories', {
                    id: `cat-reemb-${Date.now()}`, 
                    name: 'Solicitação Pagto RD', 
                    type: 'despesa',
                    classification: 'DESPESA_OPERACIONAL', 
                    group: 'Solicitações Pagto', 
                    active: true, 
                    showInDre: true
                });
            }
            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 7);
            const formattedDueDate = dueDate.toISOString().split('T')[0];
            
            await dataService.save('financial_transactions', {
                id: `tx-reemb-${reportInAction.id}`, 
                owner_id: reportInAction.owner_id,
                description: `Solicitação: ${reportInAction.requester} (${reportInAction.period})`,
                amount: reportInAction.totalValue, 
                type: 'despesa', 
                dueDate: formattedDueDate,
                launchDate: new Date().toISOString().split('T')[0], 
                categoryId: category.id, 
                status: 'pendente'
            });
        }
        
        await dataService.save('expense_reports', { ...reportInAction, status: 'Env. p/ Pagamento' });
        
        const customMessage = reportInAction.isInstallmentWash 
            ? "Faturamento técnico aprovado! Os lançamentos no financeiro agora estão destacados para pagamento."
            : "Solicitação efetivada! Transação criada em 'Contas a Pagar' com vencimento em 7 dias.";
            
        setModalMessage(customMessage);
        setSuccessModalOpen(true);
        await loadReports();
    } catch (e: any) { 
        console.error(e); 
        alert("Erro ao processar aprovação."); 
    } finally { 
        setIsLoading(false); 
        setIsConfirmEfetivarStatusModal(false); 
        setReportInAction(null); 
    }
  };

  const handleCancelarStatus = async () => {
      if (!reportInAction || !cancelReason.trim()) { alert("Por favor, informe o motivo do cancelamento."); return; }
      setIsLoading(true);
      try {
          await dataService.save('expense_reports', { ...reportInAction, status: 'Cancelado', cancelReason: cancelReason });
          const allTxs = await dataService.getAll<any>('financial_transactions');
          const relatedTx = allTxs.find(t => t.id === `tx-reemb-${reportInAction.id}`);
          if (relatedTx) {
              await dataService.save('financial_transactions', { 
                  ...relatedTx, 
                  status: 'cancelado', 
                  cancelReason: `Solicitação cancelada via RD: ${cancelReason}` 
              });
          }
          
          if (reportInAction.isInstallmentWash) {
              const txIds = reportInAction.items.map(i => i.id);
              const targetTxs = allTxs.filter(t => txIds.includes(t.id));
              for (const tx of targetTxs) {
                  await dataService.save('financial_transactions', { ...tx, invoiceSent: false });
              }
          }

          setModalMessage("Solicitação cancelada com sucesso.");
          setSuccessModalOpen(true);
          await loadReports();
      } catch (e: any) { 
          console.error(e); 
          alert("Erro ao cancelar solicitação.");
      } finally { 
          setIsLoading(false); 
          setIsCancelModalOpen(false); 
          setReportInAction(null); 
          setCancelReason(''); 
      }
  };

  const handleSuccessModalClose = () => {
    setSuccessModalOpen(false);
    if (view === 'reembolso' && onSave) onSave();
  };

  const handleViewFile = (file: ExpenseAttachment) => {
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
    if (isPdf) {
        const link = document.createElement('a');
        link.href = file.data;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        setHdPhoto(file.data);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const handleSaveKmConfig = async () => {
      setIsLoading(true);
      try {
          await dataService.save('system_configs', { id: 'km_value', value: configKmValue.toString() });
          setValorPorKm(configKmValue);
          setIsEditingKm(false);
          alert('Configuração salva com sucesso!');
      } catch (e: any) {
          alert('Erro ao salvar configuração.');
      } finally { setIsLoading(false); }
  };

  const handleSaveInstConfig = async () => {
      setIsLoading(true);
      try {
          await dataService.save('system_configs', { id: 'installation_value', value: configInstValue.toString() });
          setIsEditingInst(false);
          alert('Configuração salva com sucesso!');
      } catch (e: any) {
          alert('Erro ao salvar configuração.');
      } finally { setIsLoading(false); }
  };

  const renderContent = () => {
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
                      <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-700 min-w-[220px] transition-all hover:bg-gray-100 dark:hover:bg-gray-700">
                          <UsersIcon className="w-4 h-4 text-gray-400" />
                          <span className="text-[11px] font-bold text-gray-700 dark:text-white truncate flex-1 text-left">{selectedUserFilter.includes('Todos') ? 'Todos os usuários' : `${selectedUserFilter.length} usuário(s) selecionado(s)`}</span>
                          <ChevronDownIcon className={`w-4 h-4 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isUserDropdownOpen && (
                          <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 py-2 max-h-64 overflow-y-auto custom-scrollbar animate-fade-in">
                              <label className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group">
                                  <input type="checkbox" className="hidden" checked={selectedUserFilter.includes('Todos')} onChange={() => toggleUserSelection('Todos')} />
                                  <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${selectedUserFilter.includes('Todos') ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>{selectedUserFilter.includes('Todos') && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div>
                                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Selecionar Todos</span>
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
              <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all shadow-lg active:scale-95"><PrinterIcon className="w-4 h-4" /> Imprimir Relatório</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard title="Solicitações pagas" value={formatCurrency(analysisData.paid)} icon={CheckCircleIcon} color="bg-green-500" />
              <DashboardCard title="Em aprovação" value={formatCurrency(analysisData.pending)} icon={ClockIcon} color="bg-indigo-500" />
              <DashboardCard title="Total em Km" value={formatCurrency(analysisData.totalKmValue)} icon={TrendUpIcon} color="bg-blue-500" />
              <DashboardCard title="Total Pedágio" value={formatCurrency(analysisData.totalTollValue)} icon={DollarIcon} color="bg-purple-500" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
                  <SectionTitle color="bg-indigo-500">Distribuição por Categoria (Pagas)</SectionTitle>
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
                      ) : (<div className="h-full flex items-center justify-center text-gray-400 text-xs font-bold italic">Sem dados pagos no período selecionado.</div>)}
                  </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 h-[400px] flex flex-col">
                  <SectionTitle color="bg-teal-500">Evolução Mensal de Pagamentos</SectionTitle>
                  <div className="flex-1">
                      {analysisData.barData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={analysisData.barData}>
                                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.1} />
                                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} />
                                  <YAxis hide />
                                  <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
                                  <Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} />
                              </BarChart>
                          </ResponsiveContainer>
                      ) : (<div className="h-full flex items-center justify-center text-gray-400 text-xs font-bold italic">Sem histórico de pagamentos.</div>)}
                  </div>
              </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
              <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <TableIcon className="w-5 h-5 text-indigo-600" /> Detalhamento mensal por campo
                  </h3>
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-900/50 text-[10px] font-black text-gray-400 tracking-tight">
                          <tr>
                              <th className="px-6 py-4 text-left">Data/Solicitante</th>
                              <th className="px-6 py-4 text-right">Km rodado</th>
                              <th className="px-6 py-4 text-right">Pedágios</th>
                              <th className="px-6 py-4 text-right">Alimentação</th>
                              <th className="px-6 py-4 text-right">Componentes</th>
                              <th className="px-6 py-4 text-right">Outros</th>
                              <th className="px-6 py-4 text-right bg-indigo-50/50 dark:bg-indigo-900/20 font-black text-indigo-600">Total pago</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {analysisData.filteredReports.filter(r => r.status === 'Pago').map(r => {
                              const rTotals = r.items.reduce((acc, item) => ({
                                  km: acc.km + (Math.ceil(((item.km || 0) * (r.kmValueUsed || 1.20)) * 100) / 100),
                                  toll: acc.toll + (item.toll || 0), food: acc.food + (item.food || 0),
                                  comp: acc.comp + (item.components || 0), other: acc.other + (item.others || 0),
                              }), { km: 0, toll: 0, food: 0, comp: 0, other: 0 });
                              return (
                                  <tr key={r.id} className="hover:bg-indigo-50/20 transition-colors">
                                      <td className="px-6 py-4"><div className="font-bold text-gray-800 dark:text-white">{r.requester}</div><div className="text-[10px] text-gray-400">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</div></td>
                                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(rTotals.km)}</td>
                                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(rTotals.toll)}</td>
                                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(rTotals.food)}</td>
                                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(rTotals.comp)}</td>
                                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(rTotals.other)}</td>
                                      <td className="px-6 py-4 text-right font-black text-indigo-600 bg-indigo-50/20 dark:bg-indigo-900/10">{formatCurrency(r.totalValue)}</td>
                                  </tr>
                              );
                          })}
                          {analysisData.filteredReports.filter(r => r.status === 'Pago').length === 0 && (<tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400 italic font-bold">Nenhuma solicitação paga encontrada para os filtros ativos.</td></tr>)}
                      </tbody>
                      <tfoot className="bg-gray-50 dark:bg-gray-900/50 font-black border-t">
                          <tr>
                              <td className="px-6 py-4 text-gray-900 dark:text-white text-[10px] font-bold">Totais do período</td>
                              <td className="px-6 py-4 text-right text-indigo-600">{formatCurrency(analysisData.totalKmValue)}</td>
                              <td className="px-6 py-4 text-right text-indigo-600">{formatCurrency(analysisData.totalTollValue)}</td>
                              <td className="px-6 py-4 text-right text-indigo-600">{formatCurrency(analysisData.totalFoodValue)}</td>
                              <td className="px-6 py-4 text-right text-indigo-600">{formatCurrency(analysisData.totalComponentsValue)}</td>
                              <td className="px-6 py-4 text-right text-indigo-600">{formatCurrency(analysisData.totalOthersValue)}</td>
                              <td className="px-6 py-4 text-right bg-indigo-600 text-white shadow-xl">{formatCurrency(analysisData.paid)}</td>
                          </tr>
                      </tfoot>
                  </table>
              </div>
          </div>
      </div>
    );

    if (view === 'config') return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-20">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-5 mb-10 pb-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                        <CogIcon className="w-7 h-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Configurações Gerais</h2>
                        <p className="text-sm text-gray-500 font-bold mt-1">Defina os parâmetros globais para cálculos do sistema.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <SectionTitle color="bg-blue-500">Parâmetros de solicitação</SectionTitle>
                        <div className={`p-6 rounded-2xl border-2 transition-all group ${isEditingKm ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-400' : 'bg-gray-50 dark:bg-gray-950 border-transparent hover:border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-3 ml-0.5">
                                <FormLabel>Valor padrão por Km rodado (R$)</FormLabel>
                                {isEditingKm ? (
                                    <button 
                                        onClick={handleSaveKmConfig} 
                                        disabled={isLoading}
                                        className="text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg"
                                    >
                                        {isLoading ? '...' : 'Salvar'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => setIsEditingKm(true)} 
                                        className="text-[11px] font-black text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg"
                                    >
                                        Editar
                                    </button>
                                )}
                            </div>
                            <div className="relative mt-2">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm ${isEditingKm ? 'text-indigo-600' : 'text-gray-400'}`}>R$</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    disabled={!isEditingKm || isLoading}
                                    value={configKmValue} 
                                    onChange={(e) => setConfigKmValue(parseFloat(e.target.value) || 0)} 
                                    className={`w-full border-2 rounded-xl py-3.5 pl-11 pr-4 text-sm font-black outline-none transition-all ${isEditingKm ? 'bg-white dark:bg-gray-900 border-indigo-500 text-indigo-700' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <SectionTitle color="bg-green-500">Parâmetros de orçamento</SectionTitle>
                        <div className={`p-6 rounded-2xl border-2 transition-all group ${isEditingInst ? 'bg-green-50 dark:bg-green-950/40 border-green-400' : 'bg-gray-50 dark:bg-gray-950 border-transparent hover:border-gray-200'}`}>
                            <div className="flex justify-between items-center mb-3 ml-0.5">
                                <FormLabel>Valor por instalação por placa solar (R$)</FormLabel>
                                {isEditingInst ? (
                                    <button 
                                        onClick={handleSaveInstConfig} 
                                        disabled={isLoading}
                                        className="text-[11px] font-black text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1 rounded-lg"
                                    >
                                        {isLoading ? '...' : 'Salvar'}
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => setIsEditingInst(true)} 
                                        className="text-[11px] font-black text-green-600 hover:text-green-700 bg-indigo-50 px-3 py-1 rounded-lg"
                                    >
                                        Editar
                                    </button>
                                )}
                            </div>
                            <div className="relative mt-2">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-black text-sm ${isEditingInst ? 'text-green-600' : 'text-gray-400'}`}>R$</span>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    disabled={!isEditingInst || isLoading}
                                    value={configInstValue} 
                                    onChange={(e) => setConfigInstValue(parseFloat(e.target.value) || 0)} 
                                    className={`w-full border-2 rounded-xl py-3.5 pl-11 pr-4 text-sm font-black outline-none transition-all ${isEditingInst ? 'bg-white dark:bg-gray-900 border-green-500 text-green-700' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    if (view === 'status' || view === 'historico') {
      const listReports = (isAdmin ? reports : reports.filter(r => r.owner_id === currentUser.id)).filter(r => statusFilterValue === 'Todos' || r.status === statusFilterValue);
      return (
          <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-10">
              <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100"><CheckCircleIcon className="w-6 h-6" /></div>
                  <div><h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{view === 'status' ? 'Status de solicitação' : 'Histórico de solicitação'}</h1><p className="text-[11px] text-gray-400 font-bold tracking-tight">{isAdmin ? `Visão global da equipe (${listReports.length} itens)` : `Minhas solicitações (${listReports.length} itens)`}</p></div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm"><div className="max-w-xs"><FormLabel>Filtrar por status</FormLabel><div className="relative"><select value={statusFilterValue} onChange={(e) => setStatusFilterValue(e.target.value as any)} className="w-full bg-gray-50 dark:bg-gray-900 border-none rounded-lg px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none shadow-sm cursor-pointer"><option value="Todos">Todos os status</option><option value="Rascunho">Rascunho</option><option value="Transferido">Transferido</option><option value="Env. p/ Pagamento">Env. p/ Pagamento</option><option value="Pago">Pago</option><option value="Cancelado">Cancelado</option></select><div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-40"><ChevronDownIcon className="w-4 h-4" /></div></div></div></div>
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50/50 dark:bg-gray-900/40 text-[10px] font-black text-gray-400 tracking-tight border-b dark:border-gray-700">
                      <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Solicitante</th>
                        <th className="px-6 py-4">Origem</th>
                        <th className="px-6 py-4 text-right">Valor total</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center w-48">Ações</th>
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
                            <td className="px-6 py-4">
                              {report.isInstallmentWash ? (
                                  <span className="flex items-center gap-1.5 px-2 py-1 bg-cyan-50 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 rounded-lg text-[9px] font-black border border-cyan-100 dark:border-cyan-800">
                                      <SparklesIcon className="w-3 h-3" /> Técnico
                                  </span>
                              ) : (
                                  <span className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[9px] font-black border border-indigo-100 dark:border-indigo-800">
                                      <DocumentReportIcon className="w-3 h-3" /> Solicitação
                                  </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right text-xs font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(report.totalValue)}</td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-tighter ${report.status === 'Pago' ? 'bg-green-100 text-green-700' : report.status === 'Transferido' ? 'bg-blue-100 text-blue-700' : report.status === 'Env. p/ Pagamento' ? 'bg-orange-100 text-orange-700' : report.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{report.status}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center gap-1.5 transition-opacity">
                                <button onClick={() => onEditReport?.(report)} className={`p-1.5 rounded-lg ${canEdit ? 'text-indigo-500 hover:bg-indigo-50' : 'text-blue-500 hover:bg-blue-50'}`} title={canEdit ? "Alterar" : "Visualizar"}>{canEdit ? <EditIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>
                                {view === 'historico' && canEffectuateHistory && (<button onClick={() => { setReportInAction(report); setIsConfirmEfetivarHistoricoModal(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Efetivar solicitação"><CheckCircleIcon className="w-4 h-4" /></button>)}
                                {canEffectuateStatus && (<button onClick={() => { setReportInAction(report); setIsConfirmEfetivarStatusModal(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Aprovar p/ Pagamento"><CheckCircleIcon className="w-4 h-4" /></button>)}
                                {canCancelStatus && (<button onClick={() => { setReportInAction(report); setIsCancelModalOpen(true); }} className="p-1.5 text-red-600 hover:bg-green-50 rounded-lg" title="Cancelar solicitação"><XCircleIcon className="w-5 h-5" /></button>)}
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
              <div className="p-2.5 bg-red-600 text-white rounded-xl shadow-lg shrink-0">
                <ExclamationTriangleIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-red-700 dark:text-red-400 tracking-tight">Solicitação Reprovada / Cancelada</h4>
                <p className="text-[12px] font-bold text-red-600 dark:text-red-500/80 mt-1 leading-relaxed">
                   Motivo: <span className="text-gray-800 dark:text-gray-100">{reportToEdit.cancelReason}</span>
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg"><DocumentReportIcon className="w-6 h-6 text-white" /></div>
              <div><h1 className="text-xl font-black text-gray-900 dark:text-white tracking-tight">{isReadOnly ? 'Visualizar solicitação' : reportToEdit ? 'Alterar solicitação' : 'Nova solicitação de pagamento'}</h1><div className="flex items-center gap-2 mt-0.5">{reportToEdit?.status && (<span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${reportToEdit.status === 'Pago' ? 'bg-green-100 text-green-700' : reportToEdit.status === 'Transferido' ? 'bg-blue-100 text-blue-700' : reportToEdit.status === 'Env. p/ Pagamento' ? 'bg-orange-100 text-orange-700' : reportToEdit.status === 'Cancelado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{reportToEdit.status}</span>)}<span className="text-[10px] text-gray-400 font-bold tracking-tight">Controle de solicitações</span></div></div>
            </div>
            {!isReadOnly && (
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={async () => { 
                  if (!solicitante || !periodStart || !periodEnd) { alert("Preencha solicitante e período."); return; } 
                  setIsLoading(true);
                  try {
                    const itemsList = items
                        .filter(i => i.date || i.description) 
                        .map(i => ({...i, id: i.id || String(Math.random())}));
                    
                    if (!validateItemsDates(itemsList)) { setIsLoading(false); return; }
                    
                    const report: ExpenseReport = { 
                        id: reportToEdit?.id || String(Date.now()), 
                        owner_id: reportToEdit?.owner_id || currentUser.id, 
                        requester: solicitante, sector: setor, 
                        period: `${periodStart} a ${periodEnd}`, 
                        periodStart, periodEnd, items: itemsList, 
                        attachments, kmValueUsed: valorPorKm, 
                        status: 'Rascunho', 
                        createdAt: reportToEdit?.createdAt || new Date().toISOString(), 
                        totalValue: itemsList.reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100) + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0), 0)
                    }; 
                    
                    await dataService.save('expense_reports', report); 
                    setModalMessage("Rascunho salvo com sucesso."); 
                    setSuccessModalOpen(true); 
                    await loadReports(); 
                  } catch (e: any) { 
                      alert("Erro ao salvar rascunho: " + (e.message || "Erro de conexão")); 
                  } finally { setIsLoading(false); }
                }} className="flex-1 md:flex-none px-6 py-2.5 bg-white dark:bg-gray-800 text-gray-600 border border-gray-200 rounded-xl font-bold text-xs">Salvar rascunho</button>
                
                <button onClick={() => { 
                  if (!solicitante || !periodStart || !periodEnd) { alert("Preencha solicitante e período."); return; } 
                  const itemsList = items
                    .filter(i => i.date || i.description)
                    .map(i => ({...i, id: i.id || String(Math.random())})); 
                  
                  if (!validateItemsDates(itemsList)) return; 
                  
                  setReportInAction({ 
                      id: reportToEdit?.id || String(Date.now()), 
                      owner_id: reportToEdit?.owner_id || currentUser.id, 
                      requester: solicitante, sector: setor, 
                      period: `${periodStart} a ${periodEnd}`, 
                      periodStart, periodEnd, items: itemsList, 
                      attachments, kmValueUsed: valorPorKm, 
                      status: 'Rascunho', 
                      createdAt: reportToEdit?.createdAt || new Date().toISOString(), 
                      totalValue: itemsList.reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100) + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0), 0)
                  }); 
                  setIsConfirmEfetivarHistoricoModal(true); 
                }} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 flex items-center justify-center gap-2"><CheckCircleIcon className="w-4 h-4" /> Efetivar solicitação</button>
              </div>
            )}
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
            <SectionTitle><span className="text-[11px] font-black text-gray-400 mr-1">01.</span> Dados do solicitante</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              <div className="md:col-span-4"><FormLabel>Solicitante</FormLabel><div className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100"><div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px]">{solicitante.substring(0, 1).toUpperCase()}</div><span className="text-xs font-black text-gray-700 dark:text-gray-200">{solicitante}</span></div></div>
              <div className="md:col-span-4"><FormLabel>Setor / obra</FormLabel><input className={`w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all disabled:bg-gray-50 dark:disabled:bg-gray-900/50 disabled:text-gray-400`} value={setor} onChange={(e:any) => setSetor(e.target.value)} disabled={isReadOnly} placeholder="Ex: Obra Centro SP" /></div>
              <div className="md:col-span-4"><FormLabel>Período de referência</FormLabel><div className="flex items-center gap-2"><input className={`w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all disabled:bg-gray-50 dark:disabled:bg-gray-900/50 disabled:text-gray-400`} type="date" value={periodStart} onChange={(e:any) => setPeriodStart(e.target.value)} disabled={isReadOnly} /><span className="text-gray-300 font-bold">-</span><input className={`w-full rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all disabled:bg-gray-50 dark:disabled:bg-gray-900/50 disabled:text-gray-400`} type="date" value={periodEnd} onChange={(e:any) => setPeriodEnd(e.target.value)} disabled={isReadOnly} /></div></div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="p-5 border-b border-gray-50 dark:bg-gray-800/50 flex justify-between items-center"><h3 className="text-xs font-black text-gray-800 dark:text-white flex items-center gap-2 tracking-tight"><TableIcon className="w-4 h-4 text-indigo-600" /> Detalhamento de gastos</h3><div className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-[9px] font-black border border-indigo-100">Custo km: R$ {valorPorKm.toFixed(2)}</div></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-800 text-[9px] font-black text-gray-400 tracking-tighter"><tr><th className="px-6 py-4">Data / finalidade</th><th className="px-4 py-4 text-center">Km</th><th className="px-4 py-4 text-center">Pedágio</th><th className="px-4 py-4 text-center">Alim.</th><th className="px-4 py-4 text-center">Comp.</th><th className="px-4 py-4 text-center">Outros</th><th className="px-6 py-4 text-right bg-gray-50/50">Subtotal</th>{!isReadOnly && <th className="px-4 py-4 w-10"></th>}</tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-6 py-3 min-w-[280px]">
                        <div className="flex gap-2 items-center">
                          <input type="date" value={item.date} min={periodStart} max={periodEnd} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, date:e.target.value}:x))} disabled={isReadOnly} className="bg-transparent text-[11px] font-bold outline-none w-24 text-indigo-600" />
                          <input type="text" placeholder="Descreva o gasto..." value={item.description} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, description:e.target.value}:x))} disabled={isReadOnly} className="bg-transparent text-[11px] font-bold text-gray-700 dark:text-gray-200 outline-none flex-1" />
                        </div>
                      </td>
                      <td className="px-2 py-3"><input type="number" value={item.km || ''} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, km:parseFloat(e.target.value)||0}:x))} disabled={isReadOnly} className="w-full text-center bg-transparent p-1 text-[11px] font-black text-indigo-600 outline-none border-b border-transparent focus:border-indigo-100" /></td>
                      {['toll', 'food', 'components', 'others'].map(field => (<td key={field} className="px-2 py-3"><input type="number" value={(item as any)[field] || ''} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, [field]:parseFloat(e.target.value)||0}:x))} disabled={isReadOnly} className="w-full text-right bg-transparent border-none px-1 py-1 text-[11px] font-bold text-gray-700 outline-none border-b border-transparent focus:border-indigo-100" placeholder="0,00" /></td>))}
                      <td className="px-6 py-3 text-right bg-gray-50/20"><span className="text-[11px] font-black text-gray-900 dark:text-white">{formatCurrency(Math.ceil(((item.km || 0)*valorPorKm)*100)/100 + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0))}</span></td>
                      {!isReadOnly && (<td className="px-4 py-3"><button onClick={() => setItems(p => p.filter(i => i.id !== item.id))} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-all"><TrashIcon className="w-4 h-4" /></button></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!isReadOnly && (<div className="p-4 bg-gray-50/30"><button onClick={() => setItems([...items, { id: Date.now().toString(), date: '', description: '', km: 0, toll: 0, food: 0, components: 0, others: 0 }])} className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-100 text-gray-400 hover:text-indigo-600 hover:border-indigo-100 transition-all rounded-xl font-black text-[10px] tracking-tight"><PlusIcon className="w-4 h-4" /> Adicionar linha de gasto</button></div>)}
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
                <SectionTitle color="bg-amber-500"><span className="text-[11px] font-black text-gray-400 mr-1">02.</span> Comprovantes e anexos</SectionTitle>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {attachments.map((file, idx) => { 
                        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf'); 
                        return (
                            <div key={idx} className="group relative aspect-square bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm flex items-center justify-center">
                                {isPdf ? (
                                    <div className="flex flex-col items-center gap-1 p-2 text-center">
                                        <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg text-red-600 dark:text-red-400">
                                            <DocumentReportIcon className="w-8 h-8" />
                                        </div>
                                        <span className="text-[8px] font-black text-gray-500 dark:text-gray-400 truncate max-w-full px-1">{file.name}</span>
                                    </div>
                                ) : (
                                    <img src={file.data} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={file.name} />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button onClick={() => handleViewFile(file)} className="p-1.5 bg-white text-gray-900 rounded-full shadow-lg hover:scale-110 transition-transform">
                                        <EyeIcon className="w-4 h-4" />
                                    </button>
                                    {!isReadOnly && <button onClick={() => setAttachments(p => p.filter((_, i) => i !== idx))} className="p-1.5 bg-red-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform">
                                        <TrashIcon className="w-4 h-4" />
                                    </button>}
                                </div>
                            </div>
                        );
                    })}
                    {!isReadOnly && (
                        <button onClick={() => attachmentInputRef.current?.click()} className="aspect-square flex flex-col items-center justify-center border-2 border-dashed border-indigo-100 rounded-xl text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                            <UploadIcon className="w-6 h-6 mb-1" />
                            <span className="text-[9px] font-black tracking-tighter">Anexar</span>
                        </button>
                    )}
                </div>
                <input type="file" multiple className="hidden" ref={attachmentInputRef} accept="image/*,application/pdf" onChange={e => { const files = e.target.files; if (!files) return; const filesArray = Array.from(files) as File[]; filesArray.forEach(file => { const reader = new FileReader(); reader.onload = (ev) => { const result = ev.target?.result; if (typeof result === 'string') { setAttachments(prev => [...prev, { name: file.name, data: result }]); } }; reader.readAsDataURL(file); }); e.target.value = ''; }} />
            </div>
            <div className="lg:col-span-5">
                <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-xl shadow-indigo-100 dark:shadow-none sticky top-6">
                    <h3 className="text-sm font-black mb-6 flex items-center gap-2 tracking-tight opacity-80"><DollarIcon className="w-4 h-4" /> Resumo financeiro</h3>
                    <div className="space-y-3.5 mb-6">
                        {[{ label: "Total em Km", val: (items || []).reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100), 0) }, { label: "Total em Pedágios", val: (items || []).reduce((acc, item) => acc + (item.toll || 0), 0) }, { label: "Total Alimentação", val: (items || []).reduce((acc, item) => acc + (item.food || 0), 0) }, { label: "Compra de Componentes", val: (items || []).reduce((acc, item) => acc + (item.components || 0), 0) }, { label: "Outros Custos", val: (items || []).reduce((acc, item) => acc + (item.others || 0), 0) }].map(row => (<div key={row.label} className="flex justify-between items-center text-[11px] font-medium border-b border-white/10 pb-2.5 last:border-0 last:pb-0"><span className="opacity-70">{row.label}</span><span className="font-black tracking-tight">{formatCurrency(row.val)}</span></div>))}
                    </div>
                    <div className="pt-5 border-t border-white/20">
                        <p className="text-[10px] font-black tracking-tight opacity-60 mb-1">Valor total a receber</p>
                        <p className="text-3xl font-black tracking-tighter leading-none">{formatCurrency((items || []).reduce((acc, item) => acc + (Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100) + (item.toll || 0) + (item.food || 0) + (item.components || 0) + (item.others || 0), 0))}</p>
                    </div>
                </div>
            </div>
          </div>
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
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Deseja efetivar a Solicitação?</h3>
                    <p className="text-[10px] text-gray-500">Ao efetivar, o status mudará para 'Transferido' e a edição será bloqueada.</p>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setIsConfirmEfetivarHistoricoModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold">Não</button>
                        <button onClick={handleEfetivarHistorico} disabled={isLoading} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-lg">
                            {isLoading ? 'Salvando...' : 'Sim, Efetivar'}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        {isConfirmEfetivarStatusModal && (
            <Modal title="Aprovar para Pagamento" onClose={() => setIsConfirmEfetivarStatusModal(false)}>
                <div className="text-center p-4 space-y-4">
                    <DollarIcon className="w-12 h-12 text-indigo-600 mx-auto" />
                    <h3 className="text-sm font-bold text-gray-800 dark:text-white">Deseja aprovar esta solicitação?</h3>
                    <p className="text-[10px] text-gray-500">
                      {reportInAction?.isInstallmentWash 
                        ? "Esta ação valida a documentação enviada e destaca os lançamentos no financeiro para pagamento." 
                        : "Esta ação criará um lançamento no Financeiro para pagamento em 7 dias."}
                    </p>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setIsConfirmEfetivarStatusModal(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold">Não</button>
                        <button onClick={handleEfetivarStatus} disabled={isLoading} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg">
                            {isLoading ? 'Processando...' : 'Sim, Aprovar'}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        {isCancelModalOpen && (
            <Modal title="Cancelar Solicitação" onClose={() => setIsCancelModalOpen(false)}>
                <div className="space-y-4">
                    <div>
                        <FormLabel>Motivo do cancelamento *</FormLabel>
                        <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full rounded-lg border-gray-200 bg-gray-50 p-3 text-xs font-bold outline-none focus:ring-2 focus:ring-red-500/20" placeholder="Explique o motivo..." rows={4} />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setIsCancelModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded-lg text-xs font-bold">Voltar</button>
                        <button onClick={handleCancelarStatus} disabled={isLoading || !cancelReason.trim()} className="flex-1 py-2 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg">
                            {isLoading ? 'Processando...' : 'Confirmar'}
                        </button>
                    </div>
                </div>
            </Modal>
        )}
        {isSuccessModalOpen && (
            <Modal title="" onClose={handleSuccessModalClose}>
                <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce"><CheckCircleIcon className="w-10 h-10" /></div>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight">Concluído!</h3>
                    <p className="text-xs font-bold text-gray-500">{modalMessage}</p>
                    <button onClick={handleSuccessModalClose} className="w-full mt-4 py-3 bg-gray-900 text-white rounded-xl font-bold text-xs">OK</button>
                </div>
            </Modal>
        )}
        {hdPhoto && (
            <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setHdPhoto(null)}>
                <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
                    <button className="absolute top-0 right-0 p-3 text-white hover:text-indigo-400 z-[110]" onClick={(e) => { e.stopPropagation(); setHdPhoto(null); }}><XCircleIcon className="w-10 h-10" /></button>
                    <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                        <img src={hdPhoto} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in" alt="Visualização HD" onClick={(e) => e.stopPropagation()} />
                    </div>
                </div>
            </div>
        )}
    </>
  );
};

export default RelatoriosPage;
