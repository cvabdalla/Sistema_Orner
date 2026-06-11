
import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../components/Modal';
import { CalculatorIcon, SaveIcon, AddIcon, TrashIcon, EditIcon, CheckCircleIcon, DollarIcon, CubeIcon, ArrowLeftIcon, PlusIcon, XCircleIcon, TrendUpIcon, ChevronDownIcon } from '../assets/icons';
import type { NovoOrcamentoPageProps, OrcamentoVariant, SavedOrcamento, StockItem, Supplier } from '../types';
import { dataService } from '../services/dataService';

// Helper to format numbers as BRL currency
const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value) || value === 0) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

// Standard rounding to 2 decimals
const roundToCents = (value: number) => Math.round(value * 100) / 100;

// Helper to safely parse string values to numbers, supporting commas and dots
const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const clean = String(val).replace(',', '.');
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
};

const NovoOrcamentoPage = ({ setCurrentPage, orcamentoToEdit, clearEditingOrcamento, currentUser }: NovoOrcamentoPageProps): React.ReactElement => {
    const [isModalOpen, setModalOpen] = useState(false);
    const [isPriceCalcModalOpen, setPriceCalcModalOpen] = useState(false);
    const [desiredMargin, setDesiredMargin] = useState('');
    const [desiredPrice, setDesiredPrice] = useState('');
    const [isNetProfitCalcModalOpen, setNetProfitCalcModalOpen] = useState(false);
    const [isNetMarginCalcModalOpen, setNetMarginCalcModalOpen] = useState(false);
    const [desiredNetProfit, setDesiredNetProfit] = useState('');
    const [desiredNetMargin, setDesiredNetMargin] = useState('');
    const [isRenameModalOpen, setRenameModalOpen] = useState(false);
    const [tempVariantName, setTempVariantName] = useState('');
    const [isSaveModalOpen, setSaveModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [addItemTab, setAddItemTab] = useState<'estoque' | 'manual'>('estoque');

    const [manualItemForm, setManualItemForm] = useState({ name: '', cost: 0 });

    const isReadOnly = orcamentoToEdit?.status === 'Aprovado';

    const initialFormState = {
        dataOrcamento: new Date().toISOString().split('T')[0],
        nomeCliente: '',
        fornecedor: '',
        custoSistema: 14687.02,
        maoDeObraGeral: 6490.68,
        visitaTecnicaCusto: 400,
        projetoHomologacaoCusto: 600,
        terceiroInstalacaoQtd: 12,
        terceiroInstalacaoCusto: 120, // Default fallback
        custoViagem: 0,
        adequacaoLocalCusto: 0,
        manualStockItemIds: [] as string[],
        offStockItems: [] as { id: string, name: string, cost: number, qty: number, markup: number }[],
        fixedItemsData: {} as Record<string, { qty: number, cost: number, markup: number }>,
        nfServicoPerc: 6,
        comissaoVendasOpcao: 'Não',
        comissaoVendasPerc: 3,
        descontoAplicadoPerc: 0,
    };

    const [variants, setVariants] = useState<OrcamentoVariant[]>([
        { id: '1', name: 'Opção 1', isPrincipal: true, formState: initialFormState, calculated: {} }
    ]);
    const [activeVariantId, setActiveVariantId] = useState<string>('1');
    const [formState, setFormState] = useState<any>(initialFormState);
    const [calculated, setCalculated] = useState<any>({});

    useEffect(() => {
        const loadInitialData = async () => {
            const [items, remoteConfigs, supplierData] = await Promise.all([
                dataService.getAll<StockItem>('stock_items'),
                dataService.getAll<any>('system_configs', undefined, true),
                dataService.getAll<Supplier>('suppliers', undefined, true)
            ]);
            
            setAllStockItems(items);
            setSuppliers(supplierData.sort((a, b) => a.name.localeCompare(b.name)));
            
            // Tenta obter o custo de instalação global do banco de dados
            const remoteInst = remoteConfigs.find(c => c.id === 'installation_value');
            const finalInstCost = remoteInst ? parseFloat(remoteInst.value) : 120;
            const remoteTax = remoteConfigs.find(c => c.id === 'tax_value');
            const finalNfPerc = remoteTax ? parseFloat(remoteTax.value) : 6;

            if (!orcamentoToEdit) {
                const initialFixedData: Record<string, any> = {};
                items.filter(i => i.isFixedInBudget && i.lineStatus !== 'Fora de Linha').forEach(i => {
                    initialFixedData[String(i.id)] = { qty: 0, cost: i.averagePrice || 0, markup: 0 };
                });
                const newState = { 
                    ...initialFormState, 
                    terceiroInstalacaoCusto: finalInstCost,
                    nfServicoPerc: finalNfPerc,
                    fixedItemsData: initialFixedData 
                };
                setFormState(newState);
                setVariants([{ id: '1', name: 'Opção 1', isPrincipal: true, formState: newState, calculated: {} }]);
            } else if (formState.terceiroInstalacaoCusto === 120 && !isReadOnly) {
                // Se for edição de orçamento aberto e o custo ainda é o padrão hardcoded, atualiza para o global
                setFormState((prev: any) => ({ ...prev, standby: true, terceiroInstalacaoCusto: finalInstCost }));
            }
        }
        loadInitialData();
    }, [orcamentoToEdit]);

    const selectedStockTableItems = useMemo(() => {
        const currentDataIds = Object.keys(formState.fixedItemsData || {});
        return allStockItems.filter((i: any) => currentDataIds.includes(String(i.id)));
    }, [allStockItems, formState.fixedItemsData]);

    // Novo memo para unificar e ordenar alfabeticamente os itens da tabela
    const combinedSortedItems = useMemo(() => {
        const fromStock = selectedStockTableItems.map((item: any) => ({
            ...item,
            id: String(item.id),
            isFromStock: true,
            // Recupera os dados de qty, cost e markup do formState
            itemData: (formState.fixedItemsData || {})[String(item.id)] || { 
                qty: 0, 
                cost: item.averagePrice || 0,
                markup: 0 
            }
        }));

        const fromExternal = (formState.offStockItems || []).map((item: any) => ({
            ...item,
            isFromStock: false
        }));

        return [...fromStock, ...fromExternal].sort((a, b) => a.name.localeCompare(b.name));
    }, [selectedStockTableItems, formState.offStockItems, formState.fixedItemsData]);

    const availableStockToAdd = useMemo(() => {
        const currentDataIds = Object.keys(formState.fixedItemsData || {});
        return allStockItems.filter((i: any) => !currentDataIds.includes(String(i.id)) && i.lineStatus !== 'Fora de Linha');
    }, [allStockItems, formState.fixedItemsData]);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        if (orcamentoToEdit) {
            let loadedVariants: OrcamentoVariant[] = [];
            if (orcamentoToEdit.variants && orcamentoToEdit.variants.length > 0) {
                loadedVariants = orcamentoToEdit.variants.map(v => ({
                    ...v,
                    formState: {
                        ...initialFormState,
                        ...v.formState,
                        nomeCliente: v.formState.nomeCliente || orcamentoToEdit.formState?.nomeCliente || '',
                        fornecedor: v.formState.fornecedor || orcamentoToEdit.formState?.fornecedor || '',
                        dataOrcamento: v.formState.dataOrcamento || orcamentoToEdit.formState?.dataOrcamento || today
                    }
                }));
            } else if (orcamentoToEdit.formState) {
                loadedVariants = [{
                    id: '1',
                    name: 'Opção 1',
                    isPrincipal: true,
                    formState: { 
                        ...initialFormState, 
                        ...orcamentoToEdit.formState, 
                        dataOrcamento: orcamentoToEdit.formState.dataOrcamento || today,
                        fixedItemsData: orcamentoToEdit.formState.fixedItemsData || {},
                        manualStockItemIds: orcamentoToEdit.formState.manualStockItemIds || [],
                        offStockItems: orcamentoToEdit.formState.offStockItems || []
                    }, 
                    calculated: orcamentoToEdit.calculated || {}
                }];
            }
            if (loadedVariants.length > 0) {
                setVariants(loadedVariants);
                const active = loadedVariants.find(v => v.isPrincipal) || loadedVariants[0];
                setActiveVariantId(active.id);
                setFormState(active.formState);
                setCalculated(active.calculated || {});
            }
        }
    }, [orcamentoToEdit]);

    useEffect(() => {
        const activeVariant = variants.find(v => v.id === activeVariantId);
        if (activeVariant) {
             setFormState(activeVariant.formState);
             if (activeVariant.calculated && Object.keys(activeVariant.calculated).length > 0) {
                 setCalculated(activeVariant.calculated);
             }
        }
    }, [activeVariantId, variants]);

    const updateVariantsWithFormState = (newState: any) => {
        if (isReadOnly) return;
        setFormState(newState);
        setVariants(prev => prev.map(v => 
            v.id === activeVariantId 
            ? { ...v, formState: newState } 
            : { ...v, 
                formState: { 
                    ...v.formState, 
                    dataOrcamento: newState.dataOrcamento,
                    nomeCliente: newState.nomeCliente
                } 
            }
        ));
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (isReadOnly) return;
        const { name, value } = e.target;
        const updatedFormState = { ...formState, [name]: value };
        updateVariantsWithFormState(updatedFormState);
    };

    const handleStockItemDataChange = (itemId: string, field: 'qty' | 'cost' | 'markup', value: any) => {
        if (isReadOnly) return;
        const currentData = formState.fixedItemsData || {};
        const stockItem = allStockItems.find(i => String(i.id) === itemId);
        const itemData = currentData[itemId] || { 
            qty: 0, 
            cost: stockItem?.averagePrice || 0,
            markup: 0 
        };
        
        const updatedFormState = {
            ...formState,
            fixedItemsData: {
                ...currentData,
                [itemId]: { ...itemData, [field]: value }
            }
        };
        updateVariantsWithFormState(updatedFormState);
    };

    const handleOffStockItemChange = (offId: string, field: 'qty' | 'cost' | 'markup', value: any) => {
        if (isReadOnly) return;
        const updatedOffStockItems = (formState.offStockItems || []).map((item: any) => {
            if (item.id === offId) {
                return { ...item, [field]: value };
            }
            return item;
        });
        const updatedFormState = { ...formState, offStockItems: updatedOffStockItems };
        updateVariantsWithFormState(updatedFormState);
    };

    const addStockManualItem = (itemId: string) => {
        if (isReadOnly) return;
        const stockItem = allStockItems.find(i => String(i.id) === itemId);
        if (!stockItem) return;

        const currentData = { ...(formState.fixedItemsData || {}) };
        currentData[itemId] = { qty: 0, cost: stockItem.averagePrice || 0, markup: 0 };
        
        const updatedFormState = {
            ...formState,
            fixedItemsData: currentData
        };
        updateVariantsWithFormState(updatedFormState);
        setIsAddItemModalOpen(false);
    };

    const removeStockManualItem = (itemId: string) => {
        if (isReadOnly) return;
        const currentData = { ...(formState.fixedItemsData || {}) };
        delete currentData[itemId];
        const updatedFormState = { ...formState, fixedItemsData: currentData };
        updateVariantsWithFormState(updatedFormState);
    };

    const handleAddOffStockItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (!manualItemForm.name.trim()) return;
        const newItem = {
            id: `off-${Date.now()}`,
            name: manualItemForm.name,
            cost: manualItemForm.cost,
            qty: 1,
            markup: 0
        };
        const updatedFormState = {
            ...formState,
            offStockItems: [...(formState.offStockItems || []), newItem]
        };
        updateVariantsWithFormState(updatedFormState);
        setManualItemForm({ name: '', cost: 0 });
        setIsAddItemModalOpen(false);
    };

    const removeOffStockItem = (id: string) => {
        if (isReadOnly) return;
        const updatedOffStockItems = (formState.offStockItems || []).filter((i: any) => i.id !== id);
        const updatedFormState = { ...formState, offStockItems: updatedOffStockItems };
        updateVariantsWithFormState(updatedFormState);
    };
    
    useEffect(() => {
        const n_terceiroInstalacaoQtd = parseNumber(formState.terceiroInstalacaoQtd);
        const n_terceiroInstalacaoCusto = parseNumber(formState.terceiroInstalacaoCusto);
        const n_visitaTecnicaCusto = parseNumber(formState.visitaTecnicaCusto);
        const n_projetoHomologacaoCusto = parseNumber(formState.projetoHomologacaoCusto);
        const n_custoViagem = parseNumber(formState.custoViagem);
        const n_adequacaoLocalCusto = parseNumber(formState.adequacaoLocalCusto);
        const n_custoSistema = parseNumber(formState.custoSistema);
        const n_maoDeObraGeral = parseNumber(formState.maoDeObraGeral);
        const n_nfServicoPerc = parseNumber(formState.nfServicoPerc);
        const n_comissaoVendasPerc = parseNumber(formState.comissaoVendasPerc);
        const n_descontoAplicadoPerc = parseNumber(formState.descontoAplicadoPerc);

        const instalacaoCusto = n_terceiroInstalacaoQtd * n_terceiroInstalacaoCusto;
        const valorVendaSistema = n_custoSistema;
        const valorVendaMaoDeObra = n_maoDeObraGeral;
        const totalInstalacao = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + instalacaoCusto + n_custoViagem + n_adequacaoLocalCusto;

        const totalStockStructure = selectedStockTableItems.reduce((acc: number, item: any) => {
            const itemId = String(item.id);
            const data = (formState.fixedItemsData || {})[itemId] || { 
                qty: 0, 
                cost: item.averagePrice || 0,
                markup: 0 
            };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc: number, item: any) => {
            const n_qty = parseNumber(item.qty);
            const n_cost = parseNumber(item.cost);
            const n_markup = parseNumber(item.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalEstrutura = totalStockStructure + totalOffStockStructure;
        const custoMO = n_maoDeObraGeral + totalInstalacao + totalEstrutura;
        const precoVendaFinal = valorVendaSistema + custoMO;
        const despesasNotaCF = custoMO; 
        const nfServicoValor = roundToCents(despesasNotaCF * (n_nfServicoPerc / 100));
        const comissaoVendasValor = formState.comissaoVendasOpcao === 'Sim' ? roundToCents(precoVendaFinal * (n_comissaoVendasPerc / 100)) : 0;
        const totalCustoTerceiro = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + totalEstrutura + instalacaoCusto + n_custoViagem + n_adequacaoLocalCusto;

        const valorFinalServico = custoMO;
        const impostos = nfServicoValor;
        const custosTotaisServico = totalCustoTerceiro; 
        const comissoes = comissaoVendasValor;
        const lucroLiquidoServicoSDesc = valorFinalServico - impostos - custosTotaisServico - comissoes;
        const descontoAplicadoValor = roundToCents(precoVendaFinal * (n_descontoAplicadoPerc / 100));
        const lucroLiquidoServicoCDesc = lucroLiquidoServicoSDesc - descontoAplicadoValor;
        const lucroLiquido = lucroLiquidoServicoCDesc;
        const margemLiquida = precoVendaFinal > 0 ? (lucroLiquido / precoVendaFinal) * 100 : 0;
        const valorFinalSistema = precoVendaFinal - descontoAplicadoValor;
        const lucroLiquidoVenda = lucroLiquido;
        const margemFinal = margemLiquida;
        const totalDivisaoLucro = lucroLiquidoVenda;
        const margemLiquidaServico = valorFinalServico > 0 ? (lucroLiquidoServicoCDesc / valorFinalServico) * 100 : 0;

        const newCalculated = {
            valorVendaSistema: roundToCents(valorVendaSistema),
            valorVendaMaoDeObra: roundToCents(valorVendaMaoDeObra),
            totalInstalacao: roundToCents(totalInstalacao),
            totalEstrutura: roundToCents(totalEstrutura),
            custoMO: roundToCents(custoMO),
            precoVendaFinal: roundToCents(precoVendaFinal),
            despesasNotaCF: roundToCents(despesasNotaCF),
            nfServicoValor: nfServicoValor,
            comissaoVendasValor: comissaoVendasValor,
            totalCustoTerceiro: roundToCents(totalCustoTerceiro),
            lucroLiquido: roundToCents(lucroLiquido),
            margemLiquida,
            valorFinalSistema: roundToCents(valorFinalSistema),
            lucroLiquidoVenda: roundToCents(lucroLiquidoVenda),
            margemFinal,
            totalDivisaoLucro: roundToCents(totalDivisaoLucro),
            valorFinalServico: roundToCents(valorFinalSistema),
            impostos: impostos,
            custosTotaisServico: roundToCents(custosTotaisServico),
            lucroLiquidoServicoSDesc: roundToCents(lucroLiquidoServicoSDesc),
            descontoAplicadoValor: descontoAplicadoValor,
            lucroLiquidoServicoCDesc: roundToCents(lucroLiquidoServicoCDesc),
            margemLiquidaServico,
        };

        setCalculated(newCalculated);
        setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, calculated: newCalculated } : v));
    }, [formState, selectedStockTableItems, activeVariantId]);
    
    const handleMarginCalculation = () => {
        if (isReadOnly) return;
        const targetMargin = parseNumber(desiredMargin) / 100;
        if (isNaN(targetMargin)) return;

        const n_terceiroInstalacaoQtd = parseNumber(formState.terceiroInstalacaoQtd);
        const n_terceiroInstalacaoCusto = parseNumber(formState.terceiroInstalacaoCusto);
        const n_visitaTecnicaCusto = parseNumber(formState.visitaTecnicaCusto);
        const n_projetoHomologacaoCusto = parseNumber(formState.projetoHomologacaoCusto);
        const n_custoViagem = parseNumber(formState.custoViagem);
        const n_adequacaoLocalCusto = parseNumber(formState.adequacaoLocalCusto);
        const n_custoSistema = parseNumber(formState.custoSistema);
        const n_nfServicoPerc = parseNumber(formState.nfServicoPerc);
        const n_comissaoVendasPerc = parseNumber(formState.comissaoVendasPerc);
        const n_descontoAplicadoPerc = parseNumber(formState.descontoAplicadoPerc);

        const instalacaoCusto = n_terceiroInstalacaoQtd * n_terceiroInstalacaoCusto;
        const totalInstalacaoParcial = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + instalacaoCusto + n_custoViagem + n_adequacaoLocalCusto;
        
        const totalStockStructure = selectedStockTableItems.reduce((acc: number, item: any) => {
            const data = (formState.fixedItemsData || {})[String(item.id)] || { qty: 0, cost: item.averagePrice || 0, markup: 0 };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc: number, item: any) => {
            const n_qty = parseNumber(item.qty);
            const n_cost = parseNumber(item.cost);
            const n_markup = parseNumber(item.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalEstrutura = totalStockStructure + totalOffStockStructure;

        const C1 = totalInstalacaoParcial + totalEstrutura;
        const C2 = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + totalEstrutura + instalacaoCusto + n_custoViagem + n_adequacaoLocalCusto;
        const VVS = n_custoSistema;
        const nfPerc = n_nfServicoPerc / 100;
        const comPerc = formState.comissaoVendasOpcao === 'Sim' ? n_comissaoVendasPerc / 100 : 0;
        const descPerc = n_descontoAplicadoPerc / 100;
        const M_desejada = targetMargin;

        const numerador = C1 * (1 - M_desejada - nfPerc - comPerc - descPerc) - C2 - VVS * (comPerc + descPerc);
        const denominador = M_desejada - 1 + nfPerc + comPerc + descPerc;
        
        if (denominador === 0) {
            alert("Não é possível calcular a margem com os valores atuais.");
            return;
        }

        let newMOG = roundToCents(numerador / denominador);
        updateVariantsWithFormState({ ...formState, maoDeObraGeral: newMOG });
        setModalOpen(false);
        setDesiredMargin('');
    };

    const handlePriceCalculation = () => {
        if (isReadOnly) return;
        const targetPrice = parseNumber(desiredPrice);
        if (isNaN(targetPrice) || targetPrice <= 0) return;

        const n_terceiroInstalacaoQtd = parseNumber(formState.terceiroInstalacaoQtd);
        const n_terceiroInstalacaoCusto = parseNumber(formState.terceiroInstalacaoCusto);
        const n_visitaTecnicaCusto = parseNumber(formState.visitaTecnicaCusto);
        const n_projetoHomologacaoCusto = parseNumber(formState.projetoHomologacaoCusto);
        const n_custoViagem = parseNumber(formState.custoViagem);
        const n_adequacaoLocalCusto = parseNumber(formState.adequacaoLocalCusto);
        const n_custoSistema = parseNumber(formState.custoSistema);

        const totalInstalacao = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + (n_terceiroInstalacaoQtd * n_terceiroInstalacaoCusto) + n_custoViagem + n_adequacaoLocalCusto;
        
        const totalStockStructure = selectedStockTableItems.reduce((acc: number, item: any) => {
            const data = (formState.fixedItemsData || {})[String(item.id)] || { qty: 0, cost: item.averagePrice || 0, markup: 0 };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc: number, item: any) => {
            const n_qty = parseNumber(item.qty);
            const n_cost = parseNumber(item.cost);
            const n_markup = parseNumber(item.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalEstrutura = totalStockStructure + totalOffStockStructure;

        const newMOG = roundToCents(targetPrice - n_custoSistema - totalInstalacao - totalEstrutura);
        
        updateVariantsWithFormState({ ...formState, maoDeObraGeral: newMOG });
        setPriceCalcModalOpen(false);
        setDesiredPrice('');
    };

    const handleNetProfitCalculation = () => {
        if (isReadOnly) return;
        const targetLucroLiquido = parseNumber(desiredNetProfit);
        if (isNaN(targetLucroLiquido)) return;

        const n_terceiroInstalacaoQtd = parseNumber(formState.terceiroInstalacaoQtd);
        const n_terceiroInstalacaoCusto = parseNumber(formState.terceiroInstalacaoCusto);
        const n_visitaTecnicaCusto = parseNumber(formState.visitaTecnicaCusto);
        const n_projetoHomologacaoCusto = parseNumber(formState.projetoHomologacaoCusto);
        const n_custoViagem = parseNumber(formState.custoViagem);
        const n_adequacaoLocalCusto = parseNumber(formState.adequacaoLocalCusto);
        const n_custoSistema = parseNumber(formState.custoSistema);
        const n_nfServicoPerc = parseNumber(formState.nfServicoPerc);
        const n_comissaoVendasPerc = parseNumber(formState.comissaoVendasPerc);
        const n_descontoAplicadoPerc = parseNumber(formState.descontoAplicadoPerc);

        const instalacaoCusto = n_terceiroInstalacaoQtd * n_terceiroInstalacaoCusto;
        const totalInstalacaoParcial = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + instalacaoCusto + n_custoViagem + n_adequacaoLocalCusto;
        
        const totalStockStructure = selectedStockTableItems.reduce((acc: number, item: any) => {
            const data = (formState.fixedItemsData || {})[String(item.id)] || { qty: 0, cost: item.averagePrice || 0, markup: 0 };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc: number, item: any) => {
            const n_qty = parseNumber(item.qty);
            const n_cost = parseNumber(item.cost);
            const n_markup = parseNumber(item.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalEstrutura = totalStockStructure + totalOffStockStructure;

        const E = totalInstalacaoParcial + totalEstrutura;
        const VVS = n_custoSistema;
        const nf = n_nfServicoPerc / 100;
        const com = formState.comissaoVendasOpcao === 'Sim' ? n_comissaoVendasPerc / 100 : 0;
        const desc = n_descontoAplicadoPerc / 100;

        const numerador = targetLucroLiquido + E * nf + (VVS + E) * (com + desc);
        const denominador = 1 - nf - com - desc;

        if (denominador === 0) {
            alert("Não é possível calcular com os valores atuais.");
            return;
        }

        const newMOG = roundToCents(numerador / denominador);
        updateVariantsWithFormState({ ...formState, maoDeObraGeral: newMOG });
        setNetProfitCalcModalOpen(false);
        setDesiredNetProfit('');
    };

    const handleNetMarginCalculation = () => {
        if (isReadOnly) return;
        const targetMargin = parseNumber(desiredNetMargin) / 100;
        if (isNaN(targetMargin)) return;

        const n_terceiroInstalacaoQtd = parseNumber(formState.terceiroInstalacaoQtd);
        const n_terceiroInstalacaoCusto = parseNumber(formState.terceiroInstalacaoCusto);
        const n_visitaTecnicaCusto = parseNumber(formState.visitaTecnicaCusto);
        const n_projetoHomologacaoCusto = parseNumber(formState.projetoHomologacaoCusto);
        const n_custoViagem = parseNumber(formState.custoViagem);
        const n_adequacaoLocalCusto = parseNumber(formState.adequacaoLocalCusto);
        const n_custoSistema = parseNumber(formState.custoSistema);
        const n_nfServicoPerc = parseNumber(formState.nfServicoPerc);
        const n_comissaoVendasPerc = parseNumber(formState.comissaoVendasPerc);
        const n_descontoAplicadoPerc = parseNumber(formState.descontoAplicadoPerc);

        const instalacaoCusto = n_terceiroInstalacaoQtd * n_terceiroInstalacaoCusto;
        const totalInstalacaoParcial = n_visitaTecnicaCusto + n_projetoHomologacaoCusto + instalacaoCusto + n_custoViagem + n_adequacaoLocalCusto;
        
        const totalStockStructure = selectedStockTableItems.reduce((acc: number, item: any) => {
            const data = (formState.fixedItemsData || {})[String(item.id)] || { qty: 0, cost: item.averagePrice || 0, markup: 0 };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc: number, item: any) => {
            const n_qty = parseNumber(item.qty);
            const n_cost = parseNumber(item.cost);
            const n_markup = parseNumber(item.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalEstrutura = totalStockStructure + totalOffStockStructure;

        const E = totalInstalacaoParcial + totalEstrutura;
        const VVS = n_custoSistema;
        const nf = n_nfServicoPerc / 100;
        const com = formState.comissaoVendasOpcao === 'Sim' ? n_comissaoVendasPerc / 100 : 0;
        const desc = n_descontoAplicadoPerc / 100;

        const numerador = E * nf + (VVS + E) * (targetMargin + com + desc);
        const denominador = 1 - nf - com - desc - targetMargin;

        if (denominador === 0) {
            alert("Não é possível calcular com os valores atuais.");
            return;
        }

        const newMOG = roundToCents(numerador / denominador);
        updateVariantsWithFormState({ ...formState, maoDeObraGeral: newMOG });
        setNetMarginCalcModalOpen(false);
        setDesiredNetMargin('');
    };

    const handleSaveTrigger = () => {
        if (isReadOnly) return;
        if (!formState.nomeCliente.trim()) {
            alert('Por favor, preencha o nome do cliente antes de salvar.');
            return;
        }
        setSaveModalOpen(true);
    };

    const executeSave = async () => {
        if (isReadOnly) return;
        setIsSaving(true);
        const budgetToSave: SavedOrcamento = {
            id: orcamentoToEdit ? orcamentoToEdit.id : Date.now(),
            owner_id: orcamentoToEdit ? orcamentoToEdit.owner_id : currentUser.id,
            savedAt: new Date().toISOString(),
            status: orcamentoToEdit?.status || 'Em Aberto',
            variants,
        };

        try {
            await dataService.save('orcamentos', budgetToSave);
            setSaveModalOpen(false);
            alert('Projeto salvo com sucesso!');
            clearEditingOrcamento();
            setCurrentPage('ORCAMENTO');
        } catch (e: any) {
            alert(`Erro ao salvar no banco.`);
        } finally {
            setIsSaving(false);
        }
    };

    const addNewVariant = () => {
        if (isReadOnly) return;
        const newId = Date.now().toString();
        const activeVariant = variants.find(v => v.id === activeVariantId) || variants[0];
        const today = new Date().toISOString().split('T')[0];
        const newVariant: OrcamentoVariant = {
            id: newId,
            name: `Opção ${variants.length + 1}`,
            isPrincipal: false,
            formState: { 
                ...activeVariant.formState,
                dataOrcamento: today
            },
            calculated: { ...activeVariant.calculated }
        };
        setVariants([...variants, newVariant]);
        setActiveVariantId(newId);
    };

    const removeVariant = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault(); 
        if (isReadOnly) return;
        if (variants.length <= 1) { alert("Você precisa ter pelo menos uma opção."); return; }
        if (window.confirm("Tem certeza que deseja excluir esta opção?")) {
            const newVariants = variants.filter(v => v.id !== id);
            setVariants(newVariants);
            if (activeVariantId === id) setActiveVariantId(newVariants[0].id);
        }
    };

    const setPrincipal = (id: string, e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        if (isReadOnly) return;
        setVariants(prev => prev.map(v => ({ ...v, isPrincipal: v.id === id })));
    };

    const startRename = () => {
        if (isReadOnly) return;
        const current = variants.find(v => v.id === activeVariantId);
        if(current) { setTempVariantName(current.name); setRenameModalOpen(true); }
    }

    const finishRename = () => {
        if (tempVariantName.trim()) setVariants(prev => prev.map(v => v.id === activeVariantId ? { ...v, name: tempVariantName } : v));
        setRenameModalOpen(false);
    }

    return (
        <div className="space-y-4">
            {/* Top Navigation & Option Variants Row */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    {variants.map(variant => {
                        const isMainActive = activeVariantId === variant.id;
                        return (
                            <div 
                                key={variant.id} 
                                onClick={() => setActiveVariantId(variant.id)} 
                                className={`group relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg cursor-pointer transition-all duration-200 border text-xs font-semibold ${
                                    isMainActive 
                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                                    : 'bg-gray-50 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700/80 text-gray-500 dark:text-gray-300 border-gray-100 dark:border-gray-700'
                                }`}
                            >
                                {variant.isPrincipal && (
                                    <svg className={`w-3.5 h-3.5 ${isMainActive ? 'text-amber-300' : 'text-amber-500'} fill-current`} viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                )}
                                <span>{variant.name}</span>
                                {isMainActive && !isReadOnly && (
                                     <div className="flex items-center ml-2 pl-2 border-l border-white/30 space-x-1">
                                        <button type="button" onClick={startRename} className="p-1 hover:bg-white/20 rounded-lg transition-colors" title="Renomear">
                                            <EditIcon className="w-3 h-3" />
                                        </button>
                                        {!variant.isPrincipal && (
                                            <button type="button" onClick={(e) => setPrincipal(variant.id, e)} className="p-1 hover:bg-white/20 rounded-lg transition-colors" title="Definir Principal">
                                                <CheckCircleIcon className="w-3 h-3" />
                                            </button>
                                        )}
                                        <button type="button" onClick={(e) => removeVariant(variant.id, e)} className="p-1 hover:bg-red-500 rounded-lg transition-colors" title="Excluir">
                                            <TrashIcon className="w-3 h-3" />
                                        </button>
                                     </div>
                                 )}
                            </div>
                        );
                    })}
                    {!isReadOnly && (
                        <button 
                            type="button" 
                            onClick={addNewVariant} 
                            className="p-2 bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-100 dark:border-gray-700/50 rounded-lg transition-all" 
                            title="Nova opção de orçamento"
                        >
                            <AddIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
                {isReadOnly && (
                    <button 
                        onClick={() => setCurrentPage('ORCAMENTO')} 
                        className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-200 border border-gray-200/50 dark:border-gray-700 rounded-lg font-semibold text-xs transition-all"
                    >
                        <ArrowLeftIcon className="w-4 h-4" /> Voltar para lista
                    </button>
                )}
            </div>

            {/* Core Financial Indicators Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Preço venda card */}
                <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 rounded-xl p-3.5 text-white shadow-md flex items-center justify-between border border-indigo-500/10 relative overflow-hidden group">
                    <div className="absolute right-[-10%] top-[-20%] w-32 h-32 rounded-full bg-white/5 blur-xl pointer-events-none group-hover:scale-125 transition-transform duration-500"></div>
                    <div className="space-y-0.5 z-10">
                        <span className="text-[10px] font-bold opacity-75 block">Preço Venda Final</span>
                        <span className="text-xl font-bold tracking-tight block">{formatCurrency(calculated.precoVendaFinal || 0)}</span>
                    </div>
                    {!isReadOnly && (
                        <button 
                            onClick={() => setPriceCalcModalOpen(true)} 
                            className="p-2 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-lg transition-all shadow-inner z-10 border border-white/10"
                            title="Ajustar preço final (Mão de Obra ajustável)"
                        >
                            <CalculatorIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Lucro líquido card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-emerald-100/80 dark:border-emerald-800/20 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute left-0 top-0 w-1 h-full bg-green-500"></div>
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block">Lucro Líquido</span>
                        <span className="text-xl font-bold text-green-600 dark:text-green-400 tracking-tight block">{formatCurrency(calculated.lucroLiquido || 0)}</span>
                    </div>
                    {!isReadOnly && (
                        <button 
                            type="button"
                            onClick={() => setNetProfitCalcModalOpen(true)} 
                            className="p-2 bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60 active:scale-95 rounded-lg border border-green-100/30 dark:border-green-800/10 transition-all shadow-sm"
                            title="Ajustar lucro líquido desejado"
                        >
                            <CalculatorIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Margem líquida card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-sky-100/80 dark:border-sky-800/20 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-500"></div>
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block">Margem Líquida</span>
                        <span className="text-xl font-bold text-blue-600 dark:text-blue-400 tracking-tight block">{calculated.margemLiquida?.toFixed(2) || 0}%</span>
                    </div>
                    {!isReadOnly && (
                        <button 
                            type="button"
                            onClick={() => setNetMarginCalcModalOpen(true)} 
                            className="p-2 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 active:scale-95 rounded-lg border border-blue-100/30 dark:border-blue-800/10 transition-all shadow-sm"
                            title="Ajustar margem líquida alvo"
                        >
                            <CalculatorIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Margem serviço card */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-purple-100/80 dark:border-purple-800/20 shadow-sm flex items-center justify-between hover:shadow-md transition-all duration-300 relative overflow-hidden group">
                    <div className="absolute left-0 top-0 w-1 h-full bg-purple-500"></div>
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 block">Margem Serviço</span>
                        <span className="text-xl font-bold text-purple-600 dark:text-purple-400 tracking-tight block">{calculated.margemLiquidaServico?.toFixed(2) || 0}%</span>
                    </div>
                    {!isReadOnly && (
                        <button 
                            type="button"
                            onClick={() => setModalOpen(true)} 
                            className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/60 active:scale-95 rounded-lg border border-purple-100/30 dark:border-purple-800/10 transition-all shadow-sm"
                            title="Ajustar margem líquida de serviço"
                        >
                            <CalculatorIcon className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Main Interactive Work Stage */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                
                {/* Form Input Columns */}
                <div className="lg:col-span-8 space-y-4">
                    
                    {/* Panel 1: Dados do Cliente */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4 relative overflow-hidden">
                        <h3 className="text-xs font-bold text-gray-800 dark:text-white border-b border-gray-100 dark:border-gray-700/60 pb-2 mb-4 flex items-center gap-2">
                            <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full"></span> 
                            Dados iniciais do projeto
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450 ml-1">Data do orçamento</label>
                                <input 
                                    type="date" 
                                    name="dataOrcamento" 
                                    value={formState.dataOrcamento} 
                                    onChange={handleInputChange} 
                                    disabled={isReadOnly} 
                                    className={`w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1.5 px-3 text-xs outline-none text-gray-700 dark:text-white font-semibold focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 focus:border-indigo-500 transition-all ${isReadOnly ? 'opacity-70 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`} 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450 ml-1">Nome do cliente</label>
                                <input 
                                    type="text" 
                                    name="nomeCliente" 
                                    value={formState.nomeCliente} 
                                    onChange={handleInputChange} 
                                    disabled={isReadOnly} 
                                    className={`w-full rounded-lg border py-1.5 px-3 text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none text-gray-900 dark:text-white font-semibold transition-all ${
                                        isReadOnly 
                                        ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                        : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                    }`} 
                                    placeholder="Nome completo do cliente" 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-3.5">
                            <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450 ml-1">Fornecedor do kit</label>
                                <div className="relative">
                                    <select 
                                        name="fornecedor" 
                                        value={formState.fornecedor} 
                                        onChange={handleInputChange} 
                                        disabled={isReadOnly} 
                                        className={`w-full rounded-lg border py-1.5 px-3 text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none text-gray-900 dark:text-white font-semibold transition-all appearance-none cursor-pointer ${
                                            isReadOnly 
                                            ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                            : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                        }`}
                                    >
                                        <option value="">Selecione o fornecedor...</option>
                                        {suppliers.map(sup => (
                                            <option key={sup.id} value={sup.name}>{sup.name}</option>
                                        ))}
                                    </select>
                                    {!isReadOnly && <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"><ChevronDownIcon className="w-3.5 h-3.5" /></div>}
                                </div>
                                {suppliers.length === 0 && !isReadOnly && (
                                    <p className="text-[9px] text-orange-600 font-semibold mt-1 leading-tight bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded border border-orange-100 dark:border-orange-900/30">Nenhum fornecedor cadastrado nas Configurações Gerais.</p>
                                )}
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450 ml-1">Custo do sistema (kit)</label>
                                <div className="relative flex items-center">
                                    <span className="absolute left-3 inset-y-0 flex items-center text-xs font-semibold text-gray-450 pointer-events-none select-none">R$</span>
                                    <input 
                                        type="text" 
                                        inputMode="decimal" 
                                        name="custoSistema" 
                                        value={formState.custoSistema} 
                                        onChange={handleInputChange} 
                                        disabled={isReadOnly} 
                                        className={`w-full py-1.5 pr-2 pl-8 rounded-lg border font-semibold text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none transition-all ${
                                            isReadOnly 
                                            ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                            : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                        }`} 
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450 ml-1">Mão de obra geral</label>
                                <div className="relative flex items-center">
                                    <span className="absolute left-3 inset-y-0 flex items-center text-xs font-semibold text-gray-450 pointer-events-none select-none">R$</span>
                                    <input 
                                        type="text" 
                                        inputMode="decimal" 
                                        name="maoDeObraGeral" 
                                        value={formState.maoDeObraGeral} 
                                        onChange={handleInputChange} 
                                        disabled={isReadOnly} 
                                        className={`w-full py-1.5 pr-2 pl-8 rounded-lg border font-semibold text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none transition-all ${
                                            isReadOnly 
                                            ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                            : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                        }`} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel 2: Custos de Instalação e Terceiros */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4">
                        <h3 className="text-xs font-bold text-gray-800 dark:text-white border-b border-gray-100 dark:border-gray-700/60 pb-2 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-3.5 bg-orange-500 rounded-full"></span> 
                                Serviços e custos de instalação
                            </div>
                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/30 px-2.5 py-0.5 rounded-lg border border-orange-100 dark:border-orange-850/20 shadow-sm animate-fade-in">
                                Total do quadro: {formatCurrency(calculated.totalInstalacao || 0)}
                            </span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                            {[
                                { label: "Visita técnica", name: "visitaTecnicaCusto" }, 
                                { label: "Projeto / homologação", name: "projetoHomologacaoCusto" }, 
                                { label: "Custo de viagem", name: "custoViagem" }, 
                                { label: "Adequação local", name: "adequacaoLocalCusto" }
                            ].map(field => (
                                <div key={field.name} className="space-y-1">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450 ml-1">{field.label}</label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-3 inset-y-0 flex items-center text-xs font-semibold text-gray-450 pointer-events-none select-none">R$</span>
                                        <input 
                                            type="text" 
                                            inputMode="decimal" 
                                            name={field.name} 
                                            value={(formState as any)[field.name]} 
                                            onChange={handleInputChange} 
                                            disabled={isReadOnly} 
                                            className={`w-full py-1.5 pr-2 pl-8 rounded-lg border font-semibold text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none transition-all ${
                                                isReadOnly 
                                                ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                                : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                            }`} 
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="space-y-1 sm:col-span-2 md:col-span-1">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-450">Instalação (placas)</label>
                                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                                        Subtotal: {formatCurrency(parseNumber(formState.terceiroInstalacaoQtd) * parseNumber(formState.terceiroInstalacaoCusto))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="relative w-16">
                                        <input 
                                            type="text" 
                                            inputMode="numeric" 
                                            name="terceiroInstalacaoQtd" 
                                            value={formState.terceiroInstalacaoQtd} 
                                            onChange={handleInputChange} 
                                            disabled={isReadOnly} 
                                            className={`w-full rounded-lg border font-semibold text-gray-900 dark:text-white p-1.5 text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none text-center transition-all ${
                                                isReadOnly 
                                                ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                                : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                            }`} 
                                            placeholder="Qtd" 
                                        />
                                    </div>
                                    <span className="text-gray-400 font-bold text-[10px]">x</span>
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 inset-y-0 flex items-center text-xs font-semibold text-gray-400 pointer-events-none select-none">R$</span>
                                        <input 
                                            type="text" 
                                            inputMode="decimal" 
                                            name="terceiroInstalacaoCusto" 
                                            value={formState.terceiroInstalacaoCusto} 
                                            onChange={handleInputChange} 
                                            disabled={isReadOnly} 
                                            className={`w-full py-1.5 pr-2 pl-8 rounded-lg border font-semibold text-gray-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-950/15 outline-none transition-all ${
                                                isReadOnly 
                                                ? 'bg-gray-50 dark:bg-gray-900 cursor-not-allowed border-gray-200 dark:border-gray-700' 
                                                : 'bg-amber-50/40 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/10 focus:border-amber-400'
                                            }`} 
                                            placeholder="Custo placa" 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Panel 3: Componentes e Materiais Adicionais */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700/50 overflow-hidden">
                        <div className="p-3 border-b border-gray-100 dark:border-gray-700/60 bg-gray-50/80 dark:bg-gray-900/50 flex justify-between items-center flex-wrap gap-2">
                            <h3 className="text-xs font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                <CubeIcon className="w-4 h-4 text-indigo-500" /> Materiais e componentes adicionais
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100/30 dark:border-indigo-800/30 px-2 py-0.5 rounded-lg">
                                    Total: {formatCurrency(calculated.totalEstrutura || 0)}
                                </span>
                                {!isReadOnly && (
                                    <button 
                                        type="button"
                                        onClick={() => setIsAddItemModalOpen(true)}
                                        className="flex items-center gap-1 text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 px-2.5 py-1 rounded-lg shadow-sm transition-all"
                                    >
                                        <PlusIcon className="w-3 h-3" /> Incluir item
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[11px] font-medium text-gray-450 bg-gray-50/50 dark:bg-gray-900/20 border-b border-gray-100 dark:border-gray-800">
                                        <th className="px-4 py-2">Item / descrição</th>
                                        <th className="px-4 py-2 text-center w-24">Qtd</th>
                                        <th className="px-4 py-2 text-right w-28">Custo unitário</th>
                                        <th className="px-4 py-2 text-center w-24">% Acrésc.</th>
                                        <th className="px-4 py-2 text-right w-32">Total ajustado</th>
                                        {!isReadOnly && <th className="px-3 w-10 text-center"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                                    {combinedSortedItems.map((item) => {
                                        const itemId = String(item.id);
                                        const isFromStock = item.isFromStock;
                                        const data = isFromStock ? item.itemData : item;
                                         
                                        const n_qty = parseNumber(data.qty);
                                        const n_cost = parseNumber(data.cost);
                                        const n_markup = parseNumber(data.markup);
                                        const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
                                        const totalItemValue = n_qty * effectiveUnitCost;

                                        return (
                                            <tr 
                                                key={`${isFromStock ? 'stock' : 'off'}-${itemId}`} 
                                                className={`transition-colors duration-150 ${
                                                    !isFromStock 
                                                    ? 'bg-amber-50/20 dark:bg-amber-950/5 border-l-4 border-l-amber-400 hover:bg-amber-50/30' 
                                                    : 'hover:bg-indigo-50/20 dark:hover:bg-indigo-950/5'
                                                }`}
                                            >
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1.5">
                                                        {!isFromStock ? (
                                                            <span className="text-[8px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-200/50 dark:border-amber-800/10 px-1.5 py-0.5 rounded font-bold">Externo</span>
                                                        ) : (
                                                            !item.isFixedInBudget && (
                                                                <span className="text-[8px] bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-800/10 px-1.5 py-0.5 rounded font-bold">Estoque</span>
                                                            )
                                                        )}
                                                        <span className={`font-semibold ${!isFromStock ? 'text-amber-800 dark:text-amber-200' : 'text-gray-700 dark:text-gray-200'}`}>
                                                            {item.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        value={data.qty} 
                                                        onChange={(e) => isFromStock 
                                                            ? handleStockItemDataChange(itemId, 'qty', e.target.value)
                                                            : handleOffStockItemChange(itemId, 'qty', e.target.value)
                                                        } 
                                                        disabled={isReadOnly} 
                                                        className={`w-14 text-center bg-transparent border-b outline-none py-1 text-xs font-semibold ${
                                                            !isFromStock 
                                                            ? 'border-amber-300 focus:border-amber-600 text-amber-700 dark:text-amber-400' 
                                                            : 'border-gray-200 focus:border-indigo-600 focus:ring-0 text-gray-700 dark:text-gray-200'
                                                        }`} 
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    {!isFromStock ? (
                                                        <div className="flex items-center justify-end">
                                                            <span className="text-gray-400 text-xs mr-0.5 font-semibold">R$</span>
                                                            <input 
                                                                type="text" 
                                                                inputMode="decimal"
                                                                value={data.cost} 
                                                                onChange={(e) => handleOffStockItemChange(itemId, 'cost', e.target.value)} 
                                                                disabled={isReadOnly} 
                                                                className="w-16 text-right bg-transparent border-b border-amber-300 focus:border-amber-600 outline-none py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400" 
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                                            {formatCurrency(n_cost)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <div className="flex items-center justify-center gap-0.5">
                                                        <input 
                                                            type="text" 
                                                            inputMode="decimal"
                                                            value={data.markup} 
                                                            onChange={(e) => isFromStock 
                                                                ? handleStockItemDataChange(itemId, 'markup', e.target.value)
                                                                : handleOffStockItemChange(itemId, 'markup', e.target.value)
                                                            } 
                                                            disabled={isReadOnly} 
                                                            className={`w-10 text-center bg-transparent border-b outline-none py-1 text-xs font-semibold ${
                                                                !isFromStock 
                                                                ? 'border-amber-300 focus:border-amber-600 text-amber-800 dark:text-amber-400' 
                                                                : 'border-indigo-200 focus:border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                                            }`} 
                                                        />
                                                        <span className={`text-[10px] font-bold ${!isFromStock ? 'text-amber-500' : 'text-indigo-400'}`}>%</span>
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-2 text-right font-bold text-xs ${!isFromStock ? 'text-amber-700 dark:text-amber-300' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                    {formatCurrency(totalItemValue)}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="px-3 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => isFromStock ? removeStockManualItem(itemId) : removeOffStockItem(itemId)}
                                                            className="p-1 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/25 transition-all"
                                                            title="Remover componente"
                                                        >
                                                            <TrashIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}

                                    {combinedSortedItems.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-gray-400 italic text-xs">
                                                Nenhum item adicional configurado. <br className="mb-1"/>
                                                Use o botão <strong className="text-indigo-600 dark:text-indigo-400">"Incluir item"</strong> acima para incluir materiais adicionais.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sticky Side Panel for Financial Breakdown & Saving */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="sticky top-4 space-y-4">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700/50 overflow-hidden text-xs">
                            <div className="bg-indigo-600 p-3.5 text-white flex items-center gap-2 shadow-sm">
                                <DollarIcon className="w-4 h-4 text-indigo-200" />
                                <h3 className="font-bold text-xs">Fechamento do orçamento</h3>
                            </div>
                            <div className="p-4 space-y-2.5">
                                <div className="flex justify-between items-center font-medium">
                                    <span className="text-gray-500 dark:text-gray-400">Total equipamentos</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-100">{formatCurrency(calculated.valorVendaSistema)}</span>
                                </div>
                                <div className="flex justify-between items-center font-medium">
                                    <span className="text-gray-500 dark:text-gray-400">Total mão de obra</span>
                                    <span className="font-bold text-gray-800 dark:text-gray-100">{formatCurrency(calculated.custoMO)}</span>
                                </div>
                                <div className="border-t border-gray-100 dark:border-gray-700/60 pt-3 flex justify-between items-center bg-indigo-50/20 dark:bg-indigo-950/10 px-3 py-1.5 rounded-lg border border-indigo-100/10">
                                    <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300">Preço final</span>
                                    <span className="text-lg font-bold text-indigo-700 dark:text-indigo-400 tracking-tight">{formatCurrency(calculated.precoVendaFinal)}</span>
                                </div>
                            </div>
                            
                            {/* Impostos, Comissoes e Outras variaveis */}
                            <div className="bg-gray-55/40 dark:bg-gray-900/40 p-4 border-t border-gray-100 dark:border-gray-700/60 space-y-3">
                                <h4 className="text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-2">Deduções, taxas e descontos</h4>
                                
                                <div className="flex items-center justify-between gap-3">
                                    <label className="font-medium text-gray-500 dark:text-gray-400">Imposto serviço (%)</label>
                                    <div className="flex items-center gap-1.5">
                                        <input 
                                            type="text" 
                                            inputMode="decimal" 
                                            name="nfServicoPerc" 
                                            value={formState.nfServicoPerc} 
                                            onChange={handleInputChange} 
                                            disabled={isReadOnly} 
                                            className={`w-12 text-center rounded-lg border border-gray-200 dark:border-gray-700 p-1 text-xs font-semibold ${isReadOnly ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-850 dark:bg-gray-800 dark:text-white focus:border-indigo-500 outline-none'}`} 
                                        />
                                        <span className="text-xs font-semibold text-gray-500 w-20 text-right">{formatCurrency(calculated.nfServicoValor)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <label className="font-medium text-gray-500 dark:text-gray-400">Comissão de venda</label>
                                    <div className="flex items-center gap-1.5">
                                        <select 
                                            name="comissaoVendasOpcao" 
                                            value={formState.comissaoVendasOpcao} 
                                            onChange={handleInputChange} 
                                            disabled={isReadOnly} 
                                            className={`rounded-lg border border-gray-200 dark:border-gray-700 p-1 text-xs font-semibold ${isReadOnly ? 'bg-gray-100' : 'bg-white dark:bg-gray-800'}`}
                                        >
                                            <option value="Não">Não</option>
                                            <option value="Sim">Sim</option>
                                        </select>
                                        {formState.comissaoVendasOpcao === 'Sim' && (
                                            <input 
                                                type="text" 
                                                inputMode="decimal" 
                                                name="comissaoVendasPerc" 
                                                value={formState.comissaoVendasPerc} 
                                                onChange={handleInputChange} 
                                                disabled={isReadOnly} 
                                                className={`w-8 text-center rounded-lg border border-gray-200 dark:border-gray-700 p-1 text-xs font-semibold ${isReadOnly ? 'bg-gray-100' : 'bg-white text-gray-850 dark:bg-gray-800 dark:text-white focus:border-indigo-500 outline-none'}`} 
                                            />
                                        )}
                                        <span className="text-xs font-semibold text-gray-500 w-20 text-right">{formatCurrency(calculated.comissaoVendasValor)}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3">
                                    <label className="font-medium text-gray-550 dark:text-gray-400 text-red-500/90">Desconto geral (%)</label>
                                    <div className="flex items-center gap-1.5">
                                        <input 
                                            type="text" 
                                            inputMode="decimal" 
                                            name="descontoAplicadoPerc" 
                                            value={formState.descontoAplicadoPerc} 
                                            onChange={handleInputChange} 
                                            disabled={isReadOnly} 
                                            className={`w-12 text-center rounded-lg border border-gray-200 dark:border-gray-700 p-1 text-xs font-semibold ${isReadOnly ? 'bg-gray-100' : 'bg-white text-gray-850 dark:bg-gray-800 dark:text-white focus:border-indigo-500 outline-none'}`} 
                                        />
                                        <span className="text-xs font-bold text-red-500 dark:text-red-400 w-20 text-right">-{formatCurrency(calculated.descontoAplicadoValor)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Real Liquid Profit display */}
                            <div className="bg-emerald-500/10 dark:bg-emerald-950/20 p-4 border-t border-emerald-100 dark:border-emerald-900/30 text-center">
                                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mb-0.5">Lucro líquido real estimado</p>
                                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300 tracking-tight">{formatCurrency(calculated.lucroLiquido)}</p>
                            </div>
                        </div>

                        {!isReadOnly && (
                            <button 
                                onClick={handleSaveTrigger} 
                                disabled={isSaving}
                                className={`w-full flex items-center justify-center gap-1.5 py-2.5 ${isSaving ? 'bg-gray-400 grayscale cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/15 hover:shadow-md'} text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/10`}
                            >
                                <SaveIcon className="w-4 h-4" /> 
                                <span>{isSaving ? 'Salvando...' : (orcamentoToEdit ? 'Atualizar orçamento' : 'Gravar e salvar projeto')}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {isAddItemModalOpen && (
                <Modal title="Adicionar componente" onClose={() => setIsAddItemModalOpen(false)} maxWidth="max-w-lg">
                    <div className="space-y-4">
                        <div className="flex bg-gray-100 dark:bg-gray-700/50 p-1 rounded-xl mb-4 border border-gray-200 dark:border-gray-600">
                            <button 
                                onClick={() => setAddItemTab('estoque')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addItemTab === 'estoque' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                Do estoque
                            </button>
                            <button 
                                onClick={() => setAddItemTab('manual')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addItemTab === 'manual' ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-sm border border-gray-100' : 'text-gray-500 dark:text-gray-400'}`}
                            >
                                Fora do estoque
                            </button>
                        </div>

                        {addItemTab === 'estoque' ? (
                            <div className="animate-fade-in">
                                <p className="text-xs text-gray-500 mb-4 font-medium">Produtos cadastrados no catálogo orner</p>
                                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {availableStockToAdd.length > 0 ? availableStockToAdd.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => addStockManualItem(String(item.id))}
                                            className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/40 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-gray-100 dark:border-gray-700 rounded-xl transition-all group"
                                        >
                                            <div className="text-left">
                                                <p className="text-xs font-bold text-gray-800 dark:text-gray-100 group-hover:text-indigo-700">{item.name}</p>
                                                <p className="text-[10px] text-gray-500 font-semibold">Custo médio: {formatCurrency(item.averagePrice || 0)}</p>
                                            </div>
                                            <PlusIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600" />
                                        </button>
                                    )) : (
                                        <div className="text-center py-10 opacity-50">
                                            <CubeIcon className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                                            <p className="text-xs font-bold text-gray-400">Nenhum item adicional disponível no estoque.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleAddOffStockItem} className="space-y-5 animate-fade-in">
                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-dashed border-amber-200 dark:border-amber-800">
                                    <p className="text-xs text-amber-700 dark:text-amber-300 font-bold mb-4">Novo item externo</p>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Descrição do item</label>
                                            <input 
                                                required 
                                                autoFocus
                                                type="text" 
                                                value={manualItemForm.name}
                                                onChange={e => setManualItemForm({...manualItemForm, name: e.target.value})}
                                                className="w-full rounded-xl border-transparent bg-white dark:bg-gray-800 p-3 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-amber-500/20 shadow-sm"
                                                placeholder="Ex: Curva de ferro galvanizado"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Custo unitário base (R$)</label>
                                            <input 
                                                required 
                                                type="text" 
                                                inputMode="decimal"
                                                value={manualItemForm.cost || ''}
                                                onChange={e => setManualItemForm({...manualItemForm, cost: parseNumber(e.target.value)})}
                                                className="w-full rounded-xl border-transparent bg-white dark:bg-gray-800 p-3 text-sm font-semibold text-amber-600 dark:text-amber-400 outline-none focus:ring-2 focus:ring-amber-500/20 shadow-sm"
                                                placeholder="0,00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <button 
                                        type="button" 
                                        onClick={() => setIsAddItemModalOpen(false)} 
                                        className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl font-bold text-xs"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-amber-600/20 hover:bg-amber-700"
                                    >
                                        Incluir componente
                                    </button>
                                </div>
                            </form>
                        )}

                        {addItemTab === 'estoque' && (
                            <div className="pt-4 border-t flex justify-end">
                                <button onClick={() => setIsAddItemModalOpen(false)} className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700">Fechar</button>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {isPriceCalcModalOpen && (
                <Modal title="Ajustar preço de venda alvo" onClose={() => setPriceCalcModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                             <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                <DollarIcon className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white">Cálculo reverso</p>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-indigo-400 tracking-tight leading-tight">O sistema ajustará a "Mão de obra geral" para que o valor final seja o desejado.</p>
                             </div>
                        </div>

                        <div className="text-center space-y-4">
                            <label htmlFor="desiredPrice" className="block text-xs font-black text-gray-400 uppercase tracking-widest">Preço final desejado</label>
                            
                            <div className="relative inline-block">
                                <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">R$</span>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    id="desiredPrice" 
                                    autoFocus
                                    value={desiredPrice} 
                                    onChange={(e) => setDesiredPrice(e.target.value)} 
                                    className="w-52 text-center text-3xl font-black text-indigo-600 dark:text-indigo-400 bg-transparent border-b-4 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500 outline-none py-2 transition-all" 
                                    placeholder="0,00" 
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={handlePriceCalculation} 
                                disabled={!desiredPrice || parseNumber(desiredPrice) <= 0}
                                className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                Aplicar novo preço
                            </button>
                            <button 
                                onClick={() => setPriceCalcModalOpen(false)} 
                                className="w-full py-3 text-gray-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-widest hover:text-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isModalOpen && (
                <Modal title="Ajustar margem de serviço" onClose={() => setModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                             <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                                <CalculatorIcon className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white">Ajuste inteligente</p>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-indigo-400 tracking-tight leading-tight">O sistema recalculará a "Mão de obra geral" para atingir seu objetivo.</p>
                             </div>
                        </div>

                        <div className="text-center space-y-4">
                            <label htmlFor="desiredMargin" className="block text-xs font-black text-gray-400 tracking-widest">Margem líquida alvo</label>
                            
                            <div className="relative inline-block">
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    id="desiredMargin" 
                                    autoFocus
                                    value={desiredMargin} 
                                    onChange={(e) => setDesiredMargin(e.target.value)} 
                                    className="w-40 text-center text-4xl font-black text-indigo-600 dark:text-indigo-400 bg-transparent border-b-4 border-indigo-200 dark:border-indigo-800 focus:border-indigo-500 outline-none py-2 transition-all" 
                                    placeholder="0" 
                                />
                                <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">%</span>
                            </div>

                            <div className="flex justify-center gap-2 mt-4">
                                {[15, 20, 25, 30].map(val => (
                                    <button 
                                        key={val}
                                        type="button"
                                        onClick={() => setDesiredMargin(val.toString())}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${desiredMargin === val.toString() ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        {val}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={handleMarginCalculation} 
                                disabled={!desiredMargin || parseNumber(desiredMargin) <= 0}
                                className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                Aplicar novo cálculo
                            </button>
                            <button 
                                onClick={() => setModalOpen(false)} 
                                className="w-full py-3 text-gray-400 dark:text-gray-500 font-bold text-[10px] tracking-widest hover:text-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isNetProfitCalcModalOpen && (
                <Modal title="Ajustar lucro líquido alvo" onClose={() => setNetProfitCalcModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4 p-4 bg-green-50 dark:bg-green-900/30 rounded-2xl border border-green-100 dark:border-green-800">
                             <div className="w-12 h-12 bg-green-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-green-600/20">
                                <DollarIcon className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white">Lucro líquido reverso</p>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-green-400 tracking-tight leading-tight">O sistema recalculará a "Mão de obra geral" para obter o lucro líquido estimado desejado.</p>
                             </div>
                        </div>

                        <div className="text-center space-y-4">
                            <label htmlFor="desiredNetProfit" className="block text-xs font-black text-gray-400 tracking-widest">Lucro Líquido Desejado</label>
                            
                            <div className="relative inline-block">
                                <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">R$</span>
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    id="desiredNetProfit" 
                                    autoFocus
                                    value={desiredNetProfit || ''} 
                                    onChange={(e) => setDesiredNetProfit(e.target.value)} 
                                    className="w-52 text-center text-3xl font-black text-green-600 dark:text-green-400 bg-transparent border-b-4 border-green-200 dark:border-green-800 focus:border-green-500 outline-none py-2 transition-all" 
                                    placeholder="0,00" 
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={handleNetProfitCalculation} 
                                disabled={!desiredNetProfit || parseNumber(desiredNetProfit) <= 0}
                                className="w-full py-3.5 bg-green-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-green-600/30 hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                Aplicar novo lucro líquido
                            </button>
                            <button 
                                onClick={() => setNetProfitCalcModalOpen(false)} 
                                className="w-full py-3 text-gray-400 dark:text-gray-500 font-bold text-[10px] tracking-widest hover:text-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isNetMarginCalcModalOpen && (
                <Modal title="Ajustar margem líquida alvo" onClose={() => setNetMarginCalcModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl border border-blue-100 dark:border-blue-800">
                             <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-600/20">
                                <CalculatorIcon className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-white font-sans">Margem líquida reversa</p>
                                <p className="text-[10px] font-bold text-gray-500 dark:text-blue-400 tracking-tight leading-tight">O sistema recalculará a "Mão de obra geral" para atingir a margem líquida sobre o preço final.</p>
                             </div>
                        </div>

                        <div className="text-center space-y-4">
                            <label htmlFor="desiredNetMargin" className="block text-xs font-black text-gray-400 tracking-widest">Margem Líquida Alvo</label>
                            
                            <div className="relative inline-block">
                                <input 
                                    type="text" 
                                    inputMode="decimal"
                                    id="desiredNetMargin" 
                                    autoFocus
                                    value={desiredNetMargin || ''} 
                                    onChange={(e) => setDesiredNetMargin(e.target.value)} 
                                    className="w-40 text-center text-4xl font-black text-blue-600 dark:text-blue-400 bg-transparent border-b-4 border-blue-200 dark:border-blue-800 focus:border-blue-500 outline-none py-2 transition-all" 
                                    placeholder="0" 
                                />
                                <span className="absolute -right-8 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">%</span>
                            </div>

                            <div className="flex justify-center gap-2 mt-4">
                                {[5, 10, 15, 20].map(val => (
                                    <button 
                                        key={val}
                                        type="button"
                                        onClick={() => setDesiredNetMargin(val.toString())}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${desiredNetMargin === val.toString() ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200'}`}
                                    >
                                        {val}%
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                onClick={handleNetMarginCalculation} 
                                disabled={!desiredNetMargin || parseNumber(desiredNetMargin) <= 0}
                                className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-blue-600/30 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                            >
                                Aplicar nova margem líquida
                            </button>
                            <button 
                                onClick={() => setNetMarginCalcModalOpen(false)} 
                                className="w-full py-3 text-gray-400 dark:text-gray-500 font-bold text-[10px] tracking-widest hover:text-gray-600"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {isRenameModalOpen && (<Modal title="Renomear opção" onClose={() => setRenameModalOpen(false)}><div className="space-y-4"><label htmlFor="variantName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome da opção</label><input type="text" id="variantName" value={tempVariantName} onChange={(e) => setTempVariantName(e.target.value)} className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-gray-50 p-2" /><div className="flex justify-end pt-4 gap-2"><button type="button" onClick={() => setRenameModalOpen(false)} className="px-4 py-2 bg-gray-200 rounded-md text-gray-700 hover:bg-gray-300">Cancelar</button><button onClick={finishRename} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">Salvar</button></div></div></Modal>)}
            {isSaveModalOpen && (<Modal title={orcamentoToEdit ? "Atualizar projeto" : "Salvar projeto"} onClose={() => setSaveModalOpen(false)}><div className="space-y-6"><div className="text-center"><div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4"><SaveIcon className="w-6 h-6 text-green-600" /></div><h3 className="text-lg font-medium text-gray-900 dark:text-white">{orcamentoToEdit ? "Deseja atualizar o projeto?" : "Deseja salvar o projeto?"}</h3></div><div className="flex justify-center gap-4"><button onClick={() => setSaveModalOpen(false)} className="px-6 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 font-medium transition-colors w-24">Não</button><button onClick={executeSave} disabled={isSaving} className={`px-6 py-2 ${isSaving ? 'bg-gray-400' : 'bg-green-600'} text-white rounded-md hover:bg-green-700 font-medium transition-colors w-24`}>{isSaving ? '...' : 'Sim'}</button></div></div></Modal>)}
        </div>
    );
};

export default NovoOrcamentoPage;
