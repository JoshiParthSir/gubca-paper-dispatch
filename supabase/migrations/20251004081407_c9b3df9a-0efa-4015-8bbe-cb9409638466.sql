-- Add default DENY policies for anonymous access to sensitive tables

-- Profiles table: Deny anonymous access to user email addresses and names
CREATE POLICY "Deny anonymous access to profiles" 
ON profiles 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Colleges table: Deny anonymous access to contact information
CREATE POLICY "Deny anonymous access to colleges" 
ON colleges 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Download logs table: Deny anonymous access to tracking data
CREATE POLICY "Deny anonymous access to download_logs" 
ON download_logs 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Papers table: Deny anonymous access to exam paper information
CREATE POLICY "Deny anonymous access to papers" 
ON papers 
FOR SELECT 
USING (auth.uid() IS NOT NULL);