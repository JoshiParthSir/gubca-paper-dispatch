-- Fix chairperson role issue
-- Ensure users with chairperson role in profiles table also have it in user_roles table

-- Insert missing chairperson roles into user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'chairperson'::app_role
FROM public.profiles p
WHERE p.role = 'chairperson'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = p.user_id 
      AND ur.role = 'chairperson'
  );

-- Insert missing college_admin roles into user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'college_admin'::app_role
FROM public.profiles p
WHERE p.role = 'college_admin'
  AND NOT EXISTS (
    SELECT 1 
    FROM public.user_roles ur 
    WHERE ur.user_id = p.user_id 
      AND ur.role = 'college_admin'
  );
