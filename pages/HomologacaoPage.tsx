
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
    CubeIcon, EditIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import type { HomologacaoEntry, ChecklistEntry, User, ExpenseAttachment, PainelConfig, UserProfile } from '../types';

const ADMIN_PROFILE_IDS = ['001', '00000000-0000-0000-0000-000000000001'];

const toSentenceCase = (str: string) => {
    if (!str) return '';
    const clean = str.toLowerCase();
    return clean.charAt(0).toUpperCase() + clean.slice(1);
};

const compressImage = (file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(event.target?.result as string);
                    return;
                }
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => {
                resolve(event.target?.result as string);
            };
        };
        reader.onerror = () => {
            resolve('');
        };
    });
};

const FormLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1 ml-0.5 tracking-tight">{children}</label>
);

const SectionHeader: React.FC<{ icon: React.ReactElement<any>; title: string; color?: string }> = ({ icon, title, color = "bg-indigo-600" }) => (
    <div className="flex items-center gap-2 mb-4 pb-1.5 border-b border-gray-100 dark:border-gray-800/80">
        <div className={`p-1.5 rounded-lg text-white ${color} shrink-0`}>
            {React.cloneElement(icon, { className: "w-3.5 h-3.5" })}
        </div>
        <h4 className="text-[10px] font-black text-gray-400 dark:text-gray-500 tracking-wider">{title}</h4>
    </div>
);

const DataRow: React.FC<{ label: string; value: any; color?: string }> = ({ label, value, color = "text-gray-900 dark:text-white" }) => (
    <div className="flex justify-between items-center py-2.5 border-b border-gray-55 dark:border-gray-800/40 last:border-0 hover:bg-gray-50/20 px-1 rounded-sm transition-all">
        <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tracking-tight leading-none">{label}</span>
        <span className={`text-xs font-semibold text-right max-w-[65%] truncate ${color}`}>{value || '---'}</span>
    </div>
);

const HomologacaoPage: React.FC<{ currentUser: User; userPermissions: string[]; hasGlobalView?: boolean }> = ({ currentUser, userPermissions, hasGlobalView }) => {
    const [entries, setEntries] = useState<HomologacaoEntry[]>([]);
    const [checkins, setCheckins] = useState<ChecklistEntry[]>([]);
    const [systemUsers, setSystemUsers] = useState<User[]>([]);
    const [homologationUsers, setHomologationUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeMainTab, setActiveMainTab] = useState<'pendentes' | 'concluidas'>('pendentes');
    
    const [isModalOpen, setModalOpen] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [isViewCheckinModalOpen, setViewCheckinModalOpen] = useState(false);
    const [isViewCheckoutModalOpen, setViewCheckoutModalOpen] = useState(false);
    const [isConfirmFinalizeModalOpen, setIsConfirmFinalizeModalOpen] = useState(false);
    const [entryToFinalize, setEntryToFinalize] = useState<HomologacaoEntry | null>(null);
    const [activeCheckinStep, setActiveCheckinStep] = useState(1);
    const [activeCheckoutStep, setActiveCheckoutStep] = useState(1);
    const [selectedCheckin, setSelectedCheckin] = useState<ChecklistEntry | null>(null);
    const [selectedCheckout, setSelectedCheckout] = useState<ChecklistEntry | null>(null);
    const [hdPhoto, setHdPhoto] = useState<string | null>(null);

    const [isViewOnly, setIsViewOnly] = useState(false);
    const [isSuccessModalOpen, setSuccessModalOpen] = useState(false);
    const [modalMessage, setModalMessage] = useState('');
    const [loadedFiles, setLoadedFiles] = useState<Record<string, HomologacaoEntry['files']>>({});
    const loadedKeysRef = useRef<Set<string>>(new Set());

    const [form, setForm] = useState<Partial<HomologacaoEntry>>({
        checkinId: '',
        clientName: '',
        responsible_user_id: '',
        status: 'Em Análise',
        files: {
            procuracao: [],
            contaEnergia: [],
            documentoFoto: [],
            outrosDocumentos: []
        }
    });

    const handleSuccessModalClose = () => {
        setSuccessModalOpen(false);
    };

    const isMasterAdmin = useMemo(() => {
        const email = (currentUser.email || '').toLowerCase();
        const isDefaultAdmin = ADMIN_PROFILE_IDS.includes(String(currentUser.profileId)) || hasGlobalView || userPermissions.includes('ALL');
        const isHomologationEmail = email.includes('homologacao') || email === 'cvabdalla@gmail.com';
        return isDefaultAdmin || isHomologationEmail;
    }, [currentUser, hasGlobalView, userPermissions]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Buscamos apenas os campos necessários para a listagem principal, excluindo 'files' que causa timeout
            const homoFields = 'id, owner_id, responsible_user_id, clientName, date, status, checkinId, observations';
            
            const [homoData, checkinData, userData, profileData] = await Promise.all([
                dataService.getPartial<HomologacaoEntry>('homologacao_entries', homoFields, currentUser.id, isMasterAdmin),
                dataService.getPartial<ChecklistEntry>('checklist_checkin', 'id, project, status', undefined, true), 
                dataService.getPartial<User>('system_users', 'id, name, avatar, profileId', undefined, true),
                dataService.getAll<UserProfile>('system_profiles', undefined, true)
            ]);

            const loaded = (homoData || []).filter(e => e && e.id).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
            setEntries(loaded);
            setCheckins(checkinData || []);
            setSystemUsers(userData || []);

            const homologationProfiles = (profileData || []).filter(p => 
                p.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes('homologacao')
            ).map(p => p.id);

            const hUsers = (userData || []).filter(u => homologationProfiles.includes(u.profileId));
            setHomologationUsers(hUsers);

            // Limpa o ref de controle de carregamento pois acabamos de recarregar a listagem e os arquivos podem ter mudado
            loadedKeysRef.current.clear();

        } catch (e) {
            console.error("Erro ao carregar homologações:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser.id) {
            loadData();
        }
    }, [currentUser.id, isMasterAdmin]);

    const filteredEntries = useMemo(() => {
        return (entries || []).filter(e => {
            if (!e) return false;
            const clientName = e.clientName || '';
            const matchesSearch = clientName.toLowerCase().includes(searchTerm.toLowerCase());
            const isCompleted = e.status === 'Aprovada';
            const matchesTab = activeMainTab === 'concluidas' ? isCompleted : !isCompleted;
            
            // Permissão: ver se é admin, ou responsável, ou criador do registro
            const isResponsible = e.responsible_user_id === currentUser.id;
            const isOwner = e.owner_id === currentUser.id;
            const canSee = isMasterAdmin || isResponsible || isOwner;

            return matchesSearch && matchesTab && canSee;
        });
    }, [entries, searchTerm, activeMainTab, isMasterAdmin, currentUser.id]);

    // Carrega arquivos em segundo plano de forma sequencial APENAS para os itens que estão visíveis na aba ativa e no filtro
    useEffect(() => {
        if (isLoading || filteredEntries.length === 0) return;

        let isMounted = true;

        const loadVisibleFiles = async () => {
            // Filtramos apenas as entradas cujo arquivo ainda não foi carregado e não está marcado no Ref
            const toLoad = filteredEntries.filter(entry => !loadedKeysRef.current.has(entry.id));
            if (toLoad.length === 0) return;

            // Marcamos como carregando/carregados no ref imediatamente para prevenir concorrência
            toLoad.forEach(entry => loadedKeysRef.current.add(entry.id));

            for (const entry of toLoad) {
                if (!isMounted) break;
                try {
                    const full = await dataService.getById<HomologacaoEntry>('homologacao_entries', entry.id);
                    if (full && isMounted) {
                        setLoadedFiles(prev => ({
                            ...prev,
                            [entry.id]: full.files || {}
                        }));
                    }
                } catch (err) {
                    console.warn(`Erro ao carregar arquivos para ${entry.clientName}:`, err);
                    // Remove do ref em caso de erro para permitir nova tentativa
                    if (isMounted) {
                        loadedKeysRef.current.delete(entry.id);
                    }
                }
                // Aguarda 150ms entre cada chamada para garantir máxima fluidez e performance de rede
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        };

        loadVisibleFiles();

        return () => {
            isMounted = false;
        };
    }, [filteredEntries, isLoading]);

    const handleEditEntry = async (entry: HomologacaoEntry, viewOnly = false) => {
        if (!entry) return;
        setIsLoading(true);
        try {
            const fullEntry = await dataService.getById<HomologacaoEntry>('homologacao_entries', entry.id);
            if (!fullEntry) throw new Error("Registro não encontrado");

            setEditingEntryId(entry.id);
            setIsViewOnly(viewOnly);
            
            const normalizeFile = (f: any): ExpenseAttachment[] => {
                if (!f) return [];
                return Array.isArray(f) ? f : [f];
            };

            setForm({
                checkinId: fullEntry.checkinId || '',
                clientName: fullEntry.clientName || '',
                responsible_user_id: fullEntry.responsible_user_id || '',
                status: fullEntry.status || 'Em Análise',
                files: {
                    procuracao: normalizeFile(fullEntry.files?.procuracao),
                    contaEnergia: normalizeFile(fullEntry.files?.contaEnergia),
                    documentoFoto: normalizeFile(fullEntry.files?.documentoFoto),
                    outrosDocumentos: normalizeFile(fullEntry.files?.outrosDocumentos)
                },
                observations: fullEntry.observations || ''
            });
            setModalOpen(true);
        } catch (error) {
            alert("Erro ao carregar detalhes da homologação.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: keyof HomologacaoEntry['files']) => {
        const filesList = Array.from(e.target.files || []);
        if (filesList.length === 0) return;

        if (field === 'outrosDocumentos') {
            const currentFiles = form.files?.outrosDocumentos || [];
            if (currentFiles.length + filesList.length > 10) {
                alert("Você pode anexar no máximo 10 arquivos em 'Outros documentos'.");
                return;
            }
        }

        setIsSaving(true);
        for (const file of filesList) {
            if (file.size > 15 * 1024 * 1024) {
                alert(`O arquivo "${file.name}" é muito grande (maior que 15MB). Por favor, forneça um arquivo menor.`);
                continue;
            }

            try {
                let fileData = '';
                if (file.type.startsWith('image/')) {
                    // Comprime imagem para economizar o espaço no Supabase/LocalStorage
                    fileData = await compressImage(file);
                } else {
                    // Outros formatos (como PDF)
                    fileData = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (event) => resolve(event.target?.result as string || '');
                        reader.onerror = (err) => reject(err);
                        reader.readAsDataURL(file);
                    });
                }

                if (!fileData) continue;

                const attachment: ExpenseAttachment = {
                    name: file.name,
                    data: fileData
                };

                setForm(prev => {
                    const currentList = prev.files?.[field] || [];
                    if (field === 'outrosDocumentos' && currentList.length >= 10) {
                        return prev;
                    }
                    return {
                        ...prev,
                        files: {
                            ...(prev.files || {}),
                            [field]: [...currentList, attachment]
                        }
                    };
                });
            } catch (err) {
                console.error("Erro ao processar arquivo:", err);
                alert(`Erro ao processar o arquivo "${file.name}".`);
            }
        }
        setIsSaving(false);
        e.target.value = '';
    };

    const handleRemoveFile = (field: keyof HomologacaoEntry['files'], index: number) => {
        setForm(prev => ({
            ...prev,
            files: {
                ...(prev.files || {}),
                [field]: (prev.files?.[field] || []).filter((_, i) => i !== index)
            }
        }));
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
        if (!form.checkinId || !form.clientName || !form.responsible_user_id) {
            alert("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setIsSaving(true);
        try {
            const entry: HomologacaoEntry = {
                id: editingEntryId || `homo-${Date.now()}`,
                owner_id: editingEntryId ? entries.find(e => e.id === editingEntryId)?.owner_id || currentUser.id : currentUser.id,
                responsible_user_id: form.responsible_user_id,
                checkinId: form.checkinId!,
                clientName: form.clientName!,
                date: editingEntryId ? entries.find(e => e.id === editingEntryId)?.date || new Date().toISOString() : new Date().toISOString(),
                status: (form.status as any) || 'Em Análise',
                files: form.files as any,
                observations: form.observations
            };

            await dataService.save('homologacao_entries', entry);
            setModalOpen(false);
            setEditingEntryId(null);
            setForm({ checkinId: '', clientName: '', responsible_user_id: '', status: 'Em Análise', files: { procuracao: [], contaEnergia: [], documentoFoto: [], outrosDocumentos: [] } });
            setModalMessage(editingEntryId ? "Homologação atualizada!" : "Homologação registrada!");
            setSuccessModalOpen(true);
            await loadData();
        } catch (e: any) {
            console.error("Erro ao salvar homologação:", e);
            alert(`Erro ao salvar: ${e?.message || 'Verifique o tamanho do anexo ou sua conexão com o banco de dados.'}`);
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmFinalize = async () => {
        if (!entryToFinalize) return;
        setIsSaving(true);
        try {
            // Buscamos o objeto completo primeiro para não perder os arquivos após o upsert
            const fullEntry = await dataService.getById<HomologacaoEntry>('homologacao_entries', entryToFinalize.id);
            if (fullEntry) {
                await dataService.save('homologacao_entries', { ...fullEntry, status: 'Aprovada' });
            }
            setModalMessage("Processo concluído com sucesso!");
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

    const handleViewCheckin = async (checkinId: string) => {
        setIsLoading(true);
        try {
            // Buscamos o checkin completo apenas sob demanda
            const checkin = await dataService.getById<ChecklistEntry>('checklist_checkin', checkinId);
            if (checkin) {
                setSelectedCheckin(checkin);
                setActiveCheckinStep(1);
                setViewCheckinModalOpen(true);
            } else {
                alert("Dados técnicos do Check-in não encontrados ou indisponíveis.");
            }
        } catch (error) {
            alert("Erro ao carregar dados do Check-in.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewCheckout = async (checkinId: string, clientName: string) => {
        setIsLoading(true);
        try {
            // Buscamos todos os checklists de checkout para fazer o cruzamento robusto em memória
            const checkouts = await dataService.getAll<ChecklistEntry>('checklist_checkout');
            const foundCheckout = checkouts.find(c => {
                if (!c) return false;
                const matchesCheckinId = String(c.id) === String(checkinId) || (c.details && String(c.details.originalCheckinId) === String(checkinId));
                const matchesClientName = c.project?.toLowerCase().trim() === clientName?.toLowerCase().trim() || 
                                          (c.details && c.details.nomeCliente?.toLowerCase().trim() === clientName?.toLowerCase().trim());
                return matchesCheckinId || matchesClientName;
            });

            if (foundCheckout) {
                const checkout = await dataService.getById<ChecklistEntry>('checklist_checkout', foundCheckout.id);
                if (checkout) {
                    setSelectedCheckout(checkout);
                    setActiveCheckoutStep(1);
                    setViewCheckoutModalOpen(true);
                } else {
                    alert("Dados do Check-out não puderam ser abertos.");
                }
            } else {
                alert("Check-out de Obra não encontrado ou não finalizado para este cliente.");
            }
        } catch (error) {
            console.error("Erro ao carregar dados do Check-out:", error);
            alert("Erro ao carregar dados do Check-out.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownload = (file: ExpenseAttachment) => {
        const parts = file.data.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
        const blob = new Blob([uInt8Array], { type: contentType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const renderFileList = (files: ExpenseAttachment[] = [], field: keyof HomologacaoEntry['files']) => {
        return (
            <div className="space-y-1.5 mt-1.5 select-none font-sans">
                {files.map((file, idx) => {
                    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
                    return (
                        <div key={idx} className="flex items-center justify-between gap-3 bg-white dark:bg-gray-800 p-2 rounded-xl border border-gray-100 dark:border-gray-700/60 shadow-xs hover:border-indigo-100 transition-all">
                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                {isPdf ? (
                                    <DocumentReportIcon className="w-4 h-4 text-red-500 shrink-0" />
                                ) : (
                                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-gray-700">
                                        <img src={file.data} className="w-full h-full object-cover" alt="" />
                                    </div>
                                )}
                                <span className="text-[10px] font-bold text-gray-650 dark:text-gray-300 truncate tracking-tight">{file.name}</span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                                <button type="button" onClick={() => handleViewFile(file)} className="p-1 px-1.5 text-[9px] font-bold bg-gray-50 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-gray-750 dark:hover:bg-indigo-950/40 text-gray-500 dark:text-gray-400 rounded-lg transition-all" title="Visualizar">
                                    <EyeIcon className="w-3 h-3" />
                                </button>
                                <button type="button" onClick={() => handleDownload(file)} className="p-1 px-1.5 text-[9px] font-bold bg-gray-50 hover:bg-emerald-50 hover:text-emerald-600 dark:bg-gray-750 dark:hover:bg-emerald-950/40 text-gray-500 dark:text-gray-400 rounded-lg transition-all" title="Baixar">
                                    <ArrowDownIcon className="w-3 h-3" />
                                </button>
                                {!isSaving && !isViewOnly && (
                                    <button type="button" onClick={() => handleRemoveFile(field, idx)} className="p-1 px-1.5 text-[9px] font-bold bg-gray-50 hover:bg-red-50 hover:text-red-600 dark:bg-gray-750 dark:hover:bg-red-950/40 text-gray-500 dark:text-gray-450 rounded-lg transition-all" title="Remover">
                                        <TrashIcon className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
                {!isViewOnly && (
                    <label className="flex flex-col items-center justify-center py-3 px-3 bg-gray-50/45 hover:bg-gray-50 dark:bg-gray-900 border border-dashed border-gray-200 dark:border-gray-700/80 rounded-xl cursor-pointer hover:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 transition-all group">
                        <UploadIcon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-all duration-200 group-hover:scale-105" />
                        <span className="text-[10px] font-bold text-gray-400 group-hover:text-indigo-600 mt-1 tracking-wider animate-pulse">Anexar</span>
                        <input 
                            type="file" 
                            className="hidden" 
                            accept="image/*,application/pdf" 
                            multiple={field === 'outrosDocumentos'} 
                            onChange={(e) => handleFileUpload(e, field)} 
                        />
                    </label>
                )}
            </div>
        );
    };

    const handleViewFile = (file: ExpenseAttachment) => {
        const parts = file.data.split(';base64,');
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) { uInt8Array[i] = raw.charCodeAt(i); }
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.data.startsWith('data:application/pdf');
        if (isPdf) {
            const blob = new Blob([uInt8Array], { type: contentType });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } else {
            setHdPhoto(file.data);
        }
    };

    const renderEntryFilesSummary = (files: ExpenseAttachment[] = [], label: string, colorClass: string, Icon: any, isLoadingFiles = false) => {
        if (isLoadingFiles) {
            return (
                <div className="flex items-center justify-between p-3 bg-gray-50/20 dark:bg-gray-900/10 rounded-2xl border border-gray-150 dark:border-gray-800/80 animate-pulse select-none">
                    <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600" />
                        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 tracking-tight">Carregando anexo...</span>
                    </div>
                </div>
            );
        }
        if (!files || files.length === 0) {
            return (
                <div className="flex items-center justify-between p-3 bg-gray-50/20 dark:bg-gray-900/10 rounded-2xl border border-dashed border-gray-150 dark:border-gray-800/80 opacity-50 select-none">
                    <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-[10px] font-semibold text-gray-400 tracking-tight">{label} (Não anexado)</span>
                    </div>
                </div>
            );
        }
        return (
            <div className="flex items-center justify-between p-3 bg-gray-50/45 dark:bg-gray-900/10 rounded-2xl border border-gray-100/60 dark:border-gray-800/60 shadow-xs hover:border-indigo-100 transition-colors">
                <div className="flex items-center gap-2 overflow-hidden flex-1 select-none">
                    <div className={`p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-xs ${colorClass}`}>
                        <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300 truncate tracking-tight">{label} <span className="text-[10px] text-gray-400 font-semibold">({files.length})</span></span>
                </div>
                <div className="flex gap-2 items-center shrink-0">
                    <div className="flex -space-x-1.5 -mr-0.5">
                        {files.map((f, i) => (
                            <button 
                                key={i} 
                                onClick={(e) => { e.stopPropagation(); handleViewFile(f); }}
                                title={`Visualizar ${f.name}`}
                                className="w-6 h-6 rounded-full border border-white dark:border-gray-800 bg-indigo-50/90 hover:bg-indigo-600 hover:text-white dark:bg-indigo-950/80 dark:text-indigo-400 dark:hover:bg-indigo-500 dark:hover:text-white transition-all flex items-center justify-center text-[9px] font-black text-indigo-600 shadow-sm z-10 hover:z-20 scale-100 hover:scale-110 active:scale-95"
                            >
                                {i + 1}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleViewFile(files[0]); }} 
                        className="p-1 px-1.5 bg-white dark:bg-gray-800 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all border border-gray-100 dark:border-gray-700 shadow-xs hover:shadow-sm"
                        title="Visualizar primeiro arquivo"
                    >
                        <EyeIcon className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        );
    };

    const renderCheckinGalleryItem = (label: string, photos: string[] = []) => {
        if (!photos || photos.length === 0) return null;
        return (
            <div className="p-4 bg-gray-50/30 dark:bg-gray-850 rounded-2xl border border-gray-100 dark:border-gray-800/80 space-y-2.5">
                <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 block tracking-wider">{label}</label>
                <div className="grid grid-cols-4 gap-2">
                    {photos.map((url, idx) => (
                        <div key={idx} className="relative aspect-square rounded-xl overflow-hidden shadow-xs group border border-gray-100 dark:border-gray-700 bg-black/5 animate-fade-in">
                            <img src={url} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt="" />
                            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-1.5 backdrop-blur-xs">
                                <button onClick={() => setHdPhoto(url)} className="p-1.5 bg-white text-gray-900 rounded-lg shadow-md hover:bg-indigo-50 hover:scale-110 active:scale-95 transition-all"><EyeIcon className="w-3.5 h-3.5" /></button>
                                <button onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `foto-${label.toLowerCase().replace(/\s/g, '-')}-${idx}.jpg`;
                                    a.click();
                                }} className="p-1.5 bg-white text-emerald-600 rounded-lg shadow-md hover:bg-emerald-50 hover:scale-110 active:scale-95 transition-all"><ArrowDownIcon className="w-3.5 h-3.5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-fade-in pb-20 font-sans">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700/60 gap-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/10">
                        <DocumentReportIcon className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-none">Homologação</h2>
                        <p className="text-[11px] text-gray-400 font-bold mt-1.5 tracking-wider">Processos de Concessionária</p>
                    </div>
                </div>
                <button 
                    onClick={() => { setEditingEntryId(null); setForm({ checkinId: '', clientName: '', responsible_user_id: '', status: 'Em Análise', files: { procuracao: [], contaEnergia: [], documentoFoto: [], outrosDocumentos: [] } }); setModalOpen(true); }} 
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-2 shadow-sm"
                >
                    <PlusIcon className="w-4 h-4" /> Nova Homologação
                </button>
            </header>

            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex bg-gray-100/80 dark:bg-gray-800/80 p-1 rounded-full border border-gray-200/50 dark:border-gray-750 w-fit">
                    <button 
                        onClick={() => setActiveMainTab('pendentes')} 
                        className={`px-5 py-2 rounded-full font-bold text-xs transition-all ${activeMainTab === 'pendentes' ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Pendentes
                    </button>
                    <button 
                        onClick={() => setActiveMainTab('concluidas')} 
                        className={`px-5 py-2 rounded-full font-bold text-xs transition-all ${activeMainTab === 'concluidas' ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    >
                        Concluídas
                    </button>
                </div>

                <div className="relative flex-1 w-full max-w-sm">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-450" />
                    <input 
                        type="text" 
                        placeholder="Buscar por cliente..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 focus:border-indigo-500 dark:border-gray-700 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-950/25 text-xs font-semibold shadow-xs outline-none transition-all"
                    />
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEntries.map(entry => {
                        const responsibleUser = systemUsers.find(u => u.id === entry.responsible_user_id);
                        
                        const normalize = (f: any) => Array.isArray(f) ? f : (f ? [f] : []);
                        const entryFiles = loadedFiles[entry.id] || entry.files || {};
                        const isFilesLoading = !loadedFiles[entry.id];
                        const procuracaoFiles = normalize(entryFiles.procuracao);
                        const contaEnergiaFiles = normalize(entryFiles.contaEnergia);
                        const documentoFotoFiles = normalize(entryFiles.documentoFoto);
                        const outrosDocumentosFiles = normalize(entryFiles.outrosDocumentos);

                        return (
                            <div 
                                key={entry.id} 
                                onClick={() => handleEditEntry(entry, entry.status === 'Aprovada')}
                                className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100/80 dark:border-gray-750/90 p-5 shadow-xs hover:shadow-md transition-all duration-300 group flex flex-col relative overflow-hidden cursor-pointer hover:-translate-y-0.5"
                            >
                                <div className="flex justify-between items-start mb-4 gap-2">
                                    <div className="space-y-1 flex-1">
                                        <h4 className="font-extrabold text-gray-850 dark:text-white text-base leading-snug tracking-tight group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors truncate">{entry.clientName}</h4>
                                        <div className="flex flex-col gap-1">
                                            <p className="text-[10px] text-gray-400 font-bold flex items-center gap-1.5">
                                                <CalendarIcon className="w-3.5 h-3.5 text-gray-300 dark:text-gray-550" /> {new Date(entry.date).toLocaleDateString('pt-BR')}
                                            </p>
                                            {responsibleUser && (
                                                <div className="flex items-center gap-1.5 mt-1">
                                                    <div className="w-5.5 h-5.5 rounded-full overflow-hidden bg-gray-50 border border-gray-200 dark:border-gray-700 shadow-xs flex-shrink-0">
                                                        {responsibleUser.avatar ? (
                                                            <img src={responsibleUser.avatar} className="w-full h-full object-cover" alt="" />
                                                        ) : (
                                                            <div className="w-full h-full flex items-center justify-center bg-indigo-50/70 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-455 text-[9px] font-black uppercase">
                                                                {responsibleUser.name.substring(0, 1)}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 tracking-tight">
                                                        Responsável: <strong className="text-indigo-600 dark:text-indigo-400">{toSentenceCase((responsibleUser.name || '---').split(' ')[0])}</strong>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-widest shrink-0 ${
                                        entry.status === 'Aprovada' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 
                                        'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                                    }`}>
                                        {entry.status}
                                    </span>
                                </div>

                                <div className="space-y-4 flex-1">
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleViewCheckin(entry.checkinId); }}
                                            className="flex items-center justify-center gap-2 py-2 px-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/35 hover:bg-indigo-100/50 dark:hover:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 rounded-xl text-xs font-black tracking-tight transition-all"
                                        >
                                            <ClipboardCheckIcon className="w-4 h-4 text-indigo-500" />
                                            <span>Check-in</span>
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); handleViewCheckout(entry.checkinId, entry.clientName); }}
                                            className="flex items-center justify-center gap-2 py-2 px-3 bg-emerald-50/40 dark:bg-emerald-950/15 border border-emerald-100/40 dark:border-emerald-900/25 hover:bg-emerald-100/50 dark:hover:bg-emerald-950/30 text-emerald-650 dark:text-emerald-400 rounded-xl text-xs font-black tracking-tight transition-all"
                                        >
                                            <ClipboardListIcon className="w-4 h-4 text-emerald-500" />
                                            <span>Check-out</span>
                                        </button>
                                    </div>

                                    <div className="space-y-2 pt-2 border-t border-gray-50 dark:border-gray-750/45">
                                        <p className="text-[9px] font-black text-gray-400 dark:text-gray-500 tracking-wider ml-0.5">Documentação Digital</p>
                                        {renderEntryFilesSummary(procuracaoFiles, "Procuração", "text-indigo-500", DocumentReportIcon, isFilesLoading)}
                                        {renderEntryFilesSummary(contaEnergiaFiles, "Conta de Energia", "text-amber-500", BoltIcon, isFilesLoading)}
                                        {renderEntryFilesSummary(documentoFotoFiles, "Documento com Foto", "text-blue-500", UsersIcon, isFilesLoading)}
                                        {renderEntryFilesSummary(outrosDocumentosFiles, "Outros documentos", "text-teal-500", ClipboardListIcon, isFilesLoading)}
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-gray-50 dark:border-gray-750/50 flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex gap-1">
                                        <button 
                                            type="button" 
                                            onClick={() => handleDelete(entry.id)} 
                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
                                            title="Excluir Registro"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => handleEditEntry(entry, entry.status === 'Aprovada')} 
                                            className="p-1.5 text-gray-400 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-750 rounded-lg transition-colors"
                                            title="Editar/Visualizar"
                                        >
                                            {entry.status === 'Aprovada' ? <EyeIcon className="w-4 h-4" /> : <EditIcon className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    {entry.status !== 'Aprovada' && (
                                        <button 
                                            type="button"
                                            onClick={() => { setEntryToFinalize(entry); setIsConfirmFinalizeModalOpen(true); }} 
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] tracking-tight shadow-xs hover:shadow-sm transition-all active:scale-95"
                                        >
                                            <CheckCircleIcon className="w-3.5 h-3.5" /> Efetivar
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredEntries.length === 0 && (
                        <div className="col-span-full py-24 text-center space-y-4">
                            <DocumentReportIcon className="w-12 h-12 text-gray-350 dark:text-gray-600 mx-auto" />
                            <p className="text-gray-400 dark:text-gray-500 font-bold italic text-sm">Nenhuma homologação encontrada para esta visualização.</p>
                        </div>
                    )}
                </div>
            )}

            {isModalOpen && (
                <Modal title={isViewOnly ? "Visualizar Homologação" : (editingEntryId ? "Editar Homologação" : "Nova Homologação")} onClose={() => { setModalOpen(false); setEditingEntryId(null); setIsViewOnly(false); }} maxWidth="max-w-2xl">
                    <form onSubmit={handleSave} className="space-y-4 pt-2 animate-fade-in">
                        <div className="space-y-4">
                            <div>
                                <FormLabel>Check-in (Projetos Efetivados ou Em Aberto)</FormLabel>
                                <select 
                                    required 
                                    disabled={isViewOnly}
                                    value={form.checkinId} 
                                    onChange={e => handleSelectCheckin(e.target.value)} 
                                    className="w-full rounded-xl border-2 border-indigo-100 bg-gray-50 dark:bg-gray-800 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-70"
                                >
                                    <option value="">Selecione...</option>
                                    {checkins.filter(c => c.status === 'Aberto' || c.status === 'Efetivado' || c.status === 'Finalizado' || c.id === form.checkinId).map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.project} {c.status === 'Aberto' ? '(Em Aberto)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <FormLabel>Nome do Titular (Concessionária)</FormLabel>
                                <input 
                                    required
                                    type="text"
                                    disabled={isViewOnly}
                                    value={form.clientName}
                                    onChange={e => setForm({...form, clientName: e.target.value})}
                                    className="w-full rounded-xl border-2 border-indigo-50 bg-gray-50 dark:bg-gray-900 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all disabled:opacity-70"
                                />
                            </div>
                            <div>
                                <FormLabel>Responsável Homologação</FormLabel>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {homologationUsers.map(u => {
                                        const isSelected = form.responsible_user_id === u.id;
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                disabled={isViewOnly}
                                                onClick={() => setForm(prev => ({ ...prev, responsible_user_id: u.id }))}
                                                className={`relative flex items-center gap-2 p-2 rounded-xl border-2 transition-all active:scale-95 disabled:cursor-default ${
                                                    isSelected 
                                                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 shadow-md scale-[1.02]' 
                                                        : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-indigo-200'
                                                } ${isViewOnly && !isSelected ? 'opacity-40 grayscale-[0.5]' : ''}`}
                                            >
                                                {isSelected && (
                                                    <div className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm z-10">
                                                        <CheckCircleIcon className="w-3 h-3" />
                                                    </div>
                                                )}
                                                <div className={`w-6 h-6 rounded-full overflow-hidden border-2 flex-shrink-0 ${isSelected ? 'border-indigo-600' : 'border-gray-100 dark:border-gray-700'}`}>
                                                    {u.avatar ? (
                                                        <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 text-[8px] font-black">
                                                            {u.name.substring(0, 1)}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-bold truncate ${isSelected ? 'text-indigo-800 dark:text-indigo-300' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {toSentenceCase(u.name.split(' ')[0])}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <FormLabel>Status da Homologação</FormLabel>
                                    <select 
                                        disabled={isViewOnly}
                                        value={form.status || 'Em Análise'} 
                                        onChange={e => setForm({...form, status: e.target.value as any})} 
                                        className="w-full rounded-xl border-2 border-indigo-50 bg-gray-50 dark:bg-gray-800 p-2.5 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all disabled:opacity-70"
                                    >
                                        <option value="Em Análise">Em Análise</option>
                                        <option value="Pendente">Pendente</option>
                                        <option value="Aprovada">Aprovada (Efetuada)</option>
                                    </select>
                                </div>
                                <div className="text-gray-550 dark:text-gray-400 text-[10px] bg-slate-50 dark:bg-slate-900/20 p-2.5 rounded-xl border border-dashed border-gray-250 dark:border-gray-700 flex flex-col justify-center leading-relaxed">
                                    <span className="font-extrabold text-indigo-650 dark:text-indigo-400">Permitido salvar incompleto:</span>
                                    <span>Não é obrigatório anexar os documentos de imediato. Sinta-se livre para iniciar a homologação e anexar ou atualizar os arquivos posteriormente.</span>
                                </div>
                            </div>

                            <div>
                                <FormLabel>Observações</FormLabel>
                                <textarea 
                                    disabled={isViewOnly}
                                    value={form.observations || ''}
                                    onChange={e => setForm({...form, observations: e.target.value})}
                                    className="w-full rounded-xl border-2 border-indigo-50 bg-gray-50 dark:bg-gray-900 p-2 text-xs font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all disabled:opacity-70 min-h-[80px]"
                                    placeholder="Observações adicionais sobre o processo..."
                                />
                            </div>
                        </div>

                        <div className="bg-indigo-50/50 dark:bg-indigo-900/10 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-800 flex items-start gap-2">
                            <ExclamationTriangleIcon className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight font-bold">Anexos ilegíveis causam reprovação imediata na concessionária.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                                <FormLabel>Procuração</FormLabel>
                                {renderFileList(form.files?.procuracao, 'procuracao')}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                                <FormLabel>Conta de Energia</FormLabel>
                                {renderFileList(form.files?.contaEnergia, 'contaEnergia')}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                                <FormLabel>Documento com Foto</FormLabel>
                                {renderFileList(form.files?.documentoFoto, 'documentoFoto')}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-700 flex flex-col gap-2">
                                <div className="flex justify-between items-center">
                                    <FormLabel>Outros documentos</FormLabel>
                                    <span className="text-[10px] font-bold text-gray-500 mr-1">(Até 10 arquivos)</span>
                                </div>
                                {renderFileList(form.files?.outrosDocumentos, 'outrosDocumentos')}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                            <button type="button" onClick={() => { setModalOpen(false); setEditingEntryId(null); setIsViewOnly(false); }} className="flex-1 py-3 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs">
                                {isViewOnly ? 'Fechar' : 'Cancelar'}
                            </button>
                            {!isViewOnly && (
                                <button 
                                    type="submit" 
                                    disabled={isSaving || !form.checkinId || !form.clientName || !form.responsible_user_id} 
                                    className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-black text-xs shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                                >
                                    {isSaving ? 'Gravando...' : editingEntryId ? 'Salvar' : 'Iniciar'}
                                </button>
                            )}
                        </div>
                    </form>
                </Modal>
            )}

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

            {isViewCheckinModalOpen && selectedCheckin && (
                <Modal title={`Dados técnicos: ${selectedCheckin.project}`} onClose={() => setViewCheckinModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="px-1">
                        <div className="flex items-center justify-center gap-1.5 mb-8 bg-gray-50/50 dark:bg-gray-900/40 p-1.5 rounded-xl border border-gray-100 dark:border-gray-800/80 max-w-xs sm:max-w-md mx-auto overflow-x-auto select-none">
                            {[1, 2, 3, 4, 5].map(step => (
                                <button key={step} type="button" onClick={() => setActiveCheckinStep(step)} className="shrink-0">
                                    <div className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${activeCheckinStep === step ? 'bg-indigo-600 text-white shadow-xs' : 'text-gray-400 dark:text-gray-500 hover:text-gray-650'}`}>
                                        Etapa {step}
                                    </div>
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
                                                <div key={p.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
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
                                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
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

            {isViewCheckoutModalOpen && selectedCheckout && (
                <Modal title={`Dados de Check-out: ${selectedCheckout.project}`} onClose={() => setViewCheckoutModalOpen(false)} maxWidth="max-w-4xl">
                    <div className="px-1">
                        <div className="flex items-center justify-center gap-1.5 mb-8 bg-gray-50/50 dark:bg-gray-900/40 p-1.5 rounded-xl border border-gray-100 dark:border-gray-800/80 max-w-xs sm:max-w-md mx-auto overflow-x-auto select-none">
                            {[1, 2, 3, 4, 5].map(step => (
                                <button key={step} type="button" onClick={() => setActiveCheckoutStep(step)} className="shrink-0">
                                    <div className={`px-3.5 py-1.5 rounded-lg text-[10px] font-bold tracking-tight transition-all ${activeCheckoutStep === step ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-400 dark:text-gray-500 hover:text-gray-650'}`}>
                                        Etapa {step}
                                    </div>
                                </button>
                            ))}
                        </div>

                        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar pb-6">
                            {activeCheckoutStep === 1 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<UsersIcon />} title="Identificação do encerramento" color="bg-emerald-600" />
                                        <div className="grid grid-cols-2 gap-4">
                                            <DataRow label="Nome do cliente" value={selectedCheckout.project || selectedCheckout.details?.nomeCliente} />
                                            <DataRow label="Técnico/Responsável" value={selectedCheckout.responsible} />
                                            <DataRow label="Status do checkout" value={selectedCheckout.status} color="text-emerald-600 dark:text-emerald-400" />
                                            <DataRow label="Data término instalação" value={(() => {
                                                const dStr = selectedCheckout.details?.dataTermino;
                                                if (!dStr) return '---';
                                                try {
                                                    if (dStr.includes('T')) {
                                                        return new Date(dStr).toLocaleDateString('pt-BR', {timeZone:'UTC'});
                                                    }
                                                    return new Date(dStr + 'T00:00:00Z').toLocaleDateString('pt-BR', {timeZone:'UTC'});
                                                } catch {
                                                    return dStr;
                                                }
                                            })()} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckoutStep === 2 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<PhotographIcon />} title="Galeria de Placas e Inversores" color="bg-blue-600" />
                                        <div className="grid grid-cols-1 gap-6">
                                            {renderCheckinGalleryItem('Fotos das Placas Solares Instaladas', selectedCheckout.details?.fotosPlacas)}
                                            {renderCheckinGalleryItem('Fotos dos Inversores / Micro Inversores', selectedCheckout.details?.fotosInversores)}
                                            {renderCheckinGalleryItem('Fotos de instalação do aterramento das placas', selectedCheckout.details?.fotosAterramento)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckoutStep === 3 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<BoltIcon />} title="Medidores e Quadros de Energia" color="bg-yellow-500" />
                                        <div className="grid grid-cols-1 gap-6">
                                            {renderCheckinGalleryItem('Foto Quadro de Energia Interno', selectedCheckout.details?.fotosQuadroInterno)}
                                            {renderCheckinGalleryItem('Medidor Concessionária', selectedCheckout.details?.fotosMedidor)}
                                            {renderCheckinGalleryItem('Fotos de disjuntor e DPS do medidor', selectedCheckout.details?.fotosDisjuntorDPS)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckoutStep === 4 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<CogIcon />} title="Vídeos de Conectividade e Validações" color="bg-indigo-650" />
                                        <div className="grid grid-cols-1 gap-1">
                                            <DataRow label="Vídeo de antilhamento (Enel)?" value={selectedCheckout.details?.videoAntilhamento} />
                                            <DataRow label="Vídeo adicionado ao Youtube?" value={selectedCheckout.details?.videoYoutube} />
                                            {selectedCheckout.details?.videoYoutube === 'Sim' && selectedCheckout.details?.linkYoutube && (
                                                <div className="flex justify-between items-start py-2 border-b border-gray-55 dark:border-gray-800 last:border-0">
                                                    <span className="text-[10px] font-bold text-gray-400 tracking-tight">Link do vídeo</span>
                                                    <a href={selectedCheckout.details.linkYoutube} target="_blank" rel="noopener noreferrer" className="text-xs font-black text-indigo-600 hover:underline">
                                                        Abrir no YouTube
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<CameraIcon />} title="Estrutura de Poste e Padrão" color="bg-pink-600" />
                                        <div className="grid grid-cols-1 gap-6">
                                            {renderCheckinGalleryItem('Foto Padrão (Poste) com Placas de Identificação', selectedCheckout.details?.fotoPadraoPoste)}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeCheckoutStep === 5 && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
                                        <SectionHeader icon={<CubeIcon />} title="Componentes e materiais utilizados" color="bg-emerald-600" />
                                        <div className="space-y-2">
                                            {(selectedCheckout.details?.componentesEstoque || []).map((comp: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-700">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{comp.name}</span>
                                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{comp.qty} un</span>
                                                </div>
                                            ))}
                                            {(selectedCheckout.details?.componentesEstoque || []).length === 0 && (
                                                <p className="text-center py-4 text-xs italic text-gray-400">Nenhum componente ou material consumido do estoque para este projeto.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex justify-between items-center pt-6 border-t dark:border-gray-700">
                            <button 
                                onClick={() => activeCheckoutStep > 1 ? setActiveCheckoutStep(prev => prev - 1) : setViewCheckoutModalOpen(false)} 
                                className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs flex items-center gap-2"
                            >
                                <ArrowLeftIcon className="w-4 h-4" /> {activeCheckoutStep === 1 ? 'Fechar' : 'Voltar'}
                            </button>
                            {activeCheckoutStep < 5 ? (
                                <button 
                                    onClick={() => setActiveCheckoutStep(prev => prev + 1)} 
                                    className="px-8 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-emerald-700 transition-all flex items-center gap-2"
                                >
                                    Próxima aba <span className="opacity-50">→</span>
                                </button>
                            ) : (
                                <button 
                                    onClick={() => setViewCheckoutModalOpen(false)} 
                                    className="px-8 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-xs shadow-lg"
                                >
                                    Concluir visualização
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            )}

            {hdPhoto && (
                <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setHdPhoto(null)}>
                    <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-4">
                        <button className="absolute top-0 right-0 p-3 text-white hover:text-indigo-400 z-[110]" onClick={(e) => { e.stopPropagation(); setHdPhoto(null); }}><XCircleIcon className="w-10 h-10" /></button>
                        <div className="flex-1 w-full flex items-center justify-center overflow-hidden"><img src={hdPhoto} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-zoom-in" alt="" onClick={(e) => e.stopPropagation()} /></div>
                        <div className="flex gap-4">
                            <button onClick={(e) => { e.stopPropagation(); const a = document.createElement('a'); a.href = hdPhoto; a.download = 'anexo-homologacao.jpg'; a.click(); }} className="px-8 py-2 bg-indigo-600 text-white rounded-full font-black text-xs tracking-tight shadow-lg hover:bg-indigo-700 transition-all flex items-center gap-2"><ArrowDownIcon className="w-4 h-4" /> Download em alta definição</button>
                        </div>
                    </div>
                </div>
            )}

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
