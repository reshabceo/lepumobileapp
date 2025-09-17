-- =====================================================
-- ADD UPLOAD_SOURCE COLUMN TO PATIENT_UPLOADS TABLE
-- =====================================================

-- Add upload_source column to distinguish between patient and doctor uploads
ALTER TABLE patient_uploads 
ADD COLUMN IF NOT EXISTS upload_source VARCHAR(20) DEFAULT 'patient' 
CHECK (upload_source IN ('patient', 'doctor'));

-- Update existing records to be patient uploads
UPDATE patient_uploads 
SET upload_source = 'patient' 
WHERE upload_source IS NULL;

-- Create index for upload_source
CREATE INDEX IF NOT EXISTS idx_patient_uploads_upload_source ON patient_uploads(upload_source);
