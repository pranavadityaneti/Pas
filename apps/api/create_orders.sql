-- Create Order Status Enum
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'completed', 'cancelled', 'disputed');

-- Create Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT,     -- Denormalized for easier display
  customer_phone TEXT,    -- Denormalized
  store_id UUID REFERENCES merchants(id) ON DELETE CASCADE, -- Link to existing merchants table
  store_name TEXT,        -- Denormalized
  status order_status DEFAULT 'pending',
  amount NUMERIC(10, 2) DEFAULT 0,
  sla_minutes INT DEFAULT 45,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_name TEXT,
  quantity INT,
  price NUMERIC(10, 2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;

-- RLS Policies (Simplistic for Admin Dashboard)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for public" ON orders FOR ALL USING (true); -- Dev mode

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for public" ON order_items FOR ALL USING (true); -- Dev mode
