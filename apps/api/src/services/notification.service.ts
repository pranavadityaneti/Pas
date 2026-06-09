import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';
import * as Sentry from '@sentry/node';

const expo = new Expo();

export interface SendNotificationParams {
    storeId: string;
    title: string;
    body: string;
    type: string;           // 'NEW_ORDER', 'CANCELLED', 'READY', 'LOW_STOCK', etc.
    referenceId?: string;   // The order ID or entity ID for deep linking
    link?: string;          // Deep-link path used by merchant app's routeForNotification helper (e.g., '/(main)/orders')
    metadata?: any;         // Rich JSON payload (order total, customer name, item count) for offline browsing
    tx?: any;               // Optional Prisma.TransactionClient
}

export interface SendConsumerNotificationParams {
    userId: string;          // The consumer's auth UID (the customer who placed the order)
    title: string;
    body: string;
    type: string;           // 'ORDER_CONFIRMED', 'PAYMENT_SUCCESSFUL', 'ORDER_READY', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'DINING_BOOKED', 'DINING_READY'
    referenceId?: string;   // The order ID or entity ID for deep linking
    link?: string;          // Deep-link path used by customer app's routeForNotification helper
    metadata?: any;         // Rich JSON payload (order total, store name, item count) for offline browsing
    storeId?: string;       // Optional — the merchant's store/branch UUID for context (so notifications can be grouped by store later)
    tx?: any;               // Optional Prisma.TransactionClient
}

class NotificationService {
    private prisma: PrismaClient;

    constructor(prisma: PrismaClient) {
        this.prisma = prisma;
    }

    /**
     * Main dispatch method: writes an in-app notification AND sends push notifications
     * to all active devices registered for the store's owner.
     */
    async sendMerchantNotification(params: SendNotificationParams): Promise<void> {
        const { storeId, title, body, type, referenceId, link, metadata, tx } = params;
        const prismaClient = tx ?? this.prisma;

        console.log(`[NotificationService] Attempting dispatch | storeId=${storeId} type=${type} referenceId=${referenceId}`);

        try {
            // Step 1: Resolve the merchant user who owns this store
            const recipientUserId = await this.resolveRecipientUserId(storeId);
            
            console.log(`[NotificationService] Resolved recipient | storeId=${storeId} recipientUserId=${recipientUserId || 'null'}`);
            
            if (!recipientUserId) {
                console.warn(`[NotificationService] No recipient found for store ${storeId}. Notification dropped.`);
                try { Sentry.captureException(new Error('Notification recipient resolution returned null'), { extra: { storeId, type, referenceId } }); } catch {}
                return; // Gracefully return void. We do not throw to avoid rolling back the transaction.
            }

            // Step 2: Write the in-app notification record (with referenceId for deep linking)
            let dbResult;
            try {
                dbResult = await (prismaClient as any).notification.create({
                    data: {
                        userId: recipientUserId,
                        storeId,
                        type,
                        title,
                        message: body,
                        referenceId: referenceId || null,
                        link: link || null,
                        metadata: metadata ?? null,
                        isRead: false,
                        recipientRole: 'merchant'
                    }
                });
                console.log(`[NotificationService] DB Insert success | notificationId=${dbResult.id} storeId=${storeId} recipientUserId=${recipientUserId} referenceId=${referenceId}`);
            } catch (dbError) {
                console.error('[NotificationService] Failed to create notification record:', dbError);
                try { Sentry.captureException(dbError, { extra: { storeId, type, referenceId, area: 'notification.dbCreate' } }); } catch {}
                // If tx is provided, we MUST throw to roll back the transaction!
                // An invisible order is worse than a failed order.
                if (tx) throw dbError;
                // Otherwise, continue to push dispatch (legacy behavior outside of tx)
            }

            // Step 3: Fetch ALL active push tokens for this user (multi-device support)
            // Push is network I/O, keep it outside the transaction by ALWAYS using this.prisma
            const tokens = await (this.prisma as any).merchantPushToken.findMany({
                where: { userId: recipientUserId, isActive: true }
            });

            if (!tokens || tokens.length === 0) {
                console.log(`[NotificationService] No active push tokens for user ${recipientUserId}. In-app notification saved.`);
                try { Sentry.captureException(new Error('No active push tokens for merchant'), { extra: { storeId, type, referenceId, recipientUserId } }); } catch {}
                return;
            }

            // Step 4: Build Expo push messages
            const messages: ExpoPushMessage[] = tokens
                .filter((t: any) => Expo.isExpoPushToken(t.expoPushToken))
                .map((t: any) => ({
                    to: t.expoPushToken,
                    sound: 'default' as const,
                    title,
                    body,
                    data: { type, referenceId, storeId, link },
                    priority: 'high' as const
                }));

            if (messages.length === 0) {
                console.warn('[NotificationService] All tokens were invalid Expo push tokens.');
                return;
            }

            // Step 5: Send via Expo Push API (chunked for batches > 100)
            const chunks = expo.chunkPushNotifications(messages);
            for (const chunk of chunks) {
                try {
                    const tickets = await expo.sendPushNotificationsAsync(chunk);
                    // Lazily deactivate tokens that returned DeviceNotRegistered
                    await this.deactivateStaleTokens(tickets, tokens);
                    console.log(`[NotificationService] Push sent: ${tickets.length} ticket(s) for "${title}"`);
                } catch (pushError) {
                    console.error('[NotificationService] Expo push dispatch failed:', pushError);
                }
            }
        } catch (error) {
            console.error('[NotificationService] Fatal error in sendMerchantNotification:', error);
        }
    }

    /**
     * Customer-side dispatch: writes an in-app notification for a specific consumer (auth user)
     * AND sends push notifications to all of their active devices.
     *
     * Differs from sendMerchantNotification by:
     *  - Taking userId directly (no storeId-to-owner resolution step)
     *  - storeId is optional (context only — for grouping notifications by store later)
     *
     * Reuses the same `notifications` table and `MerchantPushToken` table (which is
     * misnamed but functionally generic — it stores tokens by userId without any
     * merchant-specific scoping). Cleanup rename to `UserPushToken` is queued separately.
     */
    async sendConsumerNotification(params: SendConsumerNotificationParams): Promise<void> {
        const { userId, title, body, type, referenceId, link, metadata, storeId, tx } = params;
        const prismaClient = tx ?? this.prisma;

        console.log(`[NotificationService] Consumer dispatch | userId=${userId} type=${type} referenceId=${referenceId}`);

        if (!this.isValidUUID(userId)) {
            console.warn(`[NotificationService] Consumer userId "${userId}" is not a valid UUID — skipping`);
            return;
        }

        try {
            // Step 1: Write the in-app notification record
            let dbResult;
            try {
                dbResult = await (prismaClient as any).notification.create({
                    data: {
                        userId,
                        storeId: storeId || null,
                        type,
                        title,
                        message: body,
                        referenceId: referenceId || null,
                        link: link || null,
                        metadata: metadata ?? null,
                        isRead: false,
                        recipientRole: 'consumer'
                    }
                });
                console.log(`[NotificationService] Consumer DB Insert success | notificationId=${dbResult.id} userId=${userId} referenceId=${referenceId}`);
            } catch (dbError) {
                console.error('[NotificationService] Failed to create consumer notification record:', dbError);
                // If tx is provided, throw to roll back the transaction
                if (tx) throw dbError;
            }

            // Step 2: Fetch ALL active push tokens for this consumer (multi-device support).
            // Note: we use the existing MerchantPushToken model — misnamed but functionally generic.
            // Always use this.prisma (not the tx) for push lookup since push is network I/O outside the tx.
            const tokens = await (this.prisma as any).merchantPushToken.findMany({
                where: { userId, isActive: true }
            });

            if (!tokens || tokens.length === 0) {
                console.log(`[NotificationService] No active push tokens for consumer ${userId}. In-app notification saved, no push sent.`);
                return;
            }

            // Step 3: Build Expo push messages
            const messages: ExpoPushMessage[] = tokens
                .filter((t: any) => Expo.isExpoPushToken(t.expoPushToken))
                .map((t: any) => ({
                    to: t.expoPushToken,
                    sound: 'default' as const,
                    title,
                    body,
                    data: { type, referenceId, link },
                    priority: 'high' as const
                }));

            if (messages.length === 0) {
                console.warn('[NotificationService] All consumer tokens were invalid Expo push tokens.');
                return;
            }

            // Step 4: Send via Expo Push API (chunked for batches > 100)
            const chunks = expo.chunkPushNotifications(messages);
            for (const chunk of chunks) {
                try {
                    const tickets = await expo.sendPushNotificationsAsync(chunk);
                    await this.deactivateStaleTokens(tickets, tokens);
                    console.log(`[NotificationService] Consumer push sent: ${tickets.length} ticket(s) for "${title}"`);
                } catch (pushError) {
                    console.error('[NotificationService] Consumer Expo push dispatch failed:', pushError);
                }
            }
        } catch (error) {
            console.error('[NotificationService] Fatal error in sendConsumerNotification:', error);
        }
    }

    /**
     * Validates that a string is a valid UUID v4 format.
     */
    private isValidUUID(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    /**
     * Resolves the Supabase Auth user ID of the merchant who should receive notifications
     * for a given store. Uses a fallback chain:
     *   1. store.managerId (the Store Manager — a User record)
     *   2. merchant_branches.merchant_id → merchants.id (the store owner)
     */
    private async resolveRecipientUserId(storeId: string): Promise<string | null> {
        try {
            // Primary: Check if the store has a direct manager
            const store = await this.prisma.store.findUnique({
                where: { id: storeId },
                select: { managerId: true, merchantId: true }
            });

            if (store?.managerId && this.isValidUUID(store.managerId)) {
                return store.managerId;
            }

            // Fallback 1: Check the merchantId on the Store itself
            // In PAS, the merchant.id IS the Supabase auth user ID for the store owner
            if (store?.merchantId && this.isValidUUID(store.merchantId)) {
                return store.merchantId;
            } else if (store?.merchantId) {
                console.warn(`[NotificationService] store.merchantId "${store.merchantId}" is not a valid UUID — skipping`);
            }

            // Fallback 2: Check merchant_branches to find the parent merchant
            const branch = await (this.prisma as any).merchantBranch.findFirst({
                where: { id: storeId },
                select: { merchantId: true }
            });

            if (branch?.merchantId && this.isValidUUID(branch.merchantId)) {
                return branch.merchantId;
            } else if (branch?.merchantId) {
                console.warn(`[NotificationService] branch.merchantId "${branch.merchantId}" is not a valid UUID — skipping`);
            }

            return null;
        } catch (error) {
            console.error('[NotificationService] Failed to resolve recipient:', error);
            return null;
        }
    }

    /**
     * Deactivates push tokens that Expo reports as no longer registered
     * (e.g., the user uninstalled the app or the token expired).
     */
    private async deactivateStaleTokens(tickets: ExpoPushTicket[], tokens: any[]): Promise<void> {
        for (let i = 0; i < tickets.length; i++) {
            const ticket = tickets[i];
            if (
                ticket.status === 'error' &&
                (ticket as any).details?.error === 'DeviceNotRegistered' &&
                tokens[i]
            ) {
                try {
                    await (this.prisma as any).merchantPushToken.update({
                        where: { id: tokens[i].id },
                        data: { isActive: false }
                    });
                    console.log(`[NotificationService] Deactivated stale token: ${tokens[i].expoPushToken}`);
                } catch (e) {
                    console.error('[NotificationService] Failed to deactivate token:', e);
                }
            }
        }
    }
}
export { NotificationService };
