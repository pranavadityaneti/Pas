
import axios from 'axios';

const API_BASE = 'http://localhost:3000';
const STORE_ID = '9103ca71-523e-4e84-a664-3e40825f1be8'; // Jon Kirana / My Scape Market

async function verifyEndpoints() {
    try {
        console.log(`--- Verifying Merchant Inventory for Store: ${STORE_ID} ---`);
        const invRes = await axios.get(`${API_BASE}/merchants/${STORE_ID}/inventory`);
        console.log(`Inventory Items Found: ${invRes.data.length}`);
        if (invRes.data.length > 0) {
            console.log('Sample Item:', JSON.stringify({
                name: invRes.data[0].product.name,
                stock: invRes.data[0].stock,
                price: invRes.data[0].price
            }, null, 2));
        }

        console.log(`\n--- Verifying Merchant Branches for Store: ${STORE_ID} ---`);
        const branchRes = await axios.get(`${API_BASE}/merchants/${STORE_ID}/branches`);
        console.log(`Branches Found: ${branchRes.data.length}`);
        branchRes.data.forEach((b: any) => {
            console.log(`- ${b.name} (${b.id}) | Address: ${b.address}`);
        });

    } catch (error: any) {
        console.error('Verification Failed:', error.message);
        if (error.response) {
            console.error('Response Data:', error.response.data);
        }
    }
}

verifyEndpoints();
