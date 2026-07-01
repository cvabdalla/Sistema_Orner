-- 
-- Scripts para atualização do Banco de Dados Supabase (Sistema Orner)
-- Execute este SQL no "SQL Editor" do seu painel do Supabase para aplicar as correções.
--

-- 1. Adicionar as colunas físicas para Bairro e Número no cadastro de instaladores
ALTER TABLE "instaladores" ADD COLUMN IF NOT EXISTS "numero" text;
ALTER TABLE "instaladores" ADD COLUMN IF NOT EXISTS "bairro" text;

-- 2. Desabilitar Row Level Security (RLS) para a tabela de instaladores
-- Isso resolve definitivamente o problema do instalador não salvar ("new row violates row-level security policy")
ALTER TABLE "instaladores" DISABLE ROW LEVEL SECURITY;

-- 3. Caso prefira manter o RLS ativo, você pode executar o bloco abaixo para criar políticas permissivas:
-- ALTER TABLE "instaladores" ENABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS "Permitir leitura pública de instaladores" ON "instaladores";
-- CREATE POLICY "Permitir leitura pública de instaladores" ON "instaladores" FOR SELECT USING (true);
-- DROP POLICY IF EXISTS "Permitir inserção pública de instaladores" ON "instaladores";
-- CREATE POLICY "Permitir inserção pública de instaladores" ON "instaladores" FOR INSERT WITH CHECK (true);
-- DROP POLICY IF EXISTS "Permitir atualização pública de instaladores" ON "instaladores";
-- CREATE POLICY "Permitir atualização pública de instaladores" ON "instaladores" FOR UPDATE USING (true) WITH CHECK (true);
-- DROP POLICY IF EXISTS "Permitir exclusão pública de instaladores" ON "instaladores";
-- CREATE POLICY "Permitir exclusão pública de instaladores" ON "instaladores" FOR DELETE USING (true);

-- 4. Garantir que a configuração global do valor de KM padrão exista
INSERT INTO "system_configs" (id, value)
VALUES ('km_value', '1.20')
ON CONFLICT (id) DO NOTHING;

-- 5. Criar a tabela de manutencoes para atender chamados de manutenção e reparos
CREATE TABLE IF NOT EXISTS "manutencoes" (
    "id" text PRIMARY KEY,
    "owner_id" text NOT NULL,
    "clientName" text NOT NULL,
    "phone" text,
    "cep" text,
    "address" text,
    "numero" text,
    "bairro" text,
    "complemento" text,
    "city" text,
    "estado" text,
    "status" text NOT NULL DEFAULT 'Especulação',
    "title" text NOT NULL,
    "description" text,
    "startDate" text,
    "endDate" text,
    "services" jsonb DEFAULT '[]'::jsonb,
    "materials" jsonb DEFAULT '[]'::jsonb,
    "categories" jsonb DEFAULT '[]'::jsonb,
    "materialsSource" text DEFAULT 'manual',
    "selectedChecklists" jsonb DEFAULT '[]'::jsonb,
    "totalCost" numeric DEFAULT 0,
    "totalPrice" numeric DEFAULT 0,
    "notes" text,
    "createdAt" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Garantir que as novas colunas existam em ambientes onde a tabela já foi criada anteriormente
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "cep" text;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "bairro" text;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "numero" text;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "complemento" text;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "estado" text;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "categories" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "materialsSource" text DEFAULT 'manual';
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "selectedChecklists" jsonb DEFAULT '[]'::jsonb;
ALTER TABLE "manutencoes" ADD COLUMN IF NOT EXISTS "motivoPerdido" text;

-- Desabilita RLS para garantir gravação simplificada por qualquer usuário logado
ALTER TABLE "manutencoes" DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "manutencoes" IS 'Tabela que armazena registros de orçamentos e chamados de manutenção e reparos avulsos.';

-- 6. Adiciona suporte ao descarte de custos/provisões individuais da tela de fluxo de caixa (Instalação)
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "custos_lancados" jsonb DEFAULT '{}'::jsonb;
COMMENT ON COLUMN "orcamentos"."custos_lancados" IS 'Armazena quais provisões de custos foram faturadas ou ignoradas na tela de controle de fluxo de caixa';

-- 7. Criar tabela de histórico faturamento retroativo
CREATE TABLE IF NOT EXISTS "historical_revenue" (
    "id" text PRIMARY KEY,
    "owner_id" text NOT NULL,
    "year" integer NOT NULL,
    "month" integer NOT NULL,
    "client_name" text,
    "venda_sistema" numeric DEFAULT 0,
    "custo_sistema" numeric DEFAULT 0,
    "manutencao" numeric DEFAULT 0,
    "lavagem" numeric DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

ALTER TABLE "historical_revenue" DISABLE ROW LEVEL SECURITY;

-- Como redundância extrema para o caso do Supabase forçar a ativação de RLS, criamos políticas totalmente permissivas para todos:
DROP POLICY IF EXISTS "Permitir leitura total para autenticados" ON "historical_revenue";
CREATE POLICY "Permitir leitura total para todos" ON "historical_revenue" AS PERMISSIVE FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Permitir inserção total para autenticados" ON "historical_revenue";
CREATE POLICY "Permitir inserção total para todos" ON "historical_revenue" AS PERMISSIVE FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização total para autenticados" ON "historical_revenue";
CREATE POLICY "Permitir atualização total para todos" ON "historical_revenue" AS PERMISSIVE FOR UPDATE TO public USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir deleção total para autenticados" ON "historical_revenue";
CREATE POLICY "Permitir deleção total para todos" ON "historical_revenue" AS PERMISSIVE FOR DELETE TO public USING (true);

COMMENT ON TABLE "historical_revenue" IS 'Tabela que armazena faturamento histórico retroativo de vendas de sistemas, manutenção e lavagem para relatórios comparativos de anos anteriores.';

-- 8. Adicionar coluna custo_sistema caso a tabela já exista
ALTER TABLE "historical_revenue" ADD COLUMN IF NOT EXISTS "custo_sistema" numeric DEFAULT 0;
COMMENT ON COLUMN "historical_revenue"."custo_sistema" IS 'Armazena o custo total de sistemas do histórico de faturamento retroativo';

ALTER TABLE "historical_revenue" ADD COLUMN IF NOT EXISTS "client_name" text;
COMMENT ON COLUMN "historical_revenue"."client_name" IS 'Armazena o nome do cliente associado ao histórico de faturamento retroativo';


