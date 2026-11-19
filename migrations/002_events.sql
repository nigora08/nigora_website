alter table entries add column if not exists event_date text not null default '';
alter table entries add column if not exists category text not null default '';

create table if not exists categories (
  name text primary key,
  created_at timestamptz not null default now()
);
