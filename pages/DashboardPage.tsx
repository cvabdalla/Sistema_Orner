
import React, { useEffect, useState, useMemo } from 'react';
import DashboardCard from '../components/DashboardCard';
import ChartComponent from '../components/ChartComponent';
import RecentTransactions from '../components/RecentTransactions';
import { DollarIcon, UsersIcon, TrendUpIcon, DocumentReportIcon, OrcamentoIcon, FinanceiroIcon } from '../assets/icons';
import type { FinancialTransaction, SavedOrcamento } from '../types';
import { dataService } from '../services/dataService';

const DashboardPage: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [orcamentos, setOrcamentos] = useState<SavedOrcamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
      const loadData = async () => {
          setIsLoading(true);
          try {
              const [txs, orcs] = await Promise.all([
                  dataService.getAll<FinancialTransaction>('financial_transactions'),
                  dataService.getAll<SavedOrcamento>('orcamentos')
              ]);
              setTransactions(txs || []);
              setOrcamentos(orcs || []);
          } catch (error) {
              console.error("Erro ao carregar dados do dashboard:", error);
          } finally {
              setIsLoading(false);
          }
      };
      loadData();
  }, []);

  const metrics = useMemo(() => {
      const receitaTotal = transactions.filter(t => t.type === 'receita' && t.status === 'pago').reduce((a, c) => a + c.amount, 0);
      const despesaTotal = transactions.filter(t => t.type === 'despesa' && t.status === 'pago').reduce((a, c) => a + c.amount, 0);
      const orcamentosAprovados = orcamentos.filter(o => o.status === 'Aprovado').length;
      const orcamentosTotal = orcamentos.length;
      return { receitaTotal, despesaTotal, orcamentosAprovados, orcamentosTotal };
  }, [transactions, orcamentos]);

  const chartData = useMemo(() => {
      const data = [];
      const today = new Date();
      for (let i = 5; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          const month = d.getMonth();
          const year = d.getFullYear();
          const monthName = d.toLocaleString('pt-BR', { month: 'short' });
          const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)}/${year.toString().slice(2)}`;
          const monthTxs = transactions.filter(t => {
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

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard title="Receita (Realizada)" value={formatCurrency(metrics.receitaTotal)} icon={FinanceiroIcon} color="bg-green-500" />
        <DashboardCard title="Despesa (Realizada)" value={formatCurrency(metrics.despesaTotal)} icon={TrendUpIcon} color="bg-red-500" />
        <DashboardCard title="Projetos Aprovados" value={metrics.orcamentosAprovados.toString()} icon={OrcamentoIcon} color="bg-blue-500" />
        <DashboardCard title="Total de Orçamentos" value={metrics.orcamentosTotal.toString()} icon={UsersIcon} color="bg-indigo-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <ChartComponent data={chartData} />
        </div>
        <div className="lg:col-span-1">
            <RecentTransactions transactions={transactions} />
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
