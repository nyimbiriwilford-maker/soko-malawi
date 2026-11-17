-- Phase A: service reviews hardening. Run in Supabase SQL editor.
begin;

-- 1. Remove old duplicate / over-permissive services policies
drop policy if exists "Authenticated users can post services" on public.services;
drop policy if exists "Anyone can view services" on public.services;
drop policy if exists "Users can delete own services" on public.services;
drop policy if exists "Users can update own services" on public.services;

-- 2. Protect the legacy rating column too (rest of function unchanged)
create or replace function public.protect_service_ranking_fields()
returns trigger language plpgsql as $function$
begin
  if current_user in ('postgres', 'supabase_admin')
     or auth.role() = 'service_role'
     or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.views := 0;
    new.chats_count := 0;
    new.is_featured := false;
    new.rating_avg := null;
    new.rating_count := 0;
    new.completed_count := 0;
    return new;
  end if;
  if current_setting('app.stat_update', true) = 'on' then
    return new;
  end if;
  new.views := old.views;
  new.chats_count := old.chats_count;
  new.is_featured := old.is_featured;
  new.rating_avg := old.rating_avg;
  new.rating_count := old.rating_count;
  new.completed_count := old.completed_count;
  new.rating := old.rating;
  return new;
end;
$function$;

-- 3. Review data rules (new rows only; existing rows are not rejected)
alter table public.reviews drop constraint if exists reviews_rating_range;
alter table public.reviews add constraint reviews_rating_range check (rating between 1 and 5) not valid;
alter table public.reviews drop constraint if exists reviews_comment_len;
alter table public.reviews add constraint reviews_comment_len check (comment is null or char_length(comment) <= 1000) not valid;

-- 4. Insert policy: own review, real provider, not self, must have messaged the provider about this service
drop policy if exists "Authenticated users can insert reviews" on public.reviews;
drop policy if exists reviews_insert_verified on public.reviews;
create policy reviews_insert_verified on public.reviews
  for insert to authenticated
  with check (
    auth.uid() = reviewer_id
    and reviewer_id <> provider_id
    and exists (
      select 1 from public.services s
      where s.id = reviews.service_id and s.provider_id = reviews.provider_id
    )
    and exists (
      select 1 from public.messages m
      where m.service_id = reviews.service_id
        and m.from_user = auth.uid()
        and m.to_user = reviews.provider_id
    )
  );

-- 5. Server-side reviewer name and comment cleanup
create or replace function public.reviews_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  select left(coalesce(nullif(trim(full_name), ''), 'Customer'), 60) into nm
  from public.profiles where id = new.reviewer_id;
  new.reviewer_name := coalesce(nm, 'Customer');
  new.comment := nullif(left(trim(coalesce(new.comment, '')), 1000), '');
  return new;
end;
$$;
drop trigger if exists trg_reviews_before_insert on public.reviews;
create trigger trg_reviews_before_insert before insert on public.reviews
  for each row execute function public.reviews_before_insert();

-- 6. Recalculate rating after every review insert / delete
create or replace function public.recalc_service_rating()
returns trigger language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  sid := case when tg_op = 'DELETE' then old.service_id else new.service_id end;
  perform set_config('app.stat_update', 'on', true);
  update public.services s
     set rating_count = agg.c,
         rating_avg   = agg.a,
         rating       = coalesce(agg.a, 0)
    from (select count(*)::int as c, round(avg(rating)::numeric, 1) as a
            from public.reviews where service_id = sid) agg
   where s.id = sid;
  return null;
end;
$$;
drop trigger if exists trg_recalc_service_rating on public.reviews;
create trigger trg_recalc_service_rating after insert or delete on public.reviews
  for each row execute function public.recalc_service_rating();

-- 7. Backfill existing services that already have reviews
update public.services s
   set rating_count = agg.c, rating_avg = agg.a, rating = coalesce(agg.a, 0)
  from (select service_id, count(*)::int as c, round(avg(rating)::numeric, 1) as a
          from public.reviews group by service_id) agg
 where s.id = agg.service_id;

commit;
