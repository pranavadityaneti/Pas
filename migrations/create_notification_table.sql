CREATE TABLE IF NOT EXISTS notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "merchantId" UUID REFERENCES merchants(id),
    type TEXT CHECK (type IN ('order', 'stock', 'payout', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    metadata JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_merchant ON notification("merchantId", "createdAt" DESC);

-- Enable RLS
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflict
DROP POLICY IF EXISTS "Merchants can view own notifications" ON notification;
DROP POLICY IF EXISTS "System can insert notifications" ON notification;
DROP POLICY IF EXISTS "Merchants can update own notifications" ON notification;

CREATE POLICY "Merchants can view own notifications" ON notification
FOR SELECT TO authenticated
USING ("merchantId" = auth.uid());

CREATE POLICY "System can insert notifications" ON notification
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Merchants can update own notifications" ON notification
FOR UPDATE TO authenticated
USING ("merchantId" = auth.uid());
