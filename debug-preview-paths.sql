-- Check the actual file paths in patient_uploads table
SELECT 
    id,
    title,
    file_url,
    file_name,
    upload_source,
    created_at
FROM patient_uploads 
WHERE upload_source = 'patient'
ORDER BY created_at DESC
LIMIT 5;
