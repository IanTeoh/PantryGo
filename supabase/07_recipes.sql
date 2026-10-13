-- =============================================================================
-- PantryGo: recipes
-- Run in Supabase → SQL Editor → New query, AFTER 06_budget.sql.
-- =============================================================================

create table public.recipes (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0),
  servings     integer check (servings is null or servings > 0),
  source_url   text, -- where it came from, if anywhere
  -- A list like [{"name": "chicken thighs", "quantity": 500, "unit": "g"}, …]
  -- jsonb stores structured data in one column, instead of a separate table.
  ingredients  jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  steps        text not null default '', -- one step per line
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index recipes_household_idx on public.recipes (household_id);

-- The household's shared recipe book: members can add, edit and delete
alter table public.recipes enable row level security;

create policy "members read recipes" on public.recipes
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "members add recipes" on public.recipes
  for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = auth.uid());
create policy "members edit recipes" on public.recipes
  for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));
create policy "members delete recipes" on public.recipes
  for delete to authenticated
  using (public.is_household_member(household_id));

grant select, insert, update, delete on public.recipes to authenticated;

alter publication supabase_realtime add table public.recipes;
