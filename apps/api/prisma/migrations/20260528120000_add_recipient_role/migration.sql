-- Add recipient_role to notifications to cleanly separate merchant vs consumer
-- notifications for dual-role accounts (a user who is both a merchant AND a customer).
-- Replaces the temporary type-allowlist scoping in the consumer app.
--
-- ⚠️ NOT YET APPLIED — staged for the June 6 deploy batch. Cutover order MATTERS:
--   1. `prisma migrate deploy`  → creates the column + runs the backfill below.
--   2. Deploy the API with notification.service.ts setting recipient_role on every
--      write (already staged: 'merchant' in sendMerchantNotification, 'consumer' in
--      sendConsumerNotification).
--   3. ONLY THEN swap the app read-filters to recipient_role:
--        - consumer: replace the CONSUMER_NOTIFICATION_TYPES allowlist in
--          apps/consumer-app/src/hooks/useNotifications.ts with
--          `.eq('recipient_role', 'consumer')`.
--        - merchant: add `.eq('recipient_role', 'merchant')` in
--          apps/merchant-app/src/hooks/useNotifications.ts.
--      Swapping the read-filters BEFORE steps 1+2 are live would make rows with a
--      NULL recipient_role vanish from the lists — so do it last.

ALTER TABLE "public"."notifications" ADD COLUMN "recipient_role" TEXT;

-- Backfill existing rows by type. All historical notifications are merchant-side
-- (the consumer dispatch wasn't live yet), so consumer-types → 'consumer' and
-- everything else (incl. NEW_ORDER, READY, COMPLETED, and the ambiguous
-- ORDER_CANCELLED, which historically were merchant request-rejections) → 'merchant'.
UPDATE "public"."notifications"
SET "recipient_role" = 'consumer'
WHERE "type" IN (
    'ORDER_CONFIRMED', 'PAYMENT_SUCCESSFUL', 'ORDER_READY', 'ORDER_COMPLETED',
    'DINING_BOOKED', 'DINING_READY',
    'PICKUP_REMINDER_30MIN', 'PICKUP_REMINDER_10MIN', 'DINING_REMINDER_30MIN'
);

UPDATE "public"."notifications"
SET "recipient_role" = 'merchant'
WHERE "recipient_role" IS NULL;

-- Optional (consider on June 6 once populated): partial index to speed per-role reads.
-- CREATE INDEX IF NOT EXISTS idx_notifications_user_role
--   ON "public"."notifications" ("user_id", "recipient_role");
