-- All avatar I/O goes through profile-access with a verified Firebase UID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('lifemate-avatars','lifemate-avatars',false,524288,array['image/jpeg'])
on conflict(id) do nothing;
-- No client storage.objects policy is added.
