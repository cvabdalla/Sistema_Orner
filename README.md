
# Sistema Orner - Instruções de Banco de Dados

Para que a integração com o Supabase funcione totalmente, você precisa executar o seguinte SQL no **SQL Editor** do seu painel Supabase. 

**IMPORTANTE:** Esta versão usa apenas letras minúsculas nas colunas para evitar erros de sintaxe no PostgreSQL.

```sql
-- Criar tabela de cartões de crédito (VERSÃO FINAL)
DROP TABLE IF EXISTS public.credit_cards;

CREATE TABLE public.credit_cards (
  id text PRIMARY KEY,
  owner_id text,
  name text NOT NULL,
  card_number text,
  last_digits text,
  due_day integer DEFAULT 10,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Criar transações financeiras
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id text PRIMARY KEY,
  owner_id text,
  description text,
  amount decimal,
  type text,
  "dueDate" date,
  "paymentDate" date,
  "categoryId" text,
  status text,
  "launchDate" date,
  "batchId" text
);

-- DESABILITAR RLS PARA TESTES INICIAIS
ALTER TABLE public.credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_transactions DISABLE ROW LEVEL SECURITY;

-- Habilitar Realtime (opcional)
alter publication supabase_realtime add table credit_cards;
alter publication supabase_realtime add table financial_transactions;
```
