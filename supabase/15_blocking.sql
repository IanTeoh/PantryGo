-- =============================================================================
-- PantryGo: blocking people, and hiding recipes you've reported
-- Run in Supabase → SQL Editor → New query, AFTER 14_recipe_photos.sql.
--
-- App stores require apps with shared content to let people report it AND block
-- the person who posted it. After this:
--   - Block someone (from one of their shared recipes) and none of their shared
--     recipes show for you any more. They aren't told.
--   - A recipe you report disappears for you straight away (and, as before, for
--     everyone once 3 people report it).
--   - Unblock any time from Profile → Blocked people.
-- =============================================================================

create table public.user_blocks (
  blocker      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked      uuid not null references auth.users (id) on delete cascade,
  blocked_name text check (blocked_name is null or length(blocked_name) <= 80), -- shown in your list
  created_at   timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);

alter table public.user_blocks enable row level security;
create policy "your blocks: read" on public.user_blocks
  for select to authenticated using (blocker = auth.uid());
create policy "your blocks: add" on public.user_blocks
  for insert to authenticated with check (blocker = auth.uid());
create policy "your blocks: remove" on public.user_blocks
  for delete to authenticated using (blocker = auth.uid());
grant select, insert, delete on public.user_blocks to authenticated;

-- Is this shared recipe hidden for the person asking? (Their blocks and reports are
-- private, so this runs with the owner's rights rather than through the tables' rules.)
create function public.hidden_for_me(p_recipe_id uuid, p_author uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.user_blocks
                 where blocker = auth.uid() and blocked = p_author)
      or exists (select 1 from public.recipe_reports
                 where user_id = auth.uid() and recipe_id = p_recipe_id);
$$;
revoke execute on function public.hidden_for_me(uuid, uuid) from public, anon;
grant execute on function public.hidden_for_me(uuid, uuid) to authenticated;

-- Shared recipes: as before, minus anything hidden for you (your own always show)
drop policy "anyone reads shared recipes" on public.community_recipes;
create policy "anyone reads shared recipes" on public.community_recipes
  for select to authenticated
  using (
    author_id = auth.uid()
    or (report_count < 3 and not public.hidden_for_me(id, author_id))
  );
