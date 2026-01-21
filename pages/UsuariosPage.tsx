
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AddIcon, EditIcon, UsersIcon, LockClosedIcon, SaveIcon, 
  PhotographIcon, XCircleIcon, ExclamationTriangleIcon, EyeIcon, 
  EyeOffIcon, UploadIcon, CheckCircleIcon, TrashIcon, ClockIcon,
  FingerprintIcon, PlusIcon, SparklesIcon
} from '../assets/icons';
import type { User, UserProfile, UsuariosPageProps } from '../types';
import { MENU_ITEMS, MOCK_USERS, MOCK_PROFILES } from '../constants';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';

const UsuariosPage: React.FC<UsuariosPageProps> = ({ view, currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    
    const [isUserModalOpen, setUserModalOpen] = useState(false);
    const [isProfileFormOpen, setProfileFormOpen] = useState(false);
    const [isDeleteProfileModalOpen, setDeleteProfileModalOpen] = useState(false);
    
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [profileToEdit, setProfileToEdit] = useState<UserProfile | null>(null);
    const [profileToDelete, setProfileToDelete] = useState<UserProfile | null>(null);

    const [userData, setUserData] = useState<Partial<User>>({ 
        name: '', email: '', password: '', profileId: '', 
        active: true, avatar: '', darkMode: false, biometricsEnabled: false 
    });
    const [profileData, setProfileData] = useState<Partial<UserProfile>>({ name: '', permissions: [], hasGlobalView: false });
    const [showPassword, setShowPassword] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAdmin = useMemo(() => {
        const adminProfileIds = ['001', '00000000-0000-0000-0000-000000000001'];
        if (adminProfileIds.includes(String(currentUser.profileId))) return true;
        const currentProfile = profiles.find(p => String(p.id) === String(currentUser.profileId));
        return currentProfile?.permissions?.includes('ALL') || false;
    }, [currentUser, profiles]);

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

    const visibleUsers = useMemo(() => {
        if (isAdmin) return users;
        return users.filter(u => String(u.id) === String(currentUser.id));
    }, [users, isAdmin, currentUser]);

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
            avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name!)}&background=random`,
            darkMode: userData.darkMode ?? false,
            biometricsEnabled: !!userData.biometricsEnabled
        };
        await dataService.save('system_users', newUser);
        if (String(newUser.id) === String(currentUser.id)) {
            authService.saveSession(newUser);
        }
        await loadData();
        setUserModalOpen(false);
        setShowPassword(false);
    };

    const handleStatusToggle = async (user: User, newActiveState: boolean) => {
        const updatedUser = { ...user, active: newActiveState };
        await dataService.save('system_users', updatedUser);
        await loadData();
    };

    const toggleDarkMode = () => {
        const nextState = !userData.darkMode;
        setUserData({ ...userData, darkMode: nextState });
        if (userToEdit && String(userToEdit.id) === String(currentUser.id)) {
            if (nextState) document.documentElement.classList.add('dark');
            else document.documentElement.classList.remove('dark');
        }
    };

    const toggleBiometrics = () => {
        setUserData(prev => ({ ...prev, biometricsEnabled: !prev.biometricsEnabled }));
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const newProfile: UserProfile = { 
            id: profileToEdit ? String(profileToEdit.id) : Date.now().toString(), 
            name: profileData.name!, 
            permissions: profileData.permissions || [],
            hasGlobalView: !!profileData.hasGlobalView
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
            if (isCurrentlyChecked) perms = perms.filter(p => p !== id && !childIds.includes(p));
            else perms = Array.from(new Set([...perms, id, ...childIds]));
        } else {
            if (isCurrentlyChecked) perms = perms.filter(p => p !== id);
            else perms.push(id);
        }
        setProfileData({ ...profileData, permissions: perms });
    };

    if (view === 'gestao') {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 rounded-xl">
                            <UsersIcon className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-gray-800 dark:text-white leading-none">
                                {isAdmin ? 'Gestão de Usuários' : 'Meu perfil e acesso'}
                            </h2>
                            <p className="text-[10px] text-gray-400 font-bold mt-1.5 tracking-tight">{visibleUsers.length} registros</p>
                        </div>
                    </div>
                    {isAdmin && (
                        <button onClick={() => { setUserToEdit(null); setUserData({name:'', email:'', password: '', profileId:'', active:true, avatar: '', darkMode: false, biometricsEnabled: false}); setShowPassword(false); setUserModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg active:scale-95"><AddIcon className="w-5 h-5" /> <span className="hidden sm:inline">Novo usuário</span></button>
                    )}
                </div>

                <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden border border-gray-100 dark:border-gray-700">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-[10px] text-gray-400 font-black tracking-tight">
                            <tr><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">E-mail</th><th className="px-6 py-4">Perfil</th><th className="px-6 py-4">Acesso</th><th className="px-6 py-4 text-right">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {visibleUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="px-6 py-4 flex items-center gap-3 font-bold text-gray-900 dark:text-white">
                                        <div className="w-10 h-10 rounded-full border-2 border-white dark:border-gray-600 shadow-sm overflow-hidden bg-gray-100">
                                            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div>
                                            <p className="text-[13px]">{user.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] text-gray-400 font-black tracking-tighter">{user.darkMode ? '🌙 Dark' : '☀️ Light'}</span>
                                                {user.biometricsEnabled && <FingerprintIcon className="w-3 h-3 text-indigo-500" />}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium text-[12px]">{user.email}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded-lg text-[10px] font-bold border border-indigo-100 dark:border-indigo-800">{profiles.find(p => String(p.id) === String(user.profileId))?.name || 'N/A'}</span></td>
                                    <td className="px-6 py-4">{isAdmin ? (<select value={user.active ? 'liberado' : 'bloqueado'} onChange={(e) => handleStatusToggle(user, e.target.value === 'liberado')} className={`text-[10px] font-bold rounded-lg border-transparent px-3 py-1.5 focus:ring-0 outline-none transition-all cursor-pointer shadow-sm ${user.active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}><option value="liberado" className="bg-white text-gray-800">Liberado</option><option value="bloqueado" className="bg-white text-gray-800">Bloqueado</option></select>) : (<span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.active ? 'Ativo' : 'Suspenso'}</span>)}</td>
                                    <td className="px-6 py-4 text-right"><button onClick={() => { setUserToEdit(user); setUserData(user); setShowPassword(false); setUserModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar usuário"><EditIcon className="w-5 h-5" /></button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="md:hidden space-y-4">
                    {visibleUsers.map(user => {
                        const profileName = profiles.find(p => String(p.id) === String(user.profileId))?.name || 'N/A';
                        return (
                            <div key={user.id} className="bg-white dark:bg-gray-800 p-5 rounded-3xl shadow-md border border-gray-100 dark:border-gray-700 space-y-4 relative overflow-hidden">
                                {user.biometricsEnabled && (
                                    <div className="absolute top-0 right-0 bg-indigo-600 text-white p-2 rounded-bl-2xl shadow-sm">
                                        <FingerprintIcon className="w-4 h-4" />
                                    </div>
                                )}
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full border-4 border-gray-50 dark:border-gray-700 shadow-sm overflow-hidden bg-gray-100">
                                        <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-black text-gray-900 dark:text-white truncate">{user.name}</h3>
                                        <p className="text-xs text-gray-500 font-bold truncate">{user.email}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 pt-4 border-t dark:border-gray-700">
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-gray-400 tracking-tight">Perfil</span>
                                        <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{profileName}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[9px] font-black text-gray-400 tracking-tight">Status</span>
                                        <div className="flex">
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {user.active ? 'Acesso Liberado' : 'Bloqueado'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => { setUserToEdit(user); setUserData(user); setShowPassword(false); setUserModalOpen(true); }} 
                                    className="w-full py-3.5 bg-gray-50 dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 rounded-2xl font-black text-xs tracking-tight flex items-center justify-center gap-2 hover:bg-indigo-50 transition-all border border-gray-100 dark:border-gray-600"
                                >
                                    <EditIcon className="w-4 h-4" /> Editar usuário
                                </button>
                            </div>
                        );
                    })}
                </div>

                {isUserModalOpen && (
                    <Modal title={userToEdit ? 'Editar usuário' : 'Novo usuário'} onClose={() => setUserModalOpen(false)}>
                        <form onSubmit={handleSaveUser} className="space-y-4 pt-2">
                            <div className="flex flex-col items-center gap-4 py-4 border-b dark:border-gray-700 mb-4">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 shadow-xl overflow-hidden bg-gray-100">
                                        {userData.avatar ? <img src={userData.avatar} className="w-full h-full object-cover" alt="Avatar" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><PhotographIcon className="w-12 h-12" /></div>}
                                    </div>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all border-2 border-white dark:border-gray-800"><UploadIcon className="w-4 h-4" /></button>
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Nome completo</label>
                                <input required type="text" value={userData.name} onChange={e => setUserData({...userData, name:e.target.value})} className="w-full rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all" placeholder="Ex: Maria Oliveira" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">E-mail de acesso</label>
                                <input required type="email" value={userData.email} onChange={e => setUserData({...userData, email:e.target.value})} className="w-full rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-gray-300" placeholder="usuario@orner.com.br" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 mb-1">Senha</label>
                                <div className="relative">
                                    <input required={!userToEdit} type={showPassword ? "text" : "password"} value={userData.password} onChange={e => setUserData({...userData, password:e.target.value})} className="w-full rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all pr-12" placeholder={userToEdit ? "••••••••" : "Mínimo 6 caracteres"} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors p-1">{showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}</button>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Perfil de acesso</label>
                                    <select required disabled={!isAdmin} value={userData.profileId} onChange={e => setUserData({...userData, profileId:e.target.value})} className="w-full rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3 text-sm font-bold text-gray-900 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed appearance-none"><option value="">Selecione um perfil...</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm text-amber-500 border border-gray-100 dark:border-gray-700">
                                                <PhotographIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[11px] font-black text-gray-700 dark:text-white tracking-tighter">Modo noturno</span>
                                        </div>
                                        <button type="button" onClick={toggleDarkMode} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${userData.darkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${userData.darkMode ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-600 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={`p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ${userData.biometricsEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                <FingerprintIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[11px] font-black text-gray-700 dark:text-white tracking-tighter">Acesso FaceID</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            onClick={toggleBiometrics} 
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${userData.biometricsEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${userData.biometricsEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t dark:border-gray-700">
                                <button type="button" onClick={() => setUserModalOpen(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-200 transition-all">Cancelar</button>
                                <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 transition-all active:scale-95">Salvar alterações</button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
        );
    }
    
    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 animate-fade-in">
          <h2 className="text-xl font-black mb-6 text-gray-800 dark:text-white flex items-center gap-3">
              <LockClosedIcon className="w-6 h-6 text-indigo-600" /> Gestão de Perfis e Permissões
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
             {profiles.map(p => (
               <div key={p.id} className="p-5 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-3xl flex justify-between items-center group hover:border-indigo-200 transition-all shadow-sm">
                 <div>
                   <h3 className="font-black text-gray-800 dark:text-white text-sm">{p.name}</h3>
                   <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-gray-400 font-bold tracking-tight">{p.permissions.length} permissões</p>
                        {p.hasGlobalView && <span className="text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-black">Visão Global</span>}
                   </div>
                 </div>
                 <div className="flex gap-1">
                    <button onClick={() => { setProfileToEdit(p); setProfileData(p); setProfileFormOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 rounded-xl transition-all"><EditIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleRequestDeleteProfile(p)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/40 rounded-xl transition-all"><TrashIcon className="w-5 h-5"/></button>
                 </div>
               </div>
             ))}
             <button onClick={() => { setProfileToEdit(null); setProfileData({name: '', permissions: [], hasGlobalView: false}); setProfileFormOpen(true); }} className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-3xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/10 transition-all group">
                 <PlusIcon className="w-8 h-8 mb-2 group-hover:scale-110 transition-transform" />
                 <span className="text-xs font-black tracking-tight">Novo perfil</span>
             </button>
          </div>

          {isProfileFormOpen && (
            <Modal title={profileToEdit ? 'Editar Perfil' : 'Novo Perfil'} onClose={() => setProfileFormOpen(false)}>
              <form onSubmit={handleSaveProfile} className="space-y-6 pt-2">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2 ml-1">Nome identificador do perfil</label>
                  <input required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full rounded-2xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3.5 text-sm font-bold text-gray-800 dark:text-white outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all shadow-sm" placeholder="Ex: Vendedor Externo" />
                </div>

                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-500 ml-1">Mapa de acessos</label>
                  <div className="max-h-[500px] overflow-y-auto border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-2xl p-3 space-y-4 custom-scrollbar shadow-inner">
                    <label className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl cursor-pointer shadow-sm border border-transparent hover:border-indigo-200 group transition-all">
                        <input type="checkbox" checked={profileData.permissions?.includes('ALL')} onChange={() => togglePermission('ALL')} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                        <div className="flex flex-col">
                            <span className="text-sm font-black text-indigo-600 tracking-tight">Administrador Master</span>
                            <span className="text-[10px] text-gray-400 font-bold leading-none mt-1">Acesso total e irrestrito ao sistema</span>
                        </div>
                    </label>
                    <div className="h-px bg-gray-200 dark:bg-gray-700 my-1 mx-1" />
                    {MENU_ITEMS.map(item => (
                        <div key={item.id} className="space-y-2">
                            <label className="flex items-center gap-3 p-2.5 hover:bg-white dark:hover:bg-gray-800 rounded-xl cursor-pointer group transition-all">
                                <input type="checkbox" checked={profileData.permissions?.includes(item.id)} onChange={() => togglePermission(item.id)} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                <div className="flex items-center gap-2">
                                    <item.icon className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                                    <span className="text-xs font-black text-gray-700 dark:text-gray-200 tracking-tight">{item.label}</span>
                                </div>
                            </label>

                            {/* NOVO: Toggle de Acesso Global posicionado abaixo do Checklist */}
                            {item.id === 'CHECKLIST_MENU' && (
                                <label className="flex items-center gap-4 p-3.5 ml-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl cursor-pointer hover:bg-indigo-100/50 transition-all border border-indigo-100 dark:border-indigo-800 group animate-fade-in">
                                    <div className="relative">
                                        <input type="checkbox" checked={profileData.hasGlobalView} onChange={e => setProfileData({...profileData, hasGlobalView: e.target.checked})} className="sr-only peer" />
                                        <div className="w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-indigo-600 transition-all after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"></div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[11px] font-black text-indigo-700 dark:text-indigo-300 leading-tight">Liberar acesso 100% do menu checklists para esse usuário?</span>
                                        <span className="text-[9px] text-gray-400 font-bold mt-0.5">Permite ver todos os projetos de terceiros.</span>
                                    </div>
                                </label>
                            )}

                            {item.children?.map(child => (
                                <label key={child.id} className="flex items-center gap-3 p-2 ml-10 bg-white/50 dark:bg-gray-800/50 rounded-lg cursor-pointer border border-transparent hover:border-indigo-100 group transition-all">
                                    <input type="checkbox" checked={profileData.permissions?.includes(child.id as string)} onChange={() => togglePermission(child.id as string)} className="w-3.5 h-3.5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-400">{child.label}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-6 border-t dark:border-gray-700">
                  <button type="button" onClick={() => setProfileFormOpen(false)} className="flex-1 py-4 bg-gray-100 dark:bg-gray-700 rounded-2xl font-black text-xs tracking-tight text-gray-500 dark:text-gray-300">Cancelar</button>
                  <button type="submit" className="flex-[2] py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs tracking-tight shadow-xl shadow-indigo-600/20 hover:bg-indigo-700 active:scale-95 transition-all">Salvar configurações</button>
                </div>
              </form>
            </Modal>
          )}

          {isDeleteProfileModalOpen && (
              <Modal title="Excluir Perfil" onClose={() => setDeleteProfileModalOpen(false)} maxWidth="max-w-sm">
                  <div className="text-center p-4 space-y-6">
                      <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-50 text-red-600"><ExclamationTriangleIcon className="w-10 h-10" /></div>
                      <div className="space-y-2">
                        <p className="font-black text-gray-800 dark:text-white leading-relaxed">Deseja remover o perfil <span className="text-red-600">"{profileToDelete?.name}"</span>?</p>
                        <p className="text-[11px] text-gray-400 font-bold leading-tight">Certifique-se de que não existam usuários vinculados a este perfil.</p>
                      </div>
                      <div className="flex gap-3 pt-4">
                          <button onClick={() => setDeleteProfileModalOpen(false)} className="flex-1 py-3.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl font-black text-xs">Não</button>
                          <button onClick={confirmDeleteProfile} className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-red-600/20 hover:bg-red-700 transition-all active:scale-95">Sim, excluir</button>
                      </div>
                  </div>
              </Modal>
          )}
        </div>
    );
};

export default UsuariosPage;
