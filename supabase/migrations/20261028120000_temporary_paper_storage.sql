-- =====================================================================
-- Temporary paper storage (replaces Google Drive links)
--
-- Paper PDFs are uploaded to the private "papers" storage bucket.
-- Each paper gets an expires_at = end of its last scheduled exam + 7 days,
-- kept up to date by a trigger on allocations. A cleanup edge function
-- (scheduled hourly via pg_cron below) deletes expired files.
-- Papers with no allocation have no expiry and are never auto-deleted.
-- =====================================================================

-- 1. Exam times are stored as local date + time; interpret them in IST.
CREATE OR REPLACE FUNCTION public.exam_ts(_date date, _time time)
RETURNS timestamptz
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (_date + _time) AT TIME ZONE 'Asia/Kolkata'
$$;

-- How long files are kept after the last exam for a paper ends.
CREATE OR REPLACE FUNCTION public.paper_retention()
RETURNS interval
LANGUAGE sql
IMMUTABLE
AS $$ SELECT interval '7 days' $$;

-- 2. Paper file columns
ALTER TABLE public.papers
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT,
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;

-- Google Drive links are now optional (kept only for legacy papers)
ALTER TABLE public.papers ALTER COLUMN google_drive_link DROP NOT NULL;
ALTER TABLE public.papers ALTER COLUMN google_drive_link DROP DEFAULT;
UPDATE public.papers SET google_drive_link = NULL WHERE google_drive_link = '';

CREATE UNIQUE INDEX IF NOT EXISTS papers_file_path_key ON public.papers(file_path) WHERE file_path IS NOT NULL;
CREATE INDEX IF NOT EXISTS papers_expires_at_idx ON public.papers(expires_at) WHERE file_path IS NOT NULL;

-- 3. Keep papers.expires_at in sync with allocations
CREATE OR REPLACE FUNCTION public.refresh_paper_expiry(_paper_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.papers p
  SET expires_at = (
    SELECT max(public.exam_ts(a.exam_date, a.end_time)) + public.paper_retention()
    FROM public.allocations a
    WHERE a.paper_id = p.id
  )
  WHERE p.id = _paper_id
$$;

CREATE OR REPLACE FUNCTION public.allocations_refresh_paper_expiry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    PERFORM public.refresh_paper_expiry(NEW.paper_id);
  END IF;
  IF TG_OP IN ('UPDATE', 'DELETE') AND (TG_OP = 'DELETE' OR OLD.paper_id IS DISTINCT FROM NEW.paper_id) THEN
    PERFORM public.refresh_paper_expiry(OLD.paper_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS allocations_refresh_paper_expiry ON public.allocations;
CREATE TRIGGER allocations_refresh_paper_expiry
AFTER INSERT OR UPDATE OF paper_id, exam_date, end_time OR DELETE ON public.allocations
FOR EACH ROW EXECUTE FUNCTION public.allocations_refresh_paper_expiry();

-- Backfill
SELECT public.refresh_paper_expiry(id) FROM public.papers;

-- 4. Storage bucket (private, PDF only, 50 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('papers', 'papers', false, 52428800, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Storage access rules
-- College admins can read a paper file only for a published allocation to
-- their college, and only during the exam window.
CREATE OR REPLACE FUNCTION public.can_access_paper_file(_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.papers p
    JOIN public.allocations a ON a.paper_id = p.id AND a.is_published = true
    JOIN public.allocation_colleges ac ON ac.allocation_id = a.id
    JOIN public.profiles pr ON pr.user_id = auth.uid() AND pr.college_id = ac.college_id
    WHERE p.file_path = _path
      AND now() BETWEEN public.exam_ts(a.exam_date, a.start_time)
                    AND public.exam_ts(a.exam_date, a.end_time)
  )
$$;

DROP POLICY IF EXISTS "Chairpersons can upload papers" ON storage.objects;
DROP POLICY IF EXISTS "Chairpersons can delete papers" ON storage.objects;
DROP POLICY IF EXISTS "College admins can download allocated papers" ON storage.objects;
DROP POLICY IF EXISTS "Chairperson manages paper files" ON storage.objects;
DROP POLICY IF EXISTS "College admins read papers during exam window" ON storage.objects;

CREATE POLICY "Chairperson manages paper files"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'papers' AND public.check_user_role(auth.uid(), 'chairperson'))
WITH CHECK (bucket_id = 'papers' AND public.check_user_role(auth.uid(), 'chairperson'));

CREATE POLICY "College admins read papers during exam window"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'papers' AND public.can_access_paper_file(name));

-- 6. Allow deleting a college admin without losing download history
ALTER TABLE public.download_logs ALTER COLUMN downloaded_by DROP NOT NULL;
ALTER TABLE public.download_logs DROP CONSTRAINT IF EXISTS download_logs_downloaded_by_fkey;
ALTER TABLE public.download_logs
  ADD CONSTRAINT download_logs_downloaded_by_fkey
  FOREIGN KEY (downloaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 7. Security: never trust a role sent in sign-up metadata. Anyone can call
-- the public sign-up endpoint with arbitrary metadata, so new accounts are
-- always college admins; chairpersons are granted via user_roles only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'User'),
    'college_admin'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'college_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 8. Hourly cleanup of expired files
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-expired-papers') THEN
    PERFORM cron.unschedule('cleanup-expired-papers');
  END IF;
END $$;

SELECT cron.schedule(
  'cleanup-expired-papers',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wjmtfmnrygsxriqdmnmj.supabase.co/functions/v1/cleanup-expired-papers',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
