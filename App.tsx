
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardPage from './pages/DashboardPage';
import WelcomePage from './pages/WelcomePage';
import OrcamentoPage from './pages/OrcamentoPage';
import FinanceiroPage from './pages/FinanceiroPage';
import RelatoriosPage from './pages/RelatoriosPage';
import NovoOrcamentoPage from './pages/NovoOrcamentoPage';
import ResumoVendasPage from './pages/ResumoVendasPage';
import EstoquePage from './pages/EstoquePage';
import CheckListPage from './pages/CheckListPage';
import HomologacaoPage from './pages/HomologacaoPage';
import UsuariosPage from './pages/UsuariosPage';
import LoginPage from './pages/LoginPage';
import InstalacoesPage from './pages/InstalacoesPage';
import InstalacoesCadastroPage from './pages/InstalacoesCadastroPage';
import LavagemPage from './pages/LavagemPage';
import InstalacaoLavagemPage from './pages/InstalacaoLavagemPage';
import LoginAcessoPage from './pages/LoginAcessoPage';
import CadastroInstaladorPage from './pages/CadastroInstaladorPage';
import { LockClosedIcon, ExclamationTriangleIcon } from './assets/icons';
import type { Page, SavedOrcamento, ExpenseReport, User, UserProfile } from './types';
import { dataService } from './services/dataService';
import { authService } from './services/authService';
import { accessLogService } from './services/accessLogService';
import { testSupabaseConnection } from './supabaseClient';
import { MOCK_PROFILES } from './constants';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('DASHBOARD');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState<SavedOrcamento | null>(null);
  const [editingReport, setEditingReport] = useState<ExpenseReport | null>(null);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [hasGlobalView, setHasGlobalView] = useState(false);
  const [isUserInitialized, setIsUserInitialized] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const ADMIN_PROFILE_IDS = ['001', '00000000-0000-0000-0000-000000000001'];
  const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutos em milissegundos
  // Fix: use ReturnType<typeof setTimeout> instead of NodeJS.Timeout to avoid namespace error in browser environments
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCompanyLogo = async () => {
    try {
      const configs = await dataService.getAll<any>('system_configs', undefined, true);
      const logoConfig = configs.find(c => c.id === 'company_logo');
      if (logoConfig && logoConfig.value) {
        setCompanyLogo(logoConfig.value);
      }
    } catch (e) {
      console.warn("Erro ao carregar logo da empresa:", e);
    }
  };

  const handleLogout = useCallback(() => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      authService.logout();
      setCurrentUser(null);
      setUserPermissions([]);
      setHasGlobalView(false);
      setCurrentPage('DASHBOARD');
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    // Só ativa o timer se houver um usuário logado
    if (currentUser) {
        idleTimerRef.current = setTimeout(() => {
            console.log("Sessão expirada por inatividade.");
            handleLogout();
            alert("Sua sessão expirou por inatividade. Por favor, entre novamente.");
        }, IDLE_TIMEOUT);
    }
  }, [currentUser, handleLogout]);

  // Efeito para monitorar atividade do usuário
  useEffect(() => {
    if (!currentUser) return;

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetIdleTimer();

    events.forEach(event => {
        window.addEventListener(event, handleActivity);
    });

    // Inicia o timer pela primeira vez ao logar
    resetIdleTimer();

    return () => {
        events.forEach(event => {
            window.removeEventListener(event, handleActivity);
        });
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [currentUser, resetIdleTimer]);

  useEffect(() => {
    if (currentUser?.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [currentUser?.darkMode]);

  // Registra as janelas/páginas que o usuário acessa no sistema
  useEffect(() => {
    if (currentUser) {
      accessLogService.logPageVisit(currentUser, currentPage).catch(err => {
        console.warn("Erro ao salvar log de acesso:", err);
      });
    }
  }, [currentPage, currentUser]);

  const fetchPermissions = async (user: User) => {
    const profileId = user.profileId;
    const isSuperAdminEmail = user.email.toLowerCase() === 'cvabdalla@gmail.com';

    try {
      const profiles = await dataService.getAll<UserProfile>('system_profiles', undefined, true);
      let profile = profiles.find(p => String(p.id) === String(profileId));
      
      if (!profile) profile = MOCK_PROFILES.find(p => String(p.id) === String(profileId));

      if (isSuperAdminEmail) {
          setUserPermissions(['ALL']);
          setHasGlobalView(true);
      } else if (profile) {
          setUserPermissions(profile.permissions || []);
          setHasGlobalView(!!profile.hasGlobalView);
      } else if (ADMIN_PROFILE_IDS.includes(String(profileId))) {
          setUserPermissions(['ALL']);
          setHasGlobalView(true);
      } else {
          setUserPermissions([]);
          setHasGlobalView(false);
      }
    } catch (e) {
      console.warn("Utilizando permissões de fallback devido a erro de conexão.");
      if (ADMIN_PROFILE_IDS.includes(String(profileId)) || isSuperAdminEmail) {
          setUserPermissions(['ALL']);
          setHasGlobalView(true);
      } else {
          setUserPermissions([]);
          setHasGlobalView(false);
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      console.log("[INIT] Iniciando sistema...");
      const startTime = Date.now();
      
      try {
        console.log("[INIT] Testando conexão com Supabase...");
        const conn = await testSupabaseConnection();
        if (!conn.ok) {
            console.warn("Falha na conexão inicial com o Supabase. O sistema iniciará no modo offline local.");
        }

        const session = authService.getSession();
        if (session) {
            console.log("[INIT] Sessão encontrada para:", session.email, "Perfil:", session.profileId);
            setCurrentUser(session);
            await fetchPermissions(session);
        } else {
            console.log("[INIT] Nenhuma sessão ativa.");
        }
        
        console.log("[INIT] Carregando logo da empresa...");
        await fetchCompanyLogo();
        
      } catch (error) {
        console.error("[INIT ERROR] Erro fatal durante a inicialização:", error);
      } finally {
        const duration = Date.now() - startTime;
        console.log(`[INIT] Inicialização concluída em ${duration}ms`);
        setIsUserInitialized(true);
      }
    };
    init();
    
    // Timeout de segurança: 10 segundos para inicializar ou libera a tela
    const timer = setTimeout(() => {
      setIsUserInitialized((current) => {
        if (!current) {
          console.warn("[INIT TIMEOUT] O carregamento está demorando muito. Liberando UI...");
          return true;
        }
        return current;
      });
    }, 10000);
    
    return () => clearTimeout(timer);
  }, [handleLogout]);

  const handleLoginSuccess = (user: User) => {
      setCurrentUser(user);
      fetchPermissions(user);
      accessLogService.logLogin(user).catch(err => {
          console.warn("Erro ao registrar log de login:", err);
      });
  };

  const handleSetCurrentPage = (page: Page) => {
    if (page !== 'NOVO_ORCAMENTO') setEditingOrcamento(null);
    if (page !== 'RELATORIOS_NOVO' && page !== 'INSTALACAO_LAVAGEM_SOLIC') setEditingReport(null);
    setCurrentPage(page);
  };

  const handleEditOrcamento = (orcamento: SavedOrcamento) => {
    setEditingOrcamento(orcamento);
    setCurrentPage('NOVO_ORCAMENTO');
  };

  const handleEditReport = (report: ExpenseReport) => {
      setEditingReport(report);
      if (report.isInstallmentWash || (report.id && report.id.startsWith('tech-'))) {
          setCurrentPage('INSTALACAO_LAVAGEM_SOLIC');
      } else {
          setCurrentPage('RELATORIOS_NOVO');
      }
  }

  const handleSaveReport = () => {
      setEditingReport(null);
      setCurrentPage('RELATORIOS_HISTORICO');
  }

  const hasPermission = (page: Page) => {
      if (userPermissions.includes('ALL')) return true; 
      return userPermissions.includes(page);
  };

  const renderPage = () => {
    if (!currentUser) return null;

    if (!currentUser.active) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-6 text-center px-4">
                <div className="p-6 bg-red-100 rounded-full text-red-600 shadow-xl">
                    <LockClosedIcon className="w-20 h-20" />
                </div>
                <h2 className="text-3xl font-black text-gray-900 dark:text-white">Acesso bloqueado</h2>
                <button onClick={handleLogout} className="text-xs text-indigo-600 font-bold hover:underline">Sair</button>
            </div>
        );
    }

    if (currentPage === 'DASHBOARD' && !hasPermission('DASHBOARD')) {
        return <WelcomePage currentUser={currentUser} userPermissions={userPermissions} onNavigate={handleSetCurrentPage} />;
    }

    if (!hasPermission(currentPage)) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                <ExclamationTriangleIcon className="w-16 h-16 text-amber-500" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Acesso restrito</h2>
                <button onClick={() => setCurrentPage('DASHBOARD')} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold">Voltar</button>
            </div>
        );
    }

    switch (currentPage) {
      case 'DASHBOARD': return <DashboardPage />;
      case 'ORCAMENTO': return <OrcamentoPage setCurrentPage={handleSetCurrentPage} onEdit={handleEditOrcamento} currentUser={currentUser} hasGlobalView={hasGlobalView} />;
      case 'NOVO_ORCAMENTO': return <NovoOrcamentoPage setCurrentPage={handleSetCurrentPage} orcamentoToEdit={editingOrcamento} clearEditingOrcamento={() => setEditingOrcamento(null)} currentUser={currentUser} />;
      case 'RESUMO_VENDAS': return <ResumoVendasPage currentUser={currentUser} />;
      case 'FINANCEIRO_VISAO_GERAL': return <FinanceiroPage view="dashboard" currentUser={currentUser} hasGlobalView={hasGlobalView} />;
      case 'FINANCEIRO_DRE': return <FinanceiroPage view="dre" currentUser={currentUser} hasGlobalView={hasGlobalView} />;
      case 'FINANCEIRO_CATEGORIAS': return <FinanceiroPage view="categorias" currentUser={currentUser} />;
      case 'FINANCEIRO_BANCOS': return <FinanceiroPage view="bancos" currentUser={currentUser} hasGlobalView={hasGlobalView} />;
      case 'ESTOQUE_VISAO_GERAL': return <EstoquePage view="visao_geral" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} companyLogo={companyLogo} />;
      case 'ESTOQUE_NOVO_PRODUTO': return <EstoquePage view="cadastro" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} companyLogo={companyLogo} />;
      case 'ESTOQUE_COMPRAS': return <EstoquePage view="compras" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} companyLogo={companyLogo} />;
      case 'CHECKLIST_CHECKIN': return <CheckListPage view="checkin" currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'CHECKLIST_CHECKOUT': return <CheckListPage view="checkout" currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'CHECKLIST_MANUTENCAO': return <CheckListPage view="manutencao" currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'CHECKLIST_HOMOLOGACAO': return <HomologacaoPage currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'RELATORIOS_VISAO_GERAL': return <RelatoriosPage view="analise" currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'RELATORIOS_NOVO': return <RelatoriosPage view="reembolso" reportToEdit={editingReport} onSave={handleSaveReport} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'RELATORIOS_STATUS': return <RelatoriosPage view="status" onEditReport={handleEditReport} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'RELATORIOS_HISTORICO': return <RelatoriosPage view="historico" onEditReport={handleEditReport} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'RELATORIOS_CONFIG': return <RelatoriosPage view="config" currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} onLogoUpdated={fetchCompanyLogo} />;
      case 'INSTALACAO_LAVAGEM_SOLIC': return <InstalacaoLavagemPage currentUser={currentUser} reportToEdit={editingReport} onSave={handleSaveReport} hasGlobalView={hasGlobalView} />;
      case 'INSTALACOES_CALENDARIO': return <InstalacoesPage currentUser={currentUser} hasGlobalView={hasGlobalView} />;
      case 'INSTALACOES_CADASTRO': return <InstalacoesCadastroPage currentUser={currentUser} />;
      case 'INSTALACOES_LAVAGEM': return <LavagemPage currentUser={currentUser} />;
      case 'USUARIOS_GESTAO': return <UsuariosPage view="gestao" currentUser={currentUser} />;
      case 'USUARIOS_PERFIL': return <UsuariosPage view="perfil" currentUser={currentUser} />;
      case 'LOGIN_ACESSO': return <LoginAcessoPage currentUser={currentUser} />;
      case 'CADASTRO_INSTALADOR': return <CadastroInstaladorPage currentUser={currentUser} />;
      default: return <DashboardPage />;
    }
  };

  if (!isUserInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-gray-500 font-medium animate-pulse">Iniciando sistema...</p>
      </div>
    );
  }

  if (dbError && !currentUser) {
    return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-red-100 text-center">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Erro de Conexão</h2>
                <p className="text-gray-600 mb-6 text-sm">
                    Não foi possível conectar ao banco de dados. {dbError}
                </p>
                <button 
                    onClick={() => window.location.reload()}
                    className="w-full bg-gray-800 text-white rounded-xl py-3 font-bold hover:bg-gray-700 transition-colors"
                >
                    Tentar Novamente
                </button>
                <p className="mt-4 text-[10px] text-gray-400">
                    Se o problema persistir, revise o arquivo <b>supabaseClient.ts</b>
                </p>
            </div>
        </div>
    );
  }

  if (!currentUser) return <LoginPage onLoginSuccess={handleLoginSuccess} companyLogo={companyLogo} />;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300">
      <Sidebar currentPage={currentPage} setCurrentPage={handleSetCurrentPage} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} currentUser={currentUser} userPermissions={userPermissions} onLogout={handleLogout} companyLogo={companyLogo} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 font-sans">
        <Header title="Sistema Orner" onMenuClick={() => setSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8 print:p-0 print:overflow-visible">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
