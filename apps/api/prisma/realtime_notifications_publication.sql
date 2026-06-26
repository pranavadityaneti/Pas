-- =============================================
-- Realtime: add `notifications` to the supabase_realtime publication
-- Run this in the Supabase SQL Editor (or via `prisma db execute`).
-- =============================================
--
-- WHY THIS EXISTS (root-cause finding, 2026-06-26):
-- Both the consumer app (apps/consumer-app/src/hooks/useNotifications.ts) and
-- the merchant app (apps/merchant-app/src/hooks/useNotifications.ts) open a
-- Supabase Realtime `postgres_changes` channel on public.notifications to
-- deliver LIVE in-app notifications (toast + sound/haptics + unread bump) while
-- the app is open.
--
-- However, public.notifications was NEVER a member of the supabase_realtime
-- publication, so Postgres never emitted WAL change events for it and those
-- subscription callbacks never fired in production. Live in-app notifications
-- have therefore never worked while an app was open; the bell only updated on
-- fetch / focus / manual refresh. A merchant-app code comment had previously
-- misdiagnosed the symptom as an invalid two-part realtime filter and "fixed"
-- the filter — but the real (remaining) blocker was this missing publication
-- membership. Adding the table here closes the root cause.
--
-- SECURITY (cross-user isolation): for `postgres_changes`, Realtime only
-- delivers a row to a subscriber that can SELECT it under RLS. public.notifications
-- has RLS ENABLED with SELECT policy `auth.uid() = user_id`
-- (see prisma/rls_notifications.sql), so a subscriber only ever receives its
-- OWN rows. The apps additionally filter `user_id=eq.<uid>` server-side and
-- fail closed on `recipient_role` in the callback. Defense in depth — no leak.
--
-- REPLICA IDENTITY: the apps subscribe to INSERT events only, so the table's
-- default REPLICA IDENTITY (primary key) is sufficient. No change required.
--
-- Idempotent: the DO block is a no-op if the table is already a member, so this
-- file is safe to re-run and safe to ship as the committed source of truth.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE 'Added public.notifications to supabase_realtime publication.';
  ELSE
    RAISE NOTICE 'public.notifications already in supabase_realtime publication - no-op.';
  END IF;
END $$;

-- Verify after running:
-- SELECT schemaname, tablename FROM pg_publication_tables
--   WHERE pubname = 'supabase_realtime' AND tablename = 'notifications';
-- (expect exactly one row: public.notifications)
