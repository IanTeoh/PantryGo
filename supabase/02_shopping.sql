-- =============================================================================
-- PantryGo: shopping list
-- Run this in Supabase → SQL Editor → New query, AFTER schema.sql.
-- =============================================================================

-- One row per thing to buy. Shared by everyone in the household.
create table public.shopping_items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  quantity     numeric check (quantity is null or quantity > 0), -- optional: "2", or blank
  unit         text,                                                -- optional: "L", "pcs"…
  -- If this is to top up something already in the pantry, which item.
  -- Lets "Put away" add to that item instead of creating a new one.
  item_id      uuid references public.items (id) on delete set null,
  done         boolean not null default false, -- ticked off (in the trolley)
  added_by     uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);
create index shopping_items_household_idx on public.shopping_items (household_id);

-- Unlike the pantry, the list isn't part of the activity log, so members can
-- add, tick, edit and remove rows directly. The rules just keep it within the household.
alter table public.shopping_items enable row level security;

create policy "members read list" on public.shopping_items
  for select to authenticated
  using (public.is_household_member(household_id));

create policy "members add to list" on public.shopping_items
  for insert to authenticated
  with check (public.is_household_member(household_id) and added_by = auth.uid());

create policy "members update list" on public.shopping_items
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members remove from list" on public.shopping_items
  for delete to authenticated
  using (public.is_household_member(household_id));

grant select, insert, update, delete on public.shopping_items to authenticated;

-- Live updates, like the pantry
alter publication supabase_realtime add table public.shopping_items;
