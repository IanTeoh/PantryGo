-- =============================================================================
-- PantryGo: photos on recipes
-- Run in Supabase → SQL Editor → New query, AFTER 13_preferences.sql.
--
-- 1. A storage bucket ("recipe-photos") for the pictures. Each person can only
--    add, replace or delete files in their own folder (named after their user id).
--    Photos are shrunk on the phone first (about 1200 px wide, ~150–300 KB).
-- 2. A `photo` column on recipes and shared recipes: the file's path in the bucket.
--    Saving someone's shared recipe reuses their photo rather than copying it.
--
-- The bucket is "public": anyone with a photo's exact link can open it (the links
-- are long random names nobody can guess). That's how shared recipes show their
-- pictures to everyone. Don't use recipe photos for anything private.
-- =============================================================================

-- ---- 1. The bucket ----------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('recipe-photos', 'recipe-photos', true, 2097152, -- 2 MB at most
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Paths look like  <your user id>/<random id>.jpg
create policy "recipe photos: add to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe photos: replace your own" on storage.objects
  for update to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "recipe photos: delete your own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recipe-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---- 2. The photo columns ------------------------------------------------------------
alter table public.recipes add column photo text check (photo is null or length(photo) <= 200);
alter table public.community_recipes add column photo text check (photo is null or length(photo) <= 200);

grant insert (photo) on public.community_recipes to authenticated;
grant update (photo) on public.community_recipes to authenticated;

-- Sharing and saving carry the photo across too (same as 13, plus photo)
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
