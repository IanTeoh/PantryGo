-- =============================================================================
-- PantryGo: food preferences, the setup flow, and recipe cuisines
-- Run in Supabase → SQL Editor → New query, AFTER 12_account.sql.
--
-- 1. user_preferences: the cuisines you like, how you eat (everything /
--    vegetarian / vegan), and whether you've finished the setup flow.
--    Private: only you can see yours.
--    (Your weight, height and age are NOT stored anywhere. The app only uses
--    them on your phone to suggest calorie goals.)
-- 2. Recipes get a cuisine (Italian, Indian…), so the app can suggest ones you'll like.
-- =============================================================================

-- ---- 1. Your preferences ---------------------------------------------------------
create table public.user_preferences (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cuisines     text[] not null default '{}',
  diet         text not null default 'any' check (diet in ('any', 'vegetarian', 'vegan')),
  onboarded_at timestamptz, -- when you finished (or skipped) the setup flow
  updated_at   timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

create policy "own preferences: read" on public.user_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "own preferences: add" on public.user_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "own preferences: edit" on public.user_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.user_preferences to authenticated;

-- ---- 2. Cuisines on recipes -------------------------------------------------------
alter table public.recipes add column cuisine text check (cuisine is null or length(cuisine) <= 40);
alter table public.community_recipes add column cuisine text check (cuisine is null or length(cuisine) <= 40);

-- Let people set it on recipes they share (the column grants from 09 list each column)
grant insert (cuisine) on public.community_recipes to authenticated;
grant update (cuisine) on public.community_recipes to authenticated;

-- The starter recipes' cuisines
update public.community_recipes set cuisine = c.cuisine
from (values
  ('Weeknight red lentil dal', 'indian'),
  ('Creamy tomato pasta', 'italian'),
  ('Chicken & veggie fried rice', 'chinese'),
  ('Fluffy pancakes', 'american'),
  ('Classic spaghetti bolognese', 'italian'),
  ('Kumara & chickpea curry', 'indian'),
  ('Overnight oats', 'kiwi'),
  ('One-tray honey soy chicken', 'kiwi'),
  ('Banana bread', 'kiwi'),
  ('Shakshuka', 'middle-eastern'),
  ('Tuna pasta bake', 'kiwi'),
  ('Big Greek salad', 'mediterranean')
) as c(title, cuisine)
where community_recipes.title = c.title and community_recipes.author_id is null;

-- Sharing and saving now carry the cuisine across too (same as 09, plus cuisine)
create or replace function public.publish_recipe(p_recipe_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r public.recipes;
  shared public.community_recipes;
  new_id uuid;
begin
  select * into r from public.recipes where id = p_recipe_id for update;
  if r.id is null or not public.is_household_member(r.household_id) then
    raise exception 'Recipe not found';
  end if;

  if r.published_id is not null then
    select * into shared from public.community_recipes where id = r.published_id;
  end if;

  if shared.id is not null then
    if shared.author_id is distinct from auth.uid() then
      raise exception 'Only the person who shared this recipe can update the shared version';
    end if;
    update public.community_recipes
    set title = r.title, description = r.description, servings = r.servings,
        minutes = r.minutes, difficulty = r.difficulty, tags = r.tags, cover = r.cover,
        cuisine = r.cuisine, ingredients = r.ingredients, steps = r.steps, updated_at = now()
    where id = shared.id;
    return shared.id;
  end if;

  insert into public.community_recipes
    (author_id, title, description, servings, minutes, difficulty, tags, cover, cuisine,
     ingredients, steps)
  values
    (auth.uid(), r.title, r.description, r.servings, r.minutes, r.difficulty, r.tags, r.cover,
     r.cuisine, r.ingredients, r.steps)
  returning id into new_id;

  update public.recipes set published_id = new_id where id = r.id;
  return new_id;
end;
$$;

create or replace function public.save_community_recipe(p_recipe_id uuid, p_household_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c public.community_recipes;
  new_id uuid;
  first_save boolean;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;
  select * into c from public.community_recipes
    where id = p_recipe_id and (report_count < 3 or author_id = auth.uid());
  if c.id is null then
    raise exception 'Recipe not found';
  end if;

  insert into public.recipes
    (household_id, title, description, servings, minutes, difficulty, tags, cover, cuisine,
     ingredients, steps, saved_from, created_by)
  values
    (p_household_id, c.title, c.description, c.servings, c.minutes, c.difficulty, c.tags,
     c.cover, c.cuisine, c.ingredients, c.steps, c.id, auth.uid())
  returning id into new_id;

  insert into public.recipe_saves (recipe_id, user_id) values (c.id, auth.uid())
    on conflict do nothing;
  get diagnostics first_save = row_count;
  if first_save then
    update public.community_recipes set save_count = save_count + 1 where id = c.id;
  end if;
  return new_id;
end;
$$;
