
import type { MenuItem, FinancialCategory, FinancialTransaction, StockItem, StockMovement, User, PurchaseRequest, UserProfile, SalesSummaryItem } from './types';
import { DashboardIcon, OrcamentoIcon, FinanceiroIcon, RelatoriosIcon, AddIcon, CubeIcon, UsersIcon, ShoppingCartIcon, ClipboardListIcon, DocumentReportIcon, ChartPieIcon, CogIcon, ClipboardListIcon as HistoryIcon, CheckCircleIcon, LockClosedIcon, ClipboardCheckIcon, TableIcon } from './assets/icons';

export const MENU_ITEMS: MenuItem[] = [
  { id: 'DASHBOARD', label: 'Dashboard', icon: DashboardIcon },
  
  { 
    id: 'ORCAMENTO', 
    label: 'Orçamento', 
    icon: OrcamentoIcon,
    children: [
        { id: 'NOVO_ORCAMENTO', label: 'Novo Orçamento', icon: AddIcon },
        { id: 'ORCAMENTO', label: 'Lista de Orçamento', icon: OrcamentoIcon },
        { id: 'RESUMO_VENDAS', label: 'Resumo de Vendas', icon: TableIcon }, 
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
          { id: 'RELATORIOS_VISAO_GERAL', label: 'Resumo Reembolsos', icon: ChartPieIcon },
      ]
  },

  {
      id: 'ESTOQUE_MENU',
      label: 'Estoque',
      icon: CubeIcon,
      children: [
          { id: 'ESTOQUE_VISAO_GERAL', label: 'Estoque Geral', icon: CubeIcon },
          { id: 'ESTOQUE_COMPRAS', label: 'Pedidos de Compra', icon: ShoppingCartIcon },
          { id: 'ESTOQUE_NOVO_PRODUTO', label: 'Cadastrar Produtos', icon: AddIcon },
      ]
  },

  {
      id: 'CHECKLIST_MENU',
      label: 'Checklists',
      icon: ClipboardCheckIcon,
      children: [
          { id: 'CHECKLIST_CHECKIN', label: 'Check-in de obra', icon: ClipboardCheckIcon },
          { id: 'CHECKLIST_CHECKOUT', label: 'Check-out de obra', icon: CheckCircleIcon },
          { id: 'CHECKLIST_MANUTENCAO', label: 'Manutenção', icon: ClipboardListIcon },
      ]
  },

  { 
      id: 'RELATORIOS_MENU', 
      label: 'Reembolso', 
      icon: RelatoriosIcon,
      children: [
          { id: 'RELATORIOS_NOVO', label: 'Novo Reembolso', icon: AddIcon },
          { id: 'RELATORIOS_STATUS', label: 'Status de Reembolso', icon: CheckCircleIcon },
          { id: 'RELATORIOS_HISTORICO', label: 'Histórico de Reembolso', icon: HistoryIcon },
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
  { id: 'cat-rec-1', name: 'Venda de Kits Solar', type: 'receita' },
  { id: 'cat-rec-2', name: 'Serviços de Mão de Obra', type: 'receita' },
  { id: 'cat-des-1', name: 'Fornecedor Equipamentos', type: 'despesa' },
  { id: 'cat-des-2', name: 'Impostos e Taxas', type: 'despesa' },
  { id: 'cat-des-3', name: 'Comissões de Vendas', type: 'despesa' },
  { id: 'cat-des-4', name: 'Logística e Viagens', type: 'despesa' },
  { id: 'cat-des-5', name: 'Aluguel e Infraestrutura', type: 'despesa' },
];

export const MOCK_FINANCIAL_TRANSACTIONS: FinancialTransaction[] = [
    {
        id: 'tx-1',
        owner_id: '00000000-0000-0000-0000-000000000001',
        description: 'Entrada Projeto Res. Silva (50%)',
        amount: 15400.00,
        type: 'receita',
        dueDate: '2024-03-01',
        paymentDate: '2024-03-01',
        categoryId: 'cat-rec-1',
        status: 'pago'
    },
    {
        id: 'tx-2',
        owner_id: '00000000-0000-0000-0000-000000000001',
        description: 'Compra Kit Fotovoltaico - Aldo Solar',
        amount: 8900.00,
        type: 'despesa',
        dueDate: '2024-03-05',
        paymentDate: '2024-03-05',
        categoryId: 'cat-des-1',
        status: 'pago'
    }
];

export const MOCK_STOCK_ITEMS: StockItem[] = [
    {
        id: '1',
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Inversor Solar Deye 5kW Monofásico 220V',
        unit: 'un',
        quantity: 8,
        minQuantity: 2,
        ncm: '8504.40.30',
        averagePrice: 4850.00
    },
    {
        id: '2',
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Painel Solar Jinko Tiger Neo 550W N-Type',
        unit: 'un',
        quantity: 120,
        minQuantity: 50,
        ncm: '8541.43.00',
        averagePrice: 715.00
    },
    {
        id: '3',
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Cabo Solar Nexans 6mm² Preto',
        unit: 'mt',
        quantity: 500,
        minQuantity: 100,
        ncm: '8544.49.00',
        averagePrice: 6.80
    },
    {
        id: '4',
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Cabo Solar Nexans 6mm² Vermelho',
        unit: 'mt',
        quantity: 500,
        minQuantity: 100,
        ncm: '8544.49.00',
        averagePrice: 6.80
    },
    {
        id: '5',
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Conector MC4 Stäubli (Par)',
        unit: 'par',
        quantity: 60,
        minQuantity: 20,
        ncm: '8536.69.90',
        averagePrice: 15.50
    },
    {
        id: '6',
        owner_id: '00000000-0000-0000-0000-000000000001',
        name: 'Trilho de Alumínio 4.20m p/ Fixação',
        unit: 'pç',
        quantity: 24,
        minQuantity: 10,
        ncm: '7610.90.00',
        averagePrice: 192.00
    }
];

export const MOCK_STOCK_MOVEMENTS: StockMovement[] = [];
export const MOCK_PURCHASE_REQUESTS: PurchaseRequest[] = [];
export const MOCK_SALES_SUMMARY: SalesSummaryItem[] = [];

export const MOCK_PROFILES: UserProfile[] = [
    {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Administrador',
        permissions: ['DASHBOARD', 'ORCAMENTOS_MENU', 'ESTOQUE_MENU', 'RESUMO_VENDAS', 'CHECKLIST_MENU', 'FINANCEIRO_MENU', 'RELATORIOS_MENU', 'USUARIOS_MENU', 'NOVO_ORCAMENTO', 'ORCAMENTO', 'ESTOQUE_VISAO_GERAL', 'ESTOQUE_NOVO_PRODUTO', 'ESTOQUE_COMPRAS', 'CHECKLIST_CHECKIN', 'CHECKLIST_CHECKOUT', 'CHECKLIST_MANUTENCAO', 'FINANCEIRO_VISAO_GERAL', 'FINANCEIRO_DRE', 'FINANCEIRO_CATEGORIAS', 'RELATORIOS_VISAO_GERAL', 'RELATORIOS_NOVO', 'RELATORIOS_STATUS', 'RELATORIOS_HISTORICO', 'RELATORIOS_CONFIG', 'USUARIOS_GESTAO', 'USUARIOS_PERFIL']
    }
];

export const MOCK_USERS: User[] = [
    { 
        id: '00000000-0000-0000-0000-000000000001', 
        name: 'Administrador', 
        email: 'admin@orner.com.br', 
        profileId: '00000000-0000-0000-0000-000000000001', 
        active: true, 
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=4f46e5&color=fff'
    },
];
