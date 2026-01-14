# Sistema Orner - Instruções de Banco de Dados

Para que a integração com o Supabase funcione totalmente, você precisa executar o seguinte SQL no **SQL Editor** do seu painel Supabase. 

*Nota: Todas as tabelas agora incluem `owner_id` para controle de acesso por usuário.*

```sql
-- 1. Tabelas de Sistema e Usuários
create table system_users (
  id text primary key,
  name text not null,
  email text unique not null,
  password text,
  "profileId" text,
  active boolean default true,
  avatar text,
  "darkMode" boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table system_profiles (
  id text primary key,
  name text not null,
  permissions text[]
);

-- 2. Financeiro
create table bank_accounts (
  id text primary key,
  owner_id text references system_users(id),
  "accountName" text not null,
  "bankName" text not null,
  "bankCode" text,
  agency text,
  "accountNumber" text,
  "initialBalance" decimal default 0,
  "initialBalanceDate" date,
  active boolean default true
);

create table credit_cards (
  id text primary key,
  owner_id text references system_users(id),
  name text not null,
  "lastDigits" text,
  "closingDay" integer,
  "dueDay" integer,
  active boolean default true
);

create table financial_groups (
  id text primary key,
  name text not null,
  type text -- 'receita' ou 'despesa'
);

create table financial_classifications (
  id text primary key,
  name text not null,
  type text
);

create table financial_categories (
  id text primary key,
  name text not null,
  type text check (type in ('receita', 'despesa', 'resultado')),
  classification text,
  "group" text,
  code text,
  "showInDre" boolean default true,
  active boolean default true
);

create table financial_transactions (
  id text primary key,
  owner_id text references system_users(id),
  description text,
  amount decimal not null,
  type text,
  "dueDate" date not null,
  "paymentDate" date,
  "launchDate" date,
  "categoryId" text references financial_categories(id),
  "bankId" text references bank_accounts(id),
  status text check (status in ('pendente', 'pago', 'cancelado')),
  "cancelReason" text
);

-- 3. Orçamentos e Vendas
create table orcamentos (
  id bigint primary key,
  owner_id text references system_users(id),
  status text,
  "savedAt" timestamp with time zone,
  variants jsonb,
  "formState" jsonb,
  calculated jsonb
);

create table sales_summary (
  id bigint primary key,
  "orcamentoId" bigint references orcamentos(id),
  owner_id text references system_users(id),
  "clientName" text,
  date date,
  "closedValue" decimal,
  "systemCost" decimal,
  supplier text,
  "visitaTecnica" decimal,
  homologation decimal,
  installation decimal,
  "travelCost" decimal,
  "adequationCost" decimal,
  "materialCost" decimal,
  "invoicedTax" decimal,
  commission decimal,
  "bankFees" decimal,
  "totalCost" decimal,
  "netProfit" decimal,
  "finalMargin" decimal,
  status text
);

-- 4. Estoque e Suprimentos
create table stock_items (
  id text primary key,
  owner_id text references system_users(id),
  name text not null,
  ncm text,
  quantity decimal default 0,
  "reservedQuantity" decimal default 0,
  "minQuantity" decimal default 0,
  unit text,
  description text,
  image text,
  "averagePrice" decimal default 0,
  "isFixedInBudget" boolean default false,
  "priceHistory" jsonb default '[]'
);

create table stock_movements (
  id text primary key,
  owner_id text references system_users(id),
  "itemId" text references stock_items(id),
  quantity decimal not null,
  type text check (type in ('entrada', 'saida')),
  date timestamp with time zone default now(),
  observation text,
  "projectName" text
);

create table purchase_requests (
  id text primary key,
  owner_id text references system_users(id),
  "itemName" text not null,
  quantity decimal not null,
  unit text,
  requester text,
  date date,
  priority text,
  status text,
  "clientName" text,
  "purchaseLink" text,
  "purchaseType" text,
  observation text,
  "invoiceFile" text,
  "invoiceKey" text
);

-- 5. Reembolsos
create table expense_reports (
  id text primary key,
  owner_id text references system_users(id),
  requester text,
  sector text,
  period text,
  "periodStart" date,
  "periodEnd" date,
  items jsonb,
  attachments jsonb,
  "kmValueUsed" decimal,
  status text,
  "createdAt" timestamp with time zone default now(),
  "totalValue" decimal,
  "cancelReason" text
);

-- 6. Checklists de Obra
-- Nota: Estas tabelas não possuem coluna 'type' pois são divididas por objetivo
create table checklist_checkin (
  id text primary key,
  owner_id text references system_users(id),
  project text,
  responsible text,
  date date,
  status text,
  details jsonb
);

create table checklist_checkout (
  id text primary key,
  owner_id text references system_users(id),
  project text,
  responsible text,
  date date,
  status text,
  details jsonb
);

create table checklist_manutencao (
  id text primary key,
  owner_id text references system_users(id),
  project text,
  responsible text,
  date date,
  status text,
  details jsonb
);

-- 7. Agenda e Instalações
create table activity_catalog (
  id text primary key,
  owner_id text references system_users(id),
  title text not null,
  color text,
  "personalSchedule" boolean default false
);

create table activity_appointments (
  id text primary key,
  owner_id text references system_users(id),
  "activityId" text references activity_catalog(id),
  "clientName" text,
  "startDate" date not null,
  "endDate" date not null,
  "startTime" text,
  "endTime" text,
  "isAllDay" boolean default false,
  cep text,
  address text,
  number text,
  complement text,
  city text,
  "platesCount" integer default 0,
  "panelsConfig" jsonb,
  arrangement text,
  observations text,
  "participantIds" text[],
  "notifyByEmail" boolean default false
);

create table activity_appointments_log (
  id text primary key,
  owner_id text references system_users(id),
  "deletedAt" timestamp with time zone default now(),
  "deletedBy" text,
  "deletedById" text,
  "cancelReason" text,
  "originalAppointment" jsonb
);
```

### Dicas de Segurança (RLS)
Recomenda-se habilitar o **Row Level Security (RLS)** nas tabelas e criar políticas onde `owner_id = auth.uid()` para garantir a privacidade dos dados entre diferentes usuários.

### Habilitar Realtime
Para atualizações em tempo real, habilite o Realtime nas tabelas principais:
```sql
alter publication supabase_realtime add table system_users, orcamentos, checklist_checkin, activity_appointments;
```