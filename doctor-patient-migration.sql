-- Doctor-Patient Relationship Migration
-- Run this SQL in your Supabase SQL Editor to add doctor-patient functionality
-- This uses ALTER TABLE statements to modify existing tables safely

-- ========================================
-- 1. ADD NEW COLUMNS TO EXISTING TABLES
-- ========================================

-- Add doctor relationship fields to user_profiles table
DO $$ 
BEGIN
    -- Add doctor_id column (patient's assigned doctor)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'doctor_id'
    ) THEN
        ALTER TABLE user_profiles 
        ADD COLUMN doctor_id UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'Added doctor_id column to user_profiles table';
    ELSE
        RAISE NOTICE 'doctor_id column already exists in user_profiles table';
    END IF;

    -- Add doctor_code column (unique code for doctor identification)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' AND column_name = 'doctor_code'
    ) THEN
        ALTER TABLE user_profiles 
        ADD COLUMN doctor_code TEXT;
        
        RAISE NOTICE 'Added doctor_code column to user_profiles table';
    ELSE
        RAISE NOTICE 'doctor_code column already exists in user_profiles table';
    END IF;
END $$;

-- Add doctor_id to vital_signs table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vital_signs' AND column_name = 'doctor_id'
    ) THEN
        ALTER TABLE vital_signs 
        ADD COLUMN doctor_id UUID REFERENCES auth.users(id);
        
        RAISE NOTICE 'Added doctor_id column to vital_signs table';
    ELSE
        RAISE NOTICE 'doctor_id column already exists in vital_signs table';
    END IF;
END $$;

-- ========================================
-- 2. CREATE NEW INDEXES FOR PERFORMANCE
-- ========================================

-- Index for doctor_id in user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_id ON user_profiles(doctor_id);

-- Index for doctor_code in user_profiles (for fast doctor lookup)
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_code ON user_profiles(doctor_code);

-- Index for doctor_id in vital_signs (for doctor queries)
CREATE INDEX IF NOT EXISTS idx_vital_signs_doctor_id ON vital_signs(doctor_id);

-- ========================================
-- 3. UPDATE ROW LEVEL SECURITY POLICIES
-- ========================================

-- Add new RLS policy for doctors to view patient vital signs
DO $$
BEGIN
    -- Drop existing policy if it exists and recreate it
    DROP POLICY IF EXISTS "Doctors can view patient vital signs" ON vital_signs;
    
    CREATE POLICY "Doctors can view patient vital signs" ON vital_signs
      FOR SELECT USING (auth.uid() = doctor_id);
      
    RAISE NOTICE 'Created RLS policy for doctors to view patient vital signs';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Policy creation skipped or failed: %', SQLERRM;
END $$;

-- ========================================
-- 4. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to generate unique doctor codes
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

-- Function to assign doctor to patient using doctor code
CREATE OR REPLACE FUNCTION assign_doctor_to_patient(patient_id UUID, doctor_code_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    doctor_uuid UUID;
BEGIN
    -- Find doctor by code
    SELECT id INTO doctor_uuid 
    FROM user_profiles 
    WHERE doctor_code = doctor_code_input AND role = 'doctor';
    
    -- If doctor not found, return false
    IF doctor_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update patient's doctor assignment
    UPDATE user_profiles 
    SET doctor_id = doctor_uuid 
    WHERE id = patient_id AND role = 'user';
    
    -- Return true if update was successful
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get doctor's patients
CREATE OR REPLACE FUNCTION get_doctor_patients(doctor_uuid UUID)
RETURNS TABLE(
    patient_id UUID,
    patient_name TEXT,
    patient_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.name,
        au.email,
        up.created_at
    FROM user_profiles up
    JOIN auth.users au ON au.id = up.id
    WHERE up.doctor_id = doctor_uuid 
    AND up.role = 'user'
    ORDER BY up.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. CREATE TRIGGERS FOR AUTOMATIC DOCTOR CODE GENERATION
-- ========================================

-- Function to auto-generate doctor code when doctor is created
CREATE OR REPLACE FUNCTION auto_generate_doctor_code()
RETURNS TRIGGER AS $$
BEGIN
    -- If this is a doctor and no doctor_code is set, generate one
    IF NEW.role = 'doctor' AND (NEW.doctor_code IS NULL OR NEW.doctor_code = '') THEN
        NEW.doctor_code := generate_doctor_code();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating doctor codes
DROP TRIGGER IF EXISTS trigger_auto_generate_doctor_code ON user_profiles;
CREATE TRIGGER trigger_auto_generate_doctor_code
    BEFORE INSERT OR UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION auto_generate_doctor_code();

-- ========================================
-- 6. GRANT PERMISSIONS
-- ========================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION generate_doctor_code() TO authenticated;
GRANT EXECUTE ON FUNCTION assign_doctor_to_patient(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_doctor_patients(UUID) TO authenticated;

-- ========================================
-- 7. MIGRATION VERIFICATION
-- ========================================

-- Function to verify migration was successful
CREATE OR REPLACE FUNCTION verify_doctor_patient_migration()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check if doctor_id column exists in user_profiles
    RETURN QUERY
    SELECT 
        'user_profiles.doctor_id'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_profiles' AND column_name = 'doctor_id'
        ) THEN 'OK' ELSE 'MISSING' END,
        'Column for patient-doctor relationship'::TEXT;
    
    -- Check if doctor_code column exists in user_profiles
    RETURN QUERY
    SELECT 
        'user_profiles.doctor_code'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'user_profiles' AND column_name = 'doctor_code'
        ) THEN 'OK' ELSE 'MISSING' END,
        'Column for unique doctor identification'::TEXT;
    
    -- Check if doctor_id column exists in vital_signs
    RETURN QUERY
    SELECT 
        'vital_signs.doctor_id'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'vital_signs' AND column_name = 'doctor_id'
        ) THEN 'OK' ELSE 'MISSING' END,
        'Column for linking vital signs to doctors'::TEXT;
    
    -- Check if indexes exist
    RETURN QUERY
    SELECT 
        'indexes'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname IN ('idx_user_profiles_doctor_id', 'idx_user_profiles_doctor_code', 'idx_vital_signs_doctor_id')
        ) THEN 'OK' ELSE 'MISSING' END,
        'Performance indexes for doctor-patient queries'::TEXT;
    
    -- Check if functions exist
    RETURN QUERY
    SELECT 
        'functions'::TEXT,
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_proc 
            WHERE proname IN ('generate_doctor_code', 'assign_doctor_to_patient', 'get_doctor_patients')
        ) THEN 'OK' ELSE 'MISSING' END,
        'Helper functions for doctor-patient management'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- 8. FINAL NOTES AND VERIFICATION
-- ========================================

-- Run verification
SELECT * FROM verify_doctor_patient_migration();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DOCTOR-PATIENT MIGRATION COMPLETED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Verify migration results above';
    RAISE NOTICE '2. Test doctor code generation by creating a doctor user';
    RAISE NOTICE '3. Test patient assignment using assign_doctor_to_patient()';
    RAISE NOTICE '4. Update your application code to use new fields';
    RAISE NOTICE '========================================';
END $$;

-- Example usage (commented out - uncomment to test):
-- SELECT generate_doctor_code(); -- Should return something like 'DR1234'
-- SELECT assign_doctor_to_patient('patient-uuid-here', 'DR1234'); -- Should return true/false
-- SELECT * FROM get_doctor_patients('doctor-uuid-here'); -- Should return patient list
