-- RPC Function: get_merchants_with_stats
-- Returns all merchants with computed 30-day order/revenue statistics
-- Uses Store.merchant_id to link orders to merchants

CREATE OR REPLACE FUNCTION get_merchants_with_stats()
RETURNS TABLE (
  id TEXT,
  store_name TEXT,
  branch_name TEXT,
  owner_name TEXT,
  email TEXT,
  phone TEXT,
  city TEXT,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  has_branches BOOLEAN,
  kyc_status TEXT,
  status TEXT,
  rating DOUBLE PRECISION,
  commission_rate DOUBLE PRECISION,
  operating_hours TEXT,
  operating_days TEXT[],
  pan_number TEXT,
  aadhar_number TEXT,
  bank_account_number TEXT,
  ifsc_code TEXT,
  pan_document_url TEXT,
  msme_number TEXT,
  msme_certificate_url TEXT,
  fssai_number TEXT,
  fssai_certificate_url TEXT,
  bank_beneficiary_name TEXT,
  category TEXT,
  pan_doc_url TEXT,
  aadhar_front_url TEXT,
  aadhar_back_url TEXT,
  gst_number TEXT,
  gst_certificate_url TEXT,
  store_photos TEXT[],
  kyc_rejection_reason TEXT,
  turnover_range TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_online BOOLEAN,
  last_active TIMESTAMPTZ,
  orders_30d BIGINT,
  revenue_30d DOUBLE PRECISION
) 
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    m.id, m.store_name, m.branch_name, m.owner_name, m.email, m.phone,
    m.city, m.address, m.latitude, m.longitude, m.has_branches,
    m.kyc_status, m.status, COALESCE(m.rating, 0) as rating,
    m.commission_rate, m.operating_hours, m.operating_days,
    m.pan_number, m.aadhar_number, m.bank_account_number, m.ifsc_code,
    m.pan_document_url, m.msme_number, m.msme_certificate_url, 
    m.fssai_number, m.fssai_certificate_url, m.bank_beneficiary_name, m.category,
    m.pan_doc_url, m.aadhar_front_url, m.aadhar_back_url,
    m.gst_number, m.gst_certificate_url, m.store_photos,
    m.kyc_rejection_reason, m.turnover_range, m.created_at, m.updated_at,
    false as is_online,
    NULL::TIMESTAMPTZ as last_active,
    COALESCE(stats.order_count, 0) as orders_30d,
    COALESCE(stats.total_revenue, 0) as revenue_30d
  FROM merchants m
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as order_count, SUM(o.total_amount) as total_revenue
    FROM public.orders o
    WHERE o.store_id IN (SELECT s.id FROM public."Store" s WHERE s.merchant_id = m.id)
    AND o.created_at > NOW() - INTERVAL '30 days'
    AND o.status NOT IN ('CANCELLED')
  ) stats ON true
  ORDER BY m.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_merchants_with_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_merchants_with_stats() TO service_role;

