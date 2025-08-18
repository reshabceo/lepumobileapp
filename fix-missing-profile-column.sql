-- Add profile_picture_url column to patients table
-- Run this in Supabase SQL Editor

-- Add the missing column
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS profile_picture_url TEXT;

-- Create index for faster lookups (optional but good practice)
CREATE INDEX IF NOT EXISTS idx_patients_profile_picture ON patients(profile_picture_url);

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'patients' 
          AND column_name = 'profile_picture_url'
    ) THEN
        RAISE NOTICE '✅ SUCCESS: profile_picture_url column added to patients table';
    ELSE
        RAISE NOTICE '❌ FAILED: profile_picture_url column was not added';
    END IF;
END $$;
