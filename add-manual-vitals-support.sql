-- =====================================================
-- ADD MANUAL VITAL INPUT SUPPORT
-- Allow patients to manually enter vitals (Basic Plan)
-- Adapted for JSONB data structure
-- =====================================================

-- Add 'source' column to vital_signs table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'vital_signs' AND column_name = 'source'
    ) THEN
        ALTER TABLE vital_signs 
        ADD COLUMN source TEXT DEFAULT 'device';
        
        -- Add constraint after the column is created
        ALTER TABLE vital_signs 
        ADD CONSTRAINT valid_source CHECK (source IN ('device', 'manual'));
        
        COMMENT ON COLUMN vital_signs.source IS 'Source of vital: device (from medical device) or manual (patient entered)';
        
        RAISE NOTICE '✅ Added source column to vital_signs table';
    ELSE
        RAISE NOTICE '✓ Source column already exists in vital_signs table';
    END IF;
END $$;

-- Create index for querying by source
CREATE INDEX IF NOT EXISTS idx_vital_signs_source ON vital_signs(source);

-- Add 'plan_type' column to patients table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'patients' AND column_name = 'plan_type'
    ) THEN
        ALTER TABLE patients 
        ADD COLUMN plan_type TEXT DEFAULT 'basic';
        
        -- Add constraint after the column is created
        ALTER TABLE patients 
        ADD CONSTRAINT valid_plan_type CHECK (plan_type IN ('basic', 'essential', 'premium'));
        
        COMMENT ON COLUMN patients.plan_type IS 'Patient subscription plan: basic (manual input), essential (basic devices), premium (advanced devices)';
        
        RAISE NOTICE '✅ Added plan_type column to patients table';
    ELSE
        RAISE NOTICE '✓ Plan_type column already exists in patients table';
    END IF;
END $$;

-- Create index for querying by plan
CREATE INDEX IF NOT EXISTS idx_patients_plan_type ON patients(plan_type) WHERE is_active = true;

-- Update existing patients to 'basic' plan if not set
UPDATE patients SET plan_type = 'basic' WHERE plan_type IS NULL;

-- =====================================================
-- RLS POLICIES - Already exist, no need to add
-- =====================================================

-- RLS policies already exist:
-- ✅ "Patients can insert own vital signs" (INSERT)
-- ✅ "patients_insert_own_vitals" (INSERT)
-- ✅ "Patients can view own vital signs" (SELECT)
-- ✅ "Doctors can view patient vital signs" (SELECT)

-- No additional policies needed!

-- =====================================================
-- HELPER FUNCTION - Get latest vitals with source
-- Adapted for JSONB data structure
-- =====================================================

CREATE OR REPLACE FUNCTION get_latest_vitals_with_source(p_patient_id UUID, hours_ago INTEGER DEFAULT 24)
RETURNS TABLE (
    measurement_type TEXT,
    device_type TEXT,
    data JSONB,
    source TEXT,
    reading_timestamp TIMESTAMPTZ,
    device_id TEXT,
    is_emergency BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (vs.measurement_type)
        vs.measurement_type,
        vs.device_type,
        vs.data,
        COALESCE(vs.source, 'device') as source,
        vs.reading_timestamp,
        vs.device_id,
        vs.is_emergency
    FROM vital_signs vs
    WHERE vs.patient_id = p_patient_id
        AND vs.reading_timestamp >= NOW() - (hours_ago || ' hours')::INTERVAL
    ORDER BY vs.measurement_type, vs.reading_timestamp DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_latest_vitals_with_source(UUID, INTEGER) TO authenticated;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$ 
BEGIN 
    RAISE NOTICE '';
    RAISE NOTICE '✅ Manual Vital Input Support Added!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Features Enabled:';
    RAISE NOTICE '   ✓ source column added to vital_signs';
    RAISE NOTICE '   ✓ plan_type column added to patients';
    RAISE NOTICE '   ✓ All patients set to "basic" plan by default';
    RAISE NOTICE '   ✓ Patients can insert manual vitals';
    RAISE NOTICE '   ✓ Doctors see manual + device readings together';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 Plan Types:';
    RAISE NOTICE '   • basic: Manual input only';
    RAISE NOTICE '   • essential: Basic devices (BP, SpO2, etc.)';
    RAISE NOTICE '   • premium: Advanced devices + all features';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Patients can now manually enter vitals!';
END $$;

