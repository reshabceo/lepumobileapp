-- Comprehensive Diagnostic and Fix for Patient-Doctor Issue
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. DIAGNOSE CURRENT DATA STATE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PATIENT-DOCTOR SYSTEM DIAGNOSIS';
    RAISE NOTICE '========================================';
    
    -- Check tables exist
    RAISE NOTICE 'Tables status:';
    RAISE NOTICE 'Doctors table exists: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctors'));
    RAISE NOTICE 'Patients table exists: %', (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'patients'));
    
    -- Check data counts
    RAISE NOTICE '';
    RAISE NOTICE 'Data counts:';
    RAISE NOTICE 'Total doctors: %', (SELECT COUNT(*) FROM doctors);
    RAISE NOTICE 'Total patients: %', (SELECT COUNT(*) FROM patients);
    RAISE NOTICE 'Active doctors: %', (SELECT COUNT(*) FROM doctors WHERE is_active = true);
    
    -- Check specific user
    RAISE NOTICE '';
    RAISE NOTICE 'Checking user: 272ae758-4363-4809-adef-8347dcb36a41';
    RAISE NOTICE 'Patient exists: %', (SELECT EXISTS (SELECT 1 FROM patients WHERE auth_user_id = '272ae758-4363-4809-adef-8347dcb36a41'));
    RAISE NOTICE 'Doctor exists: %', (SELECT EXISTS (SELECT 1 FROM doctors WHERE auth_user_id = '272ae758-4363-4809-adef-8347dcb36a41'));
    
END $$;

-- Show all patients and their doctor assignments
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ALL PATIENTS AND DOCTOR ASSIGNMENTS:';
    RAISE NOTICE '========================================';
    
    FOR rec IN 
        SELECT 
            p.auth_user_id,
            p.full_name as patient_name,
            p.assigned_doctor_id,
            d.full_name as doctor_name,
            d.doctor_code,
            d.is_active as doctor_active
        FROM patients p 
        LEFT JOIN doctors d ON d.id = p.assigned_doctor_id
        ORDER BY p.full_name
    LOOP
        IF rec.doctor_name IS NOT NULL THEN
            RAISE NOTICE 'Patient: % (ID: %) → Doctor: % (Code: %, Active: %)', 
                rec.patient_name, 
                rec.auth_user_id, 
                rec.doctor_name, 
                rec.doctor_code,
                rec.doctor_active;
        ELSE
            RAISE NOTICE 'Patient: % (ID: %) → NO DOCTOR ASSIGNED', 
                rec.patient_name, 
                rec.auth_user_id;
        END IF;
    END LOOP;
END $$;

-- Check RLS policies
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CURRENT RLS POLICIES:';
    RAISE NOTICE '========================================';
    
    RAISE NOTICE 'Patients table policies:';
    FOR rec IN 
        SELECT policyname, cmd, permissive, qual 
        FROM pg_policies 
        WHERE tablename = 'patients'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '- %: % (CMD: %)', rec.policyname, rec.permissive, rec.cmd;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Doctors table policies:';
    FOR rec IN 
        SELECT policyname, cmd, permissive, qual 
        FROM pg_policies 
        WHERE tablename = 'doctors'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '- %: % (CMD: %)', rec.policyname, rec.permissive, rec.cmd;
    END LOOP;
END $$;

-- ========================================
-- 2. FIX MISSING PATIENT DATA
-- ========================================

-- Check if the specific user exists in patients table
DO $$
DECLARE
    user_exists BOOLEAN;
    user_id UUID := '272ae758-4363-4809-adef-8347dcb36a41';
BEGIN
    SELECT EXISTS (SELECT 1 FROM patients WHERE auth_user_id = user_id) INTO user_exists;
    
    IF NOT user_exists THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'FIXING MISSING PATIENT DATA';
        RAISE NOTICE '========================================';
        
        -- Create missing patient record
        INSERT INTO patients (
            auth_user_id,
            full_name,
            email,
            phone_number,
            assigned_doctor_id,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            user_id,
            'Test Patient', -- You should update this with real name
            'patient@test.com', -- You should update this with real email
            '+1234567890', -- You should update this with real phone
            (SELECT id FROM doctors WHERE is_active = true LIMIT 1), -- Assign to first active doctor
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created missing patient record for user: %', user_id;
        RAISE NOTICE 'Assigned to doctor: %', (SELECT doctor_code FROM doctors WHERE is_active = true LIMIT 1);
    ELSE
        RAISE NOTICE 'Patient record already exists for user: %', user_id;
    END IF;
END $$;

-- ========================================
-- 3. RESET AND FIX RLS POLICIES
-- ========================================

-- Drop all existing policies on patients
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESETTING PATIENTS TABLE POLICIES';
    RAISE NOTICE '========================================';
    
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'patients'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON patients';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Create new, working policies for patients
CREATE POLICY "patients_select_own_profile" ON patients
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "patients_update_own_profile" ON patients
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "patients_insert_own_profile" ON patients
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Create policy for doctors to view their assigned patients
CREATE POLICY "doctors_view_assigned_patients" ON patients
    FOR SELECT USING (
        assigned_doctor_id IN (
            SELECT id FROM doctors WHERE auth_user_id = auth.uid()
        )
    );

-- Drop all existing policies on doctors
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'RESETTING DOCTORS TABLE POLICIES';
    
    FOR policy_record IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'doctors'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON doctors';
        RAISE NOTICE 'Dropped policy: %', policy_record.policyname;
    END LOOP;
END $$;

-- Create new, working policies for doctors
CREATE POLICY "doctors_manage_own_profile" ON doctors
    FOR ALL USING (auth.uid() = auth_user_id);

-- This is the CRITICAL policy - allows patients to see their assigned doctor
CREATE POLICY "patients_view_their_assigned_doctor" ON doctors
    FOR SELECT USING (
        id IN (
            SELECT assigned_doctor_id 
            FROM patients 
            WHERE auth_user_id = auth.uid() 
            AND assigned_doctor_id IS NOT NULL
        )
    );

-- ========================================
-- 4. VERIFY THE FIX
-- ========================================

DO $$
DECLARE
    user_id UUID := '272ae758-4363-4809-adef-8347dcb36a41';
    patient_data RECORD;
    doctor_data RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    
    -- Check patient data
    SELECT * INTO patient_data FROM patients WHERE auth_user_id = user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Patient found: % (Doctor ID: %)', patient_data.full_name, patient_data.assigned_doctor_id;
        
        -- Check doctor data
        IF patient_data.assigned_doctor_id IS NOT NULL THEN
            SELECT * INTO doctor_data FROM doctors WHERE id = patient_data.assigned_doctor_id;
            IF FOUND THEN
                RAISE NOTICE 'Assigned doctor: % (Code: %)', doctor_data.full_name, doctor_data.doctor_code;
                RAISE NOTICE '✅ Patient-Doctor relationship is properly set up!';
            ELSE
                RAISE NOTICE '❌ Assigned doctor not found in doctors table';
            END IF;
        ELSE
            RAISE NOTICE '❌ No doctor assigned to patient';
        END IF;
    ELSE
        RAISE NOTICE '❌ Patient not found in patients table';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'New RLS Policies Created:';
    RAISE NOTICE '- patients_select_own_profile';
    RAISE NOTICE '- patients_update_own_profile'; 
    RAISE NOTICE '- patients_insert_own_profile';
    RAISE NOTICE '- doctors_view_assigned_patients';
    RAISE NOTICE '- doctors_manage_own_profile';
    RAISE NOTICE '- patients_view_their_assigned_doctor';
    RAISE NOTICE '';
    RAISE NOTICE 'The 500 errors should now be resolved!';
    RAISE NOTICE '========================================';
END $$;
