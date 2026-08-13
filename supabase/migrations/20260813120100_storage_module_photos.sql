-- Private Storage bucket for module photos.
-- Object metadata lives in public.module_photos; binary files live here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'module-photos',
  'module-photos',
  false,
  20971520,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Storage policies will be added with the photo upload MVP.
-- Keep the bucket private until authenticated upload/read rules exist.
