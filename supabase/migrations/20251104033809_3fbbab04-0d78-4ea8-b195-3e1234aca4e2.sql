-- Fix search_path for sync_role_to_profile function
CREATE OR REPLACE FUNCTION public.sync_role_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET role = NEW.role::text::user_role
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- Fix search_path for prevent_role_update function
CREATE OR REPLACE FUNCTION public.prevent_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Direct role updates not allowed. Use user_roles table.';
  END IF;
  RETURN NEW;
END;
$$;