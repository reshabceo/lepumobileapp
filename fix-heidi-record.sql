-- =====================================================
-- FIX HEIDI RECORD IN DATABASE
-- =====================================================

-- First, let's see what's currently in the database
SELECT 
    id,
    title,
    file_name,
    file_url,
    upload_source,
    created_at
FROM patient_uploads 
WHERE file_name LIKE '%Heidi%' 
   OR title LIKE '%Heidi%'
   OR file_url LIKE '%Heidi%';

-- If no Heidi record exists, insert it
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
    'Heidi-Medical-Report-Template-PDF.pdf',  -- Direct path in bucket
    'Heidi-Medical-Report-Template-PDF.pdf',
    500000,  -- Approximate file size
    'application/pdf',
    'uploaded',
    'doctor',  -- This will show in "From Your Doctor" section
    'Uploaded via Supabase Storage for testing',
    NOW()
)
ON CONFLICT (id) DO NOTHING;  -- Don't insert if already exists

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

-- Show all doctor records
SELECT 
    id,
    title,
    file_name,
    upload_source,
    created_at
FROM patient_uploads 
WHERE upload_source = 'doctor'
ORDER BY created_at DESC;
