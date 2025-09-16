-- Create a separate table for patient uploads
CREATE TABLE IF NOT EXISTS patient_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    upload_status VARCHAR(20) DEFAULT 'uploaded' CHECK (upload_status IN ('uploaded', 'processing', 'downloaded', 'error')),
    patient_notes TEXT,
    doctor_downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_patient_uploads_patient_id ON patient_uploads(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_uploads_created_at ON patient_uploads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_patient_uploads_upload_status ON patient_uploads(upload_status);

-- Enable RLS
ALTER TABLE patient_uploads ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for patient uploads
-- Patients can view their own uploads
CREATE POLICY "patients_view_own_uploads" ON patient_uploads
    FOR SELECT TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- Patients can insert their own uploads
CREATE POLICY "patients_insert_own_uploads" ON patient_uploads
    FOR INSERT TO authenticated
    WITH CHECK (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- Patients can update their own uploads
CREATE POLICY "patients_update_own_uploads" ON patient_uploads
    FOR UPDATE TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- Patients can delete their own uploads
CREATE POLICY "patients_delete_own_uploads" ON patient_uploads
    FOR DELETE TO authenticated
    USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- Doctors can view uploads from their assigned patients
CREATE POLICY "doctors_view_patient_uploads" ON patient_uploads
    FOR SELECT TO authenticated
    USING (
        patient_id IN (
            SELECT p.id FROM patients p
            JOIN user_profiles up ON up.id = p.doctor_id
            WHERE up.auth_user_id = auth.uid() AND up.role = 'doctor'
        )
    );

-- Create storage policies for patient uploads
-- Patients can upload to their own folder
CREATE POLICY "patients_upload_to_uploads_folder" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'patient-reports' AND
        starts_with(name, 'patient-uploads/')
    );

-- Patients can view their own uploaded files
CREATE POLICY "patients_view_own_uploaded_files" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'patient-reports' AND
        starts_with(name, 'patient-uploads/')
    );

-- Doctors can view patient uploaded files
CREATE POLICY "doctors_view_patient_uploaded_files" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'patient-reports' AND
        starts_with(name, 'patient-uploads/')
    );

-- Create a function to get patient uploads with doctor info
CREATE OR REPLACE FUNCTION get_patient_uploads_with_doctor_info()
RETURNS TABLE (
    id UUID,
    patient_id UUID,
    title TEXT,
    description TEXT,
    file_url TEXT,
    file_name TEXT,
    file_size INTEGER,
    mime_type TEXT,
    upload_status VARCHAR(20),
    patient_notes TEXT,
    doctor_downloaded_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    doctor_name TEXT,
    doctor_avatar TEXT,
    is_uploaded_by_patient BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pu.id,
        pu.patient_id,
        pu.title,
        pu.description,
        pu.file_url,
        pu.file_name,
        pu.file_size,
        pu.mime_type,
        pu.upload_status,
        pu.patient_notes,
        pu.doctor_downloaded_at,
        pu.created_at,
        pu.updated_at,
        up.full_name as doctor_name,
        up.avatar_url as doctor_avatar,
        true as is_uploaded_by_patient
    FROM patient_uploads pu
    LEFT JOIN patients p ON p.id = pu.patient_id
    LEFT JOIN patients p2 ON p2.doctor_id = (SELECT id FROM user_profiles WHERE auth_user_id = auth.uid() AND role = 'doctor')
    WHERE p.auth_user_id = auth.uid() OR p2.id = pu.patient_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_patient_uploads_with_doctor_info() TO authenticated;
