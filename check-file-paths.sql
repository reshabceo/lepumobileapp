-- Check the exact file paths in the database
SELECT 
    id,
    title,
    file_url,
    file_name,
    upload_source,
    created_at
FROM patient_uploads 
WHERE title LIKE '%Heidi%' 
   OR file_name LIKE '%Heidi%'
   OR file_url LIKE '%Heidi%'
ORDER BY created_at DESC;
