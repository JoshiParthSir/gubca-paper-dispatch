-- Step 1: Drop all variations of existing objects
DROP TRIGGER IF EXISTS sync_role_after_insert ON public.user_roles CASCADE;
DROP TRIGGER IF EXISTS sync_role_after_update ON public.user_roles CASCADE;
DROP TRIGGER IF EXISTS prevent_profile_role_update ON public.profiles CASCADE;
DROP FUNCTION IF EXISTS public.sync_role_to_profile() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_role_update() CASCADE;
DROP FUNCTION IF EXISTS public.has_role CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;

-- Step 2: Create enum for roles
CREATE TYPE public.app_role AS ENUM ('chairperson', 'college_admin');

-- Step 3: Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Step 4: Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 5: Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 
  CASE 
    WHEN role::text = 'chairperson' THEN 'chairperson'::app_role
    WHEN role::text = 'college_admin' THEN 'college_admin'::app_role
  END
FROM public.profiles
WHERE role::text IN ('chairperson', 'college_admin');

-- Step 6: Create security definer function to check roles
CREATE FUNCTION public.check_user_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Step 7: Update get_user_role to use new table
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid uuid)
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role::text::user_role FROM public.user_roles WHERE user_id = user_uuid LIMIT 1
$$;

-- Step 8: RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Chairperson can view all roles"
ON public.user_roles
FOR SELECT
USING (public.check_user_role(auth.uid(), 'chairperson'));

CREATE POLICY "Chairperson can manage all roles"
ON public.user_roles
FOR ALL
USING (public.check_user_role(auth.uid(), 'chairperson'));

-- Step 9: Create trigger to sync role to profiles table (for display only)
CREATE FUNCTION public.sync_role_to_profile()
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

CREATE TRIGGER sync_role_after_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_profile();

CREATE TRIGGER sync_role_after_update
AFTER UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_profile();

-- Step 10: Prevent direct role updates on profiles table
CREATE FUNCTION public.prevent_role_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    RAISE EXCEPTION 'Direct role updates not allowed. Use user_roles table.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_profile_role_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_role_update();