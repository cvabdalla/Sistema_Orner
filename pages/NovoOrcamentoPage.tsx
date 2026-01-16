import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../components/Modal';
import { CalculatorIcon, SaveIcon, AddIcon, TrashIcon, EditIcon, CheckCircleIcon, DollarIcon, CubeIcon, ArrowLeftIcon, PlusIcon, XCircleIcon, TrendUpIcon } from '../assets/icons';
import type { NovoOrcamentoPageProps, OrcamentoVariant, SavedOrcamento, StockItem } from '../types';
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
    const [isRenameModalOpen, setRenameModalOpen] = useState(false);
    const [tempVariantName, setTempVariantName] = useState('');
    const [isSaveModalOpen, setSaveModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
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
        const loadStockAndConfigs = async () => {
            const [items, remoteConfigs] = await Promise.all([
                dataService.getAll<StockItem>('stock_items'),
                dataService.getAll<any>('system_configs', undefined, true)
            ]);
            
            setAllStockItems(items);
            
            // Tenta obter o custo de instalação global do banco de dados
            const remoteInst = remoteConfigs.find(c => c.id === 'installation_value');
            const finalInstCost = remoteInst ? parseFloat(remoteInst.value) : 120;

            if (!orcamentoToEdit) {
                const initialFixedData: Record<string, any> = {};
                items.filter(i => i.isFixedInBudget).forEach(i => {
                    initialFixedData[String(i.id)] = { qty: 0, cost: i.averagePrice || 0, markup: 0 };
                });
                const newState = { 
                    ...initialFormState, 
                    terceiroInstalacaoCusto: finalInstCost,
                    fixedItemsData: initialFixedData 
                };
                setFormState(newState);
                setVariants([{ id: '1', name: 'Opção 1', isPrincipal: true, formState: newState, calculated: {} }]);
            } else if (formState.terceiroInstalacaoCusto === 120 && !isReadOnly) {
                // Se for edição de orçamento aberto e o custo ainda é o padrão hardcoded, atualiza para o global
                setFormState(prev => ({ ...prev, terceiroInstalacaoCusto: finalInstCost }));
            }
        }
        loadStockAndConfigs();
    }, [orcamentoToEdit]);

    const selectedStockTableItems = useMemo(() => {
        const currentDataIds = Object.keys(formState.fixedItemsData || {});
        return allStockItems.filter(i => currentDataIds.includes(String(i.id)));
    }, [allStockItems, formState.fixedItemsData]);

    const availableStockToAdd = useMemo(() => {
        const currentDataIds = Object.keys(formState.fixedItemsData || {});
        return allStockItems.filter(i => !currentDataIds.includes(String(i.id)));
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
        const updatedOffStockItems = (formState.offStockItems || []).map(item => {
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
        const updatedOffStockItems = (formState.offStockItems || []).filter(i => i.id !== id);
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

        const totalStockStructure = selectedStockTableItems.reduce((acc, item) => {
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

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc, item) => {
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
        
        const totalStockStructure = selectedStockTableItems.reduce((acc, item) => {
            const data = (formState.fixedItemsData || {})[String(item.id)] || { qty: 0, cost: item.averagePrice || 0, markup: 0 };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc, item) => {
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
        
        const totalStockStructure = selectedStockTableItems.reduce((acc, item) => {
            const data = (formState.fixedItemsData || {})[String(item.id)] || { qty: 0, cost: item.averagePrice || 0, markup: 0 };
            const n_qty = parseNumber(data.qty);
            const n_cost = parseNumber(data.cost);
            const n_markup = parseNumber(data.markup);
            const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
            return acc + (n_qty * effectiveUnitCost);
        }, 0);

        const totalOffStockStructure = (formState.offStockItems || []).reduce((acc, item) => {
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
        const newVariant: OrcamentoVariant = {
            id: newId,
            name: `Opção ${variants.length + 1}`,
            isPrincipal: false,
            formState: { ...activeVariant.formState },
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
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {variants.map(variant => (
                        <div key={variant.id} onClick={() => setActiveVariantId(variant.id)} className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all border text-sm font-medium ${activeVariantId === variant.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                            {variant.isPrincipal && <svg className={`w-3.5 h-3.5 ${activeVariantId === variant.id ? 'text-yellow-300' : 'text-yellow-500'} fill-current`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>}
                            <span className="select-none">{variant.name}</span>
                            {activeVariantId === variant.id && !isReadOnly && (
                                 <div className="flex items-center ml-2 pl-2 border-l border-white/30 space-x-1">
                                    <button type="button" onClick={startRename} className="p-0.5 hover:bg-white/20 rounded"><EditIcon className="w-3 h-3" /></button>
                                    {!variant.isPrincipal && <button type="button" onClick={(e) => setPrincipal(variant.id, e)} className="p-0.5 hover:bg-white/20 rounded"><CheckCircleIcon className="w-3 h-3" /></button>}
                                    <button type="button" onClick={(e) => removeVariant(variant.id, e)} className="p-0.5 hover:bg-red-500/80 rounded"><TrashIcon className="w-3 h-3" /></button>
                                 </div>
                            )}
                        </div>
                    ))}
                    {!isReadOnly && <button type="button" onClick={addNewVariant} className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors text-gray-600 dark:text-gray-300" title="Nova opção"><AddIcon className="w-4 h-4" /></button>}
                </div>
                {isReadOnly && (
                    <button 
                        onClick={() => setCurrentPage('ORCAMENTO')} 
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold shadow-lg transition-all"
                    >
                        <ArrowLeftIcon className="w-5 h-5" /> Voltar para lista
                    </button>
                )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-xl p-4 text-white shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium opacity-80 tracking-wide">Preço venda final</p>
                        <p className="text-2xl font-bold">{formatCurrency(calculated.precoVendaFinal || 0)}</p>
                    </div>
                    {!isReadOnly && (
                        <button 
                            onClick={() => setPriceCalcModalOpen(true)} 
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                            title="Calculadora de preço alvo"
                        >
                            <CalculatorIcon className="w-5 h-5" />
                        </button>
                    )}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm"><p className="text-xs font-medium text-gray-500 tracking-wide">Lucro líquido</p><p className="text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(calculated.lucroLiquido || 0)}</p></div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm"><p className="text-xs font-medium text-gray-500 tracking-wide">Margem líquida</p><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{calculated.margemLiquida?.toFixed(2) || 0}%</p></div>
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between"><div><p className="text-xs font-medium text-gray-500 tracking-wide">Margem serviço</p><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{calculated.margemLiquidaServico?.toFixed(2) || 0}%</p></div>{!isReadOnly && <button onClick={() => setModalOpen(true)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-colors"><CalculatorIcon className="w-5 h-5" /></button>}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide border-b border-gray-100 dark:border-gray-700 pb-3 mb-4 flex items-center gap-2"><span className="w-1 h-4 bg-indigo-500 rounded-full"></span> Dados iniciais</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Data do orçamento</label><input type="date" name="dataOrcamento" value={formState.dataOrcamento} onChange={handleInputChange} disabled={isReadOnly} className={`w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-2.5 text-sm outline-none text-gray-700 dark:text-white font-bold focus:ring-2 focus:ring-indigo-500 transition-all ${isReadOnly ? 'opacity-70 cursor-not-allowed' : ''}`} /></div>
                            <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nome do cliente</label><input type="text" name="nomeCliente" value={formState.nomeCliente} onChange={handleInputChange} disabled={isReadOnly} className={`w-full rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-yellow-100 dark:bg-yellow-900/30'} p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white font-bold transition-all`} placeholder="Ex: João Silva" /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                            <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fornecedor do kit</label><input type="text" name="fornecedor" value={formState.fornecedor} onChange={handleInputChange} disabled={isReadOnly} className={`w-full rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-indigo-50 dark:bg-indigo-900/30'} p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 dark:text-white font-bold transition-all`} placeholder="Ex: Aldo Solar" /></div>
                            <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Custo do sistema (kit)</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span><input type="text" inputMode="decimal" name="custoSistema" value={formState.custoSistema} onChange={handleInputChange} disabled={isReadOnly} className={`w-full pl-8 rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-yellow-100 dark:bg-yellow-900/30'} font-bold text-gray-900 dark:text-white p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none`} /></div></div>
                            <div><label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mão de obra geral</label><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span><input type="text" inputMode="decimal" name="maoDeObraGeral" value={formState.maoDeObraGeral} onChange={handleInputChange} disabled={isReadOnly} className={`w-full pl-8 rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-yellow-100 dark:bg-yellow-900/30'} font-bold text-gray-900 dark:text-white p-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none`} /></div></div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide border-b border-gray-100 dark:border-gray-700 pb-3 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="w-1 h-4 bg-orange-500 rounded-full"></span> 
                                Custos de instalação e terceiros
                            </div>
                            <span className="text-[10px] font-black text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2.5 py-1 rounded-lg border border-orange-100 dark:border-orange-900 shadow-sm">
                                Total do quadro: {formatCurrency(calculated.totalInstalacao || 0)}
                            </span>
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[
                                { label: "Visita técnica", name: "visitaTecnicaCusto" }, 
                                { label: "Projeto / homologação", name: "projetoHomologacaoCusto" }, 
                                { label: "Custo de viagem", name: "custoViagem" }, 
                                { label: "Adequacao local", name: "adequacaoLocalCusto" }
                            ].map(field => (
                                <div key={field.name}>
                                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{field.label}</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">R$</span>
                                        <input type="text" inputMode="decimal" name={field.name} value={(formState as any)[field.name]} onChange={handleInputChange} disabled={isReadOnly} className={`w-full pl-8 rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-yellow-100 dark:bg-yellow-900/30'} font-bold text-gray-900 dark:text-white p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none`} />
                                    </div>
                                </div>
                            ))}
                            <div>
                                <div className="flex justify-between items-center mb-1"><label className="block text-xs font-medium text-gray-500 dark:text-gray-400">Instalação - placas</label><span className="text-[10px] font-bold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">Subtotal: {formatCurrency(parseNumber(formState.terceiroInstalacaoQtd) * parseNumber(formState.terceiroInstalacaoCusto))}</span></div>
                                <div className="flex items-center gap-2"><div className="relative w-20"><input type="text" inputMode="numeric" name="terceiroInstalacaoQtd" value={formState.terceiroInstalacaoQtd} onChange={handleInputChange} disabled={isReadOnly} className={`w-full rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-yellow-100 dark:bg-yellow-900/30'} font-bold text-gray-900 dark:text-white p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-center`} placeholder="Qtd" /></div><span className="text-gray-400 text-xs">x</span><div className="relative flex-1"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-bold">R$</span><input type="text" inputMode="decimal" name="terceiroInstalacaoCusto" value={formState.terceiroInstalacaoCusto} onChange={handleInputChange} disabled={isReadOnly} className={`w-full pl-8 rounded-lg border-gray-300 dark:border-gray-600 ${isReadOnly ? 'bg-gray-50 cursor-not-allowed' : 'bg-yellow-100 dark:bg-yellow-900/30'} font-bold text-gray-900 dark:text-white p-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none`} placeholder="Unitário" /></div></div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
                                <CubeIcon className="w-4 h-4 text-indigo-500" /> Materiais e estrutura
                            </h3>
                            <div className="flex items-center gap-4">
                                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">Total: {formatCurrency(calculated.totalEstrutura || 0)}</span>
                                {!isReadOnly && (
                                    <button 
                                        type="button"
                                        onClick={() => setIsAddItemModalOpen(true)}
                                        className="flex items-center gap-2 text-[10px] font-black bg-indigo-600 text-white px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-700 transition-all"
                                    >
                                        <PlusIcon className="w-3.5 h-3.5" /> Adicionar item
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-700 dark:text-gray-400">
                                    <tr>
                                        <th className="px-6 py-3">Item / descrição</th>
                                        <th className="px-6 py-3 text-center w-24">Qtd</th>
                                        <th className="px-6 py-3 text-right w-28">Custo unit.</th>
                                        <th className="px-6 py-3 text-center w-24">% Acrésc.</th>
                                        <th className="px-6 py-3 text-right w-32">Total</th>
                                        {!isReadOnly && <th className="px-4 w-10"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {selectedStockTableItems.map((item) => {
                                        const itemId = String(item.id);
                                        const isManualStock = !item.isFixedInBudget;
                                        const data = (formState.fixedItemsData || {})[itemId] || { 
                                            qty: 0, 
                                            cost: item.averagePrice || 0,
                                            markup: 0 
                                        };
                                        const n_qty = parseNumber(data.qty);
                                        const n_cost = parseNumber(data.cost);
                                        const n_markup = parseNumber(data.markup);
                                        const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
                                        const totalItemValue = n_qty * effectiveUnitCost;

                                        return (
                                            <tr key={`stock-${itemId}`} className="hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors">
                                                <td className={`px-6 py-2 font-bold ${isManualStock ? 'text-indigo-600' : 'text-gray-700 dark:text-gray-200'}`}>
                                                    <div className="flex items-center gap-2">
                                                        {isManualStock && <span className="text-[9px] bg-indigo-100 px-1.5 py-0.5 rounded font-black">Manual</span>}
                                                        {item.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2">
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        value={data.qty} 
                                                        onChange={(e) => handleStockItemDataChange(itemId, 'qty', e.target.value)} 
                                                        disabled={isReadOnly} 
                                                        className="w-full text-center bg-transparent border-b border-gray-300 focus:border-indigo-600 outline-none py-1 font-semibold" 
                                                    />
                                                </td>
                                                <td className="px-6 py-2 text-right text-gray-500 font-medium">
                                                    {formatCurrency(n_cost)}
                                                </td>
                                                <td className="px-6 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input 
                                                            type="text" 
                                                            inputMode="decimal"
                                                            value={data.markup} 
                                                            onChange={(e) => handleStockItemDataChange(itemId, 'markup', e.target.value)} 
                                                            disabled={isReadOnly} 
                                                            className="w-12 text-center bg-transparent border-b border-indigo-300 focus:border-indigo-600 outline-none py-1 font-bold text-indigo-600" 
                                                        />
                                                        <span className="text-[10px] font-bold text-indigo-400">%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2 text-right font-bold text-indigo-600 dark:text-indigo-400">
                                                    {formatCurrency(totalItemValue)}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="px-4 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => removeStockManualItem(itemId)}
                                                            className="text-red-400 hover:text-red-600 transition-colors"
                                                            title="Remover item"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}

                                    {(formState.offStockItems || []).map((item) => {
                                        const n_qty = parseNumber(item.qty);
                                        const n_cost = parseNumber(item.cost);
                                        const n_markup = parseNumber(item.markup);
                                        const effectiveUnitCost = n_cost * (1 + (n_markup / 100));
                                        const totalItemValue = n_qty * effectiveUnitCost;

                                        return (
                                            <tr key={item.id} className="bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100/50 transition-colors border-l-4 border-l-amber-400">
                                                <td className="px-6 py-2 font-bold text-amber-800 dark:text-amber-200">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded font-black">Externo</span>
                                                        {item.name}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2">
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        value={item.qty} 
                                                        onChange={(e) => handleOffStockItemChange(item.id, 'qty', e.target.value)} 
                                                        disabled={isReadOnly} 
                                                        className="w-full text-center bg-transparent border-b border-amber-300 focus:border-amber-600 outline-none py-1 font-semibold" 
                                                    />
                                                </td>
                                                <td className="px-6 py-2 text-right text-amber-600 font-medium">
                                                    <input 
                                                        type="text" 
                                                        inputMode="decimal"
                                                        value={item.cost} 
                                                        onChange={(e) => handleOffStockItemChange(item.id, 'cost', e.target.value)} 
                                                        disabled={isReadOnly} 
                                                        className="w-full text-right bg-transparent border-none focus:ring-0 p-1 text-[10px]" 
                                                    />
                                                </td>
                                                <td className="px-6 py-2">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <input 
                                                            type="text" 
                                                            inputMode="decimal"
                                                            value={item.markup} 
                                                            onChange={(e) => handleOffStockItemChange(item.id, 'markup', e.target.value)} 
                                                            disabled={isReadOnly} 
                                                            className="w-12 text-center bg-transparent border-b border-amber-300 focus:border-amber-600 outline-none py-1 font-bold text-amber-700" 
                                                        />
                                                        <span className="text-[10px] font-bold text-amber-500">%</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-2 text-right font-bold text-amber-700 dark:text-amber-300">
                                                    {formatCurrency(totalItemValue)}
                                                </td>
                                                {!isReadOnly && (
                                                    <td className="px-4 text-center">
                                                        <button 
                                                            type="button"
                                                            onClick={() => removeOffStockItem(item.id)}
                                                            className="text-red-400 hover:text-red-600 transition-colors"
                                                            title="Remover item externo"
                                                        >
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}

                                    {(selectedStockTableItems.length === 0 && (formState.offStockItems || []).length === 0) && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400 italic text-xs">
                                                Nenhum item configurado. <br/>
                                                Use o botão "Adicionar item" acima para incluir componentes.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <div className="sticky top-6 space-y-6">
                        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-indigo-100 dark:border-gray-700 overflow-hidden">
                            <div className="bg-indigo-600 p-4 text-white"><h3 className="font-bold flex items-center gap-2"><DollarIcon className="w-5 h-5" /> Fechamento financeiro</h3></div>
                            <div className="p-6 space-y-4">
                                <div className="flex justify-between items-center text-sm"><span className="text-gray-500 dark:text-gray-400">Custo do sistema</span><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculated.valorVendaSistema)}</span></div>
                                <div className="flex justify-between items-center text-sm"><span className="text-gray-500 dark:text-gray-400">Custo mão de obra total</span><span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculated.custoMO)}</span></div>
                                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between items-center"><span className="text-lg font-bold text-gray-800 dark:text-white">Preço venda</span><span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(calculated.precoVendaFinal)}</span></div>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-6 border-t border-gray-200 dark:border-gray-700 space-y-4">
                                <h4 className="text-xs font-bold text-gray-500 tracking-wide mb-3">Impostos e comissões</h4>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-600 dark:text-gray-400">nf serviço (%)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" inputMode="decimal" name="nfServicoPerc" value={formState.nfServicoPerc} onChange={handleInputChange} disabled={isReadOnly} className={`w-16 text-right rounded border-gray-300 p-1 text-sm ${isReadOnly ? 'bg-gray-100' : 'bg-white'}`} />
                                        <span className="text-sm font-medium w-20 text-right">{formatCurrency(calculated.nfServicoValor)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Comissão venda</label>
                                    <div className="flex items-center gap-2">
                                        <select name="comissaoVendasOpcao" value={formState.comissaoVendasOpcao} onChange={handleInputChange} disabled={isReadOnly} className={`rounded border-gray-300 p-1 text-xs ${isReadOnly ? 'bg-gray-100' : 'bg-white'}`}>
                                            <option value="Não">Não</option>
                                            <option value="Sim">Sim</option>
                                        </select>
                                        {formState.comissaoVendasOpcao === 'Sim' && <input type="text" inputMode="decimal" name="comissaoVendasPerc" value={formState.comissaoVendasPerc} onChange={handleInputChange} disabled={isReadOnly} className={`w-12 text-right rounded border-gray-300 p-1 text-sm ${isReadOnly ? 'bg-gray-100' : 'bg-white'}`} />}
                                        <span className="text-sm font-medium w-20 text-right">{formatCurrency(calculated.comissaoVendasValor)}</span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label className="text-sm text-gray-600 dark:text-gray-400">Desconto (%)</label>
                                    <div className="flex items-center gap-2">
                                        <input type="text" inputMode="decimal" name="descontoAplicadoPerc" value={formState.descontoAplicadoPerc} onChange={handleInputChange} disabled={isReadOnly} className={`w-16 text-right rounded border-gray-300 p-1 text-sm ${isReadOnly ? 'bg-gray-100' : 'bg-white'}`} />
                                        <span className="text-sm font-medium w-20 text-right text-red-500">-{formatCurrency(calculated.descontoAplicadoValor)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-4 border-t border-green-100 dark:border-green-800 text-center"><p className="text-xs text-green-600 dark:text-green-400 font-bold tracking-wide mb-1">Lucro líquido real</p><p className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(calculated.lucroLiquido)}</p></div>
                        </div>

                        {!isReadOnly && (
                            <button 
                                onClick={handleSaveTrigger} 
                                disabled={isSaving}
                                className={`w-full flex items-center justify-center gap-3 py-4 ${isSaving ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'} text-white rounded-2xl font-black text-sm shadow-xl shadow-green-600/20 transition-all active:scale-95`}
                            >
                                <SaveIcon className="w-6 h-6" /> {isSaving ? 'Salvando...' : (orcamentoToEdit ? 'Atualizar orçamento' : 'Finalizar e salvar projeto')}
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
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addItemTab === 'estoque' ? 'bg-white dark:bg-gray-800 text-indigo-600 shadow-sm border border-gray-100' : 'text-gray-500'}`}
                            >
                                Do estoque
                            </button>
                            <button 
                                onClick={() => setAddItemTab('manual')}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${addItemTab === 'manual' ? 'bg-white dark:bg-gray-800 text-amber-600 shadow-sm border border-gray-100' : 'text-gray-500'}`}
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
                            <label htmlFor="desiredMargin" className="block text-xs font-black text-gray-400 uppercase tracking-widest">Margem líquida alvo</label>
                            
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
                                className="w-full py-3 text-gray-400 dark:text-gray-500 font-bold text-[10px] uppercase tracking-widest hover:text-gray-600"
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