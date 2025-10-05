-- Create storage bucket for papers
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'papers',
  'papers',
  false,
  52428800, -- 50MB limit
  ARRAY['application/pdf']
);

-- Allow chairpersons to upload papers
CREATE POLICY "Chairpersons can upload papers"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'papers' AND
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'chairperson'
);

-- Allow chairpersons to delete papers
CREATE POLICY "Chairpersons can delete papers"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'papers' AND
  (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'chairperson'
);

-- Allow college admins to download allocated papers
CREATE POLICY "College admins can download allocated papers"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'papers' AND
  (
    (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'chairperson' OR
    (
      (SELECT role FROM public.profiles WHERE user_id = auth.uid()) = 'college_admin' AND
      EXISTS (
        SELECT 1 
        FROM public.allocations a
        JOIN public.allocation_colleges ac ON ac.allocation_id = a.id
        JOIN public.papers p ON p.id = a.paper_id
        JOIN public.profiles prof ON prof.user_id = auth.uid()
        WHERE p.file_path = storage.objects.name
          AND ac.college_id = prof.college_id
          AND a.is_published = true
      )
    )
  )
);