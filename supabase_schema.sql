
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
