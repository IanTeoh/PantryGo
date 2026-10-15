-- PantryGo: security fixes from the pre-launch check
--
-- 1. Shared recipes: authors could change their own recipe's report count (bringing
--    back a recipe that reports had hidden) and its save count. Supabase gives
--    signed-in users every column of a new table by default, so the column limits
--    in 09 weren't doing anything. Now only the recipe's content can be written.
-- 2. Signed-out visitors (the "anon" role) get no access to any table at all. The
--    rules already stopped them; this is a second lock on the door.
-- 3. Invite codes: 6 characters from 0–9 and A–F (about 16.7 million codes) could be
--    guessed by trying lots of them. New codes are 8 characters from 32 letters and
--    digits (about a trillion), leaving out ones that look alike (0/O, 1/I). Every
--    household gets a new code: share the new one from the household page.
-- 4. The helper checks used by the spending rules only answer for your own households.
--
-- Install the app update that takes 8-character codes BEFORE running this, or
-- testers on the old version won't be able to type the new codes.
-- Run once, after 24_spending_for_everyone.sql.

-- ---- 1. Shared recipes: content only ------------------------------------------------
revoke insert, update on public.community_recipes from anon, authenticated;
grant insert (title, description, servings, minutes, difficulty, tags, cover, cuisine, photo,
              ingredients, steps)
  on public.community_recipes to authenticated;
grant update (title, description, servings, minutes, difficulty, tags, cover, cuisine, photo,
              ingredients, steps, updated_at)
  on public.community_recipes to authenticated;

-- ---- 2. Nothing for signed-out visitors, and no table-wide extras for anyone --------
revoke all on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
-- …including tables made later from the SQL Editor
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- ---- 3. Stronger invite codes ----------------------------------------------------------
create function public.new_invite_code()
returns text
language plpgsql volatile set search_path = ''
as $$
declare
  letters constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 32, no 0/O or 1/I
  bytes bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex'); -- secure random
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(letters, 1 + (get_byte(bytes, i) % 32), 1);
  end loop;
  return code;
end;
$$;
revoke execute on function public.new_invite_code() from public, anon, authenticated;

alter table public.households alter column invite_code set default public.new_invite_code();
update public.households set invite_code = public.new_invite_code();

-- Joining: ignore spaces, dashes and lower case, so "abcd-2345" works too
create or replace function public.join_household(p_code text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  hh_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select id into hh_id
  from public.households
  where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));

  if hh_id is null then
    raise exception 'No household has that invite code';
  end if;

  insert into public.household_members (household_id, user_id)
  values (hh_id, auth.uid())
  on conflict do nothing; -- already a member: fine

  return hh_id;
end;
$$;

-- ---- 4. Helper checks only answer about your own households ---------------------------
create or replace function public.user_in_household(hh uuid, person uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_household_member(hh) and exists (
    select 1 from public.household_members where household_id = hh and user_id = person
  );
$$;

create or replace function public.all_in_household(hh uuid, people uuid[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  -- (same as before: an empty list counts as "no")
  select public.is_household_member(hh)
    and coalesce(bool_and(public.user_in_household(hh, p)), false)
  from unnest(people) as p;
$$;
