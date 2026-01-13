import React, { useState, useMemo, useEffect } from 'react';
import { 
    TrashIcon, EditIcon, PlusIcon, ChevronDownIcon, 
    FilterIcon, CheckCircleIcon, XCircleIcon, CogIcon, TableIcon
} from '../../assets/icons';
import type { FinancialCategory, FinancialTransactionType, FinancialGroup, FinancialClassification } from '../../types';
import { dataService } from '../../services/dataService';
import Modal from '../Modal';

interface CategoriasViewProps {
    categories: FinancialCategory[];
    onAddCategory: (data: Partial<FinancialCategory>) => void;
    onUpdateCategory: (id: string, data: Partial<FinancialCategory>) => void;
    onDeleteCategory: (id: string) => void;
}

const CategoriasView: React.FC<CategoriasViewProps> = ({ 
    categories, onAddCategory, onUpdateCategory, onDeleteCategory 
}) => {
    const [activeTab, setActiveTab] = useState<FinancialTransactionType>('receita');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isClassificationModalOpen, setIsClassificationModalOpen] = useState(false);
    
    const [groups, setGroups] = useState<FinancialGroup[]>([]);
    const [classifications, setClassifications] = useState<FinancialClassification[]>([]);
    const [editingCategory, setEditingCategory] = useState<FinancialCategory | null>(null);

    const [formData, setFormData] = useState<Partial<FinancialCategory>>({
        code: '',
        name: '',
        classification: '',
        group: '',
        showInDre: true,
        active: true
    });

    const [groupName, setGroupName] = useState('');
    const [classificationName, setClassificationName] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const [grps, classifs] = await Promise.all([
            dataService.getAll<FinancialGroup>('financial_groups'),
            dataService.getAll<FinancialClassification>('financial_classifications')
        ]);
        setGroups(grps);
        setClassifications(classifs);
    };

    const filteredCategories = useMemo(() => {
        return categories
            .filter(c => c.type === activeTab)
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, activeTab]);

    const activeTabGroups = useMemo(() => {
        return groups.filter(g => g.type === activeTab).sort((a, b) => a.name.localeCompare(b.name));
    }, [groups, activeTab]);

    const activeTabClassifications = useMemo(() => {
        return classifications.filter(c => c.type === activeTab).sort((a, b) => a.name.localeCompare(b.name));
    }, [classifications, activeTab]);

    const handleOpenModal = (cat?: FinancialCategory) => {
        if (cat) {
            setEditingCategory(cat);
            setFormData({ ...cat });
        } else {
            setEditingCategory(null);
            setFormData({ 
                code: '', 
                name: '', 
                classification: activeTabClassifications[0]?.id || '', 
                group: '',
                showInDre: true, 
                active: true, 
                type: activeTab 
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!formData.name?.trim()) {
            alert("Por favor, informe o nome da categoria.");
            return;
        }
        const finalData = { ...formData, type: formData.type || activeTab };
        if (editingCategory) onUpdateCategory(editingCategory.id, finalData);
        else onAddCategory(finalData);
        setIsModalOpen(false);
    };

    const handleAddGroup = async () => {
        if (!groupName.trim()) return;
        const newGroup: FinancialGroup = { id: `grp-${Date.now()}`, name: groupName.trim(), type: activeTab };
        await dataService.save('financial_groups', newGroup);
        setGroupName('');
        loadData();
    };

    const handleAddClassification = async () => {
        if (!classificationName.trim()) return;
        const newClass: FinancialClassification = { id: `cls-${Date.now()}`, name: classificationName.trim(), type: activeTab };
        await dataService.save('financial_classifications', newClass);
        setClassificationName('');
        loadData();
    };

    const handleDeleteGroup = async (id: string) => {
        if (confirm("Deseja remover este grupo?")) {
            await dataService.delete('financial_groups', id);
            loadData();
        }
    };

    const handleDeleteClassification = async (id: string) => {
        if (confirm("Deseja remover esta classificação?")) {
            await dataService.delete('financial_classifications', id);
            loadData();
        }
    };

    const TabButton = ({ type, label }: { type: FinancialTransactionType, label: string }) => (
        <button
            onClick={() => setActiveTab(type)}
            className={`px-6 py-3 text-sm font-bold transition-all border-b-2 ${
                activeTab === type 
                ? 'border-indigo-600 text-indigo-700' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
        >
            {label}
        </button>
    );

    const inputBaseClass = "w-full h-11 rounded-xl border-transparent bg-gray-50 dark:bg-gray-700 px-4 py-2 text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all";

    return (
        <div className="space-y-6 animate-fade-in">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Categorias financeiras</h1>

            <div className="flex border-b border-gray-200 dark:border-gray-700">
                <TabButton type="receita" label="Receitas" />
                <TabButton type="despesa" label="Despesas" />
                <TabButton type="resultado" label="Resultado" />
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                        {activeTab === 'receita' ? 'Receitas operacionais' : activeTab === 'despesa' ? 'Despesas operacionais' : 'Apuração de resultado'}
                    </h2>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setIsClassificationModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                        >
                            <TableIcon className="w-4 h-4" />
                            Classificações
                        </button>
                        <button 
                            onClick={() => setIsGroupModalOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full text-xs font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 transition-colors"
                        >
                            <CogIcon className="w-4 h-4" />
                            Grupos
                        </button>
                        <button 
                            onClick={() => handleOpenModal()}
                            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-700 text-white rounded-full text-xs font-bold hover:bg-indigo-800 transition-all shadow-lg active:scale-95"
                        >
                            <PlusIcon className="w-4 h-4" />
                            Adicionar categoria
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50 dark:bg-gray-900/20 text-[11px] font-bold text-gray-500 border-b dark:border-gray-700">
                                <th className="px-6 py-4">Nome da categoria</th>
                                <th className="px-6 py-4">Classificação</th>
                                <th className="px-6 py-4 text-center">Mostrar no DRE</th>
                                <th className="px-6 py-4">Situação</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                            {filteredCategories.map(cat => (
                                <tr key={cat.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col text-left">
                                            <span className="text-[13px] font-bold text-gray-700 dark:text-gray-200 group-hover:text-indigo-600 transition-colors">{cat.code ? `${cat.code} - ` : ''}{cat.name}</span>
                                            {cat.group && <span className="text-[10px] text-gray-400 font-medium">Grupo: {cat.group}</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-[11px] font-semibold text-gray-500">
                                        {classifications.find(c => c.id === cat.classification)?.name || cat.classification || 'Não definida'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {cat.showInDre ? (
                                            <div className="flex justify-center"><CheckCircleIcon className="w-5 h-5 text-green-500" /></div>
                                        ) : (
                                            <div className="flex justify-center"><XCircleIcon className="w-5 h-5 text-gray-300" /></div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${
                                            cat.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                        }`}>
                                            {cat.active ? 'Ativo' : 'Inativo'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-1 transition-opacity">
                                            <button onClick={() => handleOpenModal(cat)} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors">
                                                <EditIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => onDeleteCategory(cat.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredCategories.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic text-sm">
                                        Nenhuma categoria cadastrada nesta aba.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal para Gerenciar Grupos */}
            {isGroupModalOpen && (
                <Modal title="Gerenciar grupos" onClose={() => setIsGroupModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-4 pt-2">
                        <p className="text-[10px] font-bold text-gray-400 tracking-widest text-center">Grupos para {activeTab}s</p>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Nome do novo grupo..." value={groupName} onChange={e => setGroupName(e.target.value)} className={inputBaseClass} />
                            <button onClick={handleAddGroup} className="px-4 h-11 bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg">Adicionar</button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {activeTabGroups.map(g => (
                                <div key={g.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{g.name}</span>
                                    <button onClick={() => handleDeleteGroup(g.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setIsGroupModalOpen(false)} className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl font-bold text-xs">Fechar</button>
                    </div>
                </Modal>
            )}

            {/* Modal para Gerenciar Classificações */}
            {isClassificationModalOpen && (
                <Modal title="Gerenciar classificações" onClose={() => setIsClassificationModalOpen(false)} maxWidth="max-w-md">
                    <div className="space-y-4 pt-2">
                        <p className="text-[10px] font-bold text-gray-400 tracking-widest text-center">Classificações para {activeTab}s</p>
                        <div className="flex gap-2">
                            <input type="text" placeholder="Ex: Receita operacional..." value={classificationName} onChange={e => setClassificationName(e.target.value)} className={inputBaseClass} />
                            <button onClick={handleAddClassification} className="px-4 h-11 bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg">Adicionar</button>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {activeTabClassifications.map(c => (
                                <div key={c.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border dark:border-gray-700">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{c.name}</span>
                                    <button onClick={() => handleDeleteClassification(c.id)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => setIsClassificationModalOpen(false)} className="w-full py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl font-bold text-xs">Fechar</button>
                    </div>
                </Modal>
            )}

            {/* Modal de Cadastro de Categoria */}
            {isModalOpen && (
                <Modal 
                    title={editingCategory ? "Editar categoria" : "Nova categoria"} 
                    onClose={() => setIsModalOpen(false)}
                    maxWidth="max-w-lg"
                >
                    <form onSubmit={handleSave} className="space-y-5 pt-2">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Código (opcional)</label>
                                <input type="text" placeholder="Ex: 1.1" value={formData.code || ''} onChange={e => setFormData({...formData, code: e.target.value})} className={inputBaseClass} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Nome da categoria</label>
                                <input type="text" required placeholder="Ex: Receita de serviços" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} className={inputBaseClass} />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Grupo gerencial</label>
                            <select value={formData.group || ''} onChange={e => setFormData({...formData, group: e.target.value})} className={`${inputBaseClass} cursor-pointer`}>
                                <option value="">Sem grupo definido</option>
                                {activeTabGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 ml-1">Classificação contábil ({activeTab}s)</label>
                            <select 
                                required
                                value={formData.classification || ''} 
                                onChange={e => setFormData({...formData, classification: e.target.value})} 
                                className={`${inputBaseClass} cursor-pointer`}
                            >
                                <option value="" disabled>Selecione uma classificação...</option>
                                {activeTabClassifications.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-indigo-200">
                                <input type="checkbox" checked={!!formData.showInDre} onChange={e => setFormData({...formData, showInDre: e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Exibir no DRE</span>
                            </label>
                            <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors border border-transparent hover:border-indigo-200">
                                <input type="checkbox" checked={!!formData.active} onChange={e => setFormData({...formData, active: e.target.checked})} className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300" />
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">Categoria ativa</span>
                            </label>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded-xl font-bold text-xs hover:bg-gray-200 transition-colors">Cancelar</button>
                            <button type="submit" className="flex-1 py-3.5 bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-lg hover:bg-indigo-800 transition-all active:scale-95">{editingCategory ? 'Atualizar categoria' : 'Salvar categoria'}</button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
};

export default CategoriasView;