-- Add report_type column to patient_uploads table
ALTER TABLE patient_uploads 
ADD COLUMN IF NOT EXISTS report_type VARCHAR(50) DEFAULT 'others' 
CHECK (report_type IN ('mri', 'prescription', 'lab_report', 'bp_report', 'others') OR report_type LIKE 'custom_%');

-- Add an index for better performance
CREATE INDEX IF NOT EXISTS idx_patient_uploads_report_type ON patient_uploads(report_type);

-- Update existing records to have a default report_type
UPDATE patient_uploads 
SET report_type = 'others' 
WHERE report_type IS NULL;
