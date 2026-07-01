import React, { useMemo, useState } from 'react';
import type { SavedOrcamento, FinancialCategory, BankAccount, FinancialTransaction } from '../../types';
import { 
    DollarIcon, SearchIcon, CalendarIcon, TruckIcon, 
    WrenchIcon, DocumentReportIcon, CheckCircleIcon, 
    XCircleIcon, SparklesIcon, ChevronDownIcon 
} from '../../assets/icons';
import { dataService } from '../../services/dataService';
import Modal from '../Modal';

interface InstalacaoViewProps {
    budgets: SavedOrcamento[];
    startDate: string;
    endDate: string;
    categories: FinancialCategory[];
    bankAccounts: BankAccount[];
    onRefresh: () => void;
}

const parseSafeNumber = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const parsed = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
    return isNaN(parsed) ? 0 : parsed;
};

const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
};

const toTitleCase = (str: string) => {
    if (!str) return '';
    return str
        .toLowerCase()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

const findMatchingCategory = (categories: FinancialCategory[], label: string): string => {
    const expenseCats = categories.filter(c => c.type === 'despesa');
    if (expenseCats.length === 0) return '';
    
    const searchTerms: Record<string, string[]> = {
        deslocamento: ['deslocamento', 'viagem', 'combustivel', 'logistica', 'transporte'],
        pedagio: ['pedagio', 'pedágio', 'deslocamento', 'viagem', 'logistica'],
        instalacao: ['instalacao', 'instalação', 'mao de obra', 'mão de obra', 'terceiro', 'servico', 'serviço'],
        homologacao: ['homologacao', 'homologação', 'projeto', 'engenharia'],
        imposto: ['imposto', 'tributo', 'nota fiscal', 'nf', 'taxa'],
        comissao: ['comissao', 'comissão', 'venda', 'comissões']
    };
    
    const terms = searchTerms[label.toLowerCase()] || [];
    for (const term of terms) {
        const found = expenseCats.find(c => c.name.toLowerCase().includes(term));
        if (found) return found.id;
    }
    
    return expenseCats[0]?.id || '';
};

const InstalacaoView: React.FC<InstalacaoViewProps> = ({ 
    budgets, 
    startDate, 
    endDate, 
    categories, 
    bankAccounts, 
    onRefresh 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [costLaunchFilter, setCostLaunchFilter] = useState<'pending' | 'launched' | 'all'>('pending');
    const [isSaving, setIsSaving] = useState(false);
    
    // Modal para lançar custos de um orçamento específico
    const [selectedBudgetToLaunch, setSelectedBudgetToLaunch] = useState<any | null>(null);
    const [launchFormState, setLaunchFormState] = useState<any[]>([]);
    
    // Modal de confirmação para encerrar um orçamento sem lançar todos os custos
    const [selectedBudgetToDismiss, setSelectedBudgetToDismiss] = useState<any | null>(null);

    // Modal de confirmação para desconsiderar/excluir um custo específico temporariamente desta tela
    const [costToDismiss, setCostToDismiss] = useState<{ type: string; label: string } | null>(null);

    // Mapear orçamentos relevantes e calcular custos unlaunched
    const mappedBudgets = useMemo(() => {
        return budgets.map(b => {
            const variant = b.variants?.find(v => v.isPrincipal) || b.variants?.[0];
            const fs = variant?.formState || b.formState;
            const calc = variant?.calculated || b.calculated;

            const rawClientName = fs?.nomeCliente || b.formState?.nomeCliente || `Orçamento #${b.id}`;
            const clientName = toTitleCase(rawClientName);
            const dateStr = b.savedAt || fs?.dataOrcamento || b.formState?.dataOrcamento || '';

            // Custos estimados
            const estHomo = b.custos_estimados?.homologacao !== undefined 
                ? parseSafeNumber(b.custos_estimados.homologacao) 
                : (fs?.projetoHomologacaoCusto !== undefined 
                    ? parseSafeNumber(fs.projetoHomologacaoCusto) 
                    : (calc ? parseSafeNumber(calc.projetoHomologacaoCusto) : 0));

            const estInst = b.custos_estimados?.instalacao !== undefined 
                ? parseSafeNumber(b.custos_estimados.instalacao) 
                : (fs ? (parseSafeNumber(fs.terceiroInstalacaoQtd) * parseSafeNumber(fs.terceiroInstalacaoCusto)) : 0);

            const estDeslocamento = b.custos_estimados?.deslocamento !== undefined 
                ? parseSafeNumber(b.custos_estimados.deslocamento) 
                : (fs ? (parseSafeNumber(fs.deslocamento) || parseSafeNumber(fs.custoViagem) || 0) : 0);

            const estPedagio = b.custos_estimados?.pedagio !== undefined 
                ? parseSafeNumber(b.custos_estimados.pedagio) 
                : (fs ? parseSafeNumber(fs.pedagio) : 0);

            const estTax = b.custos_estimados?.imposto !== undefined 
                ? parseSafeNumber(b.custos_estimados.imposto) 
                : (calc ? parseSafeNumber(calc.impostos || calc.nfServicoValor || 0) : 0);

            const estComm = calc ? parseSafeNumber(calc.comissaoVendasValor) : 0;

            // Estado de custos lançados (puxando do banco caso exista)
            const lan = b.custos_lancados || {};

            // Custos elegíveis (maiores que zero)
            const costsList = [
                { type: 'deslocamento', label: 'Deslocamento', value: estDeslocamento, launched: !!lan.deslocamento },
                { type: 'pedagio', label: 'Pedágio', value: estPedagio, launched: !!lan.pedagio },
                { type: 'instalacao', label: 'Instalação', value: estInst, launched: !!lan.instalacao },
                { type: 'homologacao', label: 'Homologação', value: estHomo, launched: !!lan.homologacao },
                { type: 'imposto', label: 'Imposto (NF)', value: estTax, launched: !!lan.imposto },
                { type: 'comissao', label: 'Comissão', value: estComm, launched: !!lan.comissao }
            ];

            const pendingCostsCount = costsList.filter(c => c.value > 0 && !c.launched).length;
            const hasAnyCost = costsList.some(c => c.value > 0);

            return {
                id: b.id,
                clientName,
                date: dateStr ? dateStr.substring(0, 10) : '',
                status: b.status,
                costs: costsList,
                pendingCostsCount,
                hasAnyCost,
                originalBudget: b
            };
        });
    }, [budgets]);

    // Filtrar dados com base nas escolhas de visualização
    const filteredBudgets = useMemo(() => {
        return mappedBudgets.filter(item => {
            // Filtro de lançamento do custo
            if (costLaunchFilter === 'pending' && item.pendingCostsCount === 0) return false;
            if (costLaunchFilter === 'launched' && item.pendingCostsCount > 0) return false;
            if (costLaunchFilter === 'launched' && !item.hasAnyCost) return false;
            if (costLaunchFilter === 'all' && !item.hasAnyCost) return false;

            // Deve conter apenas orçamentos "Aprovado" (Finalizados e outros estados são desconsiderados)
            if (item.status !== 'Aprovado') return false;

            // Filtro por busca de cliente
            if (searchTerm.trim() !== '') {
                const search = searchTerm.toLowerCase();
                if (!item.clientName.toLowerCase().includes(search)) return false;
            }

            return true;
        });
    }, [mappedBudgets, costLaunchFilter, searchTerm]);

    // Calcular orçamentos que possuem custos pendentes (independente de estar exibindo Lançados/Todos)
    const pendingBudgets = useMemo(() => {
        return mappedBudgets.filter(item => {
            if (item.pendingCostsCount === 0) return false;

            // Deve conter apenas orçamentos "Aprovado" (Finalizados e outros estados são desconsiderados)
            if (item.status !== 'Aprovado') return false;

            // Filtro por período ignorado para provisões pendentes, pois representam contas pendentes de pagamento
            // independente do período em que o orçamento foi feito.

            // Filtro por busca de cliente
            if (searchTerm.trim() !== '') {
                const search = searchTerm.toLowerCase();
                if (!item.clientName.toLowerCase().includes(search)) return false;
            }

            return true;
        });
    }, [mappedBudgets, searchTerm]);

    // Calcular totais das provisões PENDENTES
    const metrics = useMemo(() => {
        let totalDeslocamento = 0;
        let totalPedagio = 0;
        let totalImposto = 0;
        let totalInstalacao = 0;
        let totalHomologacao = 0;
        let totalComissao = 0;
        let totalGeral = 0;

        pendingBudgets.forEach(item => {
            item.costs.forEach(c => {
                if (!c.launched) {
                    if (c.type === 'deslocamento') totalDeslocamento += c.value;
                    if (c.type === 'pedagio') totalPedagio += c.value;
                    if (c.type === 'instalacao') totalInstalacao += c.value;
                    if (c.type === 'homologacao') totalHomologacao += c.value;
                    if (c.type === 'imposto') totalImposto += c.value;
                    if (c.type === 'comissao') totalComissao += c.value;
                    totalGeral += c.value;
                }
            });
        });

        return {
            count: pendingBudgets.length,
            totalDeslocamento,
            totalPedagio,
            totalImposto,
            totalInstalacao,
            totalHomologacao,
            totalComissao,
            totalGeral
        };
    }, [pendingBudgets]);

    // Abre o painel para lançar custos da linha selecionada
    const handleOpenLaunchModal = (item: any) => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        // Carrega apenas os custos maiores que zero e que não foram lançados
        const pendingItems = item.costs
            .filter((c: any) => c.value > 0 && !c.launched)
            .map((c: any) => ({
                type: c.type,
                label: c.label,
                value: c.value,
                enabled: true,
                description: `${c.label} - ${item.clientName}`,
                dueDate: todayStr,
                categoryId: findMatchingCategory(categories, c.type),
                bankId: bankAccounts.find(b => b.active)?.id || bankAccounts[0]?.id || ''
            }));

        setSelectedBudgetToLaunch(item);
        setLaunchFormState(pendingItems);
    };

    const handleFormValueChange = (index: number, field: string, val: any) => {
        setLaunchFormState(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: val };
            return next;
        });
    };

    // Encerrar projeto (marcar todos os custos unlaunched como concluídos/ignorados)
    const handleDismissProject = (item: any) => {
        setSelectedBudgetToDismiss(item);
    };

    const handleConfirmDismissProject = async () => {
        if (!selectedBudgetToDismiss) return;
        setIsSaving(true);
        try {
            const item = selectedBudgetToDismiss;
            const updatedLan = { ...(item.originalBudget.custos_lancados || {}) };
            item.costs.forEach((c: any) => {
                if (c.value > 0) {
                    updatedLan[c.type] = true;
                }
            });

            const updatedBudget: SavedOrcamento = {
                ...item.originalBudget,
                custos_lancados: updatedLan
            };

            await dataService.save('orcamentos', updatedBudget);
            onRefresh();
            setSelectedBudgetToDismiss(null);
            alert(`Projeto de "${item.clientName}" encerrado com sucesso.`);
        } catch (error: any) {
            console.error("Erro ao encerrar projeto:", error);
            const isColumnMissing = error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('não existe') || error.message?.includes('coluna');
            if (isColumnMissing) {
                alert(
                    "Erro de Banco de Dados: A coluna 'custos_lancados' não existe na tabela 'orcamentos' no seu Supabase.\n\n" +
                    "Para resolver, por favor execute este comando no Editor SQL do seu Supabase:\n\n" +
                    "ALTER TABLE \"orcamentos\" ADD COLUMN IF NOT EXISTS \"custos_lancados\" jsonb DEFAULT '{}'::jsonb;\n" +
                    "COMMENT ON COLUMN \"orcamentos\".\"custos_lancados\" IS 'Armazena quais provisões de custos foram faturadas ou ignoradas na tela de controle de fluxo de caixa';"
                );
            } else {
                alert(`Ocorreu um erro ao encerrar o projeto: ${error.message}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleDismissIndividualCost = async (costType: string) => {
        if (!selectedBudgetToLaunch) return;
        
        setIsSaving(true);
        try {
            const originalBudget = selectedBudgetToLaunch.originalBudget;
            const updatedLan = { ...(originalBudget.custos_lancados || {}) };
            updatedLan[costType] = true; // Mark as launched/ignored
            
            const updatedBudget: SavedOrcamento = {
                ...originalBudget,
                custos_lancados: updatedLan
            };
            
            await dataService.save('orcamentos', updatedBudget);
            
            // Remove from local modal form state immediately
            setLaunchFormState(prev => prev.filter(c => c.type !== costType));
            
            // Update the selected budget to launch object or close if no pending costs remain
            const nextCosts = selectedBudgetToLaunch.costs.map((c: any) => 
                c.type === costType ? { ...c, launched: true } : c
            );
            const pendingCostsCount = nextCosts.filter((c: any) => c.value > 0 && !c.launched).length;
            
            if (pendingCostsCount === 0) {
                setSelectedBudgetToLaunch(null);
            } else {
                setSelectedBudgetToLaunch((prev: any) => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        costs: nextCosts,
                        pendingCostsCount
                    };
                });
            }
            
            onRefresh();
        } catch (error: any) {
            console.error("Erro ao desconsiderar custo individual:", error);
            const isColumnMissing = error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('não existe') || error.message?.includes('coluna');
            if (isColumnMissing) {
                alert(
                    "Erro de Banco de Dados: A coluna 'custos_lancados' não existe na tabela 'orcamentos' no seu Supabase.\n\n" +
                    "Para resolver, por favor execute este comando no Editor SQL do seu Supabase:\n\n" +
                    "ALTER TABLE \"orcamentos\" ADD COLUMN IF NOT EXISTS \"custos_lancados\" jsonb DEFAULT '{}'::jsonb;\n" +
                    "COMMENT ON COLUMN \"orcamentos\".\"custos_lancados\" IS 'Armazena quais provisões de custos foram faturadas ou ignoradas na tela de controle de fluxo de caixa';"
                );
            } else {
                alert(`Ocorreu um erro ao atualizar o custo: ${error.message}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    // Confirma e realiza os lançamentos em "A Pagar" de forma automatizada
    const handleConfirmLaunch = async () => {
        const selectedCostsToLaunch = launchFormState.filter(c => c.enabled);
        if (selectedCostsToLaunch.length === 0) {
            alert("Por favor, selecione pelo menos um item de custo para lançar.");
            return;
        }

        // Validar dados
        for (const c of selectedCostsToLaunch) {
            if (!c.description.trim()) {
                alert(`Informe a descrição para o custo de ${c.label}.`);
                return;
            }
            if (!c.categoryId) {
                alert(`Selecione uma categoria para o custo de ${c.label}.`);
                return;
            }
            if (!c.bankId) {
                alert(`Selecione uma conta bancária para o custo de ${c.label}.`);
                return;
            }
            if (!c.dueDate) {
                alert(`Selecione uma data de vencimento para o custo de ${c.label}.`);
                return;
            }
        }

        setIsSaving(true);
        try {
            const d = new Date();
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            // 1. Gerar objetos de transações
            const transactionsToSave: FinancialTransaction[] = selectedCostsToLaunch.map((c, i) => ({
                id: `tx-inst-${selectedBudgetToLaunch.id}-${c.type}-${Date.now()}-${i}`,
                owner_id: selectedBudgetToLaunch.originalBudget.owner_id || '',
                description: c.description,
                amount: c.value,
                type: 'despesa',
                dueDate: c.dueDate,
                launchDate: todayStr,
                categoryId: c.categoryId,
                bankId: c.bankId,
                status: 'pendente'
            }));

            // Salvar no banco de transações financeiras
            await dataService.saveAll('financial_transactions', transactionsToSave);

            // 2. Atualizar estado de custos_lancados no orçamento
            const updatedLan = { ...(selectedBudgetToLaunch.originalBudget.custos_lancados || {}) };
            selectedCostsToLaunch.forEach(c => {
                updatedLan[c.type] = true;
            });

            const updatedBudget: SavedOrcamento = {
                ...selectedBudgetToLaunch.originalBudget,
                custos_lancados: updatedLan
            };

            // Salvar alteração no orçamento
            await dataService.save('orcamentos', updatedBudget);

            // 3. Fechar modal e recarregar dados do painel principal
            setSelectedBudgetToLaunch(null);
            onRefresh();
            alert(`Lançamento de ${selectedCostsToLaunch.length} custo(s) realizado com sucesso no Contas a Pagar!`);
        } catch (error: any) {
            console.error("Erro ao realizar lançamentos automáticos:", error);
            const isColumnMissing = error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('não existe') || error.message?.includes('coluna');
            if (isColumnMissing) {
                alert(
                    "Erro de Banco de Dados: A coluna 'custos_lancados' não existe na tabela 'orcamentos' no seu Supabase.\n\n" +
                    "Para resolver, por favor execute este comando no Editor SQL do seu Supabase:\n\n" +
                    "ALTER TABLE \"orcamentos\" ADD COLUMN IF NOT EXISTS \"custos_lancados\" jsonb DEFAULT '{}'::jsonb;\n" +
                    "COMMENT ON COLUMN \"orcamentos\".\"custos_lancados\" IS 'Armazena quais provisões de custos foram faturadas ou ignoradas na tela de controle de fluxo de caixa';"
                );
            } else {
                alert(`Ocorreu um erro ao salvar as transações: ${error.message}`);
            }
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Cards de Métricas de Provisão Pendente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Projetos Pendentes de Provisão */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-wider leading-none">Projetos Ativos</span>
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white mt-1 leading-none">{metrics.count}</h3>
                        </div>
                        <div className="p-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600 dark:text-indigo-400">
                            <DocumentReportIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                        <span>Aprovados aguardando lançamentos</span>
                    </div>
                </div>

                {/* Deslocamento + Pedágio Pendente */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-wider leading-none">Deslocamento + Pedágio</span>
                            <h3 className="text-xl font-black text-gray-900 dark:text-white mt-1 leading-none">{formatCurrency(metrics.totalDeslocamento + metrics.totalPedagio)}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400">
                            <TruckIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center text-[9px] font-black text-gray-400 border-t border-gray-50 dark:border-gray-700/50 pt-2">
                        <span>Deslocamento: {formatCurrency(metrics.totalDeslocamento)}</span>
                        <span>Pedágio: {formatCurrency(metrics.totalPedagio)}</span>
                    </div>
                </div>

                {/* Impostos Estimados Pendentes */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-wider leading-none">Imposto (NF) Pendente</span>
                            <h3 className="text-xl font-black text-amber-600 dark:text-amber-400 mt-1 leading-none">{formatCurrency(metrics.totalImposto)}</h3>
                        </div>
                        <div className="p-2 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600 dark:text-amber-400">
                            <DollarIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-gray-400">
                        <span>Provisão s/ serviços pendente</span>
                    </div>
                </div>

                {/* Instalação + Homologação + Comissão */}
                <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-wider leading-none">Serviços & Comissão</span>
                            <h3 className="text-xl font-black text-purple-600 dark:text-purple-400 mt-1 leading-none">{formatCurrency(metrics.totalInstalacao + metrics.totalHomologacao + metrics.totalComissao)}</h3>
                        </div>
                        <div className="p-2 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400">
                            <WrenchIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center text-[9px] font-black text-gray-400 border-t border-gray-50 dark:border-gray-700/50 pt-2">
                        <span>Instalação: {formatCurrency(metrics.totalInstalacao)}</span>
                        <span>Comissão: {formatCurrency(metrics.totalComissao)}</span>
                    </div>
                </div>

                {/* Total Geral de Provisões Pendentes */}
                <div className="bg-indigo-600 dark:bg-indigo-900 p-5 rounded-2xl shadow-lg relative overflow-hidden transition-all hover:shadow-xl text-white">
                    <div className="absolute right-[-20px] bottom-[-20px] opacity-10">
                        <DollarIcon className="w-32 h-32 text-white" />
                    </div>
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <span className="text-[10px] font-black text-indigo-200 tracking-wider leading-none">Total Provisões Pendentes</span>
                            <h3 className="text-2xl font-black text-white mt-1 leading-none">{formatCurrency(metrics.totalGeral)}</h3>
                        </div>
                        <div className="p-2 bg-indigo-500/40 rounded-xl text-white">
                            <DollarIcon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex justify-between items-center text-[9px] font-black text-indigo-200 border-t border-indigo-500/50 pt-2 relative z-10">
                        <span>Homologação: {formatCurrency(metrics.totalHomologacao)}</span>
                        <span>Contas Pendentes</span>
                    </div>
                </div>
            </div>

            {/* Tabela de Orçamentos com Custos Pendentes de Lançamento */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-150 dark:border-gray-700 overflow-hidden">
                <div className="p-5 border-b border-gray-150 dark:border-gray-700 flex flex-col md:flex-row justify-between md:items-center gap-4 bg-gray-50/50 dark:bg-gray-750">
                    <div>
                        <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                            <WrenchIcon className="w-5 h-5 text-indigo-600" /> {
                                costLaunchFilter === 'pending' 
                                    ? 'Custos de Instalação e Logística Pendentes (Provisões)' 
                                    : costLaunchFilter === 'launched'
                                    ? 'Custos de Instalação e Logística Concluídos / Lançados'
                                    : 'Todos os Custos de Instalação e Logística (Provisões)'
                            }
                        </h2>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 font-semibold">
                            {
                                costLaunchFilter === 'pending'
                                    ? 'Selecione uma linha ou clique em Lançar para faturar no Contas a Pagar. Clique em Encerrar para marcar todos os itens como concluídos.'
                                    : costLaunchFilter === 'launched'
                                    ? 'Visualização das provisões que já foram faturadas no Contas a Pagar ou encerradas.'
                                    : 'Lista completa de provisões (pendentes, faturadas e encerradas).'
                            }
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Seletor de Tipo de Lançamento */}
                        <div className="flex items-center gap-1.5 bg-white dark:bg-gray-900 px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded-xl">
                            <span className="text-[10px] font-black text-gray-400 tracking-wide">Exibir:</span>
                            <select 
                                value={costLaunchFilter} 
                                onChange={(e) => setCostLaunchFilter(e.target.value as any)}
                                className="bg-transparent border-none text-[11px] font-bold text-gray-750 dark:text-gray-200 focus:ring-0 p-0 cursor-pointer outline-none"
                            >
                                <option value="pending">Provisões Pendentes</option>
                                <option value="launched">Lançados / Concluídos</option>
                                <option value="all">Todos</option>
                            </select>
                        </div>

                        {/* Campo de Busca */}
                        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-1.5 w-full sm:w-64">
                            <SearchIcon className="w-4 h-4 text-gray-400 shrink-0" />
                            <input 
                                type="text"
                                placeholder="Buscar por cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none text-[11px] font-bold text-gray-700 dark:text-gray-200 focus:ring-0 p-0 w-full outline-none placeholder:text-gray-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full border-separate border-spacing-0">
                        <thead>
                            <tr className="bg-gray-100/50 dark:bg-gray-900/60 text-[10px] font-black text-gray-500 tracking-wider text-left border-b border-gray-200 dark:border-gray-700">
                                <th className="px-5 py-3 sticky left-0 bg-gray-50 dark:bg-gray-900/80 font-black z-10 border-b border-gray-150 dark:border-gray-700">Cliente</th>
                                <th className="px-4 py-3 font-black border-b border-gray-150 dark:border-gray-700">Data</th>
                                <th className="px-4 py-3 font-black text-right border-b border-gray-150 dark:border-gray-700 text-blue-600 dark:text-blue-400">Deslocamento</th>
                                <th className="px-4 py-3 font-black text-right border-b border-gray-150 dark:border-gray-700 text-blue-600 dark:text-blue-400">Pedágio</th>
                                <th className="px-4 py-3 font-black text-right border-b border-gray-150 dark:border-gray-700 text-purple-600 dark:text-purple-400">Instalação</th>
                                <th className="px-4 py-3 font-black text-right border-b border-gray-150 dark:border-gray-700 text-purple-600 dark:text-purple-400">Homologação</th>
                                <th className="px-4 py-3 font-black text-right border-b border-gray-150 dark:border-gray-700 text-amber-600 dark:text-amber-500">Imposto (NF)</th>
                                <th className="px-4 py-3 font-black text-right border-b border-gray-150 dark:border-gray-700">Comissão</th>
                                <th className="px-5 py-3 font-black text-center border-b border-gray-150 dark:border-gray-700 bg-indigo-50/50 dark:bg-indigo-950/25">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-[11px] font-bold text-gray-750 dark:text-gray-300">
                            {filteredBudgets.length > 0 ? (
                                filteredBudgets.map((item) => (
                                    <tr 
                                        key={item.id} 
                                        className={`hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors group ${item.pendingCostsCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                                        onClick={() => item.pendingCostsCount > 0 && handleOpenLaunchModal(item)}
                                    >
                                        <td className="px-5 py-3.5 sticky left-0 bg-white dark:bg-gray-800 font-extrabold text-gray-900 dark:text-white border-b border-gray-100 dark:border-gray-800 shadow-[2px_0_5px_rgba(0,0,0,0.01)]">
                                            <div className="flex flex-col">
                                                <span className={`transition-colors ${item.pendingCostsCount > 0 ? 'group-hover:text-indigo-600 dark:group-hover:text-indigo-400' : ''}`}>{item.clientName}</span>
                                                <span className={`text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded-full w-max mt-1 ${
                                                    item.status === 'Aprovado' 
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' 
                                                        : 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800'
                                                }`}>
                                                    {item.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3.5 text-gray-500 font-semibold border-b border-gray-100 dark:border-gray-800">
                                            {item.date ? new Date(item.date).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '---'}
                                        </td>
                                        
                                        {/* Deslocamento */}
                                        <td className="px-4 py-3.5 text-right font-semibold border-b border-gray-100 dark:border-gray-800">
                                            {(() => {
                                                const cost = item.costs.find(c => c.type === 'deslocamento');
                                                if (!cost || cost.value === 0) return '-';
                                                return (
                                                    <span className={cost.launched ? "line-through text-gray-300 dark:text-gray-600" : "text-gray-600 dark:text-gray-300"}>
                                                        {formatCurrency(cost.value)}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Pedágio */}
                                        <td className="px-4 py-3.5 text-right font-semibold border-b border-gray-100 dark:border-gray-800">
                                            {(() => {
                                                const cost = item.costs.find(c => c.type === 'pedagio');
                                                if (!cost || cost.value === 0) return '-';
                                                return (
                                                    <span className={cost.launched ? "line-through text-gray-300 dark:text-gray-600" : "text-gray-600 dark:text-gray-300"}>
                                                        {formatCurrency(cost.value)}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Instalação */}
                                        <td className="px-4 py-3.5 text-right font-semibold border-b border-gray-100 dark:border-gray-800">
                                            {(() => {
                                                const cost = item.costs.find(c => c.type === 'instalacao');
                                                if (!cost || cost.value === 0) return '-';
                                                return (
                                                    <span className={cost.launched ? "line-through text-gray-300 dark:text-gray-600" : "text-gray-600 dark:text-gray-300"}>
                                                        {formatCurrency(cost.value)}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Homologação */}
                                        <td className="px-4 py-3.5 text-right font-semibold border-b border-gray-100 dark:border-gray-800">
                                            {(() => {
                                                const cost = item.costs.find(c => c.type === 'homologacao');
                                                if (!cost || cost.value === 0) return '-';
                                                return (
                                                    <span className={cost.launched ? "line-through text-gray-300 dark:text-gray-600" : "text-gray-600 dark:text-gray-300"}>
                                                        {formatCurrency(cost.value)}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Imposto */}
                                        <td className="px-4 py-3.5 text-right font-bold border-b border-gray-100 dark:border-gray-800">
                                            {(() => {
                                                const cost = item.costs.find(c => c.type === 'imposto');
                                                if (!cost || cost.value === 0) return '-';
                                                return (
                                                    <span className={cost.launched ? "line-through text-gray-300 dark:text-gray-600" : "text-amber-600 dark:text-amber-500"}>
                                                        {formatCurrency(cost.value)}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Comissão */}
                                        <td className="px-4 py-3.5 text-right font-semibold border-b border-gray-100 dark:border-gray-800">
                                            {(() => {
                                                const cost = item.costs.find(c => c.type === 'comissao');
                                                if (!cost || cost.value === 0) return '-';
                                                return (
                                                    <span className={cost.launched ? "line-through text-gray-300 dark:text-gray-600" : "text-gray-600 dark:text-gray-300"}>
                                                        {formatCurrency(cost.value)}
                                                    </span>
                                                );
                                            })()}
                                        </td>

                                        {/* Ações */}
                                        <td className={`px-5 py-3.5 text-center border-b border-gray-100 dark:border-gray-800 ${item.pendingCostsCount > 0 ? 'bg-indigo-50/20 dark:bg-indigo-950/10' : 'bg-emerald-50/20 dark:bg-emerald-950/10'}`}>
                                            {item.pendingCostsCount > 0 ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenLaunchModal(item);
                                                        }}
                                                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[10px] font-black rounded-lg transition-all shadow-sm tracking-wide"
                                                    >
                                                        Lançar
                                                    </button>
                                                    <button 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDismissProject(item);
                                                        }}
                                                        className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-650 text-gray-700 dark:text-gray-200 active:scale-95 text-[10px] font-black rounded-lg transition-all shadow-sm border border-gray-200 dark:border-gray-600 tracking-wide"
                                                    >
                                                        Encerrar
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
                                                        <CheckCircleIcon className="w-4 h-4 text-emerald-500" /> Concluído
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={9} className="py-20 text-center text-gray-400 font-bold italic bg-white dark:bg-gray-800">
                                        {
                                            costLaunchFilter === 'pending'
                                                ? 'Nenhum projeto com provisões pendentes encontrado para os filtros aplicados.'
                                                : costLaunchFilter === 'launched'
                                                ? 'Nenhum projeto com provisões faturadas/concluídas encontrado para os filtros aplicados.'
                                                : 'Nenhum projeto encontrado para os filtros aplicados.'
                                        }
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Lançamento Automatizado e Integrado */}
            {selectedBudgetToLaunch && (
                <Modal 
                    title={`Lançamento Automatizado: ${selectedBudgetToLaunch.clientName}`} 
                    onClose={() => setSelectedBudgetToLaunch(null)}
                    maxWidth="max-w-4xl"
                >
                    <div className="space-y-6">
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/60 p-4 rounded-xl">
                            <h4 className="text-xs font-black text-indigo-700 dark:text-indigo-400 tracking-wide">Lançar provisões no contas a pagar</h4>
                            <p className="text-[11px] text-indigo-600/90 dark:text-indigo-300 font-semibold mt-1 leading-relaxed">
                                Marque as opções que deseja lançar agora. Cada custo marcado criará uma transação de despesa em aberto (Pendente) na aba Contas a Pagar. Assim que você confirmar, esses itens serão flegados no orçamento e ele sairá dessa tela de controle.
                            </p>
                        </div>

                        <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2">
                            {launchFormState.map((c, index) => (
                                <div 
                                    key={c.type} 
                                    className={`p-4 rounded-xl border-2 transition-all ${
                                        c.enabled 
                                            ? 'bg-white dark:bg-gray-850 border-indigo-500/80 dark:border-indigo-600 shadow-md' 
                                            : 'bg-gray-50/50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800 opacity-60'
                                    }`}
                                >
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        {/* Esquerda: Checkbox + Título */}
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                checked={c.enabled}
                                                onChange={(e) => handleFormValueChange(index, 'enabled', e.target.checked)}
                                                className="w-4.5 h-4.5 text-indigo-600 border-gray-300 dark:border-gray-700 rounded focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <div>
                                                <span className="text-[10px] font-black tracking-wide text-gray-400 block">{c.label}</span>
                                                <input 
                                                    type="text" 
                                                    value={c.description}
                                                    disabled={!c.enabled}
                                                    onChange={(e) => handleFormValueChange(index, 'description', e.target.value)}
                                                    className="bg-transparent border-b border-gray-200 dark:border-gray-700 focus:border-indigo-500 outline-none text-xs font-bold text-gray-800 dark:text-white py-0.5 w-60 md:w-80"
                                                    placeholder="Descrição"
                                                />
                                            </div>
                                        </div>

                                        {/* Direita: Inputs (Vencimento, Conta, Categoria, Valor, Excluir) */}
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1 md:justify-end items-center">
                                            {/* Categoria */}
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 block mb-1">Categoria</label>
                                                <select
                                                    value={c.categoryId}
                                                    disabled={!c.enabled}
                                                    onChange={(e) => handleFormValueChange(index, 'categoryId', e.target.value)}
                                                    className="w-full text-[11px] font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                                                >
                                                    <option value="" disabled>Selecione...</option>
                                                    {categories
                                                        .filter(cat => cat.type === 'despesa')
                                                        .sort((a,b) => a.name.localeCompare(b.name))
                                                        .map(cat => (
                                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                                        ))}
                                                </select>
                                            </div>

                                            {/* Conta de Destino */}
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 block mb-1">Conta/Banco</label>
                                                <select
                                                    value={c.bankId}
                                                    disabled={!c.enabled}
                                                    onChange={(e) => handleFormValueChange(index, 'bankId', e.target.value)}
                                                    className="w-full text-[11px] font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                                                >
                                                    <option value="" disabled>Selecione...</option>
                                                    {bankAccounts.map(bank => (
                                                        <option key={bank.id} value={bank.id}>{bank.accountName}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Data Vencimento */}
                                            <div>
                                                <label className="text-[9px] font-black text-gray-400 block mb-1">Vencimento</label>
                                                <input 
                                                    type="date" 
                                                    value={c.dueDate}
                                                    disabled={!c.enabled}
                                                    onChange={(e) => handleFormValueChange(index, 'dueDate', e.target.value)}
                                                    className="w-full text-[11px] font-bold bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-1 focus:ring-1 focus:ring-indigo-500 outline-none text-gray-800 dark:text-white"
                                                />
                                            </div>

                                            {/* Valor */}
                                            <div className="text-right">
                                                <label className="text-[9px] font-black text-gray-400 block mb-1">Valor</label>
                                                <span className="text-xs font-black text-gray-900 dark:text-white block mt-1.5">
                                                    {formatCurrency(c.value)}
                                                </span>
                                            </div>

                                            {/* Excluir Desta Tela */}
                                            <div className="text-right flex flex-col justify-end">
                                                <label className="text-[9px] font-black text-gray-400 block mb-1 text-center sm:text-right">Ação</label>
                                                <button
                                                    type="button"
                                                    onClick={() => setCostToDismiss({ type: c.type, label: c.label })}
                                                    className="w-full sm:w-auto px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:text-red-400 rounded-lg text-[9px] font-bold border border-red-200 dark:border-red-900/30 transition-colors flex items-center justify-center gap-1 mt-0.5"
                                                    title="Excluir este custo de forma permanente desta tela de controle"
                                                >
                                                    <XCircleIcon className="w-3.5 h-3.5" />
                                                    <span>Excluir</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-4 pt-4 border-t dark:border-gray-700">
                            <button 
                                type="button" 
                                onClick={() => setSelectedBudgetToLaunch(null)} 
                                disabled={isSaving}
                                className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs tracking-wide transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="button" 
                                onClick={handleConfirmLaunch}
                                disabled={isSaving}
                                className="flex-[2] flex items-center justify-center gap-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs tracking-wide shadow-lg shadow-indigo-600/20 active:scale-98 transition-all disabled:opacity-50"
                            >
                                {isSaving ? "Salvando..." : "Confirmar e Lançar no Contas a Pagar"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de Confirmação de Encerramento */}
            {selectedBudgetToDismiss && (
                <Modal
                    title="Confirmar Encerramento"
                    onClose={() => setSelectedBudgetToDismiss(null)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-6 text-center py-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                            <XCircleIcon className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-wide">
                                Deseja mesmo encerrar o orçamento?
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed px-2">
                                O orçamento do cliente <strong className="text-gray-700 dark:text-gray-250">"{selectedBudgetToDismiss.clientName}"</strong> será encerrado e todos os custos restantes serão marcados como concluídos/ignorados. Esta linha sumirá desta lista de controle de provisões.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setSelectedBudgetToDismiss(null)}
                                disabled={isSaving}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs tracking-wide transition-all uppercase"
                            >
                                Não, Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDismissProject}
                                disabled={isSaving}
                                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs tracking-wide shadow-md active:scale-98 transition-all disabled:opacity-50 uppercase"
                            >
                                {isSaving ? "Encerrando..." : "Sim, Encerrar"}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de Confirmação de Exclusão de Custo Individual */}
            {costToDismiss && (
                <Modal
                    title="Confirmar Exclusão de Linha"
                    onClose={() => setCostToDismiss(null)}
                    maxWidth="max-w-md"
                >
                    <div className="space-y-6 text-center py-4">
                        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                            <XCircleIcon className="h-6 w-6" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-sm font-black text-gray-900 dark:text-white tracking-wide">
                                Deseja realmente excluir essa linha?
                            </h3>
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold leading-relaxed px-4">
                                Você está removendo a linha de custo de <strong className="text-gray-700 dark:text-gray-200">"{costToDismiss.label}"</strong> para o cliente <strong className="text-gray-700 dark:text-gray-200">"{selectedBudgetToLaunch?.clientName}"</strong>.
                                <br /><br />
                                Ela não aparecerá mais nesta tela de controle e consulta de fluxo de caixa, mas as informações do orçamento original continuarão salvas de forma íntegra.
                            </p>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setCostToDismiss(null)}
                                className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-600 dark:text-gray-300 rounded-xl font-bold text-xs tracking-wide transition-all"
                            >
                                Não
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const typeToDismiss = costToDismiss.type;
                                    setCostToDismiss(null);
                                    await handleDismissIndividualCost(typeToDismiss);
                                }}
                                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-wide shadow-md active:scale-98 transition-all"
                            >
                                Sim
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default InstalacaoView;
