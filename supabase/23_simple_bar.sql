-- PantryGo: the "Simple bar" shape
--
-- New items whose name doesn't suggest a shape (milk → carton, oil → bottle…) now
-- get "plain": just a simple bar on the item page, even with container drawings on.
-- Run once, after 22_personal_recipes.sql.

alter table public.items drop constraint if exists items_container_check;
alter table public.items add constraint items_container_check check (
  container in ('plain', 'bottle', 'carton', 'jar', 'bag', 'box', 'can', 'tub', 'packet', 'countable')
);
