-- =====================================================
-- CHECK PATIENT_REPORTS DATA
-- =====================================================

-- Get all records with their key fields
SELECT 
    id,
    patient_id,
    doctor_id,
    title,
    file_name,
    file_url,
    uploaded_by_patient,
    created_at
FROM patient_reports 
ORDER BY created_at DESC;

-- Check which records have doctor_id filled
SELECT 
    COUNT(*) as total_records,
    COUNT(doctor_id) as records_with_doctor_id,
    COUNT(*) - COUNT(doctor_id) as records_without_doctor_id
FROM patient_reports;

-- Check uploaded_by_patient distribution
SELECT 
    uploaded_by_patient,
    COUNT(*) as count
FROM patient_reports 
GROUP BY uploaded_by_patient;
