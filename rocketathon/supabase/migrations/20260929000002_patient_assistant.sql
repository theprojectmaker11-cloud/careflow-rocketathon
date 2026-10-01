-- Aikti patient assistant :: conversational assessment layer
-- Depends on 20260929000001_init.sql (patients, clinical_kb, formulary, facilities)

create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients (id) on delete cascade,
  storage_path  text,
  file_name     text not null,
  mime_type     text not null,
  doc_type      text,                     -- lab_report | imaging_report | prescription | discharge_summary | other
  raw_text      text,
  findings      jsonb not null default '[]'::jsonb,
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);

create index if not exists documents_patient_idx on public.documents (patient_id, created_at desc);

-- ---------------------------------------------------------------- lab reference ranges
create table if not exists public.reference_ranges (
  id            uuid primary key default gen_random_uuid(),
  test_name     text not null,
  unit          text,
  sex           text check (sex is null or sex in ('male','female')),
  age_low       int,
  age_high      int,
  normal_low    numeric(12,2),
  normal_high   numeric(12,2),
  critical_low  numeric(12,2),
  critical_high numeric(12,2),
  note          text,
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);

create index if not exists ref_ranges_test_idx on public.reference_ranges (test_name);

-- ---------------------------------------------------------------- extracted patient lab results
create table if not exists public.lab_results (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients (id) on delete cascade,
  document_id   uuid references public.documents (id) on delete set null,
  test_name     text not null,
  value_raw     text,
  value_num     numeric(14,4),
  unit          text,
  ref_range     text,
  status        text,                     -- normal | high | low | critical_high | critical_low | unknown
  plain_urdu    text,
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);

create index if not exists lab_results_patient_idx on public.lab_results (patient_id, created_at desc);

-- ---------------------------------------------------------------- chat sessions
create table if not exists public.chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid references public.patients (id) on delete cascade,
  language      text not null default 'en',
  channel       text not null default 'web',   -- web | whatsapp
  last_triage   text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- one assessment per assistant turn
create table if not exists public.assessments (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid references public.chat_sessions (id) on delete cascade,
  patient_id            uuid references public.patients (id) on delete cascade,
  question              text not null,
  triage_level          text not null,
  is_emergency          boolean not null default false,
  patient_summary       text not null default '',
  important_findings    text not null default '',
  test_interpretation   text not null default '',
  possible_causes       jsonb not null default '[]'::jsonb,
  medication_safety     jsonb not null default '[]'::jsonb,
  treatment_guidance    text not null default '',
  next_steps            text[] not null default '{}',
  warning_signs         text[] not null default '{}',
  information_needed    text[] not null default '{}',
  confidence            numeric(4,3) not null default 0.5,
  trace_id              text,
  latency_ms            int,
  created_at            timestamptz not null default now()
);

create index if not exists assessments_session_idx on public.assessments (session_id, created_at);
create index if not exists assessments_patient_idx on public.assessments (patient_id, created_at desc);

alter table public.documents        enable row level security;
alter table public.reference_ranges enable row level security;
alter table public.lab_results      enable row level security;
alter table public.chat_sessions    enable row level security;
alter table public.assessments      enable row level security;

-- ---------------------------------------------------------------- vector search: lab reference ranges
create or replace function public.match_reference_ranges(
  query_embedding vector(1536),
  match_test text,
  match_count int default 3
)
returns table (
  id uuid, test_name text, unit text, normal_low numeric, normal_high numeric,
  critical_low numeric, critical_high numeric, note text, similarity float
)
language sql
stable
as $$
  select r.id, r.test_name, r.unit, r.normal_low, r.normal_high,
         r.critical_low, r.critical_high, r.note,
         1 - (r.embedding <=> query_embedding) as similarity
  from public.reference_ranges r
  where r.embedding is not null
    and lower(r.test_name) = lower(match_test)
  order by r.embedding <=> query_embedding
  limit match_count;
$$;

-- ---------------------------------------------------------------- emergency triage audit trail
create table if not exists public.triage_events (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid references public.chat_sessions (id) on delete cascade,
  patient_id    uuid references public.patients (id) on delete cascade,
  level         text not null,
  is_emergency  boolean not null,
  red_flags     text[] not null default '{}',
  advice        text not null,
  trace_id      text,
  created_at    timestamptz not null default now()
);

create index if not exists triage_events_idx on public.triage_events (created_at desc);

alter table public.triage_events enable row level security;
