-- =============================================================================
-- PantryGo database
-- Paste this whole file into Supabase → SQL Editor → New query, then press Run.
-- It's safe to run once on a fresh project.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- One row per person. Created automatically when someone signs up (see section 4).
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- A flat, family or just you. Everyone belongs to at least one.
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  -- 6 characters people type to join, e.g. "4F9A2C"
  invite_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  created_by  uuid not null references auth.users (id),
  created_at  timestamptz not null default now()
);

-- Who is in which household. One row per (household, person) pair.
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  role         text not null default 'member' check (role in ('admin', 'member')),
  joined_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

-- What's in the pantry right now. Matches the Item type in src/types.ts.
create table public.items (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name         text not null check (length(trim(name)) > 0),
  quantity     numeric not null check (quantity >= 0),
  capacity     numeric not null check (capacity >= 0),
  unit         text not null,
  container    text not null check (container in ('bottle', 'carton', 'jar', 'bag', 'box', 'countable')),
  location     text not null check (location in ('pantry', 'fridge', 'freezer')),
  expiry       date,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index items_household_idx on public.items (household_id);

-- The activity log: what happened, to what, by whom, when. Only ever added to.
-- item_id is kept even after an item is deleted (set to null), and item_name keeps the name.
create table public.events (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  item_id      uuid references public.items (id) on delete set null,
  item_name    text not null,
  type         text not null check (type in ('added', 'used', 'restocked', 'wasted', 'removed')),
  amount       numeric not null check (amount >= 0),
  unit         text not null,
  user_id      uuid references auth.users (id) on delete set null,
  at           timestamptz not null default now()
);
create index events_household_at_idx on public.events (household_id, at desc);


-- -----------------------------------------------------------------------------
-- 2. HELPER CHECKS
-- "security definer" lets these look at household_members even though the
-- caller's own row-level rules would hide it. They only ever answer yes/no.
-- -----------------------------------------------------------------------------

-- Is the signed-in person a member of this household?
create function public.is_household_member(hh uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

-- Do I share any household with this other person? (So I can see their name.)
create function public.shares_household_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.user_id = auth.uid() and theirs.user_id = other
  );
$$;


-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY: who can see and change which rows
-- With RLS on, every query is filtered by these rules. No matching rule = no access.
-- -----------------------------------------------------------------------------

alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.items             enable row level security;
alter table public.events            enable row level security;

-- Profiles: see your own and your housemates'; edit only your own.
create policy "read own and housemates' profiles" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.shares_household_with(id));
create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Households: members can see and rename theirs. Creating and joining go
-- through the functions in section 5, so there are no insert rules here.
create policy "members read household" on public.households
  for select to authenticated
  using (public.is_household_member(id));
create policy "members rename household" on public.households
  for update to authenticated
  using (public.is_household_member(id)) with check (public.is_household_member(id));

-- Members: see who's in your households; leave by deleting your own row.
create policy "members read members" on public.household_members
  for select to authenticated
  using (public.is_household_member(household_id));
create policy "leave household" on public.household_members
  for delete to authenticated
  using (user_id = auth.uid());

-- Items: members can read them. Changes go through the functions in section 6,
-- so every change is also written to the activity log.
create policy "members read items" on public.items
  for select to authenticated
  using (public.is_household_member(household_id));

-- Events: members can read their household's log. Nobody can edit or delete it.
create policy "members read events" on public.events
  for select to authenticated
  using (public.is_household_member(household_id));

-- Table permissions for signed-in users (RLS above narrows these down to rows).
grant select, update on public.profiles to authenticated;
grant select, update on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant select on public.items to authenticated;
grant select on public.events to authenticated;


-- -----------------------------------------------------------------------------
-- 4. NEW USER → PROFILE
-- Runs automatically whenever someone signs up.
-- -----------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- -----------------------------------------------------------------------------
-- 5. HOUSEHOLDS: create and join
-- -----------------------------------------------------------------------------

-- Make a new household and add me to it as admin. Returns the new household's id.
create function public.create_household(p_name text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  insert into public.households (name, created_by)
  values (trim(p_name), auth.uid())
  returning id into new_id;

  insert into public.household_members (household_id, user_id, role)
  values (new_id, auth.uid(), 'admin');

  return new_id;
end;
$$;

-- Join a household using its invite code. Returns the household's id.
create function public.join_household(p_code text)
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
  where invite_code = upper(trim(p_code));

  if hh_id is null then
    raise exception 'No household has that invite code';
  end if;

  insert into public.household_members (household_id, user_id)
  values (hh_id, auth.uid())
  on conflict do nothing; -- already a member: fine

  return hh_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- 6. ITEM CHANGES
-- Each function changes the item AND writes to the log in one go, so the two
-- can never disagree. Each checks that you're a member of the item's household.
-- -----------------------------------------------------------------------------

-- Internal: add to the log, merging with my own matching entry from the last
-- 2 minutes (tapping − three times becomes one "used 3" entry).
create function public.log_event(
  p_household_id uuid, p_item_id uuid, p_item_name text,
  p_type text, p_amount numeric, p_unit text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  latest public.events;
begin
  select * into latest
  from public.events
  where household_id = p_household_id
  order by at desc
  limit 1;

  if latest.id is not null
     and latest.item_id = p_item_id
     and latest.type = p_type
     and latest.user_id = auth.uid()
     and latest.at > now() - interval '2 minutes' then
    update public.events
    set amount = round(amount + p_amount, 2), at = now()
    where id = latest.id;
  else
    insert into public.events (household_id, item_id, item_name, type, amount, unit, user_id)
    values (p_household_id, p_item_id, p_item_name, p_type, round(p_amount, 2), p_unit, auth.uid());
  end if;
end;
$$;

-- Add a new item. Returns its id.
create function public.add_item(
  p_household_id uuid, p_name text, p_quantity numeric, p_capacity numeric,
  p_unit text, p_container text, p_location text, p_expiry date
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household';
  end if;

  insert into public.items (household_id, name, quantity, capacity, unit, container, location, expiry, created_by)
  values (p_household_id, trim(p_name), round(p_quantity, 2), round(p_capacity, 2),
          p_unit, p_container, p_location, p_expiry, auth.uid())
  returning id into new_id;

  perform public.log_event(p_household_id, new_id, trim(p_name), 'added', p_quantity, p_unit);
  return new_id;
end;
$$;

-- Set how much is left (dragging the gauge, + / −, "Used it all", "Full").
create function public.set_item_quantity(p_item_id uuid, p_quantity numeric)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
  next_quantity numeric := round(greatest(p_quantity, 0), 2);
  change numeric;
begin
  -- "for update" locks the row, so two people changing it at once take turns
  select * into it from public.items where id = p_item_id for update;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;

  change := next_quantity - it.quantity;
  if change = 0 then
    return; -- nothing changed, nothing to log
  end if;

  update public.items
  set quantity = next_quantity,
      capacity = greatest(capacity, next_quantity), -- topping up past "full" raises "full"
      updated_at = now()
  where id = p_item_id;

  perform public.log_event(
    it.household_id, it.id, it.name,
    case when change < 0 then 'used' else 'restocked' end,
    abs(change), it.unit
  );
end;
$$;

-- "Threw it out": set to 0 and log it as waste.
create function public.discard_item(p_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = p_item_id for update;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;
  if it.quantity = 0 then
    return;
  end if;

  update public.items set quantity = 0, updated_at = now() where id = p_item_id;
  perform public.log_event(it.household_id, it.id, it.name, 'wasted', it.quantity, it.unit);
end;
$$;

-- Delete an item from the list. Its history stays in the log.
create function public.remove_item(p_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  it public.items;
begin
  select * into it from public.items where id = p_item_id;
  if it.id is null or not public.is_household_member(it.household_id) then
    raise exception 'Item not found';
  end if;

  perform public.log_event(it.household_id, it.id, it.name, 'removed', it.quantity, it.unit);
  delete from public.items where id = p_item_id;
end;
$$;

-- Only signed-in users may call the functions the app uses.
revoke execute on all functions in schema public from public, anon;
grant execute on function
  public.create_household(text),
  public.join_household(text),
  public.add_item(uuid, text, numeric, numeric, text, text, text, date),
  public.set_item_quantity(uuid, numeric),
  public.discard_item(uuid),
  public.remove_item(uuid)
to authenticated;
-- The row-level rules call these two, so signed-in users need them too.
grant execute on function
  public.is_household_member(uuid),
  public.shares_household_with(uuid)
to authenticated;


-- -----------------------------------------------------------------------------
-- 7. LIVE UPDATES
-- Tell Supabase Realtime to broadcast changes to these tables, so a flatmate's
-- phone updates the moment you change something.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.items, public.events;
