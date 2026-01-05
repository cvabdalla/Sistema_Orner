
import React from 'react';

export type Page = 
  | 'DASHBOARD' 
  | 'ORCAMENTO' 
  | 'RESUMO_VENDAS' 
  | 'FINANCEIRO_VISAO_GERAL' 
  | 'FINANCEIRO_CATEGORIAS' 
  | 'FINANCEIRO_DRE' 
  | 'RELATORIOS_VISAO_GERAL' 
  | 'RELATORIOS_NOVO' 
  | 'RELATORIOS_STATUS' 
  | 'RELATORIOS_HISTORICO' 
  | 'RELATORIOS_CONFIG' 
  | 'NOVO_ORCAMENTO'
  | 'ESTOQUE_VISAO_GERAL'
  | 'ESTOQUE_NOVO_PRODUTO'
  | 'ESTOQUE_COMPRAS'
  | 'CHECKLIST_CHECKIN'
  | 'CHECKLIST_CHECKOUT'
  | 'CHECKLIST_MANUTENCAO'
  | 'USUARIOS_GESTAO'
  | 'USUARIOS_PERFIL';

export interface MenuItem {
  id: Page | string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: MenuItem[];
}

export interface User {
    id: string;
    name: string;
    email: string;
    password?: string;
    profileId: string;
    avatar?: string;
    active: boolean;
}

export interface UserProfile {
    id: string;
    name: string;
    permissions: string[];
}

export interface PriceHistoryEntry {
    date: string;
    price: number;
    invoiceNumber?: string;
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
    image?: string; // Base64
    averagePrice?: number;
    isFixedInBudget?: boolean;
    priceHistory?: PriceHistoryEntry[];
}

export type StockMovementType = 'entrada' | 'saida';

export interface StockMovement {
    id: string;
    owner_id: string;
    itemId: string;
    quantity: number;
    type: StockMovementType;
    date: string;
    observation?: string;
}

export interface PurchaseRequest {
    id: string;
    owner_id: string;
    itemName: string;
    quantity: number;
    unit: string;
    requester: string;
    date: string;
    priority: 'Baixa' | 'Média' | 'Alta';
    status: 'Pendente' | 'Aprovado' | 'Comprado' | 'Cancelado';
    clientName?: string;
    observation?: string;
    purchaseLink?: string;
    purchaseType?: 'Reposição' | 'Avulso';
    invoiceFile?: string; // Base64 do anexo da NF
}

export interface ChecklistEntry {
    id: string;
    owner_id: string;
    type: 'checkin' | 'checkout' | 'manutencao';
    project: string; 
    responsible: string;
    date: string;
    status: 'Aberto' | 'Efetivado' | 'Perdido' | 'Finalizado';
    details: any;
}

export type OrcamentoStatus = 'Em Aberto' | 'Aprovado' | 'Parado' | 'Perdido';

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
    variants?: OrcamentoVariant[];
    formState?: any;
    calculated?: any;
}

export interface SalesSummaryItem {
    id: number;
    orcamentoId?: number; 
    owner_id: string;
    clientName: string;
    date: string;
    closedValue: number;
    systemCost: number;
    supplier?: string;
    visitaTecnica: number;
    homologation: number;
    installation: number;
    travelCost: number;
    adequationCost: number;
    materialCost: number;
    invoicedTax: number;
    commission: number;
    bankFees: number;
    totalCost: number;
    netProfit: number;
    finalMargin: number;
    status?: string;
    [key: string]: any;
}

export type FinancialTransactionStatus = 'pendente' | 'pago';
export type FinancialTransactionType = 'receita' | 'despesa';

export interface FinancialTransaction {
    id: string;
    owner_id: string;
    description: string;
    amount: number;
    type: FinancialTransactionType;
    dueDate: string;
    paymentDate?: string;
    categoryId: string;
    status: FinancialTransactionStatus;
    launchDate?: string;
    batchId?: string; // Para agrupar lançamentos de cartão
}

export interface FinancialCategory {
    id: string;
    name: string;
    type: FinancialTransactionType;
}

export interface CreditCard {
    id: string;
    owner_id: string;
    name: string;
    card_number?: string;
    last_digits?: string;
    due_day: number; 
    closing_day: number;
    active: boolean;
}

export interface ExpenseReportItem {
    id: string;
    date: string;
    description: string;
    origin?: string;
    destination?: string;
    km: number;
    toll: number;
}

export type ExpenseReportStatus = 'Rascunho' | 'Em Aberto' | 'Transferido' | 'Pago';

export interface ExpenseReport {
    id: string;
    owner_id: string;
    requester: string;
    sector: string;
    period: string;
    periodStart?: string;
    periodEnd?: string;
    items: ExpenseReportItem[];
    attachments?: string[]; // Array de anexos base64 globais (planilha)
    kmValueUsed: number;
    status: ExpenseReportStatus;
    createdAt: string;
    totalValue: number;
}

export interface EstoquePageProps {
    view: 'visao_geral' | 'cadastro' | 'compras';
    setCurrentPage: (page: Page | string) => void;
    currentUser: User;
}

export interface CheckListPageProps {
    view: 'checkin' | 'checkout' | 'manutencao';
    currentUser: User;
}

export interface OrcamentoPageProps {
    setCurrentPage: (page: Page) => void;
    onEdit: (orcamento: SavedOrcamento) => void;
    currentUser: User;
}

export interface NovoOrcamentoPageProps {
    setCurrentPage: (page: Page) => void;
    orcamentoToEdit: SavedOrcamento | null;
    clearEditingOrcamento: () => void;
    currentUser: User;
}

export interface FinanceiroPageProps {
    view: 'dashboard' | 'dre' | 'categorias';
    currentUser: User;
}

export interface RelatoriosPageProps {
    view: 'analise' | 'reembolso' | 'status' | 'historico' | 'config';
    reportToEdit?: ExpenseReport | null;
    onSave?: () => void;
    onCancel?: () => void;
    onEditReport?: (report: ExpenseReport) => void;
    currentUser: User;
}

export interface UsuariosPageProps {
    view: 'gestao' | 'perfil';
    setCurrentPage?: (page: Page) => void;
}
