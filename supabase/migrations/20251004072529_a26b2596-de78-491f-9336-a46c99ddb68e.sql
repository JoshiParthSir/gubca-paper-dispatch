-- Drop the existing incorrect RLS policy for college admins
DROP POLICY IF EXISTS "College admins can view their allocations" ON allocations;

-- Create a new RLS policy that works with the many-to-many relationship
CREATE POLICY "College admins can view their allocations" 
ON allocations 
FOR SELECT 
USING (
  (get_user_role(auth.uid()) = 'college_admin'::user_role) 
  AND (is_published = true)
  AND EXISTS (
    SELECT 1 
    FROM allocation_colleges ac
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE ac.allocation_id = allocations.id 
    AND ac.college_id = p.college_id
  )
);