
-- Enable RLS on subscriptions table
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy to allow merchants to insert their own subscription records
CREATE POLICY "Enable insert for merchants" ON public.subscriptions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = merchant_id::text);

-- Policy to allow merchants to view their own subscription records
CREATE POLICY "Enable select for owner" ON public.subscriptions
    FOR SELECT
    TO authenticated
    USING (auth.uid()::text = merchant_id::text);
