-- Migration: Create Patient Cameras Table
CREATE TABLE IF NOT EXISTS public.patient_cameras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    camera_username TEXT NOT NULL,
    camera_password TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    rtsp_url TEXT NOT NULL,
    rtsp_url_sub TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_patient_camera UNIQUE (patient_id)
);

-- Enable RLS
ALTER TABLE public.patient_cameras ENABLE ROW LEVEL SECURITY;

-- 1. Patients can view their own camera settings
CREATE POLICY "Patients can view own camera settings"
ON public.patient_cameras
FOR SELECT
TO authenticated
USING (
    patient_id IN (
        SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
);

-- 2. Patients can insert their own camera settings
CREATE POLICY "Patients can insert own camera settings"
ON public.patient_cameras
FOR INSERT
TO authenticated
WITH CHECK (
    patient_id IN (
        SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
);

-- 3. Patients can update their own camera settings
CREATE POLICY "Patients can update own camera settings"
ON public.patient_cameras
FOR UPDATE
TO authenticated
USING (
    patient_id IN (
        SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
)
WITH CHECK (
    patient_id IN (
        SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
);

-- 4. Patients can delete their own camera settings
CREATE POLICY "Patients can delete own camera settings"
ON public.patient_cameras
FOR DELETE
TO authenticated
USING (
    patient_id IN (
        SELECT id FROM public.patients WHERE auth_user_id = auth.uid()
    )
);

-- 5. Doctors can view the camera settings of their assigned patients
CREATE POLICY "Doctors can view assigned patient camera settings"
ON public.patient_cameras
FOR SELECT
TO authenticated
USING (
    patient_id IN (
        SELECT p.id 
        FROM public.patients p
        INNER JOIN public.doctors d ON p.assigned_doctor_id = d.id
        WHERE d.auth_user_id = auth.uid()
    )
);

-- Index for faster joins/lookups
CREATE INDEX IF NOT EXISTS idx_patient_cameras_patient_id ON public.patient_cameras(patient_id);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_patient_cameras_updated_at
    BEFORE UPDATE ON public.patient_cameras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
