-- Add operating_days to merchants
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS operating_days TEXT[];

-- Create merchant_branches table
CREATE TABLE IF NOT EXISTS merchant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
    branch_name TEXT NOT NULL,
    manager_name TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    latitude FLOAT,
    longitude FLOAT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Enable RLS
ALTER TABLE merchant_branches ENABLE ROW LEVEL SECURITY;

-- Grant permissions
GRANT ALL ON merchant_branches TO authenticated;
GRANT ALL ON merchant_branches TO anon;
GRANT ALL ON merchant_branches TO service_role;

-- Policy examples (Adjust based on actual auth requirements)
-- CREATE POLICY "Enable read access for all users" ON merchant_branches FOR SELECT USING (true);
-- CREATE POLICY "Enable insert for authenticated users only" ON merchant_branches FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- CREATE POLICY "Enable update for owners" ON merchant_branches FOR UPDATE USING (auth.uid() = merchant_id); -- This assumes merchant link, usually more complex
