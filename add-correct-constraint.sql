-- Add the correct constraint that includes bp_report and custom_% patterns
ALTER TABLE patient_uploads 
ADD CONSTRAINT patient_uploads_report_type_check 
CHECK (report_type IN ('mri', 'prescription', 'lab_report', 'bp_report', 'others') OR report_type LIKE 'custom_%');
