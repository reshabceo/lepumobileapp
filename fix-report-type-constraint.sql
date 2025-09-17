-- Fix the report_type constraint to allow custom_% patterns
-- First, drop the existing constraint if it exists
ALTER TABLE patient_uploads 
DROP CONSTRAINT IF EXISTS patient_uploads_report_type_check;

-- Add the correct constraint that allows custom_% patterns
ALTER TABLE patient_uploads 
ADD CONSTRAINT patient_uploads_report_type_check 
CHECK (report_type IN ('mri', 'prescription', 'lab_report', 'bp_report', 'others') OR report_type LIKE 'custom_%');

-- Verify the constraint is working by testing with a custom type
-- This should not error if the constraint is correct
INSERT INTO patient_uploads (patient_id, title, description, file_url, file_name, upload_source, report_type) 
VALUES ('test-id', 'Test', 'Test upload', 'test/path', 'test.pdf', 'patient', 'custom_test')
ON CONFLICT DO NOTHING;

-- Clean up the test record
DELETE FROM patient_uploads WHERE patient_id = 'test-id';
