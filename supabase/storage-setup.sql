-- Run once in Supabase → SQL Editor (after the database schema has been applied).
-- All uploads go through the Next.js server using the service_role key, so NO storage policies are
-- created for anon/authenticated users: they cannot list, read or write anything in `receipts`.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- PRIVATE: customer payment receipts (signed URLs only, 60 seconds)
  ('receipts', 'receipts', false, 4194304, array['image/jpeg','image/png','image/webp','application/pdf']),
  -- PUBLIC READ: product / logo / hero images (re-encoded to WebP by the server)
  ('site-media', 'site-media', true, 4194304, array['image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Defence in depth: make sure the private bucket stays private.
update storage.buckets set public = false where id = 'receipts';
