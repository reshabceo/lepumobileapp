-- =====================================================
-- QUICK PATIENT_REPORTS TABLE STRUCTURE OVERVIEW
-- =====================================================

-- 1. Basic table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length
FROM information_schema.columns 
WHERE table_name = 'patient_reports' 
ORDER BY ordinal_position;

-- 2. Foreign key relationships
SELECT 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'patient_reports'
AND tc.constraint_type = 'FOREIGN KEY';

-- 3. RLS policies
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'patient_reports';

-- 4. Sample data
SELECT * FROM patient_reports LIMIT 3;

-- 6. Check if RLS is enabled
SELECT 
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'patient_reports';
