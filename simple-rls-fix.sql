-- Simple RLS Fix for Doctor Access
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. DROP ALL EXISTING POLICIES ON DOCTORS TABLE
-- ========================================

DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'doctors'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON doctors';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- ========================================
-- 2. CREATE FRESH POLICIES
-- ========================================

-- Policy 1: Doctors can manage their own profile
CREATE POLICY "doctors_manage_own_profile" ON doctors
    FOR ALL USING (auth.uid() = auth_user_id);

-- Policy 2: Patients can view their assigned doctor's information
CREATE POLICY "patients_view_assigned_doctor" ON doctors
    FOR SELECT USING (
        id IN (
            SELECT assigned_doctor_id 
            FROM patients 
            WHERE auth_user_id = auth.uid()
        )
    );

-- ========================================
-- 3. ENSURE PATIENTS TABLE HAS PROPER POLICIES
-- ========================================

-- Drop existing patient policies
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'patients'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON patients';
        RAISE NOTICE 'Dropped patient policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Create fresh patient policies
CREATE POLICY "patients_manage_own_profile" ON patients
    FOR ALL USING (auth.uid() = auth_user_id);

-- Policy for doctors to view their assigned patients
CREATE POLICY "doctors_view_assigned_patients" ON patients
    FOR SELECT USING (
        assigned_doctor_id IN (
            SELECT id FROM doctors WHERE auth_user_id = auth.uid()
        )
    );

-- ========================================
-- 4. VERIFY SETUP
-- ========================================

-- Check current data
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CURRENT DATA STATUS:';
    RAISE NOTICE 'Doctors: %', (SELECT COUNT(*) FROM doctors);
    RAISE NOTICE 'Patients: %', (SELECT COUNT(*) FROM patients);
    RAISE NOTICE 'Patients with doctors: %', (SELECT COUNT(*) FROM patients WHERE assigned_doctor_id IS NOT NULL);
    RAISE NOTICE '========================================';
END $$;

-- Show patient-doctor assignments
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'PATIENT-DOCTOR ASSIGNMENTS:';
    FOR rec IN 
        SELECT p.full_name as patient, d.full_name as doctor, d.doctor_code
        FROM patients p 
        LEFT JOIN doctors d ON d.id = p.assigned_doctor_id
        ORDER BY p.full_name
    LOOP
        IF rec.doctor IS NOT NULL THEN
            RAISE NOTICE 'Patient: % → Doctor: % (Code: %)', rec.patient, rec.doctor, rec.doctor_code;
        ELSE
            RAISE NOTICE 'Patient: % → NO DOCTOR ASSIGNED', rec.patient;
        END IF;
    END LOOP;
END $$;

-- ========================================
-- 5. SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RLS POLICIES FIXED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New Policies Created:';
    RAISE NOTICE '- doctors_manage_own_profile';
    RAISE NOTICE '- patients_view_assigned_doctor';
    RAISE NOTICE '- patients_manage_own_profile';
    RAISE NOTICE '- doctors_view_assigned_patients';
    RAISE NOTICE '';
    RAISE NOTICE 'The 406 and 500 errors should now be resolved!';
    RAISE NOTICE 'Try refreshing the patient app.';
    RAISE NOTICE '========================================';
END $$;
