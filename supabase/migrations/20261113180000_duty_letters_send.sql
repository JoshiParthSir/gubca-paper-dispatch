-- Send duty letters to college admins, one by one or all together.
--
-- A college admin sees a letter only after the chairperson has sent it
-- (and while it is finalised), whether or not the exam is published. The
-- PDF is never stored: it is drawn in the browser from duty_letters.content.

ALTER TABLE public.duty_letters
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id);

-- Sessions in which the signed-in college admin has received a letter.
CREATE OR REPLACE FUNCTION public.duty_my_sent_letter_sessions()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT l.session_id
  FROM duty_letters l
  JOIN duty_faculty f ON f.id = l.faculty_id
  JOIN duty_college_data cd ON cd.id = f.college_data_id
  JOIN profiles p ON p.user_id = auth.uid() AND p.college_id = cd.college_id
  WHERE l.sent_at IS NOT NULL
    AND l.finalised_at IS NOT NULL
$$;

-- The session is visible when it is published, or when a letter was sent.
DROP POLICY IF EXISTS "College admin reads published duty sessions" ON public.duty_sessions;
CREATE POLICY "College admin reads published duty sessions" ON public.duty_sessions
  FOR SELECT USING (
    (status = 'published' AND EXISTS (SELECT public.duty_my_college_rows(id)))
    OR id IN (SELECT public.duty_my_sent_letter_sessions())
  );

-- Whether a faculty record belongs to the signed-in college admin's
-- college. SECURITY DEFINER: a college admin may not read duty_faculty
-- before publishing, and letters can be sent before that.
CREATE OR REPLACE FUNCTION public.duty_faculty_is_mine(_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM duty_faculty f
    JOIN duty_college_data cd ON cd.id = f.college_data_id
    JOIN profiles p ON p.user_id = auth.uid() AND p.college_id = cd.college_id
    WHERE f.id = _faculty
  )
$$;

-- Letters: only those sent to this college admin (own faculty), and finalised.
DROP POLICY IF EXISTS "College admin reads own faculty's finalised letters" ON public.duty_letters;
DROP POLICY IF EXISTS "College admin reads own faculty's sent letters" ON public.duty_letters;
CREATE POLICY "College admin reads own faculty's sent letters" ON public.duty_letters
  FOR SELECT USING (
    duty_letters.sent_at IS NOT NULL
    AND duty_letters.finalised_at IS NOT NULL
    AND public.duty_faculty_is_mine(duty_letters.faculty_id)
  );

-- Make the API see the new columns straight away.
NOTIFY pgrst, 'reload schema';
