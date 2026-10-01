-- Surface the applicability columns on match_reference_ranges.
--
-- The function filtered an exact test name but returned neither `sex` nor the
-- age window, so a caller asking for "Haemoglobin" got three rows -- male
-- adult, female adult and paediatric -- with no way to tell which one applied.
-- An agent could read the paediatric 11.0-16.0 g/dL range as the answer for a
-- 45 year old. Returning the columns lets the caller pick correctly.
--
-- Postgres refuses to change a function's return type in place (42P13), so the
-- old signature is dropped first. The argument types must be spelled out.
drop function if exists public.match_reference_ranges(vector(1536), text, int);

create or replace function public.match_reference_ranges(
  query_embedding vector(1536),
  match_test text,
  match_count int default 5
)
returns table (
  id uuid, test_name text, unit text, sex text,
  age_low int, age_high int,
  normal_low numeric, normal_high numeric,
  critical_low numeric, critical_high numeric, note text, similarity float
)
language sql
stable
as $$
  select r.id, r.test_name, r.unit, r.sex, r.age_low, r.age_high,
         r.normal_low, r.normal_high,
         r.critical_low, r.critical_high, r.note,
         1 - (r.embedding <=> query_embedding) as similarity
  from public.reference_ranges r
  where r.embedding is not null
    and lower(r.test_name) = lower(match_test)
  order by r.embedding <=> query_embedding
  limit match_count;
$$;
