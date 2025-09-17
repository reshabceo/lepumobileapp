-- =====================================================
-- FIX RLS POLICY TO ALLOW VIEWING DOCTOR REPORTS
-- =====================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "patients_view_own_uploads" ON patient_uploads;

-- Create a new policy that allows patients to see:
-- 1. Their own uploads (patient_id matches their patient record)
-- 2. All doctor reports (upload_source = 'doctor')
CREATE POLICY "patients_view_uploads_and_doctor_reports" ON patient_uploads
FOR SELECT
TO authenticated
USING (
    -- Allow viewing own uploads
    patient_id IN (
        SELECT patients.id 
        FROM patients 
        WHERE patients.auth_user_id = auth.uid()
    )
    OR 
    -- Allow viewing all doctor reports
    upload_source = 'doctor'
);

-- Test the policy by running the same query the app uses
SELECT 
    id,
    patient_id,
    title,
    file_name,
    upload_source,
    created_at
FROM patient_uploads 
WHERE upload_source = 'doctor'
ORDER BY created_at DESC;
