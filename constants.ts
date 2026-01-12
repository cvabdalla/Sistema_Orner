import type { FinancialCategory, User, UserProfile, MenuItem } from './types';
import { DashboardIcon, OrcamentoIcon, FinanceiroIcon, RelatoriosIcon, AddIcon, CubeIcon, UsersIcon, ShoppingCartIcon, ClipboardListIcon, DocumentReportIcon, ChartPieIcon, CogIcon, CheckCircleIcon, LockClosedIcon, ClipboardCheckIcon, TableIcon, CalendarIcon, TruckIcon } from './assets/icons';

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
          { id: 'RELATORIOS_VISAO_GERAL', label: 'Resumo Reembolso', icon: ChartPieIcon },
      ]
  },
  { 
      id: 'RELATORIOS_MENU', 
      label: 'Reembolso', 
      icon: RelatoriosIcon,
      children: [
          { id: 'RELATORIOS_NOVO', label: 'Novo Reembolso', icon: AddIcon },
          { id: 'RELATORIOS_STATUS', label: 'Status de Reembolso', icon: CheckCircleIcon },
          { id: 'RELATORIOS_HISTORICO', label: 'Histórico de Reembolso', icon: ClipboardListIcon },
      ]
  },
  {
    id: 'INSTALACOES_MENU',
    label: 'Instalações',
    icon: TruckIcon,
    children: [
        { id: 'INSTALACOES_CALENDARIO', label: 'Calendário', icon: CalendarIcon },
        { id: 'INSTALACOES_CADASTRO', label: 'Cadastro', icon: AddIcon },
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

export const FINANCIAL_CATEGORIES: FinancialCategory[] = [
  { id: 'c1', name: 'Venda sistema solar', type: 'receita', classification: 'RECEITA_VENDA', group: 'Vendas' },
  { id: 'c2', name: 'Aluguel escritório', type: 'despesa', classification: 'DESPESA_OPERACIONAL', group: 'Infraestrutura' },
  { id: 'c3', name: 'Uber / Táxi', type: 'despesa', classification: 'DESPESA_VARIAVEL', group: 'Transporte' },
  { id: 'c4', name: 'Internet / Link', type: 'despesa', classification: 'DESPESA_OPERACIONAL', group: 'Infraestrutura' },
  { id: 'c5', name: 'Pró-labore sócios', type: 'despesa', classification: 'DESPESA_OPERACIONAL', group: 'Equipe' },
  { id: 'c6', name: 'Salários equipe', type: 'despesa', classification: 'DESPESA_OPERACIONAL', group: 'Equipe' },
  { id: 'c7', name: 'Fornecedor Aldo Solar', type: 'despesa', classification: 'CUSTO_VENDA', group: 'Materiais' },
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
            'CHECKLIST_MENU', 'CHECKLIST_CHECKIN', 'CHECKLIST_CHECKOUT', 'CHECKLIST_MANUTENCAO',
            'RELATORIOS_MENU', 'RELATORIOS_NOVO', 'RELATORIOS_STATUS', 'RELATORIOS_HISTORICO', 'RELATORIOS_VISAO_GERAL',
            'INSTALACOES_MENU', 'INSTALACOES_CALENDARIO', 'INSTALACOES_CADASTRO',
            'USUARIOS_MENU', 'RELATORIOS_CONFIG', 'USUARIOS_GESTAO', 'USUARIOS_PERFIL'
        ] 
    },
    { 
        id: 'vendedor-001', 
        name: 'Vendedor', 
        permissions: [
            'ORCAMENTO_MENU', 'NOVO_ORCAMENTO', 'ORCAMENTO', 'RESUMO_VENDAS',
            'ESTOQUE_MENU', 'ESTOQUE_VISAO_GERAL', 'ESTOQUE_COMPRAS', 'ESTOQUE_NOVO_PRODUTO',
            'CHECKLIST_MENU', 'CHECKLIST_CHECKIN', 'CHECKLIST_CHECKOUT', 'CHECKLIST_MANUTENCAO',
            'RELATORIOS_MENU', 'RELATORIOS_NOVO', 'RELATORIOS_STATUS', 'RELATORIOS_HISTORICO',
            'INSTALACOES_MENU', 'INSTALACOES_CALENDARIO', 'INSTALACOES_CADASTRO',
            'USUARIOS_MENU', 'USUARIOS_GESTAO'
        ] 
    }
];

export const MOCK_FINANCIAL_TRANSACTIONS: any[] = [];

export const MOCK_STOCK_ITEMS: any[] = [
    {
        id: 's1',
        owner_id: '001',
        name: 'Inversor solar deye 5kw monofásico',
        ncm: '8504.40.30',
        quantity: 12,
        minQuantity: 3,
        unit: 'un',
        averagePrice: 4250.00,
        isFixedInBudget: true,
        priceHistory: [{ date: '2024-01-01', price: 4250.00 }]
    },
    {
        id: 's2',
        owner_id: '001',
        name: 'Painel solar jinko tiger neo 575w',
        ncm: '8541.43.00',
        quantity: 124,
        minQuantity: 20,
        unit: 'un',
        averagePrice: 580.00,
        isFixedInBudget: true,
        priceHistory: [{ date: '2024-01-01', price: 580.00 }]
    },
    {
        id: 's3',
        owner_id: '001',
        name: 'Cabo solar 6mm flexível preto',
        ncm: '8544.49.00',
        quantity: 500,
        minQuantity: 100,
        unit: 'mt',
        averagePrice: 4.80,
        isFixedInBudget: true,
        priceHistory: [{ date: '2024-01-01', price: 4.80 }]
    },
    {
        id: 's4',
        owner_id: '001',
        name: 'Estrutura telhado cerâmico 4 placas',
        ncm: '7610.90.00',
        quantity: 10,
        minQuantity: 2,
        unit: 'kit',
        averagePrice: 450.00,
        isFixedInBudget: false,
        priceHistory: [{ date: '2024-01-01', price: 450.00 }]
    },
    {
        id: 's5',
        owner_id: '001',
        name: 'Conector mc4 original stäubli (par)',
        ncm: '8536.69.90',
        quantity: 45,
        minQuantity: 20,
        unit: 'par',
        averagePrice: 18.50,
        isFixedInBudget: true,
        priceHistory: [{ date: '2024-01-01', price: 18.50 }]
    },
    {
        id: 's6',
        owner_id: '001',
        name: 'Disjuntor ac bipolar 20a',
        ncm: '8536.20.00',
        quantity: 30,
        minQuantity: 5,
        unit: 'un',
        averagePrice: 35.00,
        isFixedInBudget: false,
        priceHistory: [{ date: '2024-01-01', price: 35.00 }]
    }
];

export const MOCK_STOCK_MOVEMENTS: any[] = [];
export const MOCK_PURCHASE_REQUESTS: any[] = [];
export const MOCK_SALES_SUMMARY: any[] = [];