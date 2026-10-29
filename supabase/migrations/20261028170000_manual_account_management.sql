-- =====================================================================
-- Manual account management
--
-- College admin accounts are created by the chairperson with a temporary
-- password (no emails). The admin must change it on first login, and again
-- after any password reset by the chairperson.
-- =====================================================================

-- 1. Flag that forces a password change at next login
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

-- 2. Clear the flag whenever the user's password actually changes.
--    Fires for the user's own password change (supabase.auth.updateUser).
--    When the chairperson resets a password, the edge function sets the flag
--    back to true right after updating the password.
CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    UPDATE public.profiles SET must_change_password = false WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_password_changed ON auth.users;
CREATE TRIGGER on_auth_user_password_changed
AFTER UPDATE OF encrypted_password ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.clear_must_change_password();

-- 3. Security: users may edit only their own display name.
--    Previously a college admin could change their own college_id through
--    the API and gain access to another college's papers. Changes to
--    college, email, role or the password flag must come from the
--    chairperson (via edge functions, which use the service role and have
--    no auth.uid()) or from database triggers.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.check_user_role(auth.uid(), 'chairperson')
     AND (
       NEW.college_id IS DISTINCT FROM OLD.college_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password
     ) THEN
    RAISE EXCEPTION 'You can only change your own name. Contact the chairperson for other changes.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();
