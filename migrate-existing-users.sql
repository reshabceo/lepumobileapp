-- Migrate Existing Users to New Schema
-- Run this in Supabase SQL Editor to move existing users to new patients/doctors tables

-- ========================================
-- 1. CHECK EXISTING DATA
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CHECKING EXISTING DATA...';
    RAISE NOTICE '========================================';
    
    -- Check if old user_profiles table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        RAISE NOTICE 'Found user_profiles table with % records', 
            (SELECT COUNT(*) FROM user_profiles);
    ELSE
        RAISE NOTICE 'No user_profiles table found';
    END IF;
    
    -- Check current patients table
    RAISE NOTICE 'Current patients table has % records', 
        (SELECT COUNT(*) FROM patients);
        
    -- Check current doctors table  
    RAISE NOTICE 'Current doctors table has % records', 
        (SELECT COUNT(*) FROM doctors);
END $$;

-- ========================================
-- 2. MIGRATE EXISTING DATA
-- ========================================

-- Migrate doctors from user_profiles to doctors table
INSERT INTO doctors (
    auth_user_id,
    doctor_code,
    full_name,
    email,
    specialty,
    hospital,
    phone_number,
    profile_picture_url,
    is_active,
    created_at,
    updated_at
)
SELECT DISTINCT
    up.id,
    up.doctor_code,
    up.name,
    au.email,
    'General Practice', -- Default specialty
    'Hospital', -- Default hospital
    '+1234567890', -- Default phone
    null, -- No profile picture
    true,
    up.created_at,
    up.updated_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
WHERE up.role = 'doctor' 
  AND up.doctor_code IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM doctors d WHERE d.auth_user_id = up.id
  );

-- Migrate patients from user_profiles to patients table
INSERT INTO patients (
    auth_user_id,
    full_name,
    email,
    assigned_doctor_id,
    is_active,
    created_at,
    updated_at
)
SELECT DISTINCT
    up.id,
    up.name,
    au.email,
    d.id, -- Get doctor ID from doctors table
    true,
    up.created_at,
    up.updated_at
FROM user_profiles up
JOIN auth.users au ON au.id = up.id
LEFT JOIN user_profiles doctor_profile ON doctor_profile.id = up.doctor_id
LEFT JOIN doctors d ON d.doctor_code = doctor_profile.doctor_code
WHERE (up.role = 'user' OR up.role IS NULL OR up.role = '')
  AND NOT EXISTS (
      SELECT 1 FROM patients p WHERE p.auth_user_id = up.id
  );

-- ========================================
-- 3. FIX ORPHANED PATIENTS (without assigned doctor)
-- ========================================

-- For patients who don't have an assigned doctor, try to find one by doctor_code
UPDATE patients 
SET assigned_doctor_id = (
    SELECT d.id 
    FROM doctors d 
    WHERE d.doctor_code = (
        SELECT up.doctor_code 
        FROM user_profiles up 
        WHERE up.id = patients.auth_user_id 
        AND up.doctor_code IS NOT NULL
        LIMIT 1
    )
    LIMIT 1
)
WHERE assigned_doctor_id IS NULL;

-- ========================================
-- 4. MIGRATE VITAL SIGNS DATA
-- ========================================

-- Update vital_signs to use patient_id and doctor_id from new tables
UPDATE vital_signs 
SET 
    patient_id = p.id,
    doctor_id = p.assigned_doctor_id
FROM patients p
WHERE vital_signs.user_id = p.auth_user_id
  AND vital_signs.patient_id IS NULL;

-- ========================================
-- 5. VERIFY MIGRATION
-- ========================================

DO $$
DECLARE
    migrated_doctors INTEGER;
    migrated_patients INTEGER;
    patients_with_doctors INTEGER;
    updated_vitals INTEGER;
BEGIN
    -- Count migrated data
    SELECT COUNT(*) INTO migrated_doctors FROM doctors;
    SELECT COUNT(*) INTO migrated_patients FROM patients;
    SELECT COUNT(*) INTO patients_with_doctors FROM patients WHERE assigned_doctor_id IS NOT NULL;
    SELECT COUNT(*) INTO updated_vitals FROM vital_signs WHERE patient_id IS NOT NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migrated % doctors', migrated_doctors;
    RAISE NOTICE 'Migrated % patients', migrated_patients;
    RAISE NOTICE '% patients have assigned doctors', patients_with_doctors;
    RAISE NOTICE '% vital signs records updated', updated_vitals;
    
    -- Show specific patient-doctor assignments
    FOR rec IN 
        SELECT p.full_name as patient_name, d.full_name as doctor_name, d.doctor_code
        FROM patients p 
        JOIN doctors d ON d.id = p.assigned_doctor_id
        ORDER BY p.full_name
    LOOP
        RAISE NOTICE 'Patient: % → Doctor: % (Code: %)', rec.patient_name, rec.doctor_name, rec.doctor_code;
    END LOOP;
    
    RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 6. TEST QUERIES
-- ========================================

-- Test query: Get patient with their doctor
SELECT 
    p.full_name as patient_name,
    p.auth_user_id,
    d.full_name as doctor_name,
    d.doctor_code,
    d.specialty,
    d.hospital
FROM patients p
LEFT JOIN doctors d ON d.id = p.assigned_doctor_id
ORDER BY p.full_name;

-- Test query: Check for any patients without doctors
SELECT 
    p.full_name as patient_name,
    p.auth_user_id,
    'NO DOCTOR ASSIGNED' as issue
FROM patients p
WHERE p.assigned_doctor_id IS NULL;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRATION SUCCESSFUL!';
    RAISE NOTICE 'Existing users have been migrated to new schema.';
    RAISE NOTICE 'Try refreshing the patient app now.';
    RAISE NOTICE '========================================';
END $$;
