-- Banner per-screen image overrides
alter table public.home_banners
  add column if not exists desktop_image_url text;

alter table public.home_banners
  add column if not exists desktop_image_key text;
PY