-- =============================================================================
-- PantryGo: "portion" on each log entry
-- Run in Supabase → SQL Editor → New query, AFTER schema.sql and 02_shopping.sql.
--
-- Why: amounts come in different units (ml, g, eggs…), so you can't add them up.
-- A portion is the amount as a fraction of a full pack: using 250 ml of a 1000 ml
-- bottle = 0.25. Portions CAN be added up, which the Impact tab needs
-- ("6.4 packs used, 0.4 thrown out this month").
-- =============================================================================

alter table public.events add column portion numeric;

-- Fill in portions for existing entries, where the item still exists
update public.events e
set portion = round(e.amount / nullif(i.capacity, 0), 3)
from public.items i
where i.id = e.item_id and e.portion is null;

-- log_event gets a new last parameter, so replace it (drop the old version first)
drop function public.log_event(uuid, uuid, text, text, numeric, text);

create function public.log_event(
  p_household_id uuid, p_item_id uuid, p_item_name text,
  p_type text, p_amount numeric, p_unit text, p_portion numeric
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  latest public.events;
begin
  select * into latest
  from public.events
  where household_id = p_household_id
  order by at desc
  limit 1;

  if latest.id is not null
     and latest.item_id = p_item_id
     and latest.type = p_type
     and latest.user_id = auth.uid()
     and latest.at > now() - interval '2 minutes' then
    update public.events
    set amount = round(amount + p_amount, 2),
        portion = round(coalesce(portion, 0) + coalesce(p_portion, 0), 3),
        at = now()
    where id = latest.id;
  else
    insert into public.events (household_id, item_id, item_name, type, amount, unit, user_id, portion)
    values (p_household_id, p_item_id, p_item_name, p_type, round(p_amount, 2), p_unit, auth.uid(),
            round(p_portion, 3));
  end if;
end;
$$;

-- Internal only: the app can't call it directly
revoke execute on function public.log_event(uuid, uuid, text, text, numeric, text, numeric) from public, anon;

-- The four item functions, now passing a portion. Same as before otherwise.
create or replace function public.add_item(
  p_household_id uuid, p_name text, p_quantity numeric, p_capacity numeric,
  p_unit text, p_container text, p_location text, p_expiry date
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

  insert into public.items (household_id, name, quantity, capacity, unit, container, location, expiry, created_by)
  values (p_household_id, trim(p_name), round(p_quantity, 2), round(p_capacity, 2),
          p_unit, p_container, p_location, p_expiry, auth.uid())
  returning id into new_id;

  perform public.log_event(p_household_id, new_id, trim(p_name), 'added', p_quantity, p_unit,
                           p_quantity / nullif(p_capacity, 0));
  return new_id;
end;
$$;

create or replace function public.set_item_quantity(p_item_id uuid, p_quantity numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
  next_quantity numeric := round(greatest(p_quantity, 0), 2);
  change numeric;
begin
  select * into it from public.items where id = p_item_id for update;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;

  change := next_quantity - it.quantity;
  if change = 0 then
    return;
  end if;

  update public.items
  set quantity = next_quantity,
      capacity = greatest(capacity, next_quantity),
      updated_at = now()
  where id = p_item_id;

  perform public.log_event(
    it.household_id, it.id, it.name,
    case when change < 0 then 'used' else 'restocked' end,
    abs(change), it.unit,
    abs(change) / nullif(greatest(it.capacity, next_quantity), 0)
  );
end;
$$;

create or replace function public.discard_item(p_item_id uuid)
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
  if it.quantity = 0 then
    return;
  end if;

  update public.items set quantity = 0, updated_at = now() where id = p_item_id;
  perform public.log_event(it.household_id, it.id, it.name, 'wasted', it.quantity, it.unit,
                           it.quantity / nullif(it.capacity, 0));
end;
$$;

create or replace function public.remove_item(p_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = p_item_id;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;

  perform public.log_event(it.household_id, it.id, it.name, 'removed', it.quantity, it.unit,
                           it.quantity / nullif(it.capacity, 0));
  delete from public.items where id = p_item_id;
end;
$$;
