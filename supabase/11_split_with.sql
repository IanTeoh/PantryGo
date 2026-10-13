-- =============================================================================
-- PantryGo: choose who a cost is split between
-- Run in Supabase → SQL Editor → New query, AFTER 10_spending.sql.
--
-- Each shared cost now lists exactly who it's split between, e.g. milk for
-- you, Tom and Jerry but not Max. If the app doesn't say, it's everyone in the
-- household at that moment, so people who join later aren't charged for
-- things bought before they arrived.
-- =============================================================================

alter table public.expenses add column split_with uuid[];

-- Are all of these people in this household?
create function public.all_in_household(hh uuid, people uuid[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(bool_and(public.user_in_household(hh, p)), false) from unnest(people) as p;
$$;
revoke execute on function public.all_in_household(uuid, uuid[]) from public, anon;
grant execute on function public.all_in_household(uuid, uuid[]) to authenticated;

-- Fill in "everyone, right now" for shared costs that don't say who
create function public.fill_split_with()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.kind = 'purchase' and new.shared and new.split_with is null then
    select array_agg(user_id order by joined_at) into new.split_with
      from public.household_members where household_id = new.household_id;
  end if;
  if new.kind <> 'purchase' or not new.shared then
    new.split_with := null; -- only shared purchases are split
  end if;
  return new;
end;
$$;
revoke execute on function public.fill_split_with() from public, anon, authenticated;

create trigger expenses_fill_split_with
  before insert on public.expenses
  for each row execute function public.fill_split_with();

-- The costs you already have: split between everyone in the household now
-- (that's how they were being worked out until today)
update public.expenses e
set split_with = (
  select array_agg(m.user_id order by m.joined_at)
  from public.household_members m where m.household_id = e.household_id
)
where e.kind = 'purchase' and e.shared and e.split_with is null;

-- Adding a cost: the split may only include people in the household, and can't be empty
drop policy "members add expenses" on public.expenses;
create policy "members add expenses" on public.expenses
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
    and public.user_in_household(household_id, paid_by)
    and (paid_to is null or public.user_in_household(household_id, paid_to))
    and (split_with is null
         or (cardinality(split_with) > 0 and public.all_in_household(household_id, split_with)))
  );
