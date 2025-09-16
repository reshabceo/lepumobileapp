-- =====================================================
-- SEED FAKE DOCTOR REPORTS FOR TESTING
-- =====================================================

-- First, let's check what patient we have to work with
SELECT id, auth_user_id, full_name FROM patients LIMIT 1;

-- Insert fake doctor reports for testing
-- Note: Replace 'YOUR_PATIENT_ID' with the actual patient ID from the query above
INSERT INTO patient_reports (
    patient_id,
    doctor_id,
    title,
    description,
    report_type,
    file_url,
    file_name,
    file_size,
    mime_type,
    uploaded_by_patient,
    created_at
) VALUES 
-- Report 1: Blood Test Results
(
    (SELECT id FROM patients LIMIT 1), -- Use first patient
    (SELECT id FROM patients WHERE role = 'doctor' LIMIT 1), -- Use first doctor if exists, or NULL
    'Blood Test Results - January 2024',
    'Complete blood count and metabolic panel results showing normal ranges across all parameters.',
    'test_results',
    'doctor-reports/blood-test-jan-2024.pdf',
    'blood-test-jan-2024.pdf',
    245760, -- 240 KB
    'application/pdf',
    FALSE, -- Uploaded by doctor
    NOW() - INTERVAL '5 days'
),

-- Report 2: X-Ray Report
(
    (SELECT id FROM patients LIMIT 1),
    (SELECT id FROM patients WHERE role = 'doctor' LIMIT 1),
    'Chest X-Ray - Follow-up',
    'Post-treatment chest X-ray showing significant improvement in lung condition.',
    'x_ray',
    'doctor-reports/chest-xray-followup.jpg',
    'chest-xray-followup.jpg',
    512000, -- 500 KB
    'image/jpeg',
    FALSE,
    NOW() - INTERVAL '3 days'
),

-- Report 3: Prescription
(
    (SELECT id FROM patients LIMIT 1),
    (SELECT id FROM patients WHERE role = 'doctor' LIMIT 1),
    'Prescription - Medication Update',
    'Updated prescription for blood pressure medication with adjusted dosage.',
    'prescription',
    'doctor-reports/prescription-update.pdf',
    'prescription-update.pdf',
    128000, -- 125 KB
    'application/pdf',
    FALSE,
    NOW() - INTERVAL '1 day'
),

-- Report 4: Consultation Notes
(
    (SELECT id FROM patients LIMIT 1),
    (SELECT id FROM patients WHERE role = 'doctor' LIMIT 1),
    'Consultation Notes - Follow-up Visit',
    'Detailed notes from follow-up consultation discussing treatment progress and next steps.',
    'consultation_notes',
    'doctor-reports/consultation-notes.pdf',
    'consultation-notes.pdf',
    384000, -- 375 KB
    'application/pdf',
    FALSE,
    NOW() - INTERVAL '2 days'
),

-- Report 5: Discharge Summary
(
    (SELECT id FROM patients LIMIT 1),
    (SELECT id FROM patients WHERE role = 'doctor' LIMIT 1),
    'Discharge Summary - Hospital Visit',
    'Comprehensive discharge summary from recent hospital visit with treatment recommendations.',
    'discharge_summary',
    'doctor-reports/discharge-summary.pdf',
    'discharge-summary.pdf',
    768000, -- 750 KB
    'application/pdf',
    FALSE,
    NOW() - INTERVAL '7 days'
);

-- Verify the reports were inserted
SELECT 
    id,
    title,
    report_type,
    file_name,
    file_size,
    uploaded_by_patient,
    created_at
FROM patient_reports 
WHERE patient_id = (SELECT id FROM patients LIMIT 1)
ORDER BY created_at DESC;

-- Create some fake files in storage for testing (optional)
-- Note: You'll need to manually upload these files to Supabase Storage
-- in the 'patient-reports' bucket under 'doctor-reports/' folder

-- Sample file structure to create in Supabase Storage:
-- patient-reports/
--   └── doctor-reports/
--       ├── blood-test-jan-2024.pdf
--       ├── chest-xray-followup.jpg
--       ├── prescription-update.pdf
--       ├── consultation-notes.pdf
--       └── discharge-summary.pdf
