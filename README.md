
# Sistema Orner - Instruções de Banco de Dados (CRÍTICO)

Se os lançamentos de cartão **continuam não salvando**, é quase certo que a coluna `id` da sua tabela `financial_transactions` está definida como `Integer` (numérica) ou as novas colunas estão faltando.

**Copie e execute este código EXATAMENTE como está no SQL Editor do Supabase:**

```sql
-- 1. Garante que o ID da tabela aceite texto (necessário para lançamentos de cartão)
-- Isso muda o tipo da coluna id de serial/int para text se necessário
ALTER TABLE public.financial_transactions ALTER COLUMN id TYPE text;

-- 2. Adiciona colunas extras para controle de cartões e parcelas (se não existirem)
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS "billingType" text DEFAULT 'unico';
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS "installmentNumber" integer;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS "totalInstallments" integer;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS "launchDate" text;
ALTER TABLE public.financial_transactions ADD COLUMN IF NOT EXISTS "batchId" text;

-- 3. Garante que a tabela de cartões exista com os tipos corretos
CREATE TABLE IF NOT EXISTS public.credit_cards (
  id text PRIMARY KEY,
  owner_id text,
  name text NOT NULL,
  card_number text,
  last_digits text,
  due_day integer DEFAULT 10,
  closing_day integer DEFAULT 1,
  active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 4. DESABILITA RLS (Row Level Security) temporariamente para garantir permissão de escrita
-- Rode estes comandos se receber erro "42501" ou "Permission Denied"
ALTER TABLE public.financial_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_categories DISABLE ROW LEVEL SECURITY;
```
