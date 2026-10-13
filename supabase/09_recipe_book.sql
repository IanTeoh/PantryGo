-- =============================================================================
-- PantryGo: a nicer recipe book, shared recipes, and starter recipes
-- Run in Supabase → SQL Editor → New query, AFTER 08_nutrition.sql.
--
-- 1. Household recipes get more details: description, time, difficulty, tags, cover.
-- 2. community_recipes: recipes anyone on PantryGo can see and save. Sharing is
--    opt-in, recipe by recipe. Only the person who shared one can change or
--    remove it. Shared copies show the sharer's first name, set by the database
--    (so nobody can pretend to be someone else, or "PantryGo Kitchen").
-- 3. Saving a shared recipe copies it into your household's recipe book.
-- 4. Reporting: 3 reports from different people hides a shared recipe.
-- 5. A dozen starter recipes from "PantryGo Kitchen".
-- =============================================================================

-- ---- 1. More details on household recipes ------------------------------------
alter table public.recipes
  add column description  text check (description is null or length(description) <= 300),
  add column minutes      integer check (minutes is null or minutes between 1 and 1440),
  add column difficulty   text check (difficulty in ('easy', 'medium', 'hard')),
  add column tags         text[] not null default '{}',
  add column cover        text not null default 'sage'
    check (cover in ('sage', 'tomato', 'honey', 'ocean', 'plum', 'sand')),
  add column published_id uuid,   -- this recipe's shared copy, if you shared it
  add column saved_from   uuid;   -- the shared recipe it was saved from, if any

-- ---- 2. Shared recipes ---------------------------------------------------------
create table public.community_recipes (
  id           uuid primary key default gen_random_uuid(),
  -- null = a PantryGo Kitchen starter recipe (nobody can edit those)
  author_id    uuid default auth.uid() references auth.users (id) on delete cascade,
  author_name  text not null default '',
  title        text not null check (length(trim(title)) between 1 and 120),
  description  text check (description is null or length(description) <= 300),
  servings     integer check (servings is null or servings > 0),
  minutes      integer check (minutes is null or minutes between 1 and 1440),
  difficulty   text check (difficulty in ('easy', 'medium', 'hard')),
  tags         text[] not null default '{}',
  cover        text not null default 'sage'
    check (cover in ('sage', 'tomato', 'honey', 'ocean', 'plum', 'sand')),
  ingredients  jsonb not null default '[]'::jsonb check (jsonb_typeof(ingredients) = 'array'),
  steps        text not null default '' check (length(steps) <= 10000),
  save_count   integer not null default 0,
  report_count integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index community_recipes_popular_idx on public.community_recipes (save_count desc);

alter table public.community_recipes enable row level security;

-- Everyone signed in can read them, except ones hidden by reports (you still see your own)
create policy "anyone reads shared recipes" on public.community_recipes
  for select to authenticated
  using (report_count < 3 or author_id = auth.uid());
-- You can only add, change and delete your own
create policy "share your own" on public.community_recipes
  for insert to authenticated with check (author_id = auth.uid());
create policy "edit your own" on public.community_recipes
  for update to authenticated using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "delete your own" on public.community_recipes
  for delete to authenticated using (author_id = auth.uid());

-- Column-level grants: the app can't set author_name, save_count or report_count itself
grant select on public.community_recipes to authenticated;
grant insert (title, description, servings, minutes, difficulty, tags, cover, ingredients, steps)
  on public.community_recipes to authenticated;
grant update (title, description, servings, minutes, difficulty, tags, cover, ingredients, steps, updated_at)
  on public.community_recipes to authenticated;
grant delete on public.community_recipes to authenticated;

-- The author's name comes from their profile: just the first name, for privacy
create function public.set_author_name()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.author_id is not null then
    select coalesce(nullif(split_part(trim(display_name), ' ', 1), ''), 'A PantryGo cook')
      into new.author_name
      from public.profiles where id = new.author_id;
    new.author_name := coalesce(new.author_name, 'A PantryGo cook');
  end if;
  return new;
end;
$$;

create trigger community_recipes_author_name
  before insert or update on public.community_recipes
  for each row execute function public.set_author_name();

-- ---- Sharing a household recipe (and updating the shared copy) ---------------
create function public.publish_recipe(p_recipe_id uuid)
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
    -- Already shared: update it, but only if you're the one who shared it
    if shared.author_id is distinct from auth.uid() then
      raise exception 'Only the person who shared this recipe can update the shared version';
    end if;
    update public.community_recipes
    set title = r.title, description = r.description, servings = r.servings,
        minutes = r.minutes, difficulty = r.difficulty, tags = r.tags, cover = r.cover,
        ingredients = r.ingredients, steps = r.steps, updated_at = now()
    where id = shared.id;
    return shared.id;
  end if;

  insert into public.community_recipes
    (author_id, title, description, servings, minutes, difficulty, tags, cover, ingredients, steps)
  values
    (auth.uid(), r.title, r.description, r.servings, r.minutes, r.difficulty, r.tags, r.cover,
     r.ingredients, r.steps)
  returning id into new_id;

  update public.recipes set published_id = new_id where id = r.id;
  return new_id;
end;
$$;

-- Stop sharing: removes the shared copy (only the person who shared it can)
create function public.unpublish_recipe(p_recipe_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.recipes;
  deleted integer;
begin
  select * into r from public.recipes where id = p_recipe_id for update;
  if r.id is null or not public.is_household_member(r.household_id) then
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

-- ---- 3. Saving a shared recipe into your household ---------------------------
create table public.recipe_saves (
  recipe_id  uuid not null references public.community_recipes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
alter table public.recipe_saves enable row level security;
create policy "see your own saves" on public.recipe_saves
  for select to authenticated using (user_id = auth.uid());
grant select on public.recipe_saves to authenticated;

create function public.save_community_recipe(p_recipe_id uuid, p_household_id uuid)
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
    (household_id, title, description, servings, minutes, difficulty, tags, cover,
     ingredients, steps, saved_from, created_by)
  values
    (p_household_id, c.title, c.description, c.servings, c.minutes, c.difficulty, c.tags,
     c.cover, c.ingredients, c.steps, c.id, auth.uid())
  returning id into new_id;

  -- Count each person once, however many times they save it
  insert into public.recipe_saves (recipe_id, user_id) values (c.id, auth.uid())
    on conflict do nothing;
  get diagnostics first_save = row_count;
  if first_save then
    update public.community_recipes set save_count = save_count + 1 where id = c.id;
  end if;
  return new_id;
end;
$$;

-- ---- 4. Reporting ---------------------------------------------------------------
create table public.recipe_reports (
  recipe_id  uuid not null references public.community_recipes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reason     text check (reason is null or length(reason) <= 200),
  created_at timestamptz not null default now(),
  primary key (recipe_id, user_id)
);
alter table public.recipe_reports enable row level security;
-- No select/insert grants: reports only go in through report_recipe below

create function public.report_recipe(p_recipe_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  c public.community_recipes;
  counted boolean;
begin
  select * into c from public.community_recipes where id = p_recipe_id;
  if c.id is null then
    raise exception 'Recipe not found';
  end if;
  if c.author_id = auth.uid() then
    raise exception 'You can''t report your own recipe';
  end if;
  insert into public.recipe_reports (recipe_id, user_id, reason)
    values (c.id, auth.uid(), left(p_reason, 200))
    on conflict do nothing;
  get diagnostics counted = row_count;
  if counted then
    update public.community_recipes set report_count = report_count + 1 where id = c.id;
  end if;
end;
$$;

revoke execute on function public.publish_recipe(uuid) from public, anon;
revoke execute on function public.unpublish_recipe(uuid) from public, anon;
revoke execute on function public.save_community_recipe(uuid, uuid) from public, anon;
revoke execute on function public.report_recipe(uuid, text) from public, anon;
revoke execute on function public.set_author_name() from public, anon, authenticated;
grant execute on function public.publish_recipe(uuid) to authenticated;
grant execute on function public.unpublish_recipe(uuid) to authenticated;
grant execute on function public.save_community_recipe(uuid, uuid) to authenticated;
grant execute on function public.report_recipe(uuid, text) to authenticated;

-- ---- 5. Starter recipes from PantryGo Kitchen ------------------------------------
-- author_id is null, so the trigger leaves the name alone and nobody can edit them.
insert into public.community_recipes
  (author_id, author_name, title, description, servings, minutes, difficulty, tags, cover, ingredients, steps)
values
(null, 'PantryGo Kitchen', 'Weeknight red lentil dal',
 'Creamy, gently spiced and made almost entirely from the cupboard. Even better the next day.',
 4, 35, 'easy', '{vegetarian,budget,dinner}', 'honey',
 '[{"name":"red lentils","quantity":1,"unit":"cup"},{"name":"onion","quantity":1,"unit":null},{"name":"garlic","quantity":2,"unit":"clove"},{"name":"curry powder","quantity":1,"unit":"tbsp"},{"name":"canned tomatoes","quantity":400,"unit":"g"},{"name":"coconut milk","quantity":400,"unit":"ml"},{"name":"vegetable oil","quantity":1,"unit":"tbsp"},{"name":"salt","quantity":null,"unit":null}]',
 E'Rinse the lentils in a sieve until the water runs clear.\nFinely chop the onion and garlic. Fry in the oil over a medium heat for 5 minutes until soft.\nStir in the curry powder and cook for 1 minute until fragrant.\nAdd the lentils, tomatoes, coconut milk and 2 cups of water. Bring to a simmer.\nCook for 20–25 minutes, stirring now and then, until the lentils are soft and creamy. Add a splash of water if it gets too thick.\nSeason with salt and serve with rice or flatbread.'),

(null, 'PantryGo Kitchen', 'Creamy tomato pasta',
 'A silky, garlicky tomato sauce that''s ready in the time it takes to boil the pasta.',
 2, 20, 'easy', '{quick,vegetarian,dinner}', 'tomato',
 '[{"name":"pasta","quantity":200,"unit":"g"},{"name":"olive oil","quantity":1,"unit":"tbsp"},{"name":"garlic","quantity":2,"unit":"clove"},{"name":"canned tomatoes","quantity":400,"unit":"g"},{"name":"cream","quantity":100,"unit":"ml"},{"name":"parmesan","quantity":30,"unit":"g"},{"name":"salt","quantity":null,"unit":null},{"name":"pepper","quantity":null,"unit":null}]',
 E'Cook the pasta in a big pot of well-salted boiling water until just tender. Save a mug of the pasta water before draining.\nMeanwhile, gently fry the sliced garlic in the oil for 1 minute without letting it brown.\nAdd the tomatoes and simmer for 8–10 minutes, squashing them with a spoon.\nStir in the cream and most of the parmesan, then season.\nToss the pasta through the sauce, loosening with a little pasta water. Serve with the rest of the parmesan.'),

(null, 'PantryGo Kitchen', 'Chicken & veggie fried rice',
 'The best use for yesterday''s rice. Swap in whatever veg needs using up.',
 2, 20, 'easy', '{quick,dinner,use-it-up}', 'sand',
 '[{"name":"cooked rice","quantity":2,"unit":"cup"},{"name":"chicken breast","quantity":200,"unit":"g"},{"name":"eggs","quantity":2,"unit":null},{"name":"frozen peas","quantity":1,"unit":"cup"},{"name":"carrot","quantity":1,"unit":null},{"name":"soy sauce","quantity":2,"unit":"tbsp"},{"name":"vegetable oil","quantity":1,"unit":"tbsp"},{"name":"spring onions","quantity":2,"unit":null}]',
 E'Cut the chicken into small pieces and dice the carrot.\nHeat half the oil in a large pan or wok over a high heat. Cook the chicken for 5 minutes until golden, then tip onto a plate.\nAdd the rest of the oil, then the carrot and peas. Stir-fry for 2 minutes.\nPush everything to one side, crack in the eggs and scramble them.\nAdd the rice and chicken, breaking up any clumps, and fry for 3–4 minutes until piping hot.\nStir through the soy sauce and sliced spring onions.'),

(null, 'PantryGo Kitchen', 'Fluffy pancakes',
 'Thick, soft weekend pancakes. Top with banana, berries, yoghurt or maple syrup.',
 4, 25, 'easy', '{breakfast,baking}', 'honey',
 '[{"name":"plain flour","quantity":1.5,"unit":"cup"},{"name":"baking powder","quantity":2,"unit":"tsp"},{"name":"sugar","quantity":1,"unit":"tbsp"},{"name":"egg","quantity":1,"unit":null},{"name":"milk","quantity":1.25,"unit":"cup"},{"name":"butter","quantity":2,"unit":"tbsp"},{"name":"salt","quantity":null,"unit":null}]',
 E'Melt the butter and let it cool a little.\nMix the flour, baking powder, sugar and a pinch of salt in a bowl.\nWhisk the egg, milk and melted butter together, then pour into the dry ingredients. Stir until just combined: a few lumps are fine.\nHeat a non-stick pan over a medium heat. Pour in ¼ cup of batter per pancake.\nCook until bubbles appear on top, about 2 minutes, then flip and cook 1 minute more.'),

(null, 'PantryGo Kitchen', 'Classic spaghetti bolognese',
 'A rich, slow-simmered meat sauce. Make a double batch: it freezes beautifully.',
 4, 60, 'easy', '{dinner,freezer-friendly}', 'tomato',
 '[{"name":"beef mince","quantity":500,"unit":"g"},{"name":"onion","quantity":1,"unit":null},{"name":"carrot","quantity":1,"unit":null},{"name":"garlic","quantity":2,"unit":"clove"},{"name":"canned tomatoes","quantity":800,"unit":"g"},{"name":"tomato paste","quantity":2,"unit":"tbsp"},{"name":"dried oregano","quantity":1,"unit":"tsp"},{"name":"spaghetti","quantity":400,"unit":"g"},{"name":"olive oil","quantity":1,"unit":"tbsp"},{"name":"salt","quantity":null,"unit":null},{"name":"pepper","quantity":null,"unit":null}]',
 E'Finely chop the onion, carrot and garlic.\nFry them in the oil over a medium heat for 8 minutes until soft.\nTurn up the heat, add the mince and brown it well, breaking it up as it cooks.\nStir in the tomato paste and oregano, then the canned tomatoes and ½ cup of water.\nSimmer gently, partly covered, for 30–40 minutes until thick. Season well.\nCook the spaghetti, drain, and serve with the sauce.'),

(null, 'PantryGo Kitchen', 'Kumara & chickpea curry',
 'Sweet kumara, chickpeas and spinach in a fragrant coconut sauce. Vegan and very filling.',
 4, 35, 'easy', '{vegetarian,vegan,budget,dinner}', 'honey',
 '[{"name":"kumara","quantity":2,"unit":null},{"name":"chickpeas","quantity":400,"unit":"g"},{"name":"onion","quantity":1,"unit":null},{"name":"curry paste","quantity":2,"unit":"tbsp"},{"name":"coconut milk","quantity":400,"unit":"ml"},{"name":"spinach","quantity":2,"unit":"cup"},{"name":"vegetable oil","quantity":1,"unit":"tbsp"}]',
 E'Peel the kumara and cut into 2 cm cubes. Chop the onion. Drain and rinse the chickpeas.\nFry the onion in the oil for 5 minutes, then stir in the curry paste for 1 minute.\nAdd the kumara, coconut milk and ½ cup of water. Simmer for 15 minutes until the kumara is tender.\nStir in the chickpeas and cook for 5 minutes more.\nWilt in the spinach just before serving. Great with rice or naan.'),

(null, 'PantryGo Kitchen', 'Overnight oats',
 'Five minutes the night before, breakfast sorted. No cooking at all.',
 1, 5, 'easy', '{breakfast,quick,no-cook,vegetarian}', 'plum',
 '[{"name":"rolled oats","quantity":0.5,"unit":"cup"},{"name":"milk","quantity":0.5,"unit":"cup"},{"name":"greek yoghurt","quantity":0.25,"unit":"cup"},{"name":"honey","quantity":1,"unit":"tbsp"},{"name":"blueberries","quantity":0.5,"unit":"cup"}]',
 E'Stir the oats, milk, yoghurt and honey together in a jar or container.\nTop with the blueberries, cover, and put in the fridge overnight.\nIn the morning, give it a stir and add a splash more milk if you like it looser.'),

(null, 'PantryGo Kitchen', 'One-tray honey soy chicken',
 'Sticky, savoury chicken thighs roasted on one tray with potatoes and broccoli. Hardly any dishes.',
 4, 50, 'easy', '{dinner}', 'sand',
 '[{"name":"chicken thighs","quantity":800,"unit":"g"},{"name":"soy sauce","quantity":3,"unit":"tbsp"},{"name":"honey","quantity":2,"unit":"tbsp"},{"name":"garlic","quantity":2,"unit":"clove"},{"name":"potatoes","quantity":3,"unit":null},{"name":"broccoli","quantity":1,"unit":null},{"name":"olive oil","quantity":1,"unit":"tbsp"}]',
 E'Heat the oven to 200°C. Cut the potatoes into chunks and toss on a big tray with the oil. Roast for 15 minutes.\nMix the soy sauce, honey and crushed garlic. Toss the chicken in it.\nAdd the chicken to the tray and pour over any leftover sauce. Roast for 20 minutes.\nAdd the broccoli, cut into florets, and roast for 10 minutes more until the chicken is cooked through and sticky.'),

(null, 'PantryGo Kitchen', 'Banana bread',
 'The classic way to rescue brown bananas. Moist, golden and easy to slice.',
 10, 70, 'easy', '{baking,use-it-up,vegetarian}', 'honey',
 '[{"name":"bananas","quantity":3,"unit":null},{"name":"butter","quantity":100,"unit":"g"},{"name":"sugar","quantity":0.75,"unit":"cup"},{"name":"egg","quantity":1,"unit":null},{"name":"plain flour","quantity":1.5,"unit":"cup"},{"name":"baking soda","quantity":1,"unit":"tsp"},{"name":"salt","quantity":null,"unit":null}]',
 E'Heat the oven to 175°C and line a loaf tin with baking paper.\nMelt the butter. Mash the bananas well in a large bowl.\nMix in the butter, sugar and egg.\nSprinkle over the baking soda and a pinch of salt, then fold in the flour until just combined.\nPour into the tin and bake for 55–60 minutes, until a skewer comes out clean.\nCool in the tin for 10 minutes before turning out.'),

(null, 'PantryGo Kitchen', 'Shakshuka',
 'Eggs gently poached in a smoky, spiced tomato and capsicum sauce. Bring bread for dipping.',
 2, 30, 'medium', '{vegetarian,breakfast,dinner}', 'tomato',
 '[{"name":"onion","quantity":1,"unit":null},{"name":"capsicum","quantity":1,"unit":null},{"name":"garlic","quantity":2,"unit":"clove"},{"name":"ground cumin","quantity":1,"unit":"tsp"},{"name":"smoked paprika","quantity":1,"unit":"tsp"},{"name":"canned tomatoes","quantity":400,"unit":"g"},{"name":"eggs","quantity":4,"unit":null},{"name":"feta","quantity":50,"unit":"g"},{"name":"olive oil","quantity":1,"unit":"tbsp"},{"name":"bread","quantity":null,"unit":null}]',
 E'Slice the onion and capsicum. Fry in the oil in a wide pan for 8 minutes until soft.\nAdd the garlic, cumin and paprika and cook for 1 minute.\nPour in the tomatoes and simmer for 10 minutes until thickened. Season.\nMake 4 hollows in the sauce and crack an egg into each.\nCover and cook on a low heat for 6–8 minutes, until the whites are set but the yolks are still runny.\nCrumble over the feta and serve straight from the pan with bread.'),

(null, 'PantryGo Kitchen', 'Tuna pasta bake',
 'A cheesy, comforting bake from tins and the freezer. A flatting favourite for a reason.',
 4, 40, 'easy', '{budget,dinner,freezer-friendly}', 'ocean',
 '[{"name":"pasta","quantity":400,"unit":"g"},{"name":"tuna","quantity":2,"unit":"can"},{"name":"frozen peas","quantity":1,"unit":"cup"},{"name":"butter","quantity":2,"unit":"tbsp"},{"name":"plain flour","quantity":2,"unit":"tbsp"},{"name":"milk","quantity":2,"unit":"cup"},{"name":"cheese","quantity":1,"unit":"cup"}]',
 E'Heat the oven to 200°C. Cook the pasta until just tender, adding the peas for the last 2 minutes. Drain.\nMelt the butter in a pot, stir in the flour and cook for 1 minute.\nWhisk in the milk a little at a time, then stir until thick and smooth. Take off the heat and stir in half the cheese.\nMix the sauce with the pasta, peas and drained tuna. Season.\nTip into a baking dish, top with the rest of the cheese and bake for 15–20 minutes until golden.'),

(null, 'PantryGo Kitchen', 'Big Greek salad',
 'Crunchy, salty and fresh. A no-cook lunch, or a side for anything off the barbecue.',
 2, 10, 'easy', '{quick,vegetarian,no-cook}', 'ocean',
 '[{"name":"tomatoes","quantity":2,"unit":null},{"name":"cucumber","quantity":1,"unit":null},{"name":"red onion","quantity":0.5,"unit":null},{"name":"capsicum","quantity":1,"unit":null},{"name":"feta","quantity":100,"unit":"g"},{"name":"olive oil","quantity":2,"unit":"tbsp"},{"name":"lemon","quantity":0.5,"unit":null},{"name":"salt","quantity":null,"unit":null}]',
 E'Cut the tomatoes, cucumber and capsicum into chunks. Thinly slice the red onion.\nPut everything in a bowl and season with salt.\nDrizzle with the olive oil and a squeeze of lemon, and toss.\nTop with the feta in one big piece or crumbled.');
