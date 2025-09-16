-- =====================================================
-- CLEAN UP DUPLICATE HEIDI RECORDS
-- =====================================================

-- Delete all duplicate Heidi records, keeping only the most recent one
DELETE FROM patient_uploads 
WHERE title = 'Heidi Medical Report Template' 
AND id NOT IN (
    SELECT id FROM (
        SELECT id 
        FROM patient_uploads 
        WHERE title = 'Heidi Medical Report Template' 
        ORDER BY created_at DESC 
        LIMIT 1
    ) AS latest
);

-- Verify only one Heidi record remains
SELECT 
    id,
    title,
    file_name,
    upload_source,
    created_at
FROM patient_uploads 
WHERE title = 'Heidi Medical Report Template'
ORDER BY created_at DESC;
