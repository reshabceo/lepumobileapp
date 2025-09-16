-- =====================================================
-- DEBUG CURRENT REPORTS IN DATABASE
-- =====================================================

-- Check all records in patient_reports
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

-- Count patient vs doctor uploads
SELECT
    uploaded_by_patient,
    COUNT(*) as count
FROM patient_reports
GROUP BY uploaded_by_patient;
