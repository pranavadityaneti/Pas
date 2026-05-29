/**
 * Scheduled background jobs (node-cron) running inside the existing Express API.
 *
 * Currently runs every minute and performs four operations:
 *   1. Pickup reminder 30 min before slot
 *   2. Pickup reminder 10 min before slot
 *   3. Dine-in reminder 30 min before slot
 *   4. Expire stale order_requests (past expires_at) — closes forlater #17
 *
 * Dedupe strategy:
 *   For each reminder, we check the `notifications` table for an existing row
 *   with the same `referenceId` (order id) AND `type` (reminder type) before
 *   firing. The `notifications` row itself acts as our "already-sent" marker.
 *
 * Multi-instance note:
 *   If/when the API runs on >1 instance, the dedupe check has a small race
 *   window. For MVP single-instance EB, this is fine. To harden: add a
 *   composite unique constraint on (referenceId, type) where type is a
 *   reminder type, OR use a distributed lock.
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { NotificationService } from './notification.service';

const REMINDER_TYPES = {
    PICKUP_30: 'PICKUP_REMINDER_30MIN',
    PICKUP_10: 'PICKUP_REMINDER_10MIN',
    DINING_30: 'DINING_REMINDER_30MIN',
} as const;

const MIN_MS = 60 * 1000;

/**
 * Mount all scheduled jobs. Call once at server boot, AFTER notificationService
 * and prisma are initialized.
 */
export function initScheduledJobs(
    prisma: PrismaClient,
    notificationService: NotificationService
): void {
    // Single cron tick every minute runs all four jobs sequentially.
    // Low overhead; avoids running multiple concurrent jobs that might race on the same rows.
    cron.schedule('* * * * *', async () => {
        try {
            await firePickupReminders30Min(prisma, notificationService);
        } catch (e) {
            console.error('[cron] firePickupReminders30Min error:', e);
        }
        try {
            await firePickupReminders10Min(prisma, notificationService);
        } catch (e) {
            console.error('[cron] firePickupReminders10Min error:', e);
        }
        try {
            await fireDiningReminders30Min(prisma, notificationService);
        } catch (e) {
            console.error('[cron] fireDiningReminders30Min error:', e);
        }
        try {
            await expireStaleOrderRequests(prisma);
        } catch (e) {
            console.error('[cron] expireStaleOrderRequests error:', e);
        }
        try {
            await healMissingUserRows(prisma);
        } catch (e) {
            console.error('[cron] healMissingUserRows error:', e);
        }
    });

    console.log('[cron] Scheduled jobs initialized — running every 1 minute');
}

// ---------- Reminder helpers ----------

/**
 * Fire a customer reminder N minutes before their pickup/dining slot.
 * Uses a 2-minute window [now+(offsetMin-1), now+(offsetMin+1)] to absorb
 * minor cron skew. Dedup ensures no duplicate sends.
 */
async function fireReminder(
    prisma: PrismaClient,
    notificationService: NotificationService,
    orderType: 'pickup' | 'dine-in',
    offsetMin: number,
    reminderType: string,
    title: string,
    bodyTemplate: (orderNumber: string) => string
): Promise<void> {
    const now = Date.now();
    const windowStart = new Date(now + (offsetMin - 1) * MIN_MS);
    const windowEnd = new Date(now + (offsetMin + 1) * MIN_MS);

    const candidates = await (prisma as any).order.findMany({
        where: {
            // Include both CONFIRMED and PREPARING — merchants often move to
            // PREPARING well before the slot, so a strict CONFIRMED filter would
            // silently suppress the reminder. Exclude READY because event #3
            // (ORDER_READY) already fires immediately when status flips to READY —
            // double-notifying would be annoying.
            status: { in: ['CONFIRMED', 'PREPARING'] },
            order_type: orderType,
            slot_time_at: { gte: windowStart, lte: windowEnd },
        },
        select: {
            id: true,
            userId: true,
            orderNumber: true,
            storeId: true,
        },
    });

    for (const order of candidates) {
        if (!order.userId) continue;

        // Dedupe: skip if we already sent this reminder for this order
        const existing = await (prisma as any).notification.findFirst({
            where: { referenceId: order.id, type: reminderType },
            select: { id: true },
        });
        if (existing) continue;

        try {
            await notificationService.sendConsumerNotification({
                userId: order.userId,
                title,
                body: bodyTemplate(order.orderNumber),
                type: reminderType,
                referenceId: order.id,
                link: `/orders/${order.id}`,
                storeId: order.storeId,
                metadata: { orderNumber: order.orderNumber },
            });
            console.log(`[cron] Sent ${reminderType} for order ${order.orderNumber}`);
        } catch (e) {
            console.error(`[cron] Failed to send ${reminderType} for order ${order.id}:`, e);
        }
    }
}

async function firePickupReminders30Min(
    prisma: PrismaClient,
    notificationService: NotificationService
): Promise<void> {
    await fireReminder(
        prisma,
        notificationService,
        'pickup',
        30,
        REMINDER_TYPES.PICKUP_30,
        'Pickup slot in 30 min ⏰',
        (orderNumber) => `Your order #${orderNumber} pickup slot is in 30 minutes.`
    );
}

async function firePickupReminders10Min(
    prisma: PrismaClient,
    notificationService: NotificationService
): Promise<void> {
    await fireReminder(
        prisma,
        notificationService,
        'pickup',
        10,
        REMINDER_TYPES.PICKUP_10,
        'Your order is waiting 👋',
        (orderNumber) => `Just 10 minutes until your pickup slot for order #${orderNumber}.`
    );
}

async function fireDiningReminders30Min(
    prisma: PrismaClient,
    notificationService: NotificationService
): Promise<void> {
    await fireReminder(
        prisma,
        notificationService,
        'dine-in',
        30,
        REMINDER_TYPES.DINING_30,
        'Dining slot in 30 min 🍴',
        (orderNumber) => `Your dining slot for order #${orderNumber} is in 30 minutes. See you soon!`
    );
}

// ---------- Order request expiry (forlater #17) ----------

/**
 * Flips PENDING/ACCEPTED order_requests past their expires_at to EXPIRED.
 *
 * This is what the customer-app client-side 2-minute timer SHOULD have done,
 * but if the client crashes, closes, or loses connectivity at the moment of
 * failure, the timer never fires and the row stays ACCEPTED forever in the DB.
 * Closes forlater #17.
 */
async function expireStaleOrderRequests(prisma: PrismaClient): Promise<void> {
    const result = await prisma.order_requests.updateMany({
        where: {
            status: { in: ['PENDING', 'ACCEPTED'] },
            expires_at: { lt: new Date() },
        },
        data: {
            status: 'EXPIRED',
            updated_at: new Date(),
        },
    });
    if (result.count > 0) {
        console.log(`[cron] Expired ${result.count} stale order_requests`);
    }
}

// ---------- Layer 3: self-heal missing consumer User rows ----------

/**
 * Defense-in-depth backstop for the order-create FK (fk_orders_user → "User").
 *
 * Every signed-up customer has a `profiles` row (created by the handle_new_user
 * trigger). `orders.user_id` FKs to "User". If any path ever leaves a customer
 * without a "User" row (trigger bug/edge, manual auth insert, future change),
 * their checkout would fail. This repairs that drift within a minute by creating
 * the missing "User" rows from profiles + auth.users, and ALERTS if it ever finds
 * any (so we learn that an upstream layer slipped before a customer does).
 *
 * Raw SQL because `profiles` and `auth.users` are Supabase tables not in the
 * Prisma schema. ON CONFLICT (id) keeps it idempotent.
 */
async function healMissingUserRows(prisma: PrismaClient): Promise<void> {
    const healed = await prisma.$executeRawUnsafe(`
        INSERT INTO "User" (id, email, "passwordHash", role, name, phone, "isAdmin", "createdAt", "updatedAt")
        SELECT p.id,
               COALESCE(au.email, p.id::text || '@auto.pickatstore.app'),
               'sso_auth_active', 'CONSUMER'::"Role", p.full_name, au.phone, false,
               COALESCE(au.created_at, now()), now()
        FROM profiles p
        JOIN auth.users au ON au.id = p.id
        LEFT JOIN "User" u ON u.id = p.id
        WHERE u.id IS NULL
        ON CONFLICT (id) DO NOTHING
    `);
    if (healed && Number(healed) > 0) {
        // ALERT: drift was detected and auto-healed. Investigate why the signup
        // path missed these — this should normally be 0 forever.
        console.error(`[cron][ALERT] Self-heal created ${healed} missing consumer "User" row(s). The signup trigger missed them — investigate.`);
    }
}
