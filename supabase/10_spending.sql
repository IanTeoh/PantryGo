-- =============================================================================
-- PantryGo: a clearer spending log, and turning spending on or off
-- Run in Supabase → SQL Editor → New query, AFTER 09_recipe_book.sql.
--
-- 1. Every cost remembers where it came from: a receipt at put-away, an item's
--    price when it was added, or typed in on the Spending page.
-- 2. Each household can turn spending on or off. Only the owner (the person who
--    made the household) can change it.
-- 3. A fix: members could change any column of their household before (even who
--    owns it). Now they can only rename it.
-- =============================================================================

-- ---- 1. Where a cost came from ------------------------------------------------
alter table public.expenses
  add column source text not null default 'manual'
    check (source in ('manual', 'receipt', 'item', 'settlement'));

-- Label the costs you already have, as best we can
update public.expenses set source = 'settlement' where kind = 'settlement';
update public.expenses set source = 'receipt'
  where kind = 'purchase' and description like 'Groceries (%';

-- ---- 2. Spending on or off, per household --------------------------------------
alter table public.households
  add column spending_enabled boolean not null default true;

create function public.set_spending_enabled(p_household_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.households where id = p_household_id and created_by = auth.uid()
  ) then
    raise exception 'Only the household''s owner can turn spending on or off';
  end if;
  update public.households set spending_enabled = p_enabled where id = p_household_id;
end;
$$;

revoke execute on function public.set_spending_enabled(uuid, boolean) from public, anon;
grant execute on function public.set_spending_enabled(uuid, boolean) to authenticated;

-- ---- 3. Members may only rename their household -----------------------------
-- (Column-level grant: the "members rename household" rule still decides WHO,
-- this decides WHICH columns.)
revoke update on public.households from authenticated;
grant update (name) on public.households to authenticated;
