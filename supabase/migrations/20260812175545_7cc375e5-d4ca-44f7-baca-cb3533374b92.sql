-- Ensure user_profiles has the right structure
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile" 
ON public.user_profiles FOR SELECT 
TO authenticated 
USING (auth.uid() = id);

-- Allow admins to manage all profiles
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.user_profiles;
CREATE POLICY "Admins can manage all profiles" 
ON public.user_profiles FOR ALL 
TO authenticated 
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
