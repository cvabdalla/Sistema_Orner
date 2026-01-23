
import type { FinancialCategory, User, UserProfile, MenuItem } from './types';
import { DashboardIcon, OrcamentoIcon, FinanceiroIcon, RelatoriosIcon, AddIcon, CubeIcon, UsersIcon, ShoppingCartIcon, ClipboardListIcon, DocumentReportIcon, ChartPieIcon, CogIcon, CheckCircleIcon, LockClosedIcon, ClipboardCheckIcon, TableIcon, CalendarIcon, TruckIcon, SparklesIcon } from './assets/icons';

export const CLASSIFICATION_LABELS: Record<string, string> = {
    RECEITA_VENDA: 'Receita bruta (vendas)',
    OUTRA_RECEITA: 'Outras receitas',
    DEDUCAO_RECEITA: 'Deduções de receita',
    CUSTO_VENDA: 'Custo mercadoria/serviço',
    DESPESA_VARIAVEL: 'Despesa variável (taxas/fretes)',
    DESPESA_OPERACIONAL: 'Despesa operacional (fixa)',
    OUTRA_DESPESA: 'Outras despesas'
};

export const BRAZIL_BANKS = [
    { code: '001', name: 'Banco do Brasil S.A.' },
    { code: '033', name: 'Banco Santander (Brasil) S.A.' },
    { code: '077', name: 'Banco Inter S.A.' },
    { code: '104', name: 'Caixa Econômica Federal' },
    { code: '197', name: 'Stone Pagamentos S.A.' },
    { code: '237', name: 'Banco Bradesco S.A.' },
    { code: '260', name: 'Nu Pagamentos S.A. (Nubank)' },
    { code: '290', name: 'PagSeguro Internet S.A.' },
    { code: '341', name: 'Itaú Unibanco S.A.' },
    { code: '422', name: 'Banco Safra S.A.' },
    { code: '633', name: 'Banco Rendimento S.A.' },
    { code: '748', name: 'Banco Cooperativo Sicredi S.A.' },
    { code: '756', name: 'Banco Cooperativo do Brasil S.A. (Sicoob)' },
];

export const MENU_ITEMS: MenuItem[] = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: DashboardIcon },
  { 
    id: 'ORCAMENTO_MENU', 
    label: 'Orçamentos', 
    icon: OrcamentoIcon,
    children: [
        { id: 'NOVO_ORCAMENTO', label: 'Novo Orçamento', icon: AddIcon },
        { id: 'ORCAMENTO', label: 'Lista de Orçamento', icon: OrcamentoIcon },
        { id: 'RESUMO_VENDAS', label: 'Resumo de Vendas', icon: TableIcon }, 
    ]
  },
  {
      id: 'ESTOQUE_MENU',
      label: 'Estoque',
      icon: CubeIcon,
      children: [
          { id: 'ESTOQUE_VISAO_GERAL', label: 'Estoque Geral', icon: CubeIcon },
          { id: 'ESTOQUE_COMPRAS', label: 'Pedido de Compra', icon: ShoppingCartIcon },
          { id: 'ESTOQUE_NOVO_PRODUTO', label: 'Cadastrar Produto', icon: AddIcon },
      ]
  },
  {
      id: 'CHECKLIST_MENU',
      label: 'Checklists',
      icon: ClipboardCheckIcon,
      children: [
          { id: 'CHECKLIST_CHECKIN', label: 'Check-in de Obra', icon: ClipboardCheckIcon },
          { id: 'CHECKLIST_CHECKOUT', label: 'Check-out de Obra', icon: CheckCircleIcon },
          { id: 'CHECKLIST_MANUTENCAO', label: 'Manutenção', icon: ClipboardListIcon },
          { id: 'CHECKLIST_HOMOLOGACAO', label: 'Homologação', icon: DocumentReportIcon },
      ]
  },
  { 
      id: 'FINANCEIRO_MENU', 
      label: 'Financeiro', 
      icon: FinanceiroIcon,
      children: [
          { id: 'FINANCEIRO_VISAO_GERAL', label: 'Visão Geral', icon: FinanceiroIcon },
          { id: 'FINANCEIRO_DRE', label: 'DRE Gerencial', icon: DocumentReportIcon },
          { id: 'FINANCEIRO_CATEGORIAS', label: 'Categorias Financeiras', icon: ClipboardListIcon },
          { id: 'FINANCEIRO_BANCOS', label: 'Bancos', icon: TableIcon },
      ]
  },
  { 
      id: 'RELATORIOS_MENU', 
      label: 'Reembolsos', 
      icon: RelatoriosIcon,
      children: [
          { id: 'RELATORIOS_NOVO', label: 'Novo Reembolso', icon: AddIcon },
          { id: 'INSTALACAO_LAVAGEM_SOLIC', label: 'Instalações / Lavagens', icon: SparklesIcon },
          { id: 'RELATORIOS_HISTORICO', label: 'Histórico de Reembolsos', icon: ClipboardListIcon },
          { id: 'RELATORIOS_STATUS', label: 'Status de Reembolsos', icon: CheckCircleIcon },
          { id: 'RELATORIOS_VISAO_GERAL', label: 'Resumo de Reembolsos', icon: ChartPieIcon },
      ]
  },
  {
    id: 'INSTALACOES_MENU',
    label: 'Gestão de Serviços',
    icon: TruckIcon,
    children: [
        { id: 'INSTALACOES_CALENDARIO', label: 'Agenda de Serviços', icon: CalendarIcon },
        { id: 'INSTALACOES_LAVAGEM', label: 'Lavagem de Placas', icon: SparklesIcon },
    ]
  },
  {
    id: 'USUARIOS_MENU',
    label: 'Configurações',
    icon: CogIcon,
    children: [
        { id: 'RELATORIOS_CONFIG', label: 'Configurações Gerais', icon: CogIcon },
        { id: 'USUARIOS_GESTAO', label: 'Gestão de Usuários', icon: UsersIcon },
        { id: 'USUARIOS_PERFIL', label: 'Perfis de Acesso', icon: LockClosedIcon },
    ]
  }
];

export const MOCK_USERS: User[] = [
    { id: '001', name: 'Administrador', email: 'admin@orner.com.br', password: '1234', profileId: '001', active: true, avatar: 'https://ui-avatars.com/api/?name=Admin' },
    { id: '002', name: 'João Vendedor', email: 'vendedor@orner.com.br', password: '1234', profileId: 'vendedor-001', active: true, avatar: 'https://ui-avatars.com/api/?name=Joao+Vendedor&background=6366f1&color=fff' }
];

export const MOCK_PROFILES: UserProfile[] = [
    { 
        id: '001', 
        name: 'Administrador', 
        permissions: [
            'ALL', 'DASHBOARD', 
            'ORCAMENTO_MENU', 'NOVO_ORCAMENTO', 'ORCAMENTO', 'RESUMO_VENDAS',
            'FINANCEIRO_MENU', 'FINANCEIRO_VISAO_GERAL', 'FINANCEIRO_DRE', 'FINANCEIRO_CATEGORIAS', 'FINANCEIRO_BANCOS',
            'ESTOQUE_MENU', 'ESTOQUE_VISAO_GERAL', 'ESTOQUE_COMPRAS', 'ESTOQUE_NOVO_PRODUTO',
            'CHECKLIST_MENU', 'CHECKLIST_CHECKIN', 'CHECKLIST_CHECKOUT', 'CHECKLIST_MANUTENCAO', 'CHECKLIST_HOMOLOGACAO',
            'RELATORIOS_MENU', 'RELATORIOS_NOVO', 'RELATORIOS_STATUS', 'RELATORIOS_HISTORICO', 'RELATORIOS_VISAO_GERAL',
            'INSTALACOES_MENU', 'INSTALACOES_CALENDARIO', 'INSTALACOES_CADASTRO', 'INSTALACOES_LAVAGEM',
            'USUARIOS_MENU', 'RELATORIOS_CONFIG', 'USUARIOS_GESTAO', 'USUARIOS_PERFIL',
            'INSTALACAO_LAVAGEM_SOLIC'
        ] 
    }
];
