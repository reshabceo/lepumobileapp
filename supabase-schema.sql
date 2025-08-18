-- Supabase Database Schema for Vital Signs Monitor
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles Table (extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'doctor', 'nurse', 'admin')),
  doctor_id UUID REFERENCES auth.users(id), -- Patient's assigned doctor
  doctor_code TEXT, -- Unique code for doctor identification
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Vital Signs Data Table
CREATE TABLE IF NOT EXISTS vital_signs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  doctor_id UUID REFERENCES auth.users(id), -- Patient's assigned doctor for this measurement
  device_id TEXT,
  device_type TEXT CHECK (device_type IN ('BP', 'ECG', 'OXIMETER', 'GLUCOSE')),
  measurement_type TEXT NOT NULL,
  data JSONB NOT NULL, -- Flexible data storage for different device types
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Devices Table
CREATE TABLE IF NOT EXISTS devices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  mac_address TEXT UNIQUE,
  device_type TEXT CHECK (device_type IN ('BP', 'ECG', 'OXIMETER', 'GLUCOSE')),
  connected BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  battery_level INTEGER CHECK (battery_level >= 0 AND battery_level <= 100),
  firmware_version TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Patient Records Table
CREATE TABLE IF NOT EXISTS patient_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID REFERENCES auth.users(id) NOT NULL,
  patient_name TEXT NOT NULL,
  age INTEGER CHECK (age > 0),
  condition TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Patient Vital Signs (for doctors monitoring patients)
CREATE TABLE IF NOT EXISTS patient_vital_signs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_record_id UUID REFERENCES patient_records(id) NOT NULL,
  device_id UUID REFERENCES devices(id),
  device_type TEXT CHECK (device_type IN ('BP', 'ECG', 'OXIMETER', 'GLUCOSE')),
  data JSONB NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_vital_signs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- RLS Policies for vital_signs
CREATE POLICY "Users can view own vital signs" ON vital_signs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view patient vital signs" ON vital_signs
  FOR SELECT USING (auth.uid() = doctor_id);

CREATE POLICY "Users can insert own vital signs" ON vital_signs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vital signs" ON vital_signs
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for devices
CREATE POLICY "Users can view own devices" ON devices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own devices" ON devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own devices" ON devices
  FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for patient_records (doctors only)
CREATE POLICY "Doctors can view patient records" ON patient_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('doctor', 'nurse', 'admin')
    )
  );

CREATE POLICY "Doctors can insert patient records" ON patient_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE user_profiles.id = auth.uid() 
      AND user_profiles.role IN ('doctor', 'nurse', 'admin')
    )
  );

-- RLS Policies for patient_vital_signs
CREATE POLICY "Doctors can view patient vital signs" ON patient_vital_signs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM patient_records pr
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE pr.id = patient_vital_signs.patient_record_id
      AND up.role IN ('doctor', 'nurse', 'admin')
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_vital_signs_user_id ON vital_signs(user_id);
CREATE INDEX IF NOT EXISTS idx_vital_signs_doctor_id ON vital_signs(doctor_id);
CREATE INDEX IF NOT EXISTS idx_vital_signs_timestamp ON vital_signs(timestamp);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_mac_address ON devices(mac_address);
CREATE INDEX IF NOT EXISTS idx_patient_records_doctor_id ON patient_records(doctor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_id ON user_profiles(doctor_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_doctor_code ON user_profiles(doctor_code);

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at 
  BEFORE UPDATE ON devices 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_patient_records_updated_at 
  BEFORE UPDATE ON patient_records 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user profile (optional)
-- This will be created automatically when a user signs up
-- You can manually insert admin users if needed

-- Create helper function to generate doctor codes
CREATE OR REPLACE FUNCTION generate_doctor_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'DR' || LPAD(floor(random() * 10000)::text, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Create helper function to assign doctor to patient
CREATE OR REPLACE FUNCTION assign_doctor_to_patient(patient_id UUID, doctor_code_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  doctor_uuid UUID;
BEGIN
  -- Find doctor by code
  SELECT id INTO doctor_uuid 
  FROM user_profiles 
  WHERE doctor_code = doctor_code_input AND role = 'doctor';
  
  IF doctor_uuid IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Update patient's doctor assignment
  UPDATE user_profiles 
  SET doctor_id = doctor_uuid 
  WHERE id = patient_id AND role = 'user';
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Doctor-Patient Relationship System Notes:
-- 1. Patients (role='user') can be assigned to doctors via doctor_id or doctor_code
-- 2. Doctors (role='doctor') get unique doctor_code for patient assignment
-- 3. Vital signs data includes doctor_id for real-time monitoring access
-- 4. RLS policies ensure doctors can only see their assigned patients' data
-- 5. Use assign_doctor_to_patient() function to establish relationships
