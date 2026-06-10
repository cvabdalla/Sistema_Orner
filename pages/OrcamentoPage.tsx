
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { SavedOrcamento, OrcamentoPageProps, OrcamentoStatus, SalesSummaryItem, User, ChecklistEntry, LavagemClient } from '../types';
import { 
    TrashIcon, AddIcon, EditIcon, FilterIcon, CalendarIcon, 
    DollarIcon, TrendUpIcon, EyeIcon, ChevronDownIcon, CheckCircleIcon, UsersIcon, SparklesIcon,
    ClockIcon, SearchIcon, CalculatorIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';

const STATUS_OPTIONS: OrcamentoStatus[] = ['Em Aberto', 'Aprovado', 'Finalizado', 'Parado', 'Perdido'];

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const parseSafeNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val)
        .replace(/R\$/g, '')
        .replace(/\s/g, '')
        .replace(/\./g, '')
        .replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
};

// Premium, vivid custom color mapping for statuses inside CRM layout
const STATUS_COLORS: Record<string, { bg: string, text: string, border: string, dot: string, ring: string, line: string, badge: string }> = {
  'Em Aberto': { 
    bg: 'bg-amber-50/70 dark:bg-amber-950/20', 
    text: 'text-amber-800 dark:text-amber-300', 
    border: 'border-amber-200/60 dark:border-amber-800/20',
    dot: 'bg-amber-500',
    ring: 'ring-amber-500/20',
    line: 'border-l-amber-500',
    badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300'
  },
  'Aprovado': { 
    bg: 'bg-emerald-50/70 dark:bg-emerald-950/20', 
    text: 'text-emerald-800 dark:text-emerald-300', 
    border: 'border-emerald-200/60 dark:border-emerald-800/20',
    dot: 'bg-emerald-500',
    ring: 'ring-emerald-500/20',
    line: 'border-l-emerald-500',
    badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300'
  },
  'Finalizado': { 
    bg: 'bg-violet-50/70 dark:bg-violet-950/20', 
    text: 'text-violet-800 dark:text-violet-300', 
    border: 'border-violet-200/60 dark:border-violet-800/20',
    dot: 'bg-violet-500',
    ring: 'ring-violet-500/20',
    line: 'border-l-violet-500',
    badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300'
  },
  'Parado': { 
    bg: 'bg-orange-50/70 dark:bg-orange-950/20', 
    text: 'text-orange-800 dark:text-orange-300', 
    border: 'border-orange-200/60 dark:border-orange-800/20',
    dot: 'bg-orange-500',
    ring: 'ring-orange-500/20',
    line: 'border-l-orange-500',
    badge: 'bg-orange-100 dark:bg-orange-950/30 text-orange-800 dark:text-orange-300'
  },
  'Perdido': { 
    bg: 'bg-rose-50/70 dark:bg-rose-950/20', 
    text: 'text-rose-800 dark:text-rose-300', 
    border: 'border-rose-200/60 dark:border-rose-800/20',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/20',
    line: 'border-l-rose-500',
    badge: 'bg-rose-100 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300'
  }
};

const defaultColor = { 
  bg: 'bg-gray-50/70 dark:bg-gray-800/20', 
  text: 'text-gray-800 dark:text-gray-300', 
  border: 'border-gray-200 dark:border-gray-700/50', 
  dot: 'bg-gray-500',
  ring: 'ring-gray-500/20',
  line: 'border-l-gray-500',
  badge: 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
};

const OrcamentoPage: React.FC<OrcamentoPageProps> = ({ setCurrentPage, onEdit, currentUser }) => {
  const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [orcamentoToDeleteId, setOrcamentoToDeleteId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('Em Aberto');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  
  const userDropdownRef = useRef<HTMLDivElement>(null);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const ADMIN_PROFILE_ID = '001';
  const isAdminUser = currentUser.profileId === ADMIN_PROFILE_ID;

  const loadData = async () => {
      setIsLoading(true);
      try {
          const [orcData, userData] = await Promise.all([
              dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdminUser),
              dataService.getAll<User>('system_users', undefined, true)
          ]);
          setOrcamentos(orcData);
          setUsers(userData);
      } catch (e) {
          console.error("Erro ao carregar dados:", e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    loadData();

    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDayOfYear = new Date(year, 0, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const formatDate = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };
    
    setStartDate(formatDate(firstDayOfYear));
    setEndDate(formatDate(lastDayOfMonth));

    const handleClickOutside = (event: MouseEvent) => {
        if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
            setIsUserDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [currentUser, isAdminUser]);

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
      if (!orcamento) return;

      setOrcamentos(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));

      try {
          let updatedOrcamento = { ...orcamento, status: newStatus };
          await dataService.save('orcamentos', updatedOrcamento);

          if (newStatus === 'Aprovado' || newStatus === 'Finalizado') {
              try {
                  const currentSales = await dataService.getAll<SalesSummaryItem>('sales_summary');
                  let variant = orcamento.variants?.find(v => v.isPrincipal) || orcamento.variants?.[0] || { formState: orcamento.formState, calculated: orcamento.calculated };
                  
                  if (variant.formState && variant.calculated) {
                      const fs = variant.formState;
                      const calc = variant.calculated;
                      const thirdPartyInstallation = parseSafeNumber(fs.terceiroInstalacaoQtd) * parseSafeNumber(fs.terceiroInstalacaoCusto);

                      const existing = currentSales.find(s => s.orcamentoId === orcamento.id);

                      const saleItem: SalesSummaryItem = {
                          id: orcamento.id,
                          orcamentoId: orcamento.id,
                          owner_id: orcamento.owner_id,
                          clientName: fs.nomeCliente || 'Cliente sem nome',
                          date: fs.dataOrcamento || orcamento.savedAt.split('T')[0],
                          closedValue: parseSafeNumber(calc.precoVendaFinal),
                          systemCost: parseSafeNumber(calc.valorVendaSistema),
                          supplier: fs.fornecedor || 'N/A',
                          visitaTecnica: parseSafeNumber(fs.visitaTecnicaCusto),
                          homologation: parseSafeNumber(fs.projetoHomologacaoCusto),
                          installation: thirdPartyInstallation,
                          travelCost: parseSafeNumber(fs.custoViagem),
                          adequationCost: parseSafeNumber(fs.adequacaoLocalCusto),
                          materialCost: parseSafeNumber(calc.totalEstrutura),
                          invoicedTax: existing ? parseSafeNumber(existing.invoicedTax) : parseSafeNumber(calc.nfServicoValor),
                          commission: parseSafeNumber(calc.comissaoVendasValor),
                          bankFees: existing ? parseSafeNumber(existing.bankFees) : 0,
                          totalCost: 0, 
                          netProfit: 0,
                          finalMargin: 0,
                          status: newStatus
                      };

                      const extraCosts = 
                          (saleItem.visitaTecnica ?? 0) + (saleItem.homologation ?? 0) + (saleItem.installation ?? 0) + 
                          (saleItem.travelCost ?? 0) + (saleItem.adequationCost ?? 0) + (saleItem.materialCost ?? 0) + 
                          (saleItem.invoicedTax ?? 0) + (saleItem.commission ?? 0) + (saleItem.bankFees ?? 0);

                      saleItem.totalCost = extraCosts;
                      saleItem.netProfit = saleItem.closedValue - saleItem.systemCost - extraCosts;
                      saleItem.finalMargin = saleItem.closedValue > 0 ? (saleItem.netProfit / saleItem.closedValue) * 100 : 0;

                      await dataService.save('sales_summary', saleItem);
                  }
              } catch (err) {
                  console.warn("Automação Resumo de Vendas falhou:", err);
              }

              if (newStatus === 'Finalizado' && !orcamento.lavagem_cadastrada) {
                  try {
                      let variant = orcamento.variants?.find(v => v.isPrincipal) || orcamento.variants?.[0] || { formState: orcamento.formState, calculated: orcamento.calculated };
                      const fs = variant.formState;
                      
                      const newWashClient: LavagemClient = {
                          id: `wash-auto-${Date.now()}`,
                          owner_id: orcamento.owner_id,
                          name: fs.nomeCliente,
                          cep: fs.cep || '',
                          address: fs.enderecoCompleto || '',
                          address_number: '',
                          complement: '',
                          city: fs.cidade || '',
                          plates_count: Number(fs.terceiroInstalacaoQtd) || Number(variant.calculated?.placasQtd) || 0,
                          phone: fs.telefoneTitular || '',
                          observations: `Importado automaticamente em ${new Date().toLocaleDateString('pt-BR')}.`,
                          installation_end_date: new Date().toISOString().split('T')[0]
                      };
                      
                      await dataService.save('lavagem_clients', newWashClient);
                      updatedOrcamento.lavagem_cadastrada = true;
                      await dataService.save('orcamentos', updatedOrcamento);
                      setOrcamentos(prev => prev.map(o => o.id === id ? updatedOrcamento : o));
                  } catch (err) {
                      console.warn("Automação Lavagem falhou:", err);
                  }
              }
          } else {
              try {
                  const currentSales = await dataService.getAll<SalesSummaryItem>('sales_summary');
                  const saleToRemove = currentSales.find(s => s.orcamentoId === id);
                  if (saleToRemove) await dataService.delete('sales_summary', saleToRemove.id);
              } catch (err) {
                  console.warn("Erro ao remover do Resumo de Vendas:", err);
              }
          }
      } catch (e) {
          console.error("Erro crítico ao trocar status:", e);
          loadData(); 
      }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getDisplayData = (orc: SavedOrcamento) => {
      let clientName = "Sem nome"; 
      let displayPrice = 0; 
      let lucroLiquido = 0; 
      let variantCount = 0; 
      let dataOrcamento = "";
      let fornecedor = "";
      let placasQtd = 0;

      if (orc.variants?.length) {
          const p = orc.variants.find(v => v.isPrincipal) || orc.variants[0];
          clientName = p.formState?.nomeCliente || "Sem nome";
          displayPrice = p.calculated?.precoVendaFinal || 0;
          lucroLiquido = p.calculated?.lucroLiquido || 0;
          variantCount = orc.variants.length;
          dataOrcamento = p.formState?.dataOrcamento || "";
          fornecedor = p.formState?.fornecedor || "";
          placasQtd = Number(p.calculated?.placasQtd) || Number(p.formState?.terceiroInstalacaoQtd) || 0;
      } else if (orc.formState) {
          clientName = orc.formState.nomeCliente || "Sem nome";
          displayPrice = orc.calculated?.precoVendaFinal || 0;
          lucroLiquido = orc.calculated?.lucroLiquido || 0;
          dataOrcamento = orc.formState.dataOrcamento || "";
          fornecedor = orc.formState.fornecedor || "";
          placasQtd = Number(orc.calculated?.placasQtd) || Number(orc.formState?.terceiroInstalacaoQtd) || 0;
      }
      if (!dataOrcamento) dataOrcamento = orc.savedAt.split('T')[0];
      const ownerRawName = users.find(u => String(u.id) === String(orc.owner_id))?.name || 'Sistema';
      const ownerName = toSentenceCase(ownerRawName);
      return { clientName, displayPrice, lucroLiquido, variantCount, dataOrcamento, ownerName, fornecedor, placasQtd };
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
          
          if (activeTab !== 'Todos' && s !== activeTab) return false;
          
          if (selectedUsers.length > 0 && !selectedUsers.includes(String(orc.owner_id))) return false;
          if (startDate && d.dataOrcamento < startDate) return false;
          if (endDate && d.dataOrcamento > endDate) return false;
          v += d.displayPrice; l += d.lucroLiquido;
          return true;
      });

      f.sort((a, b) => {
          const dateA = getDisplayData(a).dataOrcamento;
          const dateB = getDisplayData(b).dataOrcamento;
          return dateB.localeCompare(dateA);
      });

      return { filteredOrcamentos: f, totalVendaFiltrado: v, totalLucroFiltrado: l };
  }, [orcamentos, searchTerm, activeTab, selectedUsers, startDate, endDate, users]);

  // Dynamic calculations for advanced commercial insight
  const allLength = filtered.filteredOrcamentos.length;
  const approvedStatsCount = filtered.filteredOrcamentos.filter(o => o.status === 'Aprovado' || o.status === 'Finalizado').length;
  const conversionRate = allLength > 0 ? (approvedStatsCount / allLength) * 100 : 0;
  const avgMargin = filtered.totalVendaFiltrado > 0 ? (filtered.totalLucroFiltrado / filtered.totalVendaFiltrado) * 100 : 0;
  const avgTicket = allLength > 0 ? filtered.totalVendaFiltrado / allLength : 0;

  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const getMonthLabel = (key: string) => {
    const [year, month] = key.split('-');
    const monthIndex = parseInt(month, 10) - 1;
    const name = MONTH_NAMES[monthIndex] || month;
    return `${name} de ${year}`;
  };

  const groupedMonths = useMemo(() => {
    const groups: Record<string, { label: string; items: SavedOrcamento[]; totalValue: number; totalProfit: number; count: number }> = {};
    
    filtered.filteredOrcamentos.forEach(orc => {
        const d = getDisplayData(orc);
        const key = d.dataOrcamento ? d.dataOrcamento.substring(0, 7) : 'Outros';
        if (!groups[key]) {
            const label = key !== 'Outros' ? getMonthLabel(key) : 'Sem Data';
            groups[key] = {
                label,
                items: [],
                totalValue: 0,
                totalProfit: 0,
                count: 0
            };
        }
        groups[key].items.push(orc);
        groups[key].totalValue += d.displayPrice;
        groups[key].totalProfit += d.lucroLiquido;
        groups[key].count += 1;
    });

    return Object.keys(groups)
        .sort((a, b) => b.localeCompare(a))
        .map(key => ({
            key,
            ...groups[key]
        }));
  }, [filtered.filteredOrcamentos]);

  if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6">
        {/* Bento Dashboard Section - Executive High End Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 p-5 rounded-2xl shadow-xl shadow-indigo-950/10 text-white relative overflow-hidden group hover:scale-[1.01] transition-all duration-300 border border-indigo-800/20">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                    <DollarIcon className="w-32 h-32 text-indigo-100" />
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Volume Comercial</p>
                        <h3 className="text-2xl font-black mt-1 leading-none tracking-tight">{formatCurrency(filtered.totalVendaFiltrado)}</h3>
                    </div>
                    <span className="p-2.5 bg-indigo-800/40 rounded-xl border border-indigo-700/30 text-indigo-200">
                        <DollarIcon className="w-5 h-5" />
                    </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-indigo-800/30 pt-3">
                    <span className="text-[10px] text-indigo-300 font-bold uppercase tracking-wider">Ticket Médio</span>
                    <span className="text-xs font-extrabold text-indigo-100">{formatCurrency(avgTicket)}</span>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5">
                    <TrendUpIcon className="w-32 h-32 text-emerald-600" />
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Lucratividade Estimada</p>
                        <h3 className="text-2xl font-black mt-1 leading-none tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(filtered.totalLucroFiltrado)}</h3>
                    </div>
                    <span className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-800/20 text-emerald-600 dark:text-emerald-400">
                        <TrendUpIcon className="w-5 h-5" />
                    </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Margem Média Geral</span>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/10">
                        {avgMargin.toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.01] transition-all duration-300 border border-gray-100 dark:border-gray-700 relative overflow-hidden group">
                <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-5">
                    <CheckCircleIcon className="w-32 h-32 text-indigo-600" />
                </div>
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Funil & Conversão</p>
                        <h3 className="text-2xl font-black mt-1 leading-none tracking-tight text-indigo-600 dark:text-indigo-400">{approvedStatsCount} <span className="text-xs font-bold text-gray-400">de {allLength} proj.</span></h3>
                    </div>
                    <span className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-800/10 text-indigo-600 dark:text-indigo-400">
                        <CheckCircleIcon className="w-5 h-5" />
                    </span>
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 dark:border-gray-700 pt-3">
                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Aproveitamento</span>
                    <span className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2.5 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-800/10">
                        {conversionRate.toFixed(1)}%
                    </span>
                </div>
            </div>
        </div>

        {/* Action Header & Section */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl border border-gray-100/50 dark:border-gray-700/60">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
                <div>
                    <h2 className="text-xl font-black text-gray-800 dark:text-white leading-tight tracking-tight">Projetos & Oportunidades</h2>
                    <p className="text-xs text-gray-400 font-bold mt-1">Gestão inteligente e acompanhamento comercial da sua carteira solar.</p>
                </div>
                <button onClick={() => setCurrentPage('NOVO_ORCAMENTO')} className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/30 transition-all font-black text-xs uppercase tracking-wider tracking-widest">
                    <AddIcon className="w-4 h-4" /> Novo projeto
                </button>
            </div>

            <div className="flex flex-col gap-4 mb-6">
                {/* Modern Navigation Pill Status Filter Bar */}
                <div className="bg-gray-50 dark:bg-gray-900/40 p-1.5 rounded-2xl border border-gray-100/60 dark:border-gray-700/30 flex flex-wrap gap-1">
                    {[
                        { id: 'Em Aberto', label: 'Especulação', color: 'bg-amber-500 text-white shadow-md shadow-amber-500/10', inactive: 'text-amber-600 hover:bg-amber-50/50 dark:hover:bg-amber-950/10', countColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700' },
                        { id: 'Aprovado', label: 'Aprovados', color: 'bg-emerald-500 text-white shadow-md shadow-emerald-500/10', inactive: 'text-emerald-600 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/10', countColor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700' },
                        { id: 'Finalizado', label: 'Finalizados', color: 'bg-violet-500 text-white shadow-md shadow-violet-500/10', inactive: 'text-violet-600 hover:bg-violet-50/50 dark:hover:bg-violet-950/10', countColor: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700' },
                        { id: 'Parado', label: 'Parados', color: 'bg-orange-500 text-white shadow-md shadow-orange-500/10', inactive: 'text-orange-600 hover:bg-orange-50/50 dark:hover:bg-orange-950/10', countColor: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700' },
                        { id: 'Perdido', label: 'Perdidos', color: 'bg-rose-500 text-white shadow-md shadow-rose-500/10', inactive: 'text-rose-600 hover:bg-rose-50/50 dark:hover:bg-rose-950/10', countColor: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700' },
                        { id: 'Todos', label: 'Todos', color: 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 shadow-md', inactive: 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800', countColor: 'bg-gray-100 dark:bg-gray-800 text-gray-500' }
                    ].map((tab) => {
                        const count = orcamentos.filter(o => tab.id === 'Todos' || (o.status || 'Em Aberto') === tab.id).length;
                        const isActive = activeTab === tab.id;
                        
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-tight transition-all duration-200 ${
                                    isActive ? tab.color : `bg-transparent ${tab.inactive}`
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-lg text-[9px] font-black leading-none ${
                                    isActive ? 'bg-white/20 text-white' : tab.countColor
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Second Level Filter Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 bg-gray-50/50 dark:bg-gray-900/10 p-4 rounded-2xl border border-gray-100/60 dark:border-gray-700/30">
                    <div className="md:col-span-5 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                            <SearchIcon className="w-4 h-4" />
                        </span>
                        <input 
                            type="text" 
                            placeholder="Buscar cliente ou parceiro comercial..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-700 dark:text-gray-100 transition-all placeholder:text-gray-400" 
                        />
                    </div>

                    {isAdminUser && (
                        <div className="md:col-span-3 relative" ref={userDropdownRef}>
                            <button onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} className="flex items-center justify-between w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2.5 rounded-xl text-xs font-black text-gray-600 dark:text-gray-300 transition-all hover:bg-gray-50">
                                <div className="flex items-center gap-2 truncate">
                                    <UsersIcon className="w-4 h-4 text-gray-400" />
                                    <span>{selectedUsers.length === 0 ? 'Vendedor' : `${selectedUsers.length} Selecionados`}</span>
                                </div>
                                <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${isUserDropdownOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isUserDropdownOpen && (
                                <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto">
                                    <p className="px-4 py-1.5 text-[8px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-50 dark:border-gray-700/50 mb-1">Filtrar por Vendedor</p>
                                    {users.map(user => (
                                        <label key={user.id} className="flex items-center px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group transition-colors">
                                            <input type="checkbox" className="hidden" checked={selectedUsers.includes(String(user.id))} onChange={() => toggleUserFilter(String(user.id))} />
                                            <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${selectedUsers.includes(String(user.id)) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                                                {selectedUsers.includes(String(user.id)) && <CheckCircleIcon className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className={`text-xs font-bold ${selectedUsers.includes(String(user.id)) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-300'}`}>{user.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="md:col-span-4 flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
                        <span className="text-gray-400">
                            <CalendarIcon className="w-4 h-4" />
                        </span>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs font-bold dark:bg-gray-800 outline-none text-gray-600 dark:text-gray-200 flex-1 cursor-pointer" />
                        <span className="text-gray-300">até</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs font-bold dark:bg-gray-800 outline-none text-gray-600 dark:text-gray-200 flex-1 cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* Redesigned CRM Grid List */}
            <div className="space-y-8">
                {groupedMonths.map(month => (
                    <div key={month.key} className="space-y-4">
                        {/* Month block divider section */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50/70 dark:bg-gray-900/60 px-5 py-3.5 rounded-2xl border border-gray-100/50 dark:border-gray-800/40 gap-3">
                            <div className="flex items-center gap-3">
                                <span className="p-1 px-3 bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 text-xs font-black rounded-xl uppercase tracking-wider">
                                    {month.label}
                                </span>
                                <span className="text-xs text-gray-400 font-bold">
                                    {month.count} {month.count === 1 ? 'projeto' : 'projetos'}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
                                <div>
                                    <span className="text-gray-400 text-[10px] uppercase font-black mr-1.5">Valor Orçado:</span>
                                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">{formatCurrency(month.totalValue)}</span>
                                </div>
                                {month.totalProfit > 0 && (
                                    <div className="border-l border-gray-200 dark:border-gray-800 pl-4">
                                        <span className="text-gray-400 text-[10px] uppercase font-black mr-1.5">Lucro Est.:</span>
                                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(month.totalProfit)}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* List of budgets for this month */}
                        <div className="space-y-4 pl-0 sm:pl-3">
                            {month.items.map(orc => {
                                const d = getDisplayData(orc);
                                const isReadOnlyStatus = orc.status === 'Finalizado';
                                const isApproved = orc.status === 'Aprovado' || orc.status === 'Finalizado';
                                const currentTheme = STATUS_COLORS[orc.status] || defaultColor;

                                // Compute dynamic gross margin percentage for the specific contract card
                                const individualMargin = d.displayPrice > 0 ? (d.lucroLiquido / d.displayPrice) * 100 : 0;
                                
                                return (
                                    <div 
                                        key={orc.id} 
                                        className={`p-5 rounded-2xl border ${currentTheme.border} bg-white dark:bg-gray-800/70 hover:shadow-xl hover:translate-y-[-1px] transition-all duration-300 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 relative overflow-hidden`}
                                    >
                                        {/* Colorful Left Border Accent representing modern commercial states */}
                                        <div className={`absolute top-0 left-0 w-1.5 h-full ${currentTheme.dot}`}></div>

                                        {/* Main Deal & Client Details Group */}
                                        <div className="flex-1 flex gap-4 pl-1.5">
                                            {/* Letter container representing initial avatar with floating status indicator */}
                                            <div className="relative hidden sm:block">
                                                <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-xs ${currentTheme.badge} shadow-inner`}>
                                                    {d.clientName.substring(0, 2).toUpperCase()}
                                                </div>
                                                <div className={`absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center ${currentTheme.dot}`}>
                                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                                </div>
                                            </div>

                                            <div className="space-y-1.5">
                                                <div className="flex items-center flex-wrap gap-2">
                                                    <h4 className="font-extrabold text-base text-gray-800 dark:text-slate-100 tracking-tight leading-none">{d.clientName}</h4>
                                                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-700/40 px-2 py-0.5 rounded-md border border-gray-100 dark:border-gray-700">
                                                        #ORC-{orc.id}
                                                    </span>
                                                    {orc.lavagem_cadastrada && (
                                                        <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-100 dark:border-emerald-800/10 shadow-sm animate-pulse">
                                                            <SparklesIcon className="w-2.5 h-2.5 text-emerald-500" /> Lavagem Ativa
                                                        </span>
                                                    )}
                                                </div>

                                                {/* CRM Commercial Tag Metadata list under client info */}
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-950/20 px-2.5 py-1 rounded-lg text-[10px] font-bold text-gray-500 dark:text-gray-400 border border-gray-100 dark:border-gray-700/50">
                                                        <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
                                                        <span>{new Date(d.dataOrcamento).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</span>
                                                    </div>
                                                    {d.placasQtd > 0 ? (
                                                        <div className="flex items-center gap-1.5 bg-indigo-50/50 dark:bg-indigo-950/10 px-2.5 py-1 rounded-lg text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-100/20 dark:border-indigo-800/10">
                                                            <CalculatorIcon className="w-3.5 h-3.5 text-indigo-500" />
                                                            <span>{d.placasQtd} Módulos ({Math.round(d.placasQtd * 0.55).toFixed(1)} kWp)</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-950/20 px-2.5 py-1 rounded-lg text-[10px] font-bold text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-gray-700/50">
                                                            <CalculatorIcon className="w-3.5 h-3.5 text-gray-300" />
                                                            <span>Sem placas salvas</span>
                                                        </div>
                                                    )}
                                                    {d.fornecedor && (
                                                        <div className="flex items-center gap-1 bg-amber-50/50 dark:bg-amber-950/10 px-2 py-0.5 rounded-lg text-[9px] font-extrabold text-amber-700 dark:text-amber-400 border border-amber-100/10 dark:border-amber-800/10 uppercase tracking-wider">
                                                            <span>{d.fornecedor}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-1 bg-purple-50/50 dark:bg-purple-950/10 px-2 py-0.5 rounded-lg text-[9px] font-extrabold text-purple-700 dark:text-purple-400 border border-purple-100/10 dark:border-purple-800/10">
                                                        <span>{d.variantCount} {d.variantCount === 1 ? 'Opção' : 'Opções'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 bg-slate-100 dark:bg-gray-700 px-2 py-0.5 rounded-lg text-[9px] font-black text-gray-500 dark:text-gray-300 uppercase tracking-tighter">
                                                        <span>Resp: {d.ownerName}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Financials, Interactive Status Pill & Hover Action Items */}
                                        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between sm:justify-end gap-5 w-full lg:w-auto border-t lg:border-t-0 border-gray-100 dark:border-gray-700 pt-4 lg:pt-0">
                                            {/* Responsive Financial figures representing price and profit margin metrics */}
                                            <div className="text-left sm:text-right">
                                                <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-wider">Valor do Contrato</span>
                                                <h4 className="font-black text-lg text-indigo-600 dark:text-indigo-400 tracking-tight leading-none mt-1">{formatCurrency(d.displayPrice)}</h4>
                                                {d.lucroLiquido > 0 && (
                                                    <div className="flex items-center gap-1 sm:justify-end mt-1 text-[10px]">
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-extrabold">{individualMargin.toFixed(1)}% Margem</span>
                                                        <span className="text-gray-400">({formatCurrency(d.lucroLiquido)} lucro)</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Custom beautiful native styled select dropdown mimicking custom pills */}
                                            <div className="relative">
                                                <select 
                                                    value={orc.status} 
                                                    onChange={e => handleStatusChange(orc.id, e.target.value as any)} 
                                                    disabled={isReadOnlyStatus}
                                                    className={`pl-3 pr-8 py-2 rounded-xl text-[10px] font-black border uppercase tracking-wider outline-none cursor-pointer hover:shadow-md transition-all bg-no-repeat bg-right ${currentTheme.bg} ${currentTheme.text} ${currentTheme.border} ${isReadOnlyStatus ? 'opacity-65 cursor-not-allowed' : ''}`}
                                                    style={{ 
                                                        appearance: 'none', 
                                                        backgroundImage: `url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='currentColor'%3E%3Cpath fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/%3E%3C/svg%3E")`, 
                                                        backgroundSize: '1.15rem', 
                                                        backgroundPosition: 'right 0.35rem center' 
                                                    }}
                                                >
                                                    <option value="Em Aberto" className="bg-white dark:bg-gray-800 text-amber-800 font-bold">Em aberto</option>
                                                    <option value="Aprovado" className="bg-white dark:bg-gray-800 text-emerald-800 font-bold">Aprovado</option>
                                                    <option value="Finalizado" className="bg-white dark:bg-gray-800 text-violet-800 font-bold">Finalizado</option>
                                                    <option value="Parado" className="bg-white dark:bg-gray-800 text-orange-800 font-bold">Parado</option>
                                                    <option value="Perdido" className="bg-white dark:bg-gray-800 text-rose-800 font-bold">Perdido</option>
                                                </select>
                                            </div>

                                            {/* Floating circular key icons */}
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => onEdit(orc)} 
                                                    className={`p-2.5 rounded-xl border transition-all duration-200 ${
                                                        isApproved 
                                                        ? 'text-blue-600 bg-blue-50 border-blue-100 hover:bg-blue-100 dark:bg-blue-900/20 dark:border-blue-800/10' 
                                                        : 'text-gray-400 bg-gray-50 border-gray-100 hover:text-indigo-600 hover:bg-indigo-50 dark:bg-gray-800 dark:border-gray-700/50 dark:hover:text-indigo-400'
                                                    }`} 
                                                    title={isApproved ? 'Visualizar Proposta' : 'Editar Proposta'}
                                                >
                                                    {isApproved ? <EyeIcon className="w-4 h-4" /> : <EditIcon className="w-4 h-4" />}
                                                </button>
                                                {(currentUser.profileId === ADMIN_PROFILE_ID) && !isReadOnlyStatus && (
                                                    <button 
                                                        onClick={() => { setOrcamentoToDeleteId(orc.id); setDeleteModalOpen(true); }} 
                                                        className="p-2.5 text-gray-400 bg-gray-50 border-gray-100 hover:text-red-600 hover:bg-red-50 dark:bg-gray-800 dark:border-gray-700/50 dark:hover:text-red-400 hover:border-red-100 rounded-xl transition-all duration-200"
                                                        title="Excluir Orçamento"
                                                    >
                                                        <TrashIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {filtered.filteredOrcamentos.length === 0 && (
                    <div className="py-20 text-center bg-gray-50/20 dark:bg-gray-900/10 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700/60">
                        <FilterIcon className="w-10 h-10 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-400 font-extrabold italic text-xs">Nenhum orçamento encontrado para os critérios selecionados.</p>
                    </div>
                )}
            </div>
        </div>

        {isDeleteModalOpen && (
            <Modal title="Excluir orçamento permanentemente" onClose={() => setDeleteModalOpen(false)}>
                <div className="text-center p-4 space-y-6">
                    <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto border border-red-100 dark:border-red-900/30 shadow-inner">
                        <TrashIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="font-extrabold text-gray-800 dark:text-gray-100 text-sm">Deseja excluir este projeto permanentemente?</p>
                        <p className="text-xs text-gray-400 font-bold mt-1.5">Esta ação é irreversível e removerá também registros associados do Resumo de Vendas.</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setDeleteModalOpen(false)} className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 text-gray-600 dark:text-gray-200 rounded-xl font-bold text-xs transition-colors">Cancelar</button>
                        <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-red-600/15 transition-all">Confirmar Exclusão</button>
                    </div>
                </div>
            </Modal>
        )}
    </div>
  );
};

export default OrcamentoPage;
