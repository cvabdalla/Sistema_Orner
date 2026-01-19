
import React from 'react';

export type Page = 
  | 'DASHBOARD' 
  | 'ORCAMENTO' 
  | 'NOVO_ORCAMENTO'
  | 'RESUMO_VENDAS'
  | 'FINANCEIRO_VISAO_GERAL'
  | 'FINANCEIRO_DRE'
  | 'FINANCEIRO_CATEGORIAS'
  | 'FINANCEIRO_BANCOS'
  | 'ESTOQUE_VISAO_GERAL'
  | 'ESTOQUE_NOVO_PRODUTO'
  | 'ESTOQUE_COMPRAS'
  | 'CHECKLIST_CHECKIN'
  | 'CHECKLIST_CHECKOUT'
  | 'CHECKLIST_MANUTENCAO'
  | 'RELATORIOS_VISAO_GERAL'
  | 'RELATORIOS_NOVO'
  | 'RELATORIOS_STATUS'
  | 'RELATORIOS_HISTORICO'
  | 'RELATORIOS_CONFIG'
  | 'INSTALACOES_CALENDARIO'
  | 'INSTALACOES_CADASTRO'
  | 'INSTALACOES_LAVAGEM'
  | 'USUARIOS_GESTAO'
  | 'USUARIOS_PERFIL';

export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    profileId: string;
    avatar?: string;
    active: boolean;
    darkMode?: boolean;
    biometricsEnabled?: boolean;
}

export interface UserProfile {
    id: string;
    name: string;
    permissions: string[];
}

export interface MenuItem {
    id: string;
    label: string;
    icon: React.FC<{ className?: string }>;
    children?: MenuItem[];
}

export type OrcamentoStatus = 'Em Aberto' | 'Aprovado' | 'Finalizado' | 'Parado' | 'Perdido';

export interface OrcamentoVariant {
    id: string;
    name: string;
    isPrincipal: boolean;
    formState: any;
    calculated: any;
}

export interface SavedOrcamento {
    id: number;
    owner_id: string;
    savedAt: string;
    status: OrcamentoStatus;
    formState?: any;
    calculated?: any;
    variants?: OrcamentoVariant[];
    lavagem_cadastrada?: boolean;
}

export interface SalesSummaryItem {
    id: number;
    orcamentoId: number;
    owner_id: string;
    clientName: string;
    date: string;
    closedValue: number;
    systemCost: number;
    supplier: string;
    visitaTecnica?: number;
    homologation?: number;
    installation?: number;
    travelCost?: number;
    adequationCost?: number;
    materialCost?: number;
    invoicedTax?: number;
    commission?: number;
    bankFees?: number;
    totalCost: number;
    netProfit: number;
    finalMargin: number;
    status?: string;
}

export interface LavagemClient {
    id: string;
    owner_id: string;
    name: string;
    phone?: string;
    cep: string;
    address: string;
    address_number: string;
    complement: string;
    city: string;
    plates_count: number;
    observations?: string;
    installation_end_date?: string;
    package_id?: string;
    contract_wash_qty?: number;
    contract_price_per_plate?: number;
    package_launch_date?: string;
    travel_cost?: number;
}

export interface ChecklistEntry {
    id: string;
    owner_id: string;
    type: 'checkin' | 'checkout' | 'manutencao';
    project: string;
    responsible: string;
    date: string;
    status: 'Aberto' | 'Efetivado' | 'Finalizado' | 'Perdido';
    details: any;
}

export interface StockItem {
    id: string | number;
    owner_id: string;
    name: string;
    ncm?: string;
    quantity: number;
    reservedQuantity?: number;
    minQuantity: number;
    unit: string;
    description?: string;
    image?: string;
    averagePrice: number;
    isFixedInBudget: boolean;
    priceHistory?: PriceHistoryEntry[];
}

export type PurchaseRequestStatus = 'Aberto' | 'Aprovado' | 'Comprado' | 'Em trânsito' | 'Concluído' | 'Cancelado';

export interface PurchaseRequest {
    id: string;
    owner_id: string;
    itemName: string;
    quantity: number;
    unit: string;
    requester: string;
    date: string;
    priority: 'Baixa' | 'Média' | 'Alta';
    status: PurchaseRequestStatus;
    clientName?: string;
    purchaseLink?: string;
    purchaseType?: string;
    observation?: string;
    invoiceFile?: string;
    invoiceKey?: string;
}

export interface StockMovement {
    id: string;
    owner_id: string;
    itemId: string;
    quantity: number;
    type: 'entrada' | 'saida';
    date: string;
    projectName?: string;
    observation?: string;
}

export type ExpenseReportStatus = 'Rascunho' | 'Transferido' | 'Env. p/ Pagamento' | 'Pago' | 'Cancelado';

export interface ExpenseReportItem {
    id: string;
    date: string;
    description: string;
    km: number;
    toll: number;
    food: number;
    components: number;
    others: number;
}

export interface ExpenseAttachment {
    name: string;
    data: string;
}

export interface ExpenseReport {
    id: string;
    owner_id: string;
    requester: string;
    sector: string;
    period: string;
    periodStart: string;
    periodEnd: string;
    items: ExpenseReportItem[];
    attachments: ExpenseAttachment[];
    kmValueUsed: number;
    status: ExpenseReportStatus;
    createdAt: string;
    totalValue: number;
    cancelReason?: string;
}

/* Fix missing Financial types */
export type FinancialTransactionType = 'receita' | 'despesa' | 'resultado';
export type FinancialTransactionStatus = 'pendente' | 'pago' | 'cancelado';

export interface FinancialTransaction {
    id: string;
    owner_id: string;
    description: string;
    amount: number;
    type: FinancialTransactionType;
    dueDate: string;
    launchDate: string;
    paymentDate?: string;
    categoryId: string;
    bankId?: string;
    status: FinancialTransactionStatus;
    cancelReason?: string;
}

export interface FinancialCategory {
    id: string;
    name: string;
    type: FinancialTransactionType;
    classification: string;
    group: string;
    showInDre: boolean;
    active: boolean;
    code?: string;
}

export interface CreditCard {
    id: string;
    owner_id: string;
    name: string;
    lastDigits: string;
    closingDay: number;
    dueDay: number;
    active: boolean;
}

export interface BankAccount {
    id: string;
    owner_id: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    agency: string;
    accountNumber: string;
    initialBalance: number;
    initialBalanceDate: string;
    active: boolean;
}

export interface PriceHistoryEntry {
    date: string;
    price: number;
    invoiceNumber?: string;
}

export interface FinancialGroup {
    id: string;
    name: string;
    type: FinancialTransactionType;
}

export interface FinancialClassification {
    id: string;
    name: string;
    type: FinancialTransactionType;
}

/* Fix missing Lavagem types */
export interface LavagemRecord {
    id: string;
    owner_id: string;
    client_id: string;
    date: string;
    status: 'scheduled' | 'executed';
    created_at?: string;
}

export interface LavagemPackage {
    id: string;
    owner_id: string;
    name: string;
    color: string;
    wash_qty: number;
    price_per_plate: number;
}

export interface LavagemContract {
    id: string;
    client_id: string;
    package_name: string;
    total_value: number;
    travel_cost: number;
    created_at: string;
}

/* Fix missing Instalacoes types */
export interface ActivityCatalogEntry {
    id: string;
    owner_id: string;
    title: string;
    color: string;
    personalSchedule: boolean;
}

export interface PainelConfig {
    id: string;
    linhas: number;
    modulos: number;
    orientacao: string;
}

export interface ActivityAppointment {
    id: string;
    owner_id: string;
    activityId: string;
    clientName: string;
    startDate: string;
    endDate: string;
    startTime?: string;
    endTime?: string;
    isAllDay: boolean;
    cep?: string;
    address: string;
    number?: string;
    complement?: string;
    city?: string;
    platesCount?: number;
    panelsConfig?: PainelConfig[];
    arrangement?: string;
    observations?: string;
    participantIds: string[];
    notifyByEmail?: boolean;
}

export interface AppointmentLogEntry {
    id: string;
    owner_id: string;
    deletedAt: string;
    deletedBy: string;
    deletedById: string;
    cancelReason: string;
    originalAppointment: ActivityAppointment;
}

/* Page Props Interfaces */
export interface OrcamentoPageProps {
    setCurrentPage: (page: Page) => void;
    onEdit: (orcamento: SavedOrcamento) => void;
    currentUser: User;
}

export interface FinanceiroPageProps {
    view: 'dashboard' | 'dre' | 'categorias' | 'bancos';
    currentUser: User;
}

export interface RelatoriosPageProps {
    view: 'analise' | 'reembolso' | 'status' | 'historico' | 'config';
    reportToEdit?: ExpenseReport | null;
    onSave?: () => void;
    onEditReport?: (report: ExpenseReport) => void;
    currentUser: User;
}

export interface NovoOrcamentoPageProps {
    setCurrentPage: (page: Page) => void;
    orcamentoToEdit: SavedOrcamento | null;
    clearEditingOrcamento: () => void;
    currentUser: User;
}

export interface EstoquePageProps {
    view: 'visao_geral' | 'cadastro' | 'compras';
    setCurrentPage: (page: Page) => void;
    currentUser: User;
    userPermissions: string[];
}

export interface UsuariosPageProps {
    view: 'gestao' | 'perfil';
    currentUser: User;
}

export interface CheckListPageProps {
    view: 'checkin' | 'checkout' | 'manutencao';
    currentUser: User;
}

export interface InstalacoesPageProps {
    currentUser: User;
}
