
import { PrismaClient } from '@prisma/client';
const fetch = require('node-fetch');

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000'; // Adjust if PORT is different

async function testAcceptOrder() {
    try {
        console.log('🧪 Testing Order Acceptance (PENDING -> CONFIRMED)...');

        // 1. Get a PENDING order
        const order = await prisma.order.findFirst({
            where: { status: 'PENDING' }
        });

        if (!order) {
            console.error('❌ No PENDING order found to test.');
            return;
        }

        console.log(`Checking Order: ${order.orderNumber} (${order.id})`);

        // 2. Call API
        const response = await fetch(`${API_URL}/orders/${order.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'CONFIRMED' })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ Success:', data);
        } else {
            console.error('❌ Failed:', response.status, response.statusText);
            console.error('Error Details:', JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error('Test Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testAcceptOrder();
