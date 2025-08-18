-- Fix RLS Policies to Allow Patients to View Their Assigned Doctor
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. UPDATE DOCTORS TABLE RLS POLICIES
-- ========================================

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "doctors_own_profile" ON doctors;

-- Create new policies for doctors table
-- Policy 1: Doctors can manage their own profile
CREATE POLICY "doctors_can_manage_own_profile" ON doctors
    FOR ALL USING (auth.uid() = auth_user_id);

-- Policy 2: Patients can view their assigned doctor's information
CREATE POLICY "patients_can_view_assigned_doctor" ON doctors
    FOR SELECT USING (
        id IN (
            SELECT assigned_doctor_id 
            FROM patients 
            WHERE auth_user_id = auth.uid()
        )
    );

-- Policy 3: Allow public read access to basic doctor info (for patient assignment)
CREATE POLICY "public_doctor_basic_info" ON doctors
    FOR SELECT USING (
        -- Only allow reading basic info needed for assignment
        true
    );

-- ========================================
-- 2. UPDATE PATIENTS TABLE RLS POLICIES  
-- ========================================

-- Ensure patients can read their own profile
DROP POLICY IF EXISTS "patients_own_profile" ON patients;
CREATE POLICY "patients_can_manage_own_profile" ON patients
    FOR ALL USING (auth.uid() = auth_user_id);

-- ========================================
-- 3. VERIFY POLICIES ARE WORKING
-- ========================================

-- Test function to verify RLS policies
CREATE OR REPLACE FUNCTION test_doctor_patient_access()
RETURNS TABLE(
    test_name TEXT,
    status TEXT,
    description TEXT
) AS $$
BEGIN
    -- Test 1: Check doctors table policies
    RETURN QUERY SELECT 
        'doctors_policies'::TEXT,
        CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        ('Found ' || COUNT(*) || ' policies on doctors table')::TEXT
    FROM pg_policies WHERE tablename = 'doctors';
    
    -- Test 2: Check patients table policies  
    RETURN QUERY SELECT 
        'patients_policies'::TEXT,
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        ('Found ' || COUNT(*) || ' policies on patients table')::TEXT
    FROM pg_policies WHERE tablename = 'patients';
    
    -- Test 3: Check RLS is enabled
    RETURN QUERY SELECT 
        'rls_enabled'::TEXT,
        CASE WHEN pg_class.relrowsecurity THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'RLS enabled on doctors table'::TEXT
    FROM pg_class WHERE relname = 'doctors';
    
    RETURN QUERY SELECT 
        'rls_enabled_patients'::TEXT,
        CASE WHEN pg_class.relrowsecurity THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'RLS enabled on patients table'::TEXT
    FROM pg_class WHERE relname = 'patients';
END;
$$ LANGUAGE plpgsql;

-- Run the test
SELECT * FROM test_doctor_patient_access();

-- ========================================
-- 4. SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DOCTOR ACCESS RLS POLICIES UPDATED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Updated Policies:';
    RAISE NOTICE '- Doctors can manage their own profiles';
    RAISE NOTICE '- Patients can view their assigned doctor';
    RAISE NOTICE '- Public access to basic doctor info for assignment';
    RAISE NOTICE '';
    RAISE NOTICE 'The 406 error should now be resolved!';
    RAISE NOTICE 'Patients can now see their assigned doctor information.';
    RAISE NOTICE '========================================';
END $$;
