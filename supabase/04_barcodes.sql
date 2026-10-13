-- =============================================================================
-- PantryGo: barcodes
-- Run in Supabase → SQL Editor → New query, AFTER 03_portions.sql.
--
-- Each item can remember the barcode it was scanned from. Next time anyone in
-- the household scans that barcode, PantryGo recognises it straight away, even
-- for products the free Open Food Facts database doesn't know.
-- =============================================================================

alter table public.items add column barcode text;
create index items_household_barcode_idx on public.items (household_id, barcode);

-- add_item gets a new last parameter (the barcode), so replace it
drop function public.add_item(uuid, text, numeric, numeric, text, text, text, date);

create function public.add_item(
  p_household_id uuid, p_name text, p_quantity numeric, p_capacity numeric,
  p_unit text, p_container text, p_location text, p_expiry date,
  p_barcode text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.items (household_id, name, quantity, capacity, unit, container, location, expiry, created_by, barcode)
  values (p_household_id, trim(p_name), round(p_quantity, 2), round(p_capacity, 2),
          p_unit, p_container, p_location, p_expiry, auth.uid(), nullif(trim(p_barcode), ''))
  returning id into new_id;

  perform public.log_event(p_household_id, new_id, trim(p_name), 'added', p_quantity, p_unit,
                           p_quantity / nullif(p_capacity, 0));
  return new_id;
end;
$$;

revoke execute on function public.add_item(uuid, text, numeric, numeric, text, text, text, date, text) from public, anon;
grant execute on function public.add_item(uuid, text, numeric, numeric, text, text, text, date, text) to authenticated;
