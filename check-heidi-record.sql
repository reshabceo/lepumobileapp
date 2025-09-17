-- =====================================================
-- CHECK IF HEIDI RECORD EXISTS IN DATABASE
-- =====================================================

-- Check if the Heidi record exists
SELECT 
    id,
    patient_id,
    title,
    file_name,
    file_url,
    upload_source,
    created_at
FROM patient_uploads 
WHERE file_name LIKE '%Heidi%' 
   OR title LIKE '%Heidi%'
   OR file_url LIKE '%Heidi%';

-- Check all records in patient_uploads table
SELECT 
    id,
    patient_id,
    title,
    file_name,
    upload_source,
    created_at
FROM patient_uploads 
ORDER BY created_at DESC;

-- Check if upload_source column exists and has data
SELECT 
    upload_source,
    COUNT(*) as count
FROM patient_uploads 
GROUP BY upload_source;
