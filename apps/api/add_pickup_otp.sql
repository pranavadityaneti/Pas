-- 1. Add Pickup Code Column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(4);

-- 2. Create Trigger Function to Auto-Generate 4-Digit Code
CREATE OR REPLACE FUNCTION generate_pickup_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate a random 4-digit number (1000-9999)
    NEW.pickup_code := floor(random() * (9999 - 1000 + 1) + 1000)::int::text;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach Trigger
DROP TRIGGER IF EXISTS set_pickup_code ON orders;
CREATE TRIGGER set_pickup_code
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_pickup_code_trigger();

-- 4. Secure Verification RPC
-- This ensures the frontend never sees the code, only sends a guess.
CREATE OR REPLACE FUNCTION verify_pickup_code(order_id_input UUID, code_input TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    correct_code TEXT;
BEGIN
    SELECT pickup_code INTO correct_code
    FROM orders
    WHERE id = order_id_input;

    IF correct_code = code_input THEN
        -- If correct, automatically mark as completed
        UPDATE orders SET status = 'completed' WHERE id = order_id_input;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
