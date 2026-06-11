-- Phase 8 RLS lockdown — correction to 20260611020000_phase8_rls_lockdown.
--
-- WHAT WAS WRONG: the previous migration's
--   REVOKE UPDATE ("role", "isAdmin", "status", "suspended_at", "suspended_reason")
--       ON public."User" FROM authenticated, anon;
-- was a no-op. Postgres column privileges are ADDITIVE — a table-level UPDATE
-- grant covers every column regardless of column-specific REVOKEs. The
-- post-migration verify_p8_rls.ts caught it: all 5 escalation columns were
-- still UPDATE-grantable to anon + authenticated.
--
-- CORRECT PATTERN (the only one that actually blocks specific columns):
--   1. REVOKE table-level UPDATE entirely from anon + authenticated
--   2. GRANT column-level UPDATE only on the legitimately-updateable columns
--      The result: anon/authenticated can UPDATE only those columns; every
--      other column is implicitly denied at the privilege layer (before RLS
--      even evaluates).
--
-- COLUMNS GRANTED (audited 2026-06-11 — every direct PostgREST UPDATE on
-- public."User" across the three apps):
--   - merchant-app/app/(main)/settings/profile.tsx:27           UPDATE name, email
--   - merchant-app/app/(main)/settings/notifications.tsx:54     UPDATE notification_preferences
--   - admin-web/src/components/modules/settings/EditAdminDialog.tsx:43
--                                                               UPDATE name, updatedAt
--   - admin-web/src/components/modules/settings/DeleteAdminDialog.tsx:41
--                                                               DELETE (not UPDATE) —
--                                                               covered by table-level
--                                                               DELETE grant + the
--                                                               SUPER_ADMIN ALL policy
--   - admin-web/src/context/AuthContext.tsx:311                 INSERT (not UPDATE)
--                                                               — covered by the
--                                                                 SUPER_ADMIN ALL
--                                                                 policy
--   - consumer-app: no direct UPDATE of "User" via supabase-js
--
-- Privilege-escalation columns (role, isAdmin, status, suspended_at,
-- suspended_reason) and operational columns (passwordHash, email_verified
-- equivalents, createdAt, updatedAt, etc.) remain non-grantable to anon /
-- authenticated. Role assignment + suspension flows go through the API,
-- which uses service_role (bypasses RLS + grants).

REVOKE UPDATE ON public."User" FROM authenticated, anon;

GRANT UPDATE ("name", "email", "notification_preferences", "updatedAt")
    ON public."User" TO authenticated;
