-- ============================================
-- COMPLETE DATABASE RLS INSPECTION
-- Run this in Supabase SQL Editor to see EVERYTHING
-- ============================================

-- ============================================
-- 1. ALL TABLES IN PUBLIC SCHEMA
-- ============================================
SELECT 
    '📋 ALL TABLES' as section,
    tablename,
    rowsecurity as rls_enabled,
    (SELECT COUNT(*) 
     FROM information_schema.columns 
     WHERE table_schema = 'public' 
     AND columns.table_name = tables.tablename) as column_count
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- ============================================
-- 2. ALL RLS POLICIES ON ALL TABLES
-- ============================================
SELECT 
    '🔒 ALL RLS POLICIES' as section,
    schemaname,
    tablename,
    policyname,
    permissive,
    array_to_string(roles::text[], ', ') as applies_to_roles,
    cmd as command_type,
    qual::text as using_expression,
    with_check::text as with_check_expression
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- 3. DETAILED POLICY ANALYSIS BY TABLE
-- ============================================
SELECT 
    '📊 POLICIES PER TABLE' as section,
    tablename,
    COUNT(*) as policy_count,
    string_agg(DISTINCT cmd::text, ', ') as operations
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- 4. ALL FOREIGN KEY RELATIONSHIPS
-- ============================================
SELECT
    '🔗 FOREIGN KEYS' as section,
    tc.table_name as from_table, 
    kcu.column_name as from_column,
    ccu.table_name AS to_table,
    ccu.column_name AS to_column,
    tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================
-- 5. COLUMN DETAILS FOR KEY TABLES
-- ============================================
SELECT 
    '📋 KEY TABLE COLUMNS' as section,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND table_name IN ('doctors', 'patients', 'vital_signs', 'patient_reports', 'patient_uploads', 'video_calls', 'imaging_studies')
ORDER BY table_name, ordinal_position;

-- ============================================
-- 6. TABLES WITH NO RLS POLICIES
-- ============================================
SELECT 
    '⚠️  TABLES WITHOUT POLICIES' as section,
    t.tablename,
    t.rowsecurity as rls_enabled_but_no_policies
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
WHERE t.schemaname = 'public'
AND p.policyname IS NULL
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

-- ============================================
-- 7. RECURSIVE POLICY DETECTION
-- ============================================
-- Check for policies that might cause infinite recursion
SELECT 
    '⚠️  POTENTIAL RECURSIVE POLICIES' as section,
    tablename,
    policyname,
    cmd,
    qual::text as policy_definition
FROM pg_policies 
WHERE schemaname = 'public'
AND (
    -- Policies on doctors that query patients
    (tablename = 'doctors' AND qual::text LIKE '%patients%')
    OR
    -- Policies on patients that query doctors
    (tablename = 'patients' AND qual::text LIKE '%doctors%')
    OR
    -- Any policy with nested subqueries
    (qual::text LIKE '%SELECT%SELECT%')
)
ORDER BY tablename, policyname;

-- ============================================
-- 8. AUTH USER ID USAGE
-- ============================================
-- Check which tables have auth_user_id column
SELECT 
    '👤 AUTH_USER_ID COLUMNS' as section,
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'auth_user_id'
ORDER BY table_name;

-- ============================================
-- 9. SUMMARY STATISTICS
-- ============================================
SELECT 
    '📊 SUMMARY' as info,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public') as total_tables,
    (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as tables_with_rls_enabled,
    (SELECT COUNT(DISTINCT tablename) FROM pg_policies WHERE schemaname = 'public') as tables_with_policies,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;

-- ============================================
-- DONE
-- ============================================
SELECT '✅ INSPECTION COMPLETE - Review all sections above' as status;

