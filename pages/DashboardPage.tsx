
import React, { useEffect, useState, useMemo } from 'react';
import DashboardCard from '../components/DashboardCard';
import ChartComponent from '../components/ChartComponent';
import RecentTransactions from '../components/RecentTransactions';
import TransactionModal from '../components/Financeiro/TransactionModal';
import { 
    DollarIcon, UsersIcon, TrendUpIcon, DocumentReportIcon, 
    OrcamentoIcon, FinanceiroIcon, ExclamationTriangleIcon, 
    ShoppingCartIcon, CubeIcon, ClockIcon, SparklesIcon, CalendarIcon
} from '../assets/icons';
import type { FinancialTransaction, SavedOrcamento, StockItem, PurchaseRequest, ExpenseReport, FinancialCategory, BankAccount, LavagemRecord, LavagemClient } from '../types';
import { dataService } from '../services/dataService';

const DashboardPage: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [expenseReports, setExpenseReports] = useState<ExpenseReport[]>([]);
  const [lavagemRecords, setLavagemRecords] = useState<LavagemRecord[]>([]);
  const [lavagemClients, setLavagemClients] = useState<LavagemClient[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Estados para edição
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinancialTransaction | null>(null);

  const loadData = async () => {
      try {
          const [txs, orcs, items, reqs, reports, cats, banks, washRecs, washClis] = await Promise.all([
              dataService.getAll<FinancialTransaction>('financial_transactions'),
              dataService.getAll<SavedOrcamento>('orcamentos'),
              dataService.getAll<StockItem>('stock_items'),
              dataService.getAll<PurchaseRequest>('purchase_requests'),
              dataService.getAll<ExpenseReport>('expense_reports'),
              dataService.getAll<FinancialCategory>('financial_categories'),
              dataService.getAll<BankAccount>('bank_accounts'),
              dataService.getAll<LavagemRecord>('lavagem_records'),
              dataService.getAll<LavagemClient>('lavagem_clients')
          ]);
          setTransactions(txs || []);
          setOrcamentos(orcs || []);
          setStockItems(items || []);
          setPurchaseRequests(reqs || []);
          setExpenseReports(reports || []);
          setCategories(cats || []);
          setBankAccounts(banks || []);
          setLavagemRecords(washRecs || []);
          setLavagemClients(washClis || []);
      } catch (error) {
          console.error("Erro ao carregar dados do dashboard:", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      loadData();
  }, []);

  const metrics = useMemo(() => {
      const activeTxs = transactions.filter(t => t.status !== 'cancelado');
      const receitaTotal = activeTxs.filter(t => t.type === 'receita' && t.status === 'pago').reduce((a, c) => a + c.amount, 0);
      const despesaTotal = activeTxs.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((a, c) => a + c.amount, 0);
      const orcamentosAprovados = orcamentos.filter(o => o.status === 'Aprovado').length;
      const orcamentosTotal = orcamentos.length;

      const openPurchaseRequests = purchaseRequests.filter(r => r.status === 'Aberto').length;
      const lowStockItems = stockItems.filter(i => i.quantity <= i.minQuantity).length;
      
      const transferidos = expenseReports.filter(r => r.status === 'Transferido').length;
      const envPagamento = expenseReports.filter(r => r.status === 'Env. p/ Pagamento').length;

      // Lógica de Lavagens Próximas (Janela de 7 dias)
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);
      const todayStr = today.toISOString().split('T')[0];
      const nextWeekStr = nextWeek.toISOString().split('T')[0];

      const upcomingWashes = lavagemRecords.filter(r => 
        r.status === 'scheduled' && 
        r.date >= todayStr && 
        r.date <= nextWeekStr
      ).length;

      const overdueWashes = lavagemRecords.filter(r => 
        r.status === 'scheduled' && 
        r.date < todayStr
      ).length;

      // Oportunidade de 1 ano
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      const oneYearAgoStr = oneYearAgo.toISOString().split('T')[0];

      const salesOpportunities = lavagemClients.filter(c => 
        !c.package_id && 
        c.installation_end_date && 
        c.installation_end_date <= oneYearAgoStr
      ).length;

      return { 
          receitaTotal, 
          despesaTotal, 
          orcamentosAprovados, 
          orcamentosTotal,
          openPurchaseRequests,
          lowStockItems,
          transferidos,
          envPagamento,
          upcomingWashes,
          overdueWashes,
          salesOpportunities
      };
  }, [transactions, orcamentos, stockItems, purchaseRequests, expenseReports, lavagemRecords, lavagemClients]);

  const chartData = useMemo(() => {
      const data = [];
      const today = new Date();
      const activeTxs = transactions.filter(t => t.status !== 'cancelado');

      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const month = d.getMonth();
          const year = d.getFullYear();
          const monthName = d.toLocaleString('pt-BR', { month: 'short' });
          const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year.toString().slice(2)}`;
          const monthTxs = activeTxs.filter(t => {
              const dateRef = t.paymentDate || t.dueDate;
              if (t.status !== 'pago' || !dateRef) return false;
              const tDate = new Date(dateRef);
              return tDate.getMonth() === month && tDate.getFullYear() === year;
          });
          const receita = monthTxs.filter(t => t.type === 'receita').reduce((a, c) => a + c.amount, 0);
          const despesa = monthTxs.filter(t => t.type === 'despesa').reduce((a, c) => a + c.amount, 0);
          data.push({ name: label, receita, despesa });
      }
      return data;
  }, [transactions]);

  const formatCurrency = (val: number) => {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const handleEditTransaction = (tx: FinancialTransaction) => {
      setEditingTransaction(tx);
      setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (tx: FinancialTransaction) => {
      try {
          await dataService.save('financial_transactions', tx);
          setIsEditModalOpen(false);
          loadData();
      } catch (e) {
          console.error(e);
          alert("Erro ao salvar transação.");
      }
  };

  const handleDeleteTransaction = async (id: string) => {
      if (confirm('Deseja realmente excluir este lançamento?')) {
          try {
              await dataService.delete('financial_transactions', id);
              await loadData();
          } catch (e) {
              console.error(e);
              alert("Erro ao excluir lançamento.");
          }
      }
  };

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  const totalWashAlerts = metrics.upcomingWashes + metrics.overdueWashes;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Receita (Realizada)" value={formatCurrency(metrics.receitaTotal)} icon={FinanceiroIcon} color="bg-green-500" />
        <DashboardCard title="Despesa (Realizada)" value={formatCurrency(metrics.despesaTotal)} icon={TrendUpIcon} color="bg-red-500" />
        <DashboardCard title="Projetos aprovados" value={metrics.orcamentosAprovados.toString()} icon={OrcamentoIcon} color="bg-blue-500" />
        <DashboardCard title="Total de orçamentos" value={metrics.orcamentosTotal.toString()} icon={UsersIcon} color="bg-indigo-500" />
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-lg border border-orange-100 dark:border-orange-900/30">
        <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 text-orange-600 rounded-xl">
                <ExclamationTriangleIcon className="w-5 h-5" />
            </div>
            <div>
                <h3 className="text-xl font-black text-gray-800 dark:text-white tracking-tight leading-none">Alertas e pendências críticas</h3>
                <p className="text-[11px] text-gray-500 font-bold mt-1.5">Ações imediatas necessárias por departamento</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Suprimentos */}
            <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${metrics.openPurchaseRequests > 0 ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800' : 'bg-gray-50 dark:bg-gray-900/40 border-transparent opacity-60'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${metrics.openPurchaseRequests > 0 ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' : 'bg-gray-200 text-gray-400'}`}>
                    <ShoppingCartIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                    <span className="text-[9px] font-bold text-gray-400 block mb-0.5">Suprimentos</span>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 leading-tight truncate">Pedidos de compra</p>
                    <p className={`text-xl font-black ${metrics.openPurchaseRequests > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500'}`}>
                        {metrics.openPurchaseRequests} {metrics.openPurchaseRequests === 1 ? 'pendente' : 'pendentes'}
                    </p>
                </div>
            </div>

            {/* Estoque */}
            <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${metrics.lowStockItems > 0 ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800' : 'bg-gray-50 dark:bg-gray-900/40 border-transparent opacity-60'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${metrics.lowStockItems > 0 ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-gray-200 text-gray-400'}`}>
                    <CubeIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                    <span className="text-[9px] font-bold text-gray-400 block mb-0.5">Estoque de Materiais</span>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 leading-tight truncate">Abaixo do mínimo</p>
                    <p className={`text-xl font-black ${metrics.lowStockItems > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                        {metrics.lowStockItems} {metrics.lowStockItems === 1 ? 'item' : 'itens'}
                    </p>
                </div>
            </div>

            {/* Solicitações de Pagamento */}
            <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${metrics.transferidos > 0 ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-900/40 border-transparent opacity-60'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${metrics.transferidos > 0 ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200' : 'bg-gray-200 text-gray-400'}`}>
                    <DocumentReportIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                    <span className="text-[9px] font-bold text-gray-400 block mb-0.5">Solic. Pagamento</span>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 leading-tight truncate">Aguardando aprovação</p>
                    <p className={`text-xl font-black ${metrics.transferidos > 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500'}`}>
                        {metrics.transferidos} {metrics.transferidos === 1 ? 'pendente' : 'pendentes'}
                    </p>
                </div>
            </div>

            {/* Operacional Lavagem */}
            <div className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-4 ${totalWashAlerts > 0 ? (metrics.overdueWashes > 0 ? 'bg-rose-50 dark:bg-rose-900/10 border-rose-200 dark:border-rose-800' : 'bg-cyan-50 dark:bg-cyan-900/10 border-cyan-200 dark:border-cyan-800') : 'bg-gray-50 dark:bg-gray-900/40 border-transparent opacity-60'}`}>
                <div className={`p-3 rounded-xl flex-shrink-0 ${totalWashAlerts > 0 ? (metrics.overdueWashes > 0 ? 'bg-rose-500' : 'bg-cyan-600') : 'bg-gray-200'} text-white shadow-lg`}>
                    <SparklesIcon className="w-6 h-6" />
                </div>
                <div className="overflow-hidden">
                    <span className="text-[9px] font-bold text-gray-400 block mb-0.5">Operacional/Lavagem</span>
                    <p className="text-sm font-bold text-gray-600 dark:text-gray-400 leading-tight truncate">Próximas lavagens</p>
                    <div className={`text-xl font-black ${totalWashAlerts > 0 ? (metrics.overdueWashes > 0 ? 'text-rose-600' : 'text-cyan-600') : 'text-gray-500'}`}>
                        {totalWashAlerts} {totalWashAlerts === 1 ? 'visita' : 'visitas'}
                    </div>
                    {totalWashAlerts > 0 && (
                        <div className="flex gap-2 mt-0.5">
                            {metrics.overdueWashes > 0 && <span className="text-[8px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded animate-pulse">Atrasada</span>}
                            {metrics.upcomingWashes > 0 && <span className="text-[8px] font-black text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded">Próx. 7 dias</span>}
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <ChartComponent data={chartData} />
        </div>
        <div className="lg:col-span-1">
            <RecentTransactions 
                transactions={transactions.filter(t => t.status === 'pendente')} 
                onEdit={handleEditTransaction}
                onDelete={handleDeleteTransaction}
            />
        </div>
      </div>

      {isEditModalOpen && (
          <TransactionModal 
            isOpen={isEditModalOpen} 
            onClose={() => setIsEditModalOpen(false)} 
            onSave={handleSaveEdit} 
            transaction={editingTransaction} 
            categories={categories} 
            bankAccounts={bankAccounts} 
          />
      )}
    </div>
  );
};

export default DashboardPage;
