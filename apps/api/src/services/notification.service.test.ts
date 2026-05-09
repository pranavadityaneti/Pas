import test from 'node:test';
import assert from 'node:assert';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';

// We will mock the Prisma Client
let mockStoreData: any = null;
let mockBranchData: any = null;

const mockPrismaClient = {
    store: {
        findUnique: async ({ where }: any) => {
            if (mockStoreData && mockStoreData.id === where.id) return mockStoreData;
            return null;
        }
    },
    merchantBranch: {
        findFirst: async ({ where }: any) => {
            if (mockBranchData && mockBranchData.id === where.id) return mockBranchData;
            return null;
        }
    }
} as unknown as PrismaClient;

const notificationService = new NotificationService(mockPrismaClient);

test('NotificationService - resolveRecipientUserId', async (t) => {
    
    await t.test('1. Store + main branch only, owner has managerId set -> returns owner UUID', async () => {
        const storeId = crypto.randomUUID();
        const ownerId = crypto.randomUUID();
        mockStoreData = { id: storeId, managerId: ownerId, merchantId: null };
        mockBranchData = null;

        const resolved = await (notificationService as any).resolveRecipientUserId(storeId);
        assert.strictEqual(resolved, ownerId);
    });

    await t.test('2. Resolving for additional branch returns the branch manager', async () => {
        const branchId = crypto.randomUUID();
        const managerId = crypto.randomUUID();
        
        mockStoreData = null; // Store lookup fails because it's an additional branch ID
        mockBranchData = { id: branchId, merchantId: managerId }; // Manager ID is stored in merchantId for branch

        const resolved = await (notificationService as any).resolveRecipientUserId(branchId);
        assert.strictEqual(resolved, managerId);
    });

    await t.test('3. Branch row exists with null/missing merchantId -> returns null, does not throw', async () => {
        const branchId = crypto.randomUUID();
        
        mockStoreData = null;
        mockBranchData = { id: branchId, merchantId: null }; // Corruption case

        const resolved = await (notificationService as any).resolveRecipientUserId(branchId);
        assert.strictEqual(resolved, null);
    });

    await t.test('4. storeId passed in matches no Store or MerchantBranch row -> returns null, does not throw', async () => {
        const unknownId = crypto.randomUUID();
        
        mockStoreData = null;
        mockBranchData = null;

        const resolved = await (notificationService as any).resolveRecipientUserId(unknownId);
        assert.strictEqual(resolved, null);
    });

});
