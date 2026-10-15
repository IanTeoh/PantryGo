-- PantryGo: profile pictures, and names/photos for Google and Apple sign-ups
--
-- 1. profiles.avatar: your picture. Either a file in the "avatars" bucket
--    ("<your id>/<random>.jpg") or, for Google sign-ups, the photo link Google gave.
--    Housemates see it next to your name.
-- 2. The "avatars" bucket: anyone can view a picture with its exact link (they're
--    long and random); you can only add, replace or remove pictures in your own folder.
-- 3. New accounts: Google and Apple don't send "display_name" like the email sign-up
--    does, so the new-user step also looks for the name (and photo) they do send.
-- Run once, after 26_lock_internal_functions.sql.

alter table public.profiles add column if not exists avatar text
  check (avatar is null or length(avatar) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 1048576, -- 1 MB at most
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: add to your own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: replace your own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete your own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, display_name, avatar)
  values (
    new.id,
    -- email sign-up sends display_name; Google sends full_name / name
    left(coalesce(nullif(trim(meta ->> 'display_name'), ''),
                  nullif(trim(meta ->> 'full_name'), ''),
                  nullif(trim(meta ->> 'name'), ''), ''), 40),
    -- Google's profile photo, if there is one
    nullif(coalesce(meta ->> 'avatar_url', meta ->> 'picture'), '')
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
