# Sistema Orner - Instruções de Banco de Dados

Para que a integração com o Supabase funcione totalmente e as configurações não "resetem", você precisa executar o seguinte SQL no **SQL Editor** do seu painel Supabase.

```sql
-- 1. Tabelas de Sistema e Usuários
create table if not exists system_users (
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

create table if not exists system_profiles (
  id text primary key,
  name text not null,
  permissions text[]
);

-- 2. Tabela de Configurações Globais (CRITICAL: Corrige o erro de valores resetando)
create table if not exists system_configs (
  id text primary key, -- ex: 'km_value', 'installation_value'
  value text not null,
  updated_at timestamp with time zone default now()
);

-- Insere os valores iniciais obrigatórios
insert into system_configs (id, value) 
values ('km_value', '1.20'), ('installation_value', '120.00')
on conflict (id) do nothing;

-- 3. Financeiro
create table if not exists bank_accounts (
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

create table if not exists financial_transactions (
  id text primary key,
  owner_id text references system_users(id),
  description text not null,
  amount decimal not null,
  type text check (type in ('receita', 'despesa', 'resultado')),
  "dueDate" date not null,
  "paymentDate" date,
  "categoryId" text,
  "bankId" text,
  status text check (status in ('pendente', 'pago', 'cancelado')),
  "launchDate" date,
  "cancelReason" text
);

-- 4. Estoque e Compras
create table if not exists stock_items (
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
  "isFixedInBudget" boolean default true,
  "priceHistory" jsonb default '[]'::jsonb
);

create table if not exists purchase_requests (
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
```