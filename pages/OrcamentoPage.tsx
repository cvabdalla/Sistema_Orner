import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SavedOrcamento, OrcamentoPageProps, OrcamentoStatus, SalesSummaryItem, User, ChecklistEntry, LavagemClient } from '../types';
import { 
    TrashIcon, AddIcon, EditIcon, FilterIcon, CalendarIcon, 
    DollarIcon, TrendUpIcon, EyeIcon, ChevronDownIcon, CheckCircleIcon, UsersIcon, SparklesIcon 
} from '../assets/icons';
import Modal from '../components/Modal';
import DashboardCard from '../components/DashboardCard';
import { dataService } from '../services/dataService';

const STATUS_OPTIONS: OrcamentoStatus[] = ['Em Aberto', 'Aprovado', 'Finalizado', 'Parado', 'Perdido'];

// Função auxiliar para Sentence Case
const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const OrcamentoPage: React.FC<OrcamentoPageProps> = ({ setCurrentPage, onEdit, currentUser }) => {
  const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orcamentoToDeleteId, setOrcamentoToDeleteId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatuses, setSelectedStatuses] = useState<OrcamentoStatus[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const ADMIN_PROFILE_ID = '001';
  const isAdminUser = currentUser.profileId === ADMIN_PROFILE_ID;

  const loadData = async () => {
      setIsLoading(true);
      const [orcData, userData] = await Promise.all([
          dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdminUser),
          dataService.getAll<User>('system_users', undefined, true)
      ]);
      setOrcamentos(orcData);
      setUsers(userData);
      setIsLoading(false);
  };

  useEffect(() => {
    loadData();

    const date = new Date();
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(lastDay));

    const handleClickOutside = (event: MouseEvent) => {
        if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
            setIsStatusDropdownOpen(false);
        }
        if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
            setIsUserDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentUser, isAdminUser]);

  const toggleStatus = (status: OrcamentoStatus) => {
    setSelectedStatuses(prev => 
        prev.includes(status) 
            ? prev.filter(s => s !== status) 
            : [...prev, status]
    );
  };

  const toggleUserFilter = (userId: string) => {
    setSelectedUsers(prev => 
        prev.includes(userId) 
            ? prev.filter(id => id !== userId) 
            : [...prev, userId]
    );
  };

  const confirmDelete = async () => {
    if (orcamentoToDeleteId !== null) {
      await dataService.delete('orcamentos', orcamentoToDeleteId);
      const currentSales = await dataService.getAll<SalesSummaryItem>('sales_summary');
      const saleToDelete = currentSales.find(s => s.orcamentoId === orcamentoToDeleteId);
      if (saleToDelete) await dataService.delete('sales_summary', saleToDelete.id);
      setOrcamentos(prev => prev.filter(o => o.id !== orcamentoToDeleteId));
      setDeleteModalOpen(false);
      setOrcamentoToDeleteId(null);
    }
  };

  const handleStatusChange = async (id: number, newStatus: OrcamentoStatus) => {
      const orcamento = orcamentos.find(o => o.id === id);
      if (orcamento) {
          let updatedOrcamento = { ...orcamento, status: newStatus };
          
          if (newStatus === 'Aprovado' || newStatus === 'Finalizado') {
              const currentSales = await dataService.getAll<SalesSummaryItem>('sales_summary');
              let variant = orcamento.variants?.find(v => v.isPrincipal) || orcamento.variants?.[0] || { formState: orcamento.formState, calculated: orcamento.calculated };
              
              if (variant.formState && variant.calculated) {
                  const fs = variant.formState;
                  const calc = variant.calculated;
                  const thirdPartyInstallation = (fs.terceiroInstalacaoQtd || 0) * (fs.terceiroInstalacaoCusto || 0);

                  const saleItem: SalesSummaryItem = {
                      id: Date.now(),
                      orcamentoId: orcamento.id,
                      owner_id: orcamento.owner_id,
                      clientName: fs.nomeCliente || 'Cliente sem nome',
                      date: fs.dataOrcamento || orcamento.savedAt.split('T')[0],
                      closedValue: calc.precoVendaFinal || 0,
                      systemCost: calc.valorVendaSistema || 0,
                      supplier: fs.fornecedor || 'N/A',
                      visitaTecnica: fs.visitaTecnicaCusto || 0,
                      homologation: fs.projetoHomologacaoCusto || 0,
                      installation: thirdPartyInstallation,
                      travelCost: fs.custoViagem || 0,
                      adequationCost: fs.adequacaoLocalCusto || 0,
                      materialCost: calc.totalEstrutura || 0,
                      invoicedTax: calc.nfServicoValor || 0,
                      commission: calc.comissaoVendasValor || 0,
                      bankFees: 0,
                      totalCost: (fs.visitaTecnicaCusto || 0) + (fs.projetoHomologacaoCusto || 0) + thirdPartyInstallation + (fs.custoViagem || 0) + (fs.adequacaoLocalCusto || 0) + (calc.totalEstrutura || 0) + (calc.nfServicoValor || 0) + (calc.comissaoVendasValor || 0),
                      netProfit: calc.lucroLiquido || 0,
                      finalMargin: calc.margemLiquida || 0,
                      status: newStatus
                  };

                  const existing = currentSales.find(s => s.orcamentoId === orcamento.id);
                  if (existing) await dataService.save('sales_summary', { ...saleItem, id: existing.id, status: newStatus });
                  else await dataService.save('sales_summary', saleItem);

                  // --- Automação Lavagem de Placas ---
                  if (newStatus === 'Finalizado' && !orcamento.lavagem_cadastrada) {
                      try {
                          const checkins = await dataService.getAll<ChecklistEntry>('checklist_checkin');
                          const techData = checkins.find(c => c.project === fs.nomeCliente)?.details || {};
                          
                          const newWashClient: LavagemClient = {
                              id: `wash-auto-${Date.now()}`,
                              owner_id: orcamento.owner_id,
                              name: fs.nomeCliente,
                              cep: techData.cep || '',
                              address: techData.enderecoCompleto || '',
                              address_number: '',
                              complement: '',
                              city: techData.cidade || '',
                              plates_count: (variant.formState?.terceiroInstalacaoQtd) || (calc.placasQtd) || 0,
                              phone: techData.telefoneTitular || '',
                              observations: `Importado automaticamente do orçamento finalizado em ${new Date().toLocaleDateString('pt-BR')}.`,
                              installation_end_date: new Date().toISOString().split('T')[0]
                          };
                          
                          await dataService.save('lavagem_clients', newWashClient);
                          updatedOrcamento.lavagem_cadastrada = true;
                      } catch (err) {
                          console.error("Erro na automação de lavagem:", err);
                      }
                  }
              }
          } else {
              const currentSales = await dataService.getAll<SalesSummaryItem>('sales_summary');
              const saleToRemove = currentSales.find(s => s.orcamentoId === id);
              if (saleToRemove) await dataService.delete('sales_summary', saleToRemove.id);
          }

          setOrcamentos(p => p.map(o => o.id === id ? updatedOrcamento : o));
          await dataService.save('orcamentos', updatedOrcamento);
      }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getDisplayData = (orc: SavedOrcamento) => {
      let clientName = "Sem nome"; let displayPrice = 0; let lucroLiquido = 0; let variantCount = 0; let dataOrcamento = "";
      if (orc.variants?.length) {
          const p = orc.variants.find(v => v.isPrincipal) || orc.variants[0];
          clientName = p.formState.nomeCliente || "Sem nome";
          displayPrice = p.calculated.precoVendaFinal || 0;
          lucroLiquido = p.calculated.lucroLiquido || 0;
          variantCount = orc.variants.length;
          dataOrcamento = p.formState.dataOrcamento || "";
      } else if (orc.formState) {
          clientName = orc.formState.nomeCliente || "Sem nome";
          displayPrice = orc.calculated.precoVendaFinal || 0;
          lucroLiquido = orc.calculated.lucroLiquido || 0;
          dataOrcamento = orc.formState.dataOrcamento || "";
      }
      if (!dataOrcamento) dataOrcamento = orc.savedAt.split('T')[0];
      const ownerRawName = users.find(u => String(u.id) === String(orc.owner_id))?.name || 'Sistema';
      const ownerName = toSentenceCase(ownerRawName);
      return { clientName, displayPrice, lucroLiquido, variantCount, dataOrcamento, ownerName };
  };

  const getStatusStyle = (status: string) => {
      switch(status) {
          case 'Aprovado': return 'bg-green-100 text-green-700 border-green-200';
          case 'Finalizado': return 'bg-purple-100 text-purple-700 border-purple-200';
          case 'Perdido': return 'bg-red-100 text-red-700 border-red-200';
          case 'Parado': return 'bg-orange-100 text-orange-700 border-orange-200';
          default: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      }
  }

  const filtered = useMemo(() => {
      let v = 0; let l = 0;
      const f = orcamentos.filter(orc => {
          const d = getDisplayData(orc);
          const s = orc.status || 'Em Aberto';
          if (searchTerm && !d.clientName.toLowerCase().includes(searchTerm.toLowerCase())) return false;
          if (selectedStatuses.length > 0 && !selectedStatuses.includes(s)) return false;
          if (selectedUsers.length > 0 && !selectedUsers.includes(String(orc.owner_id))) return false;
          if (startDate && d.dataOrcamento < startDate) return false;
          if (endDate && d.dataOrcamento > endDate) return false;
          v += d.displayPrice; l += d.lucroLiquido;
          return true;
      });
      return { filteredOrcamentos: f, totalVendaFiltrado: v, totalLucroFiltrado: l };
  }, [orcamentos, searchTerm, selectedStatuses, selectedUsers, startDate, endDate, users]);

  if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <DashboardCard title="Volume de vendas (filtrado)" value={formatCurrency(filtered.totalVendaFiltrado)} icon={DollarIcon} color="bg-blue-600" />
            <DashboardCard title="Lucro líquido estimado" value={formatCurrency(filtered.totalLucroFiltrado)} icon={TrendUpIcon} color="bg-green-600" />
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Projetos e orçamentos</h2>
                <button onClick={() => setCurrentPage('NOVO_ORCAMENTO')} className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-lg font-bold text-sm">
                    <AddIcon className="w-5 h-5" /> Novo projeto
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 mb-6 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-600">
                <div className="flex-1">
                    <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/20" />
                </div>
                
                <div className="relative w-full lg:w-48" ref={statusDropdownRef}>
                    <button onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)} className="flex items-center justify-between w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <div className="flex items-center gap-2 truncate"><FilterIcon className="w-4 h-4 text-gray-400" /><span>{selectedStatuses.length === 0 ? 'Status' : `${selectedStatuses.length} sel.`}</span></div>
                        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isStatusDropdownOpen && (
                        <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto custom-scrollbar">
                            <p className="px-4 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 mb-1">Situação</p>
                            {STATUS_OPTIONS.map(status => (
                                <label key={status} className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer group transition-colors">
                                    <input type="checkbox" className="hidden" checked={selectedStatuses.includes(status)} onChange={() => toggleStatus(status)} />
                                    <div className={`w-4.5 h-4.5 rounded border mr-3 flex items-center justify-center transition-all ${selectedStatuses.includes(status) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>{selectedStatuses.includes(status) && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div>
                                    <span className={`text-xs font-bold ${selectedStatuses.includes(status) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}>{status}</span>
                                </label>
                            ))}
                        </div>
                    )}
                </div>

                {isAdminUser && (
                    <div className="relative w-full lg:w-48" ref={userDropdownRef}>
                        <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center justify-between w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 p-2 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <div className="flex items-center gap-2 truncate"><UsersIcon className="w-4 h-4 text-gray-400" /><span>{selectedUsers.length === 0 ? 'Usuário' : `${selectedUsers.length} sel.`}</span></div>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isUserDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto custom-scrollbar">
                                <p className="px-4 py-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700 mb-1">Vendedor / Admin</p>
                                {users.map(user => (
                                    <label key={user.id} className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-900/40 cursor-pointer group transition-colors">
                                        <input type="checkbox" className="hidden" checked={selectedUsers.includes(String(user.id))} onChange={() => toggleUserFilter(String(user.id))} />
                                        <div className={`w-4.5 h-4.5 rounded border mr-3 flex items-center justify-center transition-all ${selectedUsers.includes(String(user.id)) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>{selectedUsers.includes(String(user.id)) && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div>
                                        <span className={`text-xs font-bold ${selectedUsers.includes(String(user.id)) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}>{user.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center gap-2 bg-white dark:bg-gray-800 p-1 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-sm p-1 dark:bg-gray-800 outline-none" />
                    <span className="text-gray-400">-</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-sm p-1 dark:bg-gray-800 outline-none" />
                </div>
            </div>

            <div className="space-y-3">
                {filtered.filteredOrcamentos.map(orc => {
                    const d = getDisplayData(orc);
                    const isReadOnlyStatus = orc.status === 'Finalizado';
                    const isApproved = orc.status === 'Aprovado' || orc.status === 'Finalizado';
                    
                    return (
                        <div key={orc.id} className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
                            {orc.lavagem_cadastrada && (
                                <div className="absolute top-0 right-0 p-1.5 bg-indigo-50 dark:bg-indigo-900/40 rounded-bl-xl border-b border-l border-indigo-100 dark:border-indigo-800" title="Integrado à Lavagem de Placas">
                                    <SparklesIcon className="w-3 h-3 text-indigo-600" />
                                </div>
                            )}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h4 className={`font-bold text-lg text-gray-900 dark:text-white`}>{d.clientName}</h4>
                                    {orc.lavagem_cadastrada && <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800">Lavagem Ativa</span>}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                                    <p className="text-xs text-gray-500 font-bold tracking-wide">
                                        {new Date(d.dataOrcamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})} | {d.variantCount} opções
                                    </p>
                                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded-full border border-gray-100 dark:border-gray-600">
                                        <UsersIcon className="w-3 h-3 text-gray-400" />
                                        <span className="text-[10px] font-black text-gray-500 dark:text-gray-300 tracking-tighter">{d.ownerName}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <select 
                                    value={orc.status} 
                                    onChange={e => handleStatusChange(orc.id, e.target.value as any)} 
                                    disabled={isReadOnlyStatus}
                                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold border transition-colors ${getStatusStyle(orc.status || 'Em Aberto')} ${isReadOnlyStatus ? 'opacity-70 cursor-not-allowed' : ''}`}
                                >
                                    <option value="Em Aberto">Em aberto</option>
                                    <option value="Aprovado">Aprovado</option>
                                    <option value="Finalizado">Finalizado</option>
                                    <option value="Parado">Parado</option>
                                    <option value="Perdido">Perdido</option>
                                </select>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-400">Valor</p>
                                    <p className="font-bold text-indigo-600">{formatCurrency(d.displayPrice)}</p>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => onEdit(orc)} className={`p-2 rounded-lg transition-all ${isApproved ? 'text-blue-500 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20' : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`} title={isApproved ? 'Visualizar' : 'Editar'}>
                                        {isApproved ? <EyeIcon className="w-5 h-5" /> : <EditIcon className="w-5 h-5" />}
                                    </button>
                                    {isAdminUser && !isReadOnlyStatus && (
                                        <button onClick={() => { setOrcamentoToDeleteId(orc.id); setDeleteModalOpen(true); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filtered.filteredOrcamentos.length === 0 && (
                    <div className="py-20 text-center">
                        <FilterIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-bold italic">Nenhum orçamento encontrado para os filtros aplicados.</p>
                    </div>
                )}
            </div>
        </div>

        {isDeleteModalOpen && (
            <Modal title="Excluir orçamento" onClose={() => setDeleteModalOpen(false)}>
                <div className="text-center p-4 space-y-6">
                    <TrashIcon className="w-12 h-12 text-red-500 mx-auto" />
                    <p className="font-bold text-gray-600 text-sm">Deseja excluir este projeto permanentemente?</p>
                    <div className="flex gap-3">
                        <button onClick={() => setDeleteModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded-lg font-bold text-xs">Cancelar</button>
                        <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold text-xs">Confirmar</button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default OrcamentoPage;