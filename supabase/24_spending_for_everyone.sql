-- PantryGo: anyone in a household can turn split costs on or off
--
-- Before: only the household's owner could. Now any member can, from the
-- household's page (Home → tap the people count). It's still one setting for the
-- whole household: on or off for everyone.
-- Run once, after 23_simple_bar.sql.

create or replace function public.set_spending_enabled(p_household_id uuid, p_enabled boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'You''re not in this household';
  end if;
  update public.households set spending_enabled = p_enabled where id = p_household_id;
end;
$$;
