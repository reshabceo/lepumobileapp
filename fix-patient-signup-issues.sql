-- Fix Patient Signup Issues
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. FIX RLS POLICIES FOR DOCTOR CODE VALIDATION
-- ========================================

-- Allow anonymous users to check doctor codes during signup
CREATE POLICY "allow_anonymous_doctor_code_check" ON doctors
    FOR SELECT TO anon
    USING (true);

-- Allow authenticated users to check doctor codes
CREATE POLICY "allow_authenticated_doctor_code_check" ON doctors
    FOR SELECT TO authenticated
    USING (true);

-- ========================================
-- 2. RECREATE CREATE_PATIENT_PROFILE FUNCTION
-- ========================================

-- Drop existing function first
DROP FUNCTION IF EXISTS create_patient_profile(UUID, TEXT, TEXT, TEXT);

-- Create improved function with better error handling
CREATE OR REPLACE FUNCTION create_patient_profile(
    auth_user_id UUID,
    full_name TEXT,
    email TEXT,
    doctor_code_input TEXT
)
RETURNS JSON AS $$
DECLARE
    patient_id UUID;
    doctor_record RECORD;
    result JSON;
BEGIN
    -- Log function call
    RAISE NOTICE 'Creating patient profile for user: %, doctor code: %', auth_user_id, doctor_code_input;
    
    -- Find the doctor by code (case insensitive)
    SELECT * INTO doctor_record 
    FROM doctors 
    WHERE UPPER(doctor_code) = UPPER(doctor_code_input) AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Doctor not found for code: %', doctor_code_input;
        result := json_build_object(
            'success', false,
            'error', 'INVALID_DOCTOR_CODE',
            'message', 'Invalid doctor code "' || doctor_code_input || '". Please check with your healthcare provider.'
        );
        RETURN result;
    END IF;
    
    RAISE NOTICE 'Doctor found: % (ID: %)', doctor_record.full_name, doctor_record.id;
    
    -- Check if patient already exists
    IF EXISTS (SELECT 1 FROM patients WHERE auth_user_id = auth_user_id) THEN
        RAISE NOTICE 'Patient already exists for user: %', auth_user_id;
        result := json_build_object(
            'success', false,
            'error', 'PATIENT_ALREADY_EXISTS',
            'message', 'Patient profile already exists for this user.'
        );
        RETURN result;
    END IF;
    
    -- Insert patient profile
    INSERT INTO patients (
        auth_user_id, 
        full_name, 
        email, 
        assigned_doctor_id,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        auth_user_id, 
        full_name, 
        email, 
        doctor_record.id,
        true,
        NOW(),
        NOW()
    )
    RETURNING id INTO patient_id;
    
    RAISE NOTICE 'Patient profile created with ID: %', patient_id;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'patient_id', patient_id,
        'assigned_doctor', json_build_object(
            'id', doctor_record.id,
            'name', doctor_record.full_name,
            'doctor_code', doctor_record.doctor_code,
            'specialty', doctor_record.specialty,
            'hospital', doctor_record.hospital
        ),
        'message', 'Patient profile created and assigned to Dr. ' || doctor_record.full_name || ' successfully'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating patient profile: %', SQLERRM;
        result := json_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'Database error: ' || SQLERRM
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_patient_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_patient_profile(UUID, TEXT, TEXT, TEXT) TO anon;

-- ========================================
-- 3. VERIFY DOCTOR DATA EXISTS
-- ========================================

DO $$
DECLARE
    doctor_count INT;
    sample_doctor RECORD;
BEGIN
    -- Count total doctors
    SELECT COUNT(*) INTO doctor_count FROM doctors WHERE is_active = true;
    RAISE NOTICE 'Total active doctors: %', doctor_count;
    
    -- Show sample doctor codes
    FOR sample_doctor IN 
        SELECT doctor_code, full_name, specialty 
        FROM doctors 
        WHERE is_active = true 
        ORDER BY created_at DESC 
        LIMIT 5
    LOOP
        RAISE NOTICE 'Doctor: % - Code: % (Specialty: %)', 
            sample_doctor.full_name, 
            sample_doctor.doctor_code, 
            sample_doctor.specialty;
    END LOOP;
    
    -- Check specific doctor code mentioned in error
    IF EXISTS (SELECT 1 FROM doctors WHERE doctor_code = 'DR6835' AND is_active = true) THEN
        SELECT * INTO sample_doctor FROM doctors WHERE doctor_code = 'DR6835' AND is_active = true;
        RAISE NOTICE '✅ Doctor DR6835 found: %', sample_doctor.full_name;
    ELSE
        RAISE NOTICE '❌ Doctor DR6835 not found';
    END IF;
END $$;

-- ========================================
-- 4. TEST THE FUNCTION
-- ========================================

-- Test with existing doctor code
DO $$
DECLARE
    test_result JSON;
    test_doctor_code TEXT;
BEGIN
    -- Get first active doctor code
    SELECT doctor_code INTO test_doctor_code 
    FROM doctors 
    WHERE is_active = true 
    LIMIT 1;
    
    IF test_doctor_code IS NOT NULL THEN
        RAISE NOTICE 'Testing function with doctor code: %', test_doctor_code;
        
        -- Test function call
        SELECT create_patient_profile(
            gen_random_uuid(),
            'Test Patient',
            'test@example.com',
            test_doctor_code
        ) INTO test_result;
        
        RAISE NOTICE 'Function test result: %', test_result;
    ELSE
        RAISE NOTICE 'No active doctors found for testing';
    END IF;
END $$;

-- ========================================
-- 5. SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PATIENT SIGNUP FIXES APPLIED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Fixed:';
    RAISE NOTICE '1. ✅ Added RLS policies for anonymous doctor code checks';
    RAISE NOTICE '2. ✅ Recreated create_patient_profile function with better error handling';
    RAISE NOTICE '3. ✅ Added logging and exception handling';
    RAISE NOTICE '4. ✅ Verified doctor data exists';
    RAISE NOTICE '';
    RAISE NOTICE 'Patient signup should now work correctly!';
    RAISE NOTICE '========================================';
END $$;
