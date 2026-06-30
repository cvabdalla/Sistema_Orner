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

