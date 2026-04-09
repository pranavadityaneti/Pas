const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const OLD_ID = '63c32d5a-3132-433c-98c4-dbd7d1429342';
const NEW_ID = 'e49016c2-1065-486c-ae5a-8d3dbfce872a';

async function run() {
    try {
        console.log('=== PHASE 1: SURGICAL UNBLOCK ===');

        await prisma.$transaction([
            // Prevent unique constraint violations
            prisma.$executeRawUnsafe(`UPDATE "User" SET email = email || '_old' WHERE id = $1::uuid`, OLD_ID),
            prisma.$executeRawUnsafe(`UPDATE merchants SET email = email || '_old' WHERE id = $1`, OLD_ID),

            // 1. Insert new Merchant
            prisma.$executeRawUnsafe(`
                INSERT INTO merchants (id, store_name, branch_name, owner_name, email, phone, city, address, latitude, longitude, has_branches, kyc_status, status, rating, commission_rate, operating_hours, created_at, updated_at, operating_days, pan_doc_url, aadhar_front_url, aadhar_back_url, kyc_rejection_reason, pan_number, aadhar_number, bank_account_number, ifsc_code, turnover_range, msme_number, pan_document_url, msme_certificate_url, gst_number, gst_certificate_url, store_photos, bank_name, bank_beneficiary_name, fssai_certificate_url, fssai_number, bank_accounts, vertical_id)
                SELECT $2, store_name, branch_name, owner_name, replace(email, '_old', ''), phone, city, address, latitude, longitude, has_branches, kyc_status, status, rating, commission_rate, operating_hours, created_at, updated_at, operating_days, pan_doc_url, aadhar_front_url, aadhar_back_url, kyc_rejection_reason, pan_number, aadhar_number, bank_account_number, ifsc_code, turnover_range, msme_number, pan_document_url, msme_certificate_url, gst_number, gst_certificate_url, store_photos, bank_name, bank_beneficiary_name, fssai_certificate_url, fssai_number, bank_accounts, vertical_id
                FROM merchants WHERE id = $1
            `, OLD_ID, NEW_ID),

            // Update subscriptions
            prisma.$executeRawUnsafe(`UPDATE subscriptions SET merchant_id = $2 WHERE merchant_id = $1`, OLD_ID, NEW_ID),

            // 2. Insert new User
            prisma.$executeRawUnsafe(`
                INSERT INTO "User" (id, email, "passwordHash", role, name, phone, "createdAt", "updatedAt", notification_preferences)
                SELECT $2::uuid, replace(email, '_old', ''), "passwordHash", role, name, phone, "createdAt", "updatedAt", notification_preferences
                FROM "User" WHERE id = $1::uuid
            `, OLD_ID, NEW_ID),

            // 3. Update Store
            prisma.$executeRawUnsafe(`
                UPDATE "Store" 
                SET "managerId" = $2::uuid, 
                    "merchant_id" = $2, 
                    active = true 
                WHERE "managerId" = $1::uuid
            `, OLD_ID, NEW_ID),

            // 4. Delete old User
            prisma.$executeRawUnsafe(`DELETE FROM "User" WHERE id = $1::uuid`, OLD_ID),

            // 5. Delete old Merchant
            prisma.$executeRawUnsafe(`DELETE FROM merchants WHERE id = $1`, OLD_ID)
        ]);

        console.log('Successfully reconciled IDs and updated Store status.');

    } catch (error) {
        console.error('Update failed:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
