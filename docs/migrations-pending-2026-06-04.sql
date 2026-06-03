-- =====================================================================
-- admin_audit_log — generic audit table for admin-tier actions
--
-- Apply via Supabase SQL Editor. Idempotent (CREATE TABLE IF NOT EXISTS).
-- Safe to re-run.
--
-- Why this exists:
--   PATCH /admin/orders/:id (Force Complete / Force Cancel) and the
--   PATCH /admin/users/:id (suspend/reactivate, role changes) endpoints
--   had no trail. Anyone with SUPER_ADMIN or OPERATIONS could flip an
--   order's status with zero record. This table is the compliance /
--   accountability layer.
--
--   apps/api/src/index.ts has a recordAdminAudit() helper that writes
--   here. The helper is best-effort wrapped in try/catch so the user-
--   facing action succeeds even before this table exists. Once you
--   apply this SQL, entries start landing automatically — no code
--   change needed.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid          NOT NULL,
  actor_role    text,                                  -- denormalized for fast filtering
  action        text          NOT NULL,                -- e.g. 'order.status_change', 'user.suspend'
  target_table  text          NOT NULL,                -- e.g. 'orders', 'User'
  target_id     text          NOT NULL,                -- the PK of the row affected
  before_value  jsonb,                                 -- null on INSERT, prior state on UPDATE
  after_value   jsonb,                                 -- new state on INSERT/UPDATE, null on DELETE
  reason        text,                                  -- optional human-supplied reason
  ip_address    text,                                  -- caller IP for forensics (optional)
  user_agent    text,                                  -- caller UA (optional)
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx
  ON public.admin_audit_log(actor_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON public.admin_audit_log(target_table, target_id);

CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx
  ON public.admin_audit_log(action);

CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx
  ON public.admin_audit_log(created_at DESC);

-- Tighten access — admin reads/writes go through the API (service_role),
-- not directly via PostgREST.
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Verify
-- SELECT * FROM public.admin_audit_log ORDER BY created_at DESC LIMIT 5;
