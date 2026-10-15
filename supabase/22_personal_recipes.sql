-- PantryGo: recipes belong to a person, not a household
--
-- Before: "My recipes" was the household's shared book, so a recipe one housemate
-- made or saved showed up for everyone in the household.
-- Now: each person has their own. It follows them between households, and stays
-- if they leave one (or it's deleted). Cooking still uses whichever household's
-- pantry you're in. Deleting your account deletes your recipes.
--
-- Recipes already made stay with the person who made or saved them.
-- Run once, after 21_food_icons.sql.

-- 1. Remove recipes nobody owns any more (their account was deleted earlier)
delete from public.recipes where created_by is null;

-- 2. Owner always set; the household is just where it was made, and is optional
alter table public.recipes alter column created_by set not null;
alter table public.recipes alter column household_id drop not null;

alter table public.recipes drop constraint recipes_household_id_fkey;
alter table public.recipes add constraint recipes_household_id_fkey
  foreign key (household_id) references public.households (id) on delete set null;

alter table public.recipes drop constraint recipes_created_by_fkey;
alter table public.recipes add constraint recipes_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete cascade;

create index if not exists recipes_created_by_idx on public.recipes (created_by);

-- 3. Only you can see and change your recipes
drop policy "members read recipes" on public.recipes;
drop policy "members add recipes" on public.recipes;
drop policy "members edit recipes" on public.recipes;
drop policy "members delete recipes" on public.recipes;

create policy "own recipes: read" on public.recipes
  for select to authenticated using (created_by = auth.uid());
create policy "own recipes: add" on public.recipes
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (household_id is null or public.is_household_member(household_id))
  );
create policy "own recipes: edit" on public.recipes
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());
create policy "own recipes: delete" on public.recipes
  for delete to authenticated using (created_by = auth.uid());

-- 4. Sharing to Discover: now checks the recipe is yours (same as 14 otherwise)
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
  if r.id is null or r.created_by is distinct from auth.uid() then
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
        cuisine = r.cuisine, photo = r.photo, ingredients = r.ingredients, steps = r.steps, updated_at = now()
    where id = shared.id;
    return shared.id;
  end if;

  insert into public.community_recipes
    (author_id, title, description, servings, minutes, difficulty, tags, cover, cuisine,
     photo, ingredients, steps)
  values
    (auth.uid(), r.title, r.description, r.servings, r.minutes, r.difficulty, r.tags, r.cover,
     r.cuisine, r.photo, r.ingredients, r.steps)
  returning id into new_id;

  update public.recipes set published_id = new_id where id = r.id;
  return new_id;
end;
$$;

create or replace function public.unpublish_recipe(p_recipe_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.recipes;
  deleted integer;
begin
  select * into r from public.recipes where id = p_recipe_id for update;
  if r.id is null or r.created_by is distinct from auth.uid() then
    raise exception 'Recipe not found';
  end if;
  if r.published_id is null then
    return;
  end if;

  delete from public.community_recipes where id = r.published_id and author_id = auth.uid();
  get diagnostics deleted = row_count;
  if deleted = 0 and exists (select 1 from public.community_recipes where id = r.published_id) then
    raise exception 'Only the person who shared this recipe can stop sharing it';
  end if;
  update public.recipes set published_id = null where id = r.id;
end;
$$;

-- 5. Saving from Discover: into your own recipes. The household is optional now.
create or replace function public.save_community_recipe(p_recipe_id uuid, p_household_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  c public.community_recipes;
  new_id uuid;
  first_save boolean;
begin
  if p_household_id is not null and not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;
  select * into c from public.community_recipes
    where id = p_recipe_id and (report_count < 3 or author_id = auth.uid());
  if c.id is null then
    raise exception 'Recipe not found';
  end if;

  insert into public.recipes
    (household_id, title, description, servings, minutes, difficulty, tags, cover, cuisine,
     photo, ingredients, steps, saved_from, created_by)
  values
    (p_household_id, c.title, c.description, c.servings, c.minutes, c.difficulty, c.tags,
     c.cover, c.cuisine, c.photo, c.ingredients, c.steps, c.id, auth.uid())
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
