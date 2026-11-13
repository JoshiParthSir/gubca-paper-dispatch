-- =====================================================================
-- Duty Allocation (practical examiner duties)
--
-- One duty_session per exam cycle. The chairperson imports the Google
-- Form responses (colleges + faculty) and the practical timetable,
-- allocates examiners, edits and finalises one letter per examiner, then
-- publishes the session.
--
-- Access
--   chairperson   : everything.
--   college_admin : read only, and only after the session is published:
--                   duties of their own college's faculty, the examiners
--                   coming to their college as a centre, and the finalised
--                   letters of their own faculty. PDFs are rendered in the
--                   browser from the stored letter content.
--
-- Cancellations: a cancelled duty keeps its row (status = 'cancelled',
-- replaced_by -> the new duty). Normal views read only active rows; the
-- full history is shown only in the chairperson's Cancellations view.
-- =====================================================================

-- 1. Sessions ---------------------------------------------------------
CREATE TABLE public.duty_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  semester_label  TEXT,                 -- e.g. "Semester V" (auto-filled, editable)
  exam_month      TEXT,                 -- e.g. "November - 2026"
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  rules           JSONB NOT NULL DEFAULT '{}'::jsonb,   -- thresholds, max duties, block list
  letter_settings JSONB NOT NULL DEFAULT '{}'::jsonb,   -- template, chairperson, coordinator, bill date, rate
  published_at    TIMESTAMPTZ,
  created_by      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Subjects (from form headers + timetable) --------------------------
CREATE TABLE public.duty_subjects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  code          TEXT NOT NULL,          -- normalised, e.g. "DSC-C-BCA-353P"
  name          TEXT NOT NULL,
  is_practical  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (session_id, code)
);

-- 3. College responses (one row per college per session) ---------------
CREATE TABLE public.duty_college_data (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  college_id    UUID REFERENCES public.colleges(id) ON DELETE SET NULL,  -- linked by the chairperson
  code          TEXT NOT NULL,          -- cleaned code from the form, e.g. "NGCCA"
  raw_name      TEXT NOT NULL,          -- exactly as typed in the form
  full_name     TEXT,                   -- used in letters
  students      INTEGER,
  pcs           INTEGER,
  email         TEXT,
  submitted_at  TIMESTAMPTZ,
  UNIQUE (session_id, code)
);
CREATE INDEX duty_college_data_college_idx ON public.duty_college_data (college_id);

-- 4. Faculty (ALL faculty from the form are kept as the backup pool) ---
CREATE TABLE public.duty_faculty (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  college_data_id  UUID NOT NULL REFERENCES public.duty_college_data(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,       -- cleaned display name, without title
  name_key         TEXT NOT NULL,       -- lower-case key used to merge duplicates
  title            TEXT NOT NULL DEFAULT 'Prof.',
  is_senior        BOOLEAN NOT NULL DEFAULT false,
  is_visiting      BOOLEAN NOT NULL DEFAULT false,
  is_available     BOOLEAN NOT NULL DEFAULT true,  -- chairperson can exclude someone
  subject_codes    TEXT[] NOT NULL DEFAULT '{}',   -- every subject they handle, theory or practical
  phone            TEXT,
  email            TEXT,
  UNIQUE (session_id, college_data_id, name_key)
);

-- 5. Timetable: one row per batch ---------------------------------------
CREATE TABLE public.duty_timetable (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  exam_date     DATE NOT NULL,
  centre_id     UUID NOT NULL REFERENCES public.duty_college_data(id) ON DELETE CASCADE,
  subject_code  TEXT NOT NULL,
  batch         TEXT,
  seat_from     TEXT,
  seat_to       TEXT,
  students      INTEGER
);
CREATE INDEX duty_timetable_session_idx ON public.duty_timetable (session_id, exam_date, centre_id);

-- 6. Assignments ----------------------------------------------------------
CREATE TABLE public.duty_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  exam_date      DATE NOT NULL,
  centre_id      UUID NOT NULL REFERENCES public.duty_college_data(id) ON DELETE CASCADE,
  subject_code   TEXT NOT NULL,
  faculty_id     UUID NOT NULL REFERENCES public.duty_faculty(id) ON DELETE CASCADE,
  seat_role      TEXT NOT NULL CHECK (seat_role IN ('senior', 'junior')),
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancel_reason  TEXT,
  cancelled_at   TIMESTAMPTZ,
  cancelled_by   UUID REFERENCES auth.users(id),
  replaced_by    UUID REFERENCES public.duty_assignments(id) ON DELETE SET NULL,
  created_by     UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
);
-- An examiner can hold only one active duty per day.
CREATE UNIQUE INDEX duty_assignments_one_per_day
  ON public.duty_assignments (session_id, faculty_id, exam_date)
  WHERE status = 'active';
CREATE INDEX duty_assignments_centre_idx ON public.duty_assignments (session_id, centre_id);

-- 7. Letters: frozen, hand-editable content per examiner -----------------
CREATE TABLE public.duty_letters (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  faculty_id    UUID NOT NULL REFERENCES public.duty_faculty(id) ON DELETE CASCADE,
  content       JSONB NOT NULL,         -- the letter exactly as it will print
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finalised_at  TIMESTAMPTZ,
  finalised_by  UUID REFERENCES auth.users(id),
  UNIQUE (session_id, faculty_id)
);

-- 8. Triggers ------------------------------------------------------------
CREATE TRIGGER update_duty_sessions_updated_at
  BEFORE UPDATE ON public.duty_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_duty_letters_updated_at
  BEFORE UPDATE ON public.duty_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- A finalised letter is never rewritten. To change it the chairperson must
-- first un-finalise it (set finalised_at to NULL) in a separate update.
CREATE OR REPLACE FUNCTION public.duty_protect_finalised_letter()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.finalised_at IS NOT NULL
     AND NEW.finalised_at IS NOT NULL
     AND NEW.content IS DISTINCT FROM OLD.content THEN
    RAISE EXCEPTION 'This letter is finalised. Un-finalise it before editing.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER duty_protect_finalised_letter
  BEFORE UPDATE ON public.duty_letters
  FOR EACH ROW EXECUTE FUNCTION public.duty_protect_finalised_letter();

-- 9. Access helpers (SECURITY DEFINER so policies do not recurse) --------
CREATE OR REPLACE FUNCTION public.duty_is_chair()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.check_user_role(auth.uid(), 'chairperson') $$;

CREATE OR REPLACE FUNCTION public.duty_session_published(_session uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM duty_sessions WHERE id = _session AND status = 'published') $$;

-- duty_college_data rows that belong to the signed-in college admin.
CREATE OR REPLACE FUNCTION public.duty_my_college_rows(_session uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT cd.id
  FROM duty_college_data cd
  JOIN profiles p ON p.user_id = auth.uid() AND p.college_id = cd.college_id
  WHERE cd.session_id = _session
$$;

-- Active assignments a college admin may see: their faculty's duties and
-- the duties held at their college as a centre.
CREATE OR REPLACE FUNCTION public.duty_visible_assignments(_session uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id
  FROM duty_assignments a
  JOIN duty_faculty f ON f.id = a.faculty_id
  WHERE a.session_id = _session
    AND a.status = 'active'
    AND (a.centre_id IN (SELECT public.duty_my_college_rows(_session))
         OR f.college_data_id IN (SELECT public.duty_my_college_rows(_session)))
$$;

-- 10. Row level security -------------------------------------------------
ALTER TABLE public.duty_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_subjects     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_college_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_faculty      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_timetable    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_assignments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_letters      ENABLE ROW LEVEL SECURITY;

-- Chairperson: full control everywhere.
CREATE POLICY "Chairperson manages duty sessions" ON public.duty_sessions
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());
CREATE POLICY "Chairperson manages duty subjects" ON public.duty_subjects
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());
CREATE POLICY "Chairperson manages duty college data" ON public.duty_college_data
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());
CREATE POLICY "Chairperson manages duty faculty" ON public.duty_faculty
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());
CREATE POLICY "Chairperson manages duty timetable" ON public.duty_timetable
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());
CREATE POLICY "Chairperson manages duty assignments" ON public.duty_assignments
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());
CREATE POLICY "Chairperson manages duty letters" ON public.duty_letters
  FOR ALL USING (public.duty_is_chair()) WITH CHECK (public.duty_is_chair());

-- College admin: read only, published sessions only, own scope only.
CREATE POLICY "College admin reads published duty sessions" ON public.duty_sessions
  FOR SELECT USING (status = 'published' AND EXISTS (SELECT public.duty_my_college_rows(id)));

CREATE POLICY "College admin reads published duty subjects" ON public.duty_subjects
  FOR SELECT USING (public.duty_session_published(session_id));

CREATE POLICY "College admin reads active duties in scope" ON public.duty_assignments
  FOR SELECT USING (
    public.duty_session_published(session_id)
    AND id IN (SELECT public.duty_visible_assignments(session_id))
  );

CREATE POLICY "College admin reads faculty in scope" ON public.duty_faculty
  FOR SELECT USING (
    public.duty_session_published(session_id)
    AND (
      college_data_id IN (SELECT public.duty_my_college_rows(session_id))
      OR id IN (SELECT a.faculty_id FROM public.duty_assignments a
                WHERE a.id IN (SELECT public.duty_visible_assignments(session_id)))
    )
  );

CREATE POLICY "College admin reads colleges in scope" ON public.duty_college_data
  FOR SELECT USING (
    public.duty_session_published(session_id)
    AND (
      id IN (SELECT public.duty_my_college_rows(session_id))
      OR id IN (SELECT a.centre_id FROM public.duty_assignments a
                WHERE a.id IN (SELECT public.duty_visible_assignments(session_id)))
      OR id IN (SELECT f.college_data_id FROM public.duty_faculty f
                JOIN public.duty_assignments a ON a.faculty_id = f.id
                WHERE a.id IN (SELECT public.duty_visible_assignments(session_id)))
    )
  );

CREATE POLICY "College admin reads own centre timetable" ON public.duty_timetable
  FOR SELECT USING (
    public.duty_session_published(session_id)
    AND centre_id IN (SELECT public.duty_my_college_rows(session_id))
  );

CREATE POLICY "College admin reads own faculty's finalised letters" ON public.duty_letters
  FOR SELECT USING (
    finalised_at IS NOT NULL
    AND public.duty_session_published(session_id)
    AND faculty_id IN (SELECT f.id FROM public.duty_faculty f
                       WHERE f.college_data_id IN (SELECT public.duty_my_college_rows(session_id)))
  );
