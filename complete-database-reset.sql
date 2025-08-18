-- COMPLETE DATABASE RESET - New Patient-Doctor System
-- This will create a clean, separate patient and doctor system
-- Run this in Supabase SQL Editor

-- ========================================
-- 1. CLEAN SLATE - DROP EXISTING TABLES
-- ========================================

-- Disable RLS and drop existing tables
ALTER TABLE IF EXISTS user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS vital_signs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patient_records DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DO $$ 
DECLARE
    policy_record RECORD;
    table_record RECORD;
BEGIN
    FOR table_record IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
        AND tablename IN ('user_profiles', 'vital_signs', 'devices', 'patient_records')
    LOOP
        FOR policy_record IN 
            SELECT policyname FROM pg_policies WHERE tablename = table_record.tablename
        LOOP
            EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(policy_record.policyname) || ' ON ' || quote_ident(table_record.tablename);
            RAISE NOTICE 'Dropped policy: % on table: %', policy_record.policyname, table_record.tablename;
        END LOOP;
    END LOOP;
END $$;

-- Drop existing tables
DROP TABLE IF EXISTS patient_records CASCADE;
DROP TABLE IF EXISTS vital_signs CASCADE;
DROP TABLE IF EXISTS devices CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS generate_doctor_code() CASCADE;
DROP FUNCTION IF EXISTS assign_doctor_to_patient(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_doctor_profile(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS create_doctor_profile(UUID, TEXT) CASCADE;

DO $$
BEGIN
    RAISE NOTICE 'All existing tables and functions dropped successfully!';
END $$;

-- ========================================
-- 2. CREATE NEW CLEAN SCHEMA
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DOCTORS TABLE - Separate table for healthcare providers
CREATE TABLE doctors (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL, -- Links to Supabase auth
    doctor_code TEXT UNIQUE NOT NULL, -- Auto-generated unique code like DR1234
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    profile_picture_url TEXT, -- URL to profile picture
    specialty TEXT NOT NULL, -- e.g., "Cardiology", "General Practice"
    hospital TEXT NOT NULL, -- Hospital/clinic name
    phone_number TEXT NOT NULL,
    license_number TEXT, -- Medical license number
    years_experience INTEGER,
    bio TEXT, -- Doctor's biography
    consultation_fee DECIMAL(10,2), -- Optional consultation fee
    availability JSONB DEFAULT '{}', -- Available hours/days
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PATIENTS TABLE - Separate table for patients
CREATE TABLE patients (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL, -- Links to Supabase auth
    patient_code TEXT UNIQUE, -- Optional patient identifier
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    phone_number TEXT,
    address TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    blood_type TEXT,
    allergies TEXT[],
    medical_conditions TEXT[],
    current_medications TEXT[],
    assigned_doctor_id UUID REFERENCES doctors(id), -- Which doctor is assigned to this patient
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VITAL SIGNS TABLE - Store all patient measurements
CREATE TABLE vital_signs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    doctor_id UUID REFERENCES doctors(id), -- Copy of assigned doctor for easy querying
    device_id TEXT,
    device_type TEXT CHECK (device_type IN ('BP', 'ECG', 'OXIMETER', 'GLUCOSE', 'TEMPERATURE')),
    measurement_type TEXT NOT NULL,
    data JSONB NOT NULL, -- Flexible data storage for different device types
    reading_timestamp TIMESTAMP WITH TIME ZONE NOT NULL, -- When the reading was taken
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When it was synced to database
    notes TEXT, -- Optional notes about the reading
    is_emergency BOOLEAN DEFAULT false, -- Flag for emergency readings
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DEVICES TABLE - Track patient devices
CREATE TABLE devices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    device_name TEXT NOT NULL,
    device_model TEXT,
    mac_address TEXT UNIQUE,
    device_type TEXT CHECK (device_type IN ('BP', 'ECG', 'OXIMETER', 'GLUCOSE', 'TEMPERATURE')),
    is_connected BOOLEAN DEFAULT false,
    last_seen TIMESTAMP WITH TIME ZONE,
    battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
    firmware_version TEXT,
    calibration_date DATE,
    next_calibration_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- EMERGENCY_ALERTS TABLE - Track emergency situations
CREATE TABLE emergency_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    doctor_id UUID REFERENCES doctors(id) NOT NULL,
    alert_type TEXT CHECK (alert_type IN ('patient_triggered', 'doctor_triggered', 'system_triggered')) NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    vital_signs_data JSONB, -- Snapshot of vital signs when alert was triggered
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID, -- Could be doctor or system
    response_time_minutes INTEGER, -- How long it took to respond
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DOCTOR_PATIENT_SESSIONS TABLE - Track monitoring sessions
CREATE TABLE doctor_patient_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID REFERENCES doctors(id) NOT NULL,
    patient_id UUID REFERENCES patients(id) NOT NULL,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    session_type TEXT CHECK (session_type IN ('monitoring', 'consultation', 'emergency')) DEFAULT 'monitoring',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- 3. CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Doctors indexes
CREATE INDEX idx_doctors_auth_user_id ON doctors(auth_user_id);
CREATE INDEX idx_doctors_doctor_code ON doctors(doctor_code);
CREATE INDEX idx_doctors_email ON doctors(email);
CREATE INDEX idx_doctors_specialty ON doctors(specialty);

-- Patients indexes
CREATE INDEX idx_patients_auth_user_id ON patients(auth_user_id);
CREATE INDEX idx_patients_assigned_doctor_id ON patients(assigned_doctor_id);
CREATE INDEX idx_patients_email ON patients(email);

-- Vital signs indexes
CREATE INDEX idx_vital_signs_patient_id ON vital_signs(patient_id);
CREATE INDEX idx_vital_signs_doctor_id ON vital_signs(doctor_id);
CREATE INDEX idx_vital_signs_device_type ON vital_signs(device_type);
CREATE INDEX idx_vital_signs_reading_timestamp ON vital_signs(reading_timestamp DESC);
CREATE INDEX idx_vital_signs_is_emergency ON vital_signs(is_emergency);

-- Devices indexes
CREATE INDEX idx_devices_patient_id ON devices(patient_id);
CREATE INDEX idx_devices_device_type ON devices(device_type);
CREATE INDEX idx_devices_is_connected ON devices(is_connected);

-- Emergency alerts indexes
CREATE INDEX idx_emergency_alerts_patient_id ON emergency_alerts(patient_id);
CREATE INDEX idx_emergency_alerts_doctor_id ON emergency_alerts(doctor_id);
CREATE INDEX idx_emergency_alerts_is_resolved ON emergency_alerts(is_resolved);
CREATE INDEX idx_emergency_alerts_created_at ON emergency_alerts(created_at DESC);

-- ========================================
-- 4. CREATE HELPER FUNCTIONS
-- ========================================

-- Function to generate unique doctor codes
CREATE OR REPLACE FUNCTION generate_doctor_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 4-digit code with DR prefix
        new_code := 'DR' || LPAD(floor(random() * 10000)::text, 4, '0');
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM doctors 
            WHERE doctor_code = new_code
        ) INTO code_exists;
        
        -- If code doesn't exist, we can use it
        IF NOT code_exists THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to assign patient to doctor using doctor code
CREATE OR REPLACE FUNCTION assign_patient_to_doctor(
    patient_auth_id UUID,
    doctor_code_input TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    doctor_record RECORD;
    patient_record RECORD;
BEGIN
    -- Find the doctor by code
    SELECT * INTO doctor_record 
    FROM doctors 
    WHERE doctor_code = UPPER(doctor_code_input) AND is_active = true;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Doctor with code % not found', doctor_code_input;
        RETURN false;
    END IF;
    
    -- Find the patient by auth_user_id
    SELECT * INTO patient_record 
    FROM patients 
    WHERE auth_user_id = patient_auth_id;
    
    IF NOT FOUND THEN
        RAISE NOTICE 'Patient with auth_user_id % not found', patient_auth_id;
        RETURN false;
    END IF;
    
    -- Assign the doctor to the patient
    UPDATE patients 
    SET assigned_doctor_id = doctor_record.id,
        updated_at = NOW()
    WHERE auth_user_id = patient_auth_id;
    
    -- Also update vital_signs to include doctor_id for easier querying
    UPDATE vital_signs 
    SET doctor_id = doctor_record.id
    WHERE patient_id = patient_record.id AND doctor_id IS NULL;
    
    RAISE NOTICE 'Patient % assigned to doctor % successfully', patient_record.full_name, doctor_record.full_name;
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to create doctor profile
CREATE OR REPLACE FUNCTION create_doctor_profile(
    auth_user_id UUID,
    full_name TEXT,
    email TEXT,
    specialty TEXT,
    hospital TEXT,
    phone_number TEXT,
    profile_picture_url TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    new_doctor_code TEXT;
    doctor_id UUID;
    result JSON;
BEGIN
    -- Generate unique doctor code
    new_doctor_code := generate_doctor_code();
    
    -- Insert doctor profile
    INSERT INTO doctors (
        auth_user_id, doctor_code, full_name, email, 
        specialty, hospital, phone_number, profile_picture_url
    )
    VALUES (
        auth_user_id, new_doctor_code, full_name, email,
        specialty, hospital, phone_number, profile_picture_url
    )
    RETURNING id INTO doctor_id;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'doctor_id', doctor_id,
        'doctor_code', new_doctor_code,
        'message', 'Doctor profile created successfully'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create doctor profile'
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create patient profile
CREATE OR REPLACE FUNCTION create_patient_profile(
    auth_user_id UUID,
    full_name TEXT,
    email TEXT,
    doctor_code_input TEXT
)
RETURNS JSON AS $$
DECLARE
    patient_id UUID;
    doctor_record RECORD;
    result JSON;
BEGIN
    -- Find the doctor by code
    SELECT * INTO doctor_record 
    FROM doctors 
    WHERE doctor_code = UPPER(doctor_code_input) AND is_active = true;
    
    IF NOT FOUND THEN
        result := json_build_object(
            'success', false,
            'error', 'INVALID_DOCTOR_CODE',
            'message', 'Invalid doctor code. Please check with your healthcare provider.'
        );
        RETURN result;
    END IF;
    
    -- Insert patient profile
    INSERT INTO patients (
        auth_user_id, full_name, email, assigned_doctor_id
    )
    VALUES (
        auth_user_id, full_name, email, doctor_record.id
    )
    RETURNING id INTO patient_id;
    
    -- Return success result
    result := json_build_object(
        'success', true,
        'patient_id', patient_id,
        'assigned_doctor', json_build_object(
            'id', doctor_record.id,
            'name', doctor_record.full_name,
            'doctor_code', doctor_record.doctor_code,
            'specialty', doctor_record.specialty,
            'hospital', doctor_record.hospital
        ),
        'message', 'Patient profile created and assigned to doctor successfully'
    );
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error result
        result := json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Failed to create patient profile'
        );
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. CREATE BASIC RLS POLICIES
-- ========================================

-- Enable RLS on all tables
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_patient_sessions ENABLE ROW LEVEL SECURITY;

-- Doctors policies
CREATE POLICY "doctors_own_profile" ON doctors
    FOR ALL USING (auth.uid() = auth_user_id);

-- Patients policies
CREATE POLICY "patients_own_profile" ON patients
    FOR ALL USING (auth.uid() = auth_user_id);

-- Doctors can view their assigned patients
CREATE POLICY "doctors_view_assigned_patients" ON patients
    FOR SELECT USING (
        assigned_doctor_id IN (
            SELECT id FROM doctors WHERE auth_user_id = auth.uid()
        )
    );

-- Vital signs policies
CREATE POLICY "patients_own_vital_signs" ON vital_signs
    FOR ALL USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

-- Doctors can view vital signs of their patients
CREATE POLICY "doctors_view_patient_vital_signs" ON vital_signs
    FOR SELECT USING (
        doctor_id IN (
            SELECT id FROM doctors WHERE auth_user_id = auth.uid()
        )
    );

-- Similar policies for other tables...
CREATE POLICY "patients_own_devices" ON devices
    FOR ALL USING (
        patient_id IN (
            SELECT id FROM patients WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "emergency_alerts_patient_doctor" ON emergency_alerts
    FOR SELECT USING (
        patient_id IN (SELECT id FROM patients WHERE auth_user_id = auth.uid())
        OR doctor_id IN (SELECT id FROM doctors WHERE auth_user_id = auth.uid())
    );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_doctor_code() TO authenticated;
GRANT EXECUTE ON FUNCTION assign_patient_to_doctor(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_doctor_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_patient_profile(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ========================================
-- 6. SUCCESS MESSAGE
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'COMPLETE DATABASE RESET SUCCESSFUL!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'New Schema Created:';
    RAISE NOTICE '- doctors: Healthcare providers with profiles';
    RAISE NOTICE '- patients: Patients linked to doctors';
    RAISE NOTICE '- vital_signs: Patient measurements';
    RAISE NOTICE '- devices: Patient devices';
    RAISE NOTICE '- emergency_alerts: Emergency system';
    RAISE NOTICE '- doctor_patient_sessions: Monitoring sessions';
    RAISE NOTICE '';
    RAISE NOTICE 'Helper Functions:';
    RAISE NOTICE '- generate_doctor_code(): Auto-generate doctor codes';
    RAISE NOTICE '- create_doctor_profile(): Create doctor profiles';
    RAISE NOTICE '- create_patient_profile(): Create patient profiles';
    RAISE NOTICE '- assign_patient_to_doctor(): Link patients to doctors';
    RAISE NOTICE '';
    RAISE NOTICE 'RLS Policies: Enabled with proper access controls';
    RAISE NOTICE 'Ready for new patient-doctor system!';
    RAISE NOTICE '========================================';
END $$;
