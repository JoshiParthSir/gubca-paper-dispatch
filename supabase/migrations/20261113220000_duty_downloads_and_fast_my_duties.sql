-- 1. Download log for duty letters: which college admin downloaded which
--    letter, and when. The chairperson reads it; college admins only add.
-- 2. duty_my_duties(): everything the college admin's My Duties page needs
--    in one call. Row level security on the duty tables runs nested checks
--    for every row, which made the page slow; this function applies the
--    same rules once, as SECURITY DEFINER.

-- ---------------------------------------------------------------------------
-- 1. Download log

CREATE TABLE IF NOT EXISTS public.duty_download_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     UUID NOT NULL REFERENCES public.duty_sessions(id) ON DELETE CASCADE,
  letter_id      UUID REFERENCES public.duty_letters(id) ON DELETE SET NULL,
  faculty_id     UUID REFERENCES public.duty_faculty(id) ON DELETE SET NULL,
  college_id     UUID REFERENCES public.colleges(id) ON DELETE SET NULL,
  user_id        UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  kind           TEXT NOT NULL CHECK (kind IN ('letter', 'all_letters')),
  detail         TEXT,
  downloaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS duty_download_logs_session_idx ON public.duty_download_logs (session_id, downloaded_at DESC);

ALTER TABLE public.duty_download_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chairperson reads duty download log" ON public.duty_download_logs;
CREATE POLICY "Chairperson reads duty download log" ON public.duty_download_logs
  FOR SELECT USING (public.duty_is_chair());

DROP POLICY IF EXISTS "College admin logs own duty downloads" ON public.duty_download_logs;
CREATE POLICY "College admin logs own duty downloads" ON public.duty_download_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND college_id = (SELECT p.college_id FROM public.profiles p WHERE p.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "College admin reads own duty downloads" ON public.duty_download_logs;
CREATE POLICY "College admin reads own duty downloads" ON public.duty_download_logs
  FOR SELECT USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 2. My Duties in one call

-- Also defined in 20261113210000_duty_show_coming.sql; repeated so this file
-- works on its own.
CREATE OR REPLACE FUNCTION public.duty_centre_view_on(_session uuid, _centre uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE COALESCE(s.rules->'showComing'->>'mode', 'all')
           WHEN 'none' THEN false
           WHEN 'selected' THEN COALESCE((s.rules->'showComing'->'colleges') ? _centre::text, false)
           ELSE true
         END
  FROM duty_sessions s
  WHERE s.id = _session
$$;

CREATE OR REPLACE FUNCTION public.duty_my_duties()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  my_college uuid;
  s record;
  mine uuid[];
  v_letters jsonb;
  v_assignments jsonb;
  fac_ids uuid[];
  col_ids uuid[];
  result jsonb := '[]'::jsonb;
BEGIN
  SELECT p.college_id INTO my_college FROM profiles p WHERE p.user_id = auth.uid();
  IF my_college IS NULL THEN
    RETURN result;
  END IF;

  FOR s IN SELECT * FROM duty_sessions ORDER BY created_at DESC LOOP
    SELECT array_agg(cd.id) INTO mine
    FROM duty_college_data cd
    WHERE cd.session_id = s.id AND cd.college_id = my_college;
    CONTINUE WHEN mine IS NULL;

    -- Letters sent to this college (own faculty), finalised.
    SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.generated_at), '[]'::jsonb) INTO v_letters
    FROM duty_letters l
    JOIN duty_faculty f ON f.id = l.faculty_id
    WHERE l.session_id = s.id
      AND l.sent_at IS NOT NULL
      AND l.finalised_at IS NOT NULL
      AND f.college_data_id = ANY (mine);

    CONTINUE WHEN s.status <> 'published' AND v_letters = '[]'::jsonb;

    -- Duties: only once published. Own faculty always; examiners coming
    -- to this college only when the chairperson shows them.
    IF s.status = 'published' THEN
      SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.exam_date), '[]'::jsonb) INTO v_assignments
      FROM duty_assignments a
      JOIN duty_faculty f ON f.id = a.faculty_id
      WHERE a.session_id = s.id
        AND a.status = 'active'
        AND (f.college_data_id = ANY (mine)
             OR (a.centre_id = ANY (mine) AND duty_centre_view_on(s.id, a.centre_id)));
    ELSE
      v_assignments := '[]'::jsonb;
    END IF;

    SELECT array_agg(DISTINCT x) INTO fac_ids FROM (
      SELECT (e->>'faculty_id')::uuid AS x FROM jsonb_array_elements(v_assignments) e
      UNION SELECT (e->>'faculty_id')::uuid FROM jsonb_array_elements(v_letters) e
    ) t;

    SELECT array_agg(DISTINCT x) INTO col_ids FROM (
      SELECT unnest(mine) AS x
      UNION SELECT (e->>'centre_id')::uuid FROM jsonb_array_elements(v_assignments) e
      UNION SELECT f.college_data_id FROM duty_faculty f WHERE f.id = ANY (COALESCE(fac_ids, '{}'))
    ) t;

    result := result || jsonb_build_array(jsonb_build_object(
      -- Only what the page needs: no letter settings or block lists.
      'session', (to_jsonb(s) - 'letter_settings' - 'rules')
                 || jsonb_build_object('rules', jsonb_build_object('showComing', s.rules->'showComing')),
      'letters', v_letters,
      'assignments', v_assignments,
      'faculty', (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM duty_faculty f WHERE f.id = ANY (COALESCE(fac_ids, '{}'))),
      'colleges', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM duty_college_data c WHERE c.id = ANY (COALESCE(col_ids, '{}'))),
      'subjects', (SELECT COALESCE(jsonb_agg(to_jsonb(sub)), '[]'::jsonb) FROM duty_subjects sub WHERE sub.session_id = s.id)
    ));
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.duty_my_duties() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.duty_my_duties() TO authenticated;

NOTIFY pgrst, 'reload schema';
