
import React from 'react';
import { MENU_ITEMS } from '../constants';
import type { Page, User, MenuItem } from '../types';

interface WelcomePageProps {
    currentUser: User;
    userPermissions: string[];
    onNavigate: (page: Page) => void;
}

const WelcomePage: React.FC<WelcomePageProps> = ({ currentUser, userPermissions, onNavigate }) => {
    
    // Filtra itens permitidos para exibição na grade
    const allowedModules = React.useMemo(() => {
        const isAdmin = userPermissions.includes('ALL');
        
        return MENU_ITEMS.map(item => {
            if (item.id === 'DASHBOARD') return null;

            if (item.children) {
                const allowedChildren = item.children.filter(child => 
                    isAdmin || userPermissions.includes(child.id as string)
                );
                if (allowedChildren.length > 0) {
                    return { ...item, children: allowedChildren };
                }
                return null;
            }

            return (isAdmin || userPermissions.includes(item.id as string)) ? item : null;
        }).filter(item => item !== null) as MenuItem[];
    }, [userPermissions]);

    return (
        <div className="max-w-6xl mx-auto py-8 animate-fade-in">
            <div className="mb-10">
                <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                    Olá, {currentUser.name.split(' ')[0]}! 👋
                </h1>
                <p className="text-gray-500 dark:text-gray-400 font-medium mt-2">
                    Bem-vindo ao sistema Orner. Selecione um módulo abaixo para começar seu trabalho:
                </p>
            </div>

            {allowedModules.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {allowedModules.map((module) => (
                        <div 
                            key={module.id} 
                            className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl shadow-indigo-500/5 border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-indigo-500/10 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group"
                        >
                            <div className="flex items-center gap-4 mb-6">
                                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform">
                                    <module.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-bold text-gray-800 dark:text-white">{module.label}</h3>
                            </div>

                            <div className="flex-1 space-y-2">
                                {module.children ? (
                                    module.children.map(child => (
                                        <button
                                            key={child.id}
                                            onClick={() => onNavigate(child.id as Page)}
                                            className="w-full text-left p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-sm font-bold text-gray-600 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-400 flex justify-between items-center transition-all group/btn"
                                        >
                                            {child.label}
                                            <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity">→</span>
                                        </button>
                                    ))
                                ) : (
                                    <button
                                        onClick={() => onNavigate(module.id as Page)}
                                        className="w-full mt-2 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
                                    >
                                        Acessar módulo
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-8 rounded-3xl text-center max-w-md mx-auto">
                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    </div>
                    <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200">Sem permissões</h2>
                    <p className="text-sm text-amber-800 dark:text-amber-300 mt-2">
                        Seu perfil não possui nenhum módulo habilitado para acesso. Por favor, contate o administrador do sistema.
                    </p>
                </div>
            )}
        </div>
    );
};

export default WelcomePage;
