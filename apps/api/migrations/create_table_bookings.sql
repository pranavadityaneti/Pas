-- Table Booking + Slot Allocation System
-- Run against Supabase Postgres (DIRECT_URL, not pooler)

-- 1. New columns on merchant_branches for service modes + slot config
ALTER TABLE merchant_branches
  ADD COLUMN IF NOT EXISTS service_pickup BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_dinein BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS service_table_booking BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slot_config JSONB DEFAULT '[]'::jsonb;

-- 2. table_bookings table
CREATE TABLE IF NOT EXISTS table_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT NOT NULL REFERENCES merchant_branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  slot_date DATE NOT NULL,
  slot_time TEXT NOT NULL,
  guests_count INT NOT NULL DEFAULT 2,
  booking_fee INT NOT NULL DEFAULT 25,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  payment_id TEXT,
  razorpay_order_id TEXT,
  otp TEXT NOT NULL,
  order_id UUID,
  customer_name TEXT,
  customer_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_booking_status CHECK (status IN ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'))
);

CREATE INDEX IF NOT EXISTS idx_tb_branch_date ON table_bookings(branch_id, slot_date, slot_time) WHERE status = 'CONFIRMED';
CREATE INDEX IF NOT EXISTS idx_tb_user ON table_bookings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tb_branch_status ON table_bookings(branch_id, status, slot_date);

-- 3. Enable Supabase Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE table_bookings;

-- 4. Atomic slot reservation function (concurrency-safe)
CREATE OR REPLACE FUNCTION reserve_table_slot(
  p_branch_id TEXT,
  p_user_id UUID,
  p_slot_date DATE,
  p_slot_time TEXT,
  p_guests_count INT,
  p_booking_fee INT,
  p_payment_id TEXT,
  p_razorpay_order_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT
)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_capacity INT;
  v_current_count INT;
  v_otp TEXT;
  v_booking_id UUID;
  v_slot_config JSONB;
  v_day_of_week INT;
  v_config_entry JSONB;
BEGIN
  -- Get branch slot config (shared lock on branch row)
  SELECT slot_config INTO v_slot_config
  FROM merchant_branches
  WHERE id = p_branch_id AND is_active = true AND service_table_booking = true
  FOR SHARE;

  IF v_slot_config IS NULL OR v_slot_config = '[]'::jsonb THEN
    RETURN json_build_object('success', false, 'error', 'Table booking not configured for this branch');
  END IF;

  -- Day of week: Postgres DOW gives 0=Sun, convert to 0=Mon..6=Sun
  v_day_of_week := (EXTRACT(DOW FROM p_slot_date)::INT + 6) % 7;

  -- Find matching config entry for this day
  SELECT elem INTO v_config_entry
  FROM jsonb_array_elements(v_slot_config) AS elem
  WHERE elem->'days' @> to_jsonb(v_day_of_week);

  IF v_config_entry IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'No booking slots configured for this day');
  END IF;

  v_capacity := (v_config_entry->>'tables_per_slot')::INT;

  -- Count existing confirmed bookings for this slot (row-level lock)
  SELECT COUNT(*) INTO v_current_count
  FROM table_bookings
  WHERE branch_id = p_branch_id
    AND slot_date = p_slot_date
    AND slot_time = p_slot_time
    AND status = 'CONFIRMED'
  FOR UPDATE;

  IF v_current_count >= v_capacity THEN
    RETURN json_build_object('success', false, 'error', 'This slot is now full. Please choose another time.');
  END IF;

  -- Generate 4-digit OTP
  v_otp := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');

  -- Insert the booking
  INSERT INTO table_bookings (
    branch_id, user_id, slot_date, slot_time, guests_count,
    booking_fee, payment_id, razorpay_order_id, otp,
    customer_name, customer_phone, status
  ) VALUES (
    p_branch_id, p_user_id, p_slot_date, p_slot_time, p_guests_count,
    p_booking_fee, p_payment_id, p_razorpay_order_id, v_otp,
    p_customer_name, p_customer_phone, 'CONFIRMED'
  )
  RETURNING id INTO v_booking_id;

  RETURN json_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'otp', v_otp
  );
END;
$$;

-- 5. Slot availability query function
CREATE OR REPLACE FUNCTION get_slot_availability(
  p_branch_id TEXT,
  p_date DATE
)
RETURNS JSON
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_slot_config JSONB;
  v_operating_hours JSONB;
  v_day_of_week INT;
  v_config_entry JSONB;
  v_capacity INT;
  v_gap INT;
  v_open_time TEXT;
  v_close_time TEXT;
  v_open_minutes INT;
  v_close_minutes INT;
  v_lunch_start INT;
  v_lunch_end INT;
  v_has_lunch BOOLEAN;
  v_slots JSON;
BEGIN
  SELECT slot_config, operating_hours INTO v_slot_config, v_operating_hours
  FROM merchant_branches
  WHERE id = p_branch_id AND is_active = true AND service_table_booking = true;

  IF v_slot_config IS NULL OR v_slot_config = '[]'::jsonb THEN
    RETURN json_build_object('available', false, 'slots', '[]'::json);
  END IF;

  IF v_operating_hours IS NULL THEN
    RETURN json_build_object('available', false, 'slots', '[]'::json);
  END IF;

  -- Day of week (0=Mon..6=Sun)
  v_day_of_week := (EXTRACT(DOW FROM p_date)::INT + 6) % 7;

  -- Find matching slot config for this day
  SELECT elem INTO v_config_entry
  FROM jsonb_array_elements(v_slot_config) AS elem
  WHERE elem->'days' @> to_jsonb(v_day_of_week);

  IF v_config_entry IS NULL THEN
    RETURN json_build_object('available', false, 'slots', '[]'::json);
  END IF;

  v_capacity := (v_config_entry->>'tables_per_slot')::INT;
  v_gap := (v_config_entry->>'slot_gap_minutes')::INT;

  -- Parse operating hours (handle both "open"/"close" and "openTime"/"closeTime" keys)
  v_open_time := COALESCE(v_operating_hours->>'open', v_operating_hours->>'openTime', '09:00');
  v_close_time := COALESCE(v_operating_hours->>'close', v_operating_hours->>'closeTime', '22:00');

  v_open_minutes := SPLIT_PART(v_open_time, ':', 1)::INT * 60
                  + SPLIT_PART(v_open_time, ':', 2)::INT;
  v_close_minutes := SPLIT_PART(v_close_time, ':', 1)::INT * 60
                   + SPLIT_PART(v_close_time, ':', 2)::INT;

  v_has_lunch := COALESCE((v_operating_hours->>'hasLunchBreak')::BOOLEAN, false);

  IF v_has_lunch THEN
    v_lunch_start := SPLIT_PART(COALESCE(v_operating_hours->>'lunchStart', v_operating_hours->>'lunchBreakStart', '13:00'), ':', 1)::INT * 60
                   + SPLIT_PART(COALESCE(v_operating_hours->>'lunchStart', v_operating_hours->>'lunchBreakStart', '13:00'), ':', 2)::INT;
    v_lunch_end := SPLIT_PART(COALESCE(v_operating_hours->>'lunchEnd', v_operating_hours->>'lunchBreakEnd', '14:00'), ':', 1)::INT * 60
                 + SPLIT_PART(COALESCE(v_operating_hours->>'lunchEnd', v_operating_hours->>'lunchBreakEnd', '14:00'), ':', 2)::INT;
  END IF;

  -- Generate slots with booking counts
  WITH time_slots AS (
    SELECT generate_series(v_open_minutes, v_close_minutes - v_gap, v_gap) AS slot_minutes
  ),
  valid_slots AS (
    SELECT slot_minutes,
           LPAD((slot_minutes / 60)::TEXT, 2, '0') || ':' || LPAD((slot_minutes % 60)::TEXT, 2, '0') AS slot_time
    FROM time_slots
    WHERE NOT (v_has_lunch AND slot_minutes >= v_lunch_start AND slot_minutes < v_lunch_end)
  ),
  booking_counts AS (
    SELECT slot_time, COUNT(*) AS booked
    FROM table_bookings
    WHERE branch_id = p_branch_id
      AND slot_date = p_date
      AND status = 'CONFIRMED'
    GROUP BY slot_time
  )
  SELECT json_agg(json_build_object(
    'time', vs.slot_time,
    'booked', COALESCE(bc.booked, 0),
    'capacity', v_capacity,
    'remaining', v_capacity - COALESCE(bc.booked, 0)
  ) ORDER BY vs.slot_minutes)
  INTO v_slots
  FROM valid_slots vs
  LEFT JOIN booking_counts bc ON bc.slot_time = vs.slot_time;

  RETURN json_build_object('available', true, 'slots', COALESCE(v_slots, '[]'::json), 'capacity', v_capacity);
END;
$$;
