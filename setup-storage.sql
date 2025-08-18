-- Setup Supabase Storage for Profile Pictures
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. CREATE STORAGE BUCKET
-- ========================================

-- Create the profile-pictures bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 2. CREATE STORAGE POLICIES
-- ========================================

-- Policy: Allow authenticated users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile picture" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow authenticated users to view all profile pictures
CREATE POLICY "Anyone can view profile pictures" ON storage.objects
FOR SELECT USING (bucket_id = 'profile-pictures');

-- Policy: Allow users to update their own profile pictures
CREATE POLICY "Users can update their own profile picture" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Allow users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile picture" ON storage.objects
FOR DELETE USING (
  bucket_id = 'profile-pictures' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ========================================
-- 3. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to generate profile picture URL
CREATE OR REPLACE FUNCTION get_profile_picture_url(user_id UUID, filename TEXT)
RETURNS TEXT AS $$
BEGIN
  IF filename IS NULL OR filename = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN 'https://' || current_setting('app.settings.supabase_url', true) || 
         '/storage/v1/object/public/profile-pictures/' || 
         user_id::text || '/' || filename;
END;
$$ LANGUAGE plpgsql;

-- Function to delete old profile picture when updating
CREATE OR REPLACE FUNCTION delete_old_profile_picture()
RETURNS TRIGGER AS $$
BEGIN
  -- If profile_picture_url is being updated and old one exists
  IF OLD.profile_picture_url IS NOT NULL 
     AND OLD.profile_picture_url != NEW.profile_picture_url THEN
    
    -- Extract filename from old URL
    DECLARE
      old_filename TEXT;
    BEGIN
      old_filename := substring(OLD.profile_picture_url from '[^/]+$');
      
      -- Delete old file from storage
      DELETE FROM storage.objects 
      WHERE bucket_id = 'profile-pictures' 
        AND name = OLD.auth_user_id::text || '/' || old_filename;
    EXCEPTION
      WHEN OTHERS THEN
        -- Log error but don't fail the update
        RAISE WARNING 'Failed to delete old profile picture: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to doctors table
DROP TRIGGER IF EXISTS delete_old_doctor_profile_picture ON doctors;
CREATE TRIGGER delete_old_doctor_profile_picture
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION delete_old_profile_picture();

-- ========================================
-- 4. GRANT PERMISSIONS
-- ========================================

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_profile_picture_url(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_old_profile_picture() TO authenticated;

-- ========================================
-- 5. SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUPABASE STORAGE SETUP COMPLETE!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Created:';
    RAISE NOTICE '- profile-pictures bucket (5MB limit, images only)';
    RAISE NOTICE '- Storage policies for secure access';
    RAISE NOTICE '- Helper functions for URL generation';
    RAISE NOTICE '- Automatic cleanup triggers';
    RAISE NOTICE '';
    RAISE NOTICE 'Users can now upload profile pictures to:';
    RAISE NOTICE 'bucket: profile-pictures';
    RAISE NOTICE 'path: {user_id}/{filename}';
    RAISE NOTICE '========================================';
END $$;
