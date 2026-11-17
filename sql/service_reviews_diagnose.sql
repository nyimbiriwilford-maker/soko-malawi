-- Diagnose services reviews.
-- Read-only: SELECT statements only. Do not run automatically.

-- 0) Table existence
select 'reviews' as table_name, to_regclass('public.reviews') as regclass
union all
select 'services' as table_name, to_regclass('public.services') as regclass;

-- 1) Columns for reviews and services
select
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('reviews', 'services')
order by table_name, ordinal_position;

-- 2) RLS enabled / forced on reviews and services
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('reviews', 'services')
  and c.relkind = 'r'
order by c.relname;

-- 3) RLS policies for reviews and services
select
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('reviews', 'services')
order by tablename, policyname;

-- 4) Triggers for reviews and services (information_schema)
select
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
from information_schema.triggers
where event_object_schema = 'public'
  and event_object_table in ('reviews', 'services')
order by event_object_table, trigger_name, event_manipulation;

-- 4b) Trigger details from pg_trigger (catches triggers information_schema may hide)
select
  c.relname as table_name,
  t.tgname as trigger_name,
  pg_get_triggerdef(t.oid) as trigger_definition,
  t.tgenabled as enabled
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('reviews', 'services')
  and not t.tgisinternal
order by c.relname, t.tgname;

-- 5) Constraints for reviews and services (uniqueness, checks, foreign keys)
select
  c.relname as table_name,
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('reviews', 'services')
order by c.relname, con.conname;

-- 6) Indexes for reviews and services
select
  tablename,
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename in ('reviews', 'services')
order by tablename, indexname;

-- 7) Duplicate reviews per service + reviewer (checks whether one-review-per-user is enforced)
-- Commented out by default; uncomment after confirming public.reviews exists.
-- select
--   service_id,
--   reviewer_id,
--   count(*) as review_count,
--   min(created_at) as first_review_at,
--   max(created_at) as last_review_at
-- from public.reviews
-- group by service_id, reviewer_id
-- having count(*) > 1
-- order by review_count desc, last_review_at desc;

-- 8) Services rating columns snapshot (compare stored rating vs review averages)
-- Commented out by default; uncomment after confirming public.reviews exists.
-- select
--   s.id,
--   s.name,
--   s.rating,
--   s.rating_avg,
--   s.rating_count,
--   count(r.id) as live_review_count,
--   round(avg(r.rating)::numeric, 2) as live_review_avg
-- from public.services s
-- left join public.reviews r on r.service_id = s.id
-- group by s.id, s.name, s.rating, s.rating_avg, s.rating_count
-- order by s.created_at desc nulls last
-- limit 50;
