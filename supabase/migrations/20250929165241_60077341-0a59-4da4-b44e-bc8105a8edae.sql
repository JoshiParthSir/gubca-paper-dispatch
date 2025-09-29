-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('chairperson', 'college_admin');

-- Create profiles table for user management
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'college_admin',
    college_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create colleges table
CREATE TABLE public.colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create batches table
CREATE TABLE public.batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create papers table for exam papers
CREATE TABLE public.papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create allocations table for paper assignments to colleges
CREATE TABLE public.allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    paper_id UUID NOT NULL REFERENCES public.papers(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.colleges(id) ON DELETE CASCADE,
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_published BOOLEAN DEFAULT FALSE,
    allocated_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(paper_id, college_id)
);

-- Create download logs table
CREATE TABLE public.download_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allocation_id UUID NOT NULL REFERENCES public.allocations(id) ON DELETE CASCADE,
    downloaded_by UUID NOT NULL REFERENCES auth.users(id),
    download_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colleges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint after colleges table is created
ALTER TABLE public.profiles ADD CONSTRAINT profiles_college_id_fkey 
    FOREIGN KEY (college_id) REFERENCES public.colleges(id) ON DELETE SET NULL;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_uuid UUID)
RETURNS user_role
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM public.profiles WHERE user_id = user_uuid;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Chairperson can view all profiles" ON public.profiles
    FOR SELECT USING (public.get_user_role(auth.uid()) = 'chairperson');

CREATE POLICY "Chairperson can create profiles" ON public.profiles
    FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'chairperson');

-- RLS Policies for colleges
CREATE POLICY "Chairperson can manage all colleges" ON public.colleges
    FOR ALL USING (public.get_user_role(auth.uid()) = 'chairperson');

CREATE POLICY "College admins can view their own college" ON public.colleges
    FOR SELECT USING (
        public.get_user_role(auth.uid()) = 'college_admin' AND
        id = (SELECT college_id FROM public.profiles WHERE user_id = auth.uid())
    );

-- RLS Policies for batches
CREATE POLICY "Chairperson can manage all batches" ON public.batches
    FOR ALL USING (public.get_user_role(auth.uid()) = 'chairperson');

CREATE POLICY "College admins can view batches" ON public.batches
    FOR SELECT USING (public.get_user_role(auth.uid()) = 'college_admin');

-- RLS Policies for papers
CREATE POLICY "Chairperson can manage all papers" ON public.papers
    FOR ALL USING (public.get_user_role(auth.uid()) = 'chairperson');

CREATE POLICY "College admins can view allocated papers" ON public.papers
    FOR SELECT USING (
        public.get_user_role(auth.uid()) = 'college_admin' AND
        EXISTS (
            SELECT 1 FROM public.allocations a
            JOIN public.profiles p ON p.user_id = auth.uid()
            WHERE a.paper_id = papers.id AND a.college_id = p.college_id AND a.is_published = TRUE
        )
    );

-- RLS Policies for allocations
CREATE POLICY "Chairperson can manage all allocations" ON public.allocations
    FOR ALL USING (public.get_user_role(auth.uid()) = 'chairperson');

CREATE POLICY "College admins can view their allocations" ON public.allocations
    FOR SELECT USING (
        public.get_user_role(auth.uid()) = 'college_admin' AND
        college_id = (SELECT college_id FROM public.profiles WHERE user_id = auth.uid()) AND
        is_published = TRUE
    );

-- RLS Policies for download logs
CREATE POLICY "Chairperson can view all download logs" ON public.download_logs
    FOR SELECT USING (public.get_user_role(auth.uid()) = 'chairperson');

CREATE POLICY "Users can create their own download logs" ON public.download_logs
    FOR INSERT WITH CHECK (auth.uid() = downloaded_by);

CREATE POLICY "College admins can view their own download logs" ON public.download_logs
    FOR SELECT USING (
        public.get_user_role(auth.uid()) = 'college_admin' AND
        downloaded_by = auth.uid()
    );

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_colleges_updated_at
    BEFORE UPDATE ON public.colleges
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batches_updated_at
    BEFORE UPDATE ON public.batches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_papers_updated_at
    BEFORE UPDATE ON public.papers
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_allocations_updated_at
    BEFORE UPDATE ON public.allocations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'college_admin')
    );
    RETURN NEW;
END;
$$;

-- Create trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();