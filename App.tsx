
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
import { LockClosedIcon, ExclamationTriangleIcon } from './assets/icons';
import type { Page, SavedOrcamento, ExpenseReport, User, UserProfile } from './types';
import { dataService } from './services/dataService';
import { authService } from './services/authService';
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
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);

  const ADMIN_PROFILE_ID = '001';
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

  const fetchPermissions = async (profileId: string) => {
    try {
      const profiles = await dataService.getAll<UserProfile>('system_profiles', undefined, true);
      let profile = profiles.find(p => String(p.id) === String(profileId));
      
      if (!profile) profile = MOCK_PROFILES.find(p => String(p.id) === String(profileId));

      if (profile) {
          setUserPermissions(profile.permissions || []);
          setHasGlobalView(!!profile.hasGlobalView);
      } else if (profileId === ADMIN_PROFILE_ID) {
          setUserPermissions(['ALL']);
          setHasGlobalView(true);
      } else {
          setUserPermissions([]);
          setHasGlobalView(false);
      }
    } catch (e) {
      console.warn("Utilizando permissões de fallback devido a erro de conexão.");
      if (profileId === ADMIN_PROFILE_ID) {
          setUserPermissions(['ALL']);
          setHasGlobalView(true);
      } else {
          setUserPermissions([]);
          setHasGlobalView(false);
      }
    }
  };

  useEffect(() => {
    const session = authService.getSession();
    if (session) {
        setCurrentUser(session);
        fetchPermissions(session.profileId);
    }
    fetchCompanyLogo();
    setIsUserInitialized(true);
  }, []);

  const handleLoginSuccess = (user: User) => {
      setCurrentUser(user);
      fetchPermissions(user.profileId);
  };

  const handleSetCurrentPage = (page: Page) => {
    if (page !== 'NOVO_ORCAMENTO') setEditingOrcamento(null);
    if (page !== 'RELATORIOS_NOVO' && page !== 'INSTALACAO_LAVAGEM_SOLIC') setEditingReport(null);
    setCurrentPage(page);
  }

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
      case 'ESTOQUE_VISAO_GERAL': return <EstoquePage view="visao_geral" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'ESTOQUE_NOVO_PRODUTO': return <EstoquePage view="cadastro" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
      case 'ESTOQUE_COMPRAS': return <EstoquePage view="compras" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} userPermissions={userPermissions} hasGlobalView={hasGlobalView} />;
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
      default: return <DashboardPage />;
    }
  };

  if (!isUserInitialized) return null;
  if (!currentUser) return <LoginPage onLoginSuccess={handleLoginSuccess} companyLogo={companyLogo} />;

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors duration-300">
      <Sidebar currentPage={currentPage} setCurrentPage={handleSetCurrentPage} isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} currentUser={currentUser} userPermissions={userPermissions} onLogout={handleLogout} companyLogo={companyLogo} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header title="Sistema Orner" onMenuClick={() => setSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 sm:p-6 md:p-8">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
