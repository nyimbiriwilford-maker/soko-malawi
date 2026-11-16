-- Diagnose chat popup reply creating a separate chat.
-- Lists last 20 messages with conversation/context identifiers and participant ids
-- so original message and popup reply can be compared. Do not run automatically.

select
  m.id,
  m.created_at,
  m.from_user,
  m.to_user,
  m.chat_source,
  m.listing_id,
  m.service_id,
  m.shop_id,
  m.request_id,
  m.media_type,
  m.read,
  left(m.body, 120) as body_preview
from public.messages m
order by m.created_at desc
limit 20;

-- Compare specific pair (replace :user_a, :user_b as needed):
-- select id, created_at, from_user, to_user, chat_source, listing_id, service_id, shop_id, request_id, media_type, left(body,120) as body_preview
-- from public.messages
-- where (from_user = :user_a and to_user = :user_b) or (from_user = :user_b and to_user = :user_a)
-- order by created_at desc;
