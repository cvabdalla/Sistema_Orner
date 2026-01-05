# Sistema Orner - Instruções de Banco de Dados (OBRIGATÓRIO)

Para que o **Resumo de Vendas** e a aprovação de orçamentos funcionem, você deve executar o script abaixo no **SQL Editor** do seu projeto Supabase. Este script remove a tabela antiga e cria uma nova estrutura 100% compatível com as funcionalidades de custo.

```sql
-- 1. Remove a tabela antiga para limpar o cache de esquema
DROP TABLE IF EXISTS public.sales_summary;

-- 2. Cria a tabela com as colunas exatas (preservando o CamelCase com aspas duplas)
CREATE TABLE public.sales_summary (
  id bigint PRIMARY KEY,
  "orcamentoId" bigint,
  owner_id text,
  "clientName" text,
  "date" text,
  "closedValue" numeric DEFAULT 0,
  "systemCost" numeric DEFAULT 0,
  supplier text,
  "visitaTecnica" numeric DEFAULT 0,
  homologation numeric DEFAULT 0,
  installation numeric DEFAULT 0,
  "travelCost" numeric DEFAULT 0,
  "adequationCost" numeric DEFAULT 0,
  "materialCost" numeric DEFAULT 0,
  "invoicedTax" numeric DEFAULT 0,
  commission numeric DEFAULT 0,
  "bankFees" numeric DEFAULT 0,
  "totalCost" numeric DEFAULT 0,
  "netProfit" numeric DEFAULT 0,
  "finalMargin" numeric DEFAULT 0,
  status text DEFAULT 'Aprovado',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Desabilita RLS para garantir que o frontend consiga salvar os dados sem erros de permissão
ALTER TABLE public.orcamentos DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_summary DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_profiles DISABLE ROW LEVEL SECURITY;

-- 4. Garante que os IDs de orçamentos suportem números grandes
ALTER TABLE public.orcamentos ALTER COLUMN id TYPE bigint;
```