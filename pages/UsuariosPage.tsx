
import React, { useState, useEffect, useRef } from 'react';
/* Added TrashIcon to imports */
import { AddIcon, EditIcon, UsersIcon, LockClosedIcon, SaveIcon, PhotographIcon, XCircleIcon, ExclamationTriangleIcon, EyeIcon, EyeOffIcon, UploadIcon, CheckCircleIcon, TrashIcon } from '../assets/icons';
import type { User, UserProfile, UsuariosPageProps } from '../types';
import { MENU_ITEMS, MOCK_USERS, MOCK_PROFILES } from '../constants';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';

const UsuariosPage: React.FC<UsuariosPageProps> = ({ view }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [isProfileFormOpen, setProfileFormOpen] = useState(false);
    const [isDeleteProfileModalOpen, setDeleteProfileModalOpen] = useState(false);
    
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [profileToEdit, setProfileToEdit] = useState<UserProfile | null>(null);
    const [profileToDelete, setProfileToDelete] = useState<UserProfile | null>(null);

    const [userData, setUserData] = useState<Partial<User>>({ name: '', email: '', password: '', profileId: '', active: true, avatar: '' });
    const [profileData, setProfileData] = useState<Partial<UserProfile>>({ name: '', permissions: [] });
    const [showPassword, setShowPassword] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const loadData = async () => {
        try {
            const loadedUsers = await dataService.getAll<User>('system_users');
            setUsers(loadedUsers.length > 0 ? loadedUsers : MOCK_USERS);
            
            const loadedProfiles = await dataService.getAll<UserProfile>('system_profiles');
            setProfiles(loadedProfiles.length > 0 ? loadedProfiles : MOCK_PROFILES);
        } catch (error) {
            console.error("Erro ao carregar dados:", error);
        }
    };

    useEffect(() => { loadData(); }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const img = new Image();
                img.src = reader.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_SIZE = 400;
                    let width = img.width;
                    let height = img.height;
                    if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
                    else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
                    canvas.width = width; canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    setUserData(prev => ({ ...prev, avatar: canvas.toDataURL('image/jpeg', 0.7) }));
                };
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        const newUser: User = {
            id: userToEdit ? String(userToEdit.id) : Date.now().toString(),
            name: userData.name!, 
            email: userData.email!, 
            password: userData.password,
            profileId: String(userData.profileId!), 
            active: userData.active ?? true,
            avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name!)}&background=random`
        };
        await dataService.save('system_users', newUser);
        await loadData();
        setUserModalOpen(false);
        setShowPassword(false);
    };

    const handleStatusToggle = async (user: User, newActiveState: boolean) => {
        const updatedUser = { ...user, active: newActiveState };
        await dataService.save('system_users', updatedUser);
        await loadData();
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const newProfile: UserProfile = { 
            id: profileToEdit ? String(profileToEdit.id) : Date.now().toString(), 
            name: profileData.name!, 
            permissions: profileData.permissions || [] 
        };
        await dataService.save('system_profiles', newProfile);
        await loadData();
        setProfileFormOpen(false);
    };

    const handleRequestDeleteProfile = (profile: UserProfile) => {
        if (users.some(u => String(u.profileId) === String(profile.id))) {
            alert('Não é possível excluir um perfil com usuários vinculados.');
            return;
        }
        setProfileToDelete(profile);
        setDeleteProfileModalOpen(true);
    };

    const confirmDeleteProfile = async () => {
        if (profileToDelete) {
            await dataService.delete('system_profiles', profileToDelete.id);
            await loadData();
            setDeleteProfileModalOpen(false);
        }
    };

    const togglePermission = (id: string) => {
        let perms = [...(profileData.permissions || [])];
        const isCurrentlyChecked = perms.includes(id);
        
        const menuItem = MENU_ITEMS.find(m => m.id === id);
        
        if (menuItem && menuItem.children) {
            const childIds = menuItem.children.map(c => c.id as string);
            
            if (isCurrentlyChecked) {
                perms = perms.filter(p => p !== id && !childIds.includes(p));
            } else {
                const newPermsSet = new Set([...perms, id, ...childIds]);
                perms = Array.from(newPermsSet);
            }
        } else {
            if (isCurrentlyChecked) {
                perms = perms.filter(p => p !== id);
            } else {
                perms.push(id);
            }
        }
        
        setProfileData({ ...profileData, permissions: perms });
    };

    if (view === 'gestao') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-white"><UsersIcon className="w-8 h-8 text-indigo-600" /> Gestão de usuários</h2>
                    <button onClick={() => { setUserToEdit(null); setUserData({name:'', email:'', password: '', profileId:'', active:true, avatar: ''}); setShowPassword(false); setUserModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md"><AddIcon className="w-5 h-5" /> Novo usuário</button>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 font-bold">
                            <tr><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">E-mail</th><th className="px-6 py-4">Perfil</th><th className="px-6 py-4">Status de Acesso</th><th className="px-6 py-4 text-center">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {users.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 flex items-center gap-3 font-bold text-gray-900 dark:text-white">
                                        <div className="w-10 h-10 rounded-full border dark:border-gray-600 overflow-hidden bg-gray-100 flex-shrink-0">
                                            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        {user.name}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">{user.email}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold">{profiles.find(p => String(p.id) === String(user.profileId))?.name || 'N/A'}</span></td>
                                    <td className="px-6 py-4">
                                        <select 
                                            value={user.active ? 'liberado' : 'bloqueado'} 
                                            onChange={(e) => handleStatusToggle(user, e.target.value === 'liberado')}
                                            className={`text-[10px] font-bold rounded-lg border-transparent px-3 py-1.5 focus:ring-0 outline-none transition-all cursor-pointer shadow-sm ${user.active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}
                                        >
                                            <option value="liberado" className="bg-white text-gray-800">Liberado</option>
                                            <option value="bloqueado" className="bg-white text-gray-800">Bloqueado</option>
                                        </select>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button onClick={() => { setUserToEdit(user); setUserData(user); setShowPassword(false); setUserModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar usuário"><EditIcon className="w-5 h-5" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {isUserModalOpen && (
                    <Modal title={userToEdit ? 'Editar usuário' : 'Novo usuário'} onClose={() => setUserModalOpen(false)}>
                        <form onSubmit={handleSaveUser} className="space-y-4 pt-2">
                            <div className="flex flex-col items-center gap-4 py-4 border-b dark:border-gray-700 mb-4">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden bg-gray-100">
                                        {userData.avatar ? (
                                            <img src={userData.avatar} className="w-full h-full object-cover" alt="Avatar" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-300">
                                                <PhotographIcon className="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all border-2 border-white dark:border-gray-800"
                                        title="Alterar foto"
                                    >
                                        <UploadIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nome completo</label>
                                <input required type="text" value={userData.name} onChange={e => setUserData({...userData, name:e.target.value})} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Ex: Maria Oliveira" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">E-mail de acesso</label>
                                <input required type="email" value={userData.email} onChange={e => setUserData({...userData, email:e.target.value})} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="usuario@orner.com.br" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Senha</label>
                                <div className="relative">
                                    <input 
                                        required={!userToEdit} 
                                        type={showPassword ? "text" : "password"} 
                                        value={userData.password} 
                                        onChange={e => setUserData({...userData, password:e.target.value})} 
                                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10" 
                                        placeholder={userToEdit ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} 
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Perfil de acesso</label>
                                <select required value={userData.profileId} onChange={e => setUserData({...userData, profileId:e.target.value})} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20">
                                    <option value="">Selecione um perfil...</option>
                                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setUserModalOpen(false)} className="px-5 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-200">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all">Salvar usuário</button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
        );
    }

    if (view === 'perfil') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-white"><LockClosedIcon className="w-8 h-8 text-indigo-600" /> Perfis de acesso</h2>
                    <button onClick={() => { setProfileToEdit(null); setProfileData({name:'', permissions:[]}); setProfileFormOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors"><AddIcon className="w-5 h-5" /> Novo perfil</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {profiles.map(p => (
                        <div key={p.id} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 flex flex-col hover:shadow-lg transition-all">
                            <div className="flex justify-between items-center mb-4 border-b dark:border-gray-700 pb-2">
                                <h3 className="font-bold text-indigo-600 dark:text-indigo-400">{p.name}</h3>
                                <div className="flex gap-1"><button onClick={() => { setProfileToEdit(p); setProfileData(p); setProfileFormOpen(true); }} className="p-1 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar perfil"><EditIcon className="w-4 h-4" /></button><button onClick={() => handleRequestDeleteProfile(p)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Excluir perfil"><TrashIcon className="w-4 h-4" /></button></div>
                            </div>
                            <div className="flex-1 text-[10px] text-gray-500 dark:text-gray-400 font-bold">Permissões: {p.permissions.length} módulos</div>
                        </div>
                    ))}
                </div>
                {isProfileFormOpen && (
                    <Modal title="Configurar perfil de acesso" onClose={() => setProfileFormOpen(false)} maxWidth="max-w-2xl">
                        <form onSubmit={handleSaveProfile} className="space-y-6">
                            <div><label className="block text-xs font-bold text-gray-500 mb-1.5 ml-1">Nome do perfil</label><input required type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name:e.target.value})} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 font-bold text-gray-900 dark:text-white" placeholder="Ex: Consultor comercial" /></div>
                            <div className="max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                {MENU_ITEMS.map(menu => (
                                    <div key={menu.id} className="mb-4 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-600">
                                        <div className="flex items-center gap-2 mb-2">
                                            <input 
                                                type="checkbox" 
                                                checked={profileData.permissions?.includes(menu.id)} 
                                                onChange={() => togglePermission(menu.id)} 
                                                className="w-4 h-4 rounded text-indigo-600 transition-all cursor-pointer" 
                                            />
                                            <label className="font-bold text-xs text-gray-800 dark:text-white cursor-pointer" onClick={() => togglePermission(menu.id)}>{menu.label}</label>
                                        </div>
                                        {menu.children && (
                                            <div className="ml-6 grid grid-cols-2 gap-2">
                                                {menu.children.map(c => (
                                                    <div key={c.id} className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={profileData.permissions?.includes(c.id)} 
                                                            onChange={() => togglePermission(c.id)} 
                                                            className="w-3.5 h-3.5 rounded cursor-pointer" 
                                                        />
                                                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 cursor-pointer" onClick={() => togglePermission(c.id)}>{c.label}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700"><button type="button" onClick={() => setProfileFormOpen(false)} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-xs text-gray-500">Cancelar</button><button type="submit" className="px-7 py-2.5 bg-green-600 text-white rounded-lg font-bold text-xs shadow-lg hover:bg-green-700">Salvar perfil</button></div>
                        </form>
                    </Modal>
                )}
                {isDeleteProfileModalOpen && profileToDelete && (
                    <Modal title="Confirmar exclusão" onClose={() => setDeleteProfileModalOpen(false)}>
                        <div className="text-center p-4 space-y-6">
                            <ExclamationTriangleIcon className="h-12 w-12 text-red-600 mx-auto" />
                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Excluir perfil?</h3>
                            <p className="text-sm text-gray-500">O perfil <b>"{profileToDelete.name}"</b> será removido permanentemente.</p>
                            <div className="flex gap-3"><button onClick={() => setDeleteProfileModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 rounded-lg font-bold text-xs text-gray-500">Voltar</button><button onClick={confirmDeleteProfile} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold text-xs shadow-lg">Sim, excluir</button></div>
                        </div>
                    </Modal>
                )}
            </div>
        );
    }
    return null;
};

export default UsuariosPage;
