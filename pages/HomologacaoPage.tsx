
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    DocumentReportIcon, PlusIcon, TrashIcon, 
    EyeIcon, UploadIcon, CheckCircleIcon, 
    XCircleIcon, SearchIcon, CalendarIcon, 
    UsersIcon, ArrowDownIcon, PhotographIcon,
    TableIcon, ClipboardCheckIcon, BoltIcon, 
    ExclamationTriangleIcon, MapPinIcon, HomeIcon,
    CogIcon, ClipboardListIcon, ClockIcon, MapIcon,
    CameraIcon, ArrowLeftIcon, ChevronDownIcon,
    CubeIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import type { HomologacaoEntry, ChecklistEntry, User, ExpenseAttachment, PainelConfig } from '../types';

const ADMIN_PROFILE_ID = '001';

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">{children}</label>
);

const SectionHeader: React.FC<{ icon: React.ReactElement<any>; title: string; color?: string }> = ({ icon, title, color = "bg-indigo-600" }) => (
    <div className="flex items-center gap-2 mb-3 pb-1 border-b border-gray-100 dark:border-gray-700/50">
        <div className={`p-1.5 rounded-lg text-white ${color}`}>
            {React.cloneElement(icon, { className: "w-3.5 h-3.5" })}
        </div>
        <h4 className="text-[10px] font-black text-gray-500 dark:text-gray-400 tracking-wider">{title}</h4>
    </div>
);

const DataRow: React.FC<{ label: string; value: any; color?: string }> = ({ label, value, color = "text-gray-900 dark:text-white" }) => (
    <div className="flex justify-between items-start py-2 border-b border-gray-50 dark:border-gray-800 last:border-0">
        <span className="text-[10px] font-bold text-gray-400 tracking-tight">{label}</span>
        <span className={`text-xs font-black text-right max-w-[60%] ${color}`}>{value || '---'}</span>
    </div>
);

const HomologacaoPage: React.FC<{ currentUser: User; userPermissions: string[]; hasGlobalView?: boolean }> = ({ currentUser, userPermissions, hasGlobalView }) => {
    const [entries, setEntries] = useState<HomologacaoEntry[]>([]);
    const [checkins, setCheckins] = useState<ChecklistEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMainTab, setActiveMainTab] = useState<'pendentes' | 'concluidas'>('pendentes');
    
    const [isModalOpen, setModalOpen] = useState(false);
    const [isViewCheckinModalOpen, setViewCheckinModalOpen] = useState(false);
    const [isConfirmFinalizeModalOpen, setIsConfirmFinalizeModalOpen] = useState(false);
    const [entryToFinalize, setEntryToFinalize] = useState<HomologacaoEntry | null>(null);
    const [activeCheckinStep, setActiveCheckinStep] = useState(1);
    const [selectedCheckin, setSelectedCheckin] = useState<ChecklistEntry | null>(null);
    const [hdPhoto, setHdPhoto] = useState<string | null>(null);

    const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');

    const [form, setForm] = useState<Partial<HomologacaoEntry>>({
        checkinId: '',
        clientName: '',
        status: 'Em Análise',
        files: {
            procuracao: undefined,
            contaEnergia: undefined,
            documentoFoto: undefined
        }
    });

    const handleSuccessModalClose = () => {
        setSuccessModalOpen(false);
    };

    const isAdmin = useMemo(() => {
        return String(currentUser.profileId) === ADMIN_PROFILE_ID || userPermissions.includes('ALL') || hasGlobalView;
    }, [currentUser, userPermissions, hasGlobalView]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [homoData, checkinData] = await Promise.all([
                dataService.getAll<HomologacaoEntry>('homologacao_entries', currentUser.id, isAdmin),
                dataService.getAll<ChecklistEntry>('checklist_checkin', currentUser.id, isAdmin)
            ]);
            setEntries(homoData.sort((a, b) => b.date.localeCompare(a.date)));
            setCheckins(checkinData);
        } catch (e) {
            console.error("Erro ao carregar homologações:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser.id, isAdmin]);

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesSearch = e.clientName.toLowerCase().includes(searchTerm.toLowerCase());
            const isCompleted = e.status === 'Aprovada';
            const matchesTab = activeMainTab === 'concluidas' ? isCompleted : !isCompleted;
            return matchesSearch && matchesTab;
        });
    }, [entries, searchTerm, activeMainTab]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: keyof HomologacaoEntry['files']) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            if (typeof event.target?.result === 'string') {
                const attachment: ExpenseAttachment = {
                    name: file.name,
                    data: event.target.result
                };
                setForm(prev => ({
                    ...prev,
                    files: {
                        ...(prev.files || {}),
                        [field]: attachment
                    }
                }));
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSelectCheckin = (checkinId: string) => {
        const checkin = checkins.find(c => String(c.id) === String(checkinId));
        if (checkin) {
            setForm(prev => ({
                ...prev,
                checkinId: String(checkin.id),
                clientName: checkin.project 
            }));
        } else {
            setForm(prev => ({ ...prev, checkinId: '', clientName: '' }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.checkinId || !form.clientName) return;

        setIsSaving(true);
        try {
            const entry: HomologacaoEntry = {
                id: `homo-${Date.now()}`,
                owner_id: currentUser.id,
                checkinId: form.checkinId!,
                clientName: form.clientName!,
                date: new Date().toISOString(),
                status: 'Em Análise',
                files: form.files as any,
                observations: form.observations
            };

            await dataService.save('homologacao_entries', entry);
            setModalOpen(false);
            setForm({ checkinId: '', clientName: '', status: 'Em Análise', files: {} });
            setModalMessage("Homologação registrada com sucesso!");
            setSuccessModalOpen(true);
            await loadData();
        } catch (e) {
            alert("Erro ao salvar homologação.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmFinalize = async () => {
        if (!entryToFinalize) return;
        setIsSaving(true);
        try {
            await dataService.save('homologacao_entries', { ...entryToFinalize, status: 'Aprovada' });
            setModalMessage("Processo concluído! O registro foi movido para a aba de Concluídas.");
            setSuccessModalOpen(true);
            await loadData();
            setIsConfirmFinalizeModalOpen(false);
            setEntryToFinalize(null);
        } catch (e) {
            alert("Erro ao atualizar status.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Deseja realmente excluir este registro?")) return;
        try {
            await dataService.delete('homologacao_entries', id);
            await loadData();
        } catch (e) {
            alert("Erro ao excluir.");
        }
    };

    const handleViewCheckin = (checkinId: string) => {
        const checkin = checkins.find(c => String(c.id) === String(checkinId));
        if (checkin) {
            setSelectedCheckin(checkin);
            setActiveCheckinStep(1);
            setViewCheckinModalOpen(true);
        } else {
            alert("Dados do Check-in original não encontrados no servidor.");
        }
    };

    const getFileBlob = (file: ExpenseAttachment) => {
        const parts = file.data.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
        return new Blob([uInt8Array], { type: contentType });
    };

    const handleViewFile = (file: ExpenseAttachment) => {
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
        if (isPdf) {
            const blob = getFileBlob(file);
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } else {
            setHdPhoto(file.data);
        }
    };

    const handleDownload = (file: ExpenseAttachment) => {
        const blob = getFileBlob(file);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderFilePreview = (label: string, file?: ExpenseAttachment, field?: keyof HomologacaoEntry['files']) => {
        const isPdf = file?.name.toLowerCase().endsWith('.pdf') || file?.data.startsWith('data:application/pdf');
        
        return (
            <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                <FormLabel>{label}</FormLabel>
                {file ? (
                    <div className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm group">
                        <div className="flex items-center gap-3 overflow-hidden">
                            {isPdf ? (
                                <DocumentReportIcon className="w-6 h-6 text-red-500 shrink-0" />
                            ) : (
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-100">
                                    <img src={file.data} className="w-full h-full object-cover" alt="" />
                                </div>
                            )}
                            <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate">{file.name}</span>
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                            <button type="button" onClick={() => handleViewFile(file)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><EyeIcon className="w-4 h-4" /></button>
                            <button type="button" onClick={() => handleDownload(file)} className="p-1.5 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-all"><ArrowDownIcon className="w-4 h-4" /></button>
                            {field && !isSaving && (
                                <button type="button" onClick={() => setForm(prev => ({ ...prev, files: { ...prev.files, [field]: undefined } }))} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all"><TrashIcon className="w-4 h-4" /></button>
                            )}
                        </div>
                    </div>
                ) : (
                    <label className="flex flex-col items-center justify-center py-6 px-4 bg-white dark:bg-gray-800 border-2 border-dashed border-indigo-100 dark:border-indigo-900 rounded-2xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/20 transition-all group">
                        <UploadIcon className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black text-indigo-600 mt-2">Selecionar arquivo</span>
                        <input type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => field && handleFileUpload(e, field)} />
                    </label>
                )}
            </div>
        );
    };

    const renderCheckinGalleryItem = (label: string, photos: string[] = []) => {
        if (!photos || photos.length === 0) return null;
        return (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 space-y-3">
                <label className="text-[10px] font-black text-gray-400 block tracking-tight">{label}</label>
                <div className="grid grid-cols-4 gap-2">
                    {photos.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden shadow-sm group border border-gray-50 dark:border-gray-700 bg-gray-50">
                            <img src={url} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                                <button onClick={() => setHdPhoto(url)} className="p-1.5 bg-white text-gray-900 rounded-lg shadow-lg hover:bg-indigo-50"><EyeIcon className="w-4 h-4" /></button>
                                <button onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `foto-${label.toLowerCase().replace(/\s/g, '-')}-${idx}.jpg`;
                                    a.click();
                                }} className="p-1.5 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700"><ArrowDownIcon className="w-4 h-4" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20">
                        <DocumentReportIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-800 dark:text-white tracking-tight leading-none">Homologação</h2>
                        <p className="text-[11px] text-gray-400 font-bold mt-2 tracking-tight">Processos de Concessionária</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setForm({ checkinId: '', clientName: '', status: 'Em Análise', files: {} }); setModalOpen(true); }} 
                    className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-indigo-700 transition-all active:scale-95 flex items-center gap-2"
                >
                    <PlusIcon className="w-5 h-5" /> Nova Homologação
                </button>
            </header>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex bg-white dark:bg-gray-800 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <button onClick={() => setActiveMainTab('pendentes')} className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeMainTab === 'pendentes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>Pendentes</button>
                    <button onClick={() => setActiveMainTab('concluidas')} className={`px-6 py-2 rounded-xl font-black text-xs transition-all ${activeMainTab === 'concluidas' ? 'bg-green-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-600'}`}>Concluídas</button>
                </div>

                <div className="relative flex-1 w-full max-w-md">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-sm font-bold shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEntries.map(entry => (
                        <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm hover:shadow-xl transition-all group flex flex-col relative overflow-hidden">
                            <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                    <h4 className="font-black text-gray-800 dark:text-white text-lg leading-tight tracking-tight">{entry.clientName}</h4>
                                    <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5">
                                        <CalendarIcon className="w-3 h-3" /> {new Date(entry.date).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-widest ${
                                    entry.status === 'Aprovada' ? 'bg-green-100 text-green-700' : 
                                    'bg-indigo-50 text-indigo-600'
                                }`}>
                                    {entry.status}
                                </span>
                            </div>

                            <div className="space-y-4 flex-1">
                                <button 
                                    onClick={() => handleViewCheckin(entry.checkinId)}
                                    className="w-full flex items-center justify-between p-3.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-2xl border border-indigo-100 dark:border-indigo-800 hover:bg-indigo-100 transition-all group/btn"
                                >
                                    <div className="flex items-center gap-2">
                                        <ClipboardCheckIcon className="w-5 h-5" />
                                        <span className="text-[11px] font-black tracking-tight">Ver Check-in de Obra</span>
                                    </div>
                                    <EyeIcon className="w-4 h-4 opacity-40 group-hover/btn:opacity-100" />
                                </button>

                                <div className="grid grid-cols-1 gap-2.5">
                                    <p className="text-[9px] font-black text-gray-400 px-1 tracking-tight">Documentação Digital</p>
                                    {entry.files.procuracao && (
                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 group/file">
                                            <div className="flex items-center gap-2"><div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-indigo-500"><DocumentReportIcon className="w-4 h-4" /></div><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Procuração</span></div>
                                            <div className="flex gap-1"><button onClick={() => handleViewFile(entry.files.procuracao!)} className="p-1.5 text-indigo-500 hover:bg-white rounded-lg transition-all shadow-sm group-hover/file:bg-white"><EyeIcon className="w-4 h-4" /></button><button onClick={() => handleDownload(entry.files.procuracao!)} className="p-1.5 text-green-500 hover:bg-white rounded-lg transition-all shadow-sm group-hover/file:bg-white"><ArrowDownIcon className="w-4 h-4" /></button></div>
                                        </div>
                                    )}
                                    {entry.files.contaEnergia && (
                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 group/file">
                                            <div className="flex items-center gap-2"><div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-amber-500"><BoltIcon className="w-4 h-4" /></div><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Conta de Energia</span></div>
                                            <div className="flex gap-1"><button onClick={() => handleViewFile(entry.files.contaEnergia!)} className="p-1.5 text-indigo-500 hover:bg-white rounded-lg transition-all shadow-sm group-hover/file:bg-white"><EyeIcon className="w-4 h-4" /></button><button onClick={() => handleDownload(entry.files.contaEnergia!)} className="p-1.5 text-green-500 hover:bg-white rounded-lg transition-all shadow-sm group-hover/file:bg-white"><ArrowDownIcon className="w-4 h-4" /></button></div>
                                        </div>
                                    )}
                                    {entry.files.documentoFoto && (
                                        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700 group/file">
                                            <div className="flex items-center gap-2"><div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-blue-500"><UsersIcon className="w-4 h-4" /></div><span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">Documento com Foto</span></div>
                                            <div className="flex gap-1"><button onClick={() => handleViewFile(entry.files.documentoFoto!)} className="p-1.5 text-indigo-500 hover:bg-white rounded-lg transition-all shadow-sm group-hover/file:bg-white"><EyeIcon className="w-4 h-4" /></button><button onClick={() => handleDownload(entry.files.documentoFoto!)} className="p-1.5 text-green-500 hover:bg-white rounded-lg transition-all shadow-sm group-hover/file:bg-white"><ArrowDownIcon className="w-4 h-4" /></button></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-gray-50 dark:border-gray-700 flex justify-between items-center">
                                <button onClick={() => handleDelete(entry.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                {entry.status !== 'Aprovada' && (
                                    <button 
                                        onClick={() => { setEntryToFinalize(entry); setIsConfirmFinalizeModalOpen(true); }} 
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl font-black text-[10px] tracking-tighter shadow-md hover:bg-green-700 transition-all active:scale-95"
                                    >
                                        <CheckCircleIcon className="w-4 h-4" /> Finalizar Homologação
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                    {filteredEntries.length === 0 && (
                        <div className="col-span-full py-24 text-center space-y-4">
                            <DocumentReportIcon className="w-16 h-16 text-gray-200 mx-auto" />
                            <p className="text-gray-400 font-black italic">Nenhuma homologação encontrada nesta aba.</p>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <Modal title="Nova Homologação" onClose={() => setModalOpen(false)} maxWidth="max-w-4xl">
                    <form onSubmit={handleSave} className="space-y-6 pt-2 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <FormLabel>Vincular ao Check-in (Projetos Efetivados)</FormLabel>
                                    <select 
                                        required 
                                        value={form.checkinId} 
                                        onChange={e => handleSelectCheckin(e.target.value)} 
                                        className="w-full rounded-2xl border-2 border-indigo-100 bg-white dark:bg-gray-800 p-3.5 text-sm font-black text-gray-800 dark:text-white shadow-sm outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer"
                                    >
                                        <option value="">Selecione o projeto...</option>
                                        {checkins.filter(c => c.status === 'Efetivado' || c.status === 'Finalizado').map(c => (
                                            <option key={c.id} value={c.id}>{c.project} ({new Date(c.date).toLocaleDateString('pt-BR', {timeZone:'UTC'})})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <FormLabel>Nome do Cliente (Conforme Concessionária)</FormLabel>
                                    <input 
                                        required
                                        type="text"
                                        value={form.clientName}
                                        onChange={e => setForm({...form, clientName: e.target.value})}
                                        placeholder="Digite o nome completo do titular..."
                                        className="w-full rounded-2xl border-2 border-indigo-50 bg-gray-50 dark:bg-gray-900 p-3.5 text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all"
                                    />
                                </div>
                            </div>
                            <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-5 rounded-3xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-3">
                                <ExclamationTriangleIcon className="w-8 h-8 text-indigo-500 shrink-0" />
                                <div>
                                    <h4 className="text-[10px] font-black text-indigo-600 mb-1 tracking-tight">Instruções de Envio</h4>
                                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed font-bold">O nome do cliente deve ser exatamente o mesmo que consta na conta de energia. Anexos ilegíveis causam reprovação imediata na concessionária.</p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {renderFilePreview("Procuração Assinada", form.files?.procuracao, 'procuracao')}
                            {renderFilePreview("Conta de Energia", form.files?.contaEnergia, 'contaEnergia')}
                            {renderFilePreview("Documento com Foto", form.files?.documentoFoto, 'documentoFoto')}
                        </div>

                        <div className="flex gap-4 pt-6 border-t dark:border-gray-700">
                            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-2xl font-black text-xs tracking-tight hover:bg-gray-200">Cancelar</button>
                            <button 
                                type="submit" 
                                disabled={isSaving || !form.checkinId || !form.clientName} 
                                className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs tracking-tight shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Gravando...' : 'Iniciar Homologação'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Modal de Confirmação de Finalização */}
            {isConfirmFinalizeModalOpen && entryToFinalize && (
                <Modal title="Efetivar Homologação" onClose={() => setIsConfirmFinalizeModalOpen(false)} maxWidth="max-w-sm">
                    <div className="text-center p-4 space-y-6">
                        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-50 text-green-600">
                            <CheckCircleIcon className="w-10 h-10" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white tracking-tight">Deseja efetivar a operação?</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium leading-relaxed px-4">
                                Ao confirmar, a homologação de <strong>{entryToFinalize.clientName}</strong> será marcada como concluída e movida para a aba de histórico.
                            </p>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setIsConfirmFinalizeModalOpen(false)} className="flex-1 py-3 bg-gray-100 rounded-xl font-bold text-sm text-gray-500">Não, cancelar</button>
                            <button 
                                onClick={handleConfirmFinalize} 
                                disabled={isSaving} 
                                className="flex-1 py-3 bg-green-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-100 hover:bg-green-700 active:scale-95 transition-all"
                            >
                                {isSaving ? '...' : 'Sim, efetivar'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}

            {/* Modal de Visualização Técnica Completa (5 Passos) */}
            {isViewCheckinModalOpen && selectedCheckin && (
                <Modal title={`Dados técnicos: ${selectedCheckin.project}`} onClose={() => setViewCheckinModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="px-1">
                        {/* Indicador de Passos (Idêntico ao original) */}
                        <div className="flex items-center justify-center gap-2 mb-8 bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-inner overflow-x-auto custom-scrollbar">
                            {[1, 2, 3, 4, 5].map(step => (
                                <button key={step} onClick={() => setActiveCheckinStep(step)} className="flex items-center group shrink-0">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${activeCheckinStep === step ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
                                        {step}
                                    </div>
                                    {step < 5 && <div className={`w-4 sm:w-12 h-0.5 mx-1 rounded-full ${activeCheckinStep > step ? 'bg-indigo-400' : 'bg-gray-200 dark:bg-gray-700'}`} />}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar pb-6">
                            {activeCheckinStep === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<CalendarIcon />} title="Identificação da visita" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <DataRow label="Responsável técnico" value={selectedCheckin.responsible} />
                                            <DataRow label="Data da vistoria" value={new Date(selectedCheckin.date).toLocaleDateString('pt-BR', {timeZone:'UTC'})} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<UsersIcon />} title="Dados do titular" color="bg-blue-600" />
                                        <div className="grid grid-cols-1 gap-1">
                                            <DataRow label="Nome do titular" value={selectedCheckin.details?.nomeTitular} />
                                            <DataRow label="E-mail" value={selectedCheckin.details?.emailTitular} />
                                            <DataRow label="WhatsApp" value={selectedCheckin.details?.telefoneTitular} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckinStep === 2 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<MapIcon />} title="Localização da obra" color="bg-teal-600" />
                                        <div className="grid grid-cols-1 gap-1">
                                            <DataRow label="CEP" value={selectedCheckin.details?.cep} />
                                            <DataRow label="Endereço completo" value={selectedCheckin.details?.enderecoCompleto} />
                                            <DataRow label="Cidade/UF" value={`${selectedCheckin.details?.cidade || ''} - ${selectedCheckin.details?.estado || ''}`} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckinStep === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<HomeIcon />} title="Estrutura de telhado" color="bg-orange-600" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                            <DataRow label="Tipo de telhado" value={selectedCheckin.details?.tipoTelhado} />
                                            <DataRow label="Material estrutura" value={selectedCheckin.details?.materialEstrutura} />
                                            <DataRow label="Área útil suficiente?" value={selectedCheckin.details?.areaUtilSuficiente} />
                                            <DataRow label="Sombreamento?" value={selectedCheckin.details?.sombreamento} />
                                            <DataRow label="Aterramento local?" value={selectedCheckin.details?.existeAterramentoNoLocal} />
                                            <DataRow label="Inclinação/orientação" value={selectedCheckin.details?.inclinacaoOrientacao} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<CogIcon />} title="Configuração de painéis" />
                                        <div className="space-y-2">
                                            {(selectedCheckin.details?.paineisConfig || []).map((p: PainelConfig, idx: number) => (
                                                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                                                    <span className="text-[11px] font-black text-indigo-600">Fileira {idx + 1}</span>
                                                    <span className="text-xs font-bold">{p.linhas}L x {p.modulos}M ({p.orientacao})</span>
                                                </div>
                                            ))}
                                            {(selectedCheckin.details?.paineisConfig || []).length === 0 && <p className="text-center py-4 text-xs italic text-gray-400">Nenhum painel configurado.</p>}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckinStep === 4 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<BoltIcon />} title="Padrão de entrada e ligação" color="bg-yellow-500" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
                                            <DataRow label="Classe do cliente" value={selectedCheckin.details?.classeCliente} />
                                            <DataRow label="Tipo de ligação" value={selectedCheckin.details?.tipoLigacaoCliente} />
                                            <DataRow label="Tensão nominal" value={selectedCheckin.details?.tensaoNominal} />
                                            <DataRow label="Cabo transversal" value={selectedCheckin.details?.espessuraCabo} />
                                            <DataRow label="Disjuntor padrão" value={selectedCheckin.details?.correnteDisjuntorPadrao} />
                                            <DataRow label="Ligação de entrada" value={selectedCheckin.details?.tipoLigacaoEntrada} />
                                            <DataRow label="Transformador?" value={selectedCheckin.details?.possuiTransformador} />
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<MapPinIcon />} title="Infraestrutura e distâncias" color="bg-blue-600" />
                                        <div className="grid grid-cols-1 gap-1">
                                            <DataRow label="Distância inversor ao disjuntor" value={selectedCheckin.details?.distanciaInversorDisjuntor} />
                                            <DataRow label="Distância disjuntor ao padrão" value={selectedCheckin.details?.distanciaDisjuntorPadrao} />
                                            <DataRow label="Local de conexão rede" value={selectedCheckin.details?.localConexaoRede} />
                                            <DataRow label="Tipos de tubulação" value={(selectedCheckin.details?.tipoTubulacao || []).join(', ')} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckinStep === 5 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<CubeIcon />} title="Materiais e componentes" color="bg-indigo-600" />
                                        <div className="space-y-2">
                                            {(selectedCheckin.details?.componentesEstoque || []).map((comp: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{comp.name}</span>
                                                    <span className="text-xs font-black text-indigo-600">{comp.qty} un</span>
                                                </div>
                                            ))}
                                            {(selectedCheckin.details?.componentesEstoque || []).length === 0 && <p className="text-center py-4 text-xs italic text-gray-400">Nenhum componente de estoque listado.</p>}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <SectionHeader icon={<CameraIcon />} title="Galeria de fotos do local" color="bg-pink-600" />
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {renderCheckinGalleryItem('Fachada do imóvel', selectedCheckin.details?.fotoFachada)}
                                            {renderCheckinGalleryItem('Ramal de ligação', selectedCheckin.details?.fotoRamal)}
                                            {renderCheckinGalleryItem('Padrão de entrada', selectedCheckin.details?.fotoPadraoEntrada)}
                                            {renderCheckinGalleryItem('Medidor e disjuntor', selectedCheckin.details?.fotoMedidorDisjuntor)}
                                            {renderCheckinGalleryItem('Valor do disjuntor', selectedCheckin.details?.fotoDisjuntorPadrao)}
                                            {renderCheckinGalleryItem('Quadro onde será conectado', selectedCheckin.details?.fotoQuadroInversor)}
                                            {renderCheckinGalleryItem('Vista ampla do telhado', selectedCheckin.details?.fotoAmplaTelhado)}
                                            {renderCheckinGalleryItem('Local de instalação inversor', selectedCheckin.details?.fotoLocalInversor)}
                                        </div>
                                    </div>
                                    
                                    {selectedCheckin.details?.observations && (
                                        <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
                                            <p className="text-[10px] font-black text-gray-400 mb-2 tracking-tight">Observações do técnico</p>
                                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-relaxed italic">"{selectedCheckin.details.observations}"</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t dark:border-gray-700">
                            <button 
                                onClick={() => activeCheckinStep > 1 ? setActiveCheckinStep(prev => prev - 1) : setViewCheckinModalOpen(false)} 
                                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center gap-2"
                            >
                                <ArrowLeftIcon className="w-4 h-4" /> {activeCheckinStep === 1 ? 'Fechar' : 'Voltar'}
                            </button>
                            {activeCheckinStep < 5 ? (
                                <button 
                                    onClick={() => setActiveCheckinStep(prev => prev + 1)} 
                                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"
                                >
                                    Próxima aba <span className="opacity-50">→</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setViewCheckinModalOpen(false)} 
                                    className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-xs shadow-lg"
                                >
                                    Concluir visualização
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {/* Visualização de Foto em HD */}
            {hdPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setHdPhoto(null)}>
                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
                        <button className="absolute top-0 right-0 p-3 text-white hover:text-indigo-400 z-[110]" onClick={(e) => { e.stopPropagation(); setHdPhoto(null); }}><XCircleIcon className="w-10 h-10" /></button>
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden"><img src={hdPhoto} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in" alt="" onClick={(e) => e.stopPropagation()} /></div>
                        <div className="flex gap-4">
                            <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = hdPhoto; a.download = 'anexo-homologacao.jpg'; a.click(); }} className="px-8 py-2 bg-indigo-600 text-white rounded-full font-black text-xs uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><ArrowDownIcon className="w-4 h-4" /> Download em alta definição</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Sucesso */}
            {isSuccessModalOpen && (
                <Modal title="" onClose={handleSuccessModalClose}>
                    <div className="text-center py-10 space-y-6 animate-fade-in">
                        <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce shadow-lg shadow-green-100">
                            <CheckCircleIcon className="w-12 h-12" />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 tracking-tight">Sucesso!</h3>
                            <p className="text-sm font-bold text-gray-500 px-8 leading-relaxed">{modalMessage}</p>
                        </div>
                        <button onClick={handleSuccessModalClose} className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black text-xs shadow-xl hover:bg-black transition-all">Continuar</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default HomologacaoPage;
