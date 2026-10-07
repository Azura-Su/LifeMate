-- Dedicated private bucket. No anon/authenticated storage policies are added.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lifemate-audio', 'lifemate-audio', false, 52428800,
  array['audio/mpeg','audio/mp4','audio/aac','audio/wav','audio/flac','audio/ogg','audio/aiff','audio/x-caf'])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
