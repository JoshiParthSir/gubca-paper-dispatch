-- Create junction table for allocations and colleges
CREATE TABLE IF NOT EXISTS public.allocation_colleges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_id UUID NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
  college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(allocation_id, college_id)
);

-- Enable RLS on allocation_colleges
ALTER TABLE public.allocation_colleges ENABLE ROW LEVEL SECURITY;

-- RLS policies for allocation_colleges
CREATE POLICY "Chairperson can manage allocation_colleges"
ON public.allocation_colleges
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = 'chairperson'::user_role);

CREATE POLICY "College admins can view their allocation_colleges"
ON public.allocation_colleges
FOR SELECT
TO authenticated
USING (
  get_user_role(auth.uid()) = 'college_admin'::user_role 
  AND college_id = (SELECT college_id FROM profiles WHERE user_id = auth.uid())
);

-- Migrate existing allocations to junction table
INSERT INTO public.allocation_colleges (allocation_id, college_id)
SELECT id, college_id 
FROM public.allocations 
WHERE college_id IS NOT NULL
ON CONFLICT (allocation_id, college_id) DO NOTHING;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_allocation_colleges_allocation_id ON public.allocation_colleges(allocation_id);
CREATE INDEX IF NOT EXISTS idx_allocation_colleges_college_id ON public.allocation_colleges(college_id);