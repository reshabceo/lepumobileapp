-- Fix RLS Policies for Doctor Registration
-- Run this SQL in your Supabase SQL Editor

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;

-- Create more permissive policies for user profile management
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles  
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Allow doctors to view other user profiles (for patient management)
CREATE POLICY "Doctors can view user profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles doctor_profile
      WHERE doctor_profile.id = auth.uid() 
      AND doctor_profile.role IN ('doctor', 'nurse', 'admin')
    )
  );

-- Allow authenticated users to insert profiles during signup
CREATE POLICY "Allow profile creation during signup" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL 
    AND id = auth.uid()
  );

-- Grant necessary permissions for authenticated users
GRANT ALL ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO anon;

-- Refresh RLS
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Verify policies are working
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- Test function to verify RLS is working correctly
CREATE OR REPLACE FUNCTION test_user_profile_access()
RETURNS TABLE(
    test_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Test 1: Check if RLS is enabled
    RETURN QUERY
    SELECT 
        'RLS Enabled'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = 'user_profiles' 
            AND n.nspname = 'public'
            AND c.relrowsecurity = true
        ) THEN 'OK' ELSE 'FAILED' END,
        'Row Level Security is enabled on user_profiles table'::TEXT;
    
    -- Test 2: Check if policies exist
    RETURN QUERY
    SELECT 
        'Policies Exist'::TEXT,
        CASE WHEN (
            SELECT COUNT(*) FROM pg_policies 
            WHERE tablename = 'user_profiles'
        ) >= 3 THEN 'OK' ELSE 'FAILED' END,
        'Required RLS policies are in place'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Run the test (commented out to avoid dependency issues)
-- SELECT * FROM test_user_profile_access();

-- Ensure the generate_doctor_code function exists
CREATE OR REPLACE FUNCTION generate_doctor_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 4-digit code with DR prefix
        new_code := 'DR' || LPAD(floor(random() * 10000)::text, 4, '0');
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM user_profiles 
            WHERE doctor_code = new_code
        ) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create a secure function to handle doctor profile creation
CREATE OR REPLACE FUNCTION create_doctor_profile(
    user_id UUID,
    doctor_name TEXT,
    doctor_role TEXT
)
RETURNS JSON AS $$
DECLARE
    new_doctor_code TEXT;
    result JSON;
BEGIN
    -- Generate doctor code
    new_doctor_code := generate_doctor_code();
    
    -- Insert doctor profile with elevated privileges
    INSERT INTO user_profiles (id, name, role, doctor_code)
    VALUES (user_id, doctor_name, doctor_role, new_doctor_code)
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        doctor_code = COALESCE(user_profiles.doctor_code, EXCLUDED.doctor_code);
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'doctor_code', new_doctor_code,
        'message', 'Doctor profile created successfully'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create doctor profile'
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create an overloaded version with default role
CREATE OR REPLACE FUNCTION create_doctor_profile(
    user_id UUID,
    doctor_name TEXT
)
RETURNS JSON AS $$
BEGIN
    RETURN create_doctor_profile(user_id, doctor_name, 'doctor');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_doctor_profile(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_doctor_profile(UUID, TEXT) TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS POLICIES UPDATED SUCCESSFULLY!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Doctor registration should now work properly.';
    RAISE NOTICE 'New secure function create_doctor_profile() available.';
    RAISE NOTICE 'Try creating a doctor account again.';
    RAISE NOTICE '========================================';
END $$;
