import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function testSignupTransaction() {
    const userId = crypto.randomUUID();
    const cityId = crypto.randomUUID();
    const verticalId = 'c307b78e-b924-47a1-a5a7-4405777fa50c';

    const payload = {
        ownerName: "Test Owner",
        email: `test_${Date.now()}@example.com`,
        phone: "9999999999",
        storeName: "Test Store",
        category: "Grocery",
        city: "Test City 1774176523",
        address: "123 Test St",
        latitude: 12.9716,
        longitude: 77.5946,
        hasBranches: false,
        status: "inactive",
        kycStatus: "pending",
        panNumber: "ABCDE1234F",
        aadharNumber: "123456789012",
        msmeNumber: "",
        bankAccount: "123456789",
        ifsc: "SBIN0000001",
        beneficiaryName: "Test Beneficiary",
        turnoverRange: "0-10L",
        gstNumber: "22AAAAA0000A1Z5",
        fssaiNumber: "",
        docUrls: {
            pan: "https://example.com/pan.png",
            aadharFront: "https://example.com/aadharF.png",
            aadharBack: "https://example.com/aadharB.png",
            msme: null,
            gst: "https://example.com/gst.png",
            fssai: null
        },
        storePhotos: []
    };

    try {
        console.log("Starting transaction with userId:", userId);
        
        await prisma.city.create({
            data: { id: cityId, name: payload.city, active: true, updatedAt: new Date() }
        });

        await prisma.$transaction(async (tx) => {
            console.log("Upserting User...");
            await tx.user.upsert({
                where: { email: payload.email },
                update: {
                    id: userId,
                    role: 'MERCHANT',
                    name: payload.ownerName,
                    phone: payload.phone
                },
                create: {
                    id: userId,
                    email: payload.email,
                    name: payload.ownerName,
                    role: 'MERCHANT',
                    passwordHash: 'sso_auth_active',
                    phone: payload.phone,
                    updatedAt: new Date()
                }
            });

            console.log("Creating Store...");
            await tx.store.create({
                data: {
                    id: userId,
                    name: payload.storeName,
                    cityId: cityId,
                    managerId: userId,
                    address: payload.address,
                    active: false,
                    image: null,
                    updatedAt: new Date()
                }
            });

            console.log("Creating Merchant...");
            await tx.merchant.create({
                data: {
                    id: userId,
                    storeName: payload.storeName,
                    ownerName: payload.ownerName,
                    email: payload.email,
                    phone: payload.phone,
                    city: payload.city,
                    address: payload.address,
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    hasBranches: payload.hasBranches,
                    status: payload.status,
                    kycStatus: payload.kycStatus,
                    panNumber: payload.panNumber,
                    aadharNumber: payload.aadharNumber,
                    msmeNumber: payload.msmeNumber || '',
                    bankAccountNumber: payload.bankAccount,
                    ifscCode: payload.ifsc,
                    bankBeneficiaryName: payload.beneficiaryName,
                    turnoverRange: payload.turnoverRange,
                    panDocUrl: payload.docUrls.pan || null,
                    aadharFrontUrl: payload.docUrls.aadharFront || null,
                    aadharBackUrl: payload.docUrls.aadharBack || null,
                    msmeCertificateUrl: payload.docUrls.msme || null,
                    gstNumber: payload.gstNumber,
                    gstCertificateUrl: payload.docUrls.gst || null,
                    fssaiNumber: payload.fssaiNumber || '',
                    fssaiCertificateUrl: payload.docUrls.fssai || null,
                    storePhotos: payload.storePhotos,
                    verticalId: verticalId
                }
            });
        });

        console.log("Transaction Successful!");
    } catch (error) {
        console.error("TRANSACTION FAILED WITH ERROR:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

testSignupTransaction();
