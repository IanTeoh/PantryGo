-- PantryGo: household pictures
--
-- 1. households.photo: the household's picture. Either a file in the
--    "household-photos" bucket ("<household id>/<random>.jpg") or a ready-made
--    drawing like "art:avocado:mint". Anyone in the household can change it, the
--    same as renaming it.
-- 2. The "household-photos" bucket: anyone can view a picture with its exact link
--    (they're long and random); only members of a household can add, replace or
--    remove pictures in that household's folder.
-- Run once, after 27_avatars_and_social.sql.

alter table public.households add column if not exists photo text
  check (photo is null or length(photo) <= 500);

-- Members could already change the name only; now the picture too
grant update (name, photo) on public.households to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('household-photos', 'household-photos', true, 1048576, -- 1 MB at most
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- "Is the first folder in this file's path one of my households?"
-- (compared as text, so a folder name that isn't an id can't cause an error)
create policy "household photos: add for your households" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'household-photos'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.household_members where user_id = auth.uid()
    )
  );
create policy "household photos: replace for your households" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'household-photos'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.household_members where user_id = auth.uid()
    )
  );
create policy "household photos: remove for your households" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'household-photos'
    and (storage.foldername(name))[1] in (
      select household_id::text from public.household_members where user_id = auth.uid()
    )
  );
