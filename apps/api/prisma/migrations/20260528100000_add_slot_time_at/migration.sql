-- Add slot_time_at column to orders and order_requests.
-- This column stores the absolute UTC timestamp of the customer's chosen slot,
-- parsed from the human-readable `arrival_time` text at order creation time.
-- Used by scheduled cron jobs to fire reminder notifications.
-- Existing rows are left NULL — they're already in the past and won't get reminders.

-- AlterTable
ALTER TABLE "public"."orders" ADD COLUMN "slot_time_at" TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "public"."order_requests" ADD COLUMN "slot_time_at" TIMESTAMPTZ(6);
