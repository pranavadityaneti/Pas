
const fetch = require('node-fetch');
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'http://localhost:3000';

async function testRefund() {
    try {
        // 1. Find a RETURN_APPROVED order
        let order = await prisma.order.findFirst({
            where: { status: 'RETURN_APPROVED' }
        });

        if (!order) {
            console.log('⚠️ No RETURN_APPROVED order found. Creating one...');
            // Find a store and user to link
            const store = await prisma.store.findFirst();
            const user = await prisma.user.findFirst();
            if (!store || !user) throw new Error('Need store and user to seed order');

            order = await prisma.order.create({
                data: {
                    orderNumber: `TEST-REFUND-${Date.now()}`,
                    userId: user.id,
                    storeId: store.id,
                    totalAmount: 150,
                    status: 'RETURN_APPROVED',
                    isPaid: true, // Must be paid to refund
                    items: {
                        create: {
                            storeProductId: (await prisma.storeProduct.findFirst())?.id!,
                            quantity: 1,
                            price: 150
                        }
                    }
                }
            });
        }

        console.log(`🧪 Testing Refund for Order: ${order.orderNumber} (${order.id})`);

        // 2. Call Refund Endpoint
        const response = await fetch(`${API_URL}/orders/${order.id}/refund`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: order.totalAmount, reason: 'Test Refund Script' })
        });

        // 3. Check Protocol
        const contentType = response.headers.get('content-type');
        console.log(`Headers: Content-Type = ${contentType}`);

        // 4. Parse Response
        const text = await response.text();
        try {
            const data = JSON.parse(text);
            if (response.ok) {
                console.log('✅ Refund Success:', data);
            } else {
                console.log('❌ Refund Failed (Logic):', data);
            }
        } catch (e) {
            console.error('❌ Refund Crash (HTML/Invalid):', text.substring(0, 200));
        }

    } catch (error) {
        console.error('Test Execution Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testRefund();
