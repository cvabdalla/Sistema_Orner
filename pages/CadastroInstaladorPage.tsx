import React, { useState, useEffect } from 'react';
import { 
    PlusIcon, TrashIcon, EditIcon, UsersIcon, SaveIcon, 
    MapPinIcon, PhoneIcon, SearchIcon, XCircleIcon
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
    const [searchTerm, setSearchTerm] = useState('');

    const [form, setForm] = useState({
        nome: '',
        whatsapp: '',
        documento: '',
        cep: '',
        endereco: '',
        bairro: '',
        numero: '',
        cidade: '',
        uf: '',
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

    const formatWhatsApp = (value: string) => {
        const clean = value.replace(/\D/g, '');
        if (clean.length === 0) return '';
        if (clean.length <= 2) {
            return `(${clean}`;
        }
        if (clean.length <= 6) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
        }
        if (clean.length <= 10) {
            return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6, 10)}`;
        }
        return `(${clean.slice(0, 2)}) ${clean.slice(2, 3)} ${clean.slice(3, 7)}-${clean.slice(7, 11)}`;
    };

    const handleOpenModal = (item?: Instalador) => {
        if (item) {
            setEditingItem(item);
            setForm({
                nome: item.nome,
                whatsapp: item.whatsapp || '',
                documento: item.documento || '',
                cep: item.cep || '',
                endereco: item.endereco || '',
                bairro: item.bairro || '',
                numero: item.numero || '',
                cidade: item.cidade || '',
                uf: item.uf || '',
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
                bairro: '',
                numero: '',
                cidade: '',
                uf: '',
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
            // Preserva o valor de KM se estiver editando, senão assume o padrão de 1.20 para compatibilidade interna
            const valorKm = editingItem ? (editingItem.valor_km ?? 1.20) : 1.20;

            const data: Instalador = {
                id: editingItem ? editingItem.id : `inst-${Date.now()}`,
                owner_id: currentUser.id,
                nome: form.nome,
                whatsapp: form.whatsapp,
                documento: form.documento,
                cep: form.cep,
                endereco: form.endereco,
                bairro: form.bairro,
                numero: form.numero,
                cidade: form.cidade,
                uf: form.uf,
                valor_km: valorKm,
                ativo: form.ativo,
                observacoes: form.observacoes
            };
            await dataService.save('instaladores', data);
            setIsModalOpen(false);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar parceiro instalador.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Deseja realmente excluir este parceiro?')) {
            try {
                await dataService.delete('instaladores', id);
                await loadData();
            } catch (e) {
                alert("Erro ao excluir parceiro instalador.");
            }
        }
    };

    const handleFetchCEP = async () => {
        const cleanCEP = form.cep.replace(/\D/g, '');
        if (cleanCEP.length !== 8) return;

        try {
            const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
            const data = await res.json();
            if (!data.erro) {
                setForm(prev => ({
                    ...prev,
                    endereco: data.logradouro || '',
                    bairro: data.bairro || '',
                    cidade: data.localidade || '',
                    uf: data.uf || ''
                }));
            }
        } catch (e) {
            console.warn("Erro ao carregar dados do cep:", e);
        }
    };

    const filteredInstaladores = instaladores.filter(inst => {
        const term = searchTerm.toLowerCase();
        return (
            inst.nome.toLowerCase().includes(term) ||
            (inst.cidade || '').toLowerCase().includes(term) ||
            (inst.documento || '').toLowerCase().includes(term)
        );
    });

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            </div>
        );
    }    const totalParceiros = instaladores.length;
    const ativosCount = instaladores.filter(i => i.ativo).length;
    const inativosCount = totalParceiros - ativosCount;

    const getInitials = (nome: string) => {
        if (!nome) return '??';
        const parts = nome.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans text-gray-800 dark:text-gray-100">
            {/* Header com Design Premium e Moderno */}
            <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 gap-6 transition-all">
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl text-indigo-600 dark:text-indigo-400">
                            <UsersIcon className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">
                                Parceiros Instaladores
                            </h2>
                            <p className="text-xs text-gray-550 dark:text-gray-400 font-medium mt-1">
                                Gerencie contatos, bases operacionais e tarifas mínimas de profissionais credenciados.
                            </p>
                        </div>
                    </div>

                    {/* Stats Highlights em formato de badges premium */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400 border border-gray-100 dark:border-gray-800/80">
                            📁 <strong className="text-gray-900 dark:text-white">{totalParceiros}</strong> Total
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/10">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-405 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-550"></span>
                            </span>
                            <strong className="text-emerald-800 dark:text-emerald-300">{ativosCount}</strong> Ativos
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100/60 dark:bg-gray-900/70 text-gray-500 dark:text-gray-400 border border-transparent">
                            ⚪ <strong className="text-gray-700 dark:text-gray-300">{inativosCount}</strong> Inativos
                        </span>
                    </div>
                </div>

                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all cursor-pointer w-full xl:w-auto justify-center"
                >
                    <PlusIcon className="w-4.5 h-4.5" /> Novo Instalador
                </button>
            </header>

            {/* Barra de Filtros e Busca */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:max-w-md">
                    <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, cidade ou documento..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full text-xs font-semibold rounded-xl border border-gray-150 dark:border-gray-750 bg-gray-50/50 dark:bg-gray-900/50 p-3 pl-10 pr-8 outline-none text-gray-800 dark:text-white focus:bg-white dark:focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/15 focus:border-indigo-500 transition-all"
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                            <XCircleIcon className="w-4.5 h-4.5" />
                        </button>
                    )}
                </div>
                <div className="text-[11px] font-bold text-gray-400 dark:text-gray-500 tracking-wide bg-gray-50 dark:bg-gray-900/30 px-3 py-1.5 rounded-xl border border-gray-100/40 dark:border-gray-800/20">
                    Filtro básico: {filteredInstaladores.length} encontrados
                </div>
            </div>

            {/* Lista Grid Bento Premium de Parceiros */}
            {filteredInstaladores.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-16 text-center border border-gray-100 dark:border-gray-700/80 flex flex-col items-center justify-center gap-4 transition-all">
                    <div className="w-16 h-16 bg-gray-50 dark:bg-gray-900 rounded-2xl flex items-center justify-center text-gray-400 text-2xl shadow-sm">
                        📭
                    </div>
                    <div className="space-y-1">
                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200">Nenhum parceiro encontrado</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-450 max-w-sm mx-auto">
                            Experimente ajustar os termos da busca ou adicione um novo instalador para iniciar.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredInstaladores.map(item => {
                        const initials = getInitials(item.nome);
                        return (
                            <div 
                                key={item.id} 
                                className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-lg hover:border-indigo-150 dark:hover:border-gray-650 hover:-translate-y-0.5 transition-all flex flex-col justify-between group relative overflow-hidden"
                            >
                                <div className="space-y-5">
                                    {/* Topo do Card - Avatar, Nome e Pulsating Status */}
                                    <div className="flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-2xl font-bold text-sm tracking-widest flex items-center justify-center shrink-0 shadow-inner ${
                                            item.ativo 
                                                ? 'bg-gradient-to-tr from-indigo-500 to-violet-600 text-white shadow-indigo-500/10' 
                                                : 'bg-gray-100 text-gray-400 dark:bg-gray-700/85 dark:text-gray-300'
                                        }`}>
                                            {initials}
                                        </div>
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex justify-between items-start gap-2">
                                                <h3 className="text-base font-extrabold text-gray-900 dark:text-white tracking-tight leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                                                    {item.nome}
                                                </h3>
                                                <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                                                    item.ativo 
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/10' 
                                                        : 'bg-gray-50 text-gray-400 dark:bg-gray-900/30 border border-transparent'
                                                }`}>
                                                    {item.ativo && (
                                                        <span className="relative flex h-1.5 w-1.5">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                                        </span>
                                                    )}
                                                    {item.ativo ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-gray-450 dark:text-gray-500 font-bold tracking-wider uppercase">
                                                ID: {item.id}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Linha Divisória */}
                                    <div className="h-px bg-gray-50 dark:bg-gray-750" />

                                    {/* Informações de contato organizadas */}
                                    <div className="space-y-3 text-xs">
                                        
                                        {/* CPF/CNPJ */}
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-905 px-2 py-1 rounded border border-gray-100 dark:border-gray-800">
                                                Doc
                                            </span>
                                            <span className="font-semibold text-gray-700 dark:text-gray-300">
                                                {item.documento || 'Vazio / Não informado'}
                                            </span>
                                        </div>

                                        {/* Telefone / WhatsApp */}
                                        {item.whatsapp && (
                                            <div className="flex items-center gap-3">
                                                <div className="p-1 px-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded text-indigo-600 dark:text-indigo-400">
                                                    <PhoneIcon className="w-4 h-4 shrink-0" />
                                                </div>
                                                <a 
                                                    href={`https://wa.me/${item.whatsapp.replace(/\D/g, '')}`} 
                                                    target="_blank" 
                                                    referrerPolicy="no-referrer"
                                                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer truncate"
                                                    title="Clique para conversar"
                                                >
                                                    {item.whatsapp}
                                                    <span className="text-[10px] font-semibold text-indigo-455 opacity-70">💬 (WhatsApp)</span>
                                                </a>
                                            </div>
                                        )}

                                        {/* Endereço Base */}
                                        <div className="flex items-start gap-3">
                                            <div className="p-1 px-1.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                <MapPinIcon className="w-4 h-4 shrink-0" />
                                            </div>
                                            <div className="font-medium text-gray-650 dark:text-gray-300 leading-relaxed min-w-0 flex-1">
                                                <span className="block truncate">
                                                    {item.endereco ? `${item.endereco}${item.numero ? `, nº ${item.numero}` : ''}${item.bairro ? ` - ${item.bairro}` : ''}` : 'Endereço sem cadastro'}
                                                </span>
                                                {(item.cidade || item.uf) && (
                                                    <span className="block text-[11px] font-bold text-gray-500 dark:text-gray-450 mt-1">
                                                        📍 {item.cidade || ''} - {item.uf || ''} {item.cep ? `• CEP: ${item.cep}` : ''}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Observações */}
                                    {item.observacoes && (
                                        <div className="bg-gray-50/60 dark:bg-gray-900/40 p-3 rounded-2xl border border-gray-100/50 dark:border-gray-800/40 text-[11px] text-gray-550 dark:text-gray-400 leading-relaxed italic relative">
                                            <span className="font-bold pr-1 not-italic">Ref:</span> "{item.observacoes}"
                                        </div>
                                    )}
                                </div>

                                {/* Ações do Card */}
                                <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-750 flex items-center justify-end gap-2">
                                    <button 
                                        onClick={() => handleOpenModal(item)} 
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-500 hover:text-indigo-650 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 rounded-xl transition-all cursor-pointer"
                                        title="Editar parceiro"
                                        id={`btn-edit-${item.id}`}
                                    >
                                        <EditIcon className="w-4 h-4" /> <span>Editar</span>
                                    </button>
                                    <button 
                                        onClick={() => handleDelete(item.id)} 
                                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-all cursor-pointer"
                                        title="Excluir parceiro"
                                        id={`btn-del-${item.id}`}
                                    >
                                        <TrashIcon className="w-4 h-4" /> <span>Excluir</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Cadastro / Edição Modernizado e Elegante */}
            {isModalOpen && (
                <Modal 
                    title={editingItem ? "Editar parceiro" : "Cadastrar novo parceiro"} 
                    onClose={() => setIsModalOpen(false)}
                    maxWidth="max-w-2xl"
                >
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            
                            {/* Nome Completo */}
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Nome completo / Razão social *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.nome}
                                    onChange={e => setForm(prev => ({ ...prev, nome: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Ex: Ricardo Silva Martins"
                                />
                            </div>

                            {/* Documento */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Documento (CPF / CNPJ)
                                </label>
                                <input
                                    type="text"
                                    value={form.documento}
                                    onChange={e => setForm(prev => ({ ...prev, documento: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Ex: 000.000.000-00 ou CNPJ"
                                />
                            </div>

                            {/* WhatsApp */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    WhatsApp / Telefone de contato *
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        required
                                        value={form.whatsapp}
                                        onChange={e => {
                                            const formatted = formatWhatsApp(e.target.value);
                                            setForm(prev => ({ ...prev, whatsapp: formatted }));
                                        }}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400 pr-10"
                                        placeholder="Ex: (11) 99999-9999"
                                    />
                                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm select-none pointer-events-none opacity-80">📱</span>
                                </div>
                            </div>

                            {/* Divisor Visível */}
                            <div className="md:col-span-2 py-1">
                                <div className="h-px bg-gray-100 dark:bg-gray-750" />
                            </div>

                            {/* CEP Buscar */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    CEP base
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={form.cep}
                                        onChange={e => setForm(prev => ({ ...prev, cep: e.target.value }))}
                                        onBlur={handleFetchCEP}
                                        className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400 text-center"
                                        placeholder="00000-000"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleFetchCEP}
                                        className="px-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 text-gray-600 dark:text-gray-300 rounded-xl font-bold transition-all text-xs border border-gray-200 dark:border-gray-700 cursor-pointer shrink-0 active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
                                    >
                                        <SearchIcon className="w-3.5 h-3.5" /> Buscar
                                    </button>
                                </div>
                            </div>

                            {/* Logradouro / Rua */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Rua / Endereço completo
                                </label>
                                <input
                                    type="text"
                                    value={form.endereco}
                                    onChange={e => setForm(prev => ({ ...prev, endereco: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Av. Paulista, etc"
                                />
                            </div>

                            {/* Número */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Número
                                </label>
                                <input
                                    type="text"
                                    value={form.numero}
                                    onChange={e => setForm(prev => ({ ...prev, numero: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Ex: 1045"
                                />
                            </div>

                            {/* Bairro */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Bairro
                                </label>
                                <input
                                    type="text"
                                    value={form.bairro}
                                    onChange={e => setForm(prev => ({ ...prev, bairro: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Ex: Bela Vista"
                                />
                            </div>

                            {/* Cidade */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Cidade
                                </label>
                                <input
                                    type="text"
                                    value={form.cidade}
                                    onChange={e => setForm(prev => ({ ...prev, cidade: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Ex: São Paulo"
                                />
                            </div>

                            {/* UF */}
                            <div>
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Estado (UF)
                                </label>
                                <input
                                    type="text"
                                    maxLength={2}
                                    value={form.uf}
                                    onChange={e => setForm(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 placeholder-gray-400"
                                    placeholder="Ex: SP"
                                />
                            </div>

                            {/* Status Ativo */}
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5">
                                    Status do cadastro (Disponibilidade)
                                </label>
                                <select
                                    value={form.ativo ? 'true' : 'false'}
                                    onChange={e => setForm(prev => ({ ...prev, ativo: e.target.value === 'true' }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-bold shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 cursor-pointer"
                                >
                                    <option value="true">🟢 Ativo (Habilitar para orçamentos e fretes)</option>
                                    <option value="false">🔴 Inativo (Desabilitar de orçamentos e fretes)</option>
                                </select>
                            </div>

                            {/* Observações / Notas */}
                            <div className="md:col-span-2">
                                <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 font-sans">
                                    Observações / especificações técnicas
                                </label>
                                <textarea
                                    value={form.observacoes}
                                    rows={2}
                                    onChange={e => setForm(prev => ({ ...prev, observacoes: e.target.value }))}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800/80 px-3 py-2 text-xs font-medium shadow-sm outline-none transition-all hover:border-gray-300 dark:hover:border-gray-650 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 resize-none min-h-[70px]"
                                    placeholder="Detalhes sobre ferramentas especiais, distâncias máximas de atendimento ou taxas específicas..."
                                />
                            </div>

                        </div>

                        {/* Ações do Formulário de acordo com o Cadastro de Produtos */}
                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-750">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="px-5 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 text-gray-500 dark:text-gray-400 rounded-xl font-bold text-xs transition-all border border-gray-200 dark:border-gray-700 shadow-sm"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/15 hover:shadow-indigo-600/25 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSaving ? 'Salvando...' : (editingItem ? 'Salvar alterações' : 'Salvar novo parceiro')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CadastroInstaladorPage;
