create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists editor (
  id integer primary key,
  password_hash text not null,
  constraint editor_singleton check (id = 1)
);

create table if not exists sessions (
  token_hash text primary key,
  expires_at timestamptz not null
);

create table if not exists images (
  id text primary key,
  mime text not null,
  data bytea not null
);

create table if not exists entries (
  id text primary key,
  section_id text not null,
  title text not null default '',
  body text not null default '',
  link_url text not null default '',
  image_id text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists entries_section_idx on entries (section_id, position, created_at);
