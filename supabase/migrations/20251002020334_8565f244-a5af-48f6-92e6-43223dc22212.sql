-- Make college_id nullable in allocations table since we now use junction table
ALTER TABLE public.allocations ALTER COLUMN college_id DROP NOT NULL;