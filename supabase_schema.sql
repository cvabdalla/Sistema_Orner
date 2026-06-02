
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
