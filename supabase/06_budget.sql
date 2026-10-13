-- =============================================================================
-- PantryGo: spending and splitting costs
-- Run in Supabase → SQL Editor → New query, AFTER 05_edit_items.sql.
-- =============================================================================

-- Is this person a member of this household? (Like is_household_member, but for any person.)
create function public.user_in_household(hh uuid, person uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = person
  );
$$;
revoke execute on function public.user_in_household(uuid, uuid) from public, anon;
grant execute on function public.user_in_household(uuid, uuid) to authenticated;

-- Money in and out of the household.
--   purchase:   someone paid for something (a shop, toilet paper, the power bill)
--   settlement: one person paid another back ("Sam paid Ian $20")
create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind         text not null default 'purchase' check (kind in ('purchase', 'settlement')),
  description  text not null check (length(trim(description)) > 0),
  amount       numeric not null check (amount > 0), -- NZ dollars
  paid_by      uuid references auth.users (id) on delete set null,
  paid_to      uuid references auth.users (id) on delete set null, -- settlements only
  -- Shared costs are split equally between everyone in the household.
  -- Personal ones (shared = false) count towards your spending, but nobody owes you for them.
  shared       boolean not null default true,
  created_by   uuid default auth.uid() references auth.users (id) on delete set null,
  at           timestamptz not null default now(),
  check (kind <> 'settlement' or paid_to is not null)
);
create index expenses_household_at_idx on public.expenses (household_id, at desc);

alter table public.expenses enable row level security;

create policy "members read expenses" on public.expenses
  for select to authenticated
  using (public.is_household_member(household_id));

-- You can record a payment by anyone in your household (e.g. "Sam paid for the shop"),
-- but only ever as yourself, and only between people actually in the household.
create policy "members add expenses" on public.expenses
  for insert to authenticated
  with check (
    public.is_household_member(household_id)
    and created_by = auth.uid()
    and public.user_in_household(household_id, paid_by)
    and (paid_to is null or public.user_in_household(household_id, paid_to))
  );

-- Undo a mistake: you can delete expenses you entered yourself
create policy "delete own expenses" on public.expenses
  for delete to authenticated
  using (public.is_household_member(household_id) and created_by = auth.uid());

grant select, insert, delete on public.expenses to authenticated;

alter publication supabase_realtime add table public.expenses;
