import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  AddIcon, EditIcon, UsersIcon, LockClosedIcon, SaveIcon, 
  PhotographIcon, XCircleIcon, ExclamationTriangleIcon, EyeIcon, 
  EyeOffIcon, UploadIcon, CheckCircleIcon, TrashIcon, ClockIcon,
  FingerprintIcon
} from '../assets/icons';
import type { User, UserProfile, UsuariosPageProps } from '../types';
import { MENU_ITEMS, MOCK_USERS, MOCK_PROFILES } from '../constants';
import Modal from '../components/Modal';
import { dataService } from '../services/dataService';
import { authService } from '../services/authService';

const UsuariosPage: React.FC<UsuariosPageProps> = ({ view, currentUser }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [isSupported, setIsSupported] = useState(false);
    
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
    const [profileData, setProfileData] = useState<Partial<UserProfile>>({ name: '', permissions: [] });
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
            
            // Verifica se o navegador suporta WebAuthn (FaceID/TouchID)
            if (window.PublicKeyCredential) {
                // Em dispositivos mobile, o suporte é quase sempre verdadeiro se o browser for moderno
                setIsSupported(true);
            }
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
        const currentStatus = !!userData.biometricsEnabled;
        const nextStatus = !currentStatus;
        
        if (nextStatus) {
            const confirmRegistration = confirm("Deseja habilitar o FaceID/TouchID para este dispositivo? O navegador solicitará sua autorização nas próximas sessões.");
            if (!confirmRegistration) return;
        }

        setUserData(prev => ({ ...prev, biometricsEnabled: nextStatus }));
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
            if (isCurrentlyChecked) perms = perms.filter(p => p !== id && !childIds.includes(p));
            else perms = Array.from(new Set([...perms, id, ...childIds]));
        } else {
            if (isCurrentlyChecked) perms = perms.filter(p => p !== id);
            else perms.push(id);
        }
        setProfileData({ ...profileData, permissions: perms });
    };

    if (view === 'gestao') {
        const isBioEnabled = !!userData.biometricsEnabled;
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-6 rounded-xl shadow-lg">
                    <h2 className="text-2xl font-bold flex items-center gap-3 text-gray-800 dark:text-white">
                        <UsersIcon className="w-8 h-8 text-indigo-600" /> 
                        {isAdmin ? 'Gestão de Usuários' : 'Meu perfil e acesso'}
                    </h2>
                    {isAdmin && (
                        <button onClick={() => { setUserToEdit(null); setUserData({name:'', email:'', password: '', profileId:'', active:true, avatar: '', darkMode: false, biometricsEnabled: false}); setShowPassword(false); setUserModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md"><AddIcon className="w-5 h-5" /> Novo usuário</button>
                    )}
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 text-xs text-gray-500 font-bold">
                            <tr><th className="px-6 py-4">Usuário</th><th className="px-6 py-4">E-mail</th><th className="px-6 py-4">Perfil</th><th className="px-6 py-4">Status de Acesso</th><th className="px-6 py-4 text-center">Ações</th></tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {visibleUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                                    <td className="px-6 py-4 flex items-center gap-3 font-bold text-gray-900 dark:text-white">
                                        <div className="w-10 h-10 rounded-full border dark:border-gray-600 overflow-hidden bg-gray-100 flex-shrink-0">
                                            <img src={user.avatar} className="w-full h-full object-cover" alt="" />
                                        </div>
                                        <div>
                                            <p>{user.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[8px] text-gray-400 font-black uppercase tracking-tighter">{user.darkMode ? '🌙 Dark' : '☀️ Light'}</span>
                                                {user.biometricsEnabled && <FingerprintIcon className="w-3 h-3 text-indigo-500" />}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 dark:text-gray-400 font-medium">{user.email}</td>
                                    <td className="px-6 py-4"><span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded text-[10px] font-bold">{profiles.find(p => String(p.id) === String(user.profileId))?.name || 'N/A'}</span></td>
                                    <td className="px-6 py-4">{isAdmin ? (<select value={user.active ? 'liberado' : 'bloqueado'} onChange={(e) => handleStatusToggle(user, e.target.value === 'liberado')} className={`text-[10px] font-bold rounded-lg border-transparent px-3 py-1.5 focus:ring-0 outline-none transition-all cursor-pointer shadow-sm ${user.active ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}><option value="liberado" className="bg-white text-gray-800">Liberado</option><option value="bloqueado" className="bg-white text-gray-800">Bloqueado</option></select>) : (<span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold ${user.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{user.active ? 'Ativo' : 'Suspenso'}</span>)}</td>
                                    <td className="px-6 py-4 text-center"><button onClick={() => { setUserToEdit(user); setUserData(user); setShowPassword(false); setUserModalOpen(true); }} className="p-2 text-gray-400 hover:text-indigo-600 transition-colors" title="Editar usuário"><EditIcon className="w-5 h-5" /></button></td>
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
                                        {userData.avatar ? <img src={userData.avatar} className="w-full h-full object-cover" alt="Avatar" /> : <div className="w-full h-full flex items-center justify-center text-gray-300"><PhotographIcon className="w-12 h-12" /></div>}
                                    </div>
                                    <button type="button" onClick={() => fileInputRef.current?.click()} className="absolute bottom-0 right-0 p-2 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all border-2 border-white dark:border-gray-800"><UploadIcon className="w-4 h-4" /></button>
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
                                    <input required={!userToEdit} type={showPassword ? "text" : "password"} value={userData.password} onChange={e => setUserData({...userData, password:e.target.value})} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 pr-10" placeholder={userToEdit ? "Deixe em branco para manter" : "Mínimo 6 caracteres"} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-indigo-600 transition-colors">{showPassword ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}</button>
                                </div>
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-1">Perfil de acesso</label>
                                    <select required disabled={!isAdmin} value={userData.profileId} onChange={e => setUserData({...userData, profileId:e.target.value})} className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 p-2.5 text-sm font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"><option value="">Selecione um perfil...</option>{profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm text-amber-500">
                                                <PhotographIcon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[11px] font-black text-gray-700 dark:text-white tracking-tighter">Modo noturno</span>
                                        </div>
                                        <button type="button" onClick={toggleDarkMode} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${userData.darkMode ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}><span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${userData.darkMode ? 'translate-x-6' : 'translate-x-1'}`} /></button>
                                    </div>

                                    {isSupported && (
                                        <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between animate-fade-in">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 bg-white dark:bg-gray-800 rounded-lg shadow-sm ${isBioEnabled ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                    <FingerprintIcon className="w-4 h-4" />
                                                </div>
                                                <span className="text-[11px] font-black text-gray-700 dark:text-white tracking-tighter">Acesso FaceID</span>
                                            </div>
                                            <button 
                                                type="button" 
                                                onClick={toggleBiometrics} 
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isBioEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out ${isBioEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                                <button type="button" onClick={() => setUserModalOpen(false)} className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-xs text-gray-500 dark:text-gray-300 hover:bg-gray-200">Cancelar</button>
                                <button type="submit" className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-xs shadow-lg hover:bg-indigo-700 transition-all">Salvar alterações</button>
                            </div>
                        </form>
                    </Modal>
                )}
            </div>
        );
    }
    
    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-4 text-gray-800 dark:text-white">Gestão de Perfis e Permissões</h2>
          <div className="space-y-4">
             {profiles.map(p => (
               <div key={p.id} className="p-4 border dark:border-gray-700 rounded-lg flex justify-between items-center">
                 <div>
                   <h3 className="font-bold text-gray-800 dark:text-white">{p.name}</h3>
                   <p className="text-xs text-gray-500">{p.permissions.length} permissões habilitadas</p>
                 </div>
                 <div className="flex gap-2">
                    <button onClick={() => { setProfileToEdit(p); setProfileData(p); setProfileFormOpen(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><EditIcon className="w-5 h-5"/></button>
                    <button onClick={() => handleRequestDeleteProfile(p)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><TrashIcon className="w-5 h-5"/></button>
                 </div>
               </div>
             ))}
             <button onClick={() => { setProfileToEdit(null); setProfileData({name: '', permissions: []}); setProfileFormOpen(true); }} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-indigo-600 transition-all rounded-xl font-bold text-sm">Criar novo perfil</button>
          </div>

          {isProfileFormOpen && (
            <Modal title={profileToEdit ? 'Editar Perfil' : 'Novo Perfil'} onClose={() => setProfileFormOpen(false)}>
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Nome do perfil</label>
                  <input required value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className="w-full border p-2 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Ex: Vendedor Externo" />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500">Permissões de acesso</label>
                  <div className="max-h-[300px] overflow-y-auto border p-2 rounded-lg space-y-2 dark:border-gray-600">
                    <label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                        <input type="checkbox" checked={profileData.permissions?.includes('ALL')} onChange={() => togglePermission('ALL')} className="w-4 h-4 text-indigo-600" />
                        <span className="text-sm font-bold text-indigo-600">Acesso Total (Administrador)</span>
                    </label>
                    {MENU_ITEMS.map(item => (
                        <div key={item.id} className="space-y-1">
                            <label className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                                <input type="checkbox" checked={profileData.permissions?.includes(item.id)} onChange={() => togglePermission(item.id)} className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.label}</span>
                            </label>
                            {item.children?.map(child => (
                                <label key={child.id} className="flex items-center gap-2 p-2 ml-6 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer border-l dark:border-gray-600">
                                    <input type="checkbox" checked={profileData.permissions?.includes(child.id as string)} onChange={() => togglePermission(child.id as string)} className="w-4 h-4 text-indigo-600" />
                                    <span className="text-xs text-gray-600 dark:text-gray-400">{child.label}</span>
                                </label>
                            ))}
                        </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setProfileFormOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-bold text-gray-600 dark:text-gray-300">Cancelar</button>
                  <button type="submit" className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold">Salvar</button>
                </div>
              </form>
            </Modal>
          )}

          {isDeleteProfileModalOpen && (
              <Modal title="Excluir Perfil" onClose={() => setDeleteProfileModalOpen(false)}>
                  <div className="text-center p-4 space-y-4">
                      <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto" />
                      <p className="font-bold text-gray-800 dark:text-white">Deseja excluir o perfil "{profileToDelete?.name}"?</p>
                      <div className="flex gap-2">
                          <button onClick={() => setDeleteProfileModalOpen(false)} className="flex-1 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg">Não</button>
                          <button onClick={confirmDeleteProfile} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Sim, excluir</button>
                      </div>
                  </div>
              </Modal>
          )}
        </div>
    );
};

export default UsuariosPage;
