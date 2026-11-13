-- App-wide duty allocation settings that do not belong to one exam, such
-- as the chairperson and coordinators printed on every duty letter
-- (key 'contacts'). Entered once and kept even when exams are deleted.

CREATE TABLE IF NOT EXISTS public.duty_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID DEFAULT auth.uid() REFERENCES auth.users(id)
);

ALTER TABLE public.duty_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chairperson manages duty settings" ON public.duty_settings;
CREATE POLICY "Chairperson manages duty settings" ON public.duty_settings
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());

-- Make the API see the new table straight away.
NOTIFY pgrst, 'reload schema';
