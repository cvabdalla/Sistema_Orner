import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ChartPieIcon, DollarIcon, TrendUpIcon, PrinterIcon, CalendarIcon, UsersIcon, FilterIcon, ChevronDownIcon, TableIcon, TrashIcon, SaveIcon } from '../assets/icons';
import DashboardCard from '../components/DashboardCard';
import type { SalesSummaryItem, User, SavedOrcamento } from '../types';
import { dataService } from '../services/dataService';

const formatCurrency = (value: number) => {
    if (isNaN(value) || value === 0) return 'R$ -';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const formatPercent = (value: number) => {
    if (isNaN(value)) return '0,00%';
    return `${value.toFixed(2).replace('.', ',')}%`;
};

const ResumoVendasPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [salesData, setSalesData] = useState<SalesSummaryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState<number | null>(null); // ID do item sendo salvo
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
    const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const loadData = async () => {
        setIsLoading(true);
        const isAdmin = currentUser.profileId === '00000000-0000-0000-0000-000000000001';
        try {
            const [sales, orcamentos] = await Promise.all([
                dataService.getAll<SalesSummaryItem>('sales_summary', currentUser.id, isAdmin),
                dataService.getAll<SavedOrcamento>('orcamentos', currentUser.id, isAdmin)
            ]);

            // 1. Limpeza de órfãos (Orçamentos que não são mais aprovados)
            const invalidSales = sales.filter(sale => {
                const correspondingOrc = orcamentos.find(o => String(o.id) === String(sale.orcamentoId));
                return !correspondingOrc || correspondingOrc.status !== 'Aprovado';
            });

            if (invalidSales.length > 0) {
                for (const inv of invalidSales) {
                    await dataService.delete('sales_summary', inv.id);
                }
            }

            // 2. Sincronização e Respeito a Edições Manuais
            const approvedOrcamentos = orcamentos.filter(orc => orc.status === 'Aprovado');
            const finalSalesList: SalesSummaryItem[] = [];

            for (const orc of approvedOrcamentos) {
                const existingSale = sales.find(s => String(s.orcamentoId) === String(orc.id));
                
                let fs: any = null; let calc: any = null;
                if (orc.variants?.length) {
                    const v = orc.variants.find(x => x.isPrincipal) || orc.variants[0];
                    fs = v.formState; calc = v.calculated;
                } else {
                    fs = orc.formState; calc = orc.calculated;
                }

                if (fs && calc) {
                    // Se já existe no banco de vendas, mantemos os valores de Imposto e Taxas Banco que podem ter sido editados
                    const item: SalesSummaryItem = {
                        id: existingSale ? Number(existingSale.id) : Date.now() + Math.floor(Math.random() * 1000),
                        orcamentoId: Number(orc.id),
                        owner_id: orc.owner_id || currentUser.id,
                        clientName: fs.nomeCliente || 'Importado',
                        date: fs.dataOrcamento || orc.savedAt.split('T')[0],
                        closedValue: Number(calc.precoVendaFinal) || 0,
                        systemCost: Number(fs.custoSistema) || 0,
                        supplier: fs.fornecedor || 'N/A',
                        visitaTecnica: Number(fs.visitaTecnicaCusto) || 0,
                        homologation: Number(fs.projetoHomologacaoCusto) || 0,
                        installation: (Number(fs.terceiroInstalacaoQtd) || 0) * (Number(fs.terceiroInstalacaoCusto) || 0),
                        travelCost: Number(fs.custoViagem) || 0,
                        adequationCost: Number(fs.adequacaoLocalCusto) || 0,
                        materialCost: Number(calc.totalEstrutura) || 0,
                        // PRIORIDADE: Valor da tabela sales_summary se existir, senão valor do cálculo original
                        invoicedTax: existingSale ? (Number(existingSale.invoicedTax) ?? Number(calc.nfServicoValor)) : Number(calc.nfServicoValor),
                        bankFees: existingSale ? (Number(existingSale.bankFees) ?? 0) : 0,
                        commission: Number(calc.comissaoVendasValor) || 0,
                        // Estes campos serão recalculados abaixo para garantir consistência
                        totalCost: 0,
                        netProfit: 0,
                        finalMargin: 0,
                        status: 'Aprovado'
                    };

                    // Recálculo de segurança (garante que custos manuais reflitam no lucro)
                    item.totalCost = (item.systemCost || 0) + (item.visitaTecnica || 0) + (item.homologation || 0) + 
                                     (item.installation || 0) + (item.travelCost || 0) + (item.adequationCost || 0) + 
                                     (item.materialCost || 0) + (item.invoicedTax || 0) + (item.commission || 0) + (item.bankFees || 0);
                    item.netProfit = item.closedValue - item.totalCost;
                    item.finalMargin = item.closedValue > 0 ? (item.netProfit / item.closedValue) * 100 : 0;

                    finalSalesList.push(item);
                }
            }

            setSalesData(finalSalesList);
            
        } catch (e) {
            console.error("Erro ao carregar resumo de vendas:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsSupplierDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [currentUser]);

    const handleUpdateManualField = async (id: number, field: 'invoicedTax' | 'bankFees', value: number) => {
        setSalesData(prev => prev.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                // Recalcula derivados
                updated.totalCost = (updated.systemCost || 0) + (updated.visitaTecnica || 0) + (updated.homologation || 0) + 
                                    (updated.installation || 0) + (updated.travelCost || 0) + (updated.adequationCost || 0) + 
                                    (updated.materialCost || 0) + (updated.invoicedTax || 0) + (updated.commission || 0) + (updated.bankFees || 0);
                updated.netProfit = updated.closedValue - updated.totalCost;
                updated.finalMargin = updated.closedValue > 0 ? (updated.netProfit / updated.closedValue) * 100 : 0;
                
                // Dispara salvamento em segundo plano
                saveUpdatedItem(updated);
                return updated;
            }
            return item;
        }));
    };

    const saveUpdatedItem = async (item: SalesSummaryItem) => {
        setIsSaving(item.id);
        try {
            await dataService.save('sales_summary', item);
        } catch (e) {
            console.error("Erro ao salvar alteração manual:", e);
        } finally {
            setTimeout(() => setIsSaving(null), 1000);
        }
    };

    const suppliersList = useMemo(() => {
        const unique = new Set<string>();
        salesData.forEach(item => { if (item.supplier) unique.add(item.supplier.trim()); });
        return Array.from(unique).sort();
    }, [salesData]);

    const filteredSalesData = useMemo(() => {
        return [...salesData]
            .sort((a, b) => b.date.localeCompare(a.date))
            .filter(item => {
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
        return filteredSalesData.reduce((acc, item) => ({
            closedValue: acc.closedValue + (Number(item.closedValue) || 0),
            systemCost: acc.systemCost + (Number(item.systemCost) || 0),
            visitaTecnica: acc.visitaTecnica + (Number(item.visitaTecnica) || 0),
            homologation: acc.homologation + (Number(item.homologation) || 0),
            installation: acc.installation + (Number(item.installation) || 0),
            travelCost: acc.travelCost + (Number(item.travelCost) || 0),
            adequationCost: acc.adequationCost + (Number(item.adequationCost) || 0),
            materialCost: acc.materialCost + (Number(item.materialCost) || 0),
            invoicedTax: acc.invoicedTax + (Number(item.invoicedTax) || 0),
            commission: acc.commission + (Number(item.commission) || 0),
            bankFees: acc.bankFees + (Number(item.bankFees) || 0),
            totalCost: acc.totalCost + (Number(item.totalCost) || 0),
            netProfit: acc.netProfit + (Number(item.netProfit) || 0),
        }), { 
            closedValue: 0, systemCost: 0, visitaTecnica: 0, homologation: 0, 
            installation: 0, travelCost: 0, adequationCost: 0, materialCost: 0, 
            invoicedTax: 0, commission: 0, bankFees: 0, totalCost: 0, netProfit: 0 
        });
    }, [filteredSalesData]);

    const totalValorMO = totals.closedValue - totals.systemCost;
    const avgMargin = totals.closedValue > 0 ? (totals.netProfit / totals.closedValue) * 100 : 0;
    const avgServiceMargin = totalValorMO > 0 ? (totals.netProfit / totalValorMO) * 100 : 0;

    if (isLoading) return <div className="flex justify-center p-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    const thClass = "px-2 py-3 border-b border-gray-200 dark:border-gray-600 text-[10px] font-bold text-gray-500 tracking-tight text-center whitespace-nowrap";
    const tdClass = "px-2 py-3 border-b border-gray-100 dark:border-gray-700 text-[11px] text-gray-700 dark:text-gray-300 text-right whitespace-nowrap";
    const editableTdClass = "px-1 py-2 border-b border-gray-100 dark:border-gray-700 text-right whitespace-nowrap bg-indigo-50/30 dark:bg-indigo-900/10";
    const footerTdClass = "px-2 py-3 text-[11px] font-black text-white text-right border-r border-gray-700/50 last:border-r-0";

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 print:hidden">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700/30 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600">
                        <CalendarIcon className="w-4 h-4 ml-2 text-gray-400" />
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 p-1" />
                        <span className="text-gray-400">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-xs font-bold text-gray-700 dark:text-gray-200 focus:ring-0 p-1" />
                    </div>

                    <div className="relative" ref={dropdownRef}>
                        <button onClick={() => setIsSupplierDropdownOpen(!isSupplierDropdownOpen)} className="flex items-center justify-between gap-2 bg-white dark:bg-gray-700 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-bold text-gray-600 dark:text-gray-300 w-48">
                            <span className="truncate">{selectedSuppliers.length === 0 ? 'Todos os fornecedores' : `${selectedSuppliers.length} selecionado(s)`}</span>
                            <ChevronDownIcon className={`w-3 h-3 transition-transform ${isSupplierDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isSupplierDropdownOpen && (
                            <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-100 dark:border-gray-700 z-50 py-2 max-h-60 overflow-y-auto">
                                {suppliersList.length > 0 ? suppliersList.map(sup => (
                                    <label key={sup} className="flex items-center px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                                        <input type="checkbox" checked={selectedSuppliers.includes(sup)} onChange={() => setSelectedSuppliers(prev => prev.includes(sup) ? prev.filter(s => s !== sup) : [...prev, sup])} className="rounded text-indigo-600 mr-3" />
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{sup}</span>
                                    </label>
                                )) : <div className="px-4 py-2 text-xs text-gray-400 italic">Nenhum fornecedor</div>}
                            </div>
                        )}
                    </div>
                    <button onClick={() => {setStartDate(''); setEndDate(''); setSelectedSuppliers([]);}} className="flex items-center gap-1.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"><TrashIcon className="w-4 h-4" /> Limpar filtros</button>
                </div>
                {isSaving && (
                    <div className="flex items-center gap-2 text-indigo-600 animate-pulse">
                        <SaveIcon className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Salvando alteração...</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
                <DashboardCard title="Total venda cons. final" value={formatCurrency(totals.closedValue)} icon={DollarIcon} color="bg-blue-600" />
                <DashboardCard title="Total mão de obra" value={formatCurrency(totalValorMO)} icon={UsersIcon} color="bg-purple-600" />
                <DashboardCard title="Lucro líquido" value={formatCurrency(totals.netProfit)} icon={TrendUpIcon} color="bg-green-600" />
                <DashboardCard title="Margem média venda" value={formatPercent(avgMargin)} icon={ChartPieIcon} color="bg-indigo-600" />
                <DashboardCard title="Margem média serviço" value={formatPercent(avgServiceMargin)} icon={ChartPieIcon} color="bg-orange-600" />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b dark:border-gray-700">
                    <div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2"><TableIcon className="w-5 h-5 text-indigo-600" /> Resumo de vendas detalhado</h3>
                        <p className="text-xs text-gray-400 font-medium">{filteredSalesData.length} projeto(s) aprovado(s) listado(s).</p>
                    </div>
                    <button onClick={() => window.print()} className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-bold shadow-sm hover:bg-gray-50 transition-all"><PrinterIcon className="w-4 h-4" /> Imprimir relatório</button>
                </div>

                <div className="overflow-x-auto custom-scrollbar">
                    <table className="min-w-full border-collapse">
                        <thead>
                            <tr className="bg-gray-50 dark:bg-gray-700/50">
                                <th className={`${thClass} w-8 sticky left-0 bg-gray-50 dark:bg-gray-700 z-10`}>Nº</th>
                                <th className={`${thClass} text-left min-w-[150px] sticky left-10 bg-gray-50 dark:bg-gray-700 z-10`}>Cliente</th>
                                <th className={thClass}>Data</th>
                                <th className={thClass}>V. Fechado</th>
                                <th className={thClass}>Custo Sist.</th>
                                <th className={thClass}>Fornec.</th>
                                <th className={thClass}>V. Técnica</th>
                                <th className={thClass}>Homolog.</th>
                                <th className={thClass}>Instal.</th>
                                <th className={thClass}>Viagem</th>
                                <th className={thClass}>Adequação</th>
                                <th className={thClass}>Materiais</th>
                                <th className={`${thClass} bg-indigo-50/50 dark:bg-indigo-900/20`}>Imposto (Edit)</th>
                                <th className={thClass}>Comissão</th>
                                <th className={`${thClass} bg-indigo-50/50 dark:bg-indigo-900/20`}>Taxas banco (Edit)</th>
                                <th className={`${thClass} bg-gray-100 dark:bg-gray-900/50`}>Custo total</th>
                                <th className={`${thClass} bg-green-50 dark:bg-green-900/20 text-green-700`}>Lucro liq.</th>
                                <th className={thClass}>Margem final</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredSalesData.map((item, index) => (
                                <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className={`${tdClass} text-center font-bold text-gray-400 sticky left-0 bg-white dark:bg-gray-800 z-10`}>{index + 1}</td>
                                    <td className={`${tdClass} text-left font-bold text-gray-900 dark:text-white sticky left-10 bg-white dark:bg-gray-800 z-10`}>{item.clientName}</td>
                                    <td className={`${tdClass} text-center`}>{new Date(item.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>
                                    <td className={`${tdClass} font-bold text-indigo-600`}>{formatCurrency(item.closedValue)}</td>
                                    <td className={tdClass}>{formatCurrency(item.systemCost)}</td>
                                    <td className={`${tdClass} text-center font-semibold text-gray-500`}>{item.supplier || 'N/A'}</td>
                                    <td className={tdClass}>{formatCurrency(item.visitaTecnica)}</td>
                                    <td className={tdClass}>{formatCurrency(item.homologation)}</td>
                                    <td className={tdClass}>{formatCurrency(item.installation)}</td>
                                    <td className={tdClass}>{formatCurrency(item.travelCost)}</td>
                                    <td className={tdClass}>{formatCurrency(item.adequationCost)}</td>
                                    <td className={tdClass}>{formatCurrency(item.materialCost)}</td>
                                    <td className={editableTdClass}>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={item.invoicedTax}
                                            onBlur={(e) => handleUpdateManualField(item.id, 'invoicedTax', parseFloat(e.target.value) || 0)}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                setSalesData(prev => prev.map(x => x.id === item.id ? { ...x, invoicedTax: val } : x));
                                            }}
                                            className="w-20 bg-transparent text-right font-bold text-indigo-700 dark:text-indigo-300 border-none focus:ring-0 p-0 text-[11px]"
                                        />
                                    </td>
                                    <td className={tdClass}>{formatCurrency(item.commission)}</td>
                                    <td className={editableTdClass}>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={item.bankFees}
                                            onBlur={(e) => handleUpdateManualField(item.id, 'bankFees', parseFloat(e.target.value) || 0)}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value) || 0;
                                                setSalesData(prev => prev.map(x => x.id === item.id ? { ...x, bankFees: val } : x));
                                            }}
                                            className="w-20 bg-transparent text-right font-bold text-indigo-700 dark:text-indigo-300 border-none focus:ring-0 p-0 text-[11px]"
                                        />
                                    </td>
                                    <td className={`${tdClass} font-bold bg-gray-50/50 dark:bg-gray-900/20`}>{formatCurrency(item.totalCost)}</td>
                                    <td className={`${tdClass} font-black text-green-600 bg-green-50/30 dark:bg-green-900/10`}>{formatCurrency(item.netProfit)}</td>
                                    <td className={`${tdClass} text-center`}>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.finalMargin > 15 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                            {formatPercent(item.finalMargin)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-900 text-white font-black">
                            <tr>
                                <td colSpan={3} className="px-4 py-3 text-xs uppercase tracking-widest">Total do período</td>
                                <td className={footerTdClass}>{formatCurrency(totals.closedValue)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.systemCost)}</td>
                                <td className={`${footerTdClass} text-center`}>-</td>
                                <td className={footerTdClass}>{formatCurrency(totals.visitaTecnica)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.homologation)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.installation)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.travelCost)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.adequationCost)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.materialCost)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.invoicedTax)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.commission)}</td>
                                <td className={footerTdClass}>{formatCurrency(totals.bankFees)}</td>
                                <td className={`${footerTdClass} bg-gray-800`}>{formatCurrency(totals.totalCost)}</td>
                                <td className={`${footerTdClass} bg-green-900`}>{formatCurrency(totals.netProfit)}</td>
                                <td className={`${footerTdClass} text-center`}>{formatPercent(avgMargin)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
            
            <p className="text-[10px] text-gray-400 font-bold italic text-center">
                * Nota: As colunas de "Imposto" e "Taxas Banco" permitem edição manual. As alterações salvam automaticamente ao sair do campo e refletem nos totais.
            </p>
        </div>
    );
};

export default ResumoVendasPage;