async function testMerchantSignup() {
    const apiBase = 'http://localhost:3000';
    const testPhone = '915555555555';

    try {
        console.log('--- Testing /auth/send-otp ---');
        await fetch(`${apiBase}/auth/send-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: testPhone })
        });

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
        const token = verifyData.session?.access_token;
        console.log('Got Token:', token ? 'YES' : 'NO');

        console.log('\n--- Testing /auth/merchant/signup ---');
        const signupRes = await fetch(`${apiBase}/auth/merchant/signup`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                ownerName: "Test Owner",
                email: "merchant@test.com",
                phone: "915555555555",
                storeName: "Test Store",
                category: "Retail",
                city: "Test City",
                address: "123 Test St",
                latitude: 12.34,
                longitude: 56.78,
                hasBranches: false,
                panNumber: "ABCDE1234F",
                aadharNumber: "123456789012",
                bankAccount: "123456789",
                ifsc: "TEST0123456",
                beneficiaryName: "Test Beneficiary",
                turnoverRange: "0-10L",
                gstNumber: "22AAAAA0000A1Z5",
                storePhotos: ["http://test.com/photo1.jpg"],
                docUrls: {
                    pan: "http://test.com/pan.jpg",
                    aadharFront: "http://test.com/aadharF.jpg",
                    aadharBack: "http://test.com/aadharB.jpg",
                    gst: "http://test.com/gst.jpg"
                }
            })
        });
        const signupData = await signupRes.json();
        console.log('Signup Response Status:', signupRes.status);
        console.log('Signup Response:');
        console.dir(signupData, { depth: null, colors: true });

    } catch (err) {
        console.error('API Test Failed:', err.message);
    }
}

testMerchantSignup();
