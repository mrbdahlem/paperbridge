create table if not exists assignments (
  id text primary key,
  title text not null,
  class_label text not null default '',
  page_count integer not null check (page_count > 0),
  qr_mode text not null check (qr_mode in ('generic', 'anonymous')),
  packet_count integer not null default 0 check (packet_count >= 0),
  template_version integer not null default 1 check (template_version > 0),
  owner_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists packets (
  id text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  packet_code text not null,
  mode text not null check (mode in ('generic', 'anonymous')),
  student_id text,
  created_at timestamptz not null default now(),
  unique (assignment_id, packet_code)
);

create table if not exists qr_tokens (
  token text primary key,
  assignment_id text not null references assignments(id) on delete cascade,
  template_version integer not null default 1 check (template_version > 0),
  packet_id text references packets(id) on delete cascade,
  page_number integer not null check (page_number > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (assignment_id, packet_id, page_number)
);

create index if not exists packets_assignment_id_idx
  on packets (assignment_id);

create index if not exists qr_tokens_assignment_id_idx
  on qr_tokens (assignment_id);

create index if not exists qr_tokens_packet_id_idx
  on qr_tokens (packet_id);

create unique index if not exists qr_tokens_generic_assignment_page_idx
  on qr_tokens (assignment_id, page_number)
  where packet_id is null;
