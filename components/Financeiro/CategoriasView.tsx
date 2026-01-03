
import React, { useState } from 'react';
import { TrashIcon, AddIcon, EditIcon, CheckCircleIcon, XCircleIcon, PlusIcon } from '../../assets/icons';
import type { FinancialCategory, FinancialTransactionType } from '../../types';
import Modal from '../Modal';

interface CategoryListProps {
    type: FinancialTransactionType;
    title: string;
    onAddCategory: (name: string, type: FinancialTransactionType) => void;
    onUpdateCategory: (id: string, name: string) => void;
    onDeleteCategory: (id: string) => void;
    categories: FinancialCategory[];
}

const CategoryList: React.FC<CategoryListProps> = ({ 
    type, 
    title, 
    onAddCategory,
    onUpdateCategory,
    categories, 
    onDeleteCategory 
}) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [newItemName, setNewItemName] = useState('');
    
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');

    const handleAdd = () => {
        if (!newItemName.trim()) return;
        onAddCategory(newItemName.trim(), type);
        setNewItemName('');
        setIsAddModalOpen(false);
    };

    const startEditing = (category: FinancialCategory) => {
        setEditingId(category.id);
        setEditingName(category.name);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditingName('');
    };

    const saveEdit = (id: string) => {
        if (!editingName.trim()) return;
        onUpdateCategory(id, editingName.trim());
        setEditingId(null);
        setEditingName('');
    };

    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl flex flex-col h-full border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className={`text-lg font-bold tracking-tight ${type === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {title}
                </h3>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm hover:shadow-md active:scale-95 ${
                        type === 'receita' 
                        ? 'bg-green-600 text-white hover:bg-green-700' 
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                >
                    <PlusIcon className="w-4 h-4" /> Nova categoria
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {categories
                    .filter(c => c.type === type)
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(category => (
                    <div key={category.id} className="group flex justify-between items-center p-3.5 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 transition-all hover:bg-white dark:hover:bg-gray-700">
                        {editingId === category.id ? (
                            <div className="flex-1 flex gap-2 items-center">
                                <input 
                                    type="text"
                                    autoFocus
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(category.id)}
                                    className="flex-1 text-sm p-1.5 rounded-lg border-indigo-300 focus:ring-indigo-500 dark:bg-gray-800 font-medium"
                                />
                                <button onClick={() => saveEdit(category.id)} className="text-green-600 hover:text-green-700 p-1">
                                    <CheckCircleIcon className="w-5 h-5" />
                                </button>
                                <button onClick={cancelEditing} className="text-red-400 hover:text-red-500 p-1">
                                    <XCircleIcon className="w-5 h-5" />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className="font-bold text-gray-700 dark:text-gray-200 text-[13px] tracking-tight">{category.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => startEditing(category)}
                                        className="text-gray-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                        title="Editar nome"
                                    >
                                        <EditIcon className="w-4 h-4" />
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onDeleteCategory(category.id);
                                        }}
                                        className="text-gray-400 hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                                        title="Excluir categoria"
                                    >
                                        <TrashIcon className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
                {categories.filter(c => c.type === type).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-16 opacity-30">
                        <div className="p-4 bg-gray-100 dark:bg-gray-900 rounded-full mb-4">
                            <TrashIcon className="w-12 h-12" />
                        </div>
                        <p className="text-center text-xs font-bold tracking-wide">Nenhuma categoria</p>
                    </div>
                )}
            </div>

            {isAddModalOpen && (
                <Modal 
                    title={`Nova categoria de ${type === 'receita' ? 'Receita' : 'Despesa'}`} 
                    onClose={() => setIsAddModalOpen(false)}
                >
                    <div className="space-y-6 pt-2">
                        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900/40 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
                             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${type === 'receita' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                <AddIcon className="w-6 h-6" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Defina o nome da categoria</p>
                                <p className="text-[10px] font-bold text-gray-500 tracking-wide">Organização financeira</p>
                             </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-400 mb-1.5 ml-1">Descrição / Nome</label>
                            <input 
                                required 
                                autoFocus
                                type="text"
                                placeholder="Ex: Vendas online, Aluguel, etc..." 
                                value={newItemName} 
                                onChange={e => setNewItemName(e.target.value)} 
                                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                                className="w-full rounded-xl border-transparent bg-gray-50 dark:bg-gray-700/50 p-3.5 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" 
                            />
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                            <button 
                                type="button" 
                                onClick={() => setIsAddModalOpen(false)} 
                                className="flex-1 py-3 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-xl font-bold text-xs transition-all hover:bg-gray-200"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleAdd}
                                disabled={!newItemName.trim()}
                                className={`flex-1 py-3 rounded-xl font-bold text-xs shadow-lg transition-all active:scale-95 disabled:opacity-50 ${
                                    type === 'receita' 
                                    ? 'bg-green-600 text-white shadow-green-600/20 hover:bg-green-700' 
                                    : 'bg-red-600 text-white shadow-red-600/20 hover:bg-red-700'
                                }`}
                            >
                                Salvar categoria
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

const CategoriasView: React.FC<{
    categories: FinancialCategory[];
    onAddCategory: (name: string, type: FinancialTransactionType) => void;
    onUpdateCategory: (id: string, name: string) => void;
    onDeleteCategory: (id: string) => void;
}> = ({ categories, onAddCategory, onUpdateCategory, onDeleteCategory }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[650px] animate-fade-in">
            <CategoryList 
                type="receita" 
                title="Categorias de Receita" 
                onAddCategory={onAddCategory}
                onUpdateCategory={onUpdateCategory}
                categories={categories}
                onDeleteCategory={onDeleteCategory}
            />
            <CategoryList 
                type="despesa" 
                title="Categorias de Despesa" 
                onAddCategory={onAddCategory}
                onUpdateCategory={onUpdateCategory}
                categories={categories}
                onDeleteCategory={onDeleteCategory}
            />
        </div>
    );
};

export default CategoriasView;
