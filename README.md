
# Sistema Orner - Instruções de Banco de Dados

Para que a integração com o Supabase funcione totalmente, você precisa executar o seguinte SQL no **SQL Editor** do seu painel Supabase:

```sql
-- Criar tabela de usuários
create table system_users (
  id text primary key,
  name text not null,
  email text unique not null,
  password text,
  "profileId" text,
  active boolean default true,
  avatar text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Criar tabela de orçamentos
create table orcamentos (
  id bigint primary key,
  owner_id text references system_users(id),
  status text,
  "savedAt" timestamp with time zone,
  variants jsonb,
  "formState" jsonb,
  calculated jsonb
);

-- Criar categorias financeiras
create table financial_categories (
  id text primary key,
  name text not null,
  type text check (type in ('receita', 'despesa'))
);

-- Criar transações financeiras
create table financial_transactions (
  id text primary key,
  owner_id text,
  description text,
  amount decimal,
  type text,
  "dueDate" date,
  "paymentDate" date,
  "categoryId" text references financial_categories(id),
  status text,
  "launchDate" date
);

-- Habilitar Realtime (opcional)
alter publication supabase_realtime add table system_users;
alter publication supabase_realtime add table orcamentos;
```

O sistema agora possui um mecanismo de **Fallback**, então ele funcionará com dados de demonstração até que essas tabelas sejam detectadas.
