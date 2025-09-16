-- =====================================================
-- ADD HEIDI MEDICAL REPORT TO PATIENT_UPLOADS TABLE
-- =====================================================

-- First, add the upload_source column if it doesn't exist
ALTER TABLE patient_uploads 
ADD COLUMN IF NOT EXISTS upload_source VARCHAR(20) DEFAULT 'patient' 
CHECK (upload_source IN ('patient', 'doctor'));

-- Insert the Heidi Medical Report that was uploaded to storage
INSERT INTO patient_uploads (
    patient_id,
    title,
    description,
    file_url,
    file_name,
    file_size,
    mime_type,
    upload_status,
    upload_source,
    patient_notes,
    created_at
) VALUES (
    (SELECT id FROM patients LIMIT 1),
    'Heidi Medical Report Template',
    'Medical report template uploaded for testing download functionality',
    'patient-reports/Heidi-Medical-Report-Template-PDF.pdf',  -- The file you uploaded
    'Heidi-Medical-Report-Template-PDF.pdf',
    500000,  -- Approximate file size (adjust if needed)
    'application/pdf',
    'uploaded',
    'doctor',  -- This will show in "From Your Doctor" section
    'Uploaded via Supabase Storage for testing',
    NOW()
);

-- Verify the insert
SELECT 
    id,
    patient_id,
    title,
    file_name,
    file_url,
    upload_source,
    created_at
FROM patient_uploads 
WHERE file_name = 'Heidi-Medical-Report-Template-PDF.pdf';
