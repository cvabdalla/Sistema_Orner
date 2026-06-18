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
