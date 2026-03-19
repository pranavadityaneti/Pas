async function testOtpApi() {
    const apiBase = 'http://localhost:3000';
    const testPhone = '915555555555';

    try {
        console.log('--- Testing /auth/send-otp ---');
        const sendRes = await fetch(`${apiBase}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone })
        });
        const sendData = await sendRes.json();
        console.log('Send OTP Response:', sendData);

        // Fetch the generated OTP from DB to verify
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: 'postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
        
        const dbRes = await pool.query('SELECT otp FROM otp_verifications WHERE phone = $1 ORDER BY created_at DESC LIMIT 1', [testPhone]);
        const testOtp = dbRes.rows[0].otp;
        console.log(`Retrieved OTP from DB: ${testOtp}`);
        await pool.end();

        console.log('\n--- Testing /auth/verify-otp ---');
        const verifyRes = await fetch(`${apiBase}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone, otp: testOtp })
        });
        const verifyData = await verifyRes.json();
        console.log('Verify OTP Response Status:', verifyRes.status);
        if (verifyData.success) {
            console.log('Session tokens received successfully');
            console.log('User ID:', verifyData.user.id);
            console.log('Is New User:', verifyData.isNewUser);
        } else {
            console.error('FAILED:', verifyData);
        }

    } catch (err) {
        console.error('API Test Failed:', err.message);
    }
}

testOtpApi();
