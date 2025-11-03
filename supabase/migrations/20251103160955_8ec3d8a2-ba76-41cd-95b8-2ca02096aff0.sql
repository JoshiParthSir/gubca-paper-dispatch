-- Clean up if exists and recreate properly
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP FUNCTION IF EXISTS public.has_role(uuid, user_role) CASCADE;
DROP FUNCTION IF EXISTS public.get_user_primary_role(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.sync_role_to_profile() CASCADE;
DROP FUNCTION IF EXISTS public.prevent_role_update() CASCADE;

-- Step 1: Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Step 2: Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Migrate existing roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, role FROM public.profiles;

-- Step 4: Create security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Step 5: Get primary role function
CREATE OR REPLACE FUNCTION public.get_user_primary_role(_user_id uuid)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Step 6: RLS policies
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Chairperson can view all roles"
ON public.user_roles FOR SELECT
USING (public.has_role(auth.uid(), 'chairperson'));

CREATE POLICY "Chairperson can manage all roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'chairperson'));

-- Step 7: Sync trigger
CREATE OR REPLACE FUNCTION public.sync_role_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles SET role = NEW.role WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_role_after_insert
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.sync_role_to_profile();

-- Step 8: Prevent direct role updates
CREATE OR REPLACE FUNCTION public.prevent_role_update()
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
FOR EACH ROW EXECUTE FUNCTION public.prevent_role_update();