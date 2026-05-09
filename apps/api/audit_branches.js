const { Client } = require('pg');

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

async function main() {
  const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
  await client.connect();

  const { rows } = await client.query(`SELECT id, branch_name, latitude, longitude, is_active, merchant_id FROM merchant_branches ORDER BY branch_name;`);

  const userLat = 16.816;
  const userLon = 81.812;

  console.log(`\nUser Location: ${userLat}, ${userLon} (Vadapalli)\n`);
  console.log('ID | Name | Lat | Lon | Active | Distance (km)');
  console.log('-'.repeat(100));

  rows.forEach(r => {
    const dist = (r.latitude && r.longitude) ? haversineKm(userLat, userLon, r.latitude, r.longitude).toFixed(1) : 'NO COORDS';
    console.log(`${r.id} | ${r.branch_name} | ${r.latitude} | ${r.longitude} | ${r.is_active} | ${dist} km`);
  });

  await client.end();
}
main();
