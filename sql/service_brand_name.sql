alter table services add column if not exists brand_name text;
alter table services drop constraint if exists services_brand_name_len;
alter table services add constraint services_brand_name_len check (brand_name is null or char_length(brand_name) <= 60);
