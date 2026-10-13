-- =============================================================================
-- PantryGo: editing an item's details
-- Run in Supabase → SQL Editor → New query, AFTER 04_barcodes.sql.
--
-- Changes the name, unit, shape, location, use-by date and full size.
-- How much is LEFT isn't changed here: that still goes through
-- set_item_quantity, so it's logged. Fixing a typo isn't worth a log entry.
-- =============================================================================

create function public.update_item(
  p_item_id uuid, p_name text, p_unit text, p_container text,
  p_location text, p_expiry date, p_capacity numeric
)
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

  update public.items
  set name = trim(p_name),
      unit = p_unit,
      container = p_container,
      location = p_location,
      expiry = p_expiry,
      -- "Full" can't be less than what's left (you can't have 800 ml in a 500 ml bottle)
      capacity = round(greatest(p_capacity, it.quantity), 2),
      updated_at = now()
  where id = p_item_id;
end;
$$;

revoke execute on function public.update_item(uuid, text, text, text, text, date, numeric) from public, anon;
grant execute on function public.update_item(uuid, text, text, text, text, date, numeric) to authenticated;
