-- The chairperson decides which colleges see "Examiners coming to our
-- college" after publishing: all, none, or selected centres. Stored in
-- duty_sessions.rules->'showComing' as
--   { "mode": "all" | "none" | "selected", "colleges": [duty_college_data ids] }
-- (missing = "all", as before). Enforced here, not only in the page.

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

-- Active assignments a college admin may see: their own faculty's duties
-- always; the duties held at their college as a centre only when the
-- chairperson shows "Examiners coming to our college" to that college.
CREATE OR REPLACE FUNCTION public.duty_visible_assignments(_session uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id
  FROM duty_assignments a
  JOIN duty_faculty f ON f.id = a.faculty_id
  WHERE a.session_id = _session
    AND a.status = 'active'
    AND (
      (a.centre_id IN (SELECT public.duty_my_college_rows(_session))
       AND public.duty_centre_view_on(_session, a.centre_id))
      OR f.college_data_id IN (SELECT public.duty_my_college_rows(_session))
    )
$$;

NOTIFY pgrst, 'reload schema';
