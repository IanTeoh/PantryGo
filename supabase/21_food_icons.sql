-- PantryGo: choosing a different drawing for a food
--
-- The app guesses a drawing from an item's name ("Anchor Blue Milk" → milk). When the
-- guess is wrong, anyone in the household can pick another. The pick is remembered
-- by NAME for the whole household, so the next "tofu" you add (or put on the
-- shopping list) gets it too, on everyone's phone.
--
-- name_key is the name in lower case with spaces tidied ("Firm  Tofu" → "firm tofu").
-- art is one of the drawing names in the app (src/data/foodArt.ts).

create table public.food_icons (
  household_id uuid not null references public.households (id) on delete cascade,
  name_key     text not null check (length(name_key) between 1 and 80 and name_key = lower(name_key)),
  art          text not null check (art ~ '^[a-z][a-z-]{0,39}$'),
  set_by       uuid default auth.uid() references auth.users (id) on delete set null,
  updated_at   timestamptz not null default now(),
  primary key (household_id, name_key)
);

alter table public.food_icons enable row level security;

create policy "household food icons: read" on public.food_icons
  for select to authenticated using (public.is_household_member(household_id));
create policy "household food icons: add" on public.food_icons
  for insert to authenticated with check (public.is_household_member(household_id));
create policy "household food icons: change" on public.food_icons
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "household food icons: remove" on public.food_icons
  for delete to authenticated using (public.is_household_member(household_id));

grant select, insert, update, delete on public.food_icons to authenticated;

-- Housemates' phones update straight away when someone changes a drawing
alter publication supabase_realtime add table public.food_icons;
