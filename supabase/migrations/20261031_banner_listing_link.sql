-- Link banners to listings for "Feature on banner"
alter table public.home_banners
  add column if not exists listing_id uuid references public.listings(id) on delete set null;

alter table public.home_banners
  add column if not exists cta_label text;

create index if not exists banners_listing_id_idx
  on public.home_banners (listing_id);
PY