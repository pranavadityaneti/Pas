const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

// We need the expo constants or just hardcode the URL and Key if .env has it
// Let's rely on the environment variables defined in merchant-app or we can fetch them from app.json dynamically
const fs = require('fs');
let supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    const dotenv = require('dotenv');
    const envConfig = dotenv.parse(fs.readFileSync('../../.env.local')); // checking root env if any
    supabaseUrl = envConfig.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_AWS_URL';
    supabaseKey = envConfig.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_AWS_KEY';
}

// Actually, in Expo, the env vars might be in consumer-app or api... let's just extract them from merchant-app/src/lib/supabase.ts
