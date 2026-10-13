-- =============================================================================
-- PantryGo: undoing activity, and saved foods for the calorie tracker
-- Run in Supabase → SQL Editor → New query, AFTER 16_types_and_tags.sql.
--
-- 1. Tap something in Recent activity → Undo. It puts the pantry back the way it was
-- and takes the entry out of the log (so the Impact numbers are right too):
--   used / threw out → the amount goes back into the item
--   restocked        → the amount comes back out
--   added            → the item is taken out of the pantry again
--   removed          → can't be undone (the item's details are gone)
-- Anyone in the household can undo, since everyone shares the pantry.
--
-- 2. Saved foods ("My foods"): things you eat often, like your breakfast shake or a
--    Subway sandwich, saved with their calories so they're one tap to log.
--    Private, like the rest of your calorie tracker.
-- =============================================================================

create function public.undo_event(p_event_id uuid)
returns text -- what happened, for the app to show
language plpgsql security definer set search_path = ''
as $$
declare
  e public.events;
  it public.items;
begin
  select * into e from public.events where id = p_event_id for update;
  if e.id is null or not public.is_household_member(e.household_id) then
    raise exception 'That change isn''t in the log any more (it may already have been undone)';
  end if;
  if e.type = 'removed' then
    raise exception 'A deleted item can''t be brought back. Add it again instead.';
  end if;

  select * into it from public.items where id = e.item_id for update;
  if it.id is null then
    raise exception 'That item has since been deleted, so this can''t be undone';
  end if;

  if e.type in ('used', 'wasted') then
    update public.items
    set quantity = round(it.quantity + e.amount, 2),
        capacity = greatest(it.capacity, round(it.quantity + e.amount, 2)),
        updated_at = now()
    where id = it.id;
  elsif e.type = 'restocked' then
    update public.items
    set quantity = round(greatest(it.quantity - e.amount, 0), 2), updated_at = now()
    where id = it.id;
  elsif e.type = 'added' then
    delete from public.items where id = it.id; -- its other log entries stay, unlinked
  end if;

  delete from public.events where id = e.id;
  return e.type;
end;
$$;

revoke execute on function public.undo_event(uuid) from public, anon;
grant execute on function public.undo_event(uuid) to authenticated;

-- ---- 2. Saved foods ------------------------------------------------------------------
create table public.saved_foods (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null check (length(trim(name)) between 1 and 80),
  serving      text check (serving is null or length(serving) <= 40), -- "1 footlong", "1 glass"
  kcal         numeric not null check (kcal >= 0 and kcal <= 10000),
  protein      numeric check (protein is null or (protein >= 0 and protein <= 1000)),
  carbs        numeric check (carbs is null or (carbs >= 0 and carbs <= 1000)),
  fat          numeric check (fat is null or (fat >= 0 and fat <= 1000)),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now() -- most-used ones first
);
create index saved_foods_user_idx on public.saved_foods (user_id, last_used_at desc);

alter table public.saved_foods enable row level security;
create policy "own saved foods: read" on public.saved_foods
  for select to authenticated using (user_id = auth.uid());
create policy "own saved foods: add" on public.saved_foods
  for insert to authenticated with check (user_id = auth.uid());
create policy "own saved foods: edit" on public.saved_foods
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own saved foods: delete" on public.saved_foods
  for delete to authenticated using (user_id = auth.uid());
grant select, insert, update, delete on public.saved_foods to authenticated;
