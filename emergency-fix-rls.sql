-- EMERGENCY FIX: Infinite Recursion in RLS Policies
-- Run this IMMEDIATELY in Supabase SQL Editor to fix the login issue

-- ========================================
-- 1. DISABLE RLS TEMPORARILY TO DIAGNOSE
-- ========================================

-- Temporarily disable RLS to allow access
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 2. DROP ALL EXISTING PROBLEMATIC POLICIES
-- ========================================

-- Drop all existing policies that might be causing recursion
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Doctors can view patient profiles" ON user_profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON user_profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON user_profiles;

-- ========================================
-- 3. CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ========================================

-- Simple policy: Users can view their own profile
CREATE POLICY "users_view_own_profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

-- Simple policy: Users can insert their own profile
CREATE POLICY "users_insert_own_profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Simple policy: Users can update their own profile
CREATE POLICY "users_update_own_profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- ========================================
-- 4. RE-ENABLE RLS WITH SAFE POLICIES
-- ========================================

-- Re-enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 5. TEST THE FIX
-- ========================================

-- Test function to verify policies work
CREATE OR REPLACE FUNCTION test_rls_fix()
RETURNS TABLE(test_name TEXT, result TEXT, details TEXT) AS $$
BEGIN
    RETURN QUERY SELECT 
        'RLS_STATUS'::TEXT,
        CASE WHEN pg_class.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END::TEXT,
        'Row Level Security status'::TEXT
    FROM pg_class 
    WHERE relname = 'user_profiles';
    
    RETURN QUERY SELECT 
        'POLICY_COUNT'::TEXT,
        COUNT(*)::TEXT,
        'Number of policies on user_profiles'::TEXT
    FROM pg_policies 
    WHERE tablename = 'user_profiles';
    
    RETURN QUERY SELECT 
        'POLICIES'::TEXT,
        string_agg(policyname, ', ')::TEXT,
        'Active policy names'::TEXT
    FROM pg_policies 
    WHERE tablename = 'user_profiles';
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT * FROM test_rls_fix();

-- ========================================
-- SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'EMERGENCY RLS FIX COMPLETED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Infinite recursion policies removed.';
    RAISE NOTICE 'Simple, safe policies created.';
    RAISE NOTICE 'Try logging in again now.';
    RAISE NOTICE '========================================';
END $$;
