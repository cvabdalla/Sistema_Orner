
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
import type { RelatoriosPageProps, ExpenseReportItem, ExpenseReport, ExpenseReportStatus, ExpenseAttachment, FinancialCategory, FinancialTransaction, UserProfile } from '../types';
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

const RelatoriosPage: React.FC<RelatoriosPageProps> = ({ view, reportToEdit, onSave, onEditReport, currentUser, userPermissions }) => {
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

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
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

  const [pendingTransactions, setPendingTransactions] = useState<FinancialTransaction[]>([]);
  const [selectedTxIds, setSelectedTxIds] = useState<string[]>([]);

  const isAdmin = useMemo(() => 
    currentUser.profileId === '001' || 
    currentUser.profileId === '00000000-0000-0000-0000-000000000001' ||
    userPermissions.includes('ALL') ||
    currentUser.email.toLowerCase().includes('homologacao')
  , [currentUser, userPermissions]);

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

  const loadPendingTransactions = useCallback(async () => {
      if (view !== 'instalacao_lavagem') return;
      setIsLoading(true);
      try {
          const [txs, cats] = await Promise.all([
              dataService.getAll<FinancialTransaction>('financial_transactions', currentUser.id, isAdmin),
              dataService.getAll<FinancialCategory>('financial_categories')
          ]);

          const allowedCategoryIds = cats
            .filter(c => {
                const name = (c.name || '').toLowerCase();
                return name.includes('lavagem') || name.includes('instalação') || name.includes('instalacao');
            })
            .map(c => c.id);

          const pending = txs.filter(t => {
            const isTargetType = t.type === 'despesa' && t.status === 'pendente';
            if (!isTargetType) return false;

            const desc = (t.description || '').toLowerCase();
            const matchesKeyword = desc.includes('lavagem') || desc.includes('instalação') || desc.includes('instalacao');
            const matchesCategory = allowedCategoryIds.includes(t.categoryId);

            if (!matchesKeyword && !matchesCategory) return false;

            const isUnlinked = !t.relatedReportId;
            const isLinkedToCurrent = reportToEdit && String(t.relatedReportId) === String(reportToEdit.id);

            return isUnlinked || isLinkedToCurrent;
          });

          setPendingTransactions(pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
          
          if (reportToEdit && reportToEdit.isInstallmentWash) {
              const ids = (reportToEdit.items || []).map(i => String(i.id));
              setSelectedTxIds(ids);
          }
      } catch (e) {
          console.error("Erro ao carregar transações pendentes:", e);
      } finally {
          setIsLoading(false);
      }
  }, [view, currentUser, isAdmin, reportToEdit]);

  useEffect(() => { 
    loadReports(); 
    if (view === 'instalacao_lavagem') loadPendingTransactions();
  }, [view, loadReports, loadPendingTransactions]);

  useEffect(() => {
    if (reportToEdit) {
        setSolicitante(reportToEdit.requester || ''); 
        setSetor(reportToEdit.sector || ''); 
        setPeriodStart(reportToEdit.periodStart || ''); 
        setPeriodEnd(reportToEdit.periodEnd || ''); 
        setItems(reportToEdit.items || []); 
        setAttachments(reportToEdit.attachments || []);
        setValorPorKm(reportToEdit.kmValueUsed || 1.20);
        if (reportToEdit.isInstallmentWash) {
            setSelectedTxIds((reportToEdit.items || []).map(i => String(i.id)));
        }
    } else {
        setSolicitante(currentUser.name);
        setItems([{ id: Date.now().toString(), date: '', description: '', km: 0, toll: 0, food: 0, components: 0, others: 0 }]);
        setSelectedTxIds([]);
    }
  }, [reportToEdit, currentUser]);

  const handleSaveInstalacaoLavagem = async (status: ExpenseReportStatus) => {
      if (selectedTxIds.length === 0) { alert("Selecione pelo menos um lançamento."); return; }
      setIsLoading(true);
      try {
          const selectedItems = pendingTransactions.filter(t => selectedTxIds.includes(String(t.id)));
          const reportItems: ExpenseReportItem[] = selectedItems.map(t => ({
              id: String(t.id), date: t.dueDate, description: t.description,
              km: 0, toll: 0, food: 0, components: 0, others: t.amount
          }));

          const minDate = reportItems.reduce((min, i) => i.date < min ? i.date : min, reportItems[0].date);
          const maxDate = reportItems.reduce((max, i) => i.date > max ? i.date : max, reportItems[0].date);
          const reportId = reportToEdit?.id || `wash-${Date.now()}`;

          const report: ExpenseReport = {
              id: reportId,
              owner_id: reportToEdit?.owner_id || currentUser.id,
              requester: currentUser.name,
              sector: 'Faturamento Técnico',
              period: `${minDate} a ${maxDate}`,
              periodStart: minDate,
              periodEnd: maxDate,
              items: reportItems,
              attachments,
              kmValueUsed: 0,
              status,
              createdAt: reportToEdit?.createdAt || new Date().toISOString(),
              totalValue: selectedItems.reduce((acc, i) => acc + i.amount, 0),
              isInstallmentWash: true
          };

          await dataService.save('expense_reports', report);
          
          for (const tx of selectedItems) {
              await dataService.save('financial_transactions', { ...tx, relatedReportId: reportId });
          }

          setModalMessage(status === 'Rascunho' ? "Rascunho salvo no Histórico." : "Solicitação enviada!");
          setSuccessModalOpen(true);
          await loadReports();
      } catch (e) { alert("Erro ao salvar."); } finally { setIsLoading(false); }
  };

  const handleEfetivarStatus = async () => {
    if (!reportInAction) return;
    setIsLoading(true);
    try {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 7);
        
        await dataService.save('financial_transactions', {
            id: `tx-reemb-${reportInAction.id}`, 
            owner_id: reportInAction.owner_id,
            description: `${reportInAction.isInstallmentWash ? 'Pagamento' : 'Reembolso'}: ${reportInAction.requester}`,
            amount: reportInAction.totalValue, 
            type: 'despesa', 
            dueDate: dueDate.toISOString().split('T')[0],
            launchDate: new Date().toISOString().split('T')[0], 
            categoryId: 'reembolso-geral', 
            status: 'pendente'
        });

        await dataService.save('expense_reports', { ...reportInAction, status: 'Env. p/ Pagamento' });
        setModalMessage("Aprovado para pagamento!");
        setSuccessModalOpen(true);
        await loadReports();
    } catch (e) { alert("Erro ao processar."); } finally { setIsLoading(false); setIsConfirmEfetivarStatusModal(false); }
  };

  const handleViewFile = (file: ExpenseAttachment) => {
    if (file.data.startsWith('data:application/pdf')) {
        const win = window.open();
        win?.document.write(`<iframe src="${file.data}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else { setHdPhoto(file.data); }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const renderContent = () => {
    if (view === 'analise') return (
        <div className="space-y-6 animate-fade-in pb-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <DashboardCard title="Reembolsos Pagos" value={formatCurrency(reports.filter(r => r.status === 'Pago').reduce((a, b) => a + b.totalValue, 0))} icon={DollarIcon} color="bg-green-500" />
                <DashboardCard title="Em Aberto" value={formatCurrency(reports.filter(r => r.status !== 'Pago' && r.status !== 'Cancelado').reduce((a, b) => a + b.totalValue, 0))} icon={ClockIcon} color="bg-indigo-50" />
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border">
                <h3 className="font-bold mb-4">Relatório de Despesas</h3>
                <p className="text-gray-400 text-sm">Selecione os filtros acima para detalhamento.</p>
            </div>
        </div>
    );

    if (view === 'instalacao_lavagem') {
        return (
            <div className="max-w-7xl mx-auto space-y-6 animate-fade-in pb-20">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center text-white shadow-lg"><SparklesIcon className="w-6 h-6" /></div>
                        <div>
                            <h1 className="text-xl font-black text-gray-900 dark:text-white">Faturamento: Instalação / Lavagem</h1>
                            <p className="text-[10px] text-gray-400 font-bold uppercase mt-1 tracking-widest">Prestador: {currentUser.name}</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {!isReadOnly && (
                            <>
                                <button onClick={() => handleSaveInstalacaoLavagem('Rascunho')} className="px-6 py-2.5 bg-white dark:bg-gray-700 border rounded-xl font-bold text-xs shadow-sm">Salvar Rascunho</button>
                                <button onClick={() => handleSaveInstalacaoLavagem('Transferido')} className="px-6 py-2.5 bg-cyan-600 text-white rounded-xl font-bold text-xs shadow-lg">Solicitar Pagamento</button>
                            </>
                        )}
                        {isReadOnly && <button onClick={() => onSave?.()} className="px-8 py-3 bg-gray-600 text-white rounded-xl font-bold text-xs">Voltar</button>}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b bg-gray-50/50 dark:bg-gray-900/20 flex justify-between items-center">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><TableIcon className="w-4 h-4" /> Lançamentos Pendentes</h3>
                            <span className="text-[10px] font-bold text-indigo-600">Total: {formatCurrency(pendingTransactions.filter(t => selectedTxIds.includes(String(t.id))).reduce((a, b) => a + b.amount, 0))}</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50/30 dark:bg-gray-900/30 text-[10px] font-black text-gray-400 border-b">
                                    <tr><th className="px-6 py-4 w-10"></th><th className="px-4 py-4">Serviço / Descrição</th><th className="px-4 py-4">Vencimento</th><th className="px-6 py-4 text-right">Valor</th></tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {pendingTransactions.map(tx => (
                                        <tr key={tx.id} onClick={() => !isReadOnly && setSelectedTxIds(prev => prev.includes(String(tx.id)) ? prev.filter(i => i !== String(tx.id)) : [...prev, String(tx.id)])} className={`cursor-pointer transition-all ${selectedTxIds.includes(String(tx.id)) ? 'bg-cyan-50 dark:bg-cyan-900/20' : ''}`}>
                                            <td className="px-6 py-4"><div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${selectedTxIds.includes(String(tx.id)) ? 'bg-cyan-600 border-cyan-600' : 'border-gray-300'}`}>{selectedTxIds.includes(String(tx.id)) && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div></td>
                                            <td className="px-4 py-4">
                                                <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{tx.description}</p>
                                                <p className="text-[9px] text-gray-400 font-medium">ID: {tx.id}</p>
                                            </td>
                                            <td className="px-4 py-4 text-[11px] font-bold text-gray-500">{new Date(tx.dueDate).toLocaleDateString('pt-BR', {timeZone:'UTC'})}</td>
                                            <td className="px-6 py-4 text-right text-xs font-black text-gray-900 dark:text-white">{formatCurrency(tx.amount)}</td>
                                        </tr>
                                    ))}
                                    {pendingTransactions.length === 0 && (
                                        <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-400 italic text-xs font-bold">Nenhum lançamento pendente encontrado.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="lg:col-span-4 bg-white dark:bg-gray-800 p-6 rounded-2xl border shadow-sm h-fit">
                        <SectionTitle color="bg-cyan-600">Nota Fiscal (NF)</SectionTitle>
                        <div className="grid grid-cols-2 gap-3 mt-4">
                            {attachments.map((file, idx) => (
                                <div key={idx} className="relative aspect-square border rounded-xl overflow-hidden group">
                                    {file.name.toLowerCase().endsWith('.pdf') ? <div className="flex h-full items-center justify-center bg-red-50 text-red-600"><DocumentReportIcon className="w-8 h-8" /></div> : <img src={file.data} className="w-full h-full object-cover" />}
                                    {!isReadOnly && <button onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full shadow-lg"><TrashIcon className="w-3 h-3" /></button>}
                                </div>
                            ))}
                            {!isReadOnly && (
                                <button onClick={() => attachmentInputRef.current?.click()} className="aspect-square border-4 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center text-gray-300 hover:text-cyan-600 hover:border-cyan-200 transition-all"><UploadIcon className="w-6 h-6" /><span className="text-[10px] font-black uppercase mt-1">Anexar NF</span></button>
                            )}
                        </div>
                        <input type="file" ref={attachmentInputRef} className="hidden" multiple accept="image/*,application/pdf" onChange={e => { const files = e.target.files; if (!files) return; (Array.from(files) as File[]).forEach(file => { const reader = new FileReader(); reader.onload = (ev) => { if (typeof ev.target?.result === 'string') setAttachments(prev => [...prev, { name: file.name, data: ev.target!.result as string }]); }; reader.readAsDataURL(file); }); e.target.value = ''; }} />
                    </div>
                </div>
            </div>
        );
    }

    const listReports = (isAdmin ? reports : reports.filter(r => r.owner_id === currentUser.id)).filter(r => statusFilterValue === 'Todos' || r.status === statusFilterValue);
    
    return (
        <div className="max-w-7xl mx-auto space-y-4 animate-fade-in pb-10">
            <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shadow-sm"><ClipboardListIcon className="w-6 h-6" /></div>
                <div><h1 className="text-xl font-black text-gray-900 dark:text-white">Histórico de Reembolso e Faturamento</h1></div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl border shadow-lg overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 dark:bg-gray-900/40 text-[10px] font-black text-gray-400 uppercase tracking-widest border-b">
                        <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Tipo / Solicitante</th><th className="px-6 py-4 text-right">Valor total</th><th className="px-6 py-4 text-center">Status</th><th className="px-6 py-4 text-center">Ações</th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {listReports.map((report) => (
                            <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-indigo-900/10 transition-colors">
                                <td className="px-6 py-4 text-[11px] font-bold text-gray-500">{new Date(report.createdAt).toLocaleDateString('pt-BR')}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {report.isInstallmentWash ? <SparklesIcon className="w-3.5 h-3.5 text-cyan-600" /> : <DollarIcon className="w-3.5 h-3.5 text-indigo-600" />}
                                        <span className="font-bold text-gray-800 dark:text-white text-xs">{report.requester}</span>
                                    </div>
                                    <p className="text-[9px] text-gray-400 font-black ml-5">{report.isInstallmentWash ? 'FATURAMENTO TÉCNICO' : 'REEMBOLSO DE DESPESAS'}</p>
                                </td>
                                <td className="px-6 py-4 text-right text-xs font-black text-indigo-600">{formatCurrency(report.totalValue)}</td>
                                <td className="px-6 py-4 text-center"><span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black ${report.status === 'Pago' ? 'bg-green-100 text-green-700' : report.status === 'Rascunho' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{report.status}</span></td>
                                <td className="px-6 py-4 text-center">
                                    <div className="flex justify-center gap-1">
                                        <button onClick={() => onEditReport?.(report)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">{report.status === 'Rascunho' ? <EditIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}</button>
                                        {isAdmin && report.status === 'Transferido' && (<button onClick={() => { setReportInAction(report); setIsConfirmEfetivarStatusModal(true); }} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><CheckCircleIcon className="w-4 h-4" /></button>)}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isConfirmEfetivarStatusModal && (
                <Modal title="Aprovar Pagamento" onClose={() => setIsConfirmEfetivarStatusModal(false)}>
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-indigo-50 text-indigo-600">
                            <DollarIcon className="w-10 h-10" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Aprovar para pagamento?</h3>
                        <div className="flex gap-4">
                            <button onClick={() => setIsConfirmEfetivarStatusModal(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-sm">Não</button>
                            <button onClick={handleEfetivarStatus} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg">Sim, Aprovar</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
  };

  return (
    <>
        {renderContent()}
        {hdPhoto && (
            <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4 animate-fade-in" onClick={() => setHdPhoto(null)}>
                <img src={hdPhoto} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="HD" />
            </div>
        )}
    </>
  );
};

export default RelatoriosPage;
