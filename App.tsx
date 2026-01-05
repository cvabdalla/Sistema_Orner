
import React, { useState, useEffect } from 'react';
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
import UsuariosPage from './pages/UsuariosPage';
import LoginPage from './pages/LoginPage';
import { LockClosedIcon, ExclamationTriangleIcon } from './assets/icons';
import type { Page, SavedOrcamento, ExpenseReport, User, UserProfile } from './types';
import { dataService } from './services/dataService';
import { authService } from './services/authService';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('DASHBOARD');
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [editingOrcamento, setEditingOrcamento] = useState<SavedOrcamento | null>(null);
  const [editingReport, setEditingReport] = useState<ExpenseReport | null>(null);
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userPermissions, setUserPermissions] = useState<string[]>([]);
  const [isUserInitialized, setIsUserInitialized] = useState(false);

  const ADMIN_PROFILE_ID = '00000000-0000-0000-0000-000000000001';

  const fetchPermissions = async (profileId: string) => {
    try {
      const profiles = await dataService.getAll<UserProfile>('system_profiles', undefined, true);
      const profile = profiles.find(p => String(p.id) === String(profileId));
      if (profile) {
        setUserPermissions(profile.permissions || []);
      } else if (profileId === ADMIN_PROFILE_ID) {
          setUserPermissions(['ALL']); 
      }
    } catch (e) {
      console.error("Erro ao carregar permissões:", e);
    }
  };

  useEffect(() => {
    const session = authService.getSession();
    if (session) {
        setCurrentUser(session);
        fetchPermissions(session.profileId);
    }
    setIsUserInitialized(true);
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const syncUser = async () => {
      try {
        const users = await dataService.getAll<User>('system_users', undefined, true);
        if (users && users.length > 0) {
          const found = users.find(u => String(u.id) === String(currentUser.id));
          if (found) {
            if (!found.active) {
                handleLogout();
                return;
            }
            if (found.profileId !== currentUser.profileId) {
                fetchPermissions(found.profileId);
            }
            setCurrentUser(found);
            authService.saveSession(found);
          }
        }
      } catch (e) {
        console.error("Falha ao sincronizar usuário:", e);
      }
    };
    syncUser();
  }, [currentPage]);

  const handleLoginSuccess = (user: User) => {
      setCurrentUser(user);
      fetchPermissions(user.profileId);
  };

  const handleLogout = () => {
      authService.logout();
      setCurrentUser(null);
      setUserPermissions([]);
      setCurrentPage('DASHBOARD');
  };

  const handleSetCurrentPage = (page: Page) => {
    if (page !== 'NOVO_ORCAMENTO') setEditingOrcamento(null);
    if (page !== 'RELATORIOS_NOVO') setEditingReport(null);
    setCurrentPage(page);
  };

  const handleEditOrcamento = (orcamento: SavedOrcamento) => {
    setEditingOrcamento(orcamento);
    setCurrentPage('NOVO_ORCAMENTO');
  };

  const handleEditReport = (report: ExpenseReport) => {
      setEditingReport(report);
      setCurrentPage('RELATORIOS_NOVO');
  };

  const handleSaveReport = () => {
      setEditingReport(null);
      setCurrentPage('RELATORIOS_HISTORICO');
  };

  const handleCancelReport = () => {
      setEditingReport(null);
      setCurrentPage('RELATORIOS_HISTORICO');
  };

  const hasPermission = (page: Page) => {
      if (userPermissions.includes('ALL')) return true;
      return userPermissions.includes(page);
  };

  const renderPage = () => {
    if (!currentUser) return null;

    if (!currentUser.active) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-6 animate-fade-in text-center px-4">
                <div className="p-6 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 shadow-xl">
                    <LockClosedIcon className="w-20 h-20" />
                </div>
                <div className="space-y-2 max-w-md">
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">Acesso bloqueado</h2>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">Lamentamos, mas seu acesso ao sistema Orner foi suspenso por um administrador.</p>
                </div>
                <button onClick={handleLogout} className="text-xs text-indigo-600 font-bold hover:underline">Voltar para o login</button>
            </div>
        );
    }

    if (currentPage === 'DASHBOARD') {
        if (hasPermission('DASHBOARD')) {
            return <DashboardPage />;
        } else {
            return <WelcomePage currentUser={currentUser} userPermissions={userPermissions} onNavigate={handleSetCurrentPage} />;
        }
    }

    if (!hasPermission(currentPage)) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-fade-in text-center px-4">
                <ExclamationTriangleIcon className="w-16 h-16 text-amber-500" />
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Acesso Restrito</h2>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">Seu perfil de acesso não possui permissão para visualizar esta página. Entre em contato com o administrador.</p>
                <button 
                    onClick={() => setCurrentPage('DASHBOARD')}
                    className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm shadow-lg"
                >
                    Voltar ao Início
                </button>
            </div>
        );
    }

    switch (currentPage) {
      case 'ORCAMENTO':
        return <OrcamentoPage setCurrentPage={handleSetCurrentPage} onEdit={handleEditOrcamento} currentUser={currentUser} />;
      case 'NOVO_ORCAMENTO':
        return <NovoOrcamentoPage setCurrentPage={handleSetCurrentPage} orcamentoToEdit={editingOrcamento} clearEditingOrcamento={() => setEditingOrcamento(null)} currentUser={currentUser} />;
      case 'RESUMO_VENDAS':
        return <ResumoVendasPage currentUser={currentUser} />;
      case 'FINANCEIRO_VISAO_GERAL':
        return <FinanceiroPage view="dashboard" currentUser={currentUser} />;
      case 'FINANCEIRO_DRE':
        return <FinanceiroPage view="dre" currentUser={currentUser} />;
      case 'FINANCEIRO_CATEGORIAS':
        return <FinanceiroPage view="categorias" currentUser={currentUser} />;
      case 'ESTOQUE_VISAO_GERAL':
        return <EstoquePage view="visao_geral" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} />;
      case 'ESTOQUE_NOVO_PRODUTO':
        return <EstoquePage view="cadastro" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} />;
      case 'ESTOQUE_COMPRAS':
        return <EstoquePage view="compras" setCurrentPage={handleSetCurrentPage} currentUser={currentUser} />;
      case 'CHECKLIST_CHECKIN':
        return <CheckListPage view="checkin" currentUser={currentUser} />;
      case 'CHECKLIST_CHECKOUT':
        return <CheckListPage view="checkout" currentUser={currentUser} />;
      case 'CHECKLIST_MANUTENCAO':
        return <CheckListPage view="manutencao" currentUser={currentUser} />;
      case 'RELATORIOS_VISAO_GERAL':
        return <RelatoriosPage view="analise" currentUser={currentUser} />;
      case 'RELATORIOS_NOVO':
        return <RelatoriosPage view="reembolso" reportToEdit={editingReport} onSave={handleSaveReport} onCancel={handleCancelReport} currentUser={currentUser} />;
      case 'RELATORIOS_STATUS':
        return <RelatoriosPage view="status" onEditReport={handleEditReport} currentUser={currentUser} />;
      case 'RELATORIOS_HISTORICO':
        return <RelatoriosPage view="historico" onEditReport={handleEditReport} currentUser={currentUser} />;
      case 'RELATORIOS_CONFIG':
        return <RelatoriosPage view="config" currentUser={currentUser} />;
      case 'USUARIOS_GESTAO':
        return <UsuariosPage view="gestao" setCurrentPage={handleSetCurrentPage} />;
      case 'USUARIOS_PERFIL':
        return <UsuariosPage view="perfil" setCurrentPage={handleSetCurrentPage} />;
      default:
        return <WelcomePage currentUser={currentUser} userPermissions={userPermissions} onNavigate={handleSetCurrentPage} />;
    }
  };

  const getPageTitle = () => {
    if (!currentUser) return "";
    if (!currentUser.active) return "Restrição de Acesso";
    if (currentPage === 'NOVO_ORCAMENTO') return editingOrcamento ? 'Editar orçamento' : 'Novo orçamento';
    
    if (currentPage === 'DASHBOARD' && !hasPermission('DASHBOARD')) return "Início";

    const titles: Record<string, string> = {
      DASHBOARD: 'Dashboard',
      ORCAMENTO: 'Listar orçamentos',
      RESUMO_VENDAS: 'Resumo de vendas',
      FINANCEIRO_VISAO_GERAL: 'Visão Geral',
      FINANCEIRO_DRE: 'Demonstrativo de Resultado (DRE)',
      FINANCEIRO_CATEGORIAS: 'Categorias Financeiras',
      ESTOQUE_VISAO_GERAL: 'Estoque Geral',
      ESTOQUE_NOVO_PRODUTO: 'Cadastrar Produtos',
      ESTOQUE_COMPRAS: 'Pedidos de Compra',
      CHECKLIST_CHECKIN: 'Check-in de obra',
      CHECKLIST_CHECKOUT: 'Check-out de obra',
      CHECKLIST_MANUTENCAO: 'Manutenção',
      RELATORIOS_VISAO_GERAL: 'Resumo Reembolsos',
      RELATORIOS_NOVO: editingReport ? 'Editar relatório' : 'Novo Reembolso',
      RELATORIOS_STATUS: 'Status de Reembolso',
      RELATORIOS_HISTORICO: 'Histórico de Reembolso',
      RELATORIOS_CONFIG: 'Configurações Gerais',
      USUARIOS_GESTAO: 'Gestão de Usuários',
      USUARIOS_PERFIL: 'Perfis de Acesso'
    };
    return titles[currentPage] || 'Orner';
  };

  if (!isUserInitialized) return null;

  if (!currentUser) {
      return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200 print:block print:h-auto print:overflow-visible">
      <Sidebar 
        currentPage={currentPage} 
        setCurrentPage={handleSetCurrentPage} 
        isSidebarOpen={isSidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
        currentUser={currentUser} 
        userPermissions={userPermissions}
        onLogout={handleLogout}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 print:overflow-visible print:block print:h-auto">
        <Header title={getPageTitle()} onMenuClick={() => setSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-gray-900 p-4 sm:p-6 md:p-8 print:p-0 print:overflow-visible print:h-auto print:bg-white">
          {renderPage()}
        </main>
      </div>
    </div>
  );
};

export default App;
