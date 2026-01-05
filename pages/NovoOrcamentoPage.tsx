import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '../components/Modal';
import { CalculatorIcon, SaveIcon, AddIcon, TrashIcon, EditIcon, CheckCircleIcon, DollarIcon, CubeIcon, ArrowLeftIcon, PlusIcon, XCircleIcon, SearchIcon, TableIcon, ExclamationTriangleIcon } from '../assets/icons';
import type { NovoOrcamentoPageProps, OrcamentoVariant, SavedOrcamento, StockItem, SalesSummaryItem } from '../types';
import { dataService } from '../services/dataService';

const formatCurrency = (value: number) => {
    if (isNaN(value)) return 'R$ 0,00';
    const rounded = Math.ceil(value * 100) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(rounded);
};

const roundUp = (value: number) => Math.ceil(value * 100) / 100;

const NovoOrcamentoPage = ({ setCurrentPage, orcamentoToEdit, clearEditingOrcamento, currentUser }: NovoOrcamentoPageProps): React.ReactElement => {
    const [isSaving, setIsSaving] = useState(false);
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [addItemTab, setAddItemTab] = useState<'estoque' | 'manual'>('estoque');
    const [isSaveModalOpen, setSaveModalOpen] = useState(false);
    const [isMarginModalOpen, setIsMarginModalOpen] = useState(false);
    const [isDeleteVariantModalOpen, setIsDeleteVariantModalOpen] = useState(false);
    const [variantToDeleteId, setVariantToDeleteId] = useState<string | null>(null);
    const [targetMargin, setTargetMargin] = useState(60.00);
    const [allStockItems, setAllStockItems] = useState<StockItem[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [manualItemName, setManualItemName] = useState('');
    const [manualItemCost, setManualItemCost] = useState(0);

    const isReadOnly = orcamentoToEdit?.status === 'Aprovado';
    const defaultInstCost = parseFloat(localStorage.getItem('config_installation_value') || '120');

    const initialFormState = {
        dataOrcamento: new Date().toISOString().split('T')[0],
        nomeCliente: '',
        fornecedor: '',
        custoSistema: 14687.02,
        maoDeObraGeral: 6490.68,
        visitaTecnicaCusto: 400,
        projetoHomologacaoCusto: 600,
        terceiroInstalacaoQtd: 12,
        terceiroInstalacaoCusto: defaultInstCost, 
        custoViagem: 0,
        adequacaoLocalCusto: 0,
        manualStockItemIds: [] as string[],
        itemsAvulsos: [] as { id: string, name: string, cost: number, qty: number, markup: number }[],
        fixedItemsData: {} as Record<string, { qty: number, cost: number, markup: number }>,
        nfServicoPerc: 6.00,
        comissaoVendasOpcao: 'Não',
        comissaoVendasPerc: 3.00,
        descontoAplicadoPerc: 0.00,
    };

    const [variants, setVariants] = useState<OrcamentoVariant[]>([
        { id: '1', name: 'Opção 1', isPrincipal: true, formState: initialFormState, calculated: {} }
    ]);
    const [activeVariantId, setActiveVariantId] = useState<string>('1');
    const [formState, setFormState] = useState(initialFormState);

    useEffect(() => {
        dataService.getAll<StockItem>('stock_items').then(setAllStockItems);
    }, []);

    useEffect(() => {
        if (orcamentoToEdit) {
            let loadedVariants: OrcamentoVariant[] = [];
            if (orcamentoToEdit.variants && orcamentoToEdit.variants.length > 0) {
                loadedVariants = orcamentoToEdit.variants.map(v => ({
                    ...v,
                    formState: { ...initialFormState, ...v.formState }
                }));
            } else if (orcamentoToEdit.formState) {
                loadedVariants = [{ 
                    id: '1', 
                    name: 'Opção 1', 
                    isPrincipal: true, 
                    formState: { ...initialFormState, ...orcamentoToEdit.formState }, 
                    calculated: orcamentoToEdit.calculated || {} 
                }];
            }
            if (loadedVariants.length > 0) {
                setVariants(loadedVariants);
                const principal = loadedVariants.find(v => v.isPrincipal) || loadedVariants[0];
                setActiveVariantId(principal.id);
                setFormState(principal.formState);
            }
        }
    }, [orcamentoToEdit]);

    const handleSwitchVariant = (id: string) => {
        const updatedVariants = variants.map(v => v.id === activeVariantId ? { ...v, formState } : v);
        setVariants(updatedVariants);
        const nextVariant = updatedVariants.find(v => v.id === id);
        if (nextVariant) {
            setActiveVariantId(id);
            setFormState(nextVariant.formState);
        }
    };

    const handleSetPrincipal = (id: string) => {
        if (isReadOnly) return;
        setVariants(prev => {
            const synced = prev.map(v => v.id === activeVariantId ? { ...v, formState } : v);
            return synced.map(v => ({ ...v, isPrincipal: v.id === id }));
        });
    };

    const handleInitiateDeleteVariant = (id: string) => {
        if (isReadOnly) return;
        if (variants.length <= 1) {
            alert("O orçamento deve ter pelo menos uma opção.");
            return;
        }
        setVariantToDeleteId(id);
        setIsDeleteVariantModalOpen(true);
    };

    const confirmDeleteVariant = () => {
        if (!variantToDeleteId) return;

        const id = variantToDeleteId;
        const syncedVariants = variants.map(v => v.id === activeVariantId ? { ...v, formState } : v);
        let updatedVariants = syncedVariants.filter(v => v.id !== id);
        
        const deletedWasPrincipal = variants.find(v => v.id === id)?.isPrincipal;
        if (deletedWasPrincipal && updatedVariants.length > 0) {
            updatedVariants = updatedVariants.map((v, idx) => ({ ...v, isPrincipal: idx === 0 }));
        }

        setVariants(updatedVariants);

        if (id === activeVariantId) {
            const next = updatedVariants[0];
            setActiveVariantId(next.id);
            setFormState(next.formState);
        }

        setIsDeleteVariantModalOpen(false);
        setVariantToDeleteId(null);
    };

    const availableItems = useMemo(() => {
        return allStockItems.filter(item => 
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
            !item.isFixedInBudget && 
            !(formState.manualStockItemIds || []).includes(String(item.id))
        );
    }, [allStockItems, searchTerm, formState.manualStockItemIds]);

    const calculated = useMemo(() => {
        const fixedStockItems = allStockItems.filter(i => i.isFixedInBudget);
        const manualIds = formState.manualStockItemIds || [];
        const manualItems = allStockItems.filter(i => !i.isFixedInBudget && manualIds.includes(String(i.id)));
        const selectedStockTableItems = [...fixedStockItems, ...manualItems];

        const instalacaoCusto = formState.terceiroInstalacaoQtd * formState.terceiroInstalacaoCusto;
        const valorKit = formState.custoSistema;
        const totalInstalacao = formState.visitaTecnicaCusto + formState.projetoHomologacaoCusto + instalacaoCusto + formState.custoViagem + formState.adequacaoLocalCusto;
        
        const totalEstrutura = selectedStockTableItems.reduce((acc, item) => {
            const savedData = (formState.fixedItemsData || {})[String(item.id)];
            const cost = (savedData && savedData.cost > 0) ? savedData.cost : (item.averagePrice || 0);
            const qty = savedData ? savedData.qty : 0;
            const markup = savedData ? savedData.markup : 0;
            return acc + (qty * cost * (1 + (markup / 100)));
        }, 0);

        const totalAvulsos = (formState.itemsAvulsos || []).reduce((acc, item) => {
            return acc + (item.qty * item.cost * (1 + (item.markup / 100)));
        }, 0);

        const custoMO = formState.maoDeObraGeral + totalInstalacao + totalEstrutura + totalAvulsos;
        const precoVendaFinal = valorKit + custoMO;
        const nfServicoValor = roundUp(custoMO * (formState.nfServicoPerc / 100));
        const comissaoVendasValor = formState.comissaoVendasOpcao === 'Sim' ? roundUp(precoVendaFinal * (formState.comissaoVendasPerc / 100)) : 0;
        const descontoValor = roundUp(precoVendaFinal * (formState.descontoAplicadoPerc / 100));
        
        const totalCustoTerceiro = formState.visitaTecnicaCusto + formState.projetoHomologacaoCusto + totalEstrutura + totalAvulsos + instalacaoCusto + formState.custoViagem + formState.adequacaoLocalCusto;
        const lucroLiquido = precoVendaFinal - totalCustoTerceiro - nfServicoValor - comissaoVendasValor - valorKit - descontoValor;
        
        return {
            valorVendaSistema: roundUp(valorKit),
            totalInstalacao: roundUp(totalInstalacao),
            totalEstrutura: roundUp(totalEstrutura + totalAvulsos),
            precoVendaFinal: roundUp(precoVendaFinal),
            nfServicoValor,
            comissaoVendasValor,
            descontoValor,
            totalCustoTerceiro: roundUp(totalCustoTerceiro),
            lucroLiquido: roundUp(lucroLiquido),
            margemLiquida: precoVendaFinal > 0 ? (lucroLiquido / precoVendaFinal) * 100 : 0,
            margemLiquidaServico: custoMO > 0 ? (lucroLiquido / custoMO) * 100 : 0,
            custoMaoObraTotal: roundUp(custoMO)
        };
    }, [formState, allStockItems]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (isReadOnly) return;
        const { name, value, type } = e.target;
        const newVal = type === 'number' ? parseFloat(value) || 0 : value;
        setFormState(prev => ({ ...prev, [name]: newVal }));
    }, [isReadOnly]);

    const handleStockItemChange = (itemId: string, field: 'qty' | 'cost' | 'markup', val: number) => {
        if (isReadOnly) return;
        setFormState(prev => ({
            ...prev,
            fixedItemsData: {
                ...(prev.fixedItemsData || {}),
                [itemId]: { ...(prev.fixedItemsData?.[itemId] || { qty: 0, cost: 0, markup: 0 }), [field]: val }
            }
        }));
    };

    const handleAvulsoChange = (id: string, field: 'qty' | 'cost' | 'markup', val: number) => {
        if (isReadOnly) return;
        setFormState(prev => ({
            ...prev,
            itemsAvulsos: prev.itemsAvulsos.map(item => item.id === id ? { ...item, [field]: val } : item)
        }));
    };

    const applyTargetMargin = () => {
        if (isReadOnly) return;
        const target = targetMargin / 100;
        const kit = formState.custoSistema;
        const nf = formState.nfServicoPerc / 100;
        const com = formState.comissaoVendasOpcao === 'Sim' ? formState.comissaoVendasPerc / 100 : 0;
        const desc = formState.descontoAplicadoPerc / 100;
        const C_terceiros = calculated.totalCustoTerceiro; 
        
        const denominator = (1 - target - nf - com - desc);
        if (denominator <= 0) {
            alert("A margem desejada é matematicamente impossível com os parâmetros atuais.");
            return;
        }

        const M = (C_terceiros + kit * (com + desc)) / denominator;
        const x = M - C_terceiros;

        setFormState(prev => ({ ...prev, maoDeObraGeral: Math.max(0, Math.round(x * 100) / 100) }));
        setIsMarginModalOpen(false);
    };

    const handleAddManualItem = () => {
        if (!manualItemName.trim()) return;
        const newItem = { id: `avulso-${Date.now()}`, name: manualItemName, cost: manualItemCost, qty: 1, markup: 0 };
        setFormState(prev => ({ ...prev, itemsAvulsos: [...(prev.itemsAvulsos || []), newItem] }));
        setManualItemName(''); setManualItemCost(0); setIsAddItemModalOpen(false);
    };

    const executeSave = async () => {
        setIsSaving(true);
        const finalVariants = variants.map(v => v.id === activeVariantId ? { ...v, formState, calculated } : v);
        const budgetToSave: SavedOrcamento = {
            id: orcamentoToEdit ? Number(orcamentoToEdit.id) : Date.now(),
            owner_id: orcamentoToEdit ? orcamentoToEdit.owner_id : currentUser.id,
            savedAt: new Date().toISOString(),
            status: orcamentoToEdit?.status || 'Em Aberto',
            variants: finalVariants,
        };
        try {
            await dataService.save('orcamentos', budgetToSave);
            alert('Projeto salvo com sucesso!');
            clearEditingOrcamento();
            setCurrentPage('ORCAMENTO');
        } catch (e) { alert(`Erro ao salvar.`); } finally { setIsSaving(false); }
    };

    const Label = ({ children }: { children: React.ReactNode }) => <label className="block text-[11px] font-bold text-gray-400 mb-1">{children}</label>;

    return (
        <div className="space-y-6 animate-fade-in max-w-[1600px] mx-auto pb-10">
            {/* Header e Variantes */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 gap-4">
                <div className="flex flex-wrap items-center gap-2">
                    {variants.map(v => (
                        <div key={v.id} className="flex items-center gap-1 group">
                            <button 
                                onClick={() => handleSwitchVariant(v.id)} 
                                className={`px-4 py-1.5 rounded-lg transition-all border text-xs font-bold flex items-center gap-2 ${activeVariantId === v.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-gray-50 text-gray-400 border-transparent hover:bg-gray-100'}`}
                            >
                                {v.isPrincipal && <span className="text-yellow-400">★</span>} {v.name}
                            </button>
                            {!isReadOnly && (
                                <div className="flex items-center">
                                    {!v.isPrincipal && (
                                        <button 
                                            onClick={() => handleSetPrincipal(v.id)} 
                                            className="p-1.5 text-gray-300 hover:text-yellow-500 transition-all opacity-0 group-hover:opacity-100" 
                                            title="Tornar principal"
                                        >
                                            ☆
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleInitiateDeleteVariant(v.id)} 
                                        className="p-1.5 text-gray-300 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100" 
                                        title="Excluir opção"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {!isReadOnly && (
                        <button onClick={() => setVariants([...variants, { id: String(Date.now()), name: `Opção ${variants.length + 1}`, isPrincipal: false, formState: { ...formState }, calculated: {} }])} className="p-1.5 bg-gray-100 rounded-full text-gray-400 hover:text-indigo-600 transition-all"><PlusIcon className="w-4 h-4"/></button>
                    )}
                </div>
                {!isReadOnly && (
                    <button onClick={() => setSaveModalOpen(true)} className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-lg font-bold text-sm shadow hover:bg-green-700 transition-all active:scale-95">
                        <SaveIcon className="w-5 h-5" /> Salvar projeto
                    </button>
                )}
            </div>

            {/* Cards KPI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-indigo-600 rounded-xl p-5 text-white shadow-lg">
                    <p className="text-[10px] font-bold opacity-70 mb-1">Preço de venda final</p>
                    <p className="text-2xl font-bold">{formatCurrency(calculated.precoVendaFinal)}</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">Lucro líquido</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(calculated.lucroLiquido)}</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-400 mb-1">Margem líquida</p>
                    <p className="text-2xl font-bold text-indigo-600">{calculated.margemLiquida?.toFixed(2)}%</p>
                </div>
                <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm relative overflow-hidden flex justify-between items-start">
                    <div>
                        <p className="text-[10px] font-bold text-gray-400 mb-1">Margem serviço</p>
                        <p className="text-2xl font-bold text-purple-600">{calculated.margemLiquidaServico?.toFixed(2)}%</p>
                    </div>
                    {!isReadOnly && (
                        <button onClick={() => setIsMarginModalOpen(true)} className="p-2 bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 transition-all" title="Calcular margem de serviço alvo"><CalculatorIcon className="w-4 h-4" /></button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">
                    {/* Dados iniciais */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-6">
                            <span className="w-1.5 h-4 bg-indigo-600 rounded-full"></span> Dados iniciais
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div><Label>Data do orçamento</Label><input type="date" name="dataOrcamento" value={formState.dataOrcamento} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold text-gray-800 outline-none" /></div>
                                <div><Label>Fornecedor</Label><input type="text" name="fornecedor" value={formState.fornecedor} onChange={handleInputChange} disabled={isReadOnly} placeholder="Ex: Aldo Solar" className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold text-gray-800 outline-none" /></div>
                            </div>
                            <div className="space-y-4">
                                <div><Label>Nome do cliente</Label><input type="text" name="nomeCliente" value={formState.nomeCliente} onChange={handleInputChange} disabled={isReadOnly} placeholder="Ex: João Silva" className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold text-gray-800 outline-none" /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Custo do sistema (kit)</Label><input type="number" name="custoSistema" value={formState.custoSistema} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold text-gray-800 outline-none" /></div>
                                    <div><Label>Mão de obra geral</Label><input type="number" name="maoDeObraGeral" value={formState.maoDeObraGeral} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold text-indigo-600 outline-none" /></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Custos de instalação e terceiros */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-6">
                            <span className="w-1.5 h-4 bg-orange-500 rounded-full"></span> Custos de instalação e terceiros
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div><Label>Visita técnica</Label><input type="number" name="visitaTecnicaCusto" value={formState.visitaTecnicaCusto} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold" /></div>
                            <div><Label>Projeto / homologação</Label><input type="number" name="projetoHomologacaoCusto" value={formState.projetoHomologacaoCusto} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold" /></div>
                            <div><Label>Custo de viagem</Label><input type="number" name="custoViagem" value={formState.custoViagem} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold" /></div>
                            <div><Label>Adequação local</Label><input type="number" name="adequacaoLocalCusto" value={formState.adequacaoLocalCusto} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 rounded-lg p-2 text-sm font-bold" /></div>
                            <div className="md:col-span-2">
                                <Label>Instalação - placas <span className="ml-2 text-[10px] text-gray-400 font-bold bg-gray-100 px-1.5 py-0.5 rounded">Total: {formatCurrency(formState.terceiroInstalacaoQtd * formState.terceiroInstalacaoCusto)}</span></Label>
                                <div className="flex items-center gap-2">
                                    <input type="number" name="terceiroInstalacaoQtd" value={formState.terceiroInstalacaoQtd} onChange={handleInputChange} disabled={isReadOnly} className="w-20 bg-amber-50 p-2 rounded-lg text-sm font-bold text-center" />
                                    <span className="text-gray-300 font-bold">x</span>
                                    <div className="relative flex-1"><span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-xs">R$</span><input type="number" name="terceiroInstalacaoCusto" value={formState.terceiroInstalacaoCusto} onChange={handleInputChange} disabled={isReadOnly} className="w-full bg-amber-50 p-2 pl-8 rounded-lg text-sm font-bold" /></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Materiais e estrutura */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2"><span className="w-1.5 h-4 bg-indigo-900 rounded-full"></span> Materiais e estrutura</h3>
                            <div className="flex items-center gap-4">
                                <span className="text-[11px] font-bold bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg border border-indigo-100">Total: {formatCurrency(calculated.totalEstrutura)}</span>
                                {!isReadOnly && (<button onClick={() => setIsAddItemModalOpen(true)} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] hover:bg-indigo-700 shadow-sm transition-all"><PlusIcon className="w-4 h-4" /> Adicionar item</button>)}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-xs">
                                <thead className="text-gray-400 border-b border-gray-50 font-bold text-[9px] tracking-wider">
                                    <tr><th className="pb-3 px-1">Item / descrição</th><th className="pb-3 text-center">Qtd</th><th className="pb-3 text-right">Custo unit.</th><th className="pb-3 text-center">% Acrésc.</th><th className="pb-3 text-right">Total</th>{!isReadOnly && <th className="pb-3 w-8"></th>}</tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {(allStockItems.filter(i => i.isFixedInBudget || (formState.manualStockItemIds || []).includes(String(i.id)))).map(item => {
                                        const savedData = (formState.fixedItemsData || {})[String(item.id)];
                                        const cost = (savedData && savedData.cost > 0) ? savedData.cost : (item.averagePrice || 0);
                                        const qty = savedData ? savedData.qty : 0;
                                        const markup = savedData ? savedData.markup : 0;
                                        const total = qty * cost * (1 + (markup / 100));
                                        return (
                                            <tr key={item.id} className="group">
                                                <td className="py-4 px-1 font-bold text-gray-700">{item.name}</td>
                                                <td className="py-4 px-2 w-20"><input type="number" value={qty} onChange={e => handleStockItemChange(String(item.id), 'qty', parseFloat(e.target.value) || 0)} disabled={isReadOnly} className="w-full bg-transparent text-center font-bold border-b border-indigo-100 outline-none" /></td>
                                                <td className="py-4 px-2 text-right font-semibold text-gray-400">{formatCurrency(cost)}</td>
                                                <td className="py-4 px-2 text-center text-indigo-600 font-bold"><input type="number" value={markup} onChange={e => handleStockItemChange(String(item.id), 'markup', parseFloat(e.target.value) || 0)} disabled={isReadOnly} className="w-8 bg-transparent text-center outline-none" /> %</td>
                                                <td className="py-4 px-1 text-right font-bold text-indigo-600">{formatCurrency(total)}</td>
                                                {!isReadOnly && !item.isFixedInBudget && (
                                                    <td className="py-4 text-center"><button onClick={() => setFormState(p => ({...p, manualStockItemIds: p.manualStockItemIds.filter(id => id !== String(item.id))}))} className="text-red-300 hover:text-red-500"><XCircleIcon className="w-4 h-4" /></button></td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                    {(formState.itemsAvulsos || []).map(item => {
                                        const total = item.qty * item.cost * (1 + (item.markup / 100));
                                        return (
                                            <tr key={item.id} className="bg-amber-50/40 group">
                                                <td className="py-4 px-1 font-bold text-amber-800">{item.name} <span className="text-[9px] bg-amber-100 px-1 rounded ml-2 font-normal">Manual</span></td>
                                                <td className="py-4 px-2 w-20"><input type="number" value={item.qty} onChange={e => handleAvulsoChange(item.id, 'qty', parseFloat(e.target.value) || 0)} disabled={isReadOnly} className="w-full bg-transparent text-center font-bold border-b border-amber-200 outline-none text-amber-900" /></td>
                                                <td className="py-4 px-2 text-right font-semibold text-amber-600/60">{formatCurrency(item.cost)}</td>
                                                <td className="py-4 px-2 text-center text-amber-700 font-bold"><input type="number" value={item.markup} onChange={e => handleAvulsoChange(item.id, 'markup', parseFloat(e.target.value) || 0)} disabled={isReadOnly} className="w-8 bg-transparent text-center outline-none" /> %</td>
                                                <td className="py-4 px-1 text-right font-bold text-amber-700">{formatCurrency(total)}</td>
                                                {!isReadOnly && (
                                                    <td className="py-4 text-center"><button onClick={() => setFormState(p => ({...p, itemsAvulsos: p.itemsAvulsos.filter(x => x.id !== item.id)}))} className="text-red-300 hover:text-red-500"><XCircleIcon className="w-4 h-4" /></button></td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Sidebar financeira */}
                <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="bg-indigo-600 p-4 flex items-center gap-2">
                            <CalculatorIcon className="w-5 h-5 text-white" />
                            <h3 className="text-xs font-bold text-white tracking-widest">Fechamento financeiro</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-xs font-semibold text-gray-400"><span>Custo do sistema</span><span className="text-gray-800 font-bold">{formatCurrency(calculated.valorVendaSistema)}</span></div>
                                <div className="flex justify-between items-center text-xs font-semibold text-gray-400"><span>Custo mão de obra total</span><span className="text-gray-800 font-bold">{formatCurrency(calculated.custoMaoObraTotal)}</span></div>
                                <div className="flex justify-between items-center pt-4 border-t border-dashed border-gray-100">
                                    <span className="text-sm font-bold text-gray-900">Preço venda</span>
                                    <span className="text-xl font-bold text-indigo-600">{formatCurrency(calculated.precoVendaFinal)}</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <p className="text-[10px] font-bold text-gray-400 tracking-widest border-b pb-1">Impostos e comissões</p>
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-[11px] font-semibold text-gray-500">Nf serviço (%)</span>
                                    <div className="flex items-center gap-3">
                                        <input type="number" name="nfServicoPerc" step="0.01" value={formState.nfServicoPerc} onChange={handleInputChange} disabled={isReadOnly} className="w-12 bg-gray-50 rounded p-1 text-center text-xs font-bold" />
                                        <span className="text-xs font-bold text-gray-400 min-w-[70px] text-right">{formatCurrency(calculated.nfServicoValor)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-[11px] font-semibold text-gray-500">Comissão venda</span>
                                    <div className="flex items-center gap-2">
                                        <select name="comissaoVendasOpcao" value={formState.comissaoVendasOpcao} onChange={handleInputChange} disabled={isReadOnly} className="bg-gray-50 rounded p-1 text-[11px] font-bold outline-none">
                                            <option value="Não">Não</option><option value="Sim">Sim</option>
                                        </select>
                                        {formState.comissaoVendasOpcao === 'Sim' && (
                                            <div className="flex items-center gap-1 animate-fade-in">
                                                <input type="number" name="comissaoVendasPerc" step="0.01" value={formState.comissaoVendasPerc} onChange={handleInputChange} disabled={isReadOnly} className="w-12 bg-indigo-50 text-indigo-600 rounded p-1 text-center text-xs font-bold" />
                                                <span className="text-[10px] text-gray-400 font-bold">%</span>
                                            </div>
                                        )}
                                        <span className="text-xs font-bold text-gray-400 min-w-[70px] text-right">{formatCurrency(calculated.comissaoVendasValor)}</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center gap-2">
                                    <span className="text-[11px] font-semibold text-gray-500">Desconto (%)</span>
                                    <div className="flex items-center gap-3">
                                        <input type="number" name="descontoAplicadoPerc" step="0.01" value={formState.descontoAplicadoPerc} onChange={handleInputChange} disabled={isReadOnly} className="w-12 bg-gray-50 rounded p-1 text-center text-xs font-bold" />
                                        <span className="text-xs font-bold text-red-400 min-w-[70px] text-right">-{formatCurrency(calculated.descontoValor)}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                                <p className="text-[10px] font-bold text-green-600 mb-1">Lucro líquido real</p>
                                <p className="text-3xl font-bold text-green-700">{formatCurrency(calculated.lucroLiquido)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal de exclusão de opção */}
            {isDeleteVariantModalOpen && (
                <Modal title="Excluir opção" onClose={() => setIsDeleteVariantModalOpen(false)}>
                    <div className="text-center p-4 space-y-6">
                        <TrashIcon className="w-12 h-12 text-red-500 mx-auto" />
                        <p className="font-bold text-gray-700 text-sm">Deseja excluir a opção de orçamento?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setIsDeleteVariantModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs text-gray-500">Não</button>
                            <button onClick={confirmDeleteVariant} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg">Sim</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal margem alvo */}
            {isMarginModalOpen && (
                <Modal title="Cálculo de margem de serviço" onClose={() => setIsMarginModalOpen(false)}>
                    <div className="space-y-6 pt-2 text-center">
                        <CalculatorIcon className="w-12 h-12 text-purple-600 mx-auto" />
                        <div>
                            <p className="text-sm font-bold text-gray-600">Qual a margem de lucro desejada sobre a mão de obra?</p>
                            <p className="text-[10px] text-gray-400 mt-1">O sistema ajustará a mão de obra geral automaticamente.</p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                            <input 
                                type="number" 
                                step="0.01"
                                value={targetMargin} 
                                onChange={e => setTargetMargin(parseFloat(e.target.value) || 0)} 
                                className="w-32 text-center text-3xl font-bold text-purple-600 bg-purple-50 rounded-xl p-3 outline-none" 
                            />
                            <span className="text-2xl font-bold text-gray-300">%</span>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setIsMarginModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs text-gray-400">Cancelar</button>
                            <button onClick={applyTargetMargin} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold text-xs shadow-lg">Aplicar margem</button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal adicionar item */}
            {isAddItemModalOpen && (
                <Modal title="Adicionar material" onClose={() => setIsAddItemModalOpen(false)} maxWidth="max-w-xl">
                    <div className="space-y-6">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button onClick={() => setAddItemTab('estoque')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${addItemTab === 'estoque' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>Do estoque</button>
                            <button onClick={() => setAddItemTab('manual')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${addItemTab === 'manual' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500'}`}>Item avulso</button>
                        </div>

                        {addItemTab === 'estoque' ? (
                            <div className="space-y-4">
                                <div className="relative">
                                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                    <input type="text" placeholder="Buscar no catálogo Orner..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border-none text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                                </div>
                                <div className="max-h-80 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {availableItems.map(item => (
                                        <div key={item.id} className="flex justify-between items-center p-4 bg-white border border-gray-100 rounded-xl hover:bg-indigo-50 cursor-pointer group" onClick={() => { setFormState(p => ({ ...p, manualStockItemIds: [...(p.manualStockItemIds || []), String(item.id)] })); setIsAddItemModalOpen(false); }}>
                                            <div><p className="font-bold text-gray-800 text-xs">{item.name}</p><p className="text-[10px] font-bold text-gray-400">Preço unit.: {formatCurrency(item.averagePrice || 0)}</p></div>
                                            <PlusIcon className="w-5 h-5 text-indigo-400 opacity-0 group-hover:opacity-100" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5 animate-fade-in">
                                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex items-center gap-3">
                                    <ExclamationTriangleIcon className="w-6 h-6 text-amber-500" />
                                    <p className="text-[11px] font-bold text-amber-700">Use esta opção para materiais que não estão cadastrados no estoque central.</p>
                                </div>
                                <div><Label>Descrição do item</Label><input type="text" placeholder="Ex: Eletroduto 3/4 galvanizado..." value={manualItemName} onChange={e => setManualItemName(e.target.value)} className="w-full p-3 rounded-xl bg-gray-50 border-transparent text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500/20" /></div>
                                <div><Label>Custo unitário base (R$)</Label><input type="number" step="0.01" value={manualItemCost || ''} onChange={e => setManualItemCost(parseFloat(e.target.value) || 0)} placeholder="0,00" className="w-full p-3 rounded-xl bg-gray-50 border-transparent text-sm font-bold text-amber-700 outline-none focus:ring-2 focus:ring-amber-500/20" /></div>
                                <div className="flex gap-3 pt-2">
                                    <button onClick={() => setIsAddItemModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs text-gray-400">Cancelar</button>
                                    <button onClick={handleAddManualItem} disabled={!manualItemName.trim()} className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-amber-700 disabled:opacity-50">Incluir no orçamento</button>
                                </div>
                            </div>
                        )}
                    </div>
                </Modal>
            )}

            {isSaveModalOpen && (
                <Modal title="Confirmar salvamento" onClose={() => setSaveModalOpen(false)}>
                    <div className="text-center p-4 space-y-6">
                        <SaveIcon className="w-12 h-12 text-indigo-600 mx-auto" />
                        <p className="font-bold text-gray-700 text-sm">Deseja salvar as alterações de todas as variantes deste projeto?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setSaveModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-xs text-gray-500">Voltar</button>
                            <button onClick={executeSave} disabled={isSaving} className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-xs shadow-lg">{isSaving ? 'Salvando...' : 'Confirmar'}</button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default NovoOrcamentoPage;