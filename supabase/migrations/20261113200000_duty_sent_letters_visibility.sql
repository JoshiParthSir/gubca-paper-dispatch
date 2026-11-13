-- Fix: college admins could not see letters sent to them before the exam
-- was published. The letters policy looked up duty_faculty, which a college
-- admin may read only after publishing, so the check always failed. The
-- ownership check now runs as SECURITY DEFINER and does not depend on that.

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

DROP POLICY IF EXISTS "College admin reads own faculty's finalised letters" ON public.duty_letters;
DROP POLICY IF EXISTS "College admin reads own faculty's sent letters" ON public.duty_letters;
CREATE POLICY "College admin reads own faculty's sent letters" ON public.duty_letters
  FOR SELECT USING (
    duty_letters.sent_at IS NOT NULL
    AND duty_letters.finalised_at IS NOT NULL
    AND public.duty_faculty_is_mine(duty_letters.faculty_id)
  );

NOTIFY pgrst, 'reload schema';
