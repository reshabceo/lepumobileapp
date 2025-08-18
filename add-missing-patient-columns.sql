-- Add missing columns to patients table
-- Run this in Supabase SQL Editor

-- Add profile_picture_url and phone_number columns if they don't exist
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT,
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone_number);

-- Update RLS policies to allow patients to manage their own profile pictures
CREATE POLICY IF NOT EXISTS "patients_manage_own_profile_picture" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'profile-pictures' AND
        auth.uid() IN (SELECT auth_user_id FROM patients)
    );

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Added missing columns to patients table:';
    RAISE NOTICE '  - profile_picture_url TEXT';
    RAISE NOTICE '  - phone_number TEXT';
    RAISE NOTICE '✅ Added index on phone_number';
    RAISE NOTICE '✅ Added RLS policy for patient profile pictures';
END $$;
