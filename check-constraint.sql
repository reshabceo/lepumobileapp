-- Check the current constraint on patient_uploads table
SELECT 
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'patient_uploads'::regclass 
AND conname LIKE '%report_type%';
