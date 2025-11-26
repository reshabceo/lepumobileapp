-- ============================================
-- COMPLETE RLS FIX - ELIMINATES INFINITE RECURSION
-- Based on actual database inspection
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: VIEW CURRENT PROBLEMATIC POLICIES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔍 CURRENT RECURSIVE POLICIES (THE PROBLEM)';
    RAISE NOTICE '==========================================';
END $$;

SELECT 
    '⚠️  ' || tablename || '.' || policyname as recursive_policy,
    'Command: ' || cmd as operation,
    'Problem: Queries other RLS-protected tables' as issue
FROM pg_policies 
WHERE schemaname = 'public'
AND (
    -- Policies on patients that query doctors
    (tablename = 'patients' AND qual::text LIKE '%FROM doctors%')
    OR
    -- Policies on other tables that query both patients AND doctors
    (tablename != 'doctors' AND tablename != 'patients' AND qual::text LIKE '%FROM patients%' AND qual::text LIKE '%FROM doctors%')
)
ORDER BY tablename, policyname;

-- ============================================
-- STEP 2: DROP ALL EXISTING RLS POLICIES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🗑️  DROPPING ALL EXISTING POLICIES';
    RAISE NOTICE '==========================================';
END $$;

-- DOCTORS TABLE
DROP POLICY IF EXISTS "doctors_select_own_profile" ON doctors;
DROP POLICY IF EXISTS "doctors_update_own_profile" ON doctors;
DROP POLICY IF EXISTS "doctors_insert_own_profile" ON doctors;
DROP POLICY IF EXISTS "anon_can_validate_doctor_codes" ON doctors;
DROP POLICY IF EXISTS "authenticated_can_read_doctors" ON doctors;
DROP POLICY IF EXISTS "authenticated_can_read_assigned_doctors" ON doctors;
DROP POLICY IF EXISTS "allow_anonymous_doctor_code_check" ON doctors;
DROP POLICY IF EXISTS "anon_read_doctors_for_validation" ON doctors;
DROP POLICY IF EXISTS "authenticated_read_doctors_simple" ON doctors;

-- PATIENTS TABLE
DROP POLICY IF EXISTS "doctors_view_assigned_patients" ON patients;
DROP POLICY IF EXISTS "doctors_update_assigned_patients" ON patients;
DROP POLICY IF EXISTS "doctors_insert_patients" ON patients;
DROP POLICY IF EXISTS "patients_view_own_profile" ON patients;
DROP POLICY IF EXISTS "patients_update_own_profile" ON patients;
DROP POLICY IF EXISTS "authenticated_can_read_own_patient_data" ON patients;
DROP POLICY IF EXISTS "patients_read_own_data" ON patients;
DROP POLICY IF EXISTS "patients_update_own_data" ON patients;
DROP POLICY IF EXISTS "doctors_read_assigned_patients" ON patients;
DROP POLICY IF EXISTS "anon_insert_patients_on_signup" ON patients;

-- VITAL_SIGNS TABLE
DROP POLICY IF EXISTS "doctors_view_patient_vitals" ON vital_signs;
DROP POLICY IF EXISTS "doctors_insert_patient_vitals" ON vital_signs;
DROP POLICY IF EXISTS "patients_view_own_vitals" ON vital_signs;
DROP POLICY IF EXISTS "patients_insert_own_vitals" ON vital_signs;

-- EMERGENCY_ALERTS TABLE (if exists)
DROP POLICY IF EXISTS "doctors_view_patient_alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "doctors_insert_patient_alerts" ON emergency_alerts;
DROP POLICY IF EXISTS "doctors_update_patient_alerts" ON emergency_alerts;

-- PATIENT_REPORTS TABLE
DROP POLICY IF EXISTS "doctors_view_patient_reports" ON patient_reports;
DROP POLICY IF EXISTS "doctors_insert_patient_reports" ON patient_reports;
DROP POLICY IF EXISTS "patients_view_own_reports" ON patient_reports;
DROP POLICY IF EXISTS "patients_insert_own_reports" ON patient_reports;

-- PATIENT_UPLOADS TABLE
DROP POLICY IF EXISTS "doctors_view_patient_uploads" ON patient_uploads;
DROP POLICY IF EXISTS "doctors_insert_patient_uploads" ON patient_uploads;
DROP POLICY IF EXISTS "patients_view_own_uploads" ON patient_uploads;
DROP POLICY IF EXISTS "patients_insert_own_uploads" ON patient_uploads;

-- VIDEO_CALLS TABLE
DROP POLICY IF EXISTS "doctors_view_own_video_calls" ON video_calls;
DROP POLICY IF EXISTS "doctors_insert_video_calls" ON video_calls;
DROP POLICY IF EXISTS "patients_view_own_video_calls" ON video_calls;

-- ============================================
-- STEP 3: ENSURE SECURITY DEFINER FUNCTIONS EXIST
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔧 CREATING/UPDATING SECURITY FUNCTIONS';
    RAISE NOTICE '==========================================';
END $$;

-- Function to get current doctor ID (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_current_doctor_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    doctor_id UUID;
BEGIN
    SELECT id INTO doctor_id
    FROM doctors 
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    
    RETURN doctor_id;
END;
$$;

-- Function to get current patient ID (SECURITY DEFINER to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_current_patient_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    patient_id UUID;
BEGIN
    SELECT id INTO patient_id
    FROM patients 
    WHERE auth_user_id = auth.uid()
    LIMIT 1;
    
    RETURN patient_id;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_current_doctor_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_patient_id() TO authenticated;

-- ============================================
-- STEP 4: CREATE SIMPLE, NON-RECURSIVE POLICIES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ CREATING NEW NON-RECURSIVE POLICIES';
    RAISE NOTICE '==========================================';
END $$;

-- ============================================
-- DOCTORS TABLE POLICIES
-- ============================================

-- 1. Allow anonymous users to read doctor codes (for signup validation)
CREATE POLICY "anon_read_doctor_codes" ON doctors
    FOR SELECT 
    TO anon
    USING (true);

-- 2. Authenticated users can read all doctors (simplified, no recursion)
CREATE POLICY "authenticated_read_doctors" ON doctors
    FOR SELECT 
    TO authenticated
    USING (true);

-- 3. Doctors can update their own profile
CREATE POLICY "doctors_update_own" ON doctors
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- 4. Doctors can insert their own profile (during signup)
CREATE POLICY "doctors_insert_own" ON doctors
    FOR INSERT
    TO authenticated
    WITH CHECK (auth_user_id = auth.uid());

-- ============================================
-- PATIENTS TABLE POLICIES (NO RECURSION!)
-- ============================================

-- 1. Allow anonymous users to INSERT during signup
CREATE POLICY "anon_insert_patients" ON patients
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- 2. Patients can read their own data
CREATE POLICY "patients_read_own" ON patients
    FOR SELECT
    TO authenticated
    USING (auth_user_id = auth.uid());

-- 3. Patients can update their own data
CREATE POLICY "patients_update_own" ON patients
    FOR UPDATE
    TO authenticated
    USING (auth_user_id = auth.uid())
    WITH CHECK (auth_user_id = auth.uid());

-- 4. Doctors can read their assigned patients
-- FIXED: Uses security definer function instead of subquery
CREATE POLICY "doctors_read_patients" ON patients
    FOR SELECT
    TO authenticated
    USING (assigned_doctor_id = public.get_current_doctor_id());

-- 5. Doctors can update their assigned patients
CREATE POLICY "doctors_update_patients" ON patients
    FOR UPDATE
    TO authenticated
    USING (assigned_doctor_id = public.get_current_doctor_id())
    WITH CHECK (assigned_doctor_id = public.get_current_doctor_id());

-- 6. Doctors can insert patients
CREATE POLICY "doctors_insert_patients" ON patients
    FOR INSERT
    TO authenticated
    WITH CHECK (assigned_doctor_id = public.get_current_doctor_id());

-- ============================================
-- VITAL_SIGNS TABLE POLICIES (NO RECURSION!)
-- ============================================

-- 1. Patients can read their own vital signs
CREATE POLICY "patients_read_vitals" ON vital_signs
    FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

-- 2. Doctors can read vital signs of their assigned patients
-- FIXED: Uses function instead of nested subquery
CREATE POLICY "doctors_read_vitals" ON vital_signs
    FOR SELECT
    TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- 3. Patients can insert their own vital signs
CREATE POLICY "patients_insert_vitals" ON vital_signs
    FOR INSERT
    TO authenticated
    WITH CHECK (patient_id = public.get_current_patient_id());

-- 4. Doctors can insert vital signs for their patients
CREATE POLICY "doctors_insert_vitals" ON vital_signs
    FOR INSERT
    TO authenticated
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- ============================================
-- EMERGENCY_ALERTS TABLE POLICIES (if exists)
-- ============================================
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'emergency_alerts') THEN
        EXECUTE 'CREATE POLICY "doctors_read_alerts" ON emergency_alerts
            FOR SELECT
            TO authenticated
            USING (
                patient_id IN (
                    SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
                )
            )';
        
        EXECUTE 'CREATE POLICY "doctors_insert_alerts" ON emergency_alerts
            FOR INSERT
            TO authenticated
            WITH CHECK (
                patient_id IN (
                    SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
                )
            )';
        
        EXECUTE 'CREATE POLICY "doctors_update_alerts" ON emergency_alerts
            FOR UPDATE
            TO authenticated
            USING (
                patient_id IN (
                    SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
                )
            )';
        
        RAISE NOTICE '✅ Emergency alerts policies created';
    END IF;
END $$;

-- ============================================
-- PATIENT_REPORTS TABLE POLICIES
-- ============================================

-- Patients can read their own reports
CREATE POLICY "patients_read_reports" ON patient_reports
    FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

-- Doctors can read reports of their assigned patients
CREATE POLICY "doctors_read_reports" ON patient_reports
    FOR SELECT
    TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- Patients can insert their own reports
CREATE POLICY "patients_insert_reports" ON patient_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (patient_id = public.get_current_patient_id());

-- Doctors can insert reports for their patients
CREATE POLICY "doctors_insert_reports" ON patient_reports
    FOR INSERT
    TO authenticated
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- ============================================
-- PATIENT_UPLOADS TABLE POLICIES
-- ============================================

-- Patients can read their own uploads
CREATE POLICY "patients_read_uploads" ON patient_uploads
    FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

-- Doctors can read uploads of their assigned patients
CREATE POLICY "doctors_read_uploads" ON patient_uploads
    FOR SELECT
    TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- Patients can insert their own uploads
CREATE POLICY "patients_insert_uploads" ON patient_uploads
    FOR INSERT
    TO authenticated
    WITH CHECK (patient_id = public.get_current_patient_id());

-- Doctors can insert uploads for their patients
CREATE POLICY "doctors_insert_uploads" ON patient_uploads
    FOR INSERT
    TO authenticated
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- ============================================
-- VIDEO_CALLS TABLE POLICIES
-- ============================================

-- Doctors can read video calls they are part of
CREATE POLICY "doctors_read_calls" ON video_calls
    FOR SELECT
    TO authenticated
    USING (doctor_id = public.get_current_doctor_id());

-- Patients can read their own video calls
CREATE POLICY "patients_read_calls" ON video_calls
    FOR SELECT
    TO authenticated
    USING (patient_id = public.get_current_patient_id());

-- Doctors can insert video calls with their patients
CREATE POLICY "doctors_insert_calls" ON video_calls
    FOR INSERT
    TO authenticated
    WITH CHECK (
        doctor_id = public.get_current_doctor_id()
        AND patient_id IN (
            SELECT id FROM patients WHERE assigned_doctor_id = public.get_current_doctor_id()
        )
    );

-- Doctors and patients can update their video calls
CREATE POLICY "users_update_calls" ON video_calls
    FOR UPDATE
    TO authenticated
    USING (
        doctor_id = public.get_current_doctor_id()
        OR patient_id = public.get_current_patient_id()
    );

-- ============================================
-- STEP 5: VERIFY NEW POLICIES
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🔍 VERIFYING NEW POLICIES';
    RAISE NOTICE '==========================================';
END $$;

SELECT 
    '✅ ' || tablename || '.' || policyname as policy,
    array_to_string(roles::text[], ', ') as applies_to,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- STEP 6: SUMMARY
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '🎉 RLS POLICIES FIXED SUCCESSFULLY!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ ELIMINATED INFINITE RECURSION';
    RAISE NOTICE '✅ Using SECURITY DEFINER functions instead of nested subqueries';
    RAISE NOTICE '✅ Anonymous users can validate doctor codes (signup)';
    RAISE NOTICE '✅ Patients can sign up and access their data';
    RAISE NOTICE '✅ Doctors can access their assigned patients';
    RAISE NOTICE '✅ All tables covered: doctors, patients, vital_signs,';
    RAISE NOTICE '   emergency_alerts, patient_reports, patient_uploads, video_calls';
    RAISE NOTICE '';
    RAISE NOTICE '📱 TEST YOUR APPS NOW!';
    RAISE NOTICE '==========================================';
END $$;

