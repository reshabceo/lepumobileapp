-- =====================================================
-- SEED DOCTOR REPORTS TO PATIENT_UPLOADS TABLE
-- =====================================================

-- First, add the upload_source column if it doesn't exist
ALTER TABLE patient_uploads 
ADD COLUMN IF NOT EXISTS upload_source VARCHAR(20) DEFAULT 'patient' 
CHECK (upload_source IN ('patient', 'doctor'));

-- Insert sample doctor reports into patient_uploads table
-- These will show up in "From Your Doctor" section

INSERT INTO patient_uploads (
    patient_id,
    title,
    description,
    file_url,
    file_name,
    file_size,
    mime_type,
    upload_status,
    upload_source,
    patient_notes,
    created_at
) VALUES 
-- Get the first patient's ID and create doctor reports for them
(
    (SELECT id FROM patients LIMIT 1),
    'Blood Test Results - January 2024',
    'Complete blood count and metabolic panel results showing normal ranges across all parameters.',
    'doctor-reports/blood-test-jan-2024.pdf',
    'blood-test-jan-2024.pdf',
    245760, -- 240 KB
    'application/pdf',
    'uploaded',
    'doctor',
    'Uploaded by Dr. Smith',
    NOW() - INTERVAL '5 days'
),
(
    (SELECT id FROM patients LIMIT 1),
    'ECG Report - February 2024',
    'Electrocardiogram showing normal sinus rhythm with no abnormalities detected.',
    'doctor-reports/ecg-feb-2024.pdf',
    'ecg-feb-2024.pdf',
    189440, -- 185 KB
    'application/pdf',
    'uploaded',
    'doctor',
    'Uploaded by Dr. Johnson',
    NOW() - INTERVAL '3 days'
),
(
    (SELECT id FROM patients LIMIT 1),
    'X-Ray Chest - March 2024',
    'Chest X-ray showing clear lung fields with no signs of infection or abnormalities.',
    'doctor-reports/xray-chest-mar-2024.pdf',
    'xray-chest-mar-2024.pdf',
    512000, -- 500 KB
    'application/pdf',
    'uploaded',
    'doctor',
    'Uploaded by Dr. Williams',
    NOW() - INTERVAL '1 day'
),
(
    (SELECT id FROM patients LIMIT 1),
    'Prescription - April 2024',
    'Medication prescription for blood pressure management and follow-up instructions.',
    'doctor-reports/prescription-apr-2024.pdf',
    'prescription-apr-2024.pdf',
    98304, -- 96 KB
    'application/pdf',
    'uploaded',
    'doctor',
    'Uploaded by Dr. Brown',
    NOW() - INTERVAL '2 hours'
),
(
    (SELECT id FROM patients LIMIT 1),
    'MRI Brain Scan - May 2024',
    'Magnetic resonance imaging of the brain showing normal structure and no abnormalities.',
    'doctor-reports/mri-brain-may-2024.pdf',
    'mri-brain-may-2024.pdf',
    1048576, -- 1 MB
    'application/pdf',
    'uploaded',
    'doctor',
    'Uploaded by Dr. Davis',
    NOW() - INTERVAL '6 hours'
);

-- Verify the inserts
SELECT 
    id,
    patient_id,
    title,
    upload_source,
    file_name,
    created_at
FROM patient_uploads 
WHERE upload_source = 'doctor'
ORDER BY created_at DESC;
