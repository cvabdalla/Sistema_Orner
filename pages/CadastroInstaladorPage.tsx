import React, { useState, useEffect } from 'react';
import { 
    PlusIcon, TrashIcon, EditIcon, UsersIcon, SaveIcon 
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import type { Instalador, User } from '../types';

const CadastroInstaladorPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [instaladores, setInstaladores] = useState<Instalador[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Instalador | null>(null);

    // Estado do simulador rápido
    const [simulador, setSimulador] = useState({
        instaladorId: '',
        distanciaKm: 0,
        pedagio: 0,
        quantidadeDias: 1,
        idaEVolta: true
    });
    const [simulacaoResultado, setSimulacaoResultado] = useState<number | null>(null);

    const [form, setForm] = useState({
        nome: '',
        whatsapp: '',
        documento: '',
        cep: '',
        endereco: '',
        cidade: '',
        uf: '',
        valor_km: 1.50,
        ativo: true,
        observacoes: ''
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const data = await dataService.getAll<Instalador>('instaladores', currentUser.id, true);
            setInstaladores(data.sort((a, b) => a.nome.localeCompare(b.nome)));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser.id]);

    const handleOpenModal = (item?: Instalador) => {
        if (item) {
            setEditingItem(item);
            setForm({
                nome: item.nome,
                whatsapp: item.whatsapp,
                documento: item.documento,
                cep: item.cep,
                endereco: item.endereco,
                cidade: item.cidade,
                uf: item.uf,
                valor_km: item.valor_km || 1.50,
                ativo: item.ativo !== false,
                observacoes: item.observacoes || ''
            });
        } else {
            setEditingItem(null);
            setForm({
                nome: '',
                whatsapp: '',
                documento: '',
                cep: '',
                endereco: '',
                cidade: '',
                uf: '',
                valor_km: 1.50,
                ativo: true,
                observacoes: ''
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nome.trim()) return;
        
        setIsSaving(true);
        try {
            const data: Instalador = {
                id: editingItem ? editingItem.id : `inst-${Date.now()}`,
                owner_id: currentUser.id,
                nome: form.nome,
                whatsapp: form.whatsapp,
                documento: form.documento,
                cep: form.cep,
                endereco: form.endereco,
                cidade: form.cidade,
                uf: form.uf,
                valor_km: Number(form.valor_km) || 0,
                ativo: form.ativo,
                observacoes: form.observacoes
            };
            await dataService.save('instaladores', data);
            setIsModalOpen(false);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar instalador.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Deseja realmente excluir este instalador?')) {
            try {
                await dataService.delete('instaladores', id);
                await loadData();
            } catch (e) {
                alert("Erro ao excluir o instalador de placas.");
            }
        }
    };

    const formatCurrency = (val: number) => {
        return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const handleSimular = () => {
        const selected = instaladores.find(i => i.id === simulador.instaladorId);
        if (!selected) {
            setSimulacaoResultado(null);
            return;
        }
        const vKm = selected.valor_km || 0;
        const fatorIdaVolta = simulador.idaEVolta ? 2 : 1;
        const totalTravel = simulador.distanciaKm * fatorIdaVolta * vKm * simulador.quantidadeDias;
        const finalCost = totalTravel + Number(simulador.pedagio || 0);
        setSimulacaoResultado(finalCost);
    };

    useEffect(() => {
        if (simulador.instaladorId) {
            handleSimular();
        } else {
            setSimulacaoResultado(null);
        }
    }, [simulador]);

    const handleFetchCEP = async () => {
        const cleanCEP = form.cep.replace(/\D/g, '');
        if (cleanCEP.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setForm(prev => ({
                    ...prev,
                    endereco: `${data.logradouro}${data.bairro ? `, ${data.bairro}` : ''}`,
                    cidade: data.localidade,
                    uf: data.uf
                }));
            }
        } catch (e) {
            console.warn("Erro ao carregar dados do CEP:", e);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <UsersIcon className="w-6 h-6 text-indigo-500" /> Cadastro de Instaladores
                    </h2>
                    <p className="text-xs text-gray-500 font-medium">Cadastre os parceiros de instalação para permitir a estimativa de distância e custos de viagem automaticamente em novos orçamentos.</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <PlusIcon className="w-4 h-4" /> Novo Instalador
                </button>
            </header>

            {/* Grid Principal - Esquerda: Lista de Instaladores | Direita: Simulador Rápido de Custos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Lista de Instaladores */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300">Instaladores cadastrados</h3>
                        </div>
                        
                        {instaladores.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 dark:text-gray-400 text-xs">
                                Nenhum instalador cadastrado no momento. Clique em "Novo Instalador" para começar!
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                                {instaladores.map(item => (
                                    <div key={item.id} className="p-5 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:bg-gray-50/50 dark:hover:bg-gray-900/10 transition-colors group">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-gray-800 dark:text-white">{item.nome}</span>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${item.ativo ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' : 'bg-red-50 text-red-600 dark:bg-red-950/30'}`}>
                                                    {item.ativo ? 'ATIVO' : 'INATIVO'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
                                                <p><span className="font-semibold text-gray-600 dark:text-gray-400">Doc:</span> {item.documento || 'Não informado'}</p>
                                                <p><span className="font-semibold text-gray-600 dark:text-gray-400">WhatsApp:</span> {item.whatsapp || 'Não informado'}</p>
                                                <p className="sm:col-span-2"><span className="font-semibold text-gray-600 dark:text-gray-400">Origem:</span> {item.endereco ? `${item.endereco}, ` : ''}{item.cidade ? `${item.cidade}-${item.uf}` : 'Não informado'}</p>
                                                <p className="sm:col-span-2 font-bold text-indigo-650 dark:text-indigo-450">Valor/KM Rodado: {formatCurrency(item.valor_km || 0)}</p>
                                            </div>
                                            {item.observacoes && (
                                                <p className="text-[11px] text-gray-400 dark:text-gray-500 italic mt-1 bg-gray-50/50 dark:bg-gray-950/20 p-2 rounded-lg border border-gray-100/50 dark:border-gray-800/10">" {item.observacoes} "</p>
                                            )}
                                        </div>
                                        
                                        <div className="flex items-center gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity self-end sm:self-center">
                                            <button 
                                                onClick={() => handleOpenModal(item)} 
                                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-lg transition-all"
                                                title="Editar instalador"
                                                id={`btn-edit-inst-${item.id}`}
                                            >
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id)} 
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all"
                                                title="Excluir instalador"
                                                id={`btn-del-inst-${item.id}`}
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Simulador Rápido de Custos */}
                <div className="space-y-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 space-y-4">
                        <div className="border-b border-gray-100 dark:border-gray-700 pb-3">
                            <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <span className="p-1 rounded bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 block">🚗</span> Calculadora de Deslocamento
                            </h3>
                            <p className="text-[10px] text-gray-450 mt-0.5">Veja instantaneamente uma estimativa de gastos de viagem e transporte do instalador.</p>
                        </div>

                        {instaladores.length === 0 ? (
                            <p className="text-xs text-center p-4 text-gray-500">Cadastre instaladores primeiro para usar o simulador.</p>
                        ) : (
                            <div className="space-y-3.5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-500 dark:text-gray-400">Instalador</label>
                                    <select
                                        value={simulador.instaladorId}
                                        onChange={e => setSimulador(prev => ({ ...prev, instaladorId: e.target.value }))}
                                        className="w-full text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 outline-none dark:text-white"
                                    >
                                        <option value="">Selecione um instalador...</option>
                                        {instaladores.filter(i => i.ativo).map(i => (
                                            <option key={i.id} value={i.id}>{i.nome} ({formatCurrency(i.valor_km)}/km)</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 dark:text-gray-400">Distância (km)</label>
                                        <input
                                            type="number"
                                            value={simulador.distanciaKm || ''}
                                            onChange={e => setSimulador(prev => ({ ...prev, distanciaKm: parseFloat(e.target.value) || 0 }))}
                                            className="w-full text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 outline-none dark:text-white"
                                            placeholder="Ex: 45"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 dark:text-gray-400 font-bold">Pedágio (R$)</label>
                                        <input
                                            type="number"
                                            value={simulador.pedagio || ''}
                                            onChange={e => setSimulador(prev => ({ ...prev, pedagio: parseFloat(e.target.value) || 0 }))}
                                            className="w-full text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 outline-none dark:text-white"
                                            placeholder="Ex: 12.50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 items-center pt-1.5">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-500 dark:text-gray-400">Qtd de Dias / Viagens</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={simulador.quantidadeDias}
                                            onChange={e => setSimulador(prev => ({ ...prev, quantidadeDias: parseInt(e.target.value) || 1 }))}
                                            className="w-full text-xs font-semibold rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 outline-none dark:text-white"
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 mt-4 cursor-pointer text-xs">
                                        <input
                                            type="checkbox"
                                            checked={simulador.idaEVolta}
                                            onChange={e => setSimulador(prev => ({ ...prev, idaEVolta: e.target.checked }))}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                                        />
                                        <span className="font-semibold text-gray-600 dark:text-gray-400">Considerar Ida e Volta</span>
                                    </label>
                                </div>

                                {simulacaoResultado !== null && (
                                    <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100/30 dark:border-indigo-850/20 text-center mt-4">
                                        <p className="text-[10px] text-gray-500 dark:text-indigo-300 font-bold tracking-wider">Custo viagem estimado</p>
                                        <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{formatCurrency(simulacaoResultado)}</p>
                                        
                                        <div className="mt-2 pt-2 border-t border-indigo-100/50 dark:border-indigo-900/40 text-[10px] text-gray-450 flex justify-between">
                                            <span>KM Total: {simulador.distanciaKm * (simulador.idaEVolta ? 2 : 1) * simulador.quantidadeDias} km</span>
                                            <span>KM Custo: {formatCurrency((instaladores.find(i => i.id === simulador.instaladorId)?.valor_km || 0))}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

            </div>

            {/* Modal de Cadastro / Edição */}
            {isModalOpen && (
                <Modal 
                    title={editingItem ? "Editar Instalador" : "Cadastrar Novo Instalador"} 
                    onClose={() => setIsModalOpen(false)}
                >
                    <form onSubmit={handleSave} className="space-y-4 text-xs font-sans">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            
                            <div className="space-y-1 sm:col-span-2">
                                <label className="block text-[10px] font-black text-gray-500">Nome Completo *</label>
                                <input
                                    type="text"
                                    required
                                    value={form.nome}
                                    onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                    placeholder="Ex: Ricardo Silva Martins"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">CPF / CNPJ</label>
                                <input
                                    type="text"
                                    value={form.documento}
                                    onChange={e => setForm(prev => ({ ...prev, documento: e.target.value }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                    placeholder="000.000.000-00 ou 00.000.000/0001-00"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">WhatsApp / Telefone</label>
                                <input
                                    type="text"
                                    value={form.whatsapp}
                                    onChange={e => setForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                    placeholder="(11) 99999-9999"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">CEP</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={form.cep}
                                        onChange={e => setForm(prev => ({ ...prev, cep: e.target.value }))}
                                        onBlur={handleFetchCEP}
                                        className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                        placeholder="00000-000"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleFetchCEP}
                                        className="px-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl font-bold transition-all text-[11px]"
                                    >
                                        Buscar
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">Valor Cobrado / KM rodado (R$) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={form.valor_km}
                                    onChange={e => setForm(prev => ({ ...prev, valor_km: parseFloat(e.target.value) || 0 }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-indigo-650 dark:text-indigo-400 font-bold"
                                    placeholder="Ex: 1.50"
                                />
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                                <label className="block text-[10px] font-black text-gray-500">Endereço (Rua, Número, Bairro)</label>
                                <input
                                    type="text"
                                    value={form.endereco}
                                    onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                    placeholder="Av. Paulista, 1000 - Bela Vista"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">Cidade</label>
                                <input
                                    type="text"
                                    value={form.cidade}
                                    onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                    placeholder="São Paulo"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">Estado (UF)</label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={form.uf}
                                    onChange={e => setForm(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                    placeholder="SP"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="block text-[10px] font-black text-gray-500">Status</label>
                                <select
                                    value={form.ativo ? 'true' : 'false'}
                                    onChange={e => setForm(prev => ({ ...prev, ativo: e.target.value === 'true' }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold"
                                >
                                    <option value="true">Ativo</option>
                                    <option value="false">Inativo</option>
                                </select>
                            </div>

                            <div className="space-y-1 sm:col-span-2">
                                <label className="block text-[10px] font-black text-gray-500">Observações</label>
                                <textarea
                                    value={form.observacoes}
                                    onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                                    className="w-full rounded-xl bg-white dark:bg-gray-900 p-2.5 border border-gray-200 dark:border-gray-700 outline-none focus:ring-2 focus:ring-indigo-500/20 text-xs text-gray-800 dark:text-white font-semibold min-h-[60px]"
                                    placeholder="Qualquer detalhe, experiência, ferramentas ou custos fixos adicionados por viagem."
                                />
                            </div>

                        </div>

                        <button
                            type="submit"
                            disabled={isSaving}
                            className={`w-full flex items-center justify-center gap-1.5 py-3 ${isSaving ? 'bg-gray-400 grayscale cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'} text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/10`}
                        >
                            <SaveIcon className="w-4 h-4" /> 
                            <span>{isSaving ? 'Salvando...' : 'Gravar parceiro instalador'}</span>
                        </button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CadastroInstaladorPage;
