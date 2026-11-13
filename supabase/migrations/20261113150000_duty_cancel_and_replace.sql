-- =====================================================================
-- Duty Allocation: cancel a duty and (optionally) give it to someone else
-- in one call, so it can never half-happen.
--
-- The old row is kept as history (status = 'cancelled', replaced_by ->
-- the new duty). The new row is an ordinary active duty: nothing on it
-- says it is a replacement, so letters and normal views never show the
-- change. Only the chairperson's Cancellations view reads the history.
--
-- SECURITY INVOKER: the caller's RLS still applies (only the chairperson
-- can write duty_assignments). The explicit check gives a clear message.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.duty_cancel_and_replace(
  _assignment  uuid,
  _new_faculty uuid,
  _reason      text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  old_row public.duty_assignments%ROWTYPE;
  new_id  uuid;
BEGIN
  IF NOT public.duty_is_chair() THEN
    RAISE EXCEPTION 'Only the chairperson can cancel duties.' USING ERRCODE = '42501';
  END IF;

  IF coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Please give a reason for the cancellation.';
  END IF;

  SELECT * INTO old_row FROM public.duty_assignments WHERE id = _assignment FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Duty not found.';
  END IF;
  IF old_row.status <> 'active' THEN
    RAISE EXCEPTION 'This duty is already cancelled.';
  END IF;

  UPDATE public.duty_assignments
     SET status        = 'cancelled',
         cancelled_at  = now(),
         cancelled_by  = auth.uid(),
         cancel_reason = btrim(_reason)
   WHERE id = _assignment;

  IF _new_faculty IS NOT NULL THEN
    IF _new_faculty = old_row.faculty_id THEN
      RAISE EXCEPTION 'Choose a different examiner.';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.duty_faculty
       WHERE id = _new_faculty AND session_id = old_row.session_id
    ) THEN
      RAISE EXCEPTION 'That examiner is not part of this exam.';
    END IF;

    -- The one-active-duty-per-day index refuses a clash here.
    INSERT INTO public.duty_assignments (session_id, exam_date, centre_id, subject_code, faculty_id, seat_role)
    VALUES (old_row.session_id, old_row.exam_date, old_row.centre_id, old_row.subject_code, _new_faculty, old_row.seat_role)
    RETURNING id INTO new_id;

    UPDATE public.duty_assignments SET replaced_by = new_id WHERE id = _assignment;
  END IF;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duty_cancel_and_replace(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duty_cancel_and_replace(uuid, uuid, text) TO authenticated;
