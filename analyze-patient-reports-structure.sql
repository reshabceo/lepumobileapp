-- =====================================================
-- COMPLETE ANALYSIS OF PATIENT_REPORTS TABLE STRUCTURE
-- =====================================================

-- 1. Get table structure and column details
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    datetime_precision
FROM information_schema.columns 
WHERE table_name = 'patient_reports' 
ORDER BY ordinal_position;

-- 2. Get all constraints (Primary Key, Foreign Keys, Check constraints, etc.)
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    cc.check_clause
FROM information_schema.table_constraints AS tc 
LEFT JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.check_constraints AS cc
    ON cc.constraint_name = tc.constraint_name
    AND cc.table_schema = tc.table_schema
WHERE tc.table_name = 'patient_reports'
ORDER BY tc.constraint_type, kcu.ordinal_position;

-- 3. Get indexes on the table
SELECT 
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename = 'patient_reports';

-- 4. Get Row Level Security (RLS) policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'patient_reports';

-- 5. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'patient_reports';

-- 6. Get all related tables (foreign key relationships)
WITH RECURSIVE table_relations AS (
    -- Direct foreign keys FROM patient_reports
    SELECT 
        'patient_reports' as source_table,
        ccu.table_name as target_table,
        kcu.column_name as source_column,
        ccu.column_name as target_column,
        1 as level
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = 'patient_reports' 
    AND tc.constraint_type = 'FOREIGN KEY'
    
    UNION ALL
    
    -- Direct foreign keys TO patient_reports
    SELECT 
        tc.table_name as source_table,
        'patient_reports' as target_table,
        kcu.column_name as source_column,
        ccu.column_name as target_column,
        1 as level
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE ccu.table_name = 'patient_reports' 
    AND tc.constraint_type = 'FOREIGN KEY'
)
SELECT * FROM table_relations ORDER BY level, source_table, target_table;

-- 7. Get sample data structure (first 5 rows)
SELECT * FROM patient_reports LIMIT 5;

-- 8. Get table statistics
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    most_common_vals,
    most_common_freqs,
    histogram_bounds,
    correlation
FROM pg_stats 
WHERE tablename = 'patient_reports';

-- 9. Get all functions that reference patient_reports
SELECT 
    n.nspname as schema_name,
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosrc LIKE '%patient_reports%'
AND n.nspname NOT IN ('information_schema', 'pg_catalog');

-- 10. Get all views that reference patient_reports
SELECT 
    schemaname,
    viewname,
    definition
FROM pg_views 
WHERE definition LIKE '%patient_reports%';

-- 11. Get table size and row count
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size
FROM pg_tables 
WHERE tablename = 'patient_reports';

-- 12. Get row count
SELECT COUNT(*) as total_rows FROM patient_reports;

-- 13. Check for any triggers on the table
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'patient_reports';

-- 14. Get all related tables in the same schema
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = (SELECT table_schema FROM information_schema.tables WHERE table_name = 'patient_reports')
AND table_name LIKE '%patient%' OR table_name LIKE '%report%' OR table_name LIKE '%doctor%'
ORDER BY table_name;

-- 15. Get detailed column information with comments
SELECT 
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default,
    c.character_maximum_length,
    c.numeric_precision,
    c.numeric_scale,
    c.datetime_precision,
    col_description(pgc.oid, c.ordinal_position) as column_comment
FROM information_schema.columns c
LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
WHERE c.table_name = 'patient_reports'
ORDER BY c.ordinal_position;
