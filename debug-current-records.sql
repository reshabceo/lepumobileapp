-- =====================================================
-- DEBUG CURRENT RECORDS IN DATABASE
-- =====================================================

-- Check all records in patient_uploads
SELECT 
    id,
    title,
    file_name,
    upload_source,
    file_url,
    created_at
FROM patient_uploads 
ORDER BY created_at DESC;

-- Check if there are any patient uploads
SELECT 
    COUNT(*) as patient_uploads_count
FROM patient_uploads 
WHERE upload_source = 'patient';

-- Check if there are any doctor uploads
SELECT 
    COUNT(*) as doctor_uploads_count
FROM patient_uploads 
WHERE upload_source = 'doctor';
