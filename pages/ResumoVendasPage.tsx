
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ChartPieIcon, TableIcon, DollarIcon, TrendUpIcon, PrinterIcon, CalendarIcon, FilterIcon, TrashIcon, UsersIcon, SearchIcon, ChevronDownIcon, CheckCircleIcon, EditIcon, SaveIcon, XCircleIcon, ClockIcon } from '../assets/icons';
import DashboardCard from '../components/DashboardCard';
import type { SalesSummaryItem, User, SavedOrcamento } from '../types';
import { dataService } from '../services/dataService';

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value) || value === 0) return 'R$ -';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatPercent = (value: number) => {
    if (isNaN(value)) return '0,00%';
    return `${value.toFixed(2).replace('.', ',')}%`;
};

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const ResumoVendasPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [salesData, setSalesData] = useState<SalesSummaryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [editingCell, setEditingCell] = useState<{ id: number, field: 'invoicedTax' | 'bankFees' } | null>(null);
    const [tempValue, setTempValue] = useState<string>('');

    const ADMIN_PROFILE_ID = '001';

    const loadData = async () => {
        setIsLoading(true);
        const isAdmin = currentUser.profileId === ADMIN_PROFILE_ID;
        // Buscamos todos os registros de resumo de vendas vinculados ao usuário ou todos se admin
        const data = await dataService.getAll<SalesSummaryItem>('sales_summary', currentUser.id, isAdmin);
        // Filtramos apenas os que estão com status de venda fechada
        const salesToShow = data.filter(item => {
            const status = (item.status || '').trim().toLowerCase();
            return status === 'aprovado' || status === 'finalizado';
        });
        setSalesData(salesToShow);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();

        const date = new Date();
        // Filtro padrão a partir de 2023 para garantir que nada se perca
        const start = '2023-01-01';
        const end = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

        setStartDate(start);
        setEndDate(end);

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsSupplierDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [currentUser]);

    const handleSyncBudgets = async () => {
        if (!confirm("Isso irá verificar todos os seus orçamentos e garantir que os aprovados apareçam aqui. Deseja continuar?")) return;
        
        setIsSyncing(true);
        try {
            const isAdmin = currentUser.profileId === ADMIN_PROFILE_ID;
            const budgets = await dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdmin);
            
            // Filtro robusto de aprovados e finalizados
            const approvedBudgets = budgets.filter(b => {
                const s = (b.status || '').trim().toLowerCase();
                return s === 'aprovado' || s === 'finalizado';
            });
            
            let syncCount = 0;
            for (const budget of approvedBudgets) {
                // Tenta pegar a variante principal ou os dados da raiz
                let variant = budget.variants?.find(v => v.isPrincipal) || budget.variants?.[0];
                const fs = variant?.formState || budget.formState;
                const calc = variant?.calculated || budget.calculated;

                if (fs && calc) {
                    const thirdPartyInstallation = (Number(fs.terceiroInstalacaoQtd) || 0) * (Number(fs.terceiroInstalacaoCusto) || 0);

                    // Usamos o budget.id como ID do resumo para garantir 1:1
                    const saleItem: SalesSummaryItem = {
                        id: budget.id, // ID Unificado
                        orcamentoId: budget.id,
                        owner_id: budget.owner_id,
                        clientName: fs.nomeCliente || 'Cliente sem nome',
                        date: fs.dataOrcamento || budget.savedAt.split('T')[0],
                        closedValue: Number(calc.precoVendaFinal) || 0,
                        systemCost: Number(calc.valorVendaSistema) || 0,
                        supplier: fs.fornecedor || 'N/A',
                        visitaTecnica: Number(fs.visitaTecnicaCusto) || 0,
                        homologation: Number(fs.projetoHomologacaoCusto) || 0,
                        installation: thirdPartyInstallation,
                        travelCost: Number(fs.custoViagem) || 0,
                        adequationCost: Number(fs.adequacaoLocalCusto) || 0,
                        materialCost: Number(calc.totalEstrutura) || 0,
                        invoicedTax: Number(calc.nfServicoValor) || 0,
                        commission: Number(calc.comissaoVendasValor) || 0,
                        bankFees: 0,
                        totalCost: 0,
                        netProfit: 0,
                        finalMargin: 0,
                        status: budget.status
                    };

                    const extraCosts = 
                        saleItem.visitaTecnica + saleItem.homologation + saleItem.installation + 
                        saleItem.travelCost + saleItem.adequationCost + saleItem.materialCost + 
                        saleItem.invoicedTax + saleItem.commission + saleItem.bankFees;

                    saleItem.totalCost = extraCosts;
                    saleItem.netProfit = saleItem.closedValue - saleItem.systemCost - extraCosts;
                    saleItem.finalMargin = saleItem.closedValue > 0 ? (saleItem.netProfit / saleItem.closedValue) * 100 : 0;

                    await dataService.save('sales_summary', saleItem);
                    syncCount++;
                }
            }
            
            await loadData();
            alert(`${syncCount} registros sincronizados com sucesso.`);
        } catch (e) {
            console.error("Erro na sincronização:", e);
            alert("Ocorreu um erro ao sincronizar os dados. Verifique o console.");
        } finally {
            setIsSyncing(false);
        }
    };

    const suppliersList = useMemo(() => {
        const unique = new Set<string>();
        salesData.forEach(item => {
            if (item.supplier) unique.add(item.supplier.trim());
        });
        return Array.from(unique).sort();
    }, [salesData]);

    const handleStartEdit = (item: SalesSummaryItem, field: 'invoicedTax' | 'bankFees') => {
        setEditingCell({ id: item.id, field });
        setTempValue(String(item[field] || 0));
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setTempValue('');
    };

    const handleSaveEdit = async (id: number, field: string) => {
        const numValue = parseFloat(tempValue.replace(',', '.'));
        const safeValue = isNaN(numValue) ? 0 : numValue;

        const updatedData = salesData.map(item => {
            if (item.id === id) {
                const newItem = { ...item, [field]: safeValue };
                const extraCosts = 
                    (newItem.visitaTecnica || 0) +
                    (newItem.homologation || 0) +
                    (newItem.installation || 0) +
                    (newItem.travelCost || 0) +
                    (newItem.adequationCost || 0) +
                    (newItem.materialCost || 0) +
                    (newItem.invoicedTax || 0) +
                    (newItem.commission || 0) +
                    (newItem.bankFees || 0);

                const netProfit = (newItem.closedValue || 0) - (newItem.systemCost || 0) - extraCosts;
                const finalMargin = newItem.closedValue > 0 ? (netProfit / newItem.closedValue) * 100 : 0;
                
                return { ...newItem, totalCost: extraCosts, netProfit, finalMargin };
            }
            return item;
        });

        setSalesData(updatedData);
        const itemToSave = updatedData.find(i => i.id === id);
        if (itemToSave) await dataService.save('sales_summary', itemToSave);
        
        setEditingCell(null);
        setTempValue('');
    };

    const toggleSupplierSelection = (supplier: string) => {
        setSelectedSuppliers(prev => 
            prev.includes(supplier) 
                ? prev.filter(s => s !== supplier) 
                : [...prev, supplier]
        );
    };

    const filteredSalesData = useMemo(() => {
        return [...salesData].sort((a, b) => b.date.localeCompare(a.date)).filter(item => {
            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;
            if (selectedSuppliers.length > 0) {
                const itemSup = item.supplier?.trim() || 'N/A';
                if (!selectedSuppliers.includes(itemSup)) return false;
            }
            return true;
        });
    }, [salesData, startDate, endDate, selectedSuppliers]);

    const totals = useMemo(() => {
        return filteredSalesData.reduce((acc, item) => {
            return {
                closedValue: acc.closedValue + (item.closedValue || 0),
                systemCost: acc.systemCost + (item.systemCost || 0),
                visitaTecnica: acc.visitaTecnica + (item.visitaTecnica || 0),
                homologation: acc.homologation + (item.homologation || 0),
                installation: acc.installation + (item.installation || 0),
                travelCost: acc.travelCost + (item.travelCost || 0),
                adequationCost: acc.adequationCost + (item.adequationCost || 0),
                materialCost: acc.materialCost + (item.materialCost || 0),
                invoicedTax: acc.invoicedTax + (item.invoicedTax || 0),
                commission: acc.commission + (item.commission || 0),
                bankFees: acc.bankFees + (item.bankFees || 0),
                totalCost: acc.totalCost + (item.totalCost || 0),
                netProfit: acc.netProfit + (item.netProfit || 0),
            };
        }, {
            closedValue: 0, systemCost: 0, visitaTecnica: 0, homologation: 0, installation: 0,
            travelCost: 0, adequationCost: 0, materialCost: 0, invoicedTax: 0, commission: 0, 
            bankFees: 0, totalCost: 0, netProfit: 0
        });
    }, [filteredSalesData]);

    const totalValorMO = totals.closedValue - totals.systemCost;
    const avgMargin = totals.closedValue > 0 ? (totals.netProfit / totals.closedValue) * 100 : 0;
    const avgServiceMargin = totalValorMO > 0 ? (totals.netProfit / totalValorMO) * 100 : 0;

    const handlePrint = () => window.print();

    const handleExportExcel = () => {
        const fmt = (n: number) => n ? n.toFixed(2).replace('.', ',') : '0,00';
        const headers = [
            'Nº', 'Nome cliente', 'Data fechamento', 'Valor fechado', 'Custo sistema', 
            'Fornecedor', 'Visita Técnica', 'Homologação', 'Instalação', 'Viagem', 
            'Adequação', 'Materiais', 'Imposto', 'Comissão', 'Taxas banco', 'Custo total', 
            'Lucro líquido', 'Margem final %', 'Status'
        ];
        let csvContent = "\uFEFF" + headers.join(';') + '\n';
        filteredSalesData.forEach((item, index) => {
            const row = [
                index + 1,
                item.clientName,
                new Date(item.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                fmt(item.closedValue),
                fmt(item.systemCost),
                item.supplier || 'N/A',
                fmt(item.visitaTecnica),
                fmt(item.homologation),
                fmt(item.installation),
                fmt(item.travelCost),
                fmt(item.adequationCost),
                fmt(item.materialCost),
                fmt(item.invoicedTax),
                fmt(item.commission),
                fmt(item.bankFees),
                fmt(item.totalCost),
                fmt(item.netProfit),
                fmt(item.finalMargin),
                item.status || 'Aprovado'
            ];
            csvContent += row.join(';') + '\n';
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `resumo_vendas_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleClearFilters = () => { setStartDate('2023-01-01'); setEndDate(new Date().toISOString().split('T')[0]); setSelectedSuppliers([]); };

    if (isLoading) return <div className="flex justify-center p-10"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div></div>;

    const thClass = "px-2 py-3 border-b border-gray-200 dark:border-gray-600 text-[9px] font-bold text-gray-600 dark:text-gray-300 text-center whitespace-nowrap";
    const tdClass = "px-2 py-2 border-b border-gray-100 dark:border-gray-700 text-[10px] text-gray-700 dark:text-gray-300 text-right whitespace-nowrap";

    const EditableCell = ({ item, field }: { item: SalesSummaryItem, field: 'invoicedTax' | 'bankFees' }) => {
        const isEditing = editingCell?.id === item.id && editingCell?.field === field;
        const value = item[field] || 0;

        if (isEditing) {
            return (
                <div className="flex items-center justify-end gap-1 min-w-[100px]">
                    <input 
                        autoFocus
                        type="text" 
                        className="w-16 bg-indigo-50 dark:bg-indigo-900/40 border-2 border-indigo-300 rounded p-1 text-right text-[10px] font-bold text-indigo-700 dark:text-indigo-300 focus:ring-0 outline-none animate-fade-in"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(item.id, field);
                            if (e.key === 'Escape') handleCancelEdit();
                        }}
                    />
                    <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleSaveEdit(item.id, field)} className="p-0.5 bg-green-500 text-white rounded hover:bg-green-600 transition-colors shadow-sm" title="Salvar"><CheckCircleIcon className="w-3 h-3" /></button>
                        <button onClick={handleCancelEdit} className="p-0.5 bg-gray-400 text-white rounded hover:bg-gray-500 transition-colors shadow-sm" title="Cancelar"><XCircleIcon className="w-3 h-3" /></button>
                    </div>
                </div>
            );
        }

        return (
            <div className="flex items-center justify-end gap-2 group min-w-[100px]">
                <span className="font-bold text-indigo-700 dark:text-indigo-400">{formatCurrency(value)}</span>
                <button onClick={() => handleStartEdit(item, field)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all" title="Editar campo"><EditIcon className="w-3.5 h-3.5" /></button>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 print:hidden">
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/30 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 w-full sm:w-auto">
                        <div className="pl-2 text-gray-500"><CalendarIcon className="w-5 h-5" /></div>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer w-full sm:w-auto" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-sm text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer w-full sm:w-auto" />
                    </div>

                    <div className="relative w-full sm:w-64" ref={dropdownRef}>
                        <button 
                            onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                            className="flex items-center justify-between w-full bg-gray-50 dark:bg-gray-700/30 p-2.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-all hover:bg-gray-100 dark:hover:bg-gray-700/50"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <FilterIcon className="w-4 h-4 text-gray-400" />
                                <span>{selectedSuppliers.length === 0 ? 'Todos os fornecedores' : `${selectedSuppliers.length} selecionado(s)`}</span>
                            </div>
                            <ChevronDownIcon className={`w-4 h-4 transition-transform ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isSupplierDropdownOpen && (
                            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 z-50 animate-fade-in py-2 max-h-64 overflow-y-auto custom-scrollbar">
                                {suppliersList.length > 0 ? (
                                    suppliersList.map(sup => (
                                        <label key={sup} className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer group">
                                            <input type="checkbox" className="hidden" checked={selectedSuppliers.includes(sup)} onChange={() => toggleSupplierSelection(sup)} />
                                            <div className={`w-4 h-4 rounded border mr-3 flex items-center justify-center transition-all ${selectedSuppliers.includes(sup) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300'}`}>{selectedSuppliers.includes(sup) && <CheckCircleIcon className="w-3.5 h-3.5 text-white" />}</div>
                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{sup}</span>
                                        </label>
                                    ))
                                ) : (
                                    <div className="px-4 py-3 text-xs text-gray-400 italic text-center">Nenhum fornecedor registrado.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={handleSyncBudgets} disabled={isSyncing} className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg border transition-all ${isSyncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}>
                        {isSyncing ? <ClockIcon className="w-4 h-4 animate-spin" /> : <ClockIcon className="w-4 h-4" />}
                        {isSyncing ? 'Sincronizando...' : 'Sincronizar orçamentos'}
                    </button>
                    {(startDate !== '2023-01-01' || selectedSuppliers.length > 0) && (
                        <button onClick={handleClearFilters} className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap">
                            <TrashIcon className="w-4 h-4" /> Limpar filtros
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 print:hidden">
                <DashboardCard title="Total venda cons. final" value={formatCurrency(totals.closedValue)} icon={DollarIcon} color="bg-blue-600" />
                <DashboardCard title="Total mão de obra" value={formatCurrency(totalValorMO)} icon={UsersIcon} color="bg-purple-600" />
                <DashboardCard title="Lucro líquido" value={formatCurrency(totals.netProfit)} icon={TrendUpIcon} color="bg-green-600" />
                <DashboardCard title="Margem média venda" value={formatPercent(avgMargin)} icon={ChartPieIcon} color="bg-indigo-600" />
                <DashboardCard title="Margem média serviço" value={formatPercent(avgServiceMargin)} icon={ChartPieIcon} color="bg-orange-600" />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-700/30 print:pb-2">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><TableIcon className="w-6 h-6 text-indigo-600" /> Resumo de vendas detalhado</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{filteredSalesData.length} projeto(s) em exibição no período.</p>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm font-bold text-xs">
                            <TableIcon className="w-5 h-5" /> Exportar
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 transition-colors shadow-sm font-bold text-xs">
                            <PrinterIcon className="w-5 h-5" /> Imprimir
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-100 dark:bg-gray-700">
                                <th className={`${thClass} w-10`}>Nº</th>
                                <th className={`${thClass} text-left`}>Cliente</th>
                                <th className={`${thClass}`}>Data</th>
                                <th className={`${thClass}`}>V. Fechado</th>
                                <th className={`${thClass}`}>Custo Sist.</th>
                                <th className={`${thClass}`}>Fornec.</th>
                                <th className={`${thClass}`}>V. Técnica</th>
                                <th className={`${thClass}`}>Homolog.</th>
                                <th className={`${thClass}`}>Instal.</th>
                                <th className={`${thClass}`}>Viagem</th>
                                <th className={`${thClass}`}>Adequação</th>
                                <th className={`${thClass}`}>Materiais</th>
                                <th className={`${thClass} bg-indigo-50/30 dark:bg-indigo-900/20`}>Imposto</th>
                                <th className={`${thClass}`}>Comissão</th>
                                <th className={`${thClass} bg-indigo-50/30 dark:bg-indigo-900/20`}>Taxas banco</th>
                                <th className={`${thClass} bg-gray-200 dark:bg-gray-600`}>Custo total</th>
                                <th className={`${thClass} bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400`}>Lucro líq.</th>
                                <th className={`${thClass}`}>Margem final</th>
                                <th className={`${thClass}`}>Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredSalesData.length > 0 ? filteredSalesData.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
                                    <td className={`${tdClass} text-center font-bold text-gray-400`}>{index + 1}</td>
                                    <td className={`${tdClass} text-left font-bold text-gray-900 dark:text-white uppercase truncate max-w-[120px]`}>{item.clientName}</td>
                                    <td className={`${tdClass} text-center`}>{new Date(item.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                    <td className={`${tdClass} font-bold text-blue-700 dark:text-blue-400`}>{formatCurrency(item.closedValue)}</td>
                                    <td className={tdClass}>{formatCurrency(item.systemCost)}</td>
                                    <td className={`${tdClass} text-center font-medium text-gray-500`}>{item.supplier || 'N/A'}</td>
                                    <td className={tdClass}>{formatCurrency(item.visitaTecnica)}</td>
                                    <td className={tdClass}>{formatCurrency(item.homologation)}</td>
                                    <td className={tdClass}>{formatCurrency(item.installation)}</td>
                                    <td className={tdClass}>{formatCurrency(item.travelCost)}</td>
                                    <td className={tdClass}>{formatCurrency(item.adequationCost)}</td>
                                    <td className={tdClass}>{formatCurrency(item.materialCost)}</td>
                                    <td className={`${tdClass} bg-indigo-50/20 dark:bg-indigo-900/10`}>
                                        <EditableCell item={item} field="invoicedTax" />
                                    </td>
                                    <td className={tdClass}>{formatCurrency(item.commission)}</td>
                                    <td className={`${tdClass} bg-indigo-50/20 dark:bg-indigo-900/10`}>
                                        <EditableCell item={item} field="bankFees" />
                                    </td>
                                    <td className={`${tdClass} font-bold bg-gray-50/50 dark:bg-gray-700/20`}>{formatCurrency(item.totalCost)}</td>
                                    <td className={`${tdClass} font-black text-green-700 dark:text-green-400 bg-green-50/30 dark:bg-green-900/10`}>{formatCurrency(item.netProfit)}</td>
                                    <td className={`${tdClass} text-center`}>
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${item.finalMargin > 25 ? 'bg-green-100 text-green-800' : item.finalMargin > 15 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                            {formatPercent(item.finalMargin)}
                                        </span>
                                    </td>
                                    <td className={`${tdClass} text-center`}>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.status === 'Finalizado' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                            {toSentenceCase(item.status || 'Aprovado')}
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan={19} className="px-6 py-12 text-center text-gray-400 italic">Nenhum registro encontrado. Se você tem orçamentos aprovados que não aparecem, clique em "Sincronizar orçamentos".</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            <p className="text-[10px] text-gray-400 font-bold text-center italic">* Nota: Apenas orçamentos aprovados ou finalizados são listados aqui.</p>
        </div>
    );
};

export default ResumoVendasPage;
