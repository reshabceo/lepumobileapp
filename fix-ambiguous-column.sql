-- Fix Ambiguous Column Reference in create_patient_profile Function
-- Run this in Supabase SQL Editor

-- Drop and recreate the function with proper column qualification
DROP FUNCTION IF EXISTS create_patient_profile(UUID, TEXT, TEXT, TEXT);

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
    
    -- Find the doctor by code (case insensitive) - qualify column names
    SELECT d.* INTO doctor_record 
    FROM doctors d
    WHERE UPPER(d.doctor_code) = UPPER(doctor_code_input) AND d.is_active = true;
    
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
    
    -- Check if patient already exists - qualify column names
    IF EXISTS (SELECT 1 FROM patients p WHERE p.auth_user_id = create_patient_profile.auth_user_id) THEN
        RAISE NOTICE 'Patient already exists for user: %', auth_user_id;
        result := json_build_object(
            'success', false,
            'error', 'PATIENT_ALREADY_EXISTS',
            'message', 'Patient profile already exists for this user.'
        );
        RETURN result;
    END IF;
    
    -- Insert patient profile - use explicit parameter names
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
        create_patient_profile.auth_user_id,  -- Use function name qualification 
        create_patient_profile.full_name,
        create_patient_profile.email,
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

-- Test the function
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
        RAISE NOTICE 'Testing fixed function with doctor code: %', test_doctor_code;
        
        -- Test function call with a proper test UUID
        SELECT create_patient_profile(
            gen_random_uuid(),
            'Test Patient',
            'test@example.com',
            test_doctor_code
        ) INTO test_result;
        
        RAISE NOTICE 'Fixed function test result: %', test_result;
    ELSE
        RAISE NOTICE 'No active doctors found for testing';
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE '✅ AMBIGUOUS COLUMN ISSUE FIXED!';
    RAISE NOTICE 'The create_patient_profile function now uses qualified column names.';
    RAISE NOTICE 'Patient signup should work now!';
END $$;
