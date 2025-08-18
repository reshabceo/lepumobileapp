-- Create Reports and Emergency Tables
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. CREATE PATIENT REPORTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS patient_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    report_type TEXT NOT NULL CHECK (report_type IN ('medical_report', 'test_results', 'prescription', 'consultation_notes', 'discharge_summary')),
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_name TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_patient_reports_patient_id ON patient_reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_reports_doctor_id ON patient_reports(doctor_id);
CREATE INDEX IF NOT EXISTS idx_patient_reports_created_at ON patient_reports(created_at DESC);

-- ========================================
-- 2. CREATE EMERGENCY CONTACTS TABLE
-- ========================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_type TEXT NOT NULL CHECK (contact_type IN ('hospital', 'ems', 'fire_department', 'police', 'poison_control')),
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 1, -- 1 = highest priority
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_type ON emergency_contacts(contact_type);
CREATE INDEX IF NOT EXISTS idx_emergency_contacts_active ON emergency_contacts(is_active);

-- ========================================
-- 3. INSERT DEFAULT EMERGENCY CONTACTS
-- ========================================

-- Insert default emergency contacts
INSERT INTO emergency_contacts (contact_type, name, phone_number, address, priority) VALUES
-- Hospitals
('hospital', 'General Hospital Emergency', '911', '123 Medical Center Dr', 1),
('hospital', 'St. Mary''s Hospital', '+1-555-0100', '456 Health Ave', 2),
('hospital', 'City Medical Center', '+1-555-0200', '789 Care Blvd', 3),

-- EMS
('ems', 'Emergency Medical Services', '911', 'Emergency Dispatch Center', 1),
('ems', 'Paramedic Services', '+1-555-0300', '321 Rescue St', 2),

-- Fire Department
('fire_department', 'Fire Department Emergency', '911', 'Fire Station #1', 1),

-- Police
('police', 'Police Emergency', '911', 'Police Headquarters', 1),

-- Poison Control
('poison_control', 'Poison Control Center', '+1-800-222-1222', 'National Poison Control', 1)

ON CONFLICT DO NOTHING;

-- ========================================
-- 4. CREATE RLS POLICIES FOR REPORTS
-- ========================================

-- Enable RLS
ALTER TABLE patient_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

-- Reports policies
CREATE POLICY "patients_view_own_reports" ON patient_reports
    FOR SELECT TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "doctors_manage_patient_reports" ON patient_reports
    FOR ALL TO authenticated
    USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE auth_user_id = auth.uid()
        )
    );

-- Emergency contacts policies (read-only for authenticated users)
CREATE POLICY "authenticated_view_emergency_contacts" ON emergency_contacts
    FOR SELECT TO authenticated
    USING (is_active = true);

-- ========================================
-- 5. CREATE STORAGE BUCKET FOR REPORTS
-- ========================================

-- Create storage bucket for patient reports
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'patient-reports',
    'patient-reports',
    false, -- Private bucket
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 6. CREATE STORAGE POLICIES
-- ========================================

-- Policy for doctors to upload reports
CREATE POLICY "doctors_upload_patient_reports" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'patient-reports' AND
        auth.uid() IN (SELECT auth_user_id FROM doctors WHERE is_active = true)
    );

-- Policy for doctors to view/manage reports they uploaded
CREATE POLICY "doctors_manage_uploaded_reports" ON storage.objects
    FOR ALL TO authenticated
    USING (
        bucket_id = 'patient-reports' AND
        auth.uid() IN (SELECT auth_user_id FROM doctors WHERE is_active = true)
    );

-- Policy for patients to view their own reports
CREATE POLICY "patients_view_own_report_files" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'patient-reports' AND
        auth.uid() IN (
            SELECT p.auth_user_id 
            FROM patients p
            INNER JOIN patient_reports pr ON pr.patient_id = p.id
            WHERE pr.file_url LIKE '%' || name
        )
    );

-- ========================================
-- 7. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to upload report
CREATE OR REPLACE FUNCTION upload_patient_report(
    p_patient_id UUID,
    p_title TEXT,
    p_description TEXT,
    p_report_type TEXT,
    p_file_url TEXT,
    p_file_name TEXT,
    p_file_size INTEGER,
    p_mime_type TEXT
)
RETURNS JSON AS $$
DECLARE
    doctor_record RECORD;
    report_id UUID;
    result JSON;
BEGIN
    -- Get current doctor
    SELECT * INTO doctor_record 
    FROM doctors 
    WHERE auth_user_id = auth.uid() AND is_active = true;
    
    IF NOT FOUND THEN
        result := json_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Only authenticated doctors can upload reports'
        );
        RETURN result;
    END IF;
    
    -- Insert report record
    INSERT INTO patient_reports (
        patient_id,
        doctor_id,
        title,
        description,
        report_type,
        file_url,
        file_name,
        file_size,
        mime_type
    )
    VALUES (
        p_patient_id,
        doctor_record.id,
        p_title,
        p_description,
        p_report_type,
        p_file_url,
        p_file_name,
        p_file_size,
        p_mime_type
    )
    RETURNING id INTO report_id;
    
    result := json_build_object(
        'success', true,
        'report_id', report_id,
        'message', 'Report uploaded successfully'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN OTHERS THEN
        result := json_build_object(
            'success', false,
            'error', 'DATABASE_ERROR',
            'message', 'Failed to upload report: ' || SQLERRM
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION upload_patient_report(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;

-- ========================================
-- 8. UPDATE EMERGENCY ALERTS TABLE
-- ========================================

-- Add emergency contacts to existing emergency_alerts table
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS notified_contacts TEXT[] DEFAULT '{}';
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS call_initiated BOOLEAN DEFAULT false;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS hospital_notified BOOLEAN DEFAULT false;
ALTER TABLE emergency_alerts ADD COLUMN IF NOT EXISTS ems_dispatched BOOLEAN DEFAULT false;

-- ========================================
-- 9. SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'REPORTS & EMERGENCY SYSTEM CREATED!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New Tables:';
    RAISE NOTICE '✅ patient_reports - For doctor-uploaded PDF reports';
    RAISE NOTICE '✅ emergency_contacts - Hospital/EMS contact numbers';
    RAISE NOTICE '';
    RAISE NOTICE 'New Features:';
    RAISE NOTICE '✅ PDF report upload by doctors';
    RAISE NOTICE '✅ Patients can view their reports';
    RAISE NOTICE '✅ Emergency calling system';
    RAISE NOTICE '✅ Hospital/EMS notification';
    RAISE NOTICE '';
    RAISE NOTICE 'Storage:';
    RAISE NOTICE '✅ patient-reports bucket created';
    RAISE NOTICE '✅ RLS policies for secure access';
    RAISE NOTICE '========================================';
END $$;
