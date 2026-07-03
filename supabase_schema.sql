
-- 
-- Scripts para atualização do Banco de Dados Supabase (Sistema Orner)
-- Execute este SQL no "SQL Editor" para corrigir erros de colunas faltantes.
--

-- 1. Garante que as colunas de faturamento técnico existam na tabela financial_transactions
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS "invoiceSent" boolean DEFAULT false;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS "relatedReportId" text;

-- 2. Índices para performance
CREATE INDEX IF NOT EXISTS idx_financial_invoice_sent ON financial_transactions ("invoiceSent");
CREATE INDEX IF NOT EXISTS idx_financial_related_report ON financial_transactions ("relatedReportId");

-- 3. Comentários para documentação do schema
COMMENT ON COLUMN financial_transactions."invoiceSent" IS 'Indica se o lançamento técnico teve a documentação validada/enviada via RD';
COMMENT ON COLUMN financial_transactions."relatedReportId" IS 'ID do relatório de reembolso/técnico vinculado a esta transação';

-- 4. Adiciona o campo de status de linha em itens de estoque
ALTER TABLE stock_items ADD COLUMN IF NOT EXISTS "lineStatus" text DEFAULT 'Em linha';
COMMENT ON COLUMN stock_items."lineStatus" IS 'Classificação da disponibilidade do item: "Em linha" ou "Fora de Linha"';

-- 5. Cadastra o campo de valor de referência da Nota Fiscal (%) caso não exista
INSERT INTO system_configs (id, value)
VALUES ('tax_value', '6.00')
ON CONFLICT (id) DO NOTHING;

-- 6. Adiciona suporte a planos com valor fixo negociado
ALTER TABLE lavagem_packages ADD COLUMN IF NOT EXISTS "is_negotiated" boolean DEFAULT false;
ALTER TABLE lavagem_clients ADD COLUMN IF NOT EXISTS "is_negotiated" boolean DEFAULT false;
ALTER TABLE lavagem_clients ADD COLUMN IF NOT EXISTS "negotiated_total_value" numeric DEFAULT 0;
COMMENT ON COLUMN lavagem_packages."is_negotiated" IS 'Indica se o plano tem valor total negociado em vez de valor unitário por placa';
COMMENT ON COLUMN lavagem_clients."is_negotiated" IS 'Indica se o vínculo do cliente com o plano foi feito por um valor fixo negociado';
COMMENT ON COLUMN lavagem_clients."negotiated_total_value" IS 'Instância o valor total fechado e acordado com o cliente para o plano';

-- 7. Garante flexibilidade para homologações incompletas (Sem restrições ou campos obrigatórios de arquivos)
-- Remove qualquer possível restrição de validação que exija arquivos na tabela de homologação
ALTER TABLE IF EXISTS homologacao_entries DROP CONSTRAINT IF EXISTS check_files_complete;
ALTER TABLE IF EXISTS homologacao_entries ALTER COLUMN files DROP NOT NULL;
ALTER TABLE IF EXISTS homologacao_entries ALTER COLUMN files SET DEFAULT '{}'::jsonb;
COMMENT ON COLUMN homologacao_entries.files IS 'Armazena a documentação digital (Procuração, Conta de Energia, Documento com Foto e Outros). Pode ser parcialmente preenchido ou vazio.';

-- 8. Tabela de instaladores para cadastro completo e estimativas de deslocamento
CREATE TABLE IF NOT EXISTS "instaladores" (
    "id" text PRIMARY KEY,
    "owner_id" text NOT NULL,
    "nome" text NOT NULL,
    "whatsapp" text,
    "documento" text,
    "cep" text,
    "endereco" text,
    "cidade" text,
    "uf" text,
    "valor_km" numeric DEFAULT 1.50,
    "ativo" boolean DEFAULT true,
    "observacoes" text,
    "created_at" timestamp with time zone DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE "instaladores" IS 'Cadastro completo de parceiros instaladores para cálculo de deslocamentos e custos de frete/viagem';

-- 9. Acompanhamento de etapas e custos estimados para orçamentos aprovados
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "venda_etapas" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "custos_estimados" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "custos_reais" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "orcamentos" ADD COLUMN IF NOT EXISTS "custos_lancados" jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN "orcamentos"."venda_etapas" IS 'Armazena as etapas de acompanhamento da venda flegáveis (Compra Equipamento, Homologação, etc)';
COMMENT ON COLUMN "orcamentos"."custos_estimados" IS 'Armazena valores estimados no orçamento de Homologação, Deslocamento, Pedágio, Adequação, Instalação e Materiais';
COMMENT ON COLUMN "orcamentos"."custos_reais" IS 'Armazena valores reais realizados de Homologação, Deslocamento, Pedágio, Adequação, Instalação, Materiais, Imposto e parâmetros de deslocamento real';
COMMENT ON COLUMN "orcamentos"."custos_lancados" IS 'Armazena o status de quais provisões (deslocamento, pedagio, instalacao, homologacao, imposto, comissao) ja foram lancadas ou desconsideradas na tela de fluxo de caixa';

-- 10. Tabela de manutencoes para chamados de manutenção, reparos e orçamentos avulsos
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

-- Desabilita RLS para gravação direta simplificada
ALTER TABLE "manutencoes" DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "manutencoes" IS 'Tabela que armazena registros de orçamentos e chamados de manutenção e reparos avulsos.';

-- 11. Tabela de histórico faturamento retroativo
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

-- Adicionar colunas adicionais para a tabela purchase_requests (Nota Fiscal)
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "invoiceFile" text;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "invoiceFileName" text;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "invoiceKey" text;
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "invoiceNumber" text;

COMMENT ON COLUMN "purchase_requests"."invoiceFile" IS 'Conteúdo do arquivo da Nota Fiscal anexado (Base64)';
COMMENT ON COLUMN "purchase_requests"."invoiceFileName" IS 'Nome do arquivo de Nota Fiscal anexado';
COMMENT ON COLUMN "purchase_requests"."invoiceKey" IS 'Chave de acesso da Nota Fiscal (44 dígitos)';
COMMENT ON COLUMN "purchase_requests"."invoiceNumber" IS 'Número de identificação da Nota Fiscal';




