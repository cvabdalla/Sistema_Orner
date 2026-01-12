import React, { useState, useEffect } from 'react';
import { 
    PlusIcon, TrashIcon, EditIcon, CheckCircleIcon, ClipboardListIcon
} from '../assets/icons';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import type { ActivityCatalogEntry, User } from '../types';

const PRESET_COLORS = [
    { name: 'Indigo', hex: '#6366f1' },
    { name: 'Esmeralda', hex: '#10b981' },
    { name: 'Âmbar', hex: '#f59e0b' },
    { name: 'Rosa', hex: '#f43f5e' },
    { name: 'Céu', hex: '#0ea5e9' },
    { name: 'Violeta', hex: '#8b5cf6' },
    { name: 'Ardósia', hex: '#64748b' },
    { name: 'Laranja', hex: '#f97316' }
];

const InstalacoesCadastroPage: React.FC<{ currentUser: User }> = ({ currentUser }) => {
    const [catalog, setCatalog] = useState<ActivityCatalogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ActivityCatalogEntry | null>(null);

    const [form, setForm] = useState({
        title: '',
        color: PRESET_COLORS[0].hex,
        personalSchedule: false
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            // Busca o catálogo de atividades (admin vê tudo, usuário vê as suas + globais conforme regra do service)
            const data = await dataService.getAll<ActivityCatalogEntry>('activity_catalog', currentUser.id, true);
            setCatalog(data.sort((a, b) => a.title.localeCompare(b.title)));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [currentUser.id]);

    const handleOpenModal = (item?: ActivityCatalogEntry) => {
        if (item) {
            setEditingItem(item);
            setForm({
                title: item.title,
                color: item.color,
                personalSchedule: !!item.personalSchedule
            });
        } else {
            setEditingItem(null);
            setForm({
                title: '',
                color: PRESET_COLORS[0].hex,
                personalSchedule: false
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) return;
        
        setIsSaving(true);
        try {
            const data: ActivityCatalogEntry = {
                id: editingItem ? editingItem.id : `cat-${Date.now()}`,
                owner_id: currentUser.id,
                title: form.title,
                color: form.color,
                personalSchedule: form.personalSchedule
            };
            await dataService.save('activity_catalog', data);
            setIsModalOpen(false);
            await loadData();
        } catch (e) {
            console.error(e);
            alert("Erro ao salvar atividade.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Deseja realmente excluir esta atividade?')) {
            try {
                await dataService.delete('activity_catalog', id);
                await loadData();
            } catch (e) {
                alert("Erro ao excluir. A atividade pode estar em uso.");
            }
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
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Cadastro de atividades</h2>
                    <p className="text-xs text-gray-500 font-medium">Gerencie as categorias de serviços para a sua agenda</p>
                </div>
                <button 
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <PlusIcon className="w-4 h-4" /> Nova atividade
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {catalog.map(item => (
                    <div key={item.id} className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col gap-3 hover:border-indigo-200 transition-all group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{item.title}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleOpenModal(item)} className="p-1.5 text-gray-300 hover:text-indigo-600 transition-colors">
                                    <EditIcon className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors">
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {item.personalSchedule && (
                            <span className="text-[9px] font-black text-indigo-600 bg-indigo-50 dark:bg-indigo-900/40 w-fit px-2 py-0.5 rounded-full tracking-tight">
                                Atividade pessoal
                            </span>
                        )}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <Modal title={editingItem ? "Editar atividade" : "Nova atividade"} onClose={() => setIsModalOpen(false)} maxWidth="max-w-md">
                    <form onSubmit={handleSave} className="space-y-6 pt-2">
                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 ml-1 tracking-tight">Descrição da atividade</label>
                            <input 
                                required
                                autoFocus
                                type="text" 
                                value={form.title}
                                onChange={e => setForm({...form, title: e.target.value})}
                                className="w-full rounded-2xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3.5 text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 shadow-sm transition-all"
                                placeholder="Ex: Manutenção preventiva"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-3 ml-1 tracking-tight">Identidade visual (cor)</label>
                            <div className="grid grid-cols-4 gap-3">
                                {PRESET_COLORS.map(color => (
                                    <button
                                        key={color.hex}
                                        type="button"
                                        onClick={() => setForm({...form, color: color.hex})}
                                        className={`h-10 rounded-xl transition-all border-4 flex items-center justify-center ${form.color === color.hex ? 'border-indigo-500 scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'}`}
                                        style={{ backgroundColor: color.hex }}
                                        title={color.name}
                                    >
                                        {form.color === color.hex && <CheckCircleIcon className="w-5 h-5 text-white drop-shadow-md" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl cursor-pointer hover:bg-indigo-50/50 transition-all border border-transparent hover:border-indigo-100 group">
                            <div className="relative">
                                <input 
                                    type="checkbox" 
                                    checked={form.personalSchedule} 
                                    onChange={e => setForm({...form, personalSchedule: e.target.checked})}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-indigo-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-xs font-black text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 transition-colors">Atividade pessoal</span>
                                <span className="text-[10px] text-gray-400 font-bold leading-tight">Marque se esta atividade não exige dados de obra (ex: folga, reunião).</span>
                            </div>
                        </label>

                        <div className="flex gap-3 pt-4 border-t dark:border-gray-700">
                            <button 
                                type="button" 
                                onClick={() => setIsModalOpen(false)} 
                                className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-all"
                            >
                                Cancelar
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSaving}
                                className="flex-[2] py-3.5 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? 'Gravando...' : (editingItem ? 'Salvar alterações' : 'Criar atividade')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default InstalacoesCadastroPage;