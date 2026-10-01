-- Aikti Clinic Scribe :: core schema
-- Run in Supabase SQL editor, or: supabase db push

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------- enum-ish types
-- Postgres has no `create type if not exists`, so the duplicate_object guard
-- has to go through an exception block. Rerunning the file is therefore safe.
do $$ begin
  create type public.encounter_status as enum (
    'draft', 'signed', 'amended'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.severity as enum (
    'info', 'warning', 'critical'
  );
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------- facilities
create table if not exists public.facilities (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  city          text not null,
  kind          text not null default 'medical_center', -- hospital|medical_center|lab|pharmacy
  phone         text,
  free_services text[] not null default '{}',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- patients
create table if not exists public.patients (
  id             uuid primary key default gen_random_uuid(),
  mrn            text unique not null,          -- medical record number, human readable
  full_name      text not null,
  phone          text,
  cnic           text,
  age            int check (age between 0 and 130),
  sex            text check (sex in ('male','female','other')),
  language       text not null default 'ur',    -- ur | en | roman-ur
  allergies      text[] not null default '{}',
  chronic        text[] not null default '{}',  -- e.g. {type 2 diabetes, hypertension}
  current_meds  text[] not null default '{}',  -- free text drug names, feeds the interaction agent
  created_at     timestamptz not null default now()
);

create index if not exists patients_phone_idx on public.patients (phone);
create index if not exists patients_name_trgm on public.patients using gin (full_name gin_trgm_ops);

-- ---------------------------------------------------------------- encounters
create table if not exists public.encounters (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients (id) on delete cascade,
  facility_id    uuid references public.facilities (id) on delete set null,
  doctor_name    text not null,
  encounter_date timestamptz not null default now(),
  chief_complaint text,
  transcript     text,                            -- raw doctor-patient audio transcription
  status         public.encounter_status not null default 'draft',
  trace_id       text,                            -- OpenAI Agents SDK trace for audit
  created_at     timestamptz not null default now()
);

create index if not exists encounters_patient_idx on public.encounters (patient_id, encounter_date desc);

-- ---------------------------------------------------------------- structured clinical note (one per encounter)
create table if not exists public.clinical_notes (
  id            uuid primary key default gen_random_uuid(),
  encounter_id  uuid not null unique references public.encounters (id) on delete cascade,
  subjective    text not null default '',
  objective     text not null default '',
  assessment    text not null default '',
  plan          text not null default '',
  icd_codes     text[] not null default '{}',
  red_flags     text[] not null default '{}',
  urdu_summary  text,                            -- plain-Urdu summary read out to the patient
  model         text not null default '',
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------- prescription
create table if not exists public.prescription_items (
  id             uuid primary key default gen_random_uuid(),
  encounter_id   uuid not null references public.encounters (id) on delete cascade,
  prescribed_name text not null,
  generic_name    text,
  dose            text not null,
  frequency       text not null,
  duration        text,
  route           text,
  substitution_note text,                          -- cheaper in-house generic available
  interaction_severity public.severity not null default 'info',
  interaction_note text,
  created_at      timestamptz not null default now()
);

create index if not exists prescription_encounter_idx on public.prescription_items (encounter_id);

-- ---------------------------------------------------------------- formulary (RAG source of truth)
create table if not exists public.formulary (
  id             uuid primary key default gen_random_uuid(),
  brand_name     text not null,
  generic_name   text not null,
  strength       text not null,
  form           text not null,                   -- tablet | capsule | syrup | injection
  unit_price_pkr numeric(10,2) not null default 0,
  in_stock       boolean not null default true,
  facility_id    uuid references public.facilities (id) on delete set null,
  embedding      vector(1536),
  created_at     timestamptz not null default now()
);

create index if not exists formulary_generic_idx on public.formulary (generic_name);

-- ---------------------------------------------------------------- clinical knowledge base (RAG corpus)
create table if not exists public.clinical_kb (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null,                    -- guideline | protocol | formulary_policy | health_education
  body          text not null,
  source        text,
  language      text not null default 'en',
  embedding     vector(1536),
  created_at    timestamptz not null default now()
);

create index if not exists clinical_kb_category_idx on public.clinical_kb (category);

-- ---------------------------------------------------------------- alert log (drug interactions, critical values)
create table if not exists public.clinical_alerts (
  id            uuid primary key default gen_random_uuid(),
  encounter_id  uuid references public.encounters (id) on delete cascade,
  patient_id    uuid references public.patients (id) on delete cascade,
  severity      public.severity not null,
  alert_type    text not null,                    -- drug_interaction | allergy | duplicate_therapy | red_flag
  message       text not null,
  acknowledged  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists alerts_encounter_idx on public.clinical_alerts (encounter_id);

-- ---------------------------------------------------------------- RLS: open demo mode, tighten before production
alter table public.patients          enable row level security;
alter table public.encounters       enable row level security;
alter table public.clinical_notes    enable row level security;
alter table public.prescription_items enable row level security;
alter table public.clinical_alerts   enable row level security;
alter table public.formulary         enable row level security;
alter table public.clinical_kb       enable row level security;
alter table public.facilities        enable row level security;

-- The API talks to Supabase with the service-role key, so RLS is bypassed there.
-- For any browser client you add later, add a doctor-scoped policy like:
--   create policy "staff read" on public.patients for select to authenticated using (true);

-- ---------------------------------------------------------------- vector search functions
create or replace function public.match_formulary(
  query_embedding vector(1536),
  match_count int default 5,
  min_price numeric default 0
)
returns table (
  id uuid, brand_name text, generic_name text, strength text, form text,
  unit_price_pkr numeric, in_stock boolean, similarity float
)
language sql
stable
as $$
  select f.id, f.brand_name, f.generic_name, f.strength, f.form,
         f.unit_price_pkr, f.in_stock,
         1 - (f.embedding <=> query_embedding) as similarity
  from public.formulary f
  where f.embedding is not null
    and f.in_stock
    and f.unit_price_pkr >= min_price
  order by f.embedding <=> query_embedding
  limit match_count;
$$;

create or replace function public.match_clinical_kb(
  query_embedding vector(1536),
  match_category text default null,
  match_count int default 5
)
returns table (
  id uuid, title text, category text, body text, source text, similarity float
)
language sql
stable
as $$
  select k.id, k.title, k.category, k.body, k.source,
         1 - (k.embedding <=> query_embedding) as similarity
  from public.clinical_kb k
  where k.embedding is not null
    and (match_category is null or k.category = match_category)
  order by k.embedding <=> query_embedding
  limit match_count;
$$;
