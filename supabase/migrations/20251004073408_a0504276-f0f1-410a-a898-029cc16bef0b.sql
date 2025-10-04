-- Drop the existing incorrect RLS policy for college admins viewing papers
DROP POLICY IF EXISTS "College admins can view allocated papers" ON papers;

-- Create a new RLS policy that works with the allocation_colleges junction table
CREATE POLICY "College admins can view allocated papers" 
ON papers 
FOR SELECT 
USING (
  (get_user_role(auth.uid()) = 'college_admin'::user_role) 
  AND EXISTS (
    SELECT 1 
    FROM allocations a
    JOIN allocation_colleges ac ON ac.allocation_id = a.id
    JOIN profiles p ON p.user_id = auth.uid()
    WHERE a.paper_id = papers.id 
    AND ac.college_id = p.college_id
    AND a.is_published = true
  )
);