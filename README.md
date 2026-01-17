# Sistema Orner - Instruções de Banco de Dados

Para que a integração com o Supabase funcione totalmente e as configurações não "resetem", você precisa executar o seguinte SQL no **SQL Editor** do seu painel Supabase.

### 5. Lavagem de Placas (Atualização de Schema)

Se você já tem as tabelas e está recebendo erro de "coluna não encontrada", execute estas linhas:

```sql
-- Adiciona colunas de Snapshot e Ciclo de Renovação
ALTER TABLE lavagem_clients ADD COLUMN IF NOT EXISTS contract_wash_qty integer;
ALTER TABLE lavagem_clients ADD COLUMN IF NOT EXISTS contract_price_per_plate decimal(10,2);
ALTER TABLE lavagem_clients ADD COLUMN IF NOT EXISTS package_launch_date timestamp with time zone;

-- Adiciona data de criação aos registros para controle de ciclo
ALTER TABLE lavagem_records ADD COLUMN IF NOT EXISTS created_at timestamp with time zone default now();
```

### Script de Criação Completo (Caso ainda não tenha as tabelas)

```sql
create table if not exists lavagem_packages (
  id text primary key,
  owner_id text references system_users(id),
  name text not null,
  color text default '#6366f1',
  wash_qty integer not null,
  price_per_plate decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

create table if not exists lavagem_clients (
  id text primary key,
  owner_id text references system_users(id),
  package_id text references lavagem_packages(id),
  name text not null,
  cep text,
  address text,
  address_number text,
  complement text,
  city text,
  plates_count integer default 0,
  contract_wash_qty integer, 
  contract_price_per_plate decimal(10,2), 
  package_launch_date timestamp with time zone, 
  created_at timestamp with time zone default now()
);

create table if not exists lavagem_records (
  id text primary key,
  client_id text references lavagem_clients(id) on delete cascade,
  date date not null,
  status text check (status in ('scheduled', 'executed', 'cancelled')),
  notes text,
  created_at timestamp with time zone default now()
);
```