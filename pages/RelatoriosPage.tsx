
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { 
    ChartPieIcon, PrinterIcon, PlusIcon, TrashIcon, 
    CogIcon, SaveIcon, EditIcon, ClipboardListIcon, 
    CheckCircleIcon, DollarIcon, ExclamationTriangleIcon, 
    DocumentReportIcon, XCircleIcon, LockClosedIcon,
    ArrowLeftIcon, EyeIcon, CalendarIcon, TableIcon, FilterIcon, UsersIcon, ChevronDownIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend } from 'recharts';
import type { RelatoriosPageProps, ExpenseReportItem, ExpenseReport, ExpenseReportStatus } from '../types';
import { dataService } from '../services/dataService';

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1 tracking-tight">{children}</label>
);

const StandardInput = (props: any) => (
    <input 
        {...props} 
        disabled={props.disabled}
        className={`w-full rounded-lg border-transparent bg-gray-50 dark:bg-gray-700/50 p-2.5 text-sm font-medium text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50 ${props.className || ''}`} 
    />
);

const RelatoriosPage: React.FC<RelatoriosPageProps> = ({ view, reportToEdit, onSave, onEditReport, currentUser }) => {
  const [solicitante, setSolicitante] = useState('');
  const [setor, setSetor] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [valorPorKm, setValorPorKm] = useState(1.20);
  
  // Filtros para o Resumo
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Filtros para o Status de Reembolso
  const [statusFilterStatus, setStatusFilterStatus] = useState<ExpenseReportStatus | 'Todos'>('Todos');
  const [selectedUsersStatus, setSelectedUsersStatus] = useState<string[]>([]);
  const [isUserDropdownStatusOpen, setIsUserDropdownStatusOpen] = useState(false);
  const userDropdownStatusRef = useRef<HTMLDivElement>(null);

  const [configKmValue, setConfigKmValue] = useState(1.20);
  const [configInstallationValue, setConfigInstallationValue] = useState(120.00);
  
  const [isEditingKm, setIsEditingKm] = useState(false);
  const [tempKm, setTempKm] = useState(1.20);
  const [isEditingInst, setIsEditingInst] = useState(false);
  const [tempInst, setTempInst] = useState(120.00);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [isPayModalOpen, setPayModalOpen] = useState(false);
  const [reportToPay, setReportToPay] = useState<ExpenseReport | null>(null);
  const [isTransferModalOpen, setTransferModalOpen] = useState(false);
  
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [items, setItems] = useState<ExpenseReportItem[]>([
    { id: '1', date: '', description: '', origin: '', destination: '', km: 0, toll: 0 },
  ]);

  const isAdmin = useMemo(() => currentUser.profileId === '00000000-0000-0000-0000-000000000001', [currentUser]);

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

  const loadConfig = useCallback(() => {
      const storedKm = localStorage.getItem('config_km_value');
      if (storedKm) {
          const val = parseFloat(storedKm);
          setConfigKmValue(val);
          setValorPorKm(val);
          setTempKm(val);
      }
      const storedInst = localStorage.getItem('config_installation_value');
      if (storedInst) {
          const val = parseFloat(storedInst);
          setConfigInstallationValue(val);
          setTempInst(val);
      }
  }, []);

  useEffect(() => { 
    loadReports(); 
    loadConfig();

    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
    setFilterStart(firstDay);
    setFilterEnd(lastDay);

    const handleClickOutside = (event: MouseEvent) => {
        if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
            setIsUserDropdownOpen(false);
        }
        if (userDropdownStatusRef.current && !userDropdownStatusRef.current.contains(event.target as Node)) {
            setIsUserDropdownStatusOpen(false);
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
            setValorPorKm(reportToEdit.kmValueUsed || configKmValue);
        } else {
            setSolicitante(currentUser.name); 
            setSetor(''); 
            setPeriodStart(''); 
            setPeriodEnd(''); 
            setItems([{ id: Date.now().toString(), date: '', description: '', origin: '', destination: '', km: 0, toll: 0 }]); 
            setValorPorKm(configKmValue);
        }
    }
  }, [view, reportToEdit, currentUser, configKmValue]);

  const isReadOnly = useMemo(() => reportToEdit?.status === 'Transferido' || reportToEdit?.status === 'Pago', [reportToEdit]);

  const availableUsers = useMemo(() => {
    const names = new Set<string>();
    reports.forEach(r => names.add(r.requester));
    return Array.from(names).sort();
  }, [reports]);

  const toggleUserSelection = (userName: string, isForStatus: boolean = false) => {
    if (isForStatus) {
        setSelectedUsersStatus(prev => 
            prev.includes(userName) ? prev.filter(u => u !== userName) : [...prev, userName]
        );
    } else {
        setSelectedUsers(prev => 
            prev.includes(userName) ? prev.filter(u => u !== userName) : [...prev, userName]
        );
    }
  };

  const myReports = useMemo(() => {
      if (isAdmin) return reports; 
      const currentId = String(currentUser.id).trim().toLowerCase();
      return reports.filter(r => String(r.owner_id || '').trim().toLowerCase() === currentId);
  }, [reports, currentUser.id, isAdmin]);

  const filteredStatusReports = useMemo(() => {
      const currentId = String(currentUser.id).trim().toLowerCase();
      return reports.filter(r => {
          const ownerId = String(r.owner_id || '').trim().toLowerCase();
          const isOwner = ownerId === currentId;
          const isBroadStatus = r.status === 'Transferido' || r.status === 'Pago';
          const isVisible = isOwner || isBroadStatus;
          
          if (!isVisible) return false;

          // Filtro de Status
          if (statusFilterStatus !== 'Todos' && r.status !== statusFilterStatus) return false;

          // Filtro de Usuário (Múltiplo)
          if (selectedUsersStatus.length > 0 && !selectedUsersStatus.includes(r.requester)) return false;

          return true;
      });
  }, [reports, currentUser.id, statusFilterStatus, selectedUsersStatus]);

  const totals = useMemo(() => (items || []).reduce((acc, item) => {
      const reKm = Math.ceil(((item.km || 0) * valorPorKm) * 100) / 100;
      return { 
          km: acc.km + (item.km || 0), 
          reembolsoKm: acc.reembolsoKm + reKm, 
          toll: acc.toll + (item.toll || 0), 
          total: acc.total + reKm + (item.toll || 0) 
      };
    }, { km: 0, reembolsoKm: 0, toll: 0, total: 0 }), [items, valorPorKm]);

  const analysisData = useMemo(() => {
      const filtered = myReports.filter(r => {
          const date = (r.createdAt || '').split('T')[0];
          if (filterStart && date < filterStart) return false;
          if (filterEnd && date > filterEnd) return false;
          if (selectedUsers.length > 0 && !selectedUsers.includes(r.requester)) return false;
          return true;
      });

      const paid = filtered.filter(r => r.status === 'Pago').reduce((acc, r) => acc + (r.totalValue || 0), 0);
      const pending = filtered.filter(r => r.status === 'Transferido').reduce((acc, r) => acc + (r.totalValue || 0), 0);
      const open = filtered.filter(r => ['Rascunho', 'Em Aberto'].includes(r.status)).reduce((acc, r) => acc + (r.totalValue || 0), 0);
      
      let totalKmValue = 0;
      let totalTollValue = 0;

      const sectorMap: Record<string, number> = {};
      filtered.forEach(r => { 
          if (r.status === 'Pago' || r.status === 'Transferido') { 
              const sec = r.sector || 'Geral'; 
              sectorMap[sec] = (sectorMap[sec] || 0) + (r.totalValue || 0); 

              r.items.forEach(item => {
                  totalKmValue += Math.ceil(((item.km || 0) * (r.kmValueUsed || 1.20)) * 100) / 100;
                  totalTollValue += (item.toll || 0);
              });
          } 
      });

      return { 
          paid, 
          pending, 
          open, 
          totalKmValue, 
          totalTollValue,
          filteredReports: filtered,
          sectorData: Object.entries(sectorMap).map(([name, value]) => ({ name, value })) 
      };
  }, [myReports, filterStart, filterEnd, selectedUsers]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const handlePayReport = async () => {
      if (!reportToPay) return;
      try {
          const updated = { ...reportToPay, status: 'Pago' as any };
          await dataService.save('expense_reports', updated);
          await loadReports();
          setPayModalOpen(false);
      } catch (e) { console.error(e); }
  };

  const handleSaveReportAction = async (targetStatus: ExpenseReportStatus) => {
      if (!solicitante || !periodStart || !periodEnd) { 
          alert("Por favor, preencha o solicitante e o período do relatório."); 
          return; 
      }
      if (targetStatus === 'Transferido') setTransferModalOpen(true);
      else await executeSave('Rascunho');
  };

  const executeSave = async (targetStatus: ExpenseReportStatus) => {
      const report: ExpenseReport = { 
        id: reportToEdit?.id || `exp-${Date.now()}`, 
        owner_id: String(reportToEdit?.owner_id || currentUser.id), 
        requester: solicitante, 
        sector: setor, 
        period: `${periodStart} a ${periodEnd}`, 
        periodStart, 
        periodEnd, 
        items: items.map(i => ({...i, id: i.id || String(Math.random())})), 
        kmValueUsed: valorPorKm, 
        status: targetStatus, 
        createdAt: reportToEdit?.createdAt || new Date().toISOString(), 
        totalValue: totals.total 
      };
      try {
          await dataService.save('expense_reports', report);
          setModalMessage(targetStatus === 'Transferido' ? "Relatório enviado com sucesso!" : "Alterações salvas.");
          setSuccessModalOpen(true);
          await loadReports();
          if (onSave) setTimeout(() => onSave(), 1200);
      } catch (e) { console.error(e); }
  };

  const handleSaveKm = () => {
      setConfigKmValue(tempKm);
      localStorage.setItem('config_km_value', tempKm.toString());
      setIsEditingKm(false);
  };

  const handleSaveInst = () => {
      setConfigInstallationValue(tempInst);
      localStorage.setItem('config_installation_value', tempInst.toString());
      setIsEditingInst(false);
  };

  const handleExportResumo = () => {
    const csvHeader = "\uFEFFData;Solicitante;Setor;Periodo;Status;KM (R$);Pedagio (R$);Total (R$)\n";
    const csvBody = analysisData.filteredReports.map(r => {
        let kmVal = 0; let tollVal = 0;
        r.items.forEach(it => {
            kmVal += Math.ceil(((it.km || 0) * (r.kmValueUsed || 1.20)) * 100) / 100;
            tollVal += (it.toll || 0);
        });
        return `${new Date(r.createdAt).toLocaleDateString('pt-BR')};${r.requester};${r.sector};${r.period};${r.status};${kmVal.toFixed(2).replace('.', ',')};${tollVal.toFixed(2).replace('.', ',')};${r.totalValue.toFixed(2).replace('.', ',')}`;
    }).join('\n');
    
    const blob = new Blob([csvHeader + csvBody], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `resumo_reembolsos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const PIE_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444'];

  if (view === 'analise') return (
      <div className="space-y-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row items-center justify-between gap-4 print:hidden">
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                      <FilterIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/50 px-2 py-1.5 rounded-lg border dark:border-gray-600">
                      <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} className="bg-transparent border-none text-xs font-bold outline-none" />
                      <span className="text-gray-400">-</span>
                      <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} className="bg-transparent border-none text-xs font-bold outline-none" />
                  </div>
                  {isAdmin && (
                    <div className="relative" ref={userDropdownRef}>
                        <button 
                            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                            className="flex items-center justify-between gap-3 bg-gray-50 dark:bg-gray-700/50 px-3 py-1.5 rounded-lg border dark:border-gray-600 min-w-[180px] text-xs font-bold text-gray-700 dark:text-gray-200"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <UsersIcon className="w-4 h-4 text-gray-400" />
                                <span>
                                    {selectedUsers.length === 0 
                                        ? 'Todos os usuários' 
                                        : `${selectedUsers.length} selecionado(s)`}
                                </span>
                            </div>
                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isUserDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto custom-scrollbar">
                                {availableUsers.length > 0 ? (
                                    availableUsers.map(name => (
                                        <label key={name} className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                className="hidden"
                                                checked={selectedUsers.includes(name)}
                                                onChange={() => toggleUserSelection(name)}
                                            />
                                            <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                                selectedUsers.includes(name) 
                                                ? 'bg-indigo-600 border-indigo-600' 
                                                : 'border-gray-300'
                                            }`}>
                                                {selectedUsers.includes(name) && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{name}</span>
                                        </label>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-gray-400 italic text-center">Nenhum usuário com registros.</div>
                                )}
                                {selectedUsers.length > 0 && (
                                    <div className="border-t mt-2 px-4 pt-2">
                                        <button onClick={() => setSelectedUsers([])} className="text-[10px] font-black text-red-500 tracking-tighter hover:underline">Limpar seleção</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  )}
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                  <button onClick={handleExportResumo} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-green-700 transition-all">
                      <TableIcon className="w-4 h-4" /> Exportar Excel
                  </button>
                  <button onClick={() => window.print()} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg text-xs font-bold shadow-md hover:bg-black transition-all">
                      <PrinterIcon className="w-4 h-4" /> Imprimir
                  </button>
              </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <DashboardCard title="Reembolsos pagos" value={formatCurrency(analysisData.paid)} icon={CheckCircleIcon} color="bg-green-500" />
              <DashboardCard title="Em pagamento" value={formatCurrency(analysisData.pending)} icon={ExclamationTriangleIcon} color="bg-yellow-500" />
              <DashboardCard title="Total em KM (Efetivo)" value={formatCurrency(analysisData.totalKmValue)} icon={DollarIcon} color="bg-indigo-600" />
              <DashboardCard title="Total em Pedágio (Efetivo)" value={formatCurrency(analysisData.totalTollValue)} icon={DollarIcon} color="bg-teal-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-800 dark:text-white">
                      <ChartPieIcon className="w-5 h-5 text-indigo-500" /> 
                      Distribuição por setor (No período)
                  </h3>
                  <div className="h-[300px]">
                      {analysisData.sectorData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={analysisData.sectorData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={5}>
                                    {analysisData.sectorData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                </Pie>
                                <RechartsTooltip formatter={(v) => formatCurrency(Number(v))} /><Legend />
                            </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 italic text-sm">Nenhuma despesa para exibir no período.</div>
                      )}
                  </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800 dark:text-white border-b pb-3">
                      <ClipboardListIcon className="w-5 h-5 text-indigo-500" />
                      Listagem resumida
                  </h3>
                  <div className="space-y-3 overflow-y-auto max-h-[350px] pr-2 custom-scrollbar">
                      {analysisData.filteredReports.map(r => (
                          <div key={r.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-transparent hover:border-indigo-100 transition-all">
                              <div className="flex justify-between items-start mb-1">
                                  <span className="text-[10px] font-black text-gray-400 tracking-tighter">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</span>
                                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black ${r.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{r.status === 'Transferido' ? 'Pendente' : r.status}</span>
                              </div>
                              <p className="text-xs font-bold text-gray-800 dark:text-white truncate">{r.requester}</p>
                              <div className="flex justify-between items-end mt-2">
                                  <span className="text-[9px] font-bold text-gray-400">{r.sector || 'Geral'}</span>
                                  <span className="text-sm font-black text-indigo-600">{formatCurrency(r.totalValue)}</span>
                              </div>
                          </div>
                      ))}
                      {analysisData.filteredReports.length === 0 && <div className="text-center py-10 text-gray-400 text-xs italic">Nada encontrado no período.</div>}
                  </div>
              </div>
          </div>
      </div>
  );

  if (view === 'status') return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
                        <CheckCircleIcon className="w-8 h-8 text-indigo-600" /> 
                        Status de reembolsos
                    </h2>
                    <p className="text-xs text-gray-400 font-semibold mt-1 tracking-widest">Visão global da equipe ({filteredStatusReports.length} itens)</p>
                </div>
            </div>

            {/* Filtros Separados */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                <div>
                    <FormLabel>Filtrar por status</FormLabel>
                    <select 
                        value={statusFilterStatus} 
                        onChange={e => setStatusFilterStatus(e.target.value as any)}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2 text-sm font-bold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                        <option value="Todos">Todos os status</option>
                        <option value="Transferido">Em pagamento</option>
                        <option value="Pago">Pago</option>
                        <option value="Rascunho">Rascunho</option>
                    </select>
                </div>
                <div>
                    <FormLabel>Filtrar por solicitantes</FormLabel>
                    <div className="relative" ref={userDropdownStatusRef}>
                        <button 
                            onClick={() => setIsUserDropdownStatusOpen(!isUserDropdownStatusOpen)}
                            className="flex items-center justify-between w-full bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-white"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <UsersIcon className="w-4 h-4 text-gray-400" />
                                <span>
                                    {selectedUsersStatus.length === 0 
                                        ? 'Todos os solicitantes' 
                                        : `${selectedUsersStatus.length} selecionado(s)`}
                                </span>
                            </div>
                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isUserDropdownStatusOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isUserDropdownStatusOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto custom-scrollbar">
                                {availableUsers.length > 0 ? (
                                    availableUsers.map(name => (
                                        <label key={name} className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group">
                                            <input 
                                                type="checkbox" 
                                                className="hidden"
                                                checked={selectedUsersStatus.includes(name)}
                                                onChange={() => toggleUserSelection(name, true)}
                                            />
                                            <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${
                                                selectedUsersStatus.includes(name) 
                                                ? 'bg-indigo-600 border-indigo-600' 
                                                : 'border-gray-300'
                                            }`}>
                                                {selectedUsersStatus.includes(name) && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{name}</span>
                                        </label>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-gray-400 italic text-center">Nenhum usuário com registros.</div>
                                )}
                                {selectedUsersStatus.length > 0 && (
                                    <div className="border-t mt-2 px-4 pt-2">
                                        <button onClick={() => setSelectedUsersStatus([])} className="text-[10px] font-black text-red-500 tracking-tighter hover:underline">Limpar seleção</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 border-b">
                        <tr>
                            <th className="px-6 py-4">Data</th>
                            <th className="px-6 py-4">Solicitante</th>
                            <th className="px-6 py-4 text-right">Valor</th>
                            <th className="px-6 py-4 text-center">Status</th>
                            <th className="px-6 py-4 text-center">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {filteredStatusReports.map(r => (
                            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200">{new Date(r.createdAt || 0).toLocaleDateString('pt-BR')}</td>
                                <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    {r.requester}
                                    {String(r.owner_id || '').trim().toLowerCase() !== String(currentUser.id).trim().toLowerCase() && <span className="text-[9px] bg-indigo-50 text-indigo-400 px-1.5 py-0.5 rounded font-black border border-indigo-100">Externo</span>}
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(r.totalValue)}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold shadow-sm ${
                                        r.status === 'Pago' ? 'bg-green-100 text-green-700' :
                                        r.status === 'Transferido' ? 'bg-yellow-50 text-yellow-600' :
                                        r.status === 'Rascunho' ? 'bg-gray-100 text-gray-600' :
                                        'bg-blue-50 text-blue-600'
                                    }`}>
                                        {r.status === 'Transferido' ? 'Em pagamento' : r.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-2">
                                        {(r.status === 'Transferido' || r.status === 'Pago') ? (
                                            <button onClick={() => onEditReport?.(r)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Visualizar detalhes">
                                                <EyeIcon className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button onClick={() => onEditReport?.(r)} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Editar rascunho">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                        
                                        {currentUser.profileId === '00000000-0000-0000-0000-000000000001' && r.status === 'Transferido' && (
                                            <button onClick={() => {setReportToPay(r); setPayModalOpen(true);}} className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-green-700">Pagar</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {filteredStatusReports.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">Nenhum reembolso encontrado para os filtros selecionados.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
            {isPayModalOpen && reportToPay && (
                <Modal title="Confirmar pagamento" onClose={() => setPayModalOpen(false)}>
                    <div className="text-center p-4 space-y-4">
                        <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto" />
                        <p className="text-sm font-semibold text-gray-600">Deseja marcar como pago o valor de {formatCurrency(reportToPay.totalValue)} para {reportToPay.requester}?</p>
                        <div className="flex gap-2 pt-4">
                            <button onClick={() => setPayModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 rounded-lg text-xs font-bold text-gray-500 transition-colors">Cancelar</button>
                            <button onClick={handlePayReport} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-xs font-bold shadow-lg">Confirmar</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    </div>
  );

  if (view === 'historico') return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                      <ClipboardListIcon className="w-8 h-8 text-indigo-600" /> 
                      Histórico de Reembolso
                  </h2>
                  <p className="text-xs font-semibold text-gray-400 mt-1 tracking-widest">Minhas solicitações ({myReports.length})</p>
              </div>
              <div className="flex gap-2">
                 <button onClick={() => window.print()} className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-md"><PrinterIcon className="w-5 h-5" /></button>
              </div>
          </div>
          <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs font-bold text-gray-500 border-b">
                      <tr>
                          <th className="px-6 py-4">Data</th>
                          <th className="px-6 py-4">Solicitante</th>
                          <th className="px-6 py-4">Período</th>
                          <th className="px-6 py-4 text-right">Valor total</th>
                          <th className="px-6 py-4 text-center">Status</th>
                          <th className="px-6 py-4 text-center">Ações</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {myReports.map(r => {
                          const isFinalized = r.status === 'Transferido' || r.status === 'Pago';
                          return (
                              <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                  <td className="px-6 py-4 font-bold text-gray-700 dark:text-gray-200">{new Date(r.createdAt || 0).toLocaleDateString('pt-BR')}</td>
                                  <td className="px-6 py-4 font-semibold text-gray-900 dark:text-white">{r.requester}</td>
                                  <td className="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">{r.period}</td>
                                  <td className="px-6 py-4 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(r.totalValue)}</td>
                                  <td className="px-6 py-4 text-center">
                                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold shadow-sm ${
                                          r.status === 'Pago' ? 'bg-green-100 text-green-700' : 
                                          r.status === 'Transferido' ? 'bg-yellow-100 text-yellow-700' :
                                          r.status === 'Rascunho' ? 'bg-gray-100 text-gray-600' :
                                          'bg-indigo-100 text-indigo-700'
                                      }`}>
                                          {r.status === 'Transferido' ? 'Em pagamento' : r.status}
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                      <div className="flex justify-center gap-1">
                                          <button onClick={() => onEditReport?.(r)} className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50" title={isFinalized ? "Visualizar detalhes" : "Editar / detalhes"}>
                                              {isFinalized ? <EyeIcon className="w-4 h-4 text-blue-600" /> : <EditIcon className="w-4 h-4" />}
                                          </button>
                                          {!isFinalized && (
                                              <button onClick={async () => { if(window.confirm('Excluir este relatório permanentemente?')) { await dataService.delete('expense_reports', r.id); loadReports(); } }} className="p-2 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50" title="Excluir">
                                                  <TrashIcon className="w-4 h-4" />
                                              </button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                      {myReports.length === 0 && !isLoading && (
                          <tr><td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic">Nenhum relatório encontrado no seu histórico pessoal.</td></tr>
                      )}
                      {isLoading && (
                           <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="animate-spin inline-block w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full"></div></td></tr>
                      )}
                  </tbody>
              </table>
          </div>
      </div>
  );

  if (view === 'config') return (
      <div className="max-w-2xl mx-auto animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-4 mb-10 border-b border-gray-100 dark:border-gray-700 pb-6">
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                      <CogIcon className="w-8 h-8" />
                  </div>
                  <div>
                      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações Gerais</h2>
                      <p className="text-xs font-semibold text-gray-400 tracking-wider">Parâmetros de custo e reembolso</p>
                  </div>
              </div>

              <div className="space-y-8">
                  <div className="bg-gray-50/50 dark:bg-gray-900/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-4">
                          <FormLabel>Valor do KM para reembolso (R$)</FormLabel>
                          {isEditingKm ? (
                              <div className="flex gap-2">
                                  <button onClick={() => {setIsEditingKm(false); setTempKm(configKmValue);}} className="text-[10px] font-bold text-gray-400 px-2 py-1">Cancelar</button>
                                  <button onClick={handleSaveKm} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded transition-colors">Salvar</button>
                              </div>
                          ) : (
                              <button onClick={() => setIsEditingKm(true)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-all transition-colors">
                                  <EditIcon className="w-3 h-3" /> Editar
                              </button>
                          )}
                      </div>
                      <StandardInput 
                          type="number" 
                          step="0.01" 
                          value={isEditingKm ? tempKm : configKmValue} 
                          disabled={!isEditingKm}
                          onChange={(e: any) => setTempKm(parseFloat(e.target.value) || 0)} 
                          placeholder="0,00"
                      />
                  </div>

                  <div className="bg-gray-50/50 dark:bg-gray-900/20 p-5 rounded-2xl border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-start mb-4">
                          <FormLabel>Valor Instalação por placa (R$)</FormLabel>
                          {isEditingInst ? (
                              <div className="flex gap-2">
                                  <button onClick={() => {setIsEditingInst(false); setTempInst(configInstallationValue);}} className="text-[10px] font-bold text-gray-400 px-2 py-1">Cancelar</button>
                                  <button onClick={handleSaveInst} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded transition-colors">Salvar</button>
                              </div>
                          ) : (
                              <button onClick={() => setIsEditingInst(true)} className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded transition-all transition-colors">
                                  <EditIcon className="w-3 h-3" /> Editar
                              </button>
                          )}
                      </div>
                      <StandardInput 
                          type="number" 
                          step="0.01" 
                          value={isEditingInst ? tempInst : configInstallationValue} 
                          disabled={!isEditingInst}
                          onChange={(e: any) => setTempInst(parseFloat(e.target.value) || 0)} 
                          placeholder="0,00"
                      />
                      <p className="text-[10px] text-gray-400 font-bold mt-3 tracking-tight leading-relaxed italic">
                        Este valor será usado como padrão no campo 'instalação - placas' de novos orçamentos.
                      </p>
                  </div>
              </div>
          </div>
      </div>
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-3xl shadow-2xl border border-gray-100 dark:border-gray-700 print:shadow-none animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4 print:hidden">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                        <DocumentReportIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reembolso de despesas</h1>
                        <p className="text-xs text-gray-400 font-semibold tracking-wider">Gestão interna de custos e deslocamento</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    {!isReadOnly && (
                        <>
                            <button onClick={() => handleSaveReportAction('Rascunho')} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors">Salvar rascunho</button>
                            <button onClick={() => handleSaveReportAction('Transferido')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all">Enviar para pagamento</button>
                        </>
                    )}
                    <button onClick={() => window.print()} className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-black transition-all shadow-md"><PrinterIcon className="w-5 h-5" /></button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b dark:border-gray-700 pb-8">
                <div>
                    <FormLabel>Solicitante</FormLabel>
                    <StandardInput value={solicitante} disabled />
                </div>
                <div>
                    <FormLabel>Setor / obra</FormLabel>
                    <StandardInput value={setor} onChange={(e: any) => setSetor(e.target.value)} disabled={isReadOnly} placeholder="Ex: Obra Fazenda Santa Rita" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <FormLabel>Período início</FormLabel>
                        <StandardInput type="date" value={periodStart} onChange={(e: any) => setPeriodStart(e.target.value)} disabled={isReadOnly} />
                    </div>
                    <div>
                        <FormLabel>Período fim</FormLabel>
                        <StandardInput type="date" value={periodEnd} onChange={(e: any) => setPeriodEnd(e.target.value)} disabled={isReadOnly} />
                    </div>
                </div>
                <div className="flex items-end">
                    <div className="w-full px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-xl font-bold text-sm border border-indigo-100 dark:border-indigo-800 flex justify-between items-center">
                        <span className="text-xs">Custo por km:</span>
                        <span>R$ {valorPorKm.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full text-sm text-left border-collapse border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden mb-6">
                    <thead className="bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 font-bold text-xs">
                        <tr>
                            <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">Data</th>
                            <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">Descrição / finalidade</th>
                            <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 text-center">Km</th>
                            <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 text-center">Pedágio</th>
                            <th className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 text-right bg-indigo-50/50 dark:bg-indigo-900/20">Subtotal</th>
                            {!isReadOnly && <th className="px-2 py-4 border-b border-gray-200 dark:border-gray-700 w-10"></th>}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {items.map(item => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                                <td className="p-1 min-w-[120px]">
                                    <input type="date" value={item.date} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, date:e.target.value}:x))} disabled={isReadOnly} className="w-full p-2.5 bg-transparent text-sm font-semibold outline-none text-gray-700 dark:text-white" />
                                </td>
                                <td className="p-1 min-w-[200px]">
                                    <input type="text" placeholder="Ex: Visita técnica inicial" value={item.description} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, description:e.target.value}:x))} disabled={isReadOnly} className="w-full p-2.5 bg-transparent text-sm font-semibold outline-none text-gray-700 dark:text-white" />
                                </td>
                                <td className="p-1 w-24 text-center">
                                    <input type="number" value={item.km} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, km:parseFloat(e.target.value)||0}:x))} disabled={isReadOnly} className="w-full p-2.5 bg-transparent text-center text-sm font-bold outline-none text-indigo-600 dark:text-indigo-400" />
                                </td>
                                <td className="p-1 w-24 text-center">
                                    <input type="number" value={item.toll} onChange={e => setItems(p=>p.map(x=>x.id===item.id?{...x, toll:parseFloat(e.target.value)||0}:x))} disabled={isReadOnly} className="w-full p-2.5 bg-transparent text-center text-sm font-bold outline-none text-gray-700 dark:text-white" />
                                </td>
                                <td className="px-4 py-2 text-right font-bold text-gray-900 dark:text-white bg-indigo-50/20 dark:bg-indigo-900/10">
                                    {formatCurrency(Math.ceil(((item.km || 0)*valorPorKm)*100)/100 + (item.toll || 0))}
                                </td>
                                {!isReadOnly && (
                                    <td className="px-2 py-2 text-center">
                                        <button onClick={() => setItems(p => p.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 transition-colors">
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="bg-indigo-50 dark:bg-indigo-900/40 text-indigo-900 dark:text-indigo-100 font-bold text-xs">
                        <tr>
                            <td colSpan={2} className="px-4 py-5 text-right">Totais do relatório:</td>
                            <td className="px-4 py-5 text-center text-indigo-600 dark:text-indigo-400">{totals.km} km</td>
                            <td className="px-4 py-5 text-center">{formatCurrency(totals.toll)}</td>
                            <td className="px-4 py-5 text-right text-base font-black">{formatCurrency(totals.total)}</td>
                            {!isReadOnly && <td></td>}
                        </tr>
                    </tfoot>
                </table>
            </div>
            
            {!isReadOnly && (
                <button onClick={() => setItems([...items, { id: Date.now().toString(), date: '', description: '', km: 0, toll: 0 }])} className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 rounded-2xl font-bold text-xs hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all transition-colors">
                    <PlusIcon className="w-5 h-5" /> Adicionar nova despesa
                </button>
            )}
        </div>

        {isSuccessModalOpen && (
            <Modal title="Operação concluída" onClose={()=>setSuccessModalOpen(false)}>
                <div className="text-center p-6 space-y-4">
                    <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto" />
                    <p className="font-bold text-gray-700 dark:text-gray-200 text-lg">{modalMessage}</p>
                </div>
            </Modal>
        )}

        {isTransferModalOpen && (
            <Modal title="Confirmar envio" onClose={()=>setTransferModalOpen(false)}>
                <div className="text-center p-4 space-y-6">
                    <ExclamationTriangleIcon className="w-12 h-12 text-yellow-500 mx-auto" />
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white">Enviar para pagamento?</h3>
                        <p className="text-sm text-gray-500 mt-2">Após o envio, você não poderá mais editar os valores até que o financeiro avalie.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={()=>setTransferModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 rounded-xl text-xs font-bold text-gray-500 transition-colors transition-colors">Voltar</button>
                        <button onClick={()=>{setTransferModalOpen(false); executeSave('Transferido');}} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all transition-colors">Confirmar</button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default RelatoriosPage;
