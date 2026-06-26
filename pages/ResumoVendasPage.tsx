
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ChartPieIcon, TableIcon, DollarIcon, TrendUpIcon, PrinterIcon, CalendarIcon, FilterIcon, TrashIcon, UsersIcon, SearchIcon, ChevronDownIcon, CheckCircleIcon, EditIcon, SaveIcon, XCircleIcon, ClockIcon, WrenchIcon, EyeIcon, ArrowLeftIcon, PlusIcon, CubeIcon } from '../assets/icons';
import DashboardCard from '../components/DashboardCard';
import type { SalesSummaryItem, User, SavedOrcamento, ManutencaoRecord } from '../types';
import { dataService } from '../services/dataService';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie } from 'recharts';

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

const ResumoVendasPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    // Tab State: 'consolidado' | 'orcamento' | 'manutencao'
    const [activeTab, setActiveTab] = useState<'consolidado' | 'orcamento' | 'manutencao'>('consolidado');

    // Data lists
    const [salesData, setSalesData] = useState<SalesSummaryItem[]>([]);
    const [allBudgets, setAllBudgets] = useState<SavedOrcamento[]>([]);
    const [salesMaintenance, setSalesMaintenance] = useState<ManutencaoRecord[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    
    // Filters (shared or specific depending on usage)
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Row expansion states
    const [expandedBudgetRowId, setExpandedBudgetRowId] = useState<number | null>(null);
    const [expandedMaintRowId, setExpandedMaintRowId] = useState<string | null>(null);

    // Inline cell editing for Orçamentos (taxes / fees)
    const [editingCell, setEditingCell] = useState<{ id: number, field: 'invoicedTax' | 'bankFees' } | null>(null);
    const [tempValue, setTempValue] = useState<string>('');

    const ADMIN_PROFILE_ID = '001';

    const loadData = async () => {
        setIsLoading(true);
        try {
            const isAdmin = currentUser.profileId === ADMIN_PROFILE_ID;
            
            const [salesDataRes, orcamentosRes, manutencoesRes] = await Promise.all([
                dataService.getAll<SalesSummaryItem>('sales_summary', currentUser.id, isAdmin),
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdmin),
                dataService.getAll<ManutencaoRecord>('manutencoes', currentUser.id, isAdmin)
            ]);

            // Filter approved or finalized sales (for budgets)
            const salesToShow = salesDataRes.filter(item => {
                const status = (item.status || '').trim().toLowerCase();
                return status === 'aprovado' || status === 'finalizado';
            });
            setSalesData(salesToShow);
            setAllBudgets(orcamentosRes);

            // Filter completed maintenance records (Aprovado or Finalizado)
            const maintenanceToShow = (manutencoesRes || []).filter(item => {
                const status = (item.status || '').trim().toLowerCase();
                return status === 'finalizado' || status === 'aprovado';
            });
            setSalesMaintenance(maintenanceToShow);
        } catch (error) {
            console.error("Erro ao carregar dados do resumo de vendas:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const date = new Date();
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
            
            const approvedBudgets = budgets.filter(b => {
                const s = (b.status || '').trim().toLowerCase();
                return s === 'aprovado' || s === 'finalizado';
            });
            
            let syncCount = 0;
            for (const budget of approvedBudgets) {
                let variant = budget.variants?.find(v => v.isPrincipal) || budget.variants?.[0];
                const fs = variant?.formState || budget.formState;
                const calc = variant?.calculated || budget.calculated;

                if (fs && calc) {
                    const thirdPartyInstallation = parseSafeNumber(fs.terceiroInstalacaoQtd) * parseSafeNumber(fs.terceiroInstalacaoCusto);

                    const saleItem: SalesSummaryItem = {
                        id: budget.id,
                        orcamentoId: budget.id,
                        owner_id: budget.owner_id,
                        clientName: fs.nomeCliente || 'Cliente sem nome',
                        date: fs.dataOrcamento || budget.savedAt.split('T')[0],
                        closedValue: parseSafeNumber(calc.precoVendaFinal),
                        systemCost: parseSafeNumber(calc.valorVendaSistema),
                        supplier: fs.fornecedor || 'N/A',
                        visitaTecnica: parseSafeNumber(fs.visitaTecnicaCusto),
                        homologation: parseSafeNumber(fs.projetoHomologacaoCusto),
                        installation: thirdPartyInstallation,
                        travelCost: fs.deslocamento !== undefined ? (parseSafeNumber(fs.deslocamento) + parseSafeNumber(fs.pedagio)) : parseSafeNumber(fs.custoViagem),
                        deslocamento: fs.deslocamento !== undefined ? parseSafeNumber(fs.deslocamento) : parseSafeNumber(fs.custoViagem),
                        pedagio: fs.pedagio !== undefined ? parseSafeNumber(fs.pedagio) : 0,
                        adequationCost: parseSafeNumber(fs.adequacaoLocalCusto),
                        materialCost: parseSafeNumber(calc.totalEstrutura),
                        invoicedTax: parseSafeNumber(calc.nfServicoValor),
                        commission: parseSafeNumber(calc.comissaoVendasValor),
                        bankFees: 0,
                        totalCost: 0,
                        netProfit: 0,
                        finalMargin: 0,
                        status: budget.status
                    };

                    const extraCosts = 
                        (saleItem.visitaTecnica || 0) + (saleItem.homologation || 0) + (saleItem.installation || 0) + 
                        (saleItem.travelCost || 0) + (saleItem.adequationCost || 0) + (saleItem.materialCost || 0) + 
                        (saleItem.invoicedTax || 0) + (saleItem.commission || 0) + (saleItem.bankFees || 0);

                    saleItem.totalCost = extraCosts;
                    saleItem.netProfit = (saleItem.closedValue || 0) - (saleItem.systemCost || 0) - extraCosts;
                    saleItem.finalMargin = saleItem.closedValue > 0 ? (saleItem.netProfit / saleItem.closedValue) * 100 : 0;

                    await dataService.save('sales_summary', saleItem);
                    syncCount++;
                }
            }
            
            await loadData();
            alert(`${syncCount} registros de orçamentos sincronizados com sucesso.`);
        } catch (e) {
            console.error("Erro na sincronização:", e);
            alert("Ocorreu um erro ao sincronizar os dados.");
        } finally {
            setIsSyncing(false);
        }
    };

    const augmentedSalesData = useMemo(() => {
        return salesData.map(item => {
            const b = allBudgets.find(bud => bud.id === item.orcamentoId);
            if (b) {
                const variant = b.variants?.find(v => v.isPrincipal) || b.variants?.[0];
                const fs = variant?.formState || b.formState;
                if (fs) {
                    return {
                        ...item,
                        supplier: fs.fornecedor || item.supplier || 'N/A',
                        clientName: fs.nomeCliente || item.clientName,
                        status: b.status || item.status
                    };
                }
            }
            return item;
        });
    }, [salesData, allBudgets]);

    const suppliersList = useMemo(() => {
        const unique = new Set<string>();
        augmentedSalesData.forEach(item => {
            if (item.supplier) unique.add(item.supplier.trim());
        });
        return Array.from(unique).sort();
    }, [augmentedSalesData]);

    const handleStartEdit = (item: SalesSummaryItem, field: 'invoicedTax' | 'bankFees') => {
        setEditingCell({ id: item.id, field });
        setTempValue(String(item[field] || 0));
    };

    const handleCancelEdit = () => {
        setEditingCell(null);
        setTempValue('');
    };

    const handleSaveEdit = async (id: number, field: string) => {
        const safeValue = parseSafeNumber(tempValue);

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

    // Filters for Budgets (Orçamentos)
    const filteredSalesData = useMemo(() => {
        return [...augmentedSalesData].sort((a, b) => b.date.localeCompare(a.date)).filter(item => {
            if (startDate && item.date < startDate) return false;
            if (endDate && item.date > endDate) return false;
            if (selectedSuppliers.length > 0) {
                const itemSup = item.supplier?.trim() || 'N/A';
                if (!selectedSuppliers.includes(itemSup)) return false;
            }
            return true;
        });
    }, [augmentedSalesData, startDate, endDate, selectedSuppliers]);

    // Filters for Maintenance (Manutenções)
    const filteredMaintenanceData = useMemo(() => {
        return [...salesMaintenance].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).filter(item => {
            const dateStr = (item.createdAt || '').substring(0, 10);
            if (startDate && dateStr < startDate) return false;
            if (endDate && dateStr > endDate) return false;
            return true;
        });
    }, [salesMaintenance, startDate, endDate]);

    // Calculations for Orçamentos
    const budgetTotals = useMemo(() => {
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

    const budgetTotalMO = budgetTotals.closedValue - budgetTotals.systemCost;
    const budgetAvgMargin = budgetTotals.closedValue > 0 ? (budgetTotals.netProfit / budgetTotals.closedValue) * 100 : 0;
    const budgetAvgServiceMargin = budgetTotalMO > 0 ? (budgetTotals.netProfit / budgetTotalMO) * 100 : 0;

    // Calculations for Manutenções
    const maintenanceTotals = useMemo(() => {
        return filteredMaintenanceData.reduce((acc, item) => {
            return {
                totalPrice: acc.totalPrice + (item.totalPrice || 0),
                totalCost: acc.totalCost + (item.totalCost || 0),
                netProfit: acc.netProfit + ((item.totalPrice || 0) - (item.totalCost || 0)),
            };
        }, {
            totalPrice: 0, totalCost: 0, netProfit: 0
        });
    }, [filteredMaintenanceData]);

    const mAvgMargin = maintenanceTotals.totalPrice > 0 ? (maintenanceTotals.netProfit / maintenanceTotals.totalPrice) * 100 : 0;

    // Calculations for Consolidated view
    const consolidatedTotals = useMemo(() => {
        const totalSales = budgetTotals.closedValue + maintenanceTotals.totalPrice;
        const totalProfit = budgetTotals.netProfit + maintenanceTotals.netProfit;
        const totalCost = (budgetTotals.systemCost + budgetTotals.totalCost) + maintenanceTotals.totalCost;
        const avgMargin = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0;
        return {
            totalSales,
            totalCost,
            totalProfit,
            avgMargin
        };
    }, [budgetTotals, maintenanceTotals]);

    const chartData = useMemo(() => {
        return [
            {
                name: 'Orçamentos',
                Faturamento: budgetTotals.closedValue,
                Lucro: budgetTotals.netProfit,
                Custo: budgetTotals.systemCost + budgetTotals.totalCost,
            },
            {
                name: 'Manutenções',
                Faturamento: maintenanceTotals.totalPrice,
                Lucro: maintenanceTotals.netProfit,
                Custo: maintenanceTotals.totalCost,
            }
        ];
    }, [budgetTotals, maintenanceTotals]);

    const pieData = useMemo(() => {
        return [
            { name: 'Orçamentos', value: budgetTotals.closedValue, color: '#4f46e5' },
            { name: 'Manutenções', value: maintenanceTotals.totalPrice, color: '#10b981' }
        ];
    }, [budgetTotals, maintenanceTotals]);

    const handlePrint = () => window.print();

    const handleExportExcel = () => {
        const fmt = (n: number) => n ? n.toFixed(2).replace('.', ',') : '0,00';
        
        if (activeTab === 'manutencao') {
            const headers = ['Nº', 'Cliente', 'Data Conclusão', 'Título Chamado', 'Valor Cobrado', 'Custo Lançado', 'Lucro Líquido', 'Margem', 'Status'];
            let csvContent = "\uFEFF" + headers.join(';') + '\n';
            filteredMaintenanceData.forEach((item, index) => {
                const row = [
                    index + 1,
                    item.clientName,
                    new Date(item.createdAt).toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                    item.title,
                    fmt(item.totalPrice),
                    fmt(item.totalCost),
                    fmt(item.totalPrice - item.totalCost),
                    fmt(item.totalPrice > 0 ? ((item.totalPrice - item.totalCost) / item.totalPrice) * 100 : 0),
                    item.status
                ];
                csvContent += row.join(';') + '\n';
            });
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `resumo_manutencao_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
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
                    fmt(item.visitaTecnica ?? 0),
                    fmt(item.homologation ?? 0),
                    fmt(item.installation ?? 0),
                    fmt(item.travelCost ?? 0),
                    fmt(item.adequationCost ?? 0),
                    fmt(item.materialCost ?? 0),
                    fmt(item.invoicedTax ?? 0),
                    fmt(item.commission ?? 0),
                    fmt(item.bankFees ?? 0),
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
            link.setAttribute("download", `resumo_orcamentos_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const handleClearFilters = () => { 
        setStartDate('2023-01-01'); 
        setEndDate(new Date().toISOString().split('T')[0]); 
        setSelectedSuppliers([]); 
    };

    if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    const thClass = "px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 text-[10px] font-black tracking-wider text-gray-500 dark:text-gray-400 text-center whitespace-nowrap sticky top-0 z-20 bg-gray-100 dark:bg-gray-900";
    const tdClass = "px-3 py-1 border-b border-gray-100 dark:border-gray-800 text-[11px] text-gray-700 dark:text-gray-300 text-right whitespace-nowrap";

    // Editable input component for Imposto and Taxas de Banco inside Orçamentos
    const EditableCell = ({ item, field }: { item: SalesSummaryItem, field: 'invoicedTax' | 'bankFees' }) => {
        const isEditing = editingCell?.id === item.id && editingCell?.field === field;
        const value = item[field] || 0;

        const b = allBudgets.find(bud => bud.id === item.orcamentoId);
        const estValue = field === 'invoicedTax' 
            ? (b ? (parseSafeNumber(b.custos_estimados?.imposto) || parseSafeNumber(b.calculated?.nfServicoValor) || 0) : 0)
            : 0;

        if (isEditing) {
            return (
                <div className="flex flex-col items-end gap-0.5">
                    <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estValue)}</span>
                    <div className="flex items-center justify-end gap-1 min-w-[100px]">
                        <input 
                            autoFocus
                            type="text" 
                            className="w-18 bg-indigo-50 dark:bg-indigo-950/40 border-2 border-indigo-500 rounded px-1.5 py-0.5 text-right text-[11px] font-bold text-indigo-700 dark:text-indigo-300 focus:ring-0 outline-none animate-fade-in"
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
                </div>
            );
        }

        return (
            <div className="flex flex-col items-end gap-0.5">
                <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estValue)}</span>
                <div className="flex items-center justify-end gap-2 group min-w-[100px] justify-items-end">
                    <span className="font-bold text-indigo-700 dark:text-indigo-400">Real: {formatCurrency(value)}</span>
                    <button onClick={() => handleStartEdit(item, field)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded transition-all" title="Editar campo"><EditIcon className="w-3.5 h-3.5" /></button>
                </div>
            </div>
        );
    };

    // Renders the expandable "Budgeted vs Realized" comparison drawer
    const renderBudgetComparison = (item: SalesSummaryItem) => {
        const b = allBudgets.find(bud => bud.id === item.orcamentoId);
        
        // Estimated sales values extraction
        const estSale = b ? (parseSafeNumber(b.calculated?.precoVendaFinal) || item.closedValue) : item.closedValue;
        const realSale = item.closedValue;

        const estSys = b ? (parseSafeNumber(b.calculated?.valorVendaSistema) || item.systemCost) : item.systemCost;
        const realSys = item.systemCost;

        // Extract and summarize cost estimates from budget database entries
        const estVT = b ? (parseSafeNumber(b.calculated?.visitaTecnicaCusto) || parseSafeNumber(b.formState?.visitaTecnicaCusto) || 0) : 0;
        const realVT = item.visitaTecnica || 0;

        const estHomo = b ? (parseSafeNumber(b.custos_estimados?.homologacao) || parseSafeNumber(b.calculated?.projetoHomologacaoCusto) || 0) : 0;
        const realHomo = item.homologation || 0;

        const estInst = b ? (parseSafeNumber(b.custos_estimados?.instalacao) || (parseSafeNumber(b.formState?.terceiroInstalacaoQtd) * parseSafeNumber(b.formState?.terceiroInstalacaoCusto)) || 0) : 0;
        const realInst = item.installation || 0;

        const estDeslocamento = b ? (parseSafeNumber(b.custos_estimados?.deslocamento) || parseSafeNumber(b.formState?.deslocamento) || parseSafeNumber(b.formState?.custoViagem) || 0) : 0;
        const realDeslocamento = item.deslocamento !== undefined ? item.deslocamento : (item.travelCost || 0);

        const estPedagio = b ? (parseSafeNumber(b.custos_estimados?.pedagio) || parseSafeNumber(b.formState?.pedagio) || 0) : 0;
        const realPedagio = item.pedagio !== undefined ? item.pedagio : 0;

        const estTravel = estDeslocamento + estPedagio;
        const realTravel = realDeslocamento + realPedagio;

        const estAdeq = b ? (parseSafeNumber(b.custos_estimados?.adequacao) || parseSafeNumber(b.calculated?.adequacaoLocalCusto) || parseSafeNumber(b.formState?.adequacaoLocalCusto) || 0) : 0;
        const realAdeq = item.adequationCost || 0;

        const estMat = b ? (parseSafeNumber(b.custos_estimados?.materiais) || parseSafeNumber(b.calculated?.totalEstrutura) || 0) : 0;
        const realMat = item.materialCost || 0;

        const estTax = b ? (parseSafeNumber(b.custos_estimados?.imposto) || parseSafeNumber(b.calculated?.nfServicoValor) || 0) : 0;
        const realTax = item.invoicedTax || 0;

        const estComm = b ? (parseSafeNumber(b.calculated?.comissaoVendasValor) || 0) : 0;
        const realComm = item.commission || 0;

        const estBank = 0;
        const realBank = item.bankFees || 0;

        const totalEstCosts = estSys + estVT + estHomo + estInst + estTravel + estAdeq + estMat + estTax + estComm + estBank;
        const totalRealCosts = realSys + realVT + realHomo + realInst + realTravel + realAdeq + realMat + realTax + realComm + realBank;

        const estProfit = estSale - totalEstCosts;
        const realProfit = item.netProfit;

        const estMargin = estSale > 0 ? (estProfit / estSale) * 100 : 0;
        const realMargin = item.finalMargin;

        const costRows = [
            { name: 'Equipamento (Custo do Sistema)', est: estSys, real: realSys },
            { name: 'Visita Técnica preliminar', est: estVT, real: realVT },
            { name: 'Projeto e Homologação', est: estHomo, real: realHomo },
            { name: 'Instalação (Mão de Obra Terceirizada)', est: estInst, real: realInst },
            { name: 'Deslocamento', est: estDeslocamento, real: realDeslocamento },
            { name: 'Pedágio', est: estPedagio, real: realPedagio },
            { name: 'Adequações Técnicas de Local', est: estAdeq, real: realAdeq },
            { name: 'Estruturas e Materiais Extras', est: estMat, real: realMat },
            { name: 'Impostos de Serviço', est: estTax, real: realTax },
            { name: 'Comissões de Vendas', est: estComm, real: realComm },
            { name: 'Taxas Bancárias e Financeiras', est: estBank, real: realBank },
        ];

        return (
            <div className="bg-slate-50 dark:bg-gray-900/60 p-5 rounded-lg border border-indigo-100 dark:border-indigo-950/50 m-2 space-y-4 animate-fade-in text-left">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-200 dark:border-gray-800 pb-3 gap-3">
                    <div>
                        <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 tracking-wider block">Análise Detalhada do Projeto</span>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                            <UsersIcon className="w-5 h-5 text-indigo-500" /> Comparativo Orçado vs. Realizado - {item.clientName}
                        </h4>
                    </div>
                    <div className="flex gap-2">
                        {b ? (
                            <span className="text-[10px] font-bold bg-green-150/50 dark:bg-green-950/30 text-green-800 dark:text-green-300 border border-green-200/50 px-2 py-1 rounded">
                                Vinculado ao Orçamento #{b.id}
                            </span>
                        ) : (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded">
                                Registro de Venda Manual (Sem vínculo)
                            </span>
                        )}
                    </div>
                </div>

                {/* Macro metrics comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400">Preço Fechado</span>
                        <div className="flex justify-between items-baseline mt-2">
                            <span className="text-xs font-semibold text-gray-400">Orçado: {formatCurrency(estSale)}</span>
                            <span className="text-base font-black text-blue-600 dark:text-blue-400">{formatCurrency(realSale)}</span>
                        </div>
                        <div className="mt-2 text-[10px] font-bold flex items-center gap-1">
                            {realSale >= estSale ? (
                                <span className="text-green-600 flex items-center gap-0.5">🟢 +{formatCurrency(realSale - estSale)} (Lucro extra na venda)</span>
                            ) : (
                                <span className="text-red-600 flex items-center gap-0.5">🔴 -{formatCurrency(estSale - realSale)} (Desconto concedido)</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400">Custos Totais</span>
                        <div className="flex justify-between items-baseline mt-2">
                            <span className="text-xs font-semibold text-gray-400">Estimado: {formatCurrency(totalEstCosts)}</span>
                            <span className="text-base font-black text-gray-800 dark:text-white">{formatCurrency(totalRealCosts)}</span>
                        </div>
                        <div className="mt-2 text-[10px] font-bold flex items-center gap-1">
                            {totalRealCosts <= totalEstCosts ? (
                                <span className="text-green-600 flex items-center gap-0.5">🟢 Economia de {formatCurrency(totalEstCosts - totalRealCosts)}</span>
                            ) : (
                                <span className="text-red-500 flex items-center gap-0.5">🔴 Estourou por {formatCurrency(totalRealCosts - totalEstCosts)}</span>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-gray-400">Margem de Lucro</span>
                        <div className="flex justify-between items-baseline mt-2">
                            <span className="text-xs font-semibold text-gray-400">Projetada: {formatPercent(estMargin)}</span>
                            <span className="text-base font-black text-green-600 dark:text-green-400">{formatPercent(realMargin)}</span>
                        </div>
                        <div className="mt-2 text-[10px] font-bold flex items-center gap-1">
                            {realMargin >= estMargin ? (
                                <span className="text-green-600">▲ +{(realMargin - estMargin).toFixed(2)}% mais lucrativo</span>
                            ) : (
                                <span className="text-red-500">▼ -{(estMargin - realMargin).toFixed(2)}% menos lucrativo</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Micro breakdowns comparisons */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-150 dark:border-gray-700 text-[10px] font-black tracking-wider uppercase text-gray-500 dark:text-gray-400 grid grid-cols-12 gap-2 text-center">
                        <span className="col-span-5 text-left">Categoria de Custo</span>
                        <span className="col-span-2 text-right">Custo Orçado</span>
                        <span className="col-span-2 text-right">Custo Realizado</span>
                        <span className="col-span-3 text-right">Diferença / Desvio</span>
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                        {costRows.map((row, i) => {
                            const diff = row.real - row.est;
                            const isOver = diff > 0.01;
                            const isUnder = diff < -0.01;
                            const noDiff = Math.abs(diff) <= 0.01;

                            return (
                                <div key={i} className="px-4 py-2.5 text-[11px] grid grid-cols-12 gap-2 items-center hover:bg-gray-55/40 dark:hover:bg-gray-700/20 transition-colors">
                                    <div className="col-span-5 font-bold text-gray-800 dark:text-gray-200">
                                        {row.name}
                                    </div>
                                    <div className="col-span-2 font-semibold text-gray-500 text-right">
                                        {formatCurrency(row.est)}
                                    </div>
                                    <div className="col-span-2 font-bold text-gray-800 dark:text-gray-200 text-right">
                                        {formatCurrency(row.real)}
                                    </div>
                                    <div className="col-span-3 text-right flex items-center justify-end gap-1.5">
                                        {noDiff ? (
                                            <span className="text-gray-450 font-medium">Equivalente</span>
                                        ) : isOver ? (
                                            <span className="text-red-600 font-bold bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                ▲ +{formatCurrency(diff)}
                                            </span>
                                        ) : (
                                            <span className="text-green-600 font-bold bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                                ▼ -{formatCurrency(Math.abs(diff))}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // Renders the expandable panel for maintenance details (all services and materials)
    const renderMaintenanceDetails = (m: ManutencaoRecord) => {
        const netProfit = m.totalPrice - m.totalCost;
        const margin = m.totalPrice > 0 ? (netProfit / m.totalPrice) * 100 : 0;

        return (
            <div className="bg-emerald-50/40 dark:bg-emerald-950/10 p-5 rounded-lg border border-emerald-100 dark:border-emerald-950/40 m-2 space-y-4 animate-fade-in text-left">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-emerald-150/50 dark:border-emerald-900/40 pb-3 gap-2">
                    <div>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">Ficha de Atendimento de Manutenção</span>
                        <h4 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                            <WrenchIcon className="w-5 h-5 text-emerald-500" /> Detalhes dos Serviços e Peças - {m.clientName}
                        </h4>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900 px-2 py-0.5 rounded-full capitalize">
                            {m.status}
                        </span>
                        <span className="text-xs font-semibold text-gray-500">
                            Abertura: {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Services block */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 p-4 shadow-sm space-y-3">
                        <h5 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-2">
                            <UsersIcon className="w-4 h-4 text-indigo-500" /> Serviços de Mão de Obra Lançados
                        </h5>
                        {(m.services || []).length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-[11px]">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase text-[9px]">
                                            <th className="py-1">Descrição</th>
                                            <th className="py-1 text-right">Qtd</th>
                                            <th className="py-1 text-right">Custo Un.</th>
                                            <th className="py-1 text-right">Preço Un.</th>
                                            <th className="py-1 text-right">Total Cobrado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                        {m.services.map((srv) => (
                                            <tr key={srv.id} className="text-gray-700 dark:text-gray-300">
                                                <td className="py-1.5 font-medium">{srv.description}</td>
                                                <td className="py-1.5 text-right">{srv.qty}</td>
                                                <td className="py-1.5 text-right text-gray-400">{formatCurrency(srv.unitCost)}</td>
                                                <td className="py-1.5 text-right font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(srv.unitPrice)}</td>
                                                <td className="py-1.5 text-right font-bold text-gray-950 dark:text-white">{formatCurrency(srv.unitPrice * srv.qty)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic text-center py-4">Nenhum item de serviço cadastrado.</p>
                        )}
                    </div>

                    {/* Materials block */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-150 dark:border-gray-700 p-4 shadow-sm space-y-3">
                        <h5 className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5 border-b border-gray-100 dark:border-gray-700 pb-2">
                            <CubeIcon className="w-4 h-4 text-emerald-500" /> Peças e Materiais Aplicados
                        </h5>
                        {(m.materials || []).length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-left text-[11px]">
                                    <thead>
                                        <tr className="border-b border-gray-100 dark:border-gray-700 text-gray-400 font-bold uppercase text-[9px]">
                                            <th className="py-1">Descrição</th>
                                            <th className="py-1 text-right">Qtd</th>
                                            <th className="py-1 text-right">Custo Un.</th>
                                            <th className="py-1 text-right">Preço Un.</th>
                                            <th className="py-1 text-right">Total Cobrado</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                                        {m.materials.map((mat) => (
                                            <tr key={mat.id} className="text-gray-700 dark:text-gray-300">
                                                <td className="py-1.5 font-medium">{mat.description}</td>
                                                <td className="py-1.5 text-right">{mat.qty}</td>
                                                <td className="py-1.5 text-right text-gray-400">{formatCurrency(mat.unitCost)}</td>
                                                <td className="py-1.5 text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(mat.unitPrice)}</td>
                                                <td className="py-1.5 text-right font-bold text-gray-950 dark:text-white">{formatCurrency(mat.unitPrice * mat.qty)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-400 italic text-center py-4">Nenhum material/peça cadastrado.</p>
                        )}
                    </div>
                </div>

                {/* Additional notes and financial totals card */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl border border-emerald-150/40 dark:border-emerald-900/40 shadow-sm items-center">
                    <div className="md:col-span-2 text-xs">
                        <span className="font-bold text-gray-500 block uppercase tracking-wider text-[9px] mb-1">Observações Técnicas / Garantia</span>
                        <p className="text-gray-700 dark:text-gray-300 font-medium italic">{m.notes || 'Sem observações adicionais gravadas.'}</p>
                    </div>
                    <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-150/30 text-right">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-wide">Balanço do Chamado</div>
                        <div className="text-xs font-semibold text-gray-500 mt-1">Cobrado: {formatCurrency(m.totalPrice)}</div>
                        <div className="text-xs font-semibold text-gray-500">Despesas: {formatCurrency(m.totalCost)}</div>
                        <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 mt-1">Lucro: {formatCurrency(netProfit)}</div>
                        <div className="text-[10px] font-black bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 inline-block px-1.5 py-0.5 rounded mt-1.5">
                            Margem: {formatPercent(margin)}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header / Subheader */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-gray-150 dark:border-gray-800 pb-5 gap-4">
                <div>
                    <h1 className="text-2xl font-black text-gray-950 dark:text-white tracking-tight flex items-center gap-2">
                        <ChartPieIcon className="w-8 h-8 text-indigo-600" /> Resumo de Vendas e Faturamento
                    </h1>
                    <p className="text-xs font-semibold text-gray-450 mt-1">
                        Gerencie os resultados financeiros de seus orçamentos e chamados de manutenção finalizados.
                    </p>
                </div>
                {/* Print/Export Controls */}
                <div className="flex items-center gap-2 print:hidden self-end md:self-auto">
                    <button onClick={handleExportExcel} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md font-bold text-xs transition-colors">
                        <TableIcon className="w-4 h-4" /> Exportar Planilha
                    </button>
                    <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-55 dark:hover:bg-gray-700 rounded-xl shadow-sm font-bold text-xs transition-colors">
                        <PrinterIcon className="w-4 h-4" /> Imprimir Relatório
                    </button>
                </div>
            </div>

            {/* Main Tabs Selection */}
            <div className="flex flex-wrap p-1 bg-gray-100 dark:bg-gray-800 rounded-2xl w-full sm:w-max gap-1 print:hidden">
                <button
                    onClick={() => setActiveTab('consolidado')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-tight transition-all duration-300 ${activeTab === 'consolidado' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                >
                    <ChartPieIcon className="w-4 h-4" /> Visão Consolidada
                </button>
                <button
                    onClick={() => setActiveTab('orcamento')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-tight transition-all duration-300 ${activeTab === 'orcamento' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                >
                    <TableIcon className="w-4 h-4" /> Orçamentos Finalizados
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'orcamento' ? 'bg-indigo-500 text-white' : 'bg-gray-250 text-gray-600'}`}>
                        {filteredSalesData.length}
                    </span>
                </button>
                <button
                    onClick={() => setActiveTab('manutencao')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black tracking-tight transition-all duration-300 ${activeTab === 'manutencao' ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
                >
                    <WrenchIcon className="w-4 h-4" /> Manutenções Finalizadas
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'manutencao' ? 'bg-indigo-500 text-white' : 'bg-gray-250 text-gray-600'}`}>
                        {filteredMaintenanceData.length}
                    </span>
                </button>
            </div>

            {/* Date and Supplier Filters Bar (Shared for tables) */}
            {activeTab !== 'consolidado' && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 print:hidden">
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 p-1.5 rounded-xl border border-gray-200 dark:border-gray-700 w-full sm:w-auto">
                            <div className="pl-2 text-gray-500"><CalendarIcon className="w-4 h-4" /></div>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-xs text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer w-full sm:w-auto" />
                            <span className="text-gray-400">-</span>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-xs text-gray-700 dark:text-gray-200 focus:ring-0 p-1 cursor-pointer w-full sm:w-auto" />
                        </div>

                        {activeTab === 'orcamento' && (
                            <div className="relative w-full sm:w-64" ref={dropdownRef}>
                                <button 
                                    onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)}
                                    className="flex items-center justify-between w-full bg-gray-50 dark:bg-gray-900 p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-200 transition-all hover:bg-gray-100 dark:hover:bg-gray-750"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <FilterIcon className="w-3.5 h-3.5 text-gray-400" />
                                        <span>{selectedSuppliers.length === 0 ? 'Todos os fornecedores' : `${selectedSuppliers.length} selecionado(s)`}</span>
                                    </div>
                                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isSupplierDropdownOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-150 dark:border-gray-700 z-50 py-2 max-h-64 overflow-y-auto custom-scrollbar">
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
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {activeTab === 'orcamento' && (
                            <button onClick={handleSyncBudgets} disabled={isSyncing} className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all ${isSyncing ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'}`}>
                                {isSyncing ? <ClockIcon className="w-4 h-4 animate-spin" /> : <ClockIcon className="w-4 h-4" />}
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar orçamentos'}
                            </button>
                        )}
                        {(startDate !== '2023-01-01' || selectedSuppliers.length > 0) && (
                            <button onClick={handleClearFilters} className="px-3 py-2 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors flex items-center gap-1 whitespace-nowrap font-bold">
                                <TrashIcon className="w-4 h-4" /> Limpar filtros
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* TAB 1: CONSOLIDADO (COMBINED SUMMARY WITH CHARTS) */}
            {activeTab === 'consolidado' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Modern Colorful Consolidated KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="bg-gradient-to-tr from-indigo-500 to-indigo-600 dark:from-indigo-900/40 dark:to-indigo-850/40 text-white p-5 rounded-2xl shadow-lg border border-indigo-100 dark:border-indigo-950/20 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 group-hover:scale-110 transition-transform"><DollarIcon className="w-32 h-32" /></div>
                            <span className="text-[10px] font-black tracking-widest opacity-80">Receita Total Bruta</span>
                            <h3 className="text-2xl font-black mt-1.5 tracking-tight">{formatCurrency(consolidatedTotals.totalSales)}</h3>
                            <div className="mt-3 text-[10px] font-bold bg-white/10 rounded px-2 py-1 inline-flex flex-wrap gap-2">
                                <span>Orçamentos: {formatCurrency(budgetTotals.closedValue)}</span>
                                <span className="opacity-40">|</span>
                                <span>Manutenções: {formatCurrency(maintenanceTotals.totalPrice)}</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-5 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 text-gray-900 dark:text-white group-hover:scale-110 transition-transform"><TableIcon className="w-32 h-32" /></div>
                            <span className="text-[10px] font-black tracking-widest text-gray-400">Custos Operacionais</span>
                            <h3 className="text-2xl font-black mt-1.5 tracking-tight text-gray-900 dark:text-white">{formatCurrency(consolidatedTotals.totalCost)}</h3>
                            <div className="mt-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 inline-flex flex-wrap gap-2">
                                <span>Orçamentos: {formatCurrency(budgetTotals.systemCost + budgetTotals.totalCost)}</span>
                                <span className="opacity-40">|</span>
                                <span>Manutenções: {formatCurrency(maintenanceTotals.totalCost)}</span>
                            </div>
                        </div>

                        <div className="bg-gradient-to-tr from-emerald-500 to-emerald-600 dark:from-emerald-950/40 dark:to-emerald-900/30 text-white p-5 rounded-2xl shadow-lg border border-emerald-100 dark:border-emerald-950/20 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10 group-hover:scale-110 transition-transform"><TrendUpIcon className="w-32 h-32" /></div>
                            <span className="text-[10px] font-black tracking-widest opacity-80">Lucro Líquido Real</span>
                            <h3 className="text-2xl font-black mt-1.5 tracking-tight">{formatCurrency(consolidatedTotals.totalProfit)}</h3>
                            <div className="mt-3 text-[10px] font-bold bg-white/10 rounded px-2 py-1 inline-flex flex-wrap gap-2">
                                <span>Orçamentos: {formatCurrency(budgetTotals.netProfit)}</span>
                                <span className="opacity-40">|</span>
                                <span>Manutenções: {formatCurrency(maintenanceTotals.netProfit)}</span>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white p-5 rounded-2xl shadow-sm border border-gray-150 dark:border-gray-700 relative overflow-hidden group">
                            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-5 text-gray-900 dark:text-white group-hover:scale-110 transition-transform"><ChartPieIcon className="w-32 h-32" /></div>
                            <span className="text-[10px] font-black tracking-widest text-gray-400">Margem Consolidada</span>
                            <h3 className="text-2xl font-black mt-1.5 tracking-tight text-indigo-600 dark:text-indigo-400">{formatPercent(consolidatedTotals.avgMargin)}</h3>
                            <div className="mt-3 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 rounded px-2 py-1 inline-flex flex-wrap gap-2">
                                <span>Orçamentos: {formatPercent(budgetAvgMargin)}</span>
                                <span className="opacity-40">|</span>
                                <span>Manutenções: {formatPercent(mAvgMargin)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Interactive Colorful Charts and Splits Side-by-Side */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Bar comparison */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm lg:col-span-8 flex flex-col justify-between">
                            <div>
                                <h4 className="text-sm font-black text-gray-900 dark:text-white tracking-wider">Comparativo de Resultados (R$)</h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Comparação de Faturamento, Custos e Lucro Real entre Orçamentos e Manutenções.</p>
                            </div>
                            <div className="h-64 mt-4 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#9ca3af" />
                                        <YAxis tick={{ fontSize: 10 }} width={80} stroke="#9ca3af" tickFormatter={(v) => `R$ ${v/1000}k`} />
                                        <Tooltip formatter={(value) => [formatCurrency(value as number)]} />
                                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                                        <Bar dataKey="Faturamento" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Custo" fill="#f87171" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Lucro" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Pie revenue split */}
                        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm lg:col-span-4 flex flex-col justify-between">
                            <div>
                                <h4 className="text-sm font-black text-gray-900 dark:text-white tracking-wider">Divisão de Faturamento</h4>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Participação percentual de cada modalidade no faturamento total.</p>
                            </div>
                            <div className="h-48 mt-4 relative flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={pieData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                        >
                                            {pieData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value) => [formatCurrency(value as number)]} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute text-center">
                                    <span className="text-[10px] font-black text-gray-400">Faturamento</span>
                                    <span className="text-sm font-black text-gray-900 dark:text-white block mt-0.5">{formatCurrency(consolidatedTotals.totalSales)}</span>
                                </div>
                            </div>
                            <div className="mt-3 flex flex-col gap-2">
                                {pieData.map((item, idx) => {
                                    const pct = consolidatedTotals.totalSales > 0 ? (item.value / consolidatedTotals.totalSales) * 100 : 0;
                                    return (
                                        <div key={idx} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                                <span className="font-bold text-gray-700 dark:text-gray-300">{item.name}</span>
                                            </div>
                                            <span className="font-black text-gray-900 dark:text-white">{formatCurrency(item.value)} ({pct.toFixed(1)}%)</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Quick Comparative Overview Table */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-150 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-150 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
                            <h4 className="text-xs font-black text-gray-900 dark:text-white tracking-wider">Resumo de Indicadores Financeiros de Apoio</h4>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-xs text-left">
                                <thead>
                                    <tr className="border-b border-gray-200 dark:border-gray-700 text-[10px] font-black tracking-widest text-gray-400">
                                        <th className="px-5 py-3">Modalidade</th>
                                        <th className="px-5 py-3 text-right">Volume</th>
                                        <th className="px-5 py-3 text-right">Receita Bruta (Faturamento)</th>
                                        <th className="px-5 py-3 text-right">Despesas Operacionais</th>
                                        <th className="px-5 py-3 text-right">Lucro Líquido</th>
                                        <th className="px-5 py-3 text-right">Margem de Retorno Média</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 font-semibold text-gray-700 dark:text-gray-300">
                                    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                                        <td className="px-5 py-3.5 flex items-center gap-2 font-bold text-gray-900 dark:text-white"><TableIcon className="w-4 h-4 text-indigo-600" /> Orçamentos Solar</td>
                                        <td className="px-5 py-3.5 text-right font-black text-gray-400">{filteredSalesData.length} projetos</td>
                                        <td className="px-5 py-3.5 text-right text-indigo-600 dark:text-indigo-400 font-black">{formatCurrency(budgetTotals.closedValue)}</td>
                                        <td className="px-5 py-3.5 text-right">{formatCurrency(budgetTotals.systemCost + budgetTotals.totalCost)}</td>
                                        <td className="px-5 py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(budgetTotals.netProfit)}</td>
                                        <td className="px-5 py-3.5 text-right font-black text-indigo-600 dark:text-indigo-400">{formatPercent(budgetAvgMargin)}</td>
                                    </tr>
                                    <tr className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20">
                                        <td className="px-5 py-3.5 flex items-center gap-2 font-bold text-gray-900 dark:text-white"><WrenchIcon className="w-4 h-4 text-emerald-600" /> Manutenção e Atendimentos</td>
                                        <td className="px-5 py-3.5 text-right font-black text-gray-400">{filteredMaintenanceData.length} chamados</td>
                                        <td className="px-5 py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(maintenanceTotals.totalPrice)}</td>
                                        <td className="px-5 py-3.5 text-right">{formatCurrency(maintenanceTotals.totalCost)}</td>
                                        <td className="px-5 py-3.5 text-right text-emerald-600 dark:text-emerald-400 font-black">{formatCurrency(maintenanceTotals.netProfit)}</td>
                                        <td className="px-5 py-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">{formatPercent(mAvgMargin)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: ORÇAMENTOS (BUDGETS DETAIL WITH "ORÇADO VS REALIZADO") */}
            {activeTab === 'orcamento' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Visual cards row for Orçamentos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <DashboardCard title="Total venda cons. final" value={formatCurrency(budgetTotals.closedValue)} icon={DollarIcon} color="bg-blue-600" />
                        <DashboardCard title="Total mão de obra" value={formatCurrency(budgetTotalMO)} icon={UsersIcon} color="bg-purple-600" />
                        <DashboardCard title="Lucro líquido" value={formatCurrency(budgetTotals.netProfit)} icon={TrendUpIcon} color="bg-green-600" />
                        <DashboardCard title="Margem média venda" value={formatPercent(budgetAvgMargin)} icon={ChartPieIcon} color="bg-indigo-600" />
                        <DashboardCard title="Margem média serviço" value={formatPercent(budgetAvgServiceMargin)} icon={ChartPieIcon} color="bg-orange-600" />
                    </div>

                    {/* Table Container */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-150 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-150 dark:border-gray-700 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50/50 dark:bg-gray-750">
                            <div>
                                <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <TableIcon className="w-5 h-5 text-indigo-600" /> Resumo Detalhado dos Orçamentos Fechados
                                </h2>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                    Exibindo {filteredSalesData.length} orçamento(s) finalizados no período. Clique em cada cliente para comparar o Orçado vs. Realizado.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="min-w-full border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-gray-100/50 dark:bg-gray-900/60">
                                        <th className="w-10 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 sticky left-0 top-0 z-30 bg-gray-100 dark:bg-gray-900"></th>
                                        <th className={`${thClass} text-left sticky left-10 top-0 z-30 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700`}>Cliente</th>
                                        <th className={`${thClass}`}>Data</th>
                                        <th className={`${thClass}`}>Preço Venda Final</th>
                                        <th className={`${thClass}`}>Custo do Sistema (kit)</th>
                                        <th className={`${thClass}`}>Fornecedor</th>
                                        <th className={`${thClass}`}>Visita Técnica</th>
                                        <th className={`${thClass}`}>Projeto / Homologação</th>
                                        <th className={`${thClass}`}>Instalação (placas)</th>
                                        <th className={`${thClass}`}>Deslocamento</th>
                                        <th className={`${thClass}`}>Pedágio</th>
                                        <th className={`${thClass}`}>Adequação Local</th>
                                        <th className={`${thClass}`}>Materiais e Componentes</th>
                                        <th className={`${thClass} bg-indigo-100 dark:bg-indigo-950`}>Imposto</th>
                                        <th className={`${thClass}`}>Comissão</th>
                                        <th className={`${thClass} bg-indigo-100 dark:bg-indigo-950`}>Taxas de Banco</th>
                                        <th className={`${thClass} bg-gray-200 dark:bg-gray-700`}>Custo Total</th>
                                        <th className={`${thClass} bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400`}>Lucro Líquido</th>
                                        <th className={`${thClass}`}>Margem Final</th>
                                        <th className={`${thClass}`}>Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredSalesData.length > 0 ? filteredSalesData.map((item, index) => {
                                        const isExpanded = expandedBudgetRowId === item.id;
                                        const b = allBudgets.find(bud => bud.id === item.orcamentoId);

                                        const estSale = b ? (parseSafeNumber(b.calculated?.precoVendaFinal) || item.closedValue) : item.closedValue;
                                        const realSale = item.closedValue;

                                        const estSys = b ? (parseSafeNumber(b.calculated?.valorVendaSistema) || item.systemCost) : item.systemCost;
                                        const realSys = item.systemCost;

                                        const estVT = b ? (parseSafeNumber(b.calculated?.visitaTecnicaCusto) || parseSafeNumber(b.formState?.visitaTecnicaCusto) || 0) : 0;
                                        const realVT = item.visitaTecnica || 0;

                                        const estHomo = b ? (parseSafeNumber(b.custos_estimados?.homologacao) || parseSafeNumber(b.calculated?.projetoHomologacaoCusto) || 0) : 0;
                                        const realHomo = item.homologation || 0;

                                        const estInst = b ? (parseSafeNumber(b.custos_estimados?.instalacao) || (parseSafeNumber(b.formState?.terceiroInstalacaoQtd) * parseSafeNumber(b.formState?.terceiroInstalacaoCusto)) || 0) : 0;
                                        const realInst = item.installation || 0;

                                        const estDeslocamento = b ? (parseSafeNumber(b.custos_estimados?.deslocamento) || parseSafeNumber(b.formState?.deslocamento) || parseSafeNumber(b.formState?.custoViagem) || 0) : 0;
                                        const estPedagio = b ? (parseSafeNumber(b.custos_estimados?.pedagio) || parseSafeNumber(b.formState?.pedagio) || 0) : 0;
                                        const estTravel = estDeslocamento + estPedagio;
                                        const realDeslocamento = item.deslocamento !== undefined ? item.deslocamento : (item.travelCost || 0);
                                        const realPedagio = item.pedagio !== undefined ? item.pedagio : 0;
                                        const realTravel = realDeslocamento + realPedagio;

                                        const estAdeq = b ? (parseSafeNumber(b.custos_estimados?.adequacao) || parseSafeNumber(b.calculated?.adequacaoLocalCusto) || parseSafeNumber(b.formState?.adequacaoLocalCusto) || 0) : 0;
                                        const realAdeq = item.adequationCost || 0;

                                        const estMat = b ? (parseSafeNumber(b.custos_estimados?.materiais) || parseSafeNumber(b.calculated?.totalEstrutura) || 0) : 0;
                                        const realMat = item.materialCost || 0;

                                        const estComm = b ? (parseSafeNumber(b.calculated?.comissaoVendasValor) || 0) : 0;
                                        const realComm = item.commission || 0;

                                        const estTax = b ? (parseSafeNumber(b.custos_estimados?.imposto) || parseSafeNumber(b.calculated?.nfServicoValor) || 0) : 0;
                                        const realTax = item.invoicedTax || 0;

                                        const estBank = 0;
                                        const realBank = item.bankFees || 0;

                                        const totalEstCosts = estSys + estVT + estHomo + estInst + estTravel + estAdeq + estMat + estTax + estComm + estBank;
                                        const totalRealCosts = item.totalCost;

                                        const estProfit = estSale - totalEstCosts;
                                        const realProfit = item.netProfit;

                                        const estMargin = estSale > 0 ? (estProfit / estSale) * 100 : 0;
                                        const realMargin = item.finalMargin;

                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr className={`hover:bg-indigo-50/25 dark:hover:bg-indigo-950/10 transition-colors group cursor-pointer ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/5' : ''}`}>
                                                    {/* Expand Arrow click triggers drawer */}
                                                    <td className={`w-10 px-2 py-1 border-b border-gray-100 dark:border-gray-800 text-center text-gray-400 sticky left-0 z-10 ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/5' : 'bg-white dark:bg-gray-800 group-hover:bg-indigo-50/25 dark:group-hover:bg-indigo-950/15'} transition-colors`}>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedBudgetRowId(isExpanded ? null : item.id);
                                                            }}
                                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-450 dark:text-gray-450 transition-all"
                                                            title="Ver Comparativo Orçado vs. Realizado"
                                                        >
                                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-indigo-600' : ''}`} />
                                                        </button>
                                                    </td>
                                                    <td 
                                                        onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)}
                                                        className={`${tdClass} text-left font-bold text-gray-900 dark:text-white truncate max-w-[120px] sticky left-10 z-10 border-r border-gray-200 dark:border-gray-700 ${isExpanded ? 'bg-indigo-50/20 dark:bg-indigo-950/5' : 'bg-white dark:bg-gray-800 group-hover:bg-indigo-50/25 dark:group-hover:bg-indigo-950/15'} transition-colors`}
                                                    >
                                                        {item.clientName}
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center`}>
                                                        {new Date(item.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estSale)}</span>
                                                            <span className="text-[11px] font-black text-blue-700 dark:text-blue-400">Real: {formatCurrency(realSale)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estSys)}</span>
                                                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Real: {formatCurrency(realSys)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center font-bold text-gray-400`}>
                                                        {item.supplier || 'N/A'}
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estVT)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realVT - estVT) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realVT)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estHomo)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realHomo - estHomo) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realHomo)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estInst)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realInst - estInst) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realInst)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estDeslocamento)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realDeslocamento - estDeslocamento) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realDeslocamento)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estPedagio)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realPedagio - estPedagio) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realPedagio)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estAdeq)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realAdeq - estAdeq) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realAdeq)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estMat)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realMat - estMat) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realMat)}</span>
                                                        </div>
                                                    </td>
                                                    {/* Imposto (Editable Cell) */}
                                                    <td className={`${tdClass} bg-indigo-50/10 dark:bg-indigo-950/10`}>
                                                        <EditableCell item={item} field="invoicedTax" />
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass}`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estComm)}</span>
                                                            <span className={`text-[11px] font-bold ${Math.abs(realComm - estComm) > 0.01 ? 'text-indigo-600 dark:text-indigo-400 font-extrabold' : 'text-gray-700 dark:text-gray-300'}`}>Real: {formatCurrency(realComm)}</span>
                                                        </div>
                                                    </td>
                                                    {/* Taxas de banco (Editable Cell) */}
                                                    <td className={`${tdClass} bg-indigo-50/10 dark:bg-indigo-950/10`}>
                                                        <EditableCell item={item} field="bankFees" />
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass} font-bold bg-gray-55/30 dark:bg-gray-800/40`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-450 dark:text-gray-500 font-medium">Orçado: {formatCurrency(totalEstCosts)}</span>
                                                            <span className="text-[11px] font-black text-gray-850 dark:text-white">Real: {formatCurrency(totalRealCosts)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass} font-black text-green-700 dark:text-green-400 bg-green-50/20 dark:bg-green-950/10`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-400 dark:text-gray-500 font-medium">Orçado: {formatCurrency(estProfit)}</span>
                                                            <span className="text-[11px] font-black text-green-700 dark:text-green-400">Real: {formatCurrency(realProfit)}</span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center`}>
                                                        <div className="flex flex-col items-center">
                                                            <span className="text-[9px] text-gray-450 dark:text-gray-500 font-medium">Orçado: {formatPercent(estMargin)}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[9px] font-black ${realMargin > 25 ? 'bg-green-100 text-green-800' : realMargin > 15 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                                Real: {formatPercent(realMargin)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td onClick={() => setExpandedBudgetRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center`}>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.status === 'Finalizado' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                            {toSentenceCase(item.status || 'Aprovado')}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {/* Expandable Comparison Panel Drawer */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={19} className="bg-slate-50 dark:bg-gray-900/30 p-0 border-b border-gray-150 dark:border-gray-800">
                                                            {renderBudgetComparison(item)}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    }) : (
                                        <tr><td colSpan={19} className="px-6 py-12 text-center text-gray-400 italic">Nenhum orçamento aprovado encontrado para o período ou filtros selecionados.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold text-center italic">* Nota: Apenas orçamentos solar aprovados ou finalizados são exibidos nesta lista de orçamentos.</p>
                </div>
            )}

            {/* TAB 3: MANUTENÇÕES (COMPLETED MAINTENANCE DETAIL LIST) */}
            {activeTab === 'manutencao' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Visual cards row for Maintenance */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <DashboardCard title="Faturamento de Serviços" value={formatCurrency(maintenanceTotals.totalPrice)} icon={WrenchIcon} color="bg-emerald-600" />
                        <DashboardCard title="Custo de Peças / Peças Aplicadas" value={formatCurrency(maintenanceTotals.totalCost)} icon={CubeIcon} color="bg-blue-600" />
                        <DashboardCard title="Lucro Líquido Real" value={formatCurrency(maintenanceTotals.netProfit)} icon={TrendUpIcon} color="bg-green-600" />
                        <DashboardCard title="Margem de Retorno Média" value={formatPercent(mAvgMargin)} icon={ChartPieIcon} color="bg-indigo-600" />
                        <DashboardCard title="Chamados Atendidos" value={String(filteredMaintenanceData.length)} icon={UsersIcon} color="bg-purple-600" />
                    </div>

                    {/* Table Container */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-150 dark:border-gray-700 overflow-hidden">
                        <div className="p-5 border-b border-gray-150 dark:border-gray-700 flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-gray-50/50 dark:bg-gray-750">
                            <div>
                                <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                                    <WrenchIcon className="w-5 h-5 text-emerald-600" /> Resumo Detalhado de Atendimentos de Manutenção
                                </h2>
                                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                    Exibindo {filteredMaintenanceData.length} chamados de manutenção finalizados no período. Clique no cliente para conferir peças e mão de obra utilizadas.
                                </p>
                            </div>
                        </div>

                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="min-w-full border-separate border-spacing-0">
                                <thead>
                                    <tr className="bg-gray-100/50 dark:bg-gray-900/60">
                                        <th className="w-10 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 sticky left-0 top-0 z-30 bg-gray-100 dark:bg-gray-900"></th>
                                        <th className={`${thClass} text-left sticky left-10 top-0 z-30 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700`}>Cliente</th>
                                        <th className={`${thClass}`}>Data Conclusão</th>
                                        <th className={`${thClass} text-left`}>Título do Chamado / Serviço</th>
                                        <th className={`${thClass}`}>Valor Cobrado</th>
                                        <th className={`${thClass}`}>Despesas Lançadas</th>
                                        <th className={`${thClass} bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400`}>Lucro Líquido</th>
                                        <th className={`${thClass}`}>Margem</th>
                                        <th className={`${thClass}`}>Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {filteredMaintenanceData.length > 0 ? filteredMaintenanceData.map((item, index) => {
                                        const isExpanded = expandedMaintRowId === item.id;
                                        const mProfit = item.totalPrice - item.totalCost;
                                        const mMargin = item.totalPrice > 0 ? (mProfit / item.totalPrice) * 100 : 0;

                                        return (
                                            <React.Fragment key={item.id}>
                                                <tr className={`hover:bg-emerald-50/25 dark:hover:bg-emerald-950/10 transition-colors group cursor-pointer ${isExpanded ? 'bg-emerald-50/20 dark:bg-emerald-950/5' : ''}`}>
                                                    <td className={`px-2 py-1 border-b border-gray-100 dark:border-gray-800 text-center text-gray-450 sticky left-0 z-10 ${isExpanded ? 'bg-emerald-50/20 dark:bg-emerald-950/5' : 'bg-white dark:bg-gray-800 group-hover:bg-emerald-50/25 dark:group-hover:bg-emerald-950/15'} transition-colors`}>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedMaintRowId(isExpanded ? null : item.id);
                                                            }}
                                                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-450 transition-all"
                                                            title="Ver Detalhes do Chamado"
                                                        >
                                                            <ChevronDownIcon className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-emerald-600' : ''}`} />
                                                        </button>
                                                    </td>
                                                    <td 
                                                        onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)}
                                                        className={`${tdClass} text-left font-bold text-gray-900 dark:text-white truncate max-w-[140px] sticky left-10 z-10 border-r border-gray-200 dark:border-gray-700 ${isExpanded ? 'bg-emerald-50/20 dark:bg-emerald-950/5' : 'bg-white dark:bg-gray-800 group-hover:bg-emerald-50/25 dark:group-hover:bg-emerald-950/15'} transition-colors`}
                                                    >
                                                        {item.clientName}
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center`}>
                                                        {new Date(item.createdAt).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={`${tdClass} text-left font-semibold text-gray-600 dark:text-gray-300 truncate max-w-[180px]`}>
                                                        {item.title}
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={`${tdClass} font-black text-emerald-700 dark:text-emerald-400`}>
                                                        {formatCurrency(item.totalPrice)}
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={tdClass}>
                                                        {formatCurrency(item.totalCost)}
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={`${tdClass} font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/10`}>
                                                        {formatCurrency(mProfit)}
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center`}>
                                                        <span className={`px-2 py-0.5 rounded text-[9px] font-black ${mMargin > 40 ? 'bg-green-100 text-green-800' : mMargin > 20 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                            {formatPercent(mMargin)}
                                                        </span>
                                                    </td>
                                                    <td onClick={() => setExpandedMaintRowId(isExpanded ? null : item.id)} className={`${tdClass} text-center`}>
                                                        <span className={`px-2.5 py-0.5 rounded text-[10px] font-black ${item.status === 'Finalizado' ? 'bg-purple-150 text-purple-700 dark:bg-purple-950/30' : 'bg-green-150 text-green-700 dark:bg-green-950/30'}`}>
                                                            {toSentenceCase(item.status || 'Finalizado')}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {/* Expanded maintenance drawer */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={9} className="bg-emerald-50/20 dark:bg-gray-900/30 p-0 border-b border-emerald-100 dark:border-emerald-950/30">
                                                            {renderMaintenanceDetails(item)}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    }) : (
                                        <tr><td colSpan={9} className="px-6 py-12 text-center text-gray-400 italic">Nenhum chamado de manutenção finalizado encontrado no período.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <p className="text-[10px] text-gray-400 font-bold text-center italic">* Nota: Apenas chamados de manutenção com status "Aprovado" ou "Finalizado" são listados nesta área de pós-venda.</p>
                </div>
            )}
        </div>
    );
};

export default ResumoVendasPage;
