const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://llhxkonraqaxtradyycj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk'
);

async function test() {
  const { data, error } = await supabase.rpc('get_nearby_stores', {
    user_lat: 17.4486,
    user_lon: 78.3908,
    radius_meters: 500000
  });
  console.log("POSTGIS_RAW_PAYLOAD:");
  console.log("data length:", data?.length);
  console.log("rpcError:", error);
}

test();
