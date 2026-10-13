-- =============================================================================
-- PantryGo: three more container shapes (can, tub and packet)
-- Run in Supabase → SQL Editor → New query, AFTER 18_extras.sql.
-- =============================================================================

alter table public.items drop constraint if exists items_container_check;
alter table public.items add constraint items_container_check check (
  container in ('bottle', 'carton', 'jar', 'bag', 'box', 'can', 'tub', 'packet', 'countable')
);
