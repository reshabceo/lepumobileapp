-- =====================================================
-- CHECK PATIENT_REPORTS TABLE
-- =====================================================

-- Check all records in patient_reports table
SELECT 
    id,
    patient_id,
    title,
    file_name,
    file_url,
    uploaded_by_patient,
    created_at
FROM patient_reports 
ORDER BY created_at DESC;

-- Check if there are any patient uploads in patient_reports
SELECT 
    COUNT(*) as patient_uploads_count
FROM patient_reports 
WHERE uploaded_by_patient = true;

-- Check if there are any doctor uploads in patient_reports
SELECT 
    COUNT(*) as doctor_uploads_count
FROM patient_reports 
WHERE uploaded_by_patient = false;

-- Check the structure of patient_reports table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'patient_reports' 
ORDER BY ordinal_position;
