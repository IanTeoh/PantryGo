-- PantryGo: photos for the PantryGo Kitchen starter recipes
--
-- How to use:
--   1. In Supabase → Storage → recipe-photos, make a folder called pantrygo-kitchen
--   2. Upload the photos into it with exactly these names (JPEG, under 2 MB each,
--      ideally landscape around 1200 × 900):
--        dal.jpg               tomato-pasta.jpg       fried-rice.jpg
--        pancakes.jpg          bolognese.jpg          kumara-curry.jpg
--        overnight-oats.jpg    honey-soy-chicken.jpg  banana-bread.jpg
--        shakshuka.jpg         tuna-pasta-bake.jpg    greek-salad.jpg
--   3. Run this file.
--
-- It only links a photo that is actually uploaded, so it's safe to run with some
-- missing and run again later after adding the rest. People who already saved a
-- starter get the photo on their copy too (unless they added their own).

with kitchen (title, file) as (
  values
    ('Weeknight red lentil dal',     'dal.jpg'),
    ('Creamy tomato pasta',          'tomato-pasta.jpg'),
    ('Chicken & veggie fried rice',  'fried-rice.jpg'),
    ('Fluffy pancakes',              'pancakes.jpg'),
    ('Classic spaghetti bolognese',  'bolognese.jpg'),
    ('Kumara & chickpea curry',      'kumara-curry.jpg'),
    ('Overnight oats',               'overnight-oats.jpg'),
    ('One-tray honey soy chicken',   'honey-soy-chicken.jpg'),
    ('Banana bread',                 'banana-bread.jpg'),
    ('Shakshuka',                    'shakshuka.jpg'),
    ('Tuna pasta bake',              'tuna-pasta-bake.jpg'),
    ('Big Greek salad',              'greek-salad.jpg')
),
uploaded as (
  select k.title, 'pantrygo-kitchen/' || k.file as path
  from kitchen k
  where exists (
    select 1 from storage.objects o
    where o.bucket_id = 'recipe-photos' and o.name = 'pantrygo-kitchen/' || k.file
  )
)
update public.community_recipes c
set photo = u.path, updated_at = now()
from uploaded u
where c.author_id is null            -- only PantryGo Kitchen's own recipes
  and c.title = u.title
  and c.photo is distinct from u.path;

-- Saved copies of the starters that don't have a photo of their own yet
update public.recipes r
set photo = c.photo
from public.community_recipes c
where r.saved_from = c.id
  and c.author_id is null
  and c.photo is not null
  and r.photo is null;

-- Which starters have a photo now (so you can check nothing was missed)
select title, coalesce(photo, '— no photo yet —') as photo
from public.community_recipes
where author_id is null
order by title;
