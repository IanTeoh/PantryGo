-- =============================================================================
-- PantryGo: deleting your account
-- Run in Supabase → SQL Editor → New query, AFTER 11_split_with.sql.
--
-- delete_my_account() removes the signed-in person's account and their private
-- data (calorie log, goals, shared recipes, profile, memberships). Shared
-- household things stay for the others: items, the activity log and costs are
-- kept, just no longer linked to a person.
--
-- Households you own:
--   others in it → ownership passes to whoever joined first after you
--   just you     → the household (and its pantry) is deleted too
-- =============================================================================

create function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hh record;
  heir uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  for hh in select id from public.households where created_by = me loop
    select user_id into heir
      from public.household_members
      where household_id = hh.id and user_id <> me
      order by joined_at
      limit 1;

    if heir is null then
      delete from public.households where id = hh.id; -- cascades to its pantry, list, costs…
    else
      update public.households set created_by = heir where id = hh.id;
      update public.household_members set role = 'admin'
        where household_id = hh.id and user_id = heir;
    end if;
  end loop;

  -- Everything else that belongs only to you is removed by "on delete cascade"
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
