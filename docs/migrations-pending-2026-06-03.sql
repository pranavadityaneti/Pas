-- =====================================================================
-- Migrations pending 2026-06-03 — Analytics Dashboard extension
--
-- Apply order: 1. (already applied) 20260603160000_admin_allowlist_role
--              2. THIS FILE — get_super_admin_stats_in_range RPC
--
-- Run in: Supabase SQL Editor (production project).
-- Idempotent: CREATE OR REPLACE FUNCTION → safe to re-run.
--
-- Why this exists:
-- The existing `get_super_admin_stats` RPC returns a fixed 30-day window.
-- The Analytics Dashboard needs Today / 7d / 30d / 90d / custom-range filters.
-- This new RPC accepts (from_date, to_date) and returns the SAME jsonb shape.
--
-- Frontend behavior if NOT yet applied: the dashboard falls back to the old
-- 30-day RPC and shows a small "Date filter pending backend deploy" banner.
-- So shipping the UI before applying this SQL is non-breaking.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.get_super_admin_stats_in_range(
  from_date timestamptz,
  to_date   timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  WITH
    range_orders AS (
      SELECT *
      FROM "Order"
      WHERE created_at >= from_date
        AND created_at <  to_date
    ),
    totals AS (
      SELECT
        COALESCE(SUM(total_amount), 0)::numeric AS total_gmv,
        COUNT(*)::int                           AS total_orders
      FROM range_orders
    ),
    customers AS (
      SELECT COUNT(DISTINCT user_id)::int AS active_customers
      FROM range_orders
    ),
    merchants AS (
      -- Mirror existing RPC behavior: count of active merchants is a
      -- platform-level number, not range-filtered.
      SELECT COUNT(*)::int AS total_merchants
      FROM "Merchant"
      WHERE status = 'active'
    ),
    daily AS (
      SELECT
        TO_CHAR(DATE(created_at), 'MM-DD')      AS date_label,
        DATE(created_at)                         AS date_value,
        COALESCE(SUM(total_amount), 0)::numeric  AS gmv,
        COUNT(*)::int                            AS orders
      FROM range_orders
      GROUP BY DATE(created_at)
    ),
    status_brk AS (
      SELECT
        status::text   AS status,
        COUNT(*)::int  AS count
      FROM range_orders
      GROUP BY status
    ),
    top_stores AS (
      SELECT
        COALESCE(store_name, 'Unknown Store')   AS store_name,
        SUM(total_amount)::numeric              AS total_gmv,
        COUNT(*)::int                           AS total_orders
      FROM range_orders
      GROUP BY store_name
      ORDER BY SUM(total_amount) DESC
      LIMIT 25
    )
  SELECT jsonb_build_object(
    'totalGmv',        (SELECT total_gmv FROM totals),
    'totalOrders',     (SELECT total_orders FROM totals),
    'activeCustomers', (SELECT active_customers FROM customers),
    'totalMerchants',  (SELECT total_merchants FROM merchants),
    'dailyStats', COALESCE(
      (SELECT jsonb_agg(
                jsonb_build_object('date', date_label, 'gmv', gmv, 'orders', orders)
                ORDER BY date_value
              )
       FROM daily),
      '[]'::jsonb
    ),
    'statusBreakdown', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('status', status, 'count', count))
       FROM status_brk),
      '[]'::jsonb
    ),
    'topStores', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
                'storeName',  store_name,
                'totalGmv',   total_gmv,
                'totalOrders', total_orders
              ))
       FROM top_stores),
      '[]'::jsonb
    )
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_super_admin_stats_in_range(timestamptz, timestamptz)
  TO authenticated, anon, service_role;

-- Smoke test (paste after the CREATE if you want to verify in SQL Editor):
-- SELECT public.get_super_admin_stats_in_range(now() - interval '30 days', now() + interval '1 day');
