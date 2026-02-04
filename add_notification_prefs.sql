-- Add notification_preferences column to User table
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "notification_preferences" jsonb DEFAULT '{"newOrder": true, "orderCancelled": true, "sound": true, "vibration": true, "soundType": "Default"}'::jsonb;

-- Grant permissions just in case
GRANT SELECT, UPDATE ON TABLE "User" TO authenticated;
GRANT SELECT, UPDATE ON TABLE "User" TO service_role;
