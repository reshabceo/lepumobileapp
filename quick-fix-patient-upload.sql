-- Quick Fix for Patient Upload RLS Error
-- Run this in Supabase SQL Editor

-- 1. Add the essential columns to patient_reports table
ALTER TABLE patient_reports 
ADD COLUMN IF NOT EXISTS uploaded_by_patient BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS upload_status VARCHAR(20) DEFAULT 'uploaded',
ADD COLUMN IF NOT EXISTS patient_notes TEXT;

-- 2. Update existing reports to mark them as from doctor
UPDATE patient_reports 
SET uploaded_by_patient = FALSE 
WHERE uploaded_by_patient IS NULL;

-- 3. Add RLS policy for patients to upload their own reports
CREATE POLICY "patients_upload_own_reports" ON patient_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        uploaded_by_patient = TRUE AND
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- 4. Add RLS policy for patients to update their uploaded reports
CREATE POLICY "patients_update_uploaded_reports" ON patient_reports
    FOR UPDATE TO authenticated
    USING (
        uploaded_by_patient = TRUE AND
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- 5. Add RLS policy for patients to delete their uploaded reports
CREATE POLICY "patients_delete_uploaded_reports" ON patient_reports
    FOR DELETE TO authenticated
    USING (
        uploaded_by_patient = TRUE AND
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- 6. Update storage policy for patient uploads
CREATE POLICY "patients_upload_own_report_files" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'patient-reports' AND
        auth.uid() IN (
            SELECT p.auth_user_id 
            FROM patients p
            WHERE p.auth_user_id = auth.uid()
        )
    );

-- 7. Update storage policy for patients to manage their uploaded files
CREATE POLICY "patients_manage_uploaded_files" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'patient-reports' AND
        auth.uid() IN (
            SELECT p.auth_user_id 
            FROM patients p
            WHERE p.auth_user_id = auth.uid()
        )
    );
