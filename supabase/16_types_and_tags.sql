-- =============================================================================
-- PantryGo: item types, and your own recipe tags
-- Run in Supabase → SQL Editor → New query, AFTER 15_blocking.sql.
--
-- 1. Item types (Spices & herbs, Meat & seafood…). The app works out each item's
--    type from its name ("smoked paprika" → Spices & herbs). This column is only
--    for when you correct it on the Edit item page. Empty (null) = let the app decide.
-- 2. Recipes can now have tags you type yourself. These limits stop anyone stuffing
--    huge amounts of text into a shared recipe (the app allows 3 of up to 20 letters).
-- =============================================================================

alter table public.items add column category text check (
  category is null or category in
    ('produce', 'bakery', 'meat', 'dairy', 'dry', 'spices', 'sauces', 'snacks', 'drinks',
     'frozen', 'other')
);

create function public.set_item_category(p_item_id uuid, p_category text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = p_item_id for update;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;
  update public.items set category = p_category, updated_at = now() where id = p_item_id;
end;
$$;

revoke execute on function public.set_item_category(uuid, text) from public, anon;
grant execute on function public.set_item_category(uuid, text) to authenticated;

-- ---- 2. Limits on tags ------------------------------------------------------------
alter table public.recipes add constraint recipes_tags_size
  check (cardinality(tags) <= 15 and coalesce(length(array_to_string(tags, '')), 0) <= 300);
alter table public.community_recipes add constraint community_recipes_tags_size
  check (cardinality(tags) <= 15 and coalesce(length(array_to_string(tags, '')), 0) <= 300);
