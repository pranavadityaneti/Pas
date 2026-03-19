-- Migration: Create order_requests table for merchant acceptance flow
-- This table acts as the real-time bridge between consumer and merchant apps.
-- Status lifecycle: PENDING → ACCEPTED / REJECTED / EXPIRED

CREATE TABLE IF NOT EXISTS order_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_user_id UUID NOT NULL,
    store_id TEXT NOT NULL,
    store_name TEXT NOT NULL,
    items JSONB NOT NULL DEFAULT '[]',
    subtotal NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'PENDING',
    rejection_reason TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE order_requests;

-- Index for fast queries by store and status
CREATE INDEX IF NOT EXISTS idx_order_requests_store_status 
    ON order_requests (store_id, status);

-- Index for consumer-side lookups
CREATE INDEX IF NOT EXISTS idx_order_requests_consumer 
    ON order_requests (consumer_user_id, created_at DESC);

-- RLS: Allow authenticated users to read/write their own requests
ALTER TABLE order_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own requests"
    ON order_requests FOR INSERT
    WITH CHECK (auth.uid() = consumer_user_id);

CREATE POLICY "Users can read their own requests"
    ON order_requests FOR SELECT
    USING (auth.uid() = consumer_user_id OR store_id IN (
        SELECT id::text FROM "Store" WHERE "managerId" = auth.uid()::text
    ));

CREATE POLICY "Anyone authenticated can update requests"
    ON order_requests FOR UPDATE
    USING (auth.uid() IS NOT NULL);
