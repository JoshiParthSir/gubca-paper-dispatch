-- Drop storage policy that depends on file_path
DROP POLICY IF EXISTS "College admins can download allocated papers" ON storage.objects;

-- Remove file_path and file_size columns and add google_drive_link
ALTER TABLE public.papers 
  DROP COLUMN IF EXISTS file_path,
  DROP COLUMN IF EXISTS file_size,
  ADD COLUMN IF NOT EXISTS google_drive_link TEXT NOT NULL DEFAULT '';