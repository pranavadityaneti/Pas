-- List triggers on Store table
SELECT event_object_table as table_name, trigger_name, action_statement, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'Store';

-- List RLS policies on Store table (pg_policies)
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'Store';
