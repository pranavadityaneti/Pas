
require('dotenv').config();
const Razorpay = require('razorpay');

async function checkRazorpay() {
    console.log('🔍 Checking Razorpay Configuration...');

    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        console.error('❌ Missing Razorpay Keys in .env file!');
        console.log('   Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to apps/api/.env');
        return;
    }

    console.log(`✅ Keys found: ID starts with ${key_id.substring(0, 8)}...`);

    const instance = new Razorpay({
        key_id: key_id,
        key_secret: key_secret
    });

    try {
        // Try to fetch a dummy refund or just check if we can instantiate without error
        // A better check is to list payments or orders, usually restricted but "orders.all" might work if keys are valid
        console.log('📡 Attempting to authenticate with Razorpay API...');

        // Fetch 1 order to test auth
        const orders = await instance.orders.all({ from: Math.floor(Date.now() / 1000) - 86400, count: 1 });

        console.log('✅ Connection Successful!');
        console.log(`   Fetched ${orders.count || 0} orders from Razorpay to verify auth.`);
    } catch (error: any) {
        console.error('❌ Connection Failed:', error.description || error.message);
        console.error('   Details:', JSON.stringify(error, null, 2));
    }
}

checkRazorpay();
