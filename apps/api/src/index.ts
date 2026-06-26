import dotenv from 'dotenv';
dotenv.config();

// Sentry MUST be initialised before any other module that we want instrumented
// (express, http, prisma, etc.). The dotenv.config() above must run first so
// instrument.ts can read SENTRY_DSN from the environment.
import './instrument';
import * as Sentry from '@sentry/node';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import { createServer } from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import * as xlsx from 'xlsx';
import fs from 'fs';
// Note: `crypto` is already brought in via `require` at line ~469 (legacy pattern
// shared with Razorpay). Phase 2 (2E-4) helpers below use that same `crypto`.
import { createClient } from '@supabase/supabase-js';
// Phase 4 sub-2 (2026-06-17): merchant catalog picker units.
import { encodeCursor, decodeCursor } from './merchantCatalog/cursor';
import { validateMrpCeiling, validateFssaiGate, validateCategoriesEnabled } from './merchantCatalog/validate';
import { makeRehoster } from './services/imageRehost';
import { z } from 'zod';
import { smsService } from './services/sms.service';
import { watiService } from './services/wati.service';
import { apifyService } from './services/apify.service';
import { sendApplicationReceivedEmail, sendStoreApprovedEmail, sendStoreRejectedEmail, sendStoreNeedsInfoEmail, sendAdminInviteEmail } from './services/email.service';
import { NotificationService } from './services/notification.service';
import { initScheduledJobs, verifyPendingPayments } from './services/scheduled-jobs';
import { closeSettlementCycles, detectClawback, getLastCompletedIstWeek } from './services/settlement.service';
import { parseArrivalTime } from './utils/parseArrivalTime';
import staffRouter from './routes/staff';
import bookingsRouter from './routes/bookings';
// WS2.B rules engine — typed namespace import (replaces lazy require so TS
// catches wrong-shape inputs like the 'dine-in' vs 'dining' enum mismatch).
import * as orderLifecycleRules from './orderLifecycle/rules';
// Round-6 Sentry observability — centralized error handler + middleware.
// Before this shipped, ~91% of catch blocks here logged to console and
// returned 500 without notifying Sentry. The errors-outages view showed
// 2 events in 30 days for what should have been a noisy production API.
import {
    handleApiError,
    requestIdMiddleware,
    sentryUserContextMiddleware,
    fivexxInterceptorMiddleware,
    markResponseAsReported,
} from './lib/api-error-handler';

// --- Configuration ---
const app = express();
const port = process.env.PORT || 3000;

// --- Request ID middleware MUST run first (round-7 fix) ---
// Assigns the UUID before anything else logs or runs so the X-Request-Id
// in the response header matches the [API Request] log line and any Sentry
// event captured later in the request lifecycle. The other Sentry
// middleware (sentryUserContext, fivexxInterceptor) are mounted lower down
// after express.json so they can read the body, but requestId has no body
// dependency and benefits from being absolute first.
app.use(requestIdMiddleware);

// --- Request Logger ---
app.use((req, res, next) => {
    const reqId = (req as any).id ?? '?';
    console.log(`[API Request] req=${reqId} ${req.method} ${req.url}`);
    next();
});

app.disable('x-powered-by');
const prisma = new PrismaClient();
const notificationService = new NotificationService(prisma);

// Mount scheduled background jobs (node-cron) — runs every 1 minute.
// Jobs: pickup/dining reminders + order_requests expiry. See scheduled-jobs.ts.
initScheduledJobs(prisma, notificationService);

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Supabase Admin Client (for server-side user creation via service_role key)
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// --- Middleware ---
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));

// --- Sentry observability (round-6) ---
// Order matters:
//   1. requestId — mounted ABOVE the request logger (round-7 audit fix), so
//      the very first log line of every request includes the UUID. See
//      app.use(requestIdMiddleware) ~line 56.
//   2. sentryUserContext — decodes JWT for Sentry user scope. Runs before
//      routes so every captured event knows who hit it.
//   3. fivexxInterceptor — defense-in-depth fallback that captures any 5xx
//      response we missed via handleApiError. Runs LAST so it wraps res.json
//      after other middleware has had a chance to modify it.
app.use(sentryUserContextMiddleware);
app.use(fivexxInterceptorMiddleware);

// --- Staff RBAC Routes ---
app.use('/api/staff', staffRouter);

// --- Table Booking Routes ---
app.use('/bookings', bookingsRouter);

// --- Helper Functions ---
async function getAuthUser(req: express.Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid token');
    }
    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
        throw new Error('Unauthorized');
    }
    return user;
}

// Guard: admin-only route. Writes 401/403 directly and returns null on failure;
// caller does `const u = await requireAdmin(req, res); if (!u) return;`.
// Matches the inline pattern at /admin/allowlist (~3747). Used by coupon admin routes.
async function requireAdmin(req: express.Request, res: express.Response) {
    let caller;
    try {
        caller = await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    const callerProfile = await prisma.user.findUnique({
        where: { id: caller.id },
        select: { isAdmin: true, role: true },
    });
    // Per the 2026-06-02 RBAC doc, requireAdmin = SUPER_ADMIN only (governance tier).
    // The legacy isAdmin flag is treated as SUPER_ADMIN equivalent for backwards
    // compatibility. OPERATIONS / FINANCE / SUPPORT do NOT pass requireAdmin — use
    // requireRole(['SUPER_ADMIN', 'OPERATIONS', …]) for per-route role checks.
    const ok =
        !!callerProfile &&
        (callerProfile.isAdmin === true || callerProfile.role === 'SUPER_ADMIN');
    if (!ok) {
        res.status(403).json({ error: 'Super-admin access required' });
        return null;
    }
    return caller;
}

/**
 * Generic RBAC guard. Pass an allowed-roles list; SUPER_ADMIN is always allowed.
 *
 *   const u = await requireRole(req, res, ['OPERATIONS', 'FINANCE']); if (!u) return;
 *
 * Per the 2026-06-02 RBAC doc:
 *   SUPER_ADMIN   founder/eng — unrestricted; always passes
 *   OPERATIONS    daily marketplace ops
 *   FINANCE       settlements + payouts + reconciliation
 *   SUPPORT       customer support (mostly view-only)
 *
 * The legacy `isAdmin: true` flag is treated as SUPER_ADMIN equivalent for
 * backwards compatibility with users who pre-date the Role enum.
 */
async function requireRole(
    req: express.Request,
    res: express.Response,
    allowedRoles: ReadonlyArray<'SUPER_ADMIN' | 'OPERATIONS' | 'FINANCE' | 'SUPPORT'>,
) {
    let caller;
    try {
        caller = await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    const callerProfile = await prisma.user.findUnique({
        where: { id: caller.id },
        select: { isAdmin: true, role: true },
    });
    if (!callerProfile) {
        res.status(403).json({ error: 'Access denied' });
        return null;
    }
    // SUPER_ADMIN always allowed; isAdmin flag treated as SUPER_ADMIN.
    if (callerProfile.role === 'SUPER_ADMIN' || callerProfile.isAdmin === true) {
        return caller;
    }
    if (callerProfile.role && allowedRoles.includes(callerProfile.role as any)) {
        return caller;
    }
    res.status(403).json({ error: 'Insufficient role for this action' });
    return null;
}

// Guard: any logged-in user. Writes 401 directly and returns null on failure;
// caller does `const u = await requireUser(req, res); if (!u) return;`.
// Used by consumer-side coupon routes (/coupons/available, validate-coupon, redeem)
// so we derive userId from the verified token instead of trusting the request body.
async function requireUser(req: express.Request, res: express.Response) {
    try {
        return await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
}

/**
 * Phase 2J (hot-fix 2026-06-09) — Soft auth for endpoints that Option A patches
 * #1A/#1B/#1C hard-cut behind requireUser (POST /orders, PATCH /order-requests/:id/status).
 *
 * Background: the deployed API requires auth on those endpoints, but main's
 * consumer-app still uses plain fetch() without an Authorization header.
 * Pre-OTA installs return 401 on every checkout / cancel — this helper restores
 * legacy behavior for those clients while preserving Option A #1B's impersonation
 * guard for authenticated callers.
 *
 * Behavior:
 *  - REQUIRE_ORDERS_AUTH=true → hard-require auth (matches requireUser exactly).
 *  - Else, Authorization header PRESENT but invalid → 401 (don't let attackers
 *    send garbage to bypass the eventual hard-require).
 *  - Else, Authorization header MISSING → soft-pass. Returns { user: null }.
 *    Sentry captures a count for OTA-rollout visibility.
 *  - Else, Authorization header VALID → returns { user: <User> }. Caller MUST
 *    enforce its own userId/ownership guards conditionally on user being non-null.
 *
 * Return convention:
 *  - null          → response already sent (401); caller does `if (!auth) return;`
 *  - { user: ... } → proceed; check `auth.user` for null vs authenticated
 *
 * Flip REQUIRE_ORDERS_AUTH=true once Sentry shows zero soft-auth pre-OTA
 * messages for 24+ hours.
 */
async function softRequireUser(req: express.Request, res: express.Response): Promise<{ user: any } | null> {
    const authHeader = req.headers.authorization;
    if (process.env.REQUIRE_ORDERS_AUTH === 'true') {
        try {
            const user = await getAuthUser(req);
            return { user };
        } catch {
            res.status(401).json({ error: 'Authentication required' });
            return null;
        }
    }
    // Soft mode — flag is off (default during pre-OTA window).
    if (authHeader) {
        // Header present → must be valid; else 401. This keeps post-OTA clients
        // strict and prevents garbage-header bypass attempts.
        try {
            const user = await getAuthUser(req);
            return { user };
        } catch {
            res.status(401).json({ error: 'Invalid authentication token' });
            return null;
        }
    }
    // No header at all → legacy pre-OTA client. Log for OTA-rollout monitoring.
    try {
        Sentry.captureMessage('soft-auth: pre-OTA unauth request', {
            level: 'info',
            tags: {
                phase: 'pre-ota-soft-auth',
                endpoint: req.path,
                method: req.method,
            },
        });
    } catch {
        // Swallow — Sentry shouldn't take down /orders.
    }
    return { user: null };
}

// Phase 2 (Coupon foolproof) — minimal server-side capability map for coupon
// endpoints. Mirrors apps/admin-web/src/lib/rbac.ts. SUPER_ADMIN is handled by
// the wildcard check inside requireCapability (matches isAdmin/role==='SUPER_ADMIN'
// the same way requireAdmin / requireRole do), so it's not listed here. Add more
// roles as they gain coupon capabilities. Future: move to a shared package
// (apps/api/src/lib/rbac.ts already mirrors this map but is not yet wired into
// index.ts — left untouched to keep this sub-task strictly additive).
const ROLE_CAPABILITIES: Record<string, string[]> = {
    FINANCE: ['coupons.view_analytics'],
};

/**
 * Capability-based RBAC guard. Resolves the user's role → capability list and
 * verifies the user has the requested capability. Returns the User on success,
 * sends 403 and returns null on failure.
 *
 * Phase 2 (Coupon foolproof) — added to replace requireAdmin on coupon endpoints
 * in a follow-up sub-task so server-side RBAC matches what
 * apps/admin-web/src/lib/rbac.ts already declares. Not yet wired to any
 * endpoint — sub-task 2A only adds the helper + capability declarations.
 *
 * Pattern matches requireUser / requireAdmin / requireRole — caller does:
 *   const u = await requireCapability(req, res, 'coupons.create_edit_delete');
 *   if (!u) return;
 */
async function requireCapability(
    req: express.Request,
    res: express.Response,
    capability: string,
) {
    let caller;
    try {
        caller = await getAuthUser(req);
    } catch {
        res.status(401).json({ error: 'Authentication required' });
        return null;
    }
    const callerProfile = await prisma.user.findUnique({
        where: { id: caller.id },
        select: { isAdmin: true, role: true },
    });
    if (!callerProfile) {
        res.status(403).json({ error: 'Access denied' });
        return null;
    }
    // SUPER_ADMIN wildcard — keeps current behaviour intact. The legacy isAdmin
    // flag is treated as SUPER_ADMIN equivalent (mirrors requireAdmin /
    // requireRole semantics for users created pre-Role-enum).
    if (callerProfile.role === 'SUPER_ADMIN' || callerProfile.isAdmin === true) {
        return caller;
    }
    const role = callerProfile.role || '';
    const capabilities = ROLE_CAPABILITIES[role] || [];
    if (capabilities.includes(capability)) {
        return caller;
    }
    res.status(403).json({ error: 'Forbidden: missing capability ' + capability });
    return null;
}

/**
 * Append-only audit log writer. Records who did what (action), to what
 * (targetType + targetId), with the JSON before/after diff.
 *
 * Phase 2 (Coupon foolproof) — called from coupon mutation endpoints
 * (POST/PATCH/DELETE /coupon). Future: any sensitive mutation can call this.
 *
 * Failure handling: NEVER throws or fails the parent mutation. If the audit
 * write itself fails, captures to Sentry and continues. Audit gaps are loud
 * (in Sentry) but never block business logic.
 */
async function writeAuditLog(
    actorUserId: string,
    action: string,
    targetType: string | null,
    targetId: string | null,
    beforeJson: any,
    afterJson: any,
): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                actorUserId,
                action,
                targetType: targetType || null,
                targetId: targetId || null,
                beforeJson: (beforeJson ?? null) as any,
                afterJson: (afterJson ?? null) as any,
            },
        });
    } catch (err: any) {
        console.error('[writeAuditLog] failed:', err?.message || err);
        try {
            Sentry.captureException(err, {
                extra: { actorUserId, action, targetType, targetId, area: 'audit-log.write' },
            });
        } catch {
            // Sentry SDK failure — already in degraded state, don't double-fail.
        }
    }
}

/**
 * Phase 2 (2E-4) — Coupon validation token helpers.
 *
 * Issues a signed HMAC-SHA256 token from POST /checkout/validate-coupon. The token
 * binds a specific coupon+user+cart to a specific discount, with a 10-min TTL.
 * POST /orders (Phase 2F) verifies the token before applying any discount —
 * closes the cart-spoof attack the audit flagged.
 *
 * NOT a true JWT (avoids new dep) but functionally equivalent: base64url(payload)
 * + '.' + base64url(HMAC-SHA256). Constant-time signature comparison on verify.
 *
 * Env var: COUPON_VALIDATION_SECRET (set on EB via `eb setenv ... ; eb deploy`
 * chained per ERRORS.md before Phase 4 OTA flip-over). If unset locally, sign
 * returns null (logs a warning); verify throws (caught by the endpoint).
 */
function computeCartHash(cartItems: any[]): string {
    const normalized = (Array.isArray(cartItems) ? cartItems : []).map((item) => ({
        id: String(item?.storeProductId || item?.id || item?.name || ''),
        p: Number(item?.price) || 0,
        q: Number(item?.quantity) || 0,
    })).sort((a, b) => a.id.localeCompare(b.id));
    return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function signCouponToken(payload: Record<string, any>): string | null {
    const secret = process.env.COUPON_VALIDATION_SECRET;
    if (!secret) {
        console.warn('[coupon-token] COUPON_VALIDATION_SECRET not set — token omitted (set on EB before Phase 4 OTA flip-over)');
        return null;
    }
    const json = JSON.stringify(payload);
    const data = Buffer.from(json, 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function verifyCouponToken(token: string): Record<string, any> {
    const secret = process.env.COUPON_VALIDATION_SECRET;
    if (!secret) {
        throw new Error('COUPON_VALIDATION_SECRET not configured');
    }
    const parts = token.split('.');
    if (parts.length !== 2) {
        throw new Error('Malformed coupon token');
    }
    const [data, sig] = parts;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new Error('Invalid coupon token signature');
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
        throw new Error('Coupon token expired');
    }
    return payload;
}

/**
 * Phase 2 (2I) — Tiny per-process in-memory rate limiter for abuse defense on
 * coupon endpoints. Per-key 60-second sliding window. Per-process means each
 * EB instance tracks separately — sufficient as a defensive backstop; the real
 * limiter (CloudFlare / API gateway) lives upstream. Returns true if the
 * request is allowed, false if it exceeds the cap.
 */
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();
function checkRateLimit(key: string, maxPerMinute: number): boolean {
    const now = Date.now();
    const bucket = rateLimitBuckets.get(key);
    if (!bucket || bucket.resetAt < now) {
        rateLimitBuckets.set(key, { count: 1, resetAt: now + 60_000 });
        return true;
    }
    if (bucket.count >= maxPerMinute) return false;
    bucket.count++;
    return true;
}

async function logAudit(productId: string, action: string, field: string | null, oldValue: any, newValue: any, changedBy: string = 'System') {
    try {
        await prisma.productAuditLog.create({
            data: {
                productId,
                action,
                field,
                oldValue: oldValue ? String(oldValue) : null,
                newValue: newValue ? String(newValue) : null,
                changedBy
            }
        });
    } catch (error) {
        console.error('Failed to create audit log', error);
    }
}

// (Phase 1, 2026-06-15) MOCK_PRODUCTS in-memory fallback REMOVED. It served 3
// fabricated products as a "successful" HTTP 200 response whenever a DB/query
// error occurred — masking real bugs (e.g. the category/vertical FK mismatch) as
// silently-wrong data in production. Catalog/product endpoints now surface honest
// errors via handleApiError instead.

// --- Routes ---

const crypto = require('crypto');
const Razorpay = require('razorpay');
let razorpayInstance: any = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

app.post('/payments/create-order', async (req, res) => {
    try {
        if (!razorpayInstance) return res.status(500).json({ error: 'Razorpay not configured' });

        const { amount, type = 'consumer', userId = 'unknown', notes = {} } = req.body;
        if (!amount || isNaN(amount)) return res.status(400).json({ error: 'Valid amount is required' });

        // 2026-06-04 (Phase 2.E3): For merchant signup payments, require auth
        // and stuff the authenticated user.id into Razorpay notes. The webhook
        // handler (/webhooks/razorpay) uses notes.merchantId to reconcile
        // payments that landed but didn't get a Subscription row recorded
        // (e.g., app crash between Razorpay success and PATCH finalize).
        const enrichedNotes: Record<string, any> = { ...notes };
        if (type === 'merchant') {
            const user = await requireUser(req, res);
            if (!user) return;     // requireUser already sent 401
            enrichedNotes.merchantId = user.id;
            enrichedNotes.paymentType = 'merchant_signup';
        } else {
            // Phase 7B (2026-06-10): tag consumer order-flow payments so the
            // orphaned-payments sweep can attribute them with certainty (it
            // auto-refunds ONLY attributable consumer payments; everything
            // else is Sentry-flagged for manual review).
            enrichedNotes.paymentType = 'consumer_order';
            if (userId && userId !== 'unknown') enrichedNotes.consumerUserId = String(userId);
        }

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomStr = Math.floor(100 + Math.random() * 900);
        const prefix = type === 'merchant' ? 'SUB' : 'PAS';
        const receipt = `${prefix}-${dateStr}-${String(userId).slice(0, 4).toUpperCase()}-${randomStr}`;

        const options = {
            amount: Math.round(Number(amount) * 100), // convert to paise
            currency: 'INR',
            receipt,
            notes: enrichedNotes,
        };

        const order = await razorpayInstance.orders.create(options);
        res.json({ order_id: order.id, receipt, amount: options.amount, currency: options.currency, details: order });
        } catch (error: any) {
        // Round-7 fix: surface Razorpay/DB cause (was generic since the auto-refactor).
        return handleApiError(res, error, { area: 'payments.create-order', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: error?.message || 'Order creation failed' });
    }
});

/**
 * 2026-06-04 (Phase 2.E2) — POST /merchant-signup/validate-coupon
 *
 * Validates a merchant-signup partner coupon. Used by the StepSubscription
 * "Apply" button to replace the v0 client-only stub.
 *
 * Input  : { code: string, tier?: 'standard' | 'premium' }
 * Output : on valid → { valid: true, couponId, code, discountInr }
 *          on invalid → { valid: false, error: string }
 *
 * Does NOT increment used_count or insert a redemption row — those happen
 * atomically inside the PATCH /auth/merchant/draft finalize transaction,
 * paired with the Razorpay subscription record. This endpoint is read-only
 * by design so the same code can be tapped multiple times during the signup
 * flow without bumping counters.
 *
 * Auth: requires the merchant to be signed in via OTP. We surface a 401
 * (not 200 with valid:false) if not authenticated, because anonymous
 * coupon scraping wouldn't be useful and the client is always authed by
 * the time it reaches Step 5.
 */
// 2026-06-14 (e-Sign V1): persist a merchant's accepted + on-screen drawn-
// signature partner agreement (Step 4 of signup). Append-only audit record in
// merchant_consents. The merchants row already exists by Step 4 (created at the
// Step-3→4 draft sync), so the merchant_id FK is satisfied. Server stamps IP +
// an integrity hash. Replaces the stubbed Aadhaar eSign.
app.post('/merchant-signup/consent', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const {
            agreementType, agreementVersion,
            acceptedPrivacy, acceptedTerms, acceptedPartner,
            signatoryName, designation, signature,
            signedPdfPath, signedAtIso, device,
        } = req.body || {};

        if (!agreementType || !agreementVersion) {
            return res.status(400).json({ error: 'agreementType and agreementVersion are required' });
        }
        if (!acceptedPrivacy || !acceptedTerms || !acceptedPartner) {
            return res.status(400).json({ error: 'All three agreements must be accepted before signing' });
        }
        if (!signature || !Array.isArray(signature.paths) || signature.paths.length === 0) {
            return res.status(400).json({ error: 'A drawn signature is required' });
        }

        const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || null;
        const signedAt = signedAtIso ? new Date(signedAtIso) : new Date();

        // Integrity fingerprint binding merchant + agreement + signature + time.
        const docHash = crypto.createHash('sha256').update(JSON.stringify({
            merchantId: user.id,
            agreementType, agreementVersion,
            signatoryName: signatoryName || null,
            signedAt: signedAt.toISOString(),
            paths: signature.paths,
        })).digest('hex');

        const consent = await prisma.merchantConsent.create({
            data: {
                merchantId: user.id,
                agreementType: String(agreementType),
                agreementVersion: String(agreementVersion),
                acceptedPrivacy: !!acceptedPrivacy,
                acceptedTerms: !!acceptedTerms,
                acceptedPartner: !!acceptedPartner,
                signatoryName: signatoryName ? String(signatoryName) : null,
                designation: designation ? String(designation) : null,
                signature: signature,
                signedPdfPath: signedPdfPath ? String(signedPdfPath) : null,
                signedAt,
                ip,
                device: device ? String(device) : null,
                docHash,
            },
        });

        return res.json({ ok: true, consentId: consent.id });
    } catch (err: any) {
        console.error('[merchant-signup/consent] error:', err?.message || err);
        return res.status(500).json({ error: 'Failed to record consent' });
    }
});

app.post('/merchant-signup/validate-coupon', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { code, tier } = req.body || {};
        if (!code || typeof code !== 'string') {
            return res.json({ valid: false, error: 'Please enter a coupon code.' });
        }
        const normalized = code.trim().toUpperCase();
        if (!normalized) {
            return res.json({ valid: false, error: 'Please enter a coupon code.' });
        }

        // Case-insensitive lookup — matches the UPPER(code) unique index in the migration.
        const coupon = await prisma.merchantSignupCoupon.findFirst({
            where: { code: { equals: normalized, mode: 'insensitive' } },
        });
        if (!coupon) {
            return res.json({ valid: false, error: 'Invalid coupon code.' });
        }
        if (!coupon.isActive) {
            return res.json({ valid: false, error: 'This coupon is no longer active.' });
        }
        if (coupon.expiresAt && coupon.expiresAt < new Date()) {
            return res.json({ valid: false, error: 'This coupon has expired.' });
        }
        if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
            return res.json({ valid: false, error: 'This coupon has reached its usage limit.' });
        }
        if (
            coupon.appliesToTier &&
            tier &&
            String(tier).toLowerCase() !== coupon.appliesToTier.toLowerCase()
        ) {
            return res.json({
                valid: false,
                error: `This coupon only applies to ${coupon.appliesToTier} tier subscriptions.`,
            });
        }

        // Reject re-redemption by the same merchant (defense in depth — the
        // UNIQUE(merchant_id) constraint would catch this at the redemption
        // insert anyway, but we surface a friendlier error pre-payment).
        const existing = await prisma.merchantSignupCouponRedemption.findUnique({
            where: { merchantId: user.id },
        });
        if (existing) {
            return res.json({
                valid: false,
                error: 'You have already redeemed a coupon for this signup.',
            });
        }

        return res.json({
            valid: true,
            couponId: coupon.id,
            code: coupon.code,
            discountInr: coupon.discountInr,
        });
        } catch (err: any) {
        return handleApiError(res, err, { area: 'merchant-signup.validate-coupon', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Server error validating coupon.' });
    }
});

app.post('/payments/verify', (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ error: 'Missing required signature payload' });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === razorpay_signature) {
            res.json({ success: true, message: 'Payment verified successfully' });
        } else {
            res.status(400).json({ success: false, error: 'Invalid signature' });
        }
        } catch (error: any) {
        // Round-7 fix: surface signature/HMAC failure cause so the merchant sees what went wrong.
        return handleApiError(res, error, { area: 'payments.verify', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: error?.message || 'Verification failed' });
    }
});

/**
 * 2026-06-04 (Phase 2.E3) — POST /webhooks/razorpay
 *
 * Razorpay webhook endpoint. Listens for payment lifecycle events fired by
 * Razorpay's webhook system. The primary job is to reconcile the rare case
 * where a merchant pays but the merchant-app crashes between
 * Razorpay.open() success and PATCH /auth/merchant/draft (finalize). In
 * that scenario the merchant is charged but no Subscription row exists.
 * The webhook catches it and creates the missing row.
 *
 * Setup (Pranav, on launch):
 *  1. Set RAZORPAY_WEBHOOK_SECRET in EB env vars (apps/api → Configuration
 *     → Software). Generate via Razorpay Dashboard → Settings → Webhooks
 *     → New webhook → choose a strong secret.
 *  2. Register the webhook URL in Razorpay Dashboard:
 *       https://api.pickatstore.io/webhooks/razorpay
 *  3. Subscribe to events: payment.captured, payment.failed.
 *
 * Idempotency: lookups against subscriptions.transactionId guarantee the
 * same razorpay_payment_id can be processed multiple times without
 * creating duplicate rows (Razorpay retries failed webhook deliveries
 * up to 24 hours).
 *
 * Auth: signature header `x-razorpay-signature` is the HMAC-SHA256 of the
 * raw request body using RAZORPAY_WEBHOOK_SECRET. Requests with missing
 * or wrong signatures return 401. The express.json() middleware ABOVE
 * means we lose the raw body — we re-serialize it for the HMAC; this is
 * safe because JSON.stringify(JSON.parse(body)) is canonical for the
 * keys/values Razorpay sends.
 */
app.post('/webhooks/razorpay', async (req, res) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        console.error('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not configured');
        return res.status(503).json({ error: 'Webhook not configured' });
    }

    const signatureHeader = req.headers['x-razorpay-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (!signature) {
        console.warn('[razorpay-webhook] Missing signature header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    const payloadString = JSON.stringify(req.body);
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payloadString)
        .digest('hex');

    if (expectedSignature !== signature) {
        console.warn('[razorpay-webhook] Signature mismatch — possible forgery or wrong secret');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    const event = req.body?.event as string | undefined;
    const eventId = req.body?.id as string | undefined;
    const payment = req.body?.payload?.payment?.entity;

    console.log('[razorpay-webhook] event=', event, 'eventId=', eventId, 'paymentId=', payment?.id);

    try {
        if (event === 'payment.captured' && payment) {
            await handlePaymentCaptured(payment);
        } else if (event === 'payment.failed' && payment) {
            console.warn('[razorpay-webhook] payment.failed for paymentId=', payment.id,
                'orderId=', payment.order_id, 'reason=', payment.error_description);
            await handlePaymentFailed(payment);
        } else {
            console.log('[razorpay-webhook] event ignored (no handler):', event);
        }

        // Always 200 on successful processing so Razorpay doesn't retry.
        return res.json({ received: true });
        } catch (err: any) {
        return handleApiError(res, err, { area: 'webhooks.razorpay', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Webhook handler failed' });
    }
});

/**
 * Handler for Razorpay `payment.captured` events. Idempotent: a re-delivery
 * of the same event is a no-op because we look up by transactionId before
 * creating a Subscription.
 */
async function handlePaymentCaptured(payment: any) {
    const paymentId = payment.id as string;
    const orderId = payment.order_id as string;
    const amountPaise = payment.amount as number;
    const amountInr = amountPaise / 100;

    // Already recorded via the normal /auth/merchant/draft finalize path?
    const existing = await prisma.subscription.findFirst({
        where: { transactionId: paymentId },
    });
    if (existing) {
        console.log('[razorpay-webhook] Subscription already exists for paymentId=', paymentId,
            ' — idempotent no-op');
        return;
    }

    // Merchant signup payments stuff merchantId into order notes at
    // /payments/create-order time. Fetch the order to retrieve it.
    if (!razorpayInstance) {
        throw new Error('Razorpay SDK not configured — cannot fetch order notes');
    }
    const order = await razorpayInstance.orders.fetch(orderId);
    const notes = (order?.notes || {}) as Record<string, any>;
    const merchantId = notes.merchantId as string | undefined;
    const paymentType = notes.paymentType as string | undefined;

    if (!merchantId || paymentType !== 'merchant_signup') {
        // Likely a consumer payment or an order from before the Phase 2.E3
        // notes-enrichment landed. Log and skip — consumer flow has its own
        // settlement path.
        console.log('[razorpay-webhook] No merchant_signup notes on order',
            orderId, '— skipping reconciliation. notes=', JSON.stringify(notes));
        return;
    }

    // Confirm the merchant exists. If not, we can't safely insert.
    const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
    if (!merchant) {
        console.error('[razorpay-webhook] payment.captured but merchant',
            merchantId, 'does not exist in DB. Payment', paymentId,
            'requires manual reconciliation.');
        return;
    }

    // Create the missing subscription. transactionId is the Razorpay
    // payment_id, matching what the normal finalize path stores.
    await prisma.subscription.create({
        data: {
            merchantId,
            amount: amountInr,
            currency: payment.currency || 'INR',
            status: 'success',
            provider: 'razorpay',
            transactionId: paymentId,
        },
    });

    console.log('[razorpay-webhook] Reconciled missing Subscription for merchant=',
        merchantId, 'paymentId=', paymentId, 'amount=', amountInr);

    // Note: we do NOT reconcile coupon redemption here. If the merchant
    // applied a coupon but the finalize step never landed, the redemption
    // row will be missing. That's an admin-reconciliation case — too risky
    // to auto-increment used_count from a webhook without the merchant
    // confirming via the app.
}

/**
 * Handler for Razorpay `payment.failed` events. Notifies the consumer that their
 * payment didn't complete (they were NOT charged). Idempotent: a webhook
 * re-delivery is a no-op because we first check for an existing PAYMENT_FAILED
 * notification keyed by the payment id. Only consumer-order payments (tagged with
 * consumerUserId in the Razorpay order notes at create-order time) are notified;
 * merchant-signup / untagged failures are skipped.
 */
async function handlePaymentFailed(payment: any) {
    const paymentId = payment.id as string;
    const orderId = payment.order_id as string | undefined;
    if (!paymentId || !orderId || !razorpayInstance) return;

    // Resolve the consumer from the Razorpay order notes (stamped at create-order time).
    let consumerUserId: string | undefined;
    try {
        const order = await razorpayInstance.orders.fetch(orderId);
        const notes = (order?.notes || {}) as Record<string, any>;
        if (notes.paymentType === 'consumer_order' && notes.consumerUserId) {
            consumerUserId = String(notes.consumerUserId);
        }
    } catch (e: any) {
        console.warn('[razorpay-webhook] payment.failed: could not fetch order notes for', orderId, '-', e?.message || e);
        return;
    }
    if (!consumerUserId) return; // not an attributable consumer payment — nothing to notify

    // Idempotency: Razorpay retries webhooks — notify at most once per failed payment.
    const already = await prisma.notification.findFirst({
        where: { userId: consumerUserId, type: 'PAYMENT_FAILED', referenceId: paymentId },
        select: { id: true },
    });
    if (already) {
        console.log('[razorpay-webhook] payment.failed already notified for', paymentId, '— idempotent no-op');
        return;
    }

    const reason = (payment.error_description as string) || '';
    await notificationService.sendConsumerNotification({
        userId: consumerUserId,
        title: "Payment didn't go through",
        body: `Your payment couldn't be completed${reason ? ` (${reason})` : ''}. You haven't been charged — please try again.`,
        type: 'PAYMENT_FAILED',
        referenceId: paymentId,
        link: '/(main)/orders',
        metadata: { paymentId, orderId, reason: reason || null },
    });
}

/**
 * GET /payments/methods
 * List saved payment tokens for the authenticated user.
 * Mandate 2: Lazy Customer Creation (Return [] if no ID exists)
 */
app.get('/payments/methods', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { razorpayCustomerId: true }
        });

        if (!profile?.razorpayCustomerId) {
            return res.json([]);
        }

        if (!razorpayInstance) return res.status(500).json({ error: 'Razorpay not configured' });

        const tokens = await razorpayInstance.customers.fetchTokens(profile.razorpayCustomerId);
        res.json(tokens.items || []);
    } catch (error: any) {
        const status = (error.message === 'Unauthorized' || error.message === 'Missing or invalid token') ? 401 : 500;
        // Smarter Error Handling
        if (error.code === 'BAD_REQUEST_ERROR') return res.status(400).json({ error: error.description });
        res.status(status).json({ error: error.message });
    }
});

/**
 * DELETE /payments/methods/:tokenId
 * Mandate 1: Prevent IDOR (Strict ownership verification)
 */
app.delete('/payments/methods/:tokenId', async (req, res) => {
    try {
        const { tokenId } = req.params;
        const user = await getAuthUser(req);
        const profile = await prisma.profile.findUnique({
            where: { id: user.id },
            select: { razorpayCustomerId: true }
        });

        if (!profile?.razorpayCustomerId) {
            return res.status(403).json({ error: 'Forbidden: No associated payment account' });
        }

        if (!razorpayInstance) return res.status(500).json({ error: 'Razorpay not configured' });

        // Mandate 1: Fetch first to verify customer_id ownership
        let rzpToken;
        try {
            rzpToken = await razorpayInstance.tokens.fetch(tokenId);
        } catch (err: any) {
            if (err.code === 'BAD_REQUEST_ERROR') return res.status(404).json({ error: 'Payment method not found' });
            throw err;
        }

        if (rzpToken.customer_id !== profile.razorpayCustomerId) {
            console.error(`[SECURITY] IDOR attempt detected! User ${user.id} tried to delete token ${tokenId}`);
            return res.status(403).json({ error: 'Forbidden: You do not own this payment method' });
        }

        await razorpayInstance.tokens.delete(tokenId);
        res.json({ success: true, message: 'Payment method deleted' });
    } catch (error: any) {
        const status = (error.message === 'Unauthorized' || error.message === 'Missing or invalid token') ? 401 : 500;
        if (error.code === 'BAD_REQUEST_ERROR') return res.status(400).json({ error: error.description });
        res.status(status).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.send('PickAtStore API is running 🚀');
});

// Health Check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), service: 'pick-at-store-api' });
});

// Get Products
// Get Products (with Filtering & Pagination)
app.get('/products', async (req, res) => {
    try {
        // H-1 solid fix (2026-06-23): admin-only catalog browse. Previously unauthenticated
        // (display-audit CRIT 4): anyone could scrape the 140k catalog including internal
        // importer fields (source, sourceProductId, productUrl, extraData). Caller is the
        // admin MasterCatalog grid only.
        const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
        const {
            page = 1,
            limit = 50,
            search,
            category,
            vertical,
            brand,
            minPrice,
            maxPrice,
            gstRate,

            missingData,
            type = 'global' // 'global' | 'custom' | 'all'
        } = req.query;

        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        // Build Filter Conditions
        const where: any = {};

        // Filter by Type
        if (type === 'global') {
            where.createdByStoreId = null;
        } else if (type === 'custom') {
            where.createdByStoreId = { not: null };
        }

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { ean: { contains: String(search) } }
            ];
        }

        // 2026-06-15: filter by category/vertical NAME via the FK relation. Product has
        // no scalar category/vertical columns (only category_id/vertical_id), so the old
        // where.category/where.vertical threw on every filtered query.
        if (category) {
            where.Tier2Category = { name: { in: String(category).split(',') } };
        }

        if (vertical) {
            where.Vertical = { name: { in: String(vertical).split(',') } };
        }

        if (brand) {
            where.brand = { in: String(brand).split(',') };
        }

        if (gstRate) {
            where.gstRate = { in: String(gstRate).split(',').map(Number) };
        }

        if (minPrice || maxPrice) {
            where.mrp = {};
            if (minPrice) where.mrp.gte = Number(minPrice);
            if (maxPrice) where.mrp.lte = Number(maxPrice);
        }

        if (missingData) {
            const missing = String(missingData).split(',');
            if (missing.includes('image')) where.image = null;
            if (missing.includes('brand')) where.brand = null;
            if (missing.includes('hsn')) where.hsnCode = null;
        }

        // Execute Query with Pagination
        const [products, total] = await Promise.all([
            prisma.product.findMany({
                where,
                skip,
                take,
                orderBy: { createdAt: 'desc' },
                // H-1: PRODUCT_PUBLIC_SELECT strips internal-only fields (source, sourceProductId,
                // productUrl, extraData, createdByStoreId, countryCode) by construction.
                select: PRODUCT_PUBLIC_SELECT,
            }),
            prisma.product.count({ where })
        ]);

        // 2026-06-15: flatten the FK relations to the category/vertical NAME strings the
        // admin grid binds to (otherwise the Category/Vertical columns render blank for
        // every row, even correctly-categorised ones).
        const data = products.map((p: any) => ({
            ...p,
            category: p.Tier2Category?.name ?? null,
            vertical: p.Vertical?.name ?? null,
        }));

        res.json({
            data,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / take)
            }
        });
    } catch (error) {
        return handleApiError(res, error, { area: 'products.list', userMessage: 'Failed to load products' });
    }
});

// Excel Template Download
app.get('/products/template', async (req, res) => {
    try {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();

        // 1. Create Data Sheet
        const worksheet = workbook.addWorksheet('Template');
        worksheet.columns = [
            { header: 'name', key: 'name', width: 30 },
            { header: 'mrp', key: 'mrp', width: 15 },
            { header: 'vertical', key: 'vertical', width: 20 },
            { header: 'category', key: 'category', width: 20 },
            { header: 'brand', key: 'brand', width: 20 },
            { header: 'ean', key: 'ean', width: 20 },
            { header: 'unitType', key: 'unitType', width: 12 },
            { header: 'unitValue', key: 'unitValue', width: 12 },
            { header: 'hsnCode', key: 'hsnCode', width: 15 },
            { header: 'gstRate', key: 'gstRate', width: 10 },
            { header: 'image', key: 'image', width: 40 }
        ];

        // 2. Create Reference Sheet (Hidden)
        const refSheet = workbook.addWorksheet('RefData');
        refSheet.state = 'hidden';

        const verticals = ['Grocery & Kirana', 'Restaurants & Cafes', 'Bakeries & Desserts', 'Meat & Seafood', 'Pharmacy & Wellness', 'Electronics & Accessories', 'Fashion & Apparel', 'Home & Lifestyle', 'Beauty & Personal Care', 'Pet Care & Supplies'];
        const categories = ['Dairy & Milk', 'Staples & Pulse', 'Snacks & Munchies', 'Beverages', 'Personal Care', 'Home Essentials', 'Fruits & Vegetables', 'Ready-to-Eat'];
        const unitTypes = ['ml', 'L', 'kg', 'g', 'pc'];
        const gstRates = [0, 5, 12, 18, 28];

        // Populate RefData: Column A = Verticals, B = Categories, C = Unit Types, D = GST Rates
        verticals.forEach((v, i) => refSheet.getCell(`A${i + 1}`).value = v);
        categories.forEach((c, i) => refSheet.getCell(`B${i + 1}`).value = c);
        unitTypes.forEach((u, i) => refSheet.getCell(`C${i + 1}`).value = u);
        gstRates.forEach((g, i) => refSheet.getCell(`D${i + 1}`).value = g);

        // 3. Apply Data Validations (Rows 2-1000)
        for (let i = 2; i <= 1000; i++) {
            // Vertical (Column C)
            worksheet.getCell(`C${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$A$1:$A$${verticals.length}`]
            };
            // Category (Column D)
            worksheet.getCell(`D${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$B$1:$B$${categories.length}`]
            };
            // Unit Type (Column F)
            worksheet.getCell(`F${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$B$1:$B$${unitTypes.length}`]
            };
            // GST Rate (Column I)
            worksheet.getCell(`I${i}`).dataValidation = {
                type: 'list',
                allowBlank: true,
                formulae: [`'RefData'!$C$1:$C$${gstRates.length}`]
            };
        }

        // 4. Formatting header
        worksheet.getRow(1).font = { bold: true };

        // 5. Sample Row
        worksheet.addRow({
            name: 'Amul Gold Milk',
            mrp: 34,
            vertical: 'Grocery & Kirana',
            category: 'Dairy & Milk',
            brand: 'Amul',
            ean: '8901262010043',
            unitType: 'ml',
            unitValue: 500,
            hsnCode: '0401',
            gstRate: 5,
            image: ''
        });

        // Response
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');

        await workbook.xlsx.write(res);
        res.end();
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.template', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to generate template' });
    }
});

// Export Products
// Export Products
app.get('/products/export', async (req, res) => {
    try {
        // H-1 solid fix (2026-06-23): admin-only. Was unauthenticated → exposed the whole
        // 140k catalog as a downloadable Excel to anyone with the URL.
        const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
        const products = await prisma.product.findMany({ select: PRODUCT_PUBLIC_SELECT });
        const data = products.map(p => ({
            name: p.name,
            mrp: p.mrp,
            vertical: p.subcategory,
            category: p.subcategory,
            brand: p.brand,
            ean: p.ean,
            image: p.image,
            id: p.id
        }));

        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(data);
        xlsx.utils.book_append_sheet(wb, ws, 'Products');
        const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=products_export.xlsx');
        res.send(buffer);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.export', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to export products' });
    }
});

// Phase 1 (2026-06-15): catalog/product mutation + export endpoints were
// previously UNAUTHENTICATED — anyone could inject/promote/bulk-delete catalog
// rows (bulk-delete cascades into merchant inventory). Require an authenticated
// admin (any tier) on all of them.
const CATALOG_ADMIN_ROLES = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'] as const;
// H-1 solid fix (2026-06-23): explicit field whitelist for Product rows returned to ANY
// admin/merchant-facing surface. Strips internal-only fields (importer lineage + supplier
// URLs) so even if a future endpoint forgets a field map, callers cannot exfiltrate them.
// Use via `select: PRODUCT_PUBLIC_SELECT` on prisma.product / prisma.storeProduct.product.
const PRODUCT_PUBLIC_SELECT = {
    id: true, name: true, description: true, image: true, mrp: true, brand: true, ean: true,
    createdAt: true, updatedAt: true, unitType: true, unitValue: true, hsnCode: true,
    gstRate: true, subcategory: true, unitPrice: true, uom: true, avgRating: true,
    numberOfRatings: true, isSoldOut: true, catalogName: true, shippingCharges: true,
    returnable: true, isVeg: true, category_id: true, vertical_id: true,
    Vertical: { select: { id: true, name: true, is_active: true, requiresFssai: true } },
    Tier2Category: { select: { id: true, name: true, active: true } },
    images: true,
    // Deliberately omitted (H-1): source, sourceProductId, productUrl, extraData,
    // createdByStoreId, countryCode — internal lineage/supplier fields not for client surfaces.
} as const;
// Category-visibility feature · Task 5: disabling a category hides it + all its products
// platform-wide instantly — high impact, so the toggle is restricted to ops-level roles
// (SUPER_ADMIN is always implicitly allowed inside requireRole). Viewing stays open to
// all CATALOG_ADMIN_ROLES.
const CATEGORY_TOGGLE_ROLES = ['SUPER_ADMIN', 'OPERATIONS'] as const;

// Export Selected Products (Template Format)
app.post('/products/export-selected', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No product IDs provided' });
        }

        const products = await prisma.product.findMany({
            where: { id: { in: ids } }
        });

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Export');

        // Define Columns (Matching Template)
        worksheet.columns = [
            { header: 'name', key: 'name', width: 30 },
            { header: 'mrp', key: 'mrp', width: 15 },
            { header: 'vertical', key: 'vertical', width: 20 },
            { header: 'category', key: 'category', width: 20 },
            { header: 'brand', key: 'brand', width: 20 },
            { header: 'ean', key: 'ean', width: 20 },
            { header: 'unitType', key: 'unitType', width: 12 },
            { header: 'unitValue', key: 'unitValue', width: 12 },
            { header: 'hsnCode', key: 'hsnCode', width: 15 },
            { header: 'gstRate', key: 'gstRate', width: 10 },
            { header: 'image', key: 'image', width: 40 }
        ];

        // Add Data
        products.forEach(p => {
            worksheet.addRow({
                name: p.name,
                mrp: p.mrp,
                vertical: p.subcategory,
                category: p.subcategory,
                brand: p.brand,
                ean: p.ean,
                unitType: p.unitType,
                unitValue: p.unitValue,
                hsnCode: p.hsnCode,
                gstRate: p.gstRate,
                image: p.image
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=selected_products_export.xlsx');

        await workbook.xlsx.write(res);
        res.end();
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.export-selected', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to export selected products' });
    }
});

const upload = multer({ dest: 'uploads/' });

// Image Upload to Supabase Storage
app.post('/products/upload-image', upload.single('file'), async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const fileContent = fs.readFileSync(req.file.path);
        // Sanitize filename
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${safeName}`;

        const BUCKET_NAME = 'products';

        // DIRECT UPLOAD STRATEGY
        // We skip checking listBuckets() because RLS policies often hide buckets from the Anon Key.
        // We assume the bucket 'products' exists (as verified by user).

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileContent, {
                contentType: req.file.mimetype,
                upsert: false
            });

        // Clean up temp file immediately
        fs.unlinkSync(req.file.path);

        if (error) {
            console.error('Supabase upload error:', error);
            const err = error as any;
            // Help the user debug specific policy errors
            if (err.statusCode === '403' || err.error === 'Unauthorized') {
                return res.status(500).json({
                    error: `Upload failed (Access Denied). Please check your Supabase Storage Policies for the '${BUCKET_NAME}' bucket.`
                });
            }
            if (err.statusCode === '404' || err.error === 'Bucket not found') {
                return res.status(500).json({
                    error: `Bucket '${BUCKET_NAME}' not found. Please ensure it exists and is Public.`
                });
            }
            return res.status(500).json({ error: 'Supabase upload failed', details: error.message });
        }

        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(fileName);

        res.json({ url: publicUrl });
    } catch (error) {
        console.error('Upload failed:', error);
        // Ensure cleanup on error
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        Sentry.captureException(error, { tags: { area: 'products.upload-image' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to upload image' });
    }
});

// --- Catalog Sync (Live Sync) ---

// Memory lock to prevent race conditions where webhook and polling process the same dataset concurrently
const processedDatasets = new Set<string>();

async function processScraperDataset(datasetId: string) {
    if (processedDatasets.has(datasetId)) {
        console.log(`[Sync] Dataset ${datasetId} already processed. Skipping to prevent race conditions.`);
        return { status: 'SUCCEEDED', itemsCount: 0, itemsAdded: 0, message: 'Dataset already processed.' };
    }
    processedDatasets.add(datasetId);

    const items = await apifyService.getDatasetItems(datasetId);
    
    // Helper to remove \u0000 unicode characters from strings that crash Prisma/Postgres
    const sanitizeNullBytes = (str: string | null | undefined): string | null => {
        if (!str) return str as any;
        return str.replace(/\u0000/g, '');
    };

    const mapCategory = (rawCategory: string | null): { vertical: string, category: string } => {
        if (!rawCategory) return { vertical: 'Grocery & Kirana', category: 'General' };
        const lowerCat = rawCategory.toLowerCase();
        
        // 1. Fresh Items (Fruits & Vegetables)
        if (lowerCat.includes('fruit') || lowerCat.includes('veg') || lowerCat.includes('produce'))
            return { vertical: 'Fresh Items', category: 'Fresh Produce' };

        // 2. Pharmacy & Wellness (Includes Personal Care/Hygiene)
        if (lowerCat.includes('pharmacy') || lowerCat.includes('wellness') || lowerCat.includes('med') || 
            lowerCat.includes('personal care') || lowerCat.includes('hygiene') || lowerCat.includes('skin') ||
            lowerCat.includes('hair') || lowerCat.includes('dent') || lowerCat.includes('soap') || lowerCat.includes('shampoo'))
            return { vertical: 'Pharmacy & Wellness', category: 'Personal Care' };

        // 3. Home & Lifestyle (Includes Home Essentials/Cleaning)
        if (lowerCat.includes('home') || lowerCat.includes('lifestyle') || lowerCat.includes('cleaning') || 
            lowerCat.includes('detergent') || lowerCat.includes('household') || lowerCat.includes('kitchen') || 
            lowerCat.includes('essential'))
            return { vertical: 'Home & Lifestyle', category: 'Home Essentials' };

        // 4. Grocery & Kirana (Staples, Dairy, Snacks, Beverages)
        if (lowerCat.includes('dairy') || lowerCat.includes('milk') || lowerCat.includes('paneer') || lowerCat.includes('cheese') || lowerCat.includes('egg')) 
            return { vertical: 'Grocery & Kirana', category: 'Dairy & Milk' };
        if (lowerCat.includes('staple') || lowerCat.includes('rice') || lowerCat.includes('dal') || lowerCat.includes('flour') || lowerCat.includes('atta') || lowerCat.includes('masala')) 
            return { vertical: 'Grocery & Kirana', category: 'Staples & Pulse' };
        if (lowerCat.includes('biscuit') || lowerCat.includes('snack') || lowerCat.includes('chip') || lowerCat.includes('namkeen')) 
            return { vertical: 'Grocery & Kirana', category: 'Snacks & Munchies' };
        if (lowerCat.includes('beverage') || lowerCat.includes('drink') || lowerCat.includes('soda') || lowerCat.includes('juice')) 
            return { vertical: 'Grocery & Kirana', category: 'Beverages' };
            
        return { vertical: 'Grocery & Kirana', category: 'General' };
    };

    // Pre-fetch taxonomy lookup maps for resolving category strings → UUIDs
    const allVerticals = await (prisma as any).vertical.findMany({ select: { id: true, name: true } });
    const allTier2Categories = await (prisma as any).tier2Category.findMany({
        select: { id: true, name: true, verticalId: true }
    });
    const verticalMap = new Map<string, string>(allVerticals.map((v: any) => [v.name, v.id]));
    const categoryLookup = new Map<string, string>(
        allTier2Categories.map((c: any) => [`${c.verticalId}::${c.name}`, c.id])
    );

    const sanitizeScraperData = (obj: any): any => {
        if (typeof obj === 'string') return sanitizeNullBytes(obj);
        if (Array.isArray(obj)) return obj.map(sanitizeScraperData);
        if (obj !== null && typeof obj === 'object') {
            const cleanObj: any = {};
            for (const [k, v] of Object.entries(obj)) {
                cleanObj[k] = sanitizeScraperData(v);
            }
            return cleanObj;
        }
        return obj;
    };

    let itemsAdded = 0;
    for (const itemDataRaw of items) {
        try {
            const itemData = sanitizeScraperData(itemDataRaw);
            // Scraper payload has a nested `item` structure
            const entry = itemData?.item || itemData;
            const productData = entry?.product || entry;
            
            const name = sanitizeNullBytes(productData?.name) || 'Unknown';
            
            // Brand Normalization
            let rawBrand = sanitizeNullBytes(productData?.brand) || sanitizeNullBytes(productData?.brand_name) || null;
            const junkBrands = ['fruits', 'vegetables', 'fresh', 'cut', 'chilean kiwi', 'indian', 'imported', 'organic'];
            let brand = 'Unbranded';
            if (rawBrand && !junkBrands.includes(rawBrand.toLowerCase().trim())) {
                brand = rawBrand;
            }

            // Packsize Extraction
            const packsize = sanitizeNullBytes(entry?.productVariant?.formattedPacksize) || 
                             sanitizeNullBytes(productData?.formattedPacksize) || 
                             sanitizeNullBytes(itemData?.formatted_packsize) || 
                             sanitizeNullBytes(entry?.quantity ? `${entry.quantity} ${entry.unitOfMeasure || ''}` : null) || 
                             null;
            
            // MRP Logic
            let rawMrp = entry?.mrp || entry?.price?.mrp || 0;
            let rawSp = entry?.sellingPrice || entry?.discountedSellingPrice || entry?.price?.sp || 0;
            // 2026-06-15: removed the `> 1000 ? /100` paise heuristic (it stored ₹1899
            // as ₹18.99, corrupting the high-value tail). All current/purchased data is
            // rupee-denominated; the bulk-import-json path already parses plain rupees.
            // (This is the now-abandoned APIFY webhook path; existing zepto rows that
            // were divided need a one-time price audit — see forlater cleanup list.)
            const mrp = rawMrp;
            const sellingPrice = rawSp;

            const rawCategory = sanitizeNullBytes(entry?.primaryCategoryName) || sanitizeNullBytes(productData?.category);
            const { vertical, category } = mapCategory(rawCategory);
            // Resolve mapped category/vertical strings to taxonomy UUIDs
            const resolvedVerticalId = verticalMap.get(vertical) || null;
            const resolvedCategoryId = resolvedVerticalId
                ? (categoryLookup.get(`${resolvedVerticalId}::${category}`) || null)
                : null;
            const subcategory = sanitizeNullBytes(entry?.primarySubcategoryName) || sanitizeNullBytes(productData?.subcategory) || null;
            const sourceProductId = String(productData?.id || itemData?.sku_id || itemData?.id);
            
            if (!sourceProductId || sourceProductId === 'undefined') continue;

            // Extract image
            let image = null;
            if (entry?.productVariant?.images && entry.productVariant.images.length > 0) {
                const imgPath = entry.productVariant.images[0].path;
                image = imgPath ? `https://cdn.zeptonow.com/production/${imgPath}` : null;
            } else if (itemData?.images && itemData.images.length > 0) {
                const imgPath = itemData.images[0];
                if (imgPath && !imgPath.startsWith('http')) {
                    image = `https://cdn.zeptonow.com/production/${imgPath}`;
                } else {
                    image = imgPath;
                }
            }

            // Raw data insertion for Phase 2
            await (prisma as any).syncQueue.upsert({
                where: { sourceProductId: sourceProductId },
                update: {
                    status: 'PENDING',
                    name,
                    brand,
                    mrp: mrp > 0 ? mrp : sellingPrice,
                    subcategory,
                    packsize,
                    image,
                    metadata: itemData as any,
                    vertical_id: resolvedVerticalId,
                    category_id: resolvedCategoryId,
                },
                create: {
                    name,
                    brand,
                    mrp: mrp > 0 ? mrp : sellingPrice,
                    subcategory,
                    packsize,
                    image,
                    sourceProductId,
                    status: 'PENDING',
                    metadata: itemData as any,
                    vertical_id: resolvedVerticalId,
                    category_id: resolvedCategoryId,
                }
            });
            itemsAdded++;
        } catch (dbError) {
            console.error('Failed to queue item:', itemDataRaw?.item?.product?.name || itemDataRaw?.name, dbError);
        }
    }

    return { 
        status: 'SUCCEEDED', 
        itemsCount: items.length,
        itemsAdded,
        message: `Successfully processed ${itemsAdded} items into the sync queue.`
    };
}

// Trigger a new sync run
app.post('/catalog/sync/trigger', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { queries, location = 'Mumbai', limit = 20 } = req.body;
        
        if (!queries || !Array.isArray(queries) || queries.length === 0) {
            return res.status(400).json({ error: 'At least one search query is required' });
        }

        // Phase 8: Smart Category Sync
        // If a query matches a Smart Category key, we expand it into a massive array of specific keywords
        // to bypass the 20-keyword limit and 0-hit broad keyword limit.
        const SMART_CATEGORIES: Record<string, string[]> = {
            '[SMART] Medicines': [
                'Paracetamol', 'Dolo', 'Vicks', 'Band Aid', 'Digene', 'Eno', 'Volini', 
                'Saridon', 'Revital', 'ORSL', 'Electral', 'Pudin Hara', 'Hajmola', 'Zandu',
                'Moov', 'Iodex', 'Amrutanjan', 'Strepsils', 'Honitus', 'Benadryl', 'Crocin',
                'Combiflam', 'B-Complex', 'Vitamin C', 'Zincovit', 'Becosules', 'Cough Syrup',
                'Betadine', 'Savlon', 'Dettol', 'Thermometer', 'Pregnancy Test', 'Odomos'
            ],
            '[SMART] Fruits & Vegetables': [
                'Apple', 'Banana', 'Mango', 'Orange', 'Papaya', 'Watermelon', 'Grapes', 'Pomegranate',
                'Onion', 'Potato', 'Tomato', 'Garlic', 'Ginger', 'Chilli', 'Lemon', 'Carrot', 
                'Cucumber', 'Capsicum', 'Cabbage', 'Cauliflower', 'Brinjal', 'Bhindi', 'Okra',
                'Spinach', 'Palak', 'Coriander', 'Mint', 'Methi', 'Bottle Gourd', 'Bitter Gourd',
                'Coconut', 'Mushroom', 'Sweet Corn', 'Avocado', 'Kiwi', 'Strawberry', 'Broccoli'
            ],
            '[SMART] Spices & Masalas': [
                'Turmeric', 'Haldi', 'Red Chilli', 'Lal Mirch', 'Coriander Powder', 'Dhaniya', 
                'Jeera', 'Cumin', 'Garam Masala', 'Mustard Seeds', 'Rai', 'Black Pepper', 'Kali Mirch',
                'Cardamom', 'Elaichi', 'Cinnamon', 'Dalchini', 'Cloves', 'Laung', 'Hing', 'Asafoetida',
                'Fenugreek', 'Methi Seeds', 'Fennel', 'Saunf', 'Meat Masala', 'Chicken Masala',
                'Kitchen King', 'Chat Masala', 'Pav Bhaji Masala', 'Chhole Masala', 'Sambar Powder'
            ],
            '[SMART] Staples & Pulses': [
                'Atta', 'Wheat Flour', 'Maida', 'Besan', 'Sooji', 'Rawa', 'Sugar', 'Jaggery', 'Salt',
                'Toor Dal', 'Arhar Dal', 'Moong Dal', 'Urad Dal', 'Chana Dal', 'Masoor Dal', 
                'Rajma', 'Kabuli Chana', 'Soya Chunks', 'Poha', 'Murmura', 'Rice', 'Basmati Rice',
                'Sona Masoori', 'Idli Rice', 'Brown Rice', 'Peanuts', 'Mungfali', 'Mustard Oil',
                'Sunflower Oil', 'Groundnut Oil', 'Olive Oil', 'Ghee'
            ]
        };

        // Expand queries
        let expandedQueries: string[] = [];
        let isSmartSync = false;
        for (const q of queries) {
            if (SMART_CATEGORIES[q]) {
                expandedQueries.push(...SMART_CATEGORIES[q]);
                isSmartSync = true;
            } else {
                expandedQueries.push(q);
            }
        }

        // Deduplicate just in case
        expandedQueries = [...new Set(expandedQueries)];

        // Force limit to 20 ONLY for smart syncs to maximize total distinct yield per Apify actor rules without timing out
        const finalLimit = isSmartSync ? 20 : limit;

        const run = await apifyService.triggerLiveSync(expandedQueries, location, finalLimit);
        const runData = run.data || run;
        
        res.json({ 
            success: true, 
            message: 'Live sync triggered successfully',
            runId: runData.id,
            status: runData.status
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'catalog.sync.trigger', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to trigger sync' });
    }
});

// Get run status and fetch results to queue
app.get('/catalog/sync/status/:runId', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { runId } = req.params;
        const result = await apifyService.getRunStatus(runId);
        const run = result?.data || result; // Handle Apify's { data: { ... } } response wrapper

        if (run.status === 'SUCCEEDED') {
            const datasetId = run.defaultDatasetId;
            const result = await processScraperDataset(datasetId);
            return res.json(result);
        }

        res.json({ status: run.status, progress: run.status });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'catalog.sync.status', extra: { runId: req.params.runId, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch sync status' });
    }
});

// Webhook listener for Apify
app.post('/catalog/sync/webhook', async (req, res) => {
    // Phase 1 (2026-06-15): the Apify webhook can't send a Bearer token, so it is
    // gated by a shared secret (?secret= or x-webhook-secret header) matched against
    // CATALOG_WEBHOOK_SECRET. Fail-closed: if the secret is unset on the server or
    // mismatched, the call is rejected. (Moving off Apify to the purchased dataset —
    // set this env + add ?secret= to the Apify webhook URL if Apify sync is still
    // used; otherwise these calls are correctly rejected.)
    const expectedSecret = process.env.CATALOG_WEBHOOK_SECRET;
    const providedSecret = (req.query.secret as string) || req.get('x-webhook-secret') || '';
    if (!expectedSecret || providedSecret !== expectedSecret) {
        if (!expectedSecret) console.warn('[Webhook] CATALOG_WEBHOOK_SECRET not set — rejecting catalog webhook call');
        return res.status(401).send('Unauthorized');
    }
    try {
        const { eventType, resource } = req.body;
        // Check if it's the specific SUCCEEDED event from Apify
        if (eventType === 'ACTOR.RUN.SUCCEEDED' && resource?.defaultDatasetId) {
            console.log(`[Webhook] Processing successful scrape for dataset ${resource.defaultDatasetId}`);
            await processScraperDataset(resource.defaultDatasetId);
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook Error:', error);
        Sentry.captureException(error, { tags: { area: 'catalog.sync.webhook' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).send('Server Error');
    }
});

// Get current sync queue
app.get('/catalog/sync/queue', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const queue = await (prisma as any).syncQueue.findMany({
            where: { status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            include: { Vertical: { select: { name: true } }, Tier2Category: { select: { name: true } } }
        });
        // Flatten relation names into top-level fields the frontend expects
        const mapped = queue.map((item: any) => ({
            ...item,
            vertical: item.Vertical?.name || null,
            category: item.Tier2Category?.name || null,
        }));
        res.json(mapped);
    } catch (error) {
        Sentry.captureException(error, { tags: { area: 'catalog.sync.queue' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to fetch sync queue' });
    }
});

// --- AUDIT LOGGING HELPERS ---
async function logBulkAudit(items: any[], action: string, changedBy: string = 'system', tx?: any) {
    if (items.length === 0) return;
    const client = tx || prisma;
    const logs = items.map(p => ({
        id: crypto.randomUUID(),
        productId: p.id,
        action,
        field: p.changedFields || 'bulk_operation',
        newValue: JSON.stringify(p.updateData || p.item || {}),
        changedAt: new Date(),
        changedBy
    }));
    return (client as any).productAuditLog.createMany({ data: logs });
}

// --- TAXONOMY VALIDATION HELPER ---
async function validateTaxonomy(verticalId: string, category_id: string): Promise<boolean> {
    const category = await (prisma as any).tier2Category.findUnique({
        where: { id: category_id }
    });
    return category && category.verticalId === verticalId;
}

// Get All Verticals and Categories (API-driven taxonomy)
app.get('/verticals', async (req, res) => {
    try {
        const verticals = await prisma.vertical.findMany({
            // Category-visibility coupling (D2): the merchant signup vertical picker is the
            // only caller — hide platform-disabled verticals so a new merchant can't register
            // in a category that's turned off for customers. (Consumer + existing-merchant
            // reads go through supabase RLS, which already hides them.)
            where: { is_active: true },
            select: {
                id: true,
                name: true,
                requiresFssai: true,
                isPremium: true,
                isDining: true,
                isGrocery: true,
                isBakery: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(verticals);
    } catch (error) {
        Sentry.captureException(error, { tags: { area: 'verticals' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to fetch verticals' });
    }
});

// Delete Vertical (Atomic with Product Audit)
app.delete('/verticals/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            const affectedProducts = await (tx as any).product.findMany({
                where: { verticalId: id },
                select: { id: true }
            });

            if (affectedProducts.length > 0) {
                await logBulkAudit(affectedProducts.map((p: any) => ({ 
                    id: p.id, 
                    item: { note: 'Uncategorized due to Vertical deletion' } 
                })), 'VERTICAL_DELETED_UNCATEGORIZED', 'admin', tx);
            }

            await (tx as any).vertical.delete({ where: { id } });
        });
        res.json({ success: true, message: 'Vertical deleted and products gracefully uncategorized' });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'verticals', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to delete vertical' });
    }
});

// Delete Category (Atomic with Product Audit)
app.delete('/categories/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await prisma.$transaction(async (tx) => {
            const affectedProducts = await (tx as any).product.findMany({
                where: { category_id: id },
                select: { id: true }
            });

            if (affectedProducts.length > 0) {
                await logBulkAudit(affectedProducts.map((p: any) => ({ 
                    id: p.id, 
                    item: { note: 'Uncategorized due to Category deletion' } 
                })), 'CATEGORY_DELETED_UNCATEGORIZED', 'admin', tx);
            }

            await (tx as any).tier2Category.delete({ where: { id } });
        });
        res.json({ success: true, message: 'Category deleted and products gracefully uncategorized' });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'categories', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to delete category' });
    }
});

// Approve items from sync queue to master catalog (O(1) Raw SQL Batch)
app.post('/catalog/sync/approve', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    const { items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Valid items array required' });
    }

    try {
        // 1. Pre-fetch taxonomy for resolving string names → UUIDs
        //    Handles: pre-resolved UUIDs from scraper, user-edited dropdown strings, and nulls
        const allVerticals = await (prisma as any).vertical.findMany({ select: { id: true, name: true } });
        const allTier2Cats = await (prisma as any).tier2Category.findMany({
            select: { id: true, name: true, verticalId: true }
        });
        const vertNameToId = new Map<string, string>(allVerticals.map((v: any) => [v.name, v.id]));
        const catNameToId = new Map<string, string>(
            allTier2Cats.map((c: any) => [`${c.verticalId}::${c.name}`, c.id])
        );

        // 2. Resolve each item's vertical_id and category_id
        const resolvedItems = items.map((item: any) => {
            // Prefer string name lookup (catches user edits), fall back to existing UUID
            let vId = item.vertical ? (vertNameToId.get(item.vertical) || null) : (item.vertical_id || null);
            let cId: string | null = null;
            if (vId) {
                const catName = item.category;
                cId = catName ? (catNameToId.get(`${vId}::${catName}`) || null) : (item.category_id || null);
            }
            return { ...item, resolved_vertical_id: vId, resolved_category_id: cId };
        });

        // 3. Pre-validation: Taxonomy Integrity Check
        for (const item of resolvedItems) {
            if (item.resolved_vertical_id && item.resolved_category_id) {
                const isValid = await validateTaxonomy(item.resolved_vertical_id, item.resolved_category_id);
                if (!isValid) {
                    return res.status(400).json({
                        error: `Invalid Category/Vertical pairing for item: ${item.name}`,
                        itemId: item.id
                    });
                }
            }
        }

        await prisma.$transaction(async (tx) => {
            // 4. High-Performance Bulk Upsert via Raw SQL
            for (const item of resolvedItems) {
                const sourceId = item.source_product_id || item.sourceProductId;
                const vId = item.resolved_vertical_id || null;
                const cId = item.resolved_category_id || null;
                await tx.$executeRaw`
                    INSERT INTO "Product" (
                        id, name, brand, mrp, image, uom, source, source_product_id,
                        vertical_id, category_id, "updatedAt", "createdAt"
                    ) VALUES (
                        ${crypto.randomUUID()}, ${item.name}, ${item.brand}, ${Number(item.mrp)},
                        ${item.image}, ${item.packsize || item.uom}, 'purchased_catalog',
                        ${sourceId}, ${vId}::uuid, ${cId}::uuid,
                        NOW(), NOW()
                    )
                    ON CONFLICT (source_product_id) DO UPDATE SET
                        name = EXCLUDED.name,
                        brand = EXCLUDED.brand,
                        mrp = EXCLUDED.mrp,
                        image = EXCLUDED.image,
                        uom = EXCLUDED.uom,
                        vertical_id = EXCLUDED.vertical_id,
                        category_id = EXCLUDED.category_id,
                        "updatedAt" = NOW()
                `;
            }

            // 5. Batched Audit (Inside Transaction for Atomicity)
            // 2026-06-15: join product -> source item by sourceProductId, NOT by array
            // index — findMany returns rows in DB order, so the old `resolvedItems[idx]`
            // paired each product with the WRONG source item in the audit log.
            const auditProducts = await (tx as any).product.findMany({
                where: { sourceProductId: { in: resolvedItems.map((i: any) => i.source_product_id || i.sourceProductId) } },
                select: { id: true, sourceProductId: true }
            });
            const idBySource = new Map<string, string>(
                auditProducts.map((p: any) => [String(p.sourceProductId), p.id])
            );
            await logBulkAudit(
                resolvedItems
                    .map((item: any) => ({ id: idBySource.get(String(item.source_product_id || item.sourceProductId)), item }))
                    .filter((x: any) => x.id),
                'CATALOG_SYNC_APPROVE', 'system', tx
            );

            // 6. Batch Cleanup
            const idsToDelete = resolvedItems.map((i: any) => i.id);
            await (tx as any).syncQueue.deleteMany({
                where: { id: { in: idsToDelete } }
            });
        }, {
            timeout: 60000,
            maxWait: 15000
        });

        res.json({ success: true, message: `Successfully approved ${items.length} items with O(1) performance` });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'catalog.sync.approve', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to approve items due to database pressure or constraint violation' });
    }
});

// Reject and delete junk items from sync queue
app.post('/catalog/sync/reject', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No items provided for rejection' });
        }

        const result = await prisma.syncQueue.deleteMany({
            where: { id: { in: ids } }
        });

        res.json({ 
            success: true, 
            message: `Successfully deleted ${result.count} items from queue.`
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'catalog.sync.reject', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to reject sync items' });
    }
});

// Bulk Import
app.post('/products/bulk', upload.single('file'), async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet);

        const created = [];
        const skipped = []; // { row: number, name: string, reason: string }

        let rowNumber = 1; // 1-based index for user friendliness (Header is 1, data starts 2)

        for (const row of data as any[]) {
            rowNumber++;

            // 1. Validate Mandatory Fields
            if (!row.name || !row.mrp || !row.category || !row.vertical) {
                skipped.push({
                    row: rowNumber,
                    name: row.name || 'Unknown',
                    reason: `Missing mandatory fields: ${!row.name ? 'Name ' : ''}${!row.mrp ? 'MRP ' : ''}${!row.vertical ? 'Vertical ' : ''}${!row.category ? 'Category' : ''}`
                });
                continue;
            }

            // 2. Validate Data Types
            const mrp = parseFloat(row.mrp);
            const unitValue = row.unitValue ? parseFloat(row.unitValue) : null;
            const gstRate = row.gstRate ? parseFloat(row.gstRate) : null;

            if (isNaN(mrp)) {
                skipped.push({ row: rowNumber, name: row.name, reason: 'Invalid MRP (Not a number)' });
                continue;
            }

            // 3. New Validations for Commerce
            if (row.unitType && !['ml', 'L', 'kg', 'g', 'pc'].includes(row.unitType)) {
                skipped.push({ row: rowNumber, name: row.name, reason: `Invalid Unit Type: ${row.unitType}` });
                continue;
            }
            if (row.unitType && !unitValue) {
                skipped.push({ row: rowNumber, name: row.name, reason: 'Unit Value required if Unit Type is set' });
                continue;
            }

            // 4. Check Duplicate EAN (if provided)
            if (row.ean) {
                const existing = await prisma.product.findFirst({ where: { ean: String(row.ean) } });
                if (existing) {
                    skipped.push({ row: rowNumber, name: row.name, reason: `Duplicate EAN: ${row.ean}` });
                    continue;
                }
            }

            try {
                const product = await prisma.product.create({
                    data: {
                        name: row.name,
                        description: row.description || null,
                        mrp: Number(row.mrp),
                        image: row.image || null,
                        brand: row.brand || null,
                        ean: row.ean ? String(row.ean) : null,
                        sourceProductId: row.source_product_id ? String(row.source_product_id) : null,
                        updatedAt: new Date(),
                        category_id: row.category_id || null,
                        // New Fields
                        unitType: row.unitType || null,
                        unitValue: unitValue,
                        hsnCode: row.hsnCode ? String(row.hsnCode) : null,
                        gstRate: gstRate
                    }
                });
                await logAudit(product.id, 'CREATE', null, null, null, 'Bulk Import');
                created.push(product);
            } catch (dbError) {
                console.error('Row Import Error:', dbError);
                skipped.push({ row: rowNumber, name: row.name, reason: 'Database Error (Constraints)' });
            }
        }

        fs.unlinkSync(req.file.path);

        res.json({
            message: `Processed. Imported: ${created.length}, Skipped: ${skipped.length}`,
            importedCount: created.length,
            skippedCount: skipped.length,
            skipped // Return the details
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.bulk', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to import products' });
    }
});

// Delete Product
app.delete('/products/:id', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { id } = req.params;
        const product = await prisma.product.findUnique({ where: { id } });
        if (product) {
            // Manually handle dependencies if DB cascade is not active
            await prisma.storeProduct.deleteMany({ where: { productId: id } }).catch(() => { });
            await logAudit(id, 'DELETE', null, JSON.stringify(product), null);
            await prisma.product.delete({ where: { id } });
        }
        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        Sentry.captureException(error, { tags: { area: 'products' }, extra: { id: req.params.id } });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// BULK DELETE Products
app.post('/products/bulk-delete', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No product IDs provided' });
        }

        // Log audit for each product
        for (const id of ids) {
            await logAudit(id, 'BULK_DELETE', null, null, null).catch(() => { });
        }

        // Delete associated inventory first
        await prisma.storeProduct.deleteMany({
            where: { productId: { in: ids } }
        }).catch(() => { });

        // Delete all products in a single transaction
        const result = await prisma.product.deleteMany({
            where: { id: { in: ids } }
        });

        res.json({
            message: `Deleted ${result.count} products successfully`,
            deletedCount: result.count
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.bulk-delete', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to delete products' });
    }
});

// BULK UPDATE Products (category, GST rate, etc.)
app.post('/products/bulk-update', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { ids, updates } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No product IDs provided' });
        }

        // Build safe update data
        const updateData: any = {};
        if (updates.vertical_id !== undefined) updateData.vertical_id = updates.vertical_id;
        if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
        // 2026-06-15: resolve category/vertical NAMES → FK ids (Product has no scalar
        // category/vertical columns — the old phantom writes made bulk-update 500).
        if (updates.vertical !== undefined) {
            const v = updates.vertical
                ? await prisma.vertical.findUnique({ where: { name: String(updates.vertical) }, select: { id: true } })
                : null;
            updateData.vertical_id = v?.id ?? null;
        }
        if (updates.category !== undefined) {
            const t2 = updates.category
                ? await prisma.tier2Category.findFirst({
                    where: { name: String(updates.category), ...(updateData.vertical_id ? { verticalId: updateData.vertical_id } : {}) },
                    select: { id: true, verticalId: true }
                  })
                : null;
            updateData.category_id = t2?.id ?? null;
            // keep the (vertical, category) pair consistent across the bulk set
            if (t2?.verticalId && updateData.vertical_id === undefined) updateData.vertical_id = t2.verticalId;
        }
        if (updates.gstRate !== undefined) updateData.gstRate = parseFloat(updates.gstRate);
        if (updates.unitType !== undefined) updateData.unitType = updates.unitType;
        if (updates.brand !== undefined) updateData.brand = updates.brand;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid updates provided' });
        }

        const changedFields = Object.keys(updateData).join(', ');

        // Taxonomy Integrity Check (Strict)
        if (updateData.vertical_id || updateData.category_id) {
            if (updateData.vertical_id && updateData.category_id) {
                const isValid = await validateTaxonomy(updateData.vertical_id, updateData.category_id);
                if (!isValid) return res.status(400).json({ error: 'Invalid Category/Vertical pairing' });
            }
        }

        // Update with Atomic Auditing
        const result = await prisma.$transaction(async (tx) => {
            const updateResult = await (tx as any).product.updateMany({
                where: { id: { in: ids } },
                data: updateData
            });

            // Batched Audit (Inside Transaction prevents "Lying Logs")
            const auditPayload = ids.map(id => ({ id, updateData, changedFields }));
            await logBulkAudit(auditPayload, 'BULK_UPDATE', 'system', tx);

            return updateResult;
        });

        res.json({
            message: `Updated ${result.count} products successfully`,
            updatedCount: result.count
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.bulk-update', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to update products' });
    }
});

// Patch Product (with Audit)
app.patch('/products/:id', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    const { id } = req.params;
    const updates = req.body;

    // Build update data object
    const updateData: any = {};
    if (updates.mrp !== undefined) updateData.mrp = parseFloat(updates.mrp);
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.brand !== undefined) updateData.brand = updates.brand;
    if (updates.vertical_id !== undefined) updateData.vertical_id = updates.vertical_id;
    if (updates.category_id !== undefined) updateData.category_id = updates.category_id;
    if (updates.ean !== undefined) updateData.ean = updates.ean;
    if (updates.image !== undefined) updateData.image = updates.image;
    if (updates.unitType !== undefined) updateData.unitType = updates.unitType;
    if (updates.unitValue !== undefined) updateData.unitValue = updates.unitValue;
    if (updates.hsnCode !== undefined) updateData.hsnCode = updates.hsnCode;
    if (updates.gstRate !== undefined) updateData.gstRate = updates.gstRate;

    try {
        // 2026-06-15: Product has NO scalar category/vertical columns. The admin grid
        // dropdowns send category/vertical NAMES — resolve them to the FK ids here.
        // (Previously these were written to phantom scalars, so Prisma threw and every
        // inline taxonomy edit failed + rolled back.)
        if (updates.vertical !== undefined) {
            const v = updates.vertical
                ? await prisma.vertical.findUnique({ where: { name: String(updates.vertical) }, select: { id: true } })
                : null;
            updateData.vertical_id = v?.id ?? null;
        }
        if (updates.category !== undefined) {
            // Tier2Category names repeat across verticals → scope to the new or existing vertical.
            const vId = updateData.vertical_id !== undefined
                ? updateData.vertical_id
                : ((await prisma.product.findUnique({ where: { id }, select: { vertical_id: true } }))?.vertical_id ?? null);
            const t2 = (updates.category && vId)
                ? await prisma.tier2Category.findFirst({ where: { name: String(updates.category), verticalId: vId }, select: { id: true } })
                : null;
            updateData.category_id = t2?.id ?? null;
        }

        // Taxonomy integrity: the category must belong to the vertical.
        if (updateData.vertical_id && updateData.category_id) {
            const isValid = await validateTaxonomy(updateData.vertical_id, updateData.category_id);
            if (!isValid) return res.status(400).json({ error: 'Invalid Category for the selected Vertical' });
        }

        // Single DB call: Update and return the new product
        const newProduct = await prisma.product.update({
            where: { id },
            data: updateData,
            include: { images: true }
        });

        // RESPOND IMMEDIATELY - don't wait for audit
        res.json(newProduct);

        // ASYNC AUDIT: Fire-and-forget (non-blocking)
        // We log what was changed without fetching old values (simpler, faster)
        const changedFields = Object.keys(updateData).join(', ');
        logAudit(id, 'UPDATE', changedFields, null, JSON.stringify(updateData)).catch(err => {
            console.error('Audit log failed (non-blocking):', err);
        });

    } catch (error) {
        return handleApiError(res, error, { area: 'products.patch', extra: { id }, userMessage: 'Failed to update product' });
    }
});

// Add Image to Product
app.post('/products/:id/images', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    const { id } = req.params;
    const { url, name, isPrimary } = req.body;

    try {
        const image = await prisma.productImage.create({
            data: {
                productId: id,
                url,
                name: name || 'Product Image',
                isPrimary: isPrimary || false
            }
        });

        // If primary, update main product image field for backward compatibility
        if (isPrimary || (await prisma.productImage.count({ where: { productId: id } })) === 1) {
            await prisma.product.update({
                where: { id },
                data: { image: url }
            });
        }

        await logAudit(id, 'ADD_IMAGE', 'images', null, url);
        res.json(image);
    } catch (error) {
        return handleApiError(res, error, { area: 'products.add-image', extra: { id }, userMessage: 'Failed to add image' });
    }
});

// Delete Image
app.delete('/products/images/:imageId', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { imageId } = req.params;
        const image = await prisma.productImage.findUnique({ where: { id: imageId } });

        if (image) {
            await prisma.productImage.delete({ where: { id: imageId } });
            await logAudit(image.productId, 'REMOVE_IMAGE', 'images', image.url, null);

            // If we deleted the primary image, pick another one or null
            const remaining = await prisma.productImage.findFirst({ where: { productId: image.productId } });
            await prisma.product.update({
                where: { id: image.productId },
                data: { image: remaining ? remaining.url : null }
            });
        }

        res.json({ message: 'Image removed' });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.images', extra: { imageId: req.params.imageId, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to delete image' });
    }
});

// Update Image Details (Name/Primary)
app.patch('/products/images/:imageId', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { imageId } = req.params;
        const { name, isPrimary } = req.body;

        const updateData: any = {};
        if (name !== undefined) updateData.name = name;
        if (isPrimary !== undefined) updateData.isPrimary = isPrimary;

        const image = await prisma.productImage.update({
            where: { id: imageId },
            data: updateData
        });

        res.json(image);
    } catch (error) {
        Sentry.captureException(error, { tags: { area: 'products.images' }, extra: { imageId: req.params.imageId } });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to update image' });
    }
});

// --- JSON Bulk Import for Purchased Catalog Data ---

// POST /products/bulk-import-json
// Accepts JSON array of products from purchased catalog
// Supports field mapping, batch processing, and merge deduplication
app.post('/products/bulk-import-json', express.json({ limit: '100mb' }), async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const { products, fieldMapping, source = 'purchased_catalog' } = req.body;

        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ error: 'No products provided. Expected { products: [...] }' });
        }

        // Default field mapping (can be customized via request)
        const mapping = fieldMapping || {
            product_id: 'sourceProductId',
            product_name: 'name',
            image_url: 'image',
            product_price: 'mrp',
            vertical: 'vertical',
            category_hierarchy: 'category', // Will be parsed for category + subcategory
            avg_rating: 'avgRating',
            number_of_ratings: 'numberOfRatings',
            is_sold_out: 'isSoldOut',
            product_url: 'productUrl',
            country_code: 'countryCode',
            catalog_name: 'catalogName',
            unit_price: 'unitPrice',
            UOM: 'uom',
            shipping_charges: 'shippingCharges',
            source: 'source',
            others: 'extraData',
        };

        const BATCH_SIZE = 500;
        let inserted = 0;
        let updated = 0;
        let skipped = 0;
        const errors: { row: number; name: string; reason: string }[] = [];

        // Process in batches
        for (let batchStart = 0; batchStart < products.length; batchStart += BATCH_SIZE) {
            const batch = products.slice(batchStart, batchStart + BATCH_SIZE);

            for (let i = 0; i < batch.length; i++) {
                const raw = batch[i];
                const rowNum = batchStart + i + 1;

                try {
                    // Apply field mapping
                    const mapped: any = {};
                    for (const [srcField, destField] of Object.entries(mapping)) {
                        if (raw[srcField] !== undefined && raw[srcField] !== null && raw[srcField] !== '') {
                            mapped[destField as string] = raw[srcField];
                        }
                    }

                    // Parse category_hierarchy into category + subcategory
                    if (raw.category_hierarchy) {
                        const parts = String(raw.category_hierarchy).split(/[>\/|,]/).map((s: string) => s.trim()).filter(Boolean);
                        mapped.category = parts[0] || 'Uncategorized';
                        mapped.subcategory = parts.length > 1 ? parts[1] : null;
                    }

                    // Validate required fields
                    const productName = mapped.name || raw.product_name || raw.name;
                    if (!productName) {
                        errors.push({ row: rowNum, name: 'Unknown', reason: 'Missing product name' });
                        skipped++;
                        continue;
                    }
                    mapped.name = String(productName).trim();

                    // Parse numeric fields safely
                    const mrp = parseFloat(mapped.mrp || raw.product_price || raw.mrp || 0);
                    if (isNaN(mrp) || mrp <= 0) {
                        errors.push({ row: rowNum, name: mapped.name, reason: `Invalid price: ${mapped.mrp}` });
                        skipped++;
                        continue;
                    }
                    mapped.mrp = mrp;

                    if (mapped.avgRating) mapped.avgRating = parseFloat(mapped.avgRating) || null;
                    if (mapped.numberOfRatings) mapped.numberOfRatings = parseInt(mapped.numberOfRatings) || null;
                    if (mapped.unitPrice) mapped.unitPrice = parseFloat(mapped.unitPrice) || null;
                    if (mapped.shippingCharges) mapped.shippingCharges = parseFloat(mapped.shippingCharges) || null;
                    if (mapped.isSoldOut) mapped.isSoldOut = mapped.isSoldOut === true || mapped.isSoldOut === 'true' || mapped.isSoldOut === 1;

                    // Handle extraData (others + any unmapped fields)
                    const knownFields = new Set(Object.keys(mapping));
                    const extraFields: any = {};
                    for (const [key, value] of Object.entries(raw)) {
                        if (!knownFields.has(key) && value !== null && value !== undefined && value !== '') {
                            extraFields[key] = value;
                        }
                    }
                    if (raw.others) {
                        try {
                            const othersData = typeof raw.others === 'string' ? JSON.parse(raw.others) : raw.others;
                            Object.assign(extraFields, othersData);
                        } catch {
                            extraFields.others_raw = raw.others;
                        }
                    }
                    if (Object.keys(extraFields).length > 0) {
                        mapped.extraData = extraFields;
                    }

                    // Set source
                    mapped.source = source;

                    // Build Prisma data object
                    const productData: any = {
                        name: mapped.name,
                        mrp: mapped.mrp,
                        // 2026-06-15: removed phantom `category` field — Product has NO scalar
                        // `category` column (only the category_id FK), so this made Prisma reject
                        // EVERY row → 0 inserted while returning HTTP 200 "success". category_id
                        // is resolved via CategoryMapping in the Phase 5 bulk-load importer.
                        image: mapped.image || null,
                        subcategory: mapped.subcategory || null,
                        source: mapped.source,
                        sourceProductId: mapped.sourceProductId ? String(mapped.sourceProductId) : null,
                        avgRating: mapped.avgRating || null,
                        numberOfRatings: mapped.numberOfRatings || null,
                        isSoldOut: mapped.isSoldOut || false,
                        productUrl: mapped.productUrl || null,
                        countryCode: mapped.countryCode || null,
                        catalogName: mapped.catalogName || null,
                        unitPrice: mapped.unitPrice || null,
                        uom: mapped.uom || null,
                        shippingCharges: mapped.shippingCharges || null,
                        extraData: mapped.extraData || null,
                    };

                    // Merge strategy: upsert by sourceProductId if available
                    if (productData.sourceProductId) {
                        await prisma.product.upsert({
                            where: { sourceProductId: productData.sourceProductId },
                            update: { ...productData, updatedAt: new Date() },
                            create: productData,
                        });

                        // Check if it was an update or insert by querying
                        const existing = await prisma.product.findUnique({
                            where: { sourceProductId: productData.sourceProductId },
                            select: { createdAt: true, updatedAt: true }
                        });
                        if (existing && existing.createdAt.getTime() !== existing.updatedAt.getTime()) {
                            updated++;
                        } else {
                            inserted++;
                        }
                    } else {
                        // No sourceProductId — just insert
                        await prisma.product.create({ data: productData });
                        inserted++;
                    }

                } catch (err: any) {
                    const productName = raw.product_name || raw.name || 'Unknown';
                    errors.push({ row: rowNum, name: productName, reason: err.message?.substring(0, 100) || 'Database error' });
                    skipped++;
                }
            }

            // Log batch progress
            console.log(`[Bulk Import] Processed ${Math.min(batchStart + BATCH_SIZE, products.length)}/${products.length}`);
        }

        res.json({
            message: `Import complete. Inserted: ${inserted}, Updated: ${updated}, Skipped: ${skipped}`,
            inserted,
            updated,
            skipped,
            total: products.length,
            errors: errors.slice(0, 50), // Return first 50 errors max
            hasMoreErrors: errors.length > 50,
        });

        } catch (error: any) {
        return handleApiError(res, error, { area: 'products.bulk-import-json', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Bulk import failed' });
    }
});

// --- Consumer-Facing APIs (for Consumer App) ---

// GET /consumer/stores - List stores with inventory
// Returns stores that have at least 1 active product
app.get('/consumer/stores', async (req, res) => {
    try {
        const { category, search, limit = 50, page = 1 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);
        const take = Number(limit);

        const where: any = { active: true };

        if (category) {
            // Filter stores that have products in the given category
            where.products = {
                some: {
                    active: true,
                    product: { subcategory: String(category) } // 2026-06-15: real column; `category` scalar doesn't exist → was a 500
                }
            };
        } else {
            // Only show stores with at least 1 active product
            where.products = { some: { active: true } };
        }

        if (search) {
            where.OR = [
                { name: { contains: String(search), mode: 'insensitive' } },
                { address: { contains: String(search), mode: 'insensitive' } }
            ];
        }

        const [stores, total] = await Promise.all([
            prisma.store.findMany({
                where,
                skip,
                take,
                include: {
                    city: { select: { name: true } },
                    _count: { select: { products: { where: { active: true } } } }
                },
                orderBy: { name: 'asc' }
            }),
            prisma.store.count({ where })
        ]);

        // Format response for consumer app
        const formatted = stores.map(store => ({
            id: store.id,
            name: store.name,
            address: store.address,
            image: store.image,
            city: (store as any).city?.name || null,
            active: store.active,
            operating_hours: store.operatingHours,
            operating_days: store.operatingDays,
            product_count: (store as any)._count?.products || 0,
        }));

        res.json({
            data: formatted,
            pagination: { total, page: Number(page), limit: take, totalPages: Math.ceil(total / take) }
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'consumer.stores', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch stores' });
    }
});

// GET /consumer/stores/:id - Store detail with products
app.get('/consumer/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { category, search } = req.query;

        const store = await prisma.store.findUnique({
            where: { id },
            include: {
                city: { select: { name: true } },
            }
        });

        if (!store) {
            return res.status(404).json({ error: 'Store not found' });
        }

        // Build product filter
        const productWhere: any = { storeId: id, active: true };
        if (category) {
            // 2026-06-15: filter on the real `subcategory` column (the storefront groups +
            // displays by subcategory). The old `category` scalar doesn't exist on Product,
            // so this WHERE threw a 500 whenever a customer filtered by category.
            productWhere.product = { subcategory: String(category) };
        }
        if (search) {
            productWhere.product = {
                ...productWhere.product,
                name: { contains: String(search), mode: 'insensitive' }
            };
        }

        const storeProducts = await prisma.storeProduct.findMany({
            where: productWhere,
            include: {
                product: {
                    include: { images: { where: { isPrimary: true }, take: 1 } }
                }
            },
            orderBy: { product: { name: 'asc' } }
        });

        // Group products by category/subcategory for the storefront
        const groupedByCategory: Record<string, any[]> = {};
        for (const sp of storeProducts) {
            const cat = sp.product.subcategory || 'Other';
            if (!groupedByCategory[cat]) groupedByCategory[cat] = [];
            groupedByCategory[cat].push({
                id: sp.id,
                productId: sp.product.id,
                name: sp.product.name,
                image: sp.product.image,
                mrp: sp.product.mrp,
                price: sp.price,
                stock: sp.stock,
                active: sp.active,
                variant: sp.variant,
                isBestSeller: sp.is_best_seller,
                category: sp.product.subcategory,
                subcategory: sp.product.subcategory,
                brand: sp.product.brand,
                uom: sp.product.uom || sp.product.unitType ? `${sp.product.unitValue || ''}${sp.product.unitType || ''}` : null,
                avgRating: sp.product.avgRating,
                discount: sp.product.mrp > sp.price ? Math.round(((sp.product.mrp - sp.price) / sp.product.mrp) * 100) : 0,
            });
        }

        // Convert to sections array
        const sections = Object.entries(groupedByCategory).map(([title, items]) => ({
            title,
            data: items
        }));

        res.json({
            store: {
                id: store.id,
                name: store.name,
                address: store.address,
                image: store.image,
                city: store.city?.name || null,
                operating_hours: (store as any).operatingHours,
                operating_days: (store as any).operatingDays,
            },
            sections,
            totalProducts: storeProducts.length,
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'consumer.stores', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch store details' });
    }
});

// GET /consumer/products/search - Search products across all stores
app.get('/consumer/products/search', async (req, res) => {
    try {
        const { q, category, limit = 30 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query (q) is required' });
        }

        const storeProducts = await prisma.storeProduct.findMany({
            where: {
                active: true,
                store: { active: true },
                product: {
                    name: { contains: String(q), mode: 'insensitive' },
                    ...(category ? { subcategory: String(category) } : {}) // real column; `category` scalar doesn't exist → threw 500
                }
            },
            include: {
                product: { select: PRODUCT_PUBLIC_SELECT },
                store: { select: { id: true, name: true, address: true, image: true } }
            },
            take: Number(limit),
            orderBy: { product: { name: 'asc' } }
        });

        const results = storeProducts.map((sp: any) => ({
            storeProductId: sp.id,
            product: {
                id: sp.product?.id,
                name: sp.product?.name,
                image: sp.product?.image,
                mrp: sp.product?.mrp,
                category: sp.product?.subcategory, // `category` scalar doesn't exist → was always undefined
                brand: sp.product?.brand,
            },
            price: sp.price,
            stock: sp.stock,
            store: sp.store,
        }));

        res.json({ data: results, total: results.length });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'consumer.products.search', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Search failed' });
    }
});

// --- Order Routes ---

// Create Order (for testing/Consumer App)
app.post('/orders', async (req, res) => {
    // Phase 2K hot-fix (2026-06-09): hoist `user` so the orphan-refund block in
    // the catch can do the ownership check (paymentId must belong to this user's
    // order, or no order exists for it). Stays null on softRequireUser-fail or
    // soft-pass (REQUIRE_ORDERS_AUTH=false + no Authorization header) — catch
    // block treats null as "can't auto-refund, let the SLA cron reconcile".
    let user: any = null;
    try {
        // Option A patch #1B (2026-06-08): backend requireUser hardening.
        // Previously any anonymous caller could submit { userId: <victim>, paid: true,
        // paymentId: 'fake' } and create a paid order in another customer's name.
        //
        // Phase 2J hot-fix (2026-06-09): soft-auth gate. Pre-OTA consumer-app
        // installs still use plain fetch() with no Authorization header and would
        // 401 on every checkout. Until REQUIRE_ORDERS_AUTH=true (post-OTA), we
        // accept unauth requests and skip the impersonation guard for them. The
        // impersonation guard below STILL runs for authenticated callers, so
        // Option A #1B's no-impersonation guarantee is preserved for that path.
        const auth = await softRequireUser(req, res);
        if (!auth) return;
        user = auth.user;

        const {
            userId,
            storeId,
            branchId,
            items,
            totalAmount,
            paid,               // Consumer sends true after successful payment
            paymentId,          // Razorpay payment ID for audit trail
            orderRequestId,     // Reference to the original order_request
            customerName,       // Pickup/dine-in person name
            customerPhone,      // Pickup/dine-in person phone
            storeName,          // Store display name
            specialInstructions,
            arrivalTime,
            otp,                // OTP generated by consumer app
            orderType,          // 'pickup' | 'dine-in' (defaults to 'pickup')
            guestsCount,        // Number of guests for dine-in orders
            // Phase 2 (2F) — coupon snapshot fields. validationToken is the HMAC
            // proof from POST /checkout/validate-coupon. couponId/couponCode are
            // snapshot info; discount/fundingSource/discountType come from the
            // trusted token payload (not body — body is client-controlled).
            validationToken,
            couponId,
            couponCode,
        } = req.body;

        if (!userId || !storeId || !branchId || !items || !totalAmount) {
            return res.status(400).json({ error: 'Missing required fields: userId, storeId, branchId, items, totalAmount' });
        }

        // Option A patch #1B: ownership guard — body.userId must match the
        // authenticated user's id. Prevents creating an order in another
        // customer's name even when a valid token is presented.
        //
        // Phase 2J: only enforced when authenticated. Soft-auth pre-OTA clients
        // (user === null) skip this guard — same as the pre-Option-A baseline.
        // Once REQUIRE_ORDERS_AUTH=true, softRequireUser ensures user is non-null.
        if (user && user.id !== userId) {
            return res.status(403).json({ error: 'userId mismatch — cannot create order for another user' });
        }

        // Phase 2 (2F) — coupon validation token check. If a token is provided,
        // verify HMAC signature + expiry + userId binding + cartHash match. If
        // valid, populate couponContext for the transactional redemption write
        // below. Feature-flagged: REQUIRE_COUPON_TOKEN=true (post-Phase-4)
        // makes any client-claimed couponId without a valid token a 400; until
        // then, legacy clients without tokens still work (no discount applied).
        let couponContext: {
            couponId: string;
            code: string;
            discount: number;
            fundingSource: string;
            discountType: string;
            // Phase 5 (2026-06-09) — set only for multi-store carts. `discount`
            // above is THIS store's slice from the signed breakdown (used for
            // both the Order snapshot and the accumulating ledger row).
            // fingerprint dedups the single redemption row across the cart's N
            // per-store POST /orders calls. storeCount caps split_order_ids
            // growth (re-audit fix R1 — a cart can never legitimately produce
            // more orders than it has stores).
            fingerprint?: string;
            storeCount?: number;
        } | null = null;
        const requireCouponToken = String(process.env.REQUIRE_COUPON_TOKEN || 'false').toLowerCase() === 'true';

        if (validationToken) {
            try {
                const decoded = verifyCouponToken(String(validationToken));
                if (decoded.userId !== userId) {
                    return res.status(400).json({ error: 'Coupon token does not match this user' });
                }
                const isMultiStoreToken = Array.isArray(decoded.breakdown) && decoded.breakdown.length > 1 && typeof decoded.fingerprint === 'string';
                if (isMultiStoreToken) {
                    // Phase 5 — multi-store token. The token's cartHash covers the
                    // FULL cart while this POST /orders carries one store's subset,
                    // so the whole-cart hash comparison is replaced by subset
                    // matching: every item in this order must belong to exactly
                    // one breakdown entry's storeProductIds (signed data). That
                    // entry's slice becomes this Order's snapshot discount.
                    // Phase 5 audit fold-in (2026-06-10): EXACT-set matching, not
                    // subset. The order's storeProductIds must equal one breakdown
                    // entry's set exactly — a partial-store order (item removed
                    // after validation) no longer silently matches and understates.
                    // Items missing storeProductId count as a match failure (the
                    // previous filter silently dropped them before matching).
                    const rawSpids: Array<string | null> = (items || []).map((it: any) => (it?.storeProductId ? String(it.storeProductId) : null));
                    const hasMissingSpid = rawSpids.some((s) => s === null);
                    const orderSpidSet = new Set<string>(rawSpids.filter((s): s is string => !!s));
                    // Phase 5 re-audit fix R3 (2026-06-10): bind QUANTITIES, not
                    // just the product-id set. A stripped-quantity or padded order
                    // must not book the signed slice. Tokens carry sorted
                    // "spid:qty" pairs per entry; the order's items must produce
                    // the identical multiset. Tokens minted before this deploy
                    // lack spidQty — fall back to the spid-set match for the
                    // 10-minute transition window.
                    const orderSpidQtyKey = (items || [])
                        .map((it: any) => `${it?.storeProductId ? String(it.storeProductId) : 'MISSING'}:${Number(it?.quantity) || 0}`)
                        .sort()
                        .join('|');
                    const matches = hasMissingSpid || orderSpidSet.size === 0
                        ? []
                        : (decoded.breakdown as any[]).filter((entry) => {
                            if (Array.isArray(entry?.spidQty)) {
                                const entryKey = entry.spidQty.map((s: any) => String(s)).sort().join('|');
                                return entryKey === orderSpidQtyKey;
                            }
                            if (!Array.isArray(entry?.storeProductIds)) return false;
                            const entrySet = new Set<string>(entry.storeProductIds.map((s: any) => String(s)));
                            if (entrySet.size !== orderSpidSet.size) return false;
                            for (const spid of orderSpidSet) {
                                if (!entrySet.has(spid)) return false;
                            }
                            return true;
                        });
                    if (matches.length !== 1) {
                        if (requireCouponToken) {
                            return res.status(400).json({ error: 'Cart changed since coupon was applied — please re-apply' });
                        }
                        console.warn(`[POST /orders] Phase 5 multi-store breakdown match failed (${matches.length} matches, ${orderSpidSet.size} spids, missingSpid=${hasMissingSpid}) — proceeding WITHOUT coupon. Will reject when REQUIRE_COUPON_TOKEN=true. userId=${userId}`);
                        try { Sentry.captureMessage('phase5: multi-store breakdown match failed', { level: 'warning', extra: { userId, orderSpids: Array.from(orderSpidSet), hasMissingSpid, matchCount: matches.length } }); } catch {}
                        // No couponContext — order is created without a discount
                        // snapshot (mirrors the legacy no-token behavior).
                    } else {
                        couponContext = {
                            couponId: String(decoded.couponId),
                            code: String(couponCode || ''),
                            discount: Number(matches[0].discount) || 0,
                            fundingSource: String(decoded.fundingSource || ''),
                            discountType: String(decoded.discountType || ''),
                            fingerprint: String(decoded.fingerprint),
                            storeCount: (decoded.breakdown as any[]).length,
                        };
                    }
                } else {
                    // Single-store path — unchanged Phase 2F semantics.
                    // cartHash binding — only enforce strictly when REQUIRE_COUPON_TOKEN
                    // is on. Until then a mismatch is logged but allowed (backward compat
                    // with legacy consumer-app builds that haven't OTA'd yet).
                    const observedCartHash = computeCartHash(items || []);
                    if (decoded.cartHash !== observedCartHash) {
                        if (requireCouponToken) {
                            return res.status(400).json({ error: 'Cart changed since coupon was applied — please re-apply' });
                        }
                        console.warn(`[POST /orders] coupon cartHash mismatch — will reject when REQUIRE_COUPON_TOKEN=true. userId=${userId}`);
                    }
                    couponContext = {
                        couponId: String(decoded.couponId),
                        code: String(couponCode || ''),
                        discount: Number(decoded.discount) || 0,
                        fundingSource: String(decoded.fundingSource || ''),
                        discountType: String(decoded.discountType || ''),
                    };
                }
            } catch (err: any) {
                // Audit fix N5 (2026-06-10): while REQUIRE_COUPON_TOKEN=false,
                // a bad/expired token must NOT hard-400 — the customer may have
                // already PAID (Razorpay completes before POST /orders), and a
                // 400 here bypassed the orphaned-payment handling entirely (no
                // alert, no Sentry, no refund path) while the client promised
                // automatic reconciliation. Mirror the breakdown-mismatch
                // semantics instead: proceed WITHOUT the coupon + Sentry warn.
                // Flag ON keeps the strict 400 (clients re-validate pre-payment).
                if (requireCouponToken) {
                    return res.status(400).json({ error: err?.message || 'Invalid coupon token' });
                }
                console.warn(`[POST /orders] coupon token verify failed (${err?.message}) — proceeding WITHOUT coupon (flag off). userId=${userId} paid=${!!paid}`);
                try { Sentry.captureMessage('coupon token verify failed — proceeded couponless (flag off)', { level: 'warning', extra: { userId, paid: !!paid, reason: err?.message } }); } catch {}
                couponContext = null;
            }
        } else if (requireCouponToken && couponId) {
            return res.status(400).json({ error: 'Coupon discount requires a validation token. Please re-apply the coupon.' });
        }

        // ── Store Status Gate: reject orders for offline/closed stores ──
        const branch = await prisma.merchantBranch.findUnique({
            where: { id: branchId },
            select: { isActive: true, operating_hours: true, prep_time_minutes: true }
        });

        if (!branch) {
            return res.status(404).json({ error: 'Store branch not found.' });
        }

        if (!branch.isActive) {
            return res.status(403).json({ error: 'STORE_OFFLINE', message: 'This store is currently offline and not accepting orders.' });
        }

        // Check operating hours server-side
        const oh = branch.operating_hours as any;
        if (oh && oh.days && oh.open && oh.close) {
            const now = new Date();
            const jsDay = now.getDay();
            const todayIndex = (jsDay + 6) % 7; // Convert JS day (0=Sun) to store day (0=Mon)

            if (!oh.days.includes(todayIndex)) {
                return res.status(403).json({ error: 'STORE_CLOSED_TODAY', message: 'This store is closed today.' });
            }

            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            const [openH, openM] = oh.open.split(':').map(Number);
            const [closeH, closeM] = oh.close.split(':').map(Number);
            const openMin = openH * 60 + openM;
            const closeMin = closeH * 60 + closeM;
            const prepBuffer = branch.prep_time_minutes || 15;

            if (currentMinutes < openMin || currentMinutes > (closeMin - prepBuffer)) {
                return res.status(403).json({ error: 'STORE_CLOSED_HOURS', message: 'This store is outside operating hours.' });
            }

            if (oh.hasLunchBreak && oh.lunchStart && oh.lunchEnd) {
                const [lsH, lsM] = oh.lunchStart.split(':').map(Number);
                const [leH, leM] = oh.lunchEnd.split(':').map(Number);
                if (currentMinutes >= (lsH * 60 + lsM) && currentMinutes < (leH * 60 + leM)) {
                    return res.status(403).json({ error: 'STORE_LUNCH_BREAK', message: 'This store is on lunch break.' });
                }
            }
        }

        const orderNumber = `PAS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Logic Gate: If consumer has already paid, mark as CONFIRMED/READY + isPaid
        let orderStatus: 'PENDING' | 'CONFIRMED' | 'READY';
        if (orderType === 'dine-in' && items.length === 0) {
            orderStatus = 'READY'; // Pure table bookings skip to Ready
        } else if (paid) {
            orderStatus = 'CONFIRMED'; // Paid orders (pickup or dine-in) go to Processing
        } else {
            orderStatus = 'PENDING';
        }
        const orderIsPaid = paid ? true : false;
        const orderOtp = otp || Math.floor(1000 + Math.random() * 9000).toString();

        // We will collect low stock alerts during the transaction to fire them after commit
        const lowStockAlerts: { sp: any, title: string, body: string }[] = [];

        // ── Layer 4: Idempotency ──────────────────────────────────────────────
        // If this Razorpay payment already produced an order, return it instead of
        // creating a duplicate. Makes client auto-retries safe (no double order /
        // double charge) after a transient failure.
        if (paymentId) {
            // Option A patch #3 (2026-06-08): multi-store idempotency tightening.
            // Previously keyed only on paymentId, which is intentionally shared across
            // N orders in a multi-store cart — store B's POST would silently get store
            // A's order back. Adding storeId + orderRequestId discriminators fixes that.
            const existingForPayment = await prisma.order.findFirst({
                where: {
                    AND: [
                        { metadata: { path: ['razorpayPaymentId'], equals: paymentId } },
                        { storeId: storeId },
                        ...(orderRequestId ? [{ metadata: { path: ['orderRequestId'], equals: orderRequestId } as any }] : [])
                    ]
                },
                include: { items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } }, store: true },
            });
            if (existingForPayment) {
                console.log(`[POST /orders] Idempotent hit — order already exists for payment ${paymentId}`);
                return res.status(200).json(existingForPayment);
            }
        }

        // ── Phase 7B (2026-06-10) — server-side payment verification ──────
        // Settlement prerequisite (docs/phase7-settlement-architecture.html §8):
        // the server previously trusted the client's paid claim entirely.
        // Policy:
        //   * payment NOT FOUND or NOT captured/authorized → 400 reject (no
        //     legitimate client is harmed: if no charge happened, refusing the
        //     order costs nothing; closes the self-mark-paid hole).
        //   * amount incoherence (sum of this payment's orders would exceed the
        //     captured amount + ₹5 tolerance for whole-rupee GST splits) →
        //     CREATE the order but flag payment_verified=false (HELD from
        //     settlement; legitimate edge cases possible, money reviewed not lost).
        //   * Razorpay API error / SDK unconfigured → payment_verified=null
        //     (cron re-verifies) — infrastructure failure must not block sales.
        let paymentVerified: boolean | null = null;
        let paymentVerificationNote: string | null = null;
        if (paid && paymentId && razorpayInstance) {
            try {
                const rzpPayment: any = await razorpayInstance.payments.fetch(String(paymentId));
                const pStatus = String(rzpPayment?.status || '');
                if (!rzpPayment || (pStatus !== 'captured' && pStatus !== 'authorized')) {
                    try { Sentry.captureMessage('phase7b: paid-claim rejected — payment not captured', { level: 'warning', extra: { paymentId, pStatus, userId } }); } catch {}
                    return res.status(400).json({
                        error: 'PAYMENT_NOT_VERIFIED',
                        message: 'We could not verify this payment. If you were charged, the amount will be automatically refunded.',
                    });
                }
                const capturedInr = Number(rzpPayment.amount || 0) / 100;
                // Sum the totals already booked against this payment (multi-store
                // carts share one payment across N orders).
                const sibling = await prisma.order.aggregate({
                    _sum: { totalAmount: true },
                    where: { metadata: { path: ['razorpayPaymentId'], equals: String(paymentId) } },
                });
                const bookedInr = Number(sibling._sum.totalAmount || 0);
                const wouldBook = bookedInr + (Number(totalAmount) || 0);
                if (wouldBook > capturedInr + 5) {
                    paymentVerified = false;
                    paymentVerificationNote = `amount overrun: captured ₹${capturedInr}, would book ₹${wouldBook}`;
                    try { Sentry.captureMessage('phase7b: payment amount overrun — order HELD from settlement', { level: 'warning', extra: { paymentId, capturedInr, wouldBook, userId } }); } catch {}
                } else {
                    paymentVerified = true;
                    paymentVerificationNote = `captured ₹${capturedInr} (${pStatus})`;
                }
            } catch (verifyErr: any) {
                const msg = String(verifyErr?.message || verifyErr);
                // Razorpay returns a 400-ish error for unknown payment ids — treat
                // explicit not-found as a hard reject, transport errors as null.
                if (/does not exist|not found|invalid id/i.test(msg)) {
                    try { Sentry.captureMessage('phase7b: paid-claim rejected — payment id unknown to Razorpay', { level: 'warning', extra: { paymentId, userId } }); } catch {}
                    return res.status(400).json({
                        error: 'PAYMENT_NOT_VERIFIED',
                        message: 'We could not verify this payment. If you were charged, the amount will be automatically refunded.',
                    });
                }
                paymentVerified = null;
                paymentVerificationNote = `verify-error: ${msg.slice(0, 180)}`;
                console.warn(`[POST /orders] Phase 7B verification errored (order proceeds, cron re-verifies): ${msg}`);
            }
        } else if (paid && paymentId && !razorpayInstance) {
            paymentVerificationNote = 'razorpay sdk not configured at create time';
        }

        // Option A patch #4 (2026-06-08): server-side TTL + status guard.
        // Verify the order_request is still ACCEPTED and not expired before
        // creating a paid order from it. Without this, an expired or non-ACCEPTED
        // request can still produce an order that should have been refunded per
        // business rules. Skip the check if no orderRequestId (legacy callers).
        if (orderRequestId) {
            const orq = await prisma.order_requests.findUnique({
                where: { id: orderRequestId },
                select: { status: true, expires_at: true }
            });
            if (!orq) {
                return res.status(404).json({ error: 'Order request not found' });
            }
            if (orq.status !== 'ACCEPTED') {
                return res.status(410).json({ error: `Order request is in state ${orq.status}, expected ACCEPTED` });
            }
            const expiresMs = new Date(orq.expires_at as any).getTime();
            if (expiresMs < Date.now()) {
                return res.status(410).json({ error: 'Order request has expired' });
            }
        }

        // Transaction Block: Order Create + Stock Decrement + Notification Create
        const order = await prisma.$transaction(async (tx) => {
            // ── Layer 2: Guarantee the User row exists (FK target of fk_orders_user) ──
            // The signup trigger normally creates it; this is the point-of-use backstop so a
            // missing User row can NEVER fail checkout, regardless of any upstream/DB gap.
            // upsert: if it exists (normal case) → no-op; if missing → create a minimal
            // CONSUMER row with a guaranteed-unique synthetic email.
            await tx.user.upsert({
                where: { id: userId },
                update: {},
                create: {
                    id: userId,
                    email: `${userId}@auto.pickatstore.app`,
                    role: 'CONSUMER',
                    name: customerName || null,
                    phone: customerPhone || null,
                    passwordHash: 'sso_auth_active',
                },
            });

            const createdOrder = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    storeId,
                    branchId,
                    totalAmount,
                    status: orderStatus,
                    isPaid: orderIsPaid,
                    otp: orderOtp,
                    otp_code: orderOtp, // DEPRECATED: Retained temporarily for backward compatibility. Use 'otp' as the canonical field.
                    customer_name: customerName || null,
                    customer_phone: customerPhone || null,
                    store_name: storeName || null,
                    special_instructions: specialInstructions || null,
                    arrival_time: arrivalTime || null,
                    order_type: orderType || 'pickup',
                    guests_count: guestsCount || null,
                    items_count: items.length,
                    amount: totalAmount,
                    // Parse arrival_time text → absolute UTC timestamp for cron-based slot reminders.
                    // Returns null if format unrecognized; order just won't get scheduled reminders.
                    slot_time_at: parseArrivalTime(arrivalTime, new Date()),
                    // Persist orderRequestId whenever we have one, regardless of paymentId
                    // (round-4 audit fix for Bug N7: the cancel-time order_requests cleanup
                    // reads metadata.orderRequestId — leaving it undefined for non-Razorpay
                    // flows meant the cleanup silently no-op'd. Now we set metadata if
                    // EITHER paymentId or orderRequestId is present.)
                    metadata: (paymentId || orderRequestId)
                        ? {
                            ...(paymentId ? { razorpayPaymentId: paymentId } : {}),
                            ...(orderRequestId ? { orderRequestId } : {}),
                        }
                        : undefined,
                    // Phase 7B (2026-06-10) — server-side verification result.
                    paymentVerified,
                    paymentVerificationNote,
                    items: {
                        create: items.map((item: any) => ({
                            storeProductId: item.storeProductId || null,
                            product_name: item.name || item.product_name || null,
                            is_veg: item.isVeg ?? true,
                            quantity: item.quantity,
                            price: item.price
                        }))
                    }
                },
                include: {
                    items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } },
                    store: true
                }
            });

            console.log(`[POST /orders] Created order ${orderNumber} in tx`);

            if (orderRequestId) {
                // Phase 2K hot-fix (2026-06-09): atomic conditional update prevents
                // the TOCTOU race the adversarial review found. Previously the
                // outside-txn read of status='ACCEPTED' could go stale by the time
                // this inner update fired, and an unconditional update silently
                // overwrote CANCELLED/REJECTED/EXPIRED with COMPLETED. The original
                // try/catch swallowed any error too, making the race invisible.
                // updateMany with status + expires_at guards rolls the whole order
                // back if the request transitioned during checkout — caller's
                // outer catch returns ORDER_CREATE_FAILED + retryable=true.
                const updateResult = await tx.order_requests.updateMany({
                    where: {
                        id: orderRequestId,
                        status: 'ACCEPTED',
                        expires_at: { gt: new Date() },
                    },
                    data: { status: 'COMPLETED' },
                });
                if (updateResult.count === 0) {
                    throw new Error(`ORDER_REQUEST_INVALID_STATE: ${orderRequestId} no longer ACCEPTED or has expired`);
                }
                console.log(`[POST /orders] Updated order_request ${orderRequestId} to COMPLETED`);
            }

            // Phase 2 (2F) — coupon redemption inside the transaction. Either both
            // the Order and the redemption succeed, or both roll back. Atomic
            // increments via updateMany+where prevent usageLimit/dailyUsageLimit
            // from being exceeded under parallel checkout race. Idempotent on
            // (couponId, orderId) — the partial unique index from Phase 1 #4
            // means duplicate inserts are no-ops.
            if (couponContext) {
                // Snapshot the coupon on the Order row (immune to future archive/edit).
                // Phase 5: for multi-store carts, couponContext.discount is THIS
                // store's slice from the signed breakdown — not the full cart total.
                await tx.order.update({
                    where: { id: createdOrder.id },
                    data: {
                        orderCouponId: couponContext.couponId,
                        orderCouponCode: couponContext.code,
                        orderCouponDiscount: couponContext.discount,
                        orderCouponFundingSource: couponContext.fundingSource,
                        orderCouponDiscountType: couponContext.discountType,
                    },
                });

                // Shared counter logic — runs EXACTLY ONCE per redemption row
                // (single-store: per order; multi-store: per cart, on the
                // first store-order's INSERT only).
                const incrementCouponCounters = async () => {
                    // Fetch coupon caps (single read) for limit checks.
                    const couponRow = await tx.coupon.findUnique({
                        where: { id: couponContext!.couponId },
                        select: { usageLimit: true, dailyUsageLimit: true, dailyUsageResetAt: true, dailyUsageCount: true },
                    });

                    // Total usage limit — atomic compare-and-swap.
                    if (couponRow?.usageLimit) {
                        const u = await tx.coupon.updateMany({
                            where: { id: couponContext!.couponId, usedCount: { lt: couponRow.usageLimit } },
                            data: { usedCount: { increment: 1 } },
                        });
                        if (u.count === 0) {
                            throw new Error('Coupon usage limit reached');
                        }
                    } else {
                        await tx.coupon.update({
                            where: { id: couponContext!.couponId },
                            data: { usedCount: { increment: 1 } },
                        });
                    }

                    // Daily usage limit with IST midnight reset.
                    if (couponRow?.dailyUsageLimit) {
                        const nowD = new Date();
                        const istNowD = new Date(nowD.getTime() + (5.5 * 60 * 60 * 1000));
                        const istMidnightUtcMsD = Date.UTC(istNowD.getUTCFullYear(), istNowD.getUTCMonth(), istNowD.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
                        const istMidnightTodayD = new Date(istMidnightUtcMsD);
                        // Step 1: reset stale counter.
                        await tx.coupon.updateMany({
                            where: { id: couponContext!.couponId, OR: [
                                { dailyUsageResetAt: null },
                                { dailyUsageResetAt: { lt: istMidnightTodayD } },
                            ] },
                            data: { dailyUsageCount: 0, dailyUsageResetAt: istMidnightTodayD },
                        });
                        // Step 2: atomic increment with limit check.
                        const d = await tx.coupon.updateMany({
                            where: { id: couponContext!.couponId, dailyUsageCount: { lt: couponRow.dailyUsageLimit } },
                            data: { dailyUsageCount: { increment: 1 } },
                        });
                        if (d.count === 0) {
                            throw new Error('Coupon daily usage limit reached');
                        }
                    }
                };

                if (couponContext.fingerprint) {
                    // ── Phase 5 (2026-06-09) — multi-store redemption path ──
                    // ONE redemption row covers the whole cart, keyed by
                    // (coupon_id, cart_fingerprint) via the partial unique index.
                    // INSERT ... ON CONFLICT DO NOTHING avoids transaction
                    // poisoning (a caught P2002 would abort the surrounding
                    // Postgres tx) AND gives atomic first-writer-wins: the store
                    // order that lands first creates the row + increments the
                    // counters ONCE; every other store-order appends its orderId
                    // to split_order_ids (deduped in-statement, so client retries
                    // can't double-append).
                    // Phase 5 audit fold-in (2026-06-10): discount_amount ACCUMULATES
                    // per order slice instead of front-loading the full cart total on
                    // the first INSERT. The ledger row's discountAmount now always
                    // equals the sum of the slices of orders actually placed — exact
                    // and symmetric with the Q5 partial-reversal subtraction, and it
                    // never overstates when a sibling store's POST /orders fails.
                    const inserted = await tx.$queryRaw<{ id: string }[]>`
                        INSERT INTO "public"."coupon_redemptions"
                            ("coupon_id", "user_id", "discount_amount", "funding_source", "split_order_ids", "cart_fingerprint")
                        VALUES (
                            ${couponContext.couponId},
                            ${userId}::uuid,
                            ${couponContext.discount},
                            ${couponContext.fundingSource},
                            ARRAY[${createdOrder.id}]::text[],
                            ${couponContext.fingerprint}
                        )
                        ON CONFLICT ("coupon_id", "cart_fingerprint") WHERE "cart_fingerprint" IS NOT NULL
                        DO NOTHING
                        RETURNING "id";
                    `;
                    if (inserted.length > 0) {
                        await incrementCouponCounters();
                    } else {
                        // Phase 5 audit fix #5b (2026-06-10): append is now CHECKED.
                        // affected = 0 means an idempotent retry (orderId already
                        // in the array), a replay capped by R1 below, or the row
                        // is unexpectedly missing (Sentry-warn; do not fail the
                        // order).
                        //
                        // Re-audit fix R1 (2026-06-10): array growth is capped at
                        // the signed breakdown's store count — a cart can never
                        // legitimately produce more orders than it has stores, so
                        // a scripted client replaying one non-expired token across
                        // several full checkouts can no longer ride the append
                        // path indefinitely.
                        const storeCap = couponContext.storeCount ?? 1;
                        const appended = await tx.$executeRaw`
                            UPDATE "public"."coupon_redemptions"
                            SET "split_order_ids" = array_append("split_order_ids", ${createdOrder.id}),
                                "discount_amount" = COALESCE("discount_amount", 0) + ${couponContext.discount}
                            WHERE "coupon_id" = ${couponContext.couponId}
                              AND "cart_fingerprint" = ${couponContext.fingerprint}
                              AND NOT ("split_order_ids" @> ARRAY[${createdOrder.id}]::text[])
                              AND COALESCE(array_length("split_order_ids", 1), 0) < ${storeCap};
                        `;
                        if (appended === 0) {
                            const probe = await tx.couponRedemption.findFirst({
                                where: { couponId: couponContext.couponId, cartFingerprint: couponContext.fingerprint },
                                select: { id: true, splitOrderIds: true },
                            });
                            const isIdempotentRetry = !!probe && probe.splitOrderIds.includes(createdOrder.id);
                            if (!isIdempotentRetry) {
                                const cappedReplay = !!probe && probe.splitOrderIds.length >= storeCap;
                                console.error(`[POST /orders] Phase 5 append rejected — ${cappedReplay ? 'split_order_ids at capacity (possible token replay)' : 'ledger row missing'} couponId=${couponContext.couponId} orderId=${createdOrder.id}`);
                                try { Sentry.captureMessage(cappedReplay ? 'phase5: append rejected — capacity cap (possible token replay)' : 'phase5: multi-store redemption append found no row', { level: 'warning', extra: { couponId: couponContext.couponId, orderId: createdOrder.id, storeCap } }); } catch {}
                                // Audit fix N3 (2026-06-10): the snapshot was written
                                // BEFORE this branch — without rolling it back, a
                                // replayed order still books the slice discount with
                                // no ledger row behind it. Clear it in the same tx so
                                // an order whose redemption was rejected never carries
                                // a discount snapshot.
                                await tx.order.update({
                                    where: { id: createdOrder.id },
                                    data: {
                                        orderCouponId: null,
                                        orderCouponCode: null,
                                        orderCouponDiscount: null,
                                        orderCouponFundingSource: null,
                                        orderCouponDiscountType: null,
                                    },
                                });
                            }
                        }
                    }
                } else {
                    // ── Single-store path — unchanged Phase 2F semantics ──
                    // Idempotent ledger insert. If a redemption already exists for
                    // this (couponId, orderId), skip the increments — this is the
                    // retry/double-call defense.
                    const existingRedemption = await tx.couponRedemption.findFirst({
                        where: { couponId: couponContext.couponId, orderId: createdOrder.id },
                        select: { id: true },
                    });
                    if (!existingRedemption) {
                        await tx.couponRedemption.create({
                            data: {
                                couponId: couponContext.couponId,
                                userId,
                                orderId: createdOrder.id,
                                discountAmount: couponContext.discount,
                                fundingSource: couponContext.fundingSource,
                            },
                        });
                        await incrementCouponCounters();
                    }
                }
            }

            // 2. Decrement Stock & Check Low Inventory within tx
            // Note: The DB has a CHECK constraint `stock_non_negative` that prevents
            // stock from going below 0. We must check current stock first.
            const stockItems = items.filter((item: any) => item.storeProductId);
            if (stockItems.length > 0) {
                for (const item of stockItems) {
                    // Read current stock before attempting decrement
                    const current = await tx.storeProduct.findUnique({
                        where: { id: item.storeProductId },
                        select: { stock: true }
                    });

                    if (!current || current.stock < item.quantity) {
                        // Fail the transaction entirely - prevents placing order if out of stock
                        const productName = item.name || 'Item';
                        console.error(`[POST /orders] ❌ FAILED: Insufficient stock for ${productName} (${item.storeProductId})`);
                        throw new Error(`Insufficient stock for ${productName}. Please remove it and try again.`);
                    }

                    const sp = await tx.storeProduct.update({
                        where: { id: item.storeProductId },
                        data: { stock: { decrement: item.quantity } },
                        include: { product: { select: PRODUCT_PUBLIC_SELECT } }
                    });

                    if (sp.stock === 0) {
                        lowStockAlerts.push({
                            sp,
                            title: 'Out of Stock Alert',
                            body: `${sp.product.name} is completely out of stock.`
                        });
                    } else if (sp.stock <= 5) {
                        lowStockAlerts.push({
                            sp,
                            title: 'Low Stock Warning',
                            body: `Action Required: Only ${sp.stock} left of ${sp.product.name}.`
                        });
                    }
                }
            } else {
                console.log(`[POST /orders] ⚠️ No storeProductId on items — stock decrement skipped for ${orderNumber}`);
            }

            return createdOrder;
        });

        console.log(`[POST /orders] ✅ Transaction committed for ${orderNumber} | status=${orderStatus} isPaid=${orderIsPaid} paymentId=${paymentId || 'none'}`);

        // --- Post-Commit Operations (Non-blocking) ---

        // Dispatch main order notification outside transaction
        notificationService.sendMerchantNotification({
            storeId,
            title: paid ? '💰 Paid Order Received!' : 'New Order Received!',
            body: `Order #${orderNumber} for ₹${totalAmount}${paid ? ' — Already Paid' : ''}`,
            type: 'NEW_ORDER',
            referenceId: order.id,
            link: '/(main)/orders',
            metadata: {
                orderNumber,
                totalAmount,
                isPaid: paid,
                paymentId: paymentId || null,
            },
        }).catch(e => console.error('[POST /orders] New order notif failed:', e));

        // 2026-06-04 (Option B): backfill User.name from this order's
        // customer_name when the user has never provided a profile name.
        // Fire-and-forget — never block order success on a profile write.
        if (userId && typeof customerName === 'string' && customerName.trim().length >= 2) {
            prisma.user.updateMany({
                where: { id: userId, name: null },
                data: { name: customerName.trim() },
            }).catch(e => console.warn('[POST /orders] User.name backfill failed:', e?.message || e));
        }

        // Customer-side notification: branch on order_type
        // - Dine-in: send DINING_BOOKED (event #12)
        // - Pickup (paid only): send PAYMENT_SUCCESSFUL (event #2)
        const customerUserId = (order as any).userId;
        const createdOrderType = (order as any).order_type;
        if (customerUserId) {
            if (createdOrderType === 'dine-in') {
                notificationService.sendConsumerNotification({
                    userId: customerUserId,
                    title: 'Table booked 🍽️',
                    body: `Your dine-in slot for Order #${orderNumber} is confirmed.`,
                    type: 'DINING_BOOKED',
                    referenceId: order.id,
                    link: `/orders/${order.id}`,
                    storeId,
                    metadata: { orderNumber, totalAmount, isPaid: paid },
                }).catch(e => console.error('[POST /orders] Customer DINING_BOOKED notif failed:', e));
            } else if (paid) {
                notificationService.sendConsumerNotification({
                    userId: customerUserId,
                    title: 'Payment received ✅',
                    body: `Order #${orderNumber} for ₹${totalAmount} is being prepared.`,
                    type: 'PAYMENT_SUCCESSFUL',
                    referenceId: order.id,
                    link: `/orders/${order.id}`,
                    storeId,
                    metadata: { orderNumber, totalAmount, isPaid: true, paymentId: paymentId || null },
                }).catch(e => console.error('[POST /orders] Customer PAYMENT_SUCCESSFUL notif failed:', e));
            }
        }

        // 1. Fire accumulated low-stock alerts
        for (const alert of lowStockAlerts) {
            notificationService.sendMerchantNotification({
                storeId,
                title: alert.title,
                body: alert.body,
                type: 'LOW_STOCK',
                link: '/(main)/inventory',
                metadata: (alert as any).metadata ?? null,
            }).catch(e => console.error('[POST /orders] Low stock notif failed:', e));
        }

        // 2. Broadcast to merchants via Socket.IO
        io.to(`store_${storeId}`).emit('new_order', order);

        res.status(201).json(order);
    } catch (error) {
        // Full detail to server logs only — never leak DB/Prisma internals to the client.
        console.error('Create Order Error:', error);
        const raw = error instanceof Error ? error.message : String(error);
        const isStock = /stock/i.test(raw);
        const wasPaid = !!(req.body?.paid && req.body?.paymentId);

        // ── Layer 4: orphaned-payment safety ──
        // Payment captured but order not created → money taken with nothing to show.
        // Emit a loud, structured ALERT so ops/Sentry can reconcile + refund.
        // Option A patch #5 (2026-06-08): synchronous refund now wired below; a
        // processOrphanedPaymentsSla cron is still TODO to catch async/process-death
        // gaps.
        if (wasPaid) {
            console.error(`[POST /orders][ORPHANED-PAYMENT][ALERT] payment=${req.body.paymentId} user=${req.body.userId} amount=${req.body.totalAmount} store=${req.body.storeId} reason="${raw}"`);

            // Option A patch #5 (2026-06-08): inline orphan-payment refund.
            // Previously this only logged and left the customer waiting for manual
            // ops. Now we trigger the refund immediately for the failed store's
            // amount. (A separate processOrphanedPaymentsSla cron — out of Option A
            // scope — will catch any orphans this misses due to request-process
            // death or async failures.)
            //
            // Phase 2K hot-fix (2026-06-09): adversarial review (PR #1) found this
            // path was a financial-sabotage vector. Client-controlled paymentId +
            // totalAmount with no ownership check meant any auth'd user could
            // submit a victim's paymentId with guaranteed-to-fail items and force
            // a refund on the VICTIM's prior payment. Fix: (1) skip auto-refund
            // on soft-auth unauth requests (let the SLA cron handle), (2) require
            // the paymentId to either match an order owned by this user OR have
            // no existing order at all, (3) cap refund at Razorpay-fetched
            // captured amount (never trust req.body.totalAmount).
            const paymentId = req.body?.paymentId;
            const requestedAmount = Number(req.body?.totalAmount ?? 0);
            if (!user) {
                // Soft-auth pre-OTA request — we can't verify ownership. Skip
                // auto-refund and let processOrphanedPaymentsSla cron handle.
                console.warn(`[ORPHANED-PAYMENT][REFUND][SKIPPED] unauthenticated request — cron will reconcile paymentId=${paymentId}`);
                try { Sentry.captureMessage('orphan-payment auto-refund skipped (no auth user)', { level: 'warning', extra: { paymentId, requestedAmount } }); } catch {}
            } else if (paymentId && requestedAmount > 0) {
                try {
                    // Ownership check: paymentId must either belong to an order
                    // owned by this user, OR have no existing order (truly orphan).
                    const existingForPayment = await prisma.order.findFirst({
                        where: { metadata: { path: ['razorpayPaymentId'], equals: paymentId } },
                        select: { userId: true },
                    });
                    if (existingForPayment && existingForPayment.userId !== user.id) {
                        console.error(`[ORPHANED-PAYMENT][REFUND][REFUSED] paymentId=${paymentId} belongs to user ${existingForPayment.userId} not ${user.id}`);
                        try {
                            Sentry.captureMessage('orphan-refund auth gap — paymentId belongs to another user, refused', {
                                level: 'warning',
                                extra: { paymentId, claimUserId: user.id, actualUserId: existingForPayment.userId },
                            });
                        } catch {}
                    } else {
                        // Cap amount at Razorpay-fetched captured value (never trust body.totalAmount).
                        let capturedAmountInr: number | null = null;
                        try {
                            if (razorpayInstance) {
                                const rzpPayment: any = await razorpayInstance.payments.fetch(paymentId);
                                const amountPaise = Number(rzpPayment?.amount ?? 0);
                                if (amountPaise > 0) capturedAmountInr = Math.round(amountPaise / 100);
                            }
                        } catch (fetchErr: any) {
                            console.warn(`[ORPHANED-PAYMENT][REFUND] could not fetch Razorpay payment ${paymentId}: ${fetchErr?.message || fetchErr}`);
                        }
                        const refundAmount = capturedAmountInr !== null
                            ? Math.min(capturedAmountInr, requestedAmount)
                            : requestedAmount;
                        if (refundAmount > 0) {
                            await processRazorpayRefund({ razorpayPaymentId: paymentId }, refundAmount);
                            console.log(`[ORPHANED-PAYMENT][REFUND] Initiated refund for paymentId=${paymentId} amount=₹${refundAmount} (captured=${capturedAmountInr ?? 'unknown'})`);
                        }
                    }
                } catch (refundErr: any) {
                    console.error('[ORPHANED-PAYMENT][REFUND][FAILED]', refundErr?.message || refundErr);
                    try { Sentry.captureException(refundErr, { extra: { paymentId, amount: requestedAmount, area: 'orphaned-payment-refund' } }); } catch {}
                }
            }
        }

        res.status(isStock ? 409 : 500).json({
            error: isStock ? 'OUT_OF_STOCK' : 'ORDER_CREATE_FAILED',
            message: wasPaid
                // Charged but no order → never tell them to "try again & pay"; reassure + reconcile.
                ? "Your payment went through, but we couldn't place the order. Your money is safe — we're reconciling it and you'll be refunded automatically if it can't be completed. Our team has been alerted."
                : isStock
                    ? 'One of your items just went out of stock. Please remove it and try again.'
                    : "We couldn't place your order just now. Please try again.",
            // Non-stock failures are transient + idempotent → safe to auto-retry (Layer 2 makes
            // the FK cause impossible, so a retry succeeds). Stock won't resolve on retry.
            retryable: !isStock,
        });
    }
});
// 2026-06-15: Server-side minimum-order floor. The consumer cart greys out
// checkout below the admin-configured minimum (Global Config → platform_settings),
// but that gate is client-side and bypassable. POST /order-requests is the FIRST
// server step (pre-payment), so enforcing here makes the minimum un-bypassable
// without ever orphaning a payment. Cached 60s to avoid a DB read per order.
let _minOrderCache = { value: 0, at: 0 };
async function getMinOrderValueInr(): Promise<number> {
    const now = Date.now();
    if (now - _minOrderCache.at < 60_000) return _minOrderCache.value;
    try {
        const rows: any[] = await prisma.$queryRawUnsafe(
            `SELECT value FROM public.platform_settings WHERE key = 'min_order_value'`
        );
        const v = rows.length ? Number(rows[0].value) : 0;
        _minOrderCache = { value: Number.isFinite(v) && v > 0 ? v : 0, at: now };
        return _minOrderCache.value;
    } catch {
        return _minOrderCache.value;
    }
}

// Create Order Requests (from Consumer App) with Merchant Notification
app.post('/order-requests', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '');
        if (!token) {
            console.warn('[POST /order-requests] 401 — No auth token provided');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            console.warn('[POST /order-requests] 401 — Invalid token:', authError?.message || 'no user');
            return res.status(401).json({ error: 'Invalid token' });
        }

        const { requests } = req.body;
        if (!Array.isArray(requests) || requests.length === 0) {
            console.warn(`[POST /order-requests] 400 — Missing/empty requests array | user=${user.id}`);
            return res.status(400).json({ error: 'Missing or empty requests array' });
        }

        // ── H-3 solid fix (2026-06-23): reject the whole request if ANY item is malformed.
        // Prior behaviour silently filtered out items lacking `id` via `.filter(Boolean)`,
        // which let unknown/malformed cart items flow past trust-sensitive gates (Category
        // Status Gate, downstream order creation). Fail-closed at the front door so every
        // gate downstream can trust that every item has a usable id.
        for (let ri = 0; ri < requests.length; ri++) {
            const r: any = requests[ri];
            if (!Array.isArray(r?.items) || r.items.length === 0) {
                console.warn(`[POST /order-requests] 400 — Request ${ri} has empty/missing items | user=${user.id}`);
                return res.status(400).json({ error: 'INVALID_ORDER_REQUEST', message: `Request ${ri} has no items.` });
            }
            for (let ii = 0; ii < r.items.length; ii++) {
                const it: any = r.items[ii];
                if (!it || typeof it.id !== 'string' || it.id.length === 0) {
                    console.warn(`[POST /order-requests] 400 — Item ${ri}.${ii} missing id | user=${user.id}`);
                    return res.status(400).json({
                        error: 'INVALID_ORDER_ITEM',
                        message: `Item ${ri}.${ii} is missing a product id. Please remove the affected item and retry.`,
                    });
                }
            }
        }

        // ── Minimum-order floor (server-side, un-bypassable mirror of the cart gate) ──
        // requests[] is the whole cart split per store, so the sum of subtotals
        // equals the cart subtotal the consumer cart checks before checkout. This
        // runs PRE-payment, so a rejection never orphans a Razorpay charge.
        const minOrderInr = await getMinOrderValueInr();
        if (minOrderInr > 0) {
            const cartSubtotal = requests.reduce((sum: number, r: any) => sum + (Number(r?.subtotal) || 0), 0);
            if (cartSubtotal < minOrderInr) {
                console.warn(`[POST /order-requests] 400 — Below minimum order | cart=₹${cartSubtotal} min=₹${minOrderInr} user=${user.id}`);
                return res.status(400).json({
                    error: 'BELOW_MINIMUM_ORDER',
                    message: `Minimum order value is ₹${minOrderInr}. Your cart total is ₹${Math.round(cartSubtotal)}.`,
                });
            }
        }

        // ── Store Status Gate: reject requests for offline/closed branches ──
        for (const reqRow of requests) {
            const branch = await prisma.merchantBranch.findUnique({
                where: { id: reqRow.branch_id },
                select: { isActive: true }
            });
            if (branch && !branch.isActive) {
                console.warn(`[POST /order-requests] 403 — Store offline | branch=${reqRow.branch_id} store="${reqRow.store_name}" user=${user.id}`);
                return res.status(403).json({
                    error: 'STORE_OFFLINE',
                    message: `${reqRow.store_name || 'This store'} is currently offline and not accepting orders.`
                });
            }
        }

        // ── Category Status Gate: reject items whose vertical/subcategory an admin has
        // disabled (category-visibility feature, Task 7a). RLS hides these from customers,
        // but service_role here BYPASSES RLS, so a stale in-flight cart — or an older app
        // build that never got the consumer prune — could otherwise slip one through. This
        // is the airtight, OTA-independent backstop. Visibility logic mirrors the RESTRICTIVE
        // RLS exactly. Pre-transaction + pre-payment, so a rejection never orphans a charge.
        // H-3: front-door validation above guarantees every item.id is a non-empty string.
        // No silent filtering — every product id must resolve, or the gate has failed.
        const reqProductIds = [...new Set(
            requests.flatMap((r: any) => r.items.map((it: any) => String(it.id))),
        )] as string[];
        if (reqProductIds.length > 0) {
            const prods = await prisma.product.findMany({
                where: { id: { in: reqProductIds } },
                select: {
                    id: true, name: true, vertical_id: true, category_id: true,
                    Vertical: { select: { is_active: true } },
                    Tier2Category: { select: { active: true } },
                },
            });
            // H-3: every requested id MUST resolve to a real Product. Prisma's `in` silently
            // returns fewer rows for unknown ids — same fail-open class as the prior `.filter(Boolean)`.
            // Reject unknown ids before they can flow into the order transaction.
            if (prods.length !== reqProductIds.length) {
                const foundIds = new Set(prods.map((p) => p.id));
                const missing = reqProductIds.filter((id) => !foundIds.has(id));
                console.warn(`[POST /order-requests] 400 — Unknown product ids | missing=${missing.join(',')} user=${user.id}`);
                return res.status(400).json({
                    error: 'UNKNOWN_PRODUCT',
                    message: `Some items reference products that no longer exist. Please refresh your cart.`,
                    offenders: missing,
                });
            }
            const isVisible = (p: any) =>
                (p.vertical_id == null || p.Vertical?.is_active === true) &&
                (p.category_id == null || p.Tier2Category?.active === true);
            const disabled = prods.filter((p) => !isVisible(p));
            if (disabled.length > 0) {
                console.warn(`[POST /order-requests] 403 — Category disabled | products=${disabled.map((p) => p.id).join(',')} user=${user.id}`);
                return res.status(403).json({
                    error: 'CATEGORY_UNAVAILABLE',
                    message: `Some items are no longer available: ${disabled.map((p) => p.name).join(', ')}. Please remove them from your cart and try again.`,
                    offenders: disabled.map((p) => p.id),
                });
            }
        }

        // Execute sequentially in a transaction to ensure either all succeed or all fail
        const notificationsToDispatch: any[] = [];
        const createdRequests = await prisma.$transaction(async (tx) => {
            const results = [];
            
            for (const reqRow of requests) {
                // 1. Fetch customer name for the notification
                const profile = await tx.profile.findUnique({
                    where: { id: user.id },
                    select: { fullName: true }
                });
                const customerName = profile?.fullName || 'Guest';

                // Compute expires_at server-side to prevent client clock drift
                const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 minutes from now

                // Parse the human-readable arrival_time into an absolute UTC timestamp for cron-based reminders.
                // Returns null if format is unrecognized; that's fine — the order just won't get reminders.
                const slotTimeAt = parseArrivalTime(reqRow.arrival_time, new Date());

                // 2. Insert the order request
                const created = await tx.order_requests.create({
                    data: {
                        consumer_user_id: user.id, // Always trust verified user
                        store_id: reqRow.store_id,
                        branch_id: reqRow.branch_id,
                        store_name: reqRow.store_name,
                        items: reqRow.items, // Prisma correctly converts JS Array to Postgres JSON
                        subtotal: reqRow.subtotal,
                        status: reqRow.status || 'PENDING',
                        arrival_time: reqRow.arrival_time || null,
                        order_type: reqRow.order_type || null,
                        guests_count: reqRow.guests_count || null,
                        expires_at: expiresAt,
                        slot_time_at: slotTimeAt
                        // Do not trust client's created_at/updated_at
                    }
                });

                // 3. Calculate item count for notification
                const itemsList = Array.isArray(reqRow.items) ? reqRow.items : [];
                // Fix 1: Use nullish coalescing to avoid masking real 0-quantity bugs
                const totalItems = itemsList.reduce((sum: number, item: any) => sum + (item.quantity ?? 0), 0);

                // 4. Dispatch notification specific to this branch
                notificationsToDispatch.push({
                    storeId: reqRow.branch_id, // Independent resolution per row
                    title: 'New Order Request',
                    body: `${customerName} · ₹${reqRow.subtotal} · ${totalItems} item${totalItems !== 1 ? 's' : ''} · 2 min to accept`,
                    type: 'NEW_ORDER_REQUEST',
                    referenceId: created.id,
                    link: '/(main)/orders',
                    metadata: {
                        customerName,
                        subtotal: reqRow.subtotal,
                        itemCount: totalItems,
                        orderType: reqRow.order_type || null,
                    },
                });

                results.push(created);
            }
            
            return results;
        });

        // Dispatch all collected notifications safely outside the transaction
        for (const notif of notificationsToDispatch) {
            notificationService.sendMerchantNotification(notif)
                .catch(e => {
                    console.error('[POST /order-requests] Notif failed:', e);
                    try { Sentry.captureException(e, { extra: { storeId: notif.storeId, type: notif.type, area: 'order-requests.notify' } }); } catch {}
                });
        }

        res.status(201).json(createdRequests);
        } catch (error: any) {
        // Round-7 fix: customer placing an order needs to see the real reason (store closed, item out of stock, Prisma FK error, etc.).
        return handleApiError(res, error, { area: 'order-requests', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: error?.message || 'Failed to create order requests' });
    }
});

// Update Order Request Status (Cancel/Reject)
app.patch('/order-requests/:id/status', async (req, res) => {
    try {
        // Option A patch #1A (2026-06-08): backend requireUser hardening.
        // Previously any anonymous caller could ACCEPT/REJECT/CANCEL any
        // order_request. Authorization (verify user owns consumer_user_id or
        // branch.merchant_id) is a separate follow-up — harness Task #36.
        //
        // Phase 2J hot-fix (2026-06-09): soft-auth gate. Pre-OTA consumer-app
        // installs still use plain fetch() with no Authorization header and
        // would 401 on every cancel. Until REQUIRE_ORDERS_AUTH=true (post-OTA),
        // accept unauth requests and skip the #1C ownership checks for them.
        // Authenticated callers still go through the full #1C check below.
        const auth = await softRequireUser(req, res);
        if (!auth) return;
        const user = auth.user;

        const { id } = req.params;
        const { status, reason } = req.body;

        const allowedStatuses = ['CANCELLED', 'REJECTED', 'ACCEPTED'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
        }

        // Option A patch #1C (2026-06-08): backend authorization check.
        // Verify the caller has the right role for the requested transition:
        //   - CANCELLED can only be triggered by the order's consumer
        //   - ACCEPTED / REJECTED can only be triggered by the merchant who
        //     owns the branch the request was sent to
        // Returns 404 if the request doesn't exist, 403 on role mismatch.
        const existing = await prisma.order_requests.findUnique({
            where: { id },
            select: { consumer_user_id: true, branch_id: true }
        });
        if (!existing) {
            return res.status(404).json({ error: 'Order request not found' });
        }
        // Phase 2J: ownership checks only enforced when authenticated. Soft-auth
        // pre-OTA clients (user === null) skip — pre-Option-A baseline.
        if (user) {
            if (status === 'CANCELLED') {
                if (user.id !== existing.consumer_user_id) {
                    return res.status(403).json({ error: 'Only the order owner can cancel this request' });
                }
            } else {
                // Phase 2K hot-fix (2026-06-09): ACCEPTED or REJECTED — must be
                // able to manage this branch. Previously this was owner-only
                // (user.id === branch.merchantId) which 403'd non-owner staff
                // (8 store_staff + 15 phone-managers verified on prod). The
                // userCanManageBranch helper allows owner OR store_staff OR
                // phone-matched manager — mirrors the merchant-app's actual
                // login paths (StoreContext.tsx).
                const canManage = await userCanManageBranch(user.id, existing.branch_id);
                if (!canManage) {
                    return res.status(403).json({ error: 'Only the branch merchant, manager, or staff can accept or reject this request' });
                }
            }
        }

        const updated = await prisma.order_requests.update({
            where: { id },
            data: {
                status,
                rejection_reason: reason || null,
                updated_at: new Date()
            }
        });

        // Notify merchant if customer cancelled
        if (status === 'CANCELLED') {
            notificationService.sendMerchantNotification({
                storeId: updated.branch_id,
                title: 'Order Cancelled',
                body: `Customer cancelled their order request (₹${updated.subtotal})`,
                type: 'ORDER_CANCELLED',
                referenceId: updated.id,
                link: '/(main)/orders',
                metadata: {
                    subtotal: updated.subtotal,
                    reason: reason || null,
                },
            }).catch(e => console.error('[PATCH /order-requests] Notif failed:', e));
        }

        // Customer-side notification:
        // - ACCEPTED: merchant accepted the request (event #1)
        // - REJECTED: merchant declined the request (subset of event #11)
        // - CANCELLED: customer's own action — skip (no need to notify them of their own cancel)
        const requestCustomerUserId = (updated as any).consumer_user_id;
        if (requestCustomerUserId) {
            if (status === 'ACCEPTED') {
                notificationService.sendConsumerNotification({
                    userId: requestCustomerUserId,
                    title: 'Order accepted 🎉',
                    body: `Your order has been accepted. Tap to complete payment.`,
                    type: 'ORDER_CONFIRMED',
                    referenceId: updated.id,
                    link: `/orders/${updated.id}`,
                    storeId: updated.branch_id,
                    metadata: {
                        subtotal: updated.subtotal,
                    },
                }).catch(e => console.error('[PATCH /order-requests] Customer ORDER_CONFIRMED notif failed:', e));
            } else if (status === 'REJECTED') {
                notificationService.sendConsumerNotification({
                    userId: requestCustomerUserId,
                    title: 'Order request declined',
                    body: reason
                        ? `The merchant declined your request. Reason: ${reason}`
                        : `The merchant declined your request.`,
                    type: 'ORDER_CANCELLED',
                    referenceId: updated.id,
                    link: `/orders/${updated.id}`,
                    storeId: updated.branch_id,
                    metadata: {
                        subtotal: updated.subtotal,
                        reason: reason || null,
                    },
                }).catch(e => console.error('[PATCH /order-requests] Customer ORDER_CANCELLED (REJECTED) notif failed:', e));
            }
        }

        res.json(updated);
        } catch (error: any) {
        // Round-7 fix: merchant rejecting/accepting an order request needs to see the real cause if it fails.
        return handleApiError(res, error, { area: 'order-requests.status', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: error?.message || 'Failed to update order request' });
    }
});

// Update Order Status (Merchant Side)
app.patch('/orders/:id/status', async (req, res) => {
    // Round-5 hardening (forlater #12): auth was completely absent. Any
    // caller could flip any order to any status, doubling stock restoration
    // on CANCELLED retries and bypassing the WS2 lifecycle endpoints.
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // Accept reason

        // 1. Fetch current order to validate transition
        const currentOrder = await (prisma as any).order.findUnique({
            where: { id },
            include: { user: true, items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } }, store: { include: { manager: true } } }
        });

        if (!currentOrder) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const canManage = await userCanManageOrderStore(user.id, currentOrder.storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have merchant access to this order.' });
        }

        // 2. Validate Transitions & Safeguards
        if (['COMPLETED', 'REFUNDED', 'RETURN_APPROVED'].includes(currentOrder.status)) {
            // Allow formatting changes if needed, but generally these states are final regarding cancellation
            if (status === 'CANCELLED') {
                return res.status(400).json({ error: 'Cannot cancel a completed or refunded order.' });
            }
        }

        // Round-5 hardening: idempotency guard on CANCELLED → CANCELLED.
        // Without this, calling this endpoint twice with status='CANCELLED'
        // restores stock a second time (the loop below runs unconditionally
        // on CANCELLED), inflating inventory.
        if (status === 'CANCELLED' && currentOrder.status === 'CANCELLED') {
            return res.status(400).json({ error: 'Order is already cancelled.' });
        }

        // Round-5 hardening (revised round-6 after adversarial review XC1):
        //
        // The merchant rejection path in apps/merchant-app calls this endpoint
        // with status='CANCELLED' to reject paid orders. We MUST allow that —
        // customers cannot reach this endpoint anyway because they can't pass
        // userCanManageOrderStore. So the auth check above is already the
        // gate that keeps customers out of the merchant flow; we don't need
        // a redundant CANCELLED-redirect that would break legitimate
        // merchant rejections.
        //
        // We DO still block WS2-OWNED transitions (RETURN_* / EXCHANGE_* /
        // REFUNDED) because those must go through the dedicated endpoints
        // that emit the right events and update OrderIssue rows.
        if (['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED',
             'EXCHANGE_REQUESTED', 'EXCHANGE_APPROVED', 'EXCHANGE_REJECTED'].includes(status)) {
            return res.status(400).json({
                error: 'Use the WS2 endpoints (POST /orders/:id/return, /exchange, PATCH /orders/:id/issue/:issueId) for return/exchange lifecycle transitions.',
            });
        }
        // Round-6 (audit finding H4): block status='REFUNDED' direct input.
        // Without this, a merchant can lie that an order was refunded without
        // any actual Razorpay refund being issued — finance dashboards drift.
        if (status === 'REFUNDED') {
            return res.status(400).json({
                error: 'Use POST /orders/:id/refund to issue an actual refund.',
            });
        }
        // Round-6 (audit finding H2): drop the now-dead RETURN_APPROVED
        // precondition check — the WS2 block above already rejects
        // RETURN_APPROVED inputs.

        // CRITICAL: Block Manual Completion
        if (status === 'COMPLETED') {
            return res.status(400).json({ error: 'Cannot manually set status to COMPLETED. Use OTP verification endpoint.' });
        }

        const data: any = { status };

        // Save Reason
        if (status === 'CANCELLED' && reason) {
            data.cancelledReason = reason;
        } else if ((status === 'RETURN_APPROVED' || status === 'RETURN_REJECTED') && reason) {
            data.returnReason = reason;
        }

        // Generate 4-digit OTP when moving to READY (REMOVED - OTP must remain stable from checkout)
        // if (status === 'READY') {
        //     data.otp = Math.floor(1000 + Math.random() * 9000).toString();
        // }

        const order = await prisma.order.update({
            where: { id },
            data,
            include: { user: true, items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } }, store: { include: { manager: true } } }
        });

        if (status === 'READY' && (order as any).user?.phone && order.otp) {
            smsService.sendOtp((order as any).user.phone, order.otp).catch(err => console.error('OTP SMS Failed:', err));
        }

        // --- Notification & Stock Restoration on Cancellation ---
        if (status === 'CANCELLED') {
            // Restore Stock
            for (const item of (order as any).items) {
                await prisma.storeProduct.update({
                    where: { id: item.storeProductId },
                    data: { stock: { increment: item.quantity } }
                }).catch((e: any) => console.error('Failed to restore stock', e));
            }
        }

        // Notify Merchant (service resolves recipient internally via storeId)
        const ordStoreId = (order as any).store?.id || (order as any).storeId;

        if (status === 'CANCELLED') {
            await notificationService.sendMerchantNotification({
                storeId: ordStoreId,
                title: 'Order Cancelled',
                body: `Order #${order.orderNumber} was cancelled by the customer.`,
                type: 'CANCELLED',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: order.orderNumber,
                },
            });
        } else if (status === 'RIDER_ARRIVED') {
            await notificationService.sendMerchantNotification({
                storeId: ordStoreId,
                title: 'Rider Waiting',
                body: `Rider is at the store to pickup Order #${order.orderNumber}.`,
                type: 'RIDER_ARRIVED',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: order.orderNumber,
                },
            });
        } else {
            await notificationService.sendMerchantNotification({
                storeId: ordStoreId,
                title: `Order ${status.replace('_', ' ')}`,
                body: `Order #${order.orderNumber} status updated to ${status}`,
                type: 'ORDER_UPDATE',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: order.orderNumber,
                    newStatus: status,
                },
            });
        }

        // Customer-side notification:
        // - CANCELLED: order cancelled at this stage — notify customer (event #11)
        // - READY pickup: order packed, ready for pickup (event #3)
        // - READY dine-in: customer's food/table ready (event #7)
        const orderCustomerUserId = (order as any).userId;
        const ordOrderType = (order as any).order_type;
        if (orderCustomerUserId) {
            if (status === 'CANCELLED') {
                notificationService.sendConsumerNotification({
                    userId: orderCustomerUserId,
                    title: 'Order cancelled',
                    body: reason
                        ? `Order #${order.orderNumber} was cancelled. Reason: ${reason}`
                        : `Order #${order.orderNumber} was cancelled.`,
                    type: 'ORDER_CANCELLED',
                    referenceId: id,
                    link: `/orders/${id}`,
                    storeId: ordStoreId,
                    metadata: {
                        orderNumber: order.orderNumber,
                        reason: reason || null,
                    },
                }).catch(e => console.error('[PATCH /orders/:id/status] Customer ORDER_CANCELLED notif failed:', e));
            } else if (status === 'READY' && ordOrderType === 'pickup') {
                notificationService.sendConsumerNotification({
                    userId: orderCustomerUserId,
                    title: 'Order ready for pickup 🛍️',
                    body: `Order #${order.orderNumber} is packed. Show your OTP to pick it up.`,
                    type: 'ORDER_READY',
                    referenceId: id,
                    link: `/orders/${id}`,
                    storeId: ordStoreId,
                    metadata: {
                        orderNumber: order.orderNumber,
                    },
                }).catch(e => console.error('[PATCH /orders/:id/status] Customer ORDER_READY notif failed:', e));
            } else if (status === 'READY' && ordOrderType === 'dine-in') {
                notificationService.sendConsumerNotification({
                    userId: orderCustomerUserId,
                    title: 'Your table is ready 🍽️',
                    body: `Order #${order.orderNumber} is ready. Please head to the restaurant.`,
                    type: 'DINING_READY',
                    referenceId: id,
                    link: `/orders/${id}`,
                    storeId: ordStoreId,
                    metadata: {
                        orderNumber: order.orderNumber,
                    },
                }).catch(e => console.error('[PATCH /orders/:id/status] Customer DINING_READY notif failed:', e));
            }
        }

        if ((order as any).user?.phone) {
            const smsStatusMap: Record<string, string> = {
                'CONFIRMED': 'Confirmed',
                'PREPARING': 'Being Prepared',
                'READY': 'Ready for Pickup',
                'COMPLETED': 'Completed',
                'CANCELLED': 'Cancelled',
                'RETURN_APPROVED': 'Return Approved',
                'REFUNDED': 'Refund Processed'
            };
            const smsStatus = smsStatusMap[status];

            if (smsStatus) {
                smsService.sendOrderUpdate((order as any).user.phone, id, smsStatus).catch(err => console.error('SMS Failed:', err));
            }
        }

        io.emit('order_updated', order);
        res.json(order);
    } catch (error: any) {
        console.error('Update Status Error:', error);
        // Round-6 (H2): no longer return error.stack — info disclosure
        // (file paths, line numbers, ORM internals). Sentry has the full
        // trace for debugging server-side.
        Sentry.captureException(error, {
            tags: { area: 'ws2.legacyStatus' },
            extra: { orderId: req.params.id, userId: user.id, requestedStatus: req.body?.status },
        });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// Refund Order Endpoint
app.post('/orders/:id/refund', async (req, res) => {
    // Round-5 hardening (forlater #11): auth was completely absent on this
    // endpoint. Any unauthenticated caller could refund any order and wipe
    // its metadata. Now requires (a) a valid user token and (b) merchant
    // access to the order's store.
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { amount, reason } = req.body; // Optional partial refund later

        const order = await prisma.order.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!order) return res.status(404).json({ error: 'Order not found' });

        const canManage = await userCanManageOrderStore(user.id, order.storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have merchant access to this order.' });
        }

        if (!order.isPaid) return res.status(400).json({ error: 'Cannot refund an unpaid order' });
        if (order.status === 'REFUNDED') return res.status(400).json({ error: 'Order already refunded' });
        // Round-5 hardening: block WS2 lifecycle states. The WS2 flows have
        // their own refund handling — going through this legacy endpoint
        // would wipe the WS2 metadata and bypass the issue-tracking flow.
        if (['CANCELLED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURN_REQUESTED',
             'EXCHANGE_APPROVED', 'EXCHANGE_REJECTED', 'EXCHANGE_REQUESTED'].includes(order.status)) {
            return res.status(400).json({
                error: `Order is in ${order.status} — use the WS2 endpoints (cancel / issue PATCH) instead.`,
            });
        }

        // Initialize Razorpay (Safely)
        let razorpayInstance: any = null;
        try {
            const Razorpay = require('razorpay');
            if (process.env.RAZORPAY_KEY_ID) {
                razorpayInstance = new Razorpay({
                    key_id: process.env.RAZORPAY_KEY_ID,
                    key_secret: process.env.RAZORPAY_KEY_SECRET
                });
            } else {
                console.warn('[Refund] No Razorpay keys found in env. Refund will be SIMULATED.');
            }
        } catch (e) {
            console.warn('[Refund] Failed to load Razorpay library. Refund will be SIMULATED.', e);
        }

        // Attempt Refund via Razorpay if possible
        let refundResult: any = null;
        if (razorpayInstance) {
            try {
                // In production, we'd use paymentId. Here we simulate the call mostly.
                // await razorpayInstance.payments.refund(...) 
                console.log(`[Refund] Initiating Razorpay refund for Order #${order.orderNumber}...`);

                // Simulate a real ID since we don't have a paymentId to refund against in this mock DB
                // In a real flow:
                // refundResult = await razorpayInstance.payments.refund(order.paymentId, { amount: amount * 100 });
                refundResult = { id: `rfnd_test_${Date.now()}`, status: 'processed' };

            } catch (rpError: any) {
                console.error('[Refund] Razorpay API failed:', rpError);
                // Depending on policy, we might want to return here. 
                // But for this test phase, we'll proceed to mark as REFUNDED locally so the flow isn't blocked.
            }
        }

        // Update Status to REFUNDED (Local Database)
        // Round-5 hardening: spread existing metadata instead of replacing.
        // Previous behavior wiped razorpayPaymentId, orderRequestId, and any
        // WS2 audit fields. Now we merge — the refund id is added alongside
        // the existing record.
        const refundedOrder = await prisma.order.update({
            where: { id },
            data: {
                status: 'REFUNDED',
                isPaid: false,
                returnReason: reason || 'Refund processed',
                metadata: refundResult
                    ? {
                        ...(typeof order.metadata === 'object' && order.metadata !== null ? order.metadata : {}),
                        razorpayRefundId: refundResult.id,
                        legacyRefundAt: new Date().toISOString(),
                    } as any
                    : (order.metadata as any) ?? undefined,
            },
            include: { user: true }
        });

        // Phase 7G (2026-06-11, audit fix): this endpoint can flip a settled
        // COMPLETED order to REFUNDED — the ledger must claw the payout back
        // on the next cycle, same as the cancel/issue/SLA refund paths.
        const clawAmount = Number(amount) > 0 ? Number(amount) : (Number(order.totalAmount) || 0);
        try { await detectClawback(prisma, id, clawAmount, `legacy refund ${refundResult?.id ?? 'recorded'}`); } catch (e) { console.error('[7D] clawback detect (legacy refund) failed:', e); }

        if (refundedOrder.user?.phone) {
            smsService.sendOrderUpdate(refundedOrder.user.phone, id, 'Refund Processed').catch(err => console.error('SMS Failed:', err));
        }

        io.emit('order_updated', refundedOrder);

        // IMPORTANT: Always return JSON
        res.json({ success: true, message: 'Refund processed successfully', order: refundedOrder });

    } catch (error: any) {
        console.error('Refund Error:', error);
        // Round-6 (cross-cutting medium): Sentry parity with WS2 endpoints.
        Sentry.captureException(error, {
            tags: { area: 'ws2.legacyRefund' },
            extra: { orderId: req.params.id, userId: user.id },
        });
        // Ensure JSON response even on crash
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to process refund', details: error.message });
    }
});

// Payment Webhook (Simulation)
app.post('/webhooks/payment', async (req, res) => {
    try {
        const { orderId, status } = req.body;
        if (status === 'success') {
            const order = await prisma.order.update({
                where: { id: orderId },
                data: { isPaid: true },
                include: { user: true, items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } } }
            });
            io.emit('order_updated', order);
            return res.json({ message: 'Payment captured' });
        }
        res.status(400).json({ error: 'Payment failed' });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'webhooks.payment', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Webhook error' });
    }
});

// Verify OTP for Completion
app.post('/orders/:id/verify-otp', async (req, res) => {
    // Round-6 hardening (XC3): previously NO auth + NO CAS + NO state guard.
    // Anyone with a leaked OTP could mark any order COMPLETED, including a
    // CANCELLED / REFUNDED / RETURN_APPROVED order — breaking every WS2
    // invariant. Now requires merchant store auth + atomic compare-and-set
    // limited to orders currently in READY (the only state where OTP
    // verification is legitimate).
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { otp } = req.body;

        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const canManage = await userCanManageOrderStore(user.id, order.storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have merchant access to this order.' });
        }

        if (order.otp !== otp) {
            return res.status(400).json({ error: 'Invalid PIN' });
        }

        // Atomic compare-and-set: only flip if still READY.
        const flipped = await prisma.order.updateMany({
            where: { id, status: 'READY', otp },
            data: { status: 'COMPLETED' },
        });
        if (flipped.count === 0) {
            return res.status(409).json({
                error: 'Order is not in READY state (already completed, cancelled, or moved elsewhere). Refresh and try again.',
            });
        }

        const updatedOrder = await prisma.order.findUnique({
            where: { id },
            include: { user: true, items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } } }
        });
        if (!updatedOrder) {
            return res.status(500).json({ error: 'Verify-OTP committed but order vanished — please refresh.' });
        }

        io.emit('order_updated', updatedOrder);

        // Dispatch COMPLETED notification to the merchant
        if ((updatedOrder as any).storeId) {
            await notificationService.sendMerchantNotification({
                storeId: (updatedOrder as any).storeId,
                title: 'Order Completed',
                body: `Order #${updatedOrder.orderNumber} has been picked up and verified.`,
                type: 'COMPLETED',
                referenceId: id,
                link: '/(main)/orders',
                metadata: {
                    orderNumber: updatedOrder.orderNumber,
                },
            });
        }

        // Customer-side notification: order picked up (event #6 in user's list)
        const otpVerifyCustomerUserId = (updatedOrder as any).userId;
        if (otpVerifyCustomerUserId) {
            notificationService.sendConsumerNotification({
                userId: otpVerifyCustomerUserId,
                title: 'Enjoy your order! 🎉',
                body: `Order #${updatedOrder.orderNumber} has been picked up. Hope you love it!`,
                type: 'ORDER_COMPLETED',
                referenceId: id,
                link: `/orders/${id}`,
                storeId: (updatedOrder as any).storeId,
                metadata: {
                    orderNumber: updatedOrder.orderNumber,
                },
            }).catch(e => console.error('[OTP verify] Customer ORDER_COMPLETED notif failed:', e));
        }

        res.json({ success: true, order: updatedOrder });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'orders.verify-otp', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'OTP verification failed' });
    }
});

// --- Auto-Reject logic ---

// =====================================================================
// WS2.C (2026-06-05) — Order lifecycle endpoints.
// Cancel / Reschedule / Return / Exchange + merchant Issue PATCH.
// All thin wrappers around the WS2.B rules engine + DB writes +
// fire-and-forget notifications.
// =====================================================================

// Note: orderLifecycleRules is imported at the top of the file as a typed
// namespace import so TypeScript can catch input-shape mismatches at compile
// time (this avoids regressions like the 'dine-in'/'dining' enum slip).

/**
 * Check the auth'd user has merchant-side access to an order's store.
 * Returns true if user is the store's managerId, or has a store_staff row.
 */
async function userCanManageOrderStore(userId: string, storeId: string): Promise<boolean> {
    const [store, staffRow] = await Promise.all([
        prisma.store.findUnique({ where: { id: storeId }, select: { managerId: true } }),
        prisma.storeStaff.findFirst({ where: { storeId, OR: [{ user_id: userId }, { authUserId: userId }] }, select: { id: true } }),
    ]);
    if (store?.managerId === userId) return true;
    if (staffRow) return true;
    return false;
}

/**
 * Phase 2K (hot-fix 2026-06-09) — RBAC for PATCH /order-requests/:id/status
 * ACCEPTED/REJECTED transitions.
 *
 * Adversarial pre-merge review (PR #1) found that Option A patch #1C's bare
 * `user.id === branch.merchantId` check was owner-only, which would 403 the
 * non-owner merchant users on prod (verified via scripts/check_staff_users.ts:
 * 8 store_staff + 15 phone-managers) the moment merchant-app OTAs commit 2.
 *
 * Allows the call if the user is:
 *   (a) the branch's owner (merchant_branches.merchant_id)
 *   (b) a phone-matched branch manager (user.phone === merchant_branches.phone)
 *   (c) a store_staff row whose user_id or auth_user_id matches the user,
 *       scoped to this branch (store_staff.store_id = branch_id in PAS)
 *
 * Mirrors the spirit of userCanManageOrderStore but for the order_request /
 * branch context (different table — merchant_branches vs Store).
 */
async function userCanManageBranch(userId: string, branchId: string): Promise<boolean> {
    const branch = await prisma.merchantBranch.findUnique({
        where: { id: branchId },
        select: { merchantId: true, phone: true },
    });
    if (!branch) return false;
    // (a) Owner
    if (branch.merchantId && branch.merchantId === userId) return true;
    // (b) Phone-matched manager — only check if the branch has a phone configured
    if (branch.phone) {
        const u = await prisma.user.findUnique({
            where: { id: userId },
            select: { phone: true },
        });
        if (u?.phone && u.phone === branch.phone) return true;
    }
    // (c) Staff — store_staff.store_id is the branch_id in PAS
    const staffRow = await prisma.storeStaff.findFirst({
        where: {
            storeId: branchId,
            OR: [{ user_id: userId }, { authUserId: userId }],
        },
        select: { id: true },
    });
    if (staffRow) return true;
    return false;
}

/**
 * Phase 8 (2026-06-11) — "can this user manage this MERCHANT (parent store)?"
 * Used for branch CREATE (the branch row doesn't exist yet, so the branch-level
 * userCanManageBranch cannot apply). The canonical owner link is
 * Store.managerId (set at signup to the owner's auth UUID — verified populated
 * for every store on prod); store_staff and a last-10-digit phone match cover
 * provisioned managers and any owner predating the managerId backfill.
 */
async function userCanManageMerchant(userId: string, merchantId: string): Promise<boolean> {
    if (!merchantId) return false;
    // (a) Owner via Store.managerId (canonical).
    const store = await prisma.store.findUnique({ where: { id: merchantId }, select: { managerId: true } });
    if (store?.managerId === userId) return true;
    // (b) store_staff scoped to the merchant/store id.
    const staffRow = await prisma.storeStaff.findFirst({
        where: { storeId: merchantId, OR: [{ user_id: userId }, { authUserId: userId }] },
        select: { id: true },
    });
    if (staffRow) return true;
    // (c) Phone-matched owner (last-10-digit, tolerant of the 91-prefix drift).
    const [merchant, u] = await Promise.all([
        prisma.merchant.findUnique({ where: { id: merchantId }, select: { phone: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { phone: true } }),
    ]);
    if (merchant?.phone && u?.phone) {
        const a = u.phone.replace(/\D/g, '').slice(-10);
        const b = merchant.phone.replace(/\D/g, '').slice(-10);
        if (a.length === 10 && a === b) return true;
    }
    return false;
}

/**
 * Complete branch-management authority for an EXISTING branch: branch-level
 * (owner-by-id / phone-manager / store_staff for the branch) OR
 * parent-merchant-level (owner / staff of the parent store). Covers every real
 * case — owner editing the main or an additional branch, a provisioned branch
 * manager, or a phone-only owner.
 */
async function userCanManageBranchFull(userId: string, branchId: string): Promise<boolean> {
    if (await userCanManageBranch(userId, branchId)) return true;
    const branch = await prisma.merchantBranch.findUnique({ where: { id: branchId }, select: { merchantId: true } });
    if (branch?.merchantId && (await userCanManageMerchant(userId, branch.merchantId))) return true;
    return false;
}

/**
 * Return a branch row in the exact snake_case shape supabase-js select('*')
 * produces, so the merchant app's Branch interface + optimistic list update
 * consume the API response with zero shape drift.
 */
async function branchRow(id: string): Promise<any> {
    const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "public"."merchant_branches" WHERE "id" = ${id} LIMIT 1;`;
    return rows[0] ?? null;
}

/**
 * Lightweight SUPER_ADMIN check on an already-authenticated user id (mirrors
 * requireAdmin's rule). Lets the branch endpoints accept platform admins —
 * the admin web's merchant-editing dialog manages any merchant's branches.
 */
async function isPlatformAdmin(userId: string): Promise<boolean> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true, role: true } });
    return !!u && (u.isAdmin === true || u.role === 'SUPER_ADMIN');
}

/**
 * Attempt a Razorpay refund using the payment_id stored in order.metadata.
 * Returns { razorpayRefundId, simulated } — if Razorpay isn't configured or
 * the order has no paymentId on record, falls back to a stub refund id
 * matching the existing /orders/:id/refund behavior. Server-side state
 * change happens regardless; the failure mode is "no money moved in
 * Razorpay" which ops can reconcile manually from the dashboard.
 */
async function processRazorpayRefund(
    orderMetadata: any,
    amountInr: number,
): Promise<{ razorpayRefundId: string; simulated: boolean }> {
    // POST /orders persists Razorpay's payment id at metadata.razorpayPaymentId
    // (camelCase) — see index.ts ~line 2414 and InvoiceModal.tsx line 64. This
    // helper previously looked for `paymentId` / `razorpay_payment_id` and
    // therefore ALWAYS fell through to the simulated path. Fixed 2026-06-05.
    const paymentId = orderMetadata?.razorpayPaymentId;
    if (!razorpayInstance || !paymentId) {
        const stubId = `rfnd_sim_${Date.now()}`;
        console.warn('[refund] Razorpay missing or no paymentId — simulating refund id:', stubId);
        return { razorpayRefundId: stubId, simulated: true };
    }
    try {
        const refund = await razorpayInstance.payments.refund(paymentId, {
            amount: Math.round(amountInr) * 100, // paise
        });
        return { razorpayRefundId: refund.id as string, simulated: false };
    } catch (err: any) {
        console.error('[refund] Razorpay refund failed for paymentId', paymentId, err?.message || err);
        const stubId = `rfnd_err_${Date.now()}`;
        return { razorpayRefundId: stubId, simulated: true };
    }
}

/**
 * POST /orders/:id/cancel — customer cancels an order.
 * Body: { reason?: string }
 */

/**
 * GET /orders/issues/inbox — merchant inbox of return/exchange requests.
 * Lists OrderIssue rows for stores the auth'd user manages (Store.managerId
 * OR store_staff). Query params: status, type, limit.
 */
app.get('/orders/issues/inbox', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const statusParam = String(req.query.status || 'PENDING').toUpperCase();
        // Round-6 inbox fix: previously `.toLowerCase()` here broke the default
        // 'ALL' sentinel because the validTypes check below uses uppercase
        // 'ALL'. The merchant app's "All" tab filter was returning 400 on
        // every load since WS2.F shipped. Keep the original casing —
        // type values are 'return' / 'exchange' (lowercase) and 'ALL' is
        // the uppercase sentinel.
        const typeParam = String(req.query.type || 'ALL').trim();
        const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'AUTO_APPROVED', 'ALL'];
        if (!validStatuses.includes(statusParam)) {
            return res.status(400).json({ error: `status must be one of ${validStatuses.join(', ')}` });
        }
        const validTypes = ['return', 'exchange', 'ALL'];
        if (!validTypes.includes(typeParam)) {
            return res.status(400).json({ error: `type must be one of ${validTypes.join(', ')}` });
        }
        const [managedStores, staffStoreRows] = await Promise.all([
            prisma.store.findMany({ where: { managerId: user.id }, select: { id: true } }),
            prisma.storeStaff.findMany({
                where: { OR: [{ user_id: user.id }, { authUserId: user.id }] },
                select: { storeId: true },
            }),
        ]);
        const storeIdSet = new Set<string>([
            ...managedStores.map(s => s.id),
            ...staffStoreRows.map(s => s.storeId),
        ]);
        if (storeIdSet.size === 0) return res.json([]);

        const where: any = { order: { storeId: { in: Array.from(storeIdSet) } } };
        if (statusParam !== 'ALL') where.status = statusParam;
        if (typeParam !== 'ALL') where.type = typeParam;

        const issues = await prisma.orderIssue.findMany({
            where,
            orderBy: [{ status: 'asc' }, { slaDueAt: 'asc' }],
            take: limit,
            include: {
                order: {
                    select: {
                        id: true, orderNumber: true, status: true, totalAmount: true,
                        customer_name: true, customer_phone: true, store_name: true,
                        order_type: true, createdAt: true, isPaid: true,
                        user: { select: { name: true, phone: true, email: true } },
                        items: {
                            select: {
                                id: true, quantity: true, price: true, product_name: true,
                                storeProduct: { select: { product: { select: { name: true, returnable: true } } } },
                            },
                        },
                    },
                },
            },
        });
        return res.json(issues);
    } catch (err: any) {
        console.error('[issues inbox] error:', err);
        Sentry.captureException(err, { tags: { area: 'ws2.inbox' }, extra: { userId: user.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to list issues.', details: err?.message });
    }
});

app.post('/orders/:id/cancel', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { reason } = req.body || {};

        // Items pulled in so we can restore stock atomically with the
        // status flip (Bug 5 fix — the legacy PATCH /orders/:id/status
        // endpoint restored stock on CANCELLED, this one was silently
        // skipping it).
        const order = await prisma.order.findUnique({
            where: { id },
            include: { user: true, items: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        if (order.userId !== user.id) {
            return res.status(403).json({ error: 'You do not have permission to cancel this order.' });
        }

        // DB stores order_type='dine-in' (see DiningCheckoutScreen + InvoiceModal),
        // but the rules engine's OrderTypeKind uses 'dining'. Normalize here to
        // keep the rules vocabulary stable. Fixed 2026-06-05 (Bug A).
        const rawOrderType = (order as any).order_type;
        const normalizedOrderType = rawOrderType === 'dine-in' ? 'dining' : (rawOrderType || 'pickup');
        const decision = orderLifecycleRules.evaluateCancel({
            orderType: normalizedOrderType,
            orderStatus: order.status,
            orderTotalInr: order.totalAmount,
            isPaid: order.isPaid,
            createdAt: order.createdAt,
            slotTimeAt: (order as any).slot_time_at || null,
            requestedAt: new Date(),
        });
        if (!decision.allowed) {
            return res.status(400).json({ error: decision.reason });
        }

        // FLIP STATUS FIRST inside a transaction (Bug 1 fix).
        //
        // Previously the Razorpay refund was called BEFORE the status update.
        // If the refund succeeded but the order.update transaction then failed
        // (DB blip, contention, anything transient), the order would still be
        // PENDING/CONFIRMED — so the customer could tap Cancel again and the
        // rules engine would approve it, refunding the same payment a second
        // time. By committing CANCELLED first, any retry is blocked by the
        // rules engine's terminal-status check.
        //
        // Stock restoration runs in the same transaction so inventory and
        // status are atomic — neither without the other.
        const cancelledAt = new Date();
        let updated: any;
        try {
            updated = await prisma.$transaction(async (tx) => {
                // ATOMIC COMPARE-AND-SET on order.status (round-5 hardening).
                //
                // Mirror of the N2 fix: re-check the order is still in a
                // cancellable state INSIDE the transaction. Without this,
                // two parallel POST /orders/:id/cancel calls (double-tap,
                // two tabs, client retry) can both pass the rules engine
                // precheck and both commit — double stock restoration,
                // double consumer notif, and a cross-fix race with cron
                // auto-approve flipping the order to RETURN_APPROVED in
                // between.
                //
                // Allowed pre-states match rules.evaluateCancel's accept
                // set: {PENDING, CONFIRMED, PREPARING}. READY is blocked
                // by the rules engine outside this tx; we just enforce
                // the post-conditions atomically here.
                const flipped = await tx.order.updateMany({
                    where: { id, status: { in: ['PENDING', 'CONFIRMED', 'PREPARING'] } },
                    data: {
                        status: 'CANCELLED',
                        cancelledReason: reason ? String(reason).slice(0, 500) : decision.reason,
                        metadata: {
                            ...(typeof order.metadata === 'object' && order.metadata !== null ? order.metadata : {}),
                            cancellationFeeInr: decision.feeInr,
                            refundInr: decision.refundInr,
                            autoRefundEligible: decision.autoRefundEligible,
                            cancelledAt: cancelledAt.toISOString(),
                        } as any,
                    },
                });
                if (flipped.count === 0) {
                    throw new Error('CONCURRENT_DECISION');
                }

                // Stock restoration — every item back to its storeProduct.
                // Inner .catch removed (round-5 hardening): swallowing per-item
                // errors leaves the underlying Postgres tx in an aborted state,
                // which then breaks the subsequent couponRedemption + order
                // operations with a confusing 'transaction aborted' message
                // instead of the original cause. Let it bubble so the outer
                // catch rolls back cleanly.
                for (const item of (order as any).items ?? []) {
                    if (item.storeProductId) {
                        await tx.storeProduct.update({
                            where: { id: item.storeProductId },
                            data: { stock: { increment: item.quantity ?? 0 } },
                        });
                    }
                }

                // Coupon redemption reversal (Bug N4 fix, refined round-5 with userId scope).
                //
                // userId: order.userId is defense-in-depth — guards against a malformed
                // redemption row from a different user pointing at this orderId from being
                // deleted on cancel. The redeem endpoint should already enforce userId
                // matches, but if it ever doesn't this prevents collateral damage.
                //
                // findMany + group-by-coupon handles the legitimate multi-coupon case
                // (one order can have multiple CouponRedemption rows for distinct
                // coupons because /coupons/redeem only deduplicates on the
                // (couponId, orderId) pair). `usedCount: { gte: count }` guard prevents
                // going below zero per coupon.
                const redemptions = await tx.couponRedemption.findMany({
                    where: { orderId: id, userId: order.userId },
                });
                if (redemptions.length > 0) {
                    await tx.couponRedemption.deleteMany({
                        where: { orderId: id, userId: order.userId },
                    });
                    const countByCoupon = new Map<string, number>();
                    for (const r of redemptions) {
                        countByCoupon.set(r.couponId, (countByCoupon.get(r.couponId) || 0) + 1);
                    }
                    for (const [couponId, count] of countByCoupon) {
                        await tx.coupon.updateMany({
                            where: { id: couponId, usedCount: { gte: count } },
                            data: { usedCount: { decrement: count } },
                        });
                    }

                    // Phase 2 (2H) — additional reversal work:
                    // (a) decrement dailyUsageCount for redemptions made today (IST)
                    // (b) clear Order snapshot columns
                    // (c) write AuditLog row per reversed coupon
                    const nowH = new Date();
                    const istNowH = new Date(nowH.getTime() + (5.5 * 60 * 60 * 1000));
                    const istMidnightUtcMsH = Date.UTC(istNowH.getUTCFullYear(), istNowH.getUTCMonth(), istNowH.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
                    const istMidnightTodayH = new Date(istMidnightUtcMsH);
                    for (const r of redemptions) {
                        if (r.createdAt >= istMidnightTodayH) {
                            await tx.coupon.updateMany({
                                where: { id: r.couponId, dailyUsageCount: { gte: 1 } },
                                data: { dailyUsageCount: { decrement: 1 } },
                            });
                        }
                    }
                    await tx.order.update({
                        where: { id },
                        data: {
                            orderCouponId: null,
                            orderCouponCode: null,
                            orderCouponDiscount: null,
                            orderCouponFundingSource: null,
                            orderCouponDiscountType: null,
                        },
                    });
                    for (const [couponId, count] of countByCoupon) {
                        try {
                            await tx.auditLog.create({
                                data: {
                                    // Phase 2K hot-fix (2026-06-09): actor is the
                                    // authenticated caller (consumer / merchant /
                                    // admin) — NOT the order owner. Previously
                                    // this misattributed merchant/admin-initiated
                                    // cancels to the customer, defeating the
                                    // audit-log integrity guarantee.
                                    actorUserId: user.id,
                                    action: 'coupon.redemption_reversed',
                                    targetType: 'coupon',
                                    targetId: couponId,
                                    beforeJson: { orderId: id, orderOwnerUserId: order.userId, count } as any,
                                    afterJson: undefined,
                                },
                            });
                        } catch (auditErr) {
                            console.error('[2H reversal audit log] failed:', auditErr);
                        }
                    }
                }

                // ── Phase 5 (2026-06-09) — multi-store redemption reversal ──
                // Q5 decision (approved): proportional PARTIAL reversal. Multi-
                // store redemption rows have orderId = NULL and track per-store
                // orders in splitOrderIds[], so the block above (orderId match)
                // never finds them. When ONE of N store-orders is cancelled:
                //   - remove its id from splitOrderIds
                //   - subtract this Order's snapshot slice from discountAmount
                //   - usedCount / dailyUsageCount stay (the coupon WAS used)
                // When the LAST order is cancelled: delete the row + decrement
                // usedCount (and dailyUsageCount if redeemed today IST) — full
                // reversal, mirroring the single-store semantics above.
                const multiRedemption = await tx.couponRedemption.findFirst({
                    where: { splitOrderIds: { has: id }, userId: order.userId },
                    select: { id: true, couponId: true, createdAt: true },
                });
                if (multiRedemption) {
                    const orderSliceDiscount = Number((order as any).orderCouponDiscount ?? 0);
                    // Phase 5 audit fix #5 (2026-06-10): the shrink is now atomic
                    // IN-STATEMENT (array_remove + GREATEST guard, conditioned on
                    // the orderId still being present), mirroring the append path.
                    // The previous read-modify-write lost updates under concurrent
                    // cancels of two different orders from the same cart: both read
                    // [o1,o2], the loser overwrote with stale values, the row never
                    // emptied, and counters never decremented.
                    const shrunk = await tx.$queryRaw<{ split_order_ids: string[] }[]>`
                        UPDATE "public"."coupon_redemptions"
                        SET "split_order_ids" = array_remove("split_order_ids", ${id}),
                            "discount_amount" = GREATEST(0, COALESCE("discount_amount", 0) - ${orderSliceDiscount})
                        WHERE "id" = ${multiRedemption.id}
                          AND "split_order_ids" @> ARRAY[${id}]::text[]
                        RETURNING "split_order_ids";
                    `;
                    if (shrunk.length > 0) {
                        const remainingCount = shrunk[0].split_order_ids.length;
                        if (remainingCount === 0) {
                            // Last order of the cart cancelled — full reversal.
                            // deleteMany guarded on isEmpty so a concurrent append
                            // (shouldn't happen post-cancel, but defensive) can't
                            // have its orderId deleted out from under it.
                            const deleted = await tx.couponRedemption.deleteMany({
                                where: { id: multiRedemption.id, splitOrderIds: { isEmpty: true } },
                            });
                            if (deleted.count > 0) {
                                await tx.coupon.updateMany({
                                    where: { id: multiRedemption.couponId, usedCount: { gte: 1 } },
                                    data: { usedCount: { decrement: 1 } },
                                });
                                const nowM = new Date();
                                const istNowM = new Date(nowM.getTime() + (5.5 * 60 * 60 * 1000));
                                const istMidnightUtcMsM = Date.UTC(istNowM.getUTCFullYear(), istNowM.getUTCMonth(), istNowM.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
                                const istMidnightTodayM = new Date(istMidnightUtcMsM);
                                if (multiRedemption.createdAt >= istMidnightTodayM) {
                                    await tx.coupon.updateMany({
                                        where: { id: multiRedemption.couponId, dailyUsageCount: { gte: 1 } },
                                        data: { dailyUsageCount: { decrement: 1 } },
                                    });
                                }
                            }
                        }
                        // Clear this Order's coupon snapshot (mirrors single-store path).
                        await tx.order.update({
                            where: { id },
                            data: {
                                orderCouponId: null,
                                orderCouponCode: null,
                                orderCouponDiscount: null,
                                orderCouponFundingSource: null,
                                orderCouponDiscountType: null,
                            },
                        });
                        try {
                            await tx.auditLog.create({
                                data: {
                                    actorUserId: user.id,
                                    action: 'coupon.redemption_reversed',
                                    targetType: 'coupon',
                                    targetId: multiRedemption.couponId,
                                    beforeJson: {
                                        orderId: id,
                                        orderOwnerUserId: order.userId,
                                        multiStore: true,
                                        partial: remainingCount > 0,
                                        remainingOrders: remainingCount,
                                        reversedSlice: orderSliceDiscount,
                                    } as any,
                                    afterJson: undefined,
                                },
                            });
                        } catch (auditErr) {
                            console.error('[Phase 5 reversal audit log] failed:', auditErr);
                        }
                    }
                    // shrunk.length === 0 → a concurrent cancel already removed this
                    // orderId — idempotent no-op (snapshot already cleared by it).
                }

                // Re-fetch the row we just CAS-updated so the rest of the
                // endpoint has the canonical post-flip state.
                return tx.order.findUnique({ where: { id } });
            });
        } catch (err: any) {
            if (err?.message === 'CONCURRENT_DECISION') {
                return res.status(409).json({
                    error: 'This order was already cancelled or moved out of a cancellable state by another process. Refresh and try again.',
                });
            }
            throw err;
        }
        if (!updated) {
            return res.status(500).json({ error: 'Cancel committed but order vanished — please refresh.' });
        }

        // order_requests cleanup (Bug N7 fix — third-pass audit).
        //
        // When the order was created from an order_request, `POST /orders`
        // sets that request's status to 'COMPLETED'. After a cancel, that
        // request would otherwise stay 'COMPLETED' forever — misleading
        // for merchant request-queue dashboards. Flip it to 'CANCELLED'.
        //
        // Best-effort and OUTSIDE the transaction on purpose: the
        // order_requests table is a String-typed status with no defined
        // CHECK constraint at the Prisma level, but production may have
        // one. If 'CANCELLED' is rejected, we log + move on — we will
        // not roll back the successful cancel just because the request
        // queue couldn't be updated.
        const orderRequestId = (order.metadata as any)?.orderRequestId;
        if (orderRequestId && typeof orderRequestId === 'string' && /^[0-9a-f-]{36}$/i.test(orderRequestId)) {
            // Awaited (round-4 audit fix): a SIGTERM during EB deploy between
            // the response send and the SQL round-trip would silently lose
            // the cleanup. Latency cost is one indexed updateMany (~5ms).
            // The .catch still keeps this best-effort — if the DB rejects
            // 'CANCELLED' for any reason the cancel itself does not roll back.
            // The UUID regex above guards against malformed legacy metadata.
            await prisma.order_requests.updateMany({
                where: { id: orderRequestId, status: 'COMPLETED' },
                data: { status: 'CANCELLED', updated_at: cancelledAt },
            }).catch((e: any) => {
                console.error('[cancel] order_request cleanup failed:', e);
                Sentry.captureException(e, {
                    tags: { area: 'ws2.cancel.orderRequestCleanup' },
                    extra: { orderId: id, orderRequestId },
                });
            });
        }

        // Razorpay refund AFTER status is committed. Safe to retry the
        // overall endpoint now — the rules engine blocks CANCELLED orders,
        // so this code path runs at most once per order.
        let refundResult: { razorpayRefundId: string; simulated: boolean } | null = null;
        if (decision.refundInr > 0) {
            refundResult = await processRazorpayRefund(order.metadata, decision.refundInr);
            // Phase 7D (2026-06-10): if this order was already settled in a
            // closed/paid cycle, record a clawback (claimed by the next close).
            try { await detectClawback(prisma, id, decision.refundInr, `cancel refund ${refundResult.razorpayRefundId}`); } catch (e) { console.error('[7D] clawback detect (cancel) failed:', e); }
            // Persist the refund id back to metadata. If this write fails
            // after Razorpay succeeded, ops reconciles via the Razorpay
            // dashboard — but no money is at risk.
            await prisma.order.update({
                where: { id },
                data: {
                    metadata: {
                        ...(typeof updated.metadata === 'object' && updated.metadata !== null ? updated.metadata : {}),
                        razorpayRefundId: refundResult.razorpayRefundId,
                        refundSimulated: refundResult.simulated,
                    } as any,
                },
            }).catch((e: any) => console.error('[cancel] metadata refund write failed:', e));
        }

        // Notifications — fire-and-forget per existing pattern.
        notificationService.sendMerchantNotification({
            storeId: order.storeId,
            title: 'Order cancelled by customer',
            body: `Order #${order.orderNumber} cancelled. Fee ₹${decision.feeInr}, refund ₹${decision.refundInr}.`,
            type: 'ORDER_CANCELLED',
            referenceId: order.id,
            link: '/(main)/orders',
            metadata: { orderNumber: order.orderNumber, feeInr: decision.feeInr, refundInr: decision.refundInr },
        }).catch(e => console.error('[cancel] merchant notif failed:', e));

        // Consumer in-app notif (Bug N5 fix — third-pass audit). Previously
        // the customer only got an SMS, which carriers may delay by minutes
        // or filter as spam. Now they also get the immediate in-app receipt.
        //
        // Body branches (round-4 audit fix — explicit dining-forfeit case):
        //  1. autoRefundEligible       → full refund inside the 5-min window
        //  2. refundInr > 0            → late-cancel fee + partial refund
        //  3. feeInr > 0 & refund = 0  → dining non-refund policy (full forfeit)
        //  4. else (both = 0)          → free cancel (unpaid)
        notificationService.sendConsumerNotification({
            userId: order.userId,
            title: 'Order cancelled',
            body: decision.autoRefundEligible
                ? `Order #${order.orderNumber} cancelled. Full refund of ₹${decision.refundInr} on the way.`
                : decision.refundInr > 0
                    ? `Order #${order.orderNumber} cancelled. Refund ₹${decision.refundInr} (fee ₹${decision.feeInr}).`
                    : decision.feeInr > 0
                        ? `Order #${order.orderNumber} cancelled. Per the dining cancellation policy, the booking total of ₹${decision.feeInr} is non-refundable.`
                        : `Order #${order.orderNumber} cancelled.`,
            type: 'ORDER_CANCELLED',
            referenceId: order.id,
            storeId: order.storeId,
            link: '/orders',
            metadata: { orderNumber: order.orderNumber, feeInr: decision.feeInr, refundInr: decision.refundInr },
        }).catch(e => console.error('[cancel] consumer notif failed:', e));

        if (order.user?.phone) {
            smsService.sendOrderUpdate(order.user.phone, id, 'Order Cancelled').catch(e => console.error('[cancel] SMS failed:', e));
        }
        io.emit('order_updated', updated);

        return res.json({
            success: true,
            cancellation: {
                feeInr: decision.feeInr,
                refundInr: decision.refundInr,
                autoRefundEligible: decision.autoRefundEligible,
                reason: decision.reason,
                razorpayRefundId: refundResult?.razorpayRefundId ?? null,
                refundSimulated: refundResult?.simulated ?? null,
            },
            order: updated,
        });
    } catch (err: any) {
        console.error('[cancel] error:', err);
        Sentry.captureException(err, { tags: { area: 'ws2.cancel' }, extra: { orderId: req.params.id, userId: user.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to cancel order.', details: err?.message });
    }
});

/**
 * POST /orders/:id/reschedule — customer moves the slot for a pickup/dining
 * order. Body: { newSlotAt: ISO string }
 */
app.post('/orders/:id/reschedule', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { newSlotAt } = req.body || {};
        if (!newSlotAt) {
            return res.status(400).json({ error: 'newSlotAt is required (ISO 8601 timestamp).' });
        }
        const newSlot = new Date(newSlotAt);
        if (Number.isNaN(newSlot.getTime())) {
            return res.status(400).json({ error: 'newSlotAt must be a valid ISO 8601 timestamp.' });
        }

        const order = await prisma.order.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        if (order.userId !== user.id) {
            return res.status(403).json({ error: 'You do not have permission to reschedule this order.' });
        }

        // Normalize 'dine-in' → 'dining' for the rules engine (Bug A fix).
        const rawOrderType = (order as any).order_type;
        const normalizedOrderType = rawOrderType === 'dine-in' ? 'dining' : (rawOrderType || 'pickup');
        const decision = orderLifecycleRules.evaluateReschedule({
            orderType: normalizedOrderType,
            orderStatus: order.status,
            slotTimeAt: (order as any).slot_time_at || null,
            newSlotAt: newSlot,
            requestedAt: new Date(),
            peakSurchargeInr: 0, // v0 — merchant peak-hour config TBD
        });
        if (!decision.allowed) {
            return res.status(400).json({ error: decision.reason });
        }

        const updated = await prisma.order.update({
            where: { id },
            data: {
                slot_time_at: newSlot,
                metadata: {
                    ...(typeof order.metadata === 'object' && order.metadata !== null ? order.metadata : {}),
                    lastRescheduledAt: new Date().toISOString(),
                    peakSurchargeInr: decision.surchargeInr,
                } as any,
            },
        });

        notificationService.sendMerchantNotification({
            storeId: order.storeId,
            title: 'Order rescheduled',
            body: `Order #${order.orderNumber} new slot: ${newSlot.toLocaleString('en-IN')}.`,
            type: 'ORDER_RESCHEDULED',
            referenceId: order.id,
            link: '/(main)/orders',
            metadata: { orderNumber: order.orderNumber, newSlotAt: newSlot.toISOString() },
        }).catch(e => console.error('[reschedule] merchant notif failed:', e));
        io.emit('order_updated', updated);

        return res.json({
            success: true,
            reschedule: { surchargeInr: decision.surchargeInr, reason: decision.reason },
            order: updated,
        });
    } catch (err: any) {
        console.error('[reschedule] error:', err);
        Sentry.captureException(err, { tags: { area: 'ws2.reschedule' }, extra: { orderId: req.params.id, userId: user.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to reschedule order.', details: err?.message });
    }
});

/**
 * POST /orders/:id/return — customer files a return issue.
 * Body: { reason: ReturnReason, description?: string, photos?: string[], refundInr: number }
 */
app.post('/orders/:id/return', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { reason, description, photos, refundInr } = req.body || {};

        if (!reason || !orderLifecycleRules.isReturnReason(String(reason))) {
            return res.status(400).json({ error: 'reason is required and must be a valid return reason code.' });
        }
        const requestedRefund = Number(refundInr);
        if (!Number.isFinite(requestedRefund) || requestedRefund <= 0) {
            return res.status(400).json({ error: 'refundInr must be a positive number.' });
        }
        const photoList = Array.isArray(photos) ? photos.filter(p => typeof p === 'string') : [];

        const order = await prisma.order.findUnique({
            where: { id },
            include: { user: true, items: { include: { storeProduct: { include: { product: { select: PRODUCT_PUBLIC_SELECT } } } } } },
        });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        if (order.userId !== user.id) {
            return res.status(403).json({ error: 'You do not have permission to return this order.' });
        }

        // Product returnable check — pessimistic across all items.
        const anyNonReturnable = (order as any).items?.some(
            (it: any) => it?.storeProduct?.product?.returnable === false,
        );

        // Clamp the requested refund to the order total. Without this a
        // customer could submit refundInr=99999 on a ₹100 order and the
        // merchant would see (and potentially approve) the inflated amount.
        // Razorpay would silently reject anything over the captured amount,
        // leaving the order in a half-resolved state. Fixed 2026-06-05 (Bug E).
        const clampedRefund = Math.min(requestedRefund, Number(order.totalAmount));

        const decision = orderLifecycleRules.evaluateReturn({
            orderStatus: order.status,
            completedAt: order.updatedAt,
            requestedAt: new Date(),
            reason,
            productReturnable: !anyNonReturnable,
            requestedRefundInr: clampedRefund,
            photoCount: photoList.length,
        });
        if (!decision.allowed) {
            return res.status(400).json({ error: decision.reason });
        }

        const createdAt = new Date();
        const slaDueAt = orderLifecycleRules.computeSlaDueAt(createdAt);

        // ATOMIC COMPARE-AND-SET on order.status (round-5 hardening).
        //
        // Status flip MUST happen before issue.create. Without this, two
        // parallel POST /orders/:id/return calls both pass the rules check
        // (status === COMPLETED), both enter the transaction, and each
        // creates its own OrderIssue row. Customer sees two "Return
        // submitted" pushes; merchant queue has two PENDING issues; cron
        // auto-approves both → double refund in 24h.
        //
        // CAS gate: only the writer that finds status='COMPLETED' wins.
        // The second writer sees count===0 → CONCURRENT_DECISION → 409.
        let result: { issue: any; updatedOrder: any };
        try {
            result = await prisma.$transaction(async (tx) => {
                const flipped = await tx.order.updateMany({
                    where: { id: order.id, status: 'COMPLETED' },
                    data: { status: 'RETURN_REQUESTED', returnReason: reason, returnImages: photoList },
                });
                if (flipped.count === 0) {
                    throw new Error('CONCURRENT_DECISION');
                }
                const issue = await tx.orderIssue.create({
                    data: {
                        orderId: order.id,
                        type: 'return',
                        reason,
                        description: description ? String(description).slice(0, 1000) : null,
                        photos: photoList,
                        status: 'PENDING',
                        refundAmountInr: decision.refundInr,
                        slaDueAt,
                        createdAt,
                    },
                });
                const updatedOrder = await tx.order.findUnique({ where: { id: order.id } });
                return { issue, updatedOrder };
            });
        } catch (err: any) {
            if (err?.message === 'CONCURRENT_DECISION') {
                return res.status(409).json({
                    error: 'This order is no longer in a returnable state (another request may have just moved it). Refresh and try again.',
                });
            }
            throw err;
        }

        notificationService.sendMerchantNotification({
            storeId: order.storeId,
            title: 'Return requested',
            body: `Order #${order.orderNumber} return: ${reason} (₹${decision.refundInr}). SLA 24h.`,
            type: 'RETURN_REQUESTED',
            referenceId: order.id,
            link: '/(main)/orders',
            metadata: { orderNumber: order.orderNumber, issueId: result.issue.id, refundInr: decision.refundInr, refundWithoutReturn: decision.refundWithoutReturn },
        }).catch(e => console.error('[return] merchant notif failed:', e));

        // Consumer in-app notif (Bug N5 fix — third-pass audit). Customer
        // sees an immediate receipt that the return request landed and the
        // merchant has 24h to respond.
        notificationService.sendConsumerNotification({
            userId: order.userId,
            title: 'Return request submitted',
            body: decision.refundWithoutReturn
                ? `Return for order #${order.orderNumber} sent. No need to bring the item back — refund of ₹${decision.refundInr} pending merchant review (24h SLA).`
                : `Return for order #${order.orderNumber} sent. Drop the item at the store; refund of ₹${decision.refundInr} processes after merchant approves (24h SLA).`,
            type: 'RETURN_REQUESTED',
            referenceId: order.id,
            storeId: order.storeId,
            link: '/orders',
            metadata: { orderNumber: order.orderNumber, issueId: result.issue.id, refundInr: decision.refundInr, refundWithoutReturn: decision.refundWithoutReturn },
        }).catch(e => console.error('[return] consumer notif failed:', e));

        io.emit('order_updated', result.updatedOrder);

        return res.status(201).json({
            success: true,
            issue: result.issue,
            return: { refundWithoutReturn: decision.refundWithoutReturn, refundInr: decision.refundInr, reason: decision.reason },
            order: result.updatedOrder,
        });
    } catch (err: any) {
        console.error('[return] error:', err);
        Sentry.captureException(err, { tags: { area: 'ws2.return' }, extra: { orderId: req.params.id, userId: user.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to create return request.', details: err?.message });
    }
});

/**
 * POST /orders/:id/exchange — customer files an exchange issue.
 * Body: { reason: ExchangeReason, description?: string }
 */
app.post('/orders/:id/exchange', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id } = req.params;
        const { reason, description } = req.body || {};

        if (!reason || !orderLifecycleRules.isExchangeReason(String(reason))) {
            return res.status(400).json({ error: 'reason is required and must be a valid exchange reason code.' });
        }

        const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
        if (!order) return res.status(404).json({ error: 'Order not found.' });
        if (order.userId !== user.id) {
            return res.status(403).json({ error: 'You do not have permission to exchange this order.' });
        }

        const decision = orderLifecycleRules.evaluateExchange({
            orderStatus: order.status,
            completedAt: order.updatedAt,
            requestedAt: new Date(),
            reason,
        });
        if (!decision.allowed) {
            return res.status(400).json({ error: decision.reason });
        }

        const createdAt = new Date();
        const slaDueAt = orderLifecycleRules.computeSlaDueAt(createdAt);

        // ATOMIC COMPARE-AND-SET on order.status (round-5 hardening — mirror of A2).
        // Without this, two parallel exchange submits both create OrderIssue
        // rows; cron auto-approves both in 24h.
        let result: { issue: any; updatedOrder: any };
        try {
            result = await prisma.$transaction(async (tx) => {
                const flipped = await tx.order.updateMany({
                    where: { id: order.id, status: 'COMPLETED' },
                    data: { status: 'EXCHANGE_REQUESTED' },
                });
                if (flipped.count === 0) {
                    throw new Error('CONCURRENT_DECISION');
                }
                const issue = await tx.orderIssue.create({
                    data: {
                        orderId: order.id,
                        type: 'exchange',
                        reason,
                        description: description ? String(description).slice(0, 1000) : null,
                        photos: [],
                        status: 'PENDING',
                        slaDueAt,
                        createdAt,
                    },
                });
                const updatedOrder = await tx.order.findUnique({ where: { id: order.id } });
                return { issue, updatedOrder };
            });
        } catch (err: any) {
            if (err?.message === 'CONCURRENT_DECISION') {
                return res.status(409).json({
                    error: 'This order is no longer in an exchangeable state (another request may have just moved it). Refresh and try again.',
                });
            }
            throw err;
        }

        notificationService.sendMerchantNotification({
            storeId: order.storeId,
            title: 'Exchange requested',
            body: `Order #${order.orderNumber} exchange: ${reason}. SLA 24h.`,
            type: 'EXCHANGE_REQUESTED',
            referenceId: order.id,
            link: '/(main)/orders',
            metadata: { orderNumber: order.orderNumber, issueId: result.issue.id },
        }).catch(e => console.error('[exchange] merchant notif failed:', e));

        // Consumer in-app notif (Bug N5 fix — third-pass audit).
        // Body wording fix from review-round-4: the 24h is the MERCHANT'S
        // SLA to decide, not a customer-side deadline. Previous copy told
        // the customer to "visit the store within 24 hours to complete the
        // exchange", but they can't complete anything until the merchant
        // approves and status flips to EXCHANGE_APPROVED.
        notificationService.sendConsumerNotification({
            userId: order.userId,
            title: 'Exchange request submitted',
            body: `Exchange for order #${order.orderNumber} sent. The merchant has 24 hours to respond — you'll get an update when they decide.`,
            type: 'EXCHANGE_REQUESTED',
            referenceId: order.id,
            storeId: order.storeId,
            link: '/orders',
            metadata: { orderNumber: order.orderNumber, issueId: result.issue.id },
        }).catch(e => console.error('[exchange] consumer notif failed:', e));

        io.emit('order_updated', result.updatedOrder);

        return res.status(201).json({ success: true, issue: result.issue, exchange: { reason: decision.reason }, order: result.updatedOrder });
    } catch (err: any) {
        console.error('[exchange] error:', err);
        Sentry.captureException(err, { tags: { area: 'ws2.exchange' }, extra: { orderId: req.params.id, userId: user.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to create exchange request.', details: err?.message });
    }
});

/**
 * PATCH /orders/:id/issue/:issueId — merchant approves/rejects an issue.
 * Body: { decision: 'APPROVED' | 'REJECTED', merchantDecisionReason?: string }
 *
 * On APPROVED for a return: triggers Razorpay refund + flips order to
 * RETURN_APPROVED + REFUNDED. On APPROVED for exchange: flips to
 * EXCHANGE_APPROVED. On REJECTED: flips to RETURN_REJECTED or
 * EXCHANGE_REJECTED.
 */
app.patch('/orders/:id/issue/:issueId', async (req, res) => {
    const user = await requireUser(req, res);
    if (!user) return;
    try {
        const { id, issueId } = req.params;
        const { decision, merchantDecisionReason } = req.body || {};

        if (decision !== 'APPROVED' && decision !== 'REJECTED') {
            return res.status(400).json({ error: "decision must be 'APPROVED' or 'REJECTED'." });
        }

        const order = await prisma.order.findUnique({ where: { id }, include: { user: true, store: true } });
        if (!order) return res.status(404).json({ error: 'Order not found.' });

        const canManage = await userCanManageOrderStore(user.id, order.storeId);
        if (!canManage) {
            return res.status(403).json({ error: 'You do not have merchant access to this order.' });
        }

        const issue = await prisma.orderIssue.findUnique({ where: { id: issueId } });
        if (!issue || issue.orderId !== order.id) {
            return res.status(404).json({ error: 'Issue not found for this order.' });
        }
        if (issue.status !== 'PENDING') {
            return res.status(400).json({ error: `Issue is already ${issue.status}; cannot decide twice.` });
        }

        const now = new Date();
        const newIssueStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
        const newOrderStatus =
            decision === 'APPROVED' && issue.type === 'return'   ? 'RETURN_APPROVED'   :
            decision === 'REJECTED' && issue.type === 'return'   ? 'RETURN_REJECTED'   :
            decision === 'APPROVED' && issue.type === 'exchange' ? 'EXCHANGE_APPROVED' :
            decision === 'REJECTED' && issue.type === 'exchange' ? 'EXCHANGE_REJECTED' :
            order.status;
        const needsRefund = decision === 'APPROVED' && issue.type === 'return' && (issue.refundAmountInr ?? 0) > 0;

        // FLIP STATUS FIRST inside a transaction (Bug 2 fix).
        //
        // Previously the Razorpay refund was called BEFORE this transaction.
        // If the refund succeeded but the transaction then failed, the issue
        // would still be PENDING — so the merchant could click Approve again
        // and refund the same payment a second time. By committing the
        // APPROVED/REJECTED state first, the `issue.status !== 'PENDING'`
        // guard at the top of this endpoint blocks any retry.
        //
        // isPaid is also flipped here for refund-bearing approvals so that
        // the customer's perceived state ("refund issued") matches the
        // merchant's intent the moment they tap Approve. If Razorpay fails
        // afterward, metadata.returnRefundSimulated stays absent / 'rfnd_err'
        // and ops reconciles from the dashboard.
        // ATOMIC COMPARE-AND-SET (Bug N2 fix — third-pass audit).
        //
        // Previously this used `tx.orderIssue.update` which is unconditional —
        // it doesn't re-check the row's current status. That left a TOCTOU
        // race window: between the `issue.status !== 'PENDING'` check above
        // and this transaction, the cron SLA job (or a parallel merchant tab)
        // could have flipped the issue to AUTO_APPROVED/APPROVED. Both
        // processes would then commit their own status change (last-write-
        // wins) AND each would call Razorpay → double refund.
        //
        // `updateMany` with `status: 'PENDING'` in the WHERE clause makes
        // this an atomic compare-and-set: the row only updates if its
        // current status is still PENDING. If another process won the race,
        // `count === 0` and we throw a sentinel error that the outer
        // try/catch maps to a 409 — the refund block below is skipped
        // because we never get there.
        let result: { issue: any; order: any };
        try {
            result = await prisma.$transaction(async (tx) => {
                const updateRes = await tx.orderIssue.updateMany({
                    where: { id: issueId, status: 'PENDING' },
                    data: {
                        status: newIssueStatus,
                        merchantDecisionReason: merchantDecisionReason ? String(merchantDecisionReason).slice(0, 500) : null,
                        resolvedBy: user.id,
                        resolvedAt: now,
                    },
                });
                if (updateRes.count === 0) {
                    // Another process (cron auto-approve or a second merchant tab)
                    // already moved this issue out of PENDING. Bail before doing
                    // anything else — the refund must not fire a second time.
                    throw new Error('CONCURRENT_DECISION');
                }
                const updatedIssue = await tx.orderIssue.findUnique({ where: { id: issueId } });
                const updatedOrder = await tx.order.update({
                    where: { id: order.id },
                    data: {
                        status: newOrderStatus,
                        ...(needsRefund && { isPaid: false }),
                    },
                });
                return { issue: updatedIssue!, order: updatedOrder };
            });
        } catch (err: any) {
            if (err?.message === 'CONCURRENT_DECISION') {
                return res.status(409).json({
                    error: 'This issue was already decided by another process (cron auto-approve or another session). Refresh and try again.',
                });
            }
            throw err;
        }

        // Razorpay refund AFTER status is committed. Safe to retry the
        // endpoint now — `issue.status !== 'PENDING'` blocks duplicates.
        let refundResult: { razorpayRefundId: string; simulated: boolean } | null = null;
        if (needsRefund) {
            refundResult = await processRazorpayRefund(order.metadata, issue.refundAmountInr!);
            // Phase 7D (2026-06-10): settled-order refund → clawback entry.
            try { await detectClawback(prisma, order.id, issue.refundAmountInr!, `issue refund ${refundResult.razorpayRefundId}`); } catch (e) { console.error('[7D] clawback detect (issue) failed:', e); }
            // Persist refund id back to issue + order metadata. If this
            // post-refund write fails, ops reconciles from Razorpay; the
            // status above is the canonical "approved" record.
            await prisma.$transaction(async (tx) => {
                await tx.orderIssue.update({
                    where: { id: issueId },
                    data: { refundRazorpayId: refundResult!.razorpayRefundId, refundProcessedAt: now },
                });
                await tx.order.update({
                    where: { id: order.id },
                    data: {
                        metadata: {
                            ...(typeof result.order.metadata === 'object' && result.order.metadata !== null ? result.order.metadata : {}),
                            returnRazorpayRefundId: refundResult!.razorpayRefundId,
                            returnRefundSimulated: refundResult!.simulated,
                        } as any,
                    },
                });
            }).catch((e: any) => console.error('[issue PATCH] metadata refund write failed:', e));
        }

        // Customer notification
        notificationService.sendConsumerNotification({
            userId: order.userId,
            title: `${issue.type === 'return' ? 'Return' : 'Exchange'} ${decision.toLowerCase()}`,
            body: `Order #${order.orderNumber}: ${decision === 'APPROVED' ? 'approved' : 'declined'}${merchantDecisionReason ? ` — ${merchantDecisionReason}` : ''}.`,
            type: issue.type === 'return' ? 'RETURN_DECISION' : 'EXCHANGE_DECISION',
            referenceId: order.id,
            storeId: order.storeId,
            link: `/orders/${order.id}`,
            metadata: {
                orderNumber: order.orderNumber,
                issueId: issue.id,
                decision: newIssueStatus,
                refundInr: issue.refundAmountInr ?? null,
                razorpayRefundId: refundResult?.razorpayRefundId ?? null,
            },
        }).catch(e => console.error('[issue PATCH] customer notif failed:', e));
        io.emit('order_updated', result.order);

        return res.json({
            success: true,
            issue: result.issue,
            order: result.order,
            refund: refundResult ? { razorpayRefundId: refundResult.razorpayRefundId, simulated: refundResult.simulated } : null,
        });
    } catch (err: any) {
        console.error('[issue PATCH] error:', err);
        Sentry.captureException(err, { tags: { area: 'ws2.merchantPatch' }, extra: { orderId: req.params.id, issueId: req.params.issueId, userId: user.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to update issue.', details: err?.message });
    }
});

// =====================================================================
// --- Push Token Routes ---

// Register / Upsert push token (called on app launch / login)
app.post('/push-tokens/register', async (req, res) => {
    try {
        const { userId, expoPushToken, deviceId, platform } = req.body;

        if (!userId || !expoPushToken) {
            return res.status(400).json({ error: 'userId and expoPushToken are required' });
        }

        // Upsert: if (userId, expoPushToken) already exists, just update timestamps and re-activate
        const token = await (prisma as any).merchantPushToken.upsert({
            where: {
                userId_expoPushToken: { userId, expoPushToken }
            },
            update: {
                isActive: true,
                deviceId: deviceId || null,
                platform: platform || null,
                updatedAt: new Date()
            },
            create: {
                userId,
                expoPushToken,
                deviceId: deviceId || null,
                platform: platform || null,
                isActive: true
            }
        });

        console.log(`[PushToken] Registered token for user ${userId}: ${expoPushToken.substring(0, 20)}...`);
        res.json({ success: true, tokenId: token.id });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'push-tokens.register', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to register push token' });
    }
});

// Deregister push token (called on logout)
app.delete('/push-tokens/deregister', async (req, res) => {
    try {
        const { userId, expoPushToken } = req.body;

        if (!userId || !expoPushToken) {
            return res.status(400).json({ error: 'userId and expoPushToken are required' });
        }

        await (prisma as any).merchantPushToken.updateMany({
            where: { userId, expoPushToken },
            data: { isActive: false }
        });

        console.log(`[PushToken] Deregistered token for user ${userId}`);
        res.json({ success: true });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'push-tokens.deregister', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to deregister push token' });
    }
});

const startAutoRejectTimer = () => {
    setInterval(async () => {
        try {
            const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
            
            // Fix: Bulk update PENDING orders that have timed out
            // Executes in a single network trip and connection
            const result = await prisma.order_requests.updateMany({
                where: {
                    status: 'PENDING',
                    created_at: { lt: twoMinsAgo }
                },
                data: { status: 'CANCELLED' }
            });

            if (result.count > 0) {
                console.log(`[Auto-Reject] Cancelled ${result.count} expired orders.`);
            }
        } catch (error) {
            console.error('Auto-reject check failed', error);
        }
    }, 2 * 60 * 1000); // 2 minutes
};
startAutoRejectTimer();

// --- Merchant Routes ---


// Get Merchant Inventory (Specific Store)
app.get('/merchants/:id/inventory', async (req, res) => {
    try {
        // H-1 solid fix (2026-06-23): admin-only. Three problems closed in one fix —
        // (a) was unauthenticated (display-audit CRIT 4 leak), (b) filtered on the
        // dead pre-Phase-2-FINAL `StoreProduct.storeId` column → always wrong rows,
        // (c) `category` filter referenced a non-existent scalar (`Product.category`)
        // so any caller passing ?category=... got a 500. Caller: admin MerchantInventoryModal
        // which already passes a BRANCH id (selectedBranchId), so route name `:id` =
        // branch_id. Field whitelist via PRODUCT_PUBLIC_SELECT.
        const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
        const { id } = req.params;
        const { search, category } = req.query;

        const where: any = { branch_id: id };

        if (search) {
            where.product = {
                name: { contains: String(search), mode: 'insensitive' }
            };
        }

        if (category) {
            // FK relation, not a scalar. `category` query param matches Tier2Category.name.
            where.product = {
                ...where.product,
                Tier2Category: { name: { in: String(category).split(',') } },
            };
        }

        const inventory = await prisma.storeProduct.findMany({
            where,
            include: { product: { select: PRODUCT_PUBLIC_SELECT } },
            orderBy: { updatedAt: 'desc' },
        });

        res.json(inventory);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'merchants.inventory', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch merchant inventory' });
    }
});

// Get Merchant Branches
app.get('/merchants/:id/branches', async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get the manager/owner of the current store
        const currentStore = await prisma.store.findUnique({
            where: { id },
            select: { managerId: true }
        });

        if (!currentStore || !currentStore.managerId) {
            return res.json([]);
        }

        // 2. Fetch all stores managed by the same person
        const branches = await prisma.store.findMany({
            where: { managerId: currentStore.managerId },
            select: {
                id: true,
                name: true,
                address: true,
                active: true
            }
        });

        res.json(branches);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'merchants.branches', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch merchant branches' });
    }
});

// Export Selected Merchants
app.post('/merchants/export-selected', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No merchant IDs provided' });
        }

        // Fetch merchants from Supabase
        const { data: merchants, error } = await supabase
            .from('merchants')
            .select('*')
            .in('id', ids);

        if (error) throw error;

        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Merchants');

        // Define Columns
        worksheet.columns = [
            { header: 'Store Name', key: 'store_name', width: 25 },
            { header: 'Owner Name', key: 'owner_name', width: 20 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Email', key: 'email', width: 25 },
            { header: 'City', key: 'city', width: 15 },
            { header: 'Branch', key: 'branch_name', width: 15 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Rating', key: 'rating', width: 10 },
            { header: 'Created At', key: 'created_at', width: 20 }
        ];

        // Add Data
        merchants.forEach((m: any) => {
            worksheet.addRow({
                store_name: m.store_name,
                owner_name: m.owner_name,
                phone: m.phone,
                email: m.email,
                city: m.city,
                branch_name: m.branch_name || 'Main',
                status: m.status,
                rating: m.rating,
                createdAt: m.created_at
            });
        });

        // Styling Header
        worksheet.getRow(1).font = { bold: true };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=merchants_export.xlsx');

        await workbook.xlsx.write(res);
        res.end();

        } catch (error: any) {
        return handleApiError(res, error, { area: 'merchants.export-selected', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to export merchants' });
    }
});

// Update Store Details & Sync to Merchants Table
app.patch('/stores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, cityId } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Store name is required' });
        }

        const updateData: any = { name };
        if (address !== undefined) updateData.address = address;
        if (cityId !== undefined) updateData.cityId = cityId;

        // 1. Update Postgres (Prisma)
        const updatedStore = await prisma.store.update({
            where: { id },
            data: updateData
        });

        // 2. Fetch Full Details for Sync (Need Manager & City)
        const fullStore = await prisma.store.findUnique({
            where: { id },
            include: {
                manager: true,
                city: true
            }
        });

        if (fullStore && fullStore.manager) {
            // 3. Sync to Supabase 'merchants' table (Used by Admin Dashboard)
            const merchantPayload = {
                id: fullStore.id,
                store_name: fullStore.name,
                owner_name: fullStore.manager.name || 'Unknown',
                email: fullStore.manager.email,
                phone: fullStore.manager.phone || '',
                city: fullStore.city?.name || 'Unknown', // Assuming included city has name
                address: fullStore.address,
                has_branches: false, // Default
                status: fullStore.active ? 'active' : 'inactive',
                updatedAt: new Date().toISOString()
            };

            // Phase 9 (2026-06-13): use the service-role client, not the anon
            // client. The API's `supabase` is the ANON key (index.ts:78), so
            // this sync only worked because merchants had "Enable all operations
            // for anon" RLS — the exact hole Phase 9 closes. supabaseAdmin
            // (service_role) writes regardless of grants, so this keeps working
            // after the merchants write-lockdown lands.
            const { error: syncError } = await supabaseAdmin
                .from('merchants')
                .upsert(merchantPayload, { onConflict: 'id' });

            if (syncError) {
                console.error('Failed to sync to merchants table:', syncError);
                // Don't fail the request, just log it.
                // In production, might want a queue or retry mechanism.
            } else {
                console.log('Synced store update to merchants table:', fullStore.name);
            }
        }

        // Audit Log
        logAudit(id, 'UPDATE_STORE', Object.keys(updateData).join(','), null, JSON.stringify(updateData), 'Merchant App').catch(() => { });

        res.json(updatedStore);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'stores', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to update store details' });
    }
});

// --- Coupon Routes ---

// List Coupons (with filtering)
app.get('/coupons', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.create_edit_delete'); if (!caller) return;
        const { storeId, isActive, fundingSource, search } = req.query;

        const where: any = {};
        // Prisma `where` uses model fields (camelCase), not @map column names.
        if (storeId) where.storeId = String(storeId);
        if (isActive !== undefined) where.isActive = isActive === 'true';
        if (fundingSource) where.fundingSource = String(fundingSource).toUpperCase();
        if (search) {
            where.code = { contains: String(search).toUpperCase(), mode: 'insensitive' };
        }

        // Phase 2 (2D) — by default exclude soft-deleted coupons. Admin can pass
        // ?includeArchived=true to see archived ones (for the Status=Archived filter
        // in the admin list view — added in Phase 3).
        if (req.query.includeArchived !== 'true') {
            (where as any).deletedAt = null;
        }

        const coupon = await prisma.coupon.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json({ data: coupon });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'coupons', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch coupon' });
    }
});

// Create Coupon
app.post('/coupon', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.create_edit_delete'); if (!caller) return;
        const {
            code,
            discountType,
            discountValue,
            maxDiscountCap,
            fundingSource,
            targetAudience,
            storeId,
            usageLimit,
            startDate,
            endDate,
            // coupon-engine fields
            minOrder, perCustomerLimit, bogoBuy, bogoGet,
            title, brandName, description, showLogo, logoUrl, autoCode,
            theme
        } = req.body;

        // theme validation — admin must pick one of the curated presets; default classic.
        const ALLOWED_THEMES = ['classic', 'bold', 'modern', 'festive'] as const;
        const themeValue = theme && ALLOWED_THEMES.includes(String(theme) as any)
            ? String(theme)
            : 'classic';

        const type = discountType ? String(discountType).toUpperCase() : '';

        // Validation
        if (!code || !type || !fundingSource || !targetAudience) {
            return res.status(400).json({ error: 'Missing required fields: code, discountType, fundingSource, targetAudience' });
        }
        if (type === 'BOGO') {
            if (!bogoBuy || !bogoGet) return res.status(400).json({ error: 'BOGO coupons require bogoBuy and bogoGet' });
        } else if (!discountValue) {
            return res.status(400).json({ error: 'discountValue is required for PERCENTAGE/FLAT coupons' });
        }

        // Check for duplicate code
        const existing = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
        if (existing) {
            return res.status(409).json({ error: `Coupon code "${code}" already exists.` });
        }

        // If storeId is provided, verify it exists
        if (storeId) {
            const store = await prisma.store.findUnique({ where: { id: storeId } });
            if (!store) {
                return res.status(404).json({ error: 'Store not found' });
            }
        }

        const coupon = await prisma.coupon.create({
            data: {
                code: code.toUpperCase(),
                discountType: type as any,
                discountValue: discountValue != null ? Number(discountValue) : 0,
                maxDiscountCap: maxDiscountCap ? Number(maxDiscountCap) : null,
                fundingSource: String(fundingSource).toUpperCase() as any,
                targetAudience: String(targetAudience).toUpperCase() as any,
                storeId: storeId || null,
                usageLimit: usageLimit ? parseInt(usageLimit) : null,
                startDate: startDate ? new Date(startDate) : new Date(),
                endDate: endDate ? new Date(endDate) : null,
                minOrder: minOrder != null ? Number(minOrder) : null,
                perCustomerLimit: perCustomerLimit != null ? parseInt(perCustomerLimit) : null,
                bogoBuy: bogoBuy != null ? parseInt(bogoBuy) : null,
                bogoGet: bogoGet != null ? parseInt(bogoGet) : null,
                title: title || null,
                brandName: brandName || null,
                description: description || null,
                showLogo: showLogo != null ? Boolean(showLogo) : true,
                logoUrl: logoUrl || null,
                autoCode: autoCode != null ? Boolean(autoCode) : false,
                theme: themeValue,
                updatedAt: new Date(),
            }
        });

        await writeAuditLog(caller.id, 'coupon.create', 'coupon', coupon.id, null, coupon);

        res.status(201).json(coupon);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'coupon', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to create coupon' });
    }
});

// Update Coupon
app.patch('/coupon/:id', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.create_edit_delete'); if (!caller) return;
        const { id } = req.params;
        const updateData: any = {};

        const allowedFields = ['code', 'discountType', 'discountValue', 'maxDiscountCap',
            'fundingSource', 'targetAudience', 'storeId', 'isActive', 'usageLimit', 'startDate', 'endDate',
            // coupon-engine fields
            'minOrder', 'perCustomerLimit', 'bogoBuy', 'bogoGet', 'title', 'brandName', 'description', 'showLogo', 'logoUrl', 'autoCode',
            'theme'];
        const ALLOWED_THEMES_PATCH = ['classic', 'bold', 'modern', 'festive'];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                let value = req.body[field];
                let prismaField = field; // Use camelCase directly for Prisma

                if (['discountType', 'fundingSource', 'targetAudience'].includes(field)) {
                    value = String(value).toUpperCase();
                }
                if (field === 'code') value = String(value).toUpperCase();
                if (['discountValue', 'maxDiscountCap', 'minOrder'].includes(field)) {
                    value = value === null ? null : parseFloat(value);
                }
                if (['usageLimit', 'perCustomerLimit', 'bogoBuy', 'bogoGet'].includes(field)) {
                    value = value === null ? null : parseInt(value);
                }
                if (['showLogo', 'autoCode'].includes(field)) {
                    value = Boolean(value);
                }
                if (['startDate', 'endDate'].includes(field)) {
                    value = value === null ? null : new Date(value);
                }
                if (field === 'theme') {
                    // silently fall back to 'classic' if an unknown theme id sneaks through
                    value = ALLOWED_THEMES_PATCH.includes(String(value)) ? String(value) : 'classic';
                }
                updateData[prismaField] = value;
            }
        }

        const existing = await prisma.coupon.findUnique({ where: { id } });

        const coupon = await prisma.coupon.update({
            where: { id },
            data: updateData
        });

        await writeAuditLog(caller.id, 'coupon.update', 'coupon', id, existing, coupon);

        res.json(coupon);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'coupon', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to update coupon' });
    }
});

// Delete Coupon
app.delete('/coupon/:id', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.create_edit_delete'); if (!caller) return;
        const { id } = req.params;
        const existing = await prisma.coupon.findUnique({ where: { id } });
        await prisma.coupon.update({ where: { id }, data: { deletedAt: new Date() } });
        await writeAuditLog(caller.id, 'coupon.archive', 'coupon', id, existing, null);
        res.json({ message: 'Coupon deleted successfully' });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'coupon', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to delete coupon' });
    }
});

// List coupons the logged-in customer is eligible to see on checkout.
// Filters: active + within validity window + audience matches + store-scope respected.
// Audience math is done once per request (1 aggregate query for the user) and applied in-memory.
app.get('/coupons/available', async (req, res) => {
    try {
        const u = await requireUser(req, res); if (!u) return;
        const storeId = typeof req.query.storeId === 'string' && req.query.storeId.length > 0 ? req.query.storeId : null;
        const now = new Date();

        // Pull every coupon currently in its validity window. Audience filter applied below.
        const candidates = await prisma.coupon.findMany({
            where: {
                isActive: true,
                startDate: { lte: now },
                deletedAt: null, // Phase 2 (2D) — customers must NEVER see archived coupons. Unconditional.
                AND: [
                    { OR: [{ endDate: null }, { endDate: { gt: now } }] },
                    storeId
                        ? { OR: [{ storeId: null }, { storeId }] }
                        : { storeId: null },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });

        // Determine the caller's audience-eligibility ONCE (avoids N+1 per coupon).
        const stats = await prisma.order.aggregate({
            where: { userId: u.id },
            _count: { _all: true },
            _max: { createdAt: true },
        });
        const orderCount = stats._count._all;
        const lastOrderAt = stats._max.createdAt;
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const isNew = orderCount === 0;
        const isInactive = orderCount > 0 && !!lastOrderAt && lastOrderAt < thirtyDaysAgo;

        // Also respect usageLimit at list-time so we don't show "Sold out" coupons.
        const eligible = candidates.filter((c) => {
            if (c.usageLimit !== null && c.usageLimit !== undefined && c.usedCount >= c.usageLimit) return false;
            if (c.targetAudience === 'ALL') return true;
            if (c.targetAudience === 'NEW_USERS') return isNew;
            if (c.targetAudience === 'INACTIVE_USERS') return isInactive;
            return false;
        });

        res.json({ data: eligible });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'coupons.available', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch available coupons' });
    }
});

// Validate Coupon (for Consumer Checkout)
app.post('/checkout/validate-coupon', async (req, res) => {
    try {
        const u = await requireUser(req, res); if (!u) return;
        // Phase 2 (2I) — per-user rate limit (10/min). Defensive backstop for abuse.
        if (!checkRateLimit(`coupon:validate:${u.id}`, 10)) {
            return res.status(429).json({ error: 'Too many coupon validation requests. Please wait a moment and try again.' });
        }
        // Phase 2 (2E-1) — body shape extended: cartItems[]/storeIds/orderType are
        // the new shape. Legacy clients still send code + cartTotal — both work.
        const { code, cartTotal: clientCartTotal, cartItems, storeIds, orderType, storeId } = req.body;
        const userId = u.id; // derived from verified token, NOT trusted from body

        if (!code) {
            return res.status(400).json({ error: 'code is required' });
        }
        // Phase 2 (2E-1) — server-side cart total. If the client sends cartItems[],
        // we recompute and IGNORE the client-supplied cartTotal (anti-spoof). Legacy
        // clients that send only cartTotal continue to work — fall back to that value.
        const hasCartItems = Array.isArray(cartItems) && cartItems.length > 0;
        if (!hasCartItems && (typeof clientCartTotal === 'undefined' || clientCartTotal === null)) {
            return res.status(400).json({ error: 'cartItems[] or cartTotal is required' });
        }

        // Phase 2L hot-fix (2026-06-09) — server-side price reconciliation.
        // Adversarial pre-merge review (PR #1, medium #11) found that
        // effectiveCartTotal + BOGO were computed from client-supplied unit
        // prices in cartItems[] with no server-side reconciliation. The HMAC
        // token then signed the client-trusted discount, polluting analytics +
        // PLATFORM-funded settlement math. Fix: when cartItems[] is present,
        // fetch StoreProduct.price for every storeProductId; require
        // storeProductId on every item; reject if any item references a
        // missing/deleted/inactive product. Trusted prices are used everywhere
        // below (effectiveCartTotal + BOGO) instead of item.price.
        //
        // Strict policy ("no temporary patches" per Pranav 2026-06-09): if
        // cartItems[] is provided but ANY item lacks storeProductId or its
        // product can't be resolved, reject the whole request. No silent fallback
        // to client prices — that's exactly the gap this hot-fix closes.
        let trustedPrices: Map<string, number> | null = null;
        // Phase 5 (2026-06-09) — server-side store attribution per item.
        // Maps storeProductId → { branchId, storeId } from the StoreProduct row
        // (never from client input). Drives: (a) server-derived store ids for
        // the eligibleVerticals check (fixes the latent bug where clients sent
        // branch UUIDs and prisma.store.findMany matched nothing), and (b) the
        // multi-store discount allocation breakdown.
        // Phase 2 FINAL — B6 (2026-06-16): storeId is now derived via the branch's
        // merchant_branches.store_id (the canonical link added in B1/B2/B5),
        // not from the vestigial StoreProduct.storeId (dropped in B10).
        let storeAttribution: Map<string, { branchId: string | null; storeId: string | null }> | null = null;
        if (hasCartItems) {
            const storeProductIds: string[] = [];
            for (const item of cartItems) {
                const id = item?.storeProductId;
                if (!id) {
                    return res.status(400).json({
                        valid: false,
                        error: 'Every cart item must include storeProductId so the server can verify price. Please refresh your cart.',
                    });
                }
                storeProductIds.push(String(id));
            }
            // Single query fetches all server-trusted prices. Filter deleted /
            // inactive — those shouldn't be orderable; if they're in the cart,
            // the user must refresh.
            const rows = await prisma.storeProduct.findMany({
                where: { id: { in: storeProductIds }, is_deleted: false, active: true },
                select: {
                    id: true,
                    price: true,
                    branch_id: true,
                    merchant_branches: { select: { storeId: true } },
                },
            });
            trustedPrices = new Map(rows.map((r) => [r.id, Number(r.price) || 0]));
            storeAttribution = new Map(rows.map((r) => [
                r.id,
                { branchId: r.branch_id ?? null, storeId: r.merchant_branches?.storeId ?? null },
            ]));
            const missing = storeProductIds.filter((id) => !trustedPrices!.has(id));
            if (missing.length > 0) {
                return res.status(400).json({
                    valid: false,
                    error: 'One or more cart items reference a product that is no longer available. Please refresh your cart.',
                });
            }
        }

        // Phase 2L — effectiveCartTotal now uses server-trusted prices
        // (trustedPrices Map keyed by storeProductId) rather than item.price.
        const effectiveCartTotal: number = hasCartItems
            ? cartItems.reduce(
                (sum: number, item: any) => sum + (trustedPrices!.get(String(item.storeProductId)) || 0) * (Number(item?.quantity) || 0),
                0,
            )
            : (Number(clientCartTotal) || 0);

        // Phase 2 (2E-1) — exclude archived coupons (deletedAt set by sub-task 2D).
        const coupon = await prisma.coupon.findFirst({ where: { code: String(code).toUpperCase(), deletedAt: null } });

        if (!coupon) {
            return res.status(404).json({ valid: false, error: 'Invalid coupon code' });
        }

        // Check active
        if (!coupon.isActive) {
            return res.status(400).json({ valid: false, error: 'This coupon is no longer active' });
        }

        // Check expiration
        if (coupon.endDate && new Date() > coupon.endDate) {
            return res.status(400).json({ valid: false, error: 'This coupon has expired' });
        }

        // Check start date
        if (new Date() < coupon.startDate) {
            return res.status(400).json({ valid: false, error: 'This coupon is not yet active' });
        }

        // Check usage limit
        if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
            return res.status(400).json({ valid: false, error: 'This coupon has reached its usage limit' });
        }

        // Phase 2 (2E-2) — daily usage limit (IST midnight reset). Counter logically
        // resets at IST midnight; if dailyUsageResetAt is from before today, treat
        // count as 0. The actual reset happens at redeem-time (Phase 2F transaction).
        if (coupon.dailyUsageLimit) {
            const now = new Date();
            const istNow = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
            const istMidnightUtcMs = Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
            const istMidnightToday = new Date(istMidnightUtcMs);
            const counterIsCurrent = coupon.dailyUsageResetAt && coupon.dailyUsageResetAt >= istMidnightToday;
            const effectiveDailyCount = counterIsCurrent ? coupon.dailyUsageCount : 0;
            if (effectiveDailyCount >= coupon.dailyUsageLimit) {
                return res.status(400).json({ valid: false, error: 'This coupon has reached its daily usage limit. Please try again tomorrow.' });
            }
        }

        // Check store-specific restriction
        if (coupon.storeId && storeId && coupon.storeId !== storeId) {
            return res.status(400).json({ valid: false, error: 'This coupon is not valid for this store' });
        }

        // Phase 2 (2E-2) — vertical scope. If coupon.eligibleVerticals is non-empty,
        // every cart store's vertical must be in the allowlist (vertical IDs).
        //
        // Phase 5 (2026-06-09): when cartItems[] is present, derive the Store ids
        // SERVER-SIDE from StoreProduct.storeId (storeAttribution map) instead of
        // trusting the client's storeIds[]. Fixes the latent bug where the
        // consumer-app sent branch UUIDs (cart item .storeId) which never matched
        // prisma.store rows, silently rejecting every verticals-scoped coupon —
        // and closes the "lie about storeIds to bypass eligibility" hole.
        // Legacy clients (cartTotal-only, no cartItems) keep the old client-supplied
        // path since there's nothing server-side to derive from.
        // Phase 2 FINAL — F3 (2026-06-16): FAIL CLOSED. Compute the unresolvable
        // flag from the RAW attribution values (before filtering nulls). A null
        // storeId means the cart item's branch isn't linked to a Store, so we
        // CANNOT prove it sits in an allowed vertical. The pre-F3 code silently
        // dropped such items from the check (fail OPEN) — a money-path hole that
        // activates the moment any branch has a null store_id.
        const rawServerStoreIds: (string | null)[] = storeAttribution
            ? Array.from(storeAttribution.values()).map((a) => a.storeId)
            : [];
        const hasUnresolvableStore: boolean = storeAttribution
            ? rawServerStoreIds.some((id) => !id)
            : false;
        const serverStoreIds: string[] = Array.from(new Set(
            rawServerStoreIds.filter((id): id is string => !!id),
        ));
        const verticalCheckStoreIds: string[] = storeAttribution
            ? serverStoreIds
            : (Array.isArray(storeIds) ? storeIds.map((s: any) => String(s)) : []);
        if (coupon.eligibleVerticals && coupon.eligibleVerticals.length > 0) {
            // F3: on the server-derived path, reject if ANY cart item's store is
            // unresolvable — even when that leaves zero resolvable stores to check
            // (the all-null case the old `length > 0` guard let slip through).
            if (hasUnresolvableStore) {
                return res.status(400).json({ valid: false, error: 'This coupon is not valid for one or more stores in your cart' });
            }
            if (verticalCheckStoreIds.length > 0) {
                const cartStores = await prisma.store.findMany({
                    where: { id: { in: verticalCheckStoreIds } },
                    select: { id: true, verticalId: true },
                });
                const allowedVerticalIds = new Set(coupon.eligibleVerticals);
                const allMatch = cartStores.length === verticalCheckStoreIds.length
                    && cartStores.every((s) => !!s.verticalId && allowedVerticalIds.has(s.verticalId));
                if (!allMatch) {
                    return res.status(400).json({ valid: false, error: 'This coupon is not valid for one or more stores in your cart' });
                }
            }
        }

        // Phase 2 (2E-2) — order type restriction (PICKUP / DINE_IN). Empty = no
        // restriction. If set, the requested orderType must be in the allowlist.
        if (coupon.eligibleOrderTypes && coupon.eligibleOrderTypes.length > 0 && orderType) {
            if (!coupon.eligibleOrderTypes.includes(String(orderType))) {
                return res.status(400).json({ valid: false, error: `This coupon is only valid for ${coupon.eligibleOrderTypes.join(', ')} orders` });
            }
        }

        // Check audience (requires userId for NEW_USERS check)
        if (coupon.targetAudience === 'NEW_USERS' && userId) {
            const orderCount = await prisma.order.count({ where: { userId: userId } });
            if (orderCount > 0) {
                return res.status(400).json({ valid: false, error: 'This coupon is only for new users' });
            }
        }

        // Check minimum order value (Phase 2 2E-1: server-recomputed total)
        if (coupon.minOrder && Number(effectiveCartTotal) < coupon.minOrder) {
            return res.status(400).json({ valid: false, error: `Minimum order of ₹${coupon.minOrder} required to use this coupon` });
        }

        // Check per-customer limit (counts this user's prior redemptions)
        if (coupon.perCustomerLimit && userId) {
            const usedByUser = await prisma.couponRedemption.count({ where: { couponId: coupon.id, userId } });
            if (usedByUser >= coupon.perCustomerLimit) {
                return res.status(400).json({ valid: false, error: 'You have already used this coupon the maximum number of times' });
            }
        }

        // Calculate discount
        let discount = 0;
        let bogo: { buy: number; get: number } | null = null;
        if (coupon.discountType === 'PERCENTAGE') {
            discount = (Number(effectiveCartTotal) * coupon.discountValue) / 100;
            if (coupon.maxDiscountCap) {
                discount = Math.min(discount, coupon.maxDiscountCap);
            }
        } else if (coupon.discountType === 'BOGO') {
            const buy = Number(coupon.bogoBuy ?? 1);
            const get = Number(coupon.bogoGet ?? 1);
            bogo = { buy, get };

            // Phase 2 (2E-3) — server-side BOGO discount computation.
            // When cartItems[] is provided (new shape), server computes the ₹ saving.
            // Legacy clients (no cartItems[]) still receive just the buy/get rule and
            // compute the saving themselves — discount stays 0 in that case (backward-compat).
            if (hasCartItems) {
                const batchSize = buy + get;
                const mode = String(coupon.bogoMode || 'CHEAPEST').toUpperCase();
                if (mode === 'SAME_PRODUCT') {
                    // Group items by storeProductId. For each group with
                    // quantity >= batchSize, discount `get` units per complete
                    // batch at that product's server-trusted price.
                    //
                    // Phase 2L: keyed on storeProductId only (legacy fallbacks to
                    // id/name removed) — server-trusted prices require the FK.
                    // Validated above; trustedPrices is non-null here.
                    const groups = new Map<string, { price: number; quantity: number }>();
                    for (const item of cartItems) {
                        const key = String(item.storeProductId);
                        const price = trustedPrices!.get(key) || 0;
                        const qty = Number(item?.quantity) || 0;
                        const existing = groups.get(key);
                        if (existing) { existing.quantity += qty; }
                        else { groups.set(key, { price, quantity: qty }); }
                    }
                    for (const g of groups.values()) {
                        const completeBatches = Math.floor(g.quantity / batchSize);
                        discount += completeBatches * get * g.price;
                    }
                } else {
                    // CHEAPEST mode (default per business config) — expand all cart items
                    // to per-unit prices, sort ascending, then for every batch of
                    // (buy+get) units, discount the first `get` (cheapest) units.
                    //
                    // Phase 2L: uses server-trusted prices (trustedPrices map)
                    // instead of item.price. trustedPrices is non-null here.
                    const unitPrices: number[] = [];
                    for (const item of cartItems) {
                        const price = trustedPrices!.get(String(item.storeProductId)) || 0;
                        const qty = Number(item?.quantity) || 0;
                        for (let i = 0; i < qty; i++) unitPrices.push(price);
                    }
                    unitPrices.sort((a, b) => a - b);
                    for (let i = 0; i + batchSize <= unitPrices.length; i += batchSize) {
                        for (let j = 0; j < get; j++) discount += unitPrices[i + j];
                    }
                }
                // Apply maxDiscountCap if set — admin can cap BOGO discount value too.
                if (coupon.maxDiscountCap) {
                    discount = Math.min(discount, coupon.maxDiscountCap);
                }
            }
        } else {
            discount = coupon.discountValue; // FLAT
        }

        // Don't let discount exceed cart total (Phase 2 2E-1: server-recomputed)
        discount = Math.min(discount, Number(effectiveCartTotal));

        // Phase 2 (2E-4) — sign a 10-min HMAC token binding (couponId, userId,
        // cartHash, discount, fundingSource, discountType). POST /orders verifies
        // this before applying the discount — closes the cart-spoof attack.
        const roundedDiscount = Math.round(discount * 100) / 100;
        const cartHash = computeCartHash(hasCartItems ? cartItems : []);

        // ── Phase 5 (2026-06-09) — multi-store discount allocation ──────────
        // When the cart spans >1 store, split the total discount proportionally
        // to each store's server-trusted subtotal (last store absorbs the
        // rounding residual) and sign the breakdown into the token. POST /orders
        // (called once per store) matches its items to one breakdown entry and
        // snapshots that store's slice. Allocation is purely monetary — BOGO
        // savings computed across the whole cart are split by subtotal share
        // like any other discount type (item-level attribution is not needed
        // for settlement math).
        type StoreSlice = {
            branchId: string | null;
            // Phase 2 FINAL — B6 (2026-06-16): nullable because the source is now
            // merchant_branches.store_id (NULL for the 21 orphan/test branches).
            // In practice every cart-item path leads to a real Store (branches
            // with StoreProducts always have a parent Store).
            storeId: string | null;
            storeProductIds: string[];
            // Phase 5 re-audit fix R3 (2026-06-10): "spid:qty" pairs — signed
            // into the token so POST /orders can bind quantities, not just the
            // product-id set (a stripped-quantity order must not book the slice).
            spidQty: string[];
            subtotal: number;
            discount: number;
        };
        let perStoreBreakdown: StoreSlice[] | null = null;
        let cartFingerprint: string | null = null;
        // R2 (2026-06-10): for multi-store, the authoritative signed discount is
        // the SUM of allocated slices (exact by construction), not the
        // pre-allocation rounded figure.
        let multiStoreSignedDiscount: number | null = null;
        if (hasCartItems && storeAttribution) {
            // Group items by branch (falls back to storeId when branch_id is
            // null) using SERVER-side attribution — never client input.
            const groups = new Map<string, StoreSlice>();
            for (const item of cartItems) {
                const spid = String(item.storeProductId);
                const attr = storeAttribution.get(spid)!; // presence validated in Phase 2L block
                // Group key: prefer branchId (NOT NULL after B9), fall back to
                // storeId, then spid as the ultimate guard so the key is always
                // a non-null string.
                const key = attr.branchId ?? attr.storeId ?? spid;
                let g = groups.get(key);
                if (!g) {
                    g = { branchId: attr.branchId, storeId: attr.storeId, storeProductIds: [], spidQty: [], subtotal: 0, discount: 0 };
                    groups.set(key, g);
                }
                g.storeProductIds.push(spid);
                g.spidQty.push(`${spid}:${Number(item?.quantity) || 0}`);
                g.subtotal += (trustedPrices!.get(spid) || 0) * (Number(item?.quantity) || 0);
            }

            if (groups.size > 1) {
                // Q2 (approved 2026-06-09): store-scoped coupons reject multi-store
                // carts outright — cart-level semantics, no partial application.
                if (coupon.storeId) {
                    return res.status(400).json({
                        valid: false,
                        error: 'This coupon is valid for a single store only. Please remove items from other stores to use it.',
                    });
                }
                // Q1 (approved 2026-06-09): per-store minOrder. If ANY store's
                // subtotal is below the coupon's minOrder, reject the whole
                // coupon with a clear error (no skip-store half-application).
                if (coupon.minOrder) {
                    const violating = Array.from(groups.values()).find((g) => g.subtotal < coupon.minOrder!);
                    if (violating) {
                        return res.status(400).json({
                            valid: false,
                            error: `Each store in your cart needs a minimum of ₹${coupon.minOrder} for this coupon. Please add more items or remove the coupon.`,
                        });
                    }
                }

                // Proportional allocation — largest-remainder method, in paise.
                //
                // Phase 5 audit fix #3 (2026-06-10): the previous "round each
                // slice, last store absorbs residual" could sign a NEGATIVE last
                // slice (repro: FLAT ₹1.99 over subtotals [100,100,100,100,1] →
                // [0.50,0.50,0.50,0.50,−0.01]). Largest-remainder guarantees:
                // every slice >= 0, slices sum EXACTLY to the signed total, and
                // the leftover paise go to the largest fractional remainders
                // (with per-store subtotal headroom respected) instead of an
                // arbitrary last store.
                const slices = Array.from(groups.values());
                const totalSubtotal = slices.reduce((s, g) => s + g.subtotal, 0);
                const totalPaise = Math.round(roundedDiscount * 100);
                const exact = slices.map((g) => (totalSubtotal > 0 ? (totalPaise * g.subtotal) / totalSubtotal : 0));
                const floors = exact.map((x) => Math.floor(x));
                let leftover = totalPaise - floors.reduce((s, x) => s + x, 0);
                // Hand out leftover paise to the largest fractional remainders,
                // skipping stores already at their subtotal cap.
                const order = exact
                    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
                    .sort((a, b) => b.frac - a.frac);
                const paise = floors.slice();
                for (let round = 0; leftover > 0 && round < slices.length * 2; round++) {
                    for (const { i } of order) {
                        if (leftover <= 0) break;
                        // Phase 5 re-audit fix R2 (2026-06-10): Math.round, not
                        // Math.floor — float-dirty subtotals (33.33*100 =
                        // 3332.999…) under-computed caps by a paisa and stranded
                        // 1-2 paise at the 100%-discount edge.
                        const capPaise = Math.round(slices[i].subtotal * 100);
                        if (paise[i] < capPaise) {
                            paise[i] += 1;
                            leftover -= 1;
                        }
                    }
                }
                for (let i = 0; i < slices.length; i++) {
                    slices[i].discount = paise[i] / 100;
                }
                perStoreBreakdown = slices;
                // Phase 5 re-audit fix R2 (2026-06-10): the exact-sum invariant
                // is now enforced BY CONSTRUCTION — the signed/charged total is
                // the sum of the allocated slices, so the token discount, the
                // client charge, and the per-order snapshots can never disagree
                // even if cap-exhaustion strands paise. Observable via Sentry
                // when it deviates from the pre-allocation total.
                const allocatedTotal = paise.reduce((s, x) => s + x, 0) / 100;
                if (leftover > 0 || Math.round(allocatedTotal * 100) !== totalPaise) {
                    console.warn(`[validate-coupon] Phase 5 allocation residual: leftover=${leftover} paise, allocated=₹${allocatedTotal} vs requested=₹${roundedDiscount}`);
                    try { Sentry.captureMessage('phase5: allocation residual paise', { level: 'warning', extra: { leftover, allocatedTotal, roundedDiscount } }); } catch {}
                }
                multiStoreSignedDiscount = allocatedTotal;

                // Cart fingerprint — dedup key for the single CouponRedemption
                // row that covers all of this cart's orders. Integrity comes from
                // the token signature (the fingerprint is inside the signed
                // payload), so a plain SHA-256 suffices.
                //
                // Phase 5 audit fix #1 (2026-06-10): a per-validation random nonce
                // (jti) is folded into the hash. Without it, re-ordering the
                // IDENTICAL cart with the same coupon days later produced the SAME
                // fingerprint — the second checkout's INSERT hit ON CONFLICT, took
                // the append path, and usedCount/dailyUsageCount/perCustomerLimit
                // never incremented (full usage-limit bypass with the stock app).
                // One checkout = one token = one jti = one fingerprint; retries of
                // the same checkout's N per-store orders still dedup onto one row,
                // while distinct checkouts can never collide.
                const fingerprintJti = crypto.randomUUID();
                cartFingerprint = crypto.createHash('sha256')
                    .update(`${coupon.id}|${userId}|${cartHash}|${fingerprintJti}`)
                    .digest('hex');
            }
        }

        // R2 (2026-06-10): for multi-store carts the signed total is the exact
        // sum of the allocated slices.
        const signedDiscount = multiStoreSignedDiscount ?? roundedDiscount;
        const tokenPayload: Record<string, any> = {
            couponId: coupon.id,
            userId,
            cartHash,
            discount: signedDiscount,
            fundingSource: coupon.fundingSource,
            discountType: coupon.discountType,
            exp: Math.floor(Date.now() / 1000) + 10 * 60,
            iat: Math.floor(Date.now() / 1000),
        };
        if (perStoreBreakdown) {
            // Phase 5 — multi-store fields. Single-store tokens stay byte-
            // compatible with Phase 4 (no new fields) for backward compat.
            // R3 (2026-06-10): spidQty (sorted "spid:qty" pairs) binds
            // quantities into the signed entry so POST /orders can verify the
            // order's items, not just its product-id set.
            tokenPayload.breakdown = perStoreBreakdown.map((s) => ({
                branchId: s.branchId,
                storeId: s.storeId,
                storeProductIds: s.storeProductIds,
                spidQty: [...s.spidQty].sort(),
                subtotal: Math.round(s.subtotal * 100) / 100,
                discount: s.discount,
            }));
            tokenPayload.fingerprint = cartFingerprint;
        }
        const validationToken = signCouponToken(tokenPayload);

        res.json({
            valid: true,
            couponId: coupon.id,
            code: coupon.code,
            // R2 (2026-06-10): exact sum of slices for multi-store carts.
            discount: signedDiscount,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            maxDiscountCap: coupon.maxDiscountCap,
            bogo,
            fundingSource: coupon.fundingSource,
            minOrder: coupon.minOrder ?? null,
            validationToken,
            // Phase 5 — present only for multi-store carts. storeProductIds is
            // included so the client can match each per-store order to its slice
            // with the SAME currency the server uses (audit fix #4 — the client
            // must use this split, never recompute its own).
            multiStore: !!perStoreBreakdown,
            perStoreBreakdown: perStoreBreakdown
                ? perStoreBreakdown.map((s) => ({ branchId: s.branchId, storeId: s.storeId, storeProductIds: s.storeProductIds, subtotal: Math.round(s.subtotal * 100) / 100, discount: s.discount }))
                : undefined,
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'checkout.validate-coupon', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to validate coupon' });
    }
});

// Redeem a coupon — records the usage atomically. Call this at order placement.
// Idempotent on orderId so retries (or the webhook backstop) can't double-count.
app.post('/coupons/redeem', async (req, res) => {
    try {
        const u = await requireUser(req, res); if (!u) return;
        // Phase 2 (2I) — per-user rate limit (5/min). Tighter than validate.
        if (!checkRateLimit(`coupon:redeem:${u.id}`, 5)) {
            return res.status(429).json({ error: 'Too many coupon redemption attempts. Please wait a moment and try again.' });
        }
        const { code, orderId, issuedCode } = req.body;
        const userId = u.id; // derived from verified token, NOT trusted from body
        if (!code) {
            return res.status(400).json({ error: 'code is required' });
        }

        // Phase 2 (2G) — backward-compat shim. If POST /orders already wrote a
        // redemption (Phase 2F's transactional path), return alreadyRedeemed
        // immediately. Prevents legacy consumer-app builds (pre-Phase-4 OTA)
        // from double-counting when they call this AFTER their /orders call.
        //
        // Phase 2K hot-fix (2026-06-09): adversarial review (PR #1) found the
        // shim returned alreadyRedeemed based only on orderCouponId presence —
        // any authed user could probe arbitrary orderIds to detect order
        // existence + coupon-applied status. Fix: (1) scope the lookup to
        // orders owned by THIS user, (2) require the request's code to match
        // the stored orderCouponCode. If either fails, fall through to the
        // normal redemption path instead of leaking alreadyRedeemed.
        if (orderId) {
            const orderRow = await prisma.order.findFirst({
                where: { id: orderId, userId: u.id },
                select: { orderCouponId: true, orderCouponCode: true },
            });
            if (
                orderRow?.orderCouponId &&
                orderRow.orderCouponCode &&
                orderRow.orderCouponCode.toUpperCase() === String(code).toUpperCase()
            ) {
                return res.status(200).json({ alreadyRedeemed: true, source: 'phase2f' });
            }
        }

        // Phase 2K hot-fix (2026-06-09): filter soft-deleted coupons. Previously
        // legacy /coupons/redeem used findUnique on code only — an archived
        // (deletedAt set) coupon could still be redeemed by clients holding the
        // code. GET /coupons/available + /checkout/validate-coupon already
        // filter correctly; only this legacy path was leaky.
        const coupon = await prisma.coupon.findFirst({
            where: { code: String(code).toUpperCase(), deletedAt: null },
        });
        if (!coupon) return res.status(404).json({ error: 'Invalid coupon code' });

        // Idempotency: if this order already redeemed this coupon, return the existing record.
        if (orderId) {
            const existing = await prisma.couponRedemption.findFirst({ where: { couponId: coupon.id, orderId } });
            if (existing) return res.status(200).json({ redemptionId: existing.id, alreadyRedeemed: true });
        }

        // Record redemption + bump usedCount in one transaction.
        // Round-6 (XC2): the new partial unique index on
        // coupon_redemptions(coupon_id, order_id) WHERE order_id IS NOT NULL
        // makes the parallel-redeem race surface as Prisma P2002 on the
        // second writer. Catch that and return the existing redemption
        // (idempotent 200) — mirrors the line 4764-4765 fast path.
        //
        // Phase 2K hot-fix (2026-06-09): adversarial review (PR #1) found that
        // this legacy path was incrementing usedCount with no CAS and ignoring
        // dailyUsageCount/dailyUsageResetAt entirely. Until consumer-app OTA
        // rolls AND REQUIRE_COUPON_TOKEN=true, most prod coupon traffic flows
        // here — so usageLimit + dailyUsageLimit were both silently bypassable.
        // Now mirrors Phase 2F's atomic compare-and-swap contract from POST /orders.
        let redemption: { id: string };
        try {
            redemption = await prisma.$transaction(async (tx) => {
                const r = await tx.couponRedemption.create({
                    data: { couponId: coupon.id, userId, orderId: orderId || null, issuedCode: issuedCode || null },
                });

                // Phase 2K — fetch caps inside the txn for atomic CAS.
                const couponRow = await tx.coupon.findUnique({
                    where: { id: coupon.id },
                    select: { usageLimit: true, dailyUsageLimit: true, dailyUsageResetAt: true, dailyUsageCount: true },
                });

                // Total usage limit — atomic compare-and-swap (mirrors POST /orders L2885).
                if (couponRow?.usageLimit) {
                    const u = await tx.coupon.updateMany({
                        where: { id: coupon.id, usedCount: { lt: couponRow.usageLimit } },
                        data: { usedCount: { increment: 1 } },
                    });
                    if (u.count === 0) {
                        throw new Error('Coupon usage limit reached');
                    }
                } else {
                    await tx.coupon.update({
                        where: { id: coupon.id },
                        data: { usedCount: { increment: 1 } },
                    });
                }

                // Daily usage limit with IST midnight reset (mirrors POST /orders L2901).
                if (couponRow?.dailyUsageLimit) {
                    const nowD = new Date();
                    const istNowD = new Date(nowD.getTime() + (5.5 * 60 * 60 * 1000));
                    const istMidnightUtcMsD = Date.UTC(istNowD.getUTCFullYear(), istNowD.getUTCMonth(), istNowD.getUTCDate(), 0, 0, 0, 0) - (5.5 * 60 * 60 * 1000);
                    const istMidnightTodayD = new Date(istMidnightUtcMsD);
                    // Step 1: reset stale counter.
                    await tx.coupon.updateMany({
                        where: { id: coupon.id, OR: [
                            { dailyUsageResetAt: null },
                            { dailyUsageResetAt: { lt: istMidnightTodayD } },
                        ] },
                        data: { dailyUsageCount: 0, dailyUsageResetAt: istMidnightTodayD },
                    });
                    // Step 2: atomic increment with limit check.
                    const d = await tx.coupon.updateMany({
                        where: { id: coupon.id, dailyUsageCount: { lt: couponRow.dailyUsageLimit } },
                        data: { dailyUsageCount: { increment: 1 } },
                    });
                    if (d.count === 0) {
                        throw new Error('Coupon daily usage limit reached');
                    }
                }

                return r;
            });
        } catch (err: any) {
            // P2002 = Prisma unique constraint violation. With the new index,
            // a parallel redeem for the same (couponId, orderId) hits this.
            if (err?.code === 'P2002' && orderId) {
                const existing = await prisma.couponRedemption.findFirst({ where: { couponId: coupon.id, orderId } });
                if (existing) {
                    return res.status(200).json({ redemptionId: existing.id, alreadyRedeemed: true });
                }
            }
            // Phase 2K — surface CAS limit-reached errors as 400 with the
            // friendly message (otherwise the outer catch buries them in a 500).
            if (err instanceof Error && (err.message === 'Coupon usage limit reached' || err.message === 'Coupon daily usage limit reached')) {
                return res.status(400).json({ error: err.message });
            }
            throw err;
        }

        res.status(201).json({ redemptionId: redemption.id, couponId: coupon.id });
    } catch (error) {
        console.error('Redeem Coupon Error:', error);
        Sentry.captureException(error, { tags: { area: 'coupons.redeem' } });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to redeem coupon' });
    }
});

// ============================================================================
// Phase 3 (3A) — Admin coupon endpoints.
// Reads (analytics, redemptions, audit log) use 'coupons.view_analytics'.
// Writes (check-code, upload-logo) use 'coupons.create_edit_delete'.
// ============================================================================

// Code uniqueness check — frontend debounces against this while typing in CouponBuilder.
app.get('/coupons/check-code', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.create_edit_delete'); if (!caller) return;
        const code = String(req.query.code || '').trim().toUpperCase();
        if (!code) return res.status(400).json({ error: 'code is required' });
        const existing = await prisma.coupon.findFirst({
            where: { code, deletedAt: null },
            select: { id: true },
        });
        res.json({ available: !existing });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'coupons.check-code', userMessage: 'Failed to check code' });
    }
});

// Per-coupon analytics — KPIs + time series + breakdowns. Feeds CouponDetailPage.
app.get('/admin/coupons/:id/analytics', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.view_analytics'); if (!caller) return;
        const { id } = req.params;

        const coupon = await prisma.coupon.findUnique({
            where: { id },
            select: {
                id: true, code: true, fundingSource: true, usedCount: true, usageLimit: true,
                dailyUsageLimit: true, dailyUsageCount: true, startDate: true, endDate: true,
                isActive: true, deletedAt: true, discountType: true, discountValue: true,
            },
        });
        if (!coupon) return res.status(404).json({ error: 'Coupon not found' });

        const allRedemptions = await prisma.couponRedemption.findMany({
            where: { couponId: id },
            select: {
                id: true, userId: true, orderId: true, discountAmount: true,
                fundingSource: true, createdAt: true,
            },
        });

        const totalRedemptions = allRedemptions.length;
        const totalDiscountValue = allRedemptions.reduce((sum, r) => sum + Number(r.discountAmount || 0), 0);
        const platformFundedTotal = allRedemptions
            .filter(r => r.fundingSource === 'PLATFORM')
            .reduce((sum, r) => sum + Number(r.discountAmount || 0), 0);
        const merchantFundedTotal = totalDiscountValue - platformFundedTotal;
        const uniqueCustomers = new Set(allRedemptions.map(r => r.userId)).size;
        const avgDiscountPerOrder = totalRedemptions > 0 ? totalDiscountValue / totalRedemptions : 0;

        // IST-bucketed daily time series
        const byDay = new Map<string, { redemptions: number; discount: number }>();
        for (const r of allRedemptions) {
            const d = new Date(r.createdAt);
            const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
            const key = ist.toISOString().slice(0, 10);
            const bucket = byDay.get(key) || { redemptions: 0, discount: 0 };
            bucket.redemptions += 1;
            bucket.discount += Number(r.discountAmount || 0);
            byDay.set(key, bucket);
        }
        const timeSeries = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, redemptions: v.redemptions, discount: Math.round(v.discount * 100) / 100 }));

        // Top stores via Order join
        const orderIdsList = allRedemptions.map(r => r.orderId).filter(Boolean) as string[];
        const orders = orderIdsList.length > 0
            ? await prisma.order.findMany({
                where: { id: { in: orderIdsList } },
                select: { id: true, storeId: true, order_type: true, store_name: true },
            })
            : [];
        const storeCount = new Map<string, { storeId: string; storeName: string | null; count: number }>();
        for (const o of orders) {
            const ex = storeCount.get(o.storeId) || { storeId: o.storeId, storeName: o.store_name, count: 0 };
            ex.count += 1;
            storeCount.set(o.storeId, ex);
        }
        const topStores = Array.from(storeCount.values()).sort((a, b) => b.count - a.count).slice(0, 10);

        // Top users
        const userCount = new Map<string, number>();
        for (const r of allRedemptions) userCount.set(r.userId, (userCount.get(r.userId) || 0) + 1);
        const topUserEntries = Array.from(userCount.entries()).sort(([, a], [, b]) => b - a).slice(0, 10);
        const topUserIds = topUserEntries.map(([uid]) => uid);
        const userRows = topUserIds.length > 0
            ? await prisma.user.findMany({
                where: { id: { in: topUserIds } },
                select: { id: true, name: true, phone: true },
            })
            : [];
        const userMap = new Map(userRows.map(u => [u.id, u]));
        const topUsers = topUserEntries.map(([uid, count]) => ({
            userId: uid,
            name: userMap.get(uid)?.name || null,
            phone: userMap.get(uid)?.phone || null,
            count,
        }));

        // Per-order-type breakdown
        const orderTypeBreakdown: Record<string, number> = {};
        for (const o of orders) {
            const k = o.order_type || 'pickup';
            orderTypeBreakdown[k] = (orderTypeBreakdown[k] || 0) + 1;
        }

        res.json({
            coupon,
            kpis: {
                totalRedemptions,
                totalDiscountValue: Math.round(totalDiscountValue * 100) / 100,
                platformFundedTotal: Math.round(platformFundedTotal * 100) / 100,
                merchantFundedTotal: Math.round(merchantFundedTotal * 100) / 100,
                uniqueCustomers,
                avgDiscountPerOrder: Math.round(avgDiscountPerOrder * 100) / 100,
            },
            timeSeries,
            topStores,
            topUsers,
            orderTypeBreakdown,
        });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'admin.coupons.analytics', userMessage: 'Failed to load coupon analytics' });
    }
});

// Paginated redemption ledger for one coupon.
app.get('/admin/coupons/:id/redemptions', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.view_analytics'); if (!caller) return;
        const { id } = req.params;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        const [items, total] = await Promise.all([
            prisma.couponRedemption.findMany({
                where: { couponId: id },
                orderBy: { createdAt: 'desc' },
                skip, take: limit,
                select: {
                    id: true, userId: true, orderId: true,
                    discountAmount: true, fundingSource: true, createdAt: true,
                },
            }),
            prisma.couponRedemption.count({ where: { couponId: id } }),
        ]);

        const userIds = Array.from(new Set(items.map(i => i.userId)));
        const orderIdsList = Array.from(new Set(items.map(i => i.orderId).filter(Boolean) as string[]));
        const [users, orders] = await Promise.all([
            userIds.length > 0
                ? prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, phone: true } })
                : Promise.resolve([] as any[]),
            orderIdsList.length > 0
                ? prisma.order.findMany({ where: { id: { in: orderIdsList } }, select: { id: true, orderNumber: true, totalAmount: true, store_name: true } })
                : Promise.resolve([] as any[]),
        ]);
        const userMap = new Map(users.map(u => [u.id, u]));
        const orderMap = new Map(orders.map(o => [o.id, o]));

        const enriched = items.map(i => ({
            ...i,
            user: userMap.get(i.userId) || null,
            order: i.orderId ? orderMap.get(i.orderId) || null : null,
        }));

        res.json({ data: enriched, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'admin.coupons.redemptions', userMessage: 'Failed to load redemptions' });
    }
});

// Audit log — paginated, optionally filtered by action prefix (e.g. 'coupon.').
app.get('/admin/audit-log', async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.view_analytics'); if (!caller) return;
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
        const skip = (page - 1) * limit;
        const actionPrefix = req.query.actionPrefix ? String(req.query.actionPrefix) : null;

        const where: any = actionPrefix ? { action: { startsWith: actionPrefix } } : {};
        const [items, total] = await Promise.all([
            prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
            prisma.auditLog.count({ where }),
        ]);

        res.json({ data: items, total, page, limit, totalPages: Math.ceil(total / limit) });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'admin.audit-log', userMessage: 'Failed to load audit log' });
    }
});

// Coupon logo upload to Supabase Storage 'coupons' bucket (per Pranav's choice — no AWS S3).
// Mirrors POST /products/upload-image. Requires create_edit_delete capability.
app.post('/coupons/upload-logo', upload.single('file'), async (req, res) => {
    try {
        const caller = await requireCapability(req, res, 'coupons.create_edit_delete'); if (!caller) return;
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const fileContent = fs.readFileSync(req.file.path);
        const safeName = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const fileName = `${Date.now()}-${safeName}`;
        const BUCKET_NAME = 'coupons';

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, fileContent, { contentType: req.file.mimetype, upsert: false });

        fs.unlinkSync(req.file.path);

        if (error) {
            const err = error as any;
            if (err.statusCode === '404' || err.error === 'Bucket not found') {
                return res.status(500).json({ error: `Bucket '${BUCKET_NAME}' not found. Create a PUBLIC Supabase Storage bucket named 'coupons'.` });
            }
            return res.status(500).json({ error: 'Supabase upload failed', details: error.message });
        }

        const { data: { publicUrl } } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
        res.json({ url: publicUrl });
    } catch (error: any) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return handleApiError(res, error, { area: 'coupons.upload-logo', userMessage: 'Failed to upload logo' });
    }
});

// --- DEBUG: Fix DB Route ---
// --- DEBUG: Fix DB Route ---
app.post('/debug/fix-db', async (req, res) => {
    // Disabled for security - manual activation bypassed kyc-decision approval flow
    res.status(403).json({ error: 'This debug route is disabled in production.' });
});

// --- DEBUG: List Merchants Route ---
app.get('/debug/list-merchants', async (req, res) => {
    try {
        const merchants: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM merchants`);
        // sanitize sensitive data if any
        res.json(merchants);
    } catch (e: any) {
        Sentry.captureException(e, { tags: { area: 'debug.list-merchants' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).json({ error: e.message });
    }
});

app.get('/debug/list-users', async (req, res) => {
    try {
        const users = await prisma.user.findMany();
        res.json(users);
    } catch (e: any) {
        Sentry.captureException(e, { tags: { area: 'debug.list-users' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).json({ error: e.message });
    }
});

// ==========================================
// --- WhatsApp OTP Authentication Routes ---
// ==========================================

// Test-phone OTP bypass: these numbers skip WhatsApp delivery (send-otp) and accept
// the fixed code 123456 (verify-otp). For app-store reviewers + internal signup-flow
// testing when WhatsApp/Wati is unavailable. NOT real users; suffix-matched to
// tolerate 91 / +91 prefixes. REMOVE post-testing (tracked in forlater.md).
const OTP_BYPASS_PHONES = ['9959777027', '9100117027'];
const OTP_BYPASS_CODE = '123456';
function isOtpBypassPhone(phone: string): boolean {
    const digits = String(phone || '').replace(/\D/g, '');
    return OTP_BYPASS_PHONES.some(p => digits.endsWith(p));
}

/**
 * POST /auth/send-otp
 * Generate a 6-digit OTP and send via WhatsApp (Wati)
 * Body: { phone: "91XXXXXXXXXX" }
 */
app.post('/auth/send-otp', async (req, res) => {
    // [INJECT: Send OTP Reviewer Bypass]
    console.log('>>> [DEBUG] INCOMING BODY:', JSON.stringify(req.body));
    const rawInput = req.body.phone || req.body.phoneNumber || '';
    const incomingPhone = String(rawInput).replace(/\D/g, '');
    console.log('>>> [DEBUG] PARSED PHONE:', incomingPhone);
    
    if (isOtpBypassPhone(incomingPhone)) {
        console.log('[OTP Bypass] Intercepted Send OTP for test number. Bypassing WhatsApp API.');
        return res.status(200).json({ success: true, message: 'Mock OTP sent successfully.' });
    }

    try {
        const { phone, isSignup, isLogin } = req.body;
        const purpose = req.body.purpose;

        if (!phone || !/^91\d{10}$/.test(phone)) {
            return res.status(400).json({ error: 'Valid Indian phone number required (format: 91XXXXXXXXXX)' });
        }

        // Admin login: only allowlisted phones may request an admin OTP.
        // Merchant / consumer flows (no `purpose`) are unaffected.
        if (purpose === 'admin') {
            const allow = await prisma.adminAllowlist.findFirst({ where: { phone, isActive: true } });
            if (!allow) {
                return res.status(403).json({ error: 'This number is not authorized for admin access.' });
            }
        }

        // Early duplicate/lookup checks to save WATI costs
        const barePhone = phone.replace(/^91/, '');
        
        if (isSignup || isLogin) {
            const { data: existingMerchants } = await supabaseAdmin
                .from('merchants')
                .select('id')
                .eq('phone', barePhone)
                .limit(1);

            const existingMerchant = existingMerchants && existingMerchants.length > 0 ? existingMerchants[0] : null;

            if (isSignup && existingMerchant) {
                return res.status(409).json({ error: 'This phone number is already registered. Please login instead.' });
            }

            if (isLogin && !existingMerchant) {
                return res.status(404).json({ error: 'No merchant account found for this number. Please apply as partner first.' });
            }
        }

        // [2026-05-30] 10-min/3-OTP per-phone ban REMOVED — was blocking founder/legitimate testing.
        // Per-OTP attempt limit (5 wrong tries on a single record, in /auth/verify-otp) is retained.
        // TODO (forlater.md): replace with a cheaper per-IP throttle + Wati-cost cap before scale.

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min expiry

        // Store OTP in database
        await prisma.otpVerification.create({
            data: { phone, otp, expiresAt: expiresAt }
        });

        // Send via Wati WhatsApp
        let sent = false;
        try {
            sent = await watiService.sendOtp(phone, otp);
        } catch (watiErr: any) {
            console.error(`[Auth] Wati Service Exception:`, watiErr.message);
        }

        if (!sent) {
            console.error(`[Auth] Failed to send OTP to ${phone} via Wati. Invalidating record.`);
            // Mandate 2: Invalidate the record immediately for audit purposes
            await prisma.otpVerification.updateMany({
                where: { phone, otp, verified: false },
                data: { expiresAt: new Date(0) }
            });
            return res.status(502).json({ error: 'WhatsApp delivery failed. Please try again.' });
        }

        console.log(`[Auth] OTP sent to ${phone}`);
        res.json({ success: true, message: 'OTP sent via WhatsApp' });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'auth.send-otp', extra: undefined, userMessage: 'Internal Server Error' });
    }
});

/**
 * POST /auth/verify-otp
 * Validate OTP → create or find Supabase user → return session
 * Body: { phone: "91XXXXXXXXXX", otp: "123456" }
 */
app.post('/auth/verify-otp', async (req, res) => {


    try {
        console.log(`[Auth] POST /auth/verify-otp hit`);
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        const isReviewer = isOtpBypassPhone(phone) && otp === OTP_BYPASS_CODE;
        let record = null;

        if (!isReviewer) {
            console.log(`[Auth] Looking for unverified OTP for phone: ${phone}`);
            // Find the latest unverified OTP for this phone
            record = await prisma.otpVerification.findFirst({
                where: {
                    phone,
                    verified: false,
                    expiresAt: { gte: new Date() }
                },
                orderBy: { createdAt: 'desc' }
            });

            if (!record) {
                return res.status(410).json({ error: 'OTP expired or not found. Please request a new one.' });
            }

            // Check max attempts
            if ((record.attempts ?? 0) >= 5) {
                return res.status(429).json({ error: 'Too many incorrect attempts. Please request a new OTP.' });
            }

            // Increment attempts
            await prisma.otpVerification.update({
                where: { id: record.id },
                data: { attempts: { increment: 1 } }
            });

            // Validate OTP
            if (record.otp !== otp) {
                return res.status(401).json({ error: 'Incorrect OTP', attemptsRemaining: 5 - ((record.attempts ?? 0) + 1) });
            }

            // Mark OTP as verified
            await prisma.otpVerification.update({
                where: { id: record.id },
                data: { verified: true }
            });
        } else {
            console.log(`[Auth] Reviewer bypass active for phone: ${phone}`);
        }

        // Admin login gate: only allowlisted phones may complete an admin verify.
        // (Defense in depth — send-otp already gates admin OTP requests.)
        const isAdminLogin = req.body.purpose === 'admin';
        if (isAdminLogin) {
            const allow = await prisma.adminAllowlist.findFirst({ where: { phone, isActive: true } });
            if (!allow) {
                return res.status(403).json({ error: 'This number is not authorized for admin access.' });
            }
        }

        // Format phone for Supabase (needs +91 prefix)
        const formattedPhone = `+${phone}`;
        const syntheticEmail = `${phone}@phone.pickatstore.app`;
        let isNewUser = false;

        console.log(`[Auth] Querying Supabase auth.users for ${formattedPhone} OR ${syntheticEmail}`);
        // Check if user already exists in Supabase Auth via direct SQL (bypasses listUsers pagination)
        const authUsers: any[] = await prisma.$queryRaw`SELECT id, email, phone FROM auth.users WHERE phone = ${formattedPhone} OR phone = ${phone} OR email = ${syntheticEmail}`;
        let existingUser = authUsers.length > 0 ? authUsers[0] : null;
        let tempPassword = '';
        let signInEmail = syntheticEmail;

        console.log(`[Auth] Existing user:`, existingUser?.id || 'None');

        if (!existingUser) {
            // 2. RECOVERY CHECK: Does this phone exist in Prisma but is missing from Supabase Auth?
            const barePhoneRaw = phone.replace(/^91/, '');
            const phoneFormats = [barePhoneRaw, phone, formattedPhone];
            const prismaUser = await prisma.user.findFirst({
                where: { phone: { in: phoneFormats } }
            });

            // Create new user with email and password to bypass disabled Phone provider
            tempPassword = `PAS_OTP_${phone}_${Date.now()}_${Math.random().toString(36)}`;
            
            const createPayload: any = {
                phone: formattedPhone,
                phone_confirm: true,
                email: signInEmail,
                email_confirm: true,
                password: tempPassword,
                user_metadata: { phone: formattedPhone }
            };

            // If Prisma user exists, FORCE Supabase to use the exact same ID
            if (prismaUser) {
                createPayload.id = prismaUser.id;
                console.log(`[Auth Recovery] Restoring Supabase Auth row for existing Prisma ID: ${prismaUser.id}`);
            }

            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createPayload);

            if (createError) {
                console.error('[Auth] Create user error:', createError);
                return res.status(500).json({ error: 'Failed to create user account' });
            }
            existingUser = newUser.user;
            isNewUser = true;

            // Create empty profile row
            await supabase.from('profiles').upsert({
                id: existingUser.id,
                updatedAt: new Date().toISOString()
            }).select();

            console.log(`[Auth] New user created: ${existingUser.id}`);
        } else {
            // For existing users, update with a temporary password to mint session
            tempPassword = `PAS_OTP_${phone}_${Date.now()}_${Math.random().toString(36)}`;
            signInEmail = existingUser.email || `${phone}@phone.pickatstore.app`;

            const updatePayload: any = { password: tempPassword, email_confirm: true };
            if (!existingUser.email) {
                updatePayload.email = signInEmail;
            }

            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);

            if (updateError) {
                console.error('[Auth] User password update failed:', updateError);
            }
        }

        // --- JIT BRANCH MANAGER PROVISIONING ---
        const barePhoneRaw = phone.replace(/^91/, '');
        const branchPhoneFormats = [barePhoneRaw, phone, formattedPhone];

        const assignedBranch = await prisma.merchantBranch.findFirst({
            where: { phone: { in: branchPhoneFormats } },
            select: { id: true, merchantId: true, managerName: true }
        });

        if (assignedBranch) {
            console.log(`[Auth] JIT Provisioning: Phone matched to Branch ${assignedBranch.id}`);
            // Ensure the user exists in Prisma with the STAFF role
            await prisma.user.upsert({
                where: { id: existingUser.id },
                update: { role: 'MERCHANT', name: assignedBranch.managerName || undefined },
                create: {
                    id: existingUser.id,
                    phone: formattedPhone,
                    email: existingUser.email || syntheticEmail,
                    role: 'MERCHANT',
                    name: assignedBranch.managerName || 'Branch Manager'
                }
            });
            // Force frontend to skip "Create Store" onboarding
            isNewUser = false;
        }
        // ---------------------------------------

        // 1. Force a small buffer to let Supabase GoTrue database sync the new password
        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. ALWAYS sign in with the email (synthetic or real), NEVER the phone
        const loginEmail = signInEmail || syntheticEmail;

        console.log(`[Auth] Attempting sign-in for: ${loginEmail}`);

        const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password: tempPassword,
        });

        if (signInError || !sessionData.session) {
            console.error('[Auth] Supabase signInWithPassword failed:', signInError);
            return res.status(500).json({ error: 'Failed to create session. Please try again.' });
        }

        console.log(`[Auth] User ${existingUser.id} authenticated (isNew: ${isNewUser})`);

        // Admin login: stamp the durable isAdmin flag (survives the JIT role
        // overwrite above). Upsert because non-merchant admins have no User row yet.
        // 2026-06-03: also promote AdminAllowlist.role onto User.role if the
        // invitee was given a role at invite time, AND keep their existing User.role
        // if they already have one of the new admin-tier roles.
        if (isAdminLogin) {
            const allow = await prisma.adminAllowlist.findFirst({ where: { phone, isActive: true } });
            const allowRole = allow?.role && ['SUPER_ADMIN','OPERATIONS','FINANCE','SUPPORT'].includes(String(allow.role).toUpperCase())
                ? String(allow.role).toUpperCase()
                : null;

            const existingProfile = await prisma.user.findUnique({
                where: { id: existingUser.id },
                select: { role: true },
            });
            const existingRole = existingProfile?.role;
            // Don't override an existing admin-tier role on each login — that would
            // wipe Super Admin's manual demotion. Only promote when the user has no
            // admin role yet (or is still tagged as CONSUMER/MERCHANT).
            const shouldApplyAllowRole = allowRole && (!existingRole || existingRole === 'CONSUMER' || existingRole === 'MERCHANT');
            const targetRole = shouldApplyAllowRole ? allowRole : null;

            await prisma.user.upsert({
                where: { id: existingUser.id },
                update: {
                    isAdmin: true,
                    ...(targetRole ? { role: targetRole as any } : {}),
                },
                create: {
                    id: existingUser.id,
                    email: existingUser.email || syntheticEmail,
                    phone: formattedPhone,
                    role: (targetRole ?? 'CONSUMER') as any,
                    isAdmin: true,
                    name: allow?.name ?? null,
                },
            });
            console.log(`[Auth] Admin isAdmin set for ${existingUser.id}${targetRole ? ` (role=${targetRole} from allowlist)` : ''}`);
        }

        res.json({
            success: true,
            session: {
                access_token: sessionData.session.access_token,
                refresh_token: sessionData.session.refresh_token,
                expires_in: sessionData.session.expires_in,
                expiresAt: sessionData.session.expires_at
            },
            user: {
                id: existingUser.id,
                phone: formattedPhone,
                email: existingUser.email
            },
            isNewUser
        });
        console.log(`[Auth] verify-otp response sent successfully.`);
        } catch (error: any) {
        return handleApiError(res, error, { area: 'auth.verify-otp', extra: undefined, userMessage: 'OTP verification failed' });
    }
});

/**
 * POST /admin/allowlist
 * Add (or re-activate) an authorized admin phone. Admin-only.
 * Body: { phone: "9XXXXXXXXX" | "91XXXXXXXXXX", name?: string }
 */
app.post('/admin/allowlist', async (req, res) => {
    try {
        const caller = await getAuthUser(req);
        const callerProfile = await prisma.user.findUnique({
            where: { id: caller.id },
            select: { isAdmin: true, role: true },
        });
        const callerIsAdmin = !!callerProfile && (callerProfile.isAdmin === true || callerProfile.role === 'SUPER_ADMIN');
        if (!callerIsAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const digits = String(req.body?.phone || '').replace(/\D/g, '');
        const normalized = digits.length === 10 ? `91${digits}` : digits;
        if (!/^91\d{10}$/.test(normalized)) {
            return res.status(400).json({ error: 'A valid 10-digit Indian phone number is required' });
        }
        const name = req.body?.name ? String(req.body.name).trim() : null;

        const created = await prisma.adminAllowlist.upsert({
            where: { phone: normalized },
            update: { isActive: true, ...(name ? { name } : {}) },
            create: { phone: normalized, name, isActive: true },
        });
        return res.json({ success: true, admin: { phone: created.phone, name: created.name } });
    } catch (e: any) {
        if (e?.message === 'Missing or invalid token' || e?.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        console.error('[Admin] add allowlist error:', e);
        Sentry.captureException(e, { tags: { area: 'admin.allowlist' }, extra: {} });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to add admin' });
    }
});

// =====================================================================
// Phase 2.E2 (2026-06-04) — Admin CRUD for merchant signup coupons.
// =====================================================================

/**
 * GET /admin/merchant-signup-coupons
 * List all coupons with redemption counts. Newest first.
 */
app.get('/admin/merchant-signup-coupons', async (req, res) => {
    const caller = await requireAdmin(req, res);
    if (!caller) return;
    try {
        const coupons = await prisma.merchantSignupCoupon.findMany({
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { redemptions: true } } },
        });
        return res.json(coupons.map(c => ({
            id: c.id,
            code: c.code,
            discountInr: c.discountInr,
            maxUses: c.maxUses,
            usedCount: c.usedCount,
            appliesToTier: c.appliesToTier,
            expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
            isActive: c.isActive,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            redemptionCount: c._count.redemptions,
        })));
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.merchant-signup-coupons', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to list coupons' });
    }
});

/**
 * POST /admin/merchant-signup-coupons
 * Create a new coupon.
 * Body: { code, discountInr, maxUses?, appliesToTier?, expiresAt?, isActive? }
 */
app.post('/admin/merchant-signup-coupons', async (req, res) => {
    const caller = await requireAdmin(req, res);
    if (!caller) return;
    try {
        const body = req.body || {};
        const code = String(body.code || '').trim().toUpperCase();
        const discountInr = Number(body.discountInr);
        const maxUses = body.maxUses === null || body.maxUses === undefined || body.maxUses === ''
            ? null : Number(body.maxUses);
        const appliesToTier = body.appliesToTier && ['standard', 'premium'].includes(String(body.appliesToTier).toLowerCase())
            ? String(body.appliesToTier).toLowerCase()
            : null;
        const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
        const isActive = body.isActive === undefined ? true : !!body.isActive;

        if (!code || !/^[A-Z0-9_-]{3,30}$/.test(code)) {
            return res.status(400).json({ error: 'Code must be 3-30 chars, letters/digits/_/- only.' });
        }
        if (!Number.isFinite(discountInr) || discountInr <= 0) {
            return res.status(400).json({ error: 'discountInr must be a positive integer.' });
        }
        if (maxUses !== null && (!Number.isFinite(maxUses) || maxUses <= 0)) {
            return res.status(400).json({ error: 'maxUses must be a positive integer or null.' });
        }
        if (expiresAt && Number.isNaN(expiresAt.getTime())) {
            return res.status(400).json({ error: 'expiresAt must be a valid ISO date.' });
        }

        const existing = await prisma.merchantSignupCoupon.findUnique({ where: { code } });
        if (existing) {
            return res.status(409).json({ error: `Coupon code "${code}" already exists.` });
        }

        const created = await prisma.merchantSignupCoupon.create({
            data: {
                code,
                discountInr: Math.floor(discountInr),
                maxUses: maxUses === null ? null : Math.floor(maxUses),
                appliesToTier,
                expiresAt,
                isActive,
            },
        });
        return res.status(201).json({
            id: created.id,
            code: created.code,
            discountInr: created.discountInr,
            maxUses: created.maxUses,
            usedCount: created.usedCount,
            appliesToTier: created.appliesToTier,
            expiresAt: created.expiresAt ? created.expiresAt.toISOString() : null,
            isActive: created.isActive,
            createdAt: created.createdAt.toISOString(),
            updatedAt: created.updatedAt.toISOString(),
            redemptionCount: 0,
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.merchant-signup-coupons', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to create coupon' });
    }
});

/**
 * PATCH /admin/merchant-signup-coupons/:id
 * Update is_active / max_uses / expires_at / applies_to_tier. Code and
 * discount_inr are immutable after creation (changing them mid-flight
 * would confuse already-issued codes).
 */
app.patch('/admin/merchant-signup-coupons/:id', async (req, res) => {
    const caller = await requireAdmin(req, res);
    if (!caller) return;
    try {
        const { id } = req.params;
        const body = req.body || {};
        const data: any = {};

        if (body.isActive !== undefined) data.isActive = !!body.isActive;
        if (body.maxUses !== undefined) {
            const n = body.maxUses === null || body.maxUses === '' ? null : Number(body.maxUses);
            if (n !== null && (!Number.isFinite(n) || n <= 0)) {
                return res.status(400).json({ error: 'maxUses must be a positive integer or null.' });
            }
            data.maxUses = n === null ? null : Math.floor(n);
        }
        if (body.expiresAt !== undefined) {
            const d = body.expiresAt ? new Date(body.expiresAt) : null;
            if (d && Number.isNaN(d.getTime())) {
                return res.status(400).json({ error: 'expiresAt must be a valid ISO date or null.' });
            }
            data.expiresAt = d;
        }
        if (body.appliesToTier !== undefined) {
            const t = body.appliesToTier;
            if (t !== null && !['standard', 'premium'].includes(String(t).toLowerCase())) {
                return res.status(400).json({ error: "appliesToTier must be 'standard' | 'premium' | null." });
            }
            data.appliesToTier = t === null ? null : String(t).toLowerCase();
        }

        if (Object.keys(data).length === 0) {
            return res.status(400).json({ error: 'Nothing to update.' });
        }

        const updated = await prisma.merchantSignupCoupon.update({
            where: { id },
            data,
            include: { _count: { select: { redemptions: true } } },
        });
        return res.json({
            id: updated.id,
            code: updated.code,
            discountInr: updated.discountInr,
            maxUses: updated.maxUses,
            usedCount: updated.usedCount,
            appliesToTier: updated.appliesToTier,
            expiresAt: updated.expiresAt ? updated.expiresAt.toISOString() : null,
            isActive: updated.isActive,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            redemptionCount: updated._count.redemptions,
        });
    } catch (e: any) {
        if (e?.code === 'P2025') {
            return res.status(404).json({ error: 'Coupon not found.' });
        }
        console.error('[Admin] update merchant-signup-coupon error:', e);
        Sentry.captureException(e, { tags: { area: 'admin.merchant-signup-coupons' }, extra: { id: req.params.id } });
        markResponseAsReported(res);
        return res.status(500).json({ error: 'Failed to update coupon' });
    }
});

/**
 * GET /admin/merchant-signup-coupons/:id/redemptions
 * List who has redeemed this coupon (most recent first).
 */
app.get('/admin/merchant-signup-coupons/:id/redemptions', async (req, res) => {
    const caller = await requireAdmin(req, res);
    if (!caller) return;
    try {
        const { id } = req.params;
        const rows = await prisma.merchantSignupCouponRedemption.findMany({
            where: { couponId: id },
            orderBy: { appliedAt: 'desc' },
            include: {
                merchant: {
                    select: { id: true, storeName: true, ownerName: true, phone: true, email: true, status: true, createdAt: true },
                },
            },
        });
        return res.json(rows.map(r => ({
            id: r.id,
            merchantId: r.merchantId,
            codeSnapshot: r.codeSnapshot,
            amountInr: r.amountInr,
            appliedAt: r.appliedAt.toISOString(),
            merchant: r.merchant,
        })));
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.merchant-signup-coupons.redemptions', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to list redemptions' });
    }
});

// =====================================================================
// DELETE /auth/delete-account
// Apple Guideline 5.1.1(v): Users must be able to delete their account.
// Anonymizes order data (keeps financial records for merchant reconciliation)
// then deletes profile, addresses, and the Supabase auth record.
// =====================================================================
app.delete('/auth/delete-account', async (req, res) => {
    try {
        // 1. Authenticate the user via JWT
        const user = await getAuthUser(req);
        const userId = user.id;

        console.log(`[Account Deletion] Initiated for user: ${userId}`);

        // 2. Anonymize orders — keep financial data, strip PII
        const { error: orderError } = await supabaseAdmin
            .from('orders')
            .update({
                user_id: null,
                delivery_address: null,
                customer_phone: null,
                customer_name: '[Deleted User]',
            })
            .eq('user_id', userId);

        if (orderError) {
            console.warn(`[Account Deletion] Order anonymization warning:`, orderError.message);
            // Non-fatal: continue with deletion even if no orders exist
        }

        // 3. Delete consumer addresses
        const { error: addressError } = await supabaseAdmin
            .from('consumer_addresses')
            .delete()
            .eq('user_id', userId);

        if (addressError) {
            console.warn(`[Account Deletion] Address cleanup warning:`, addressError.message);
        }

        // 4. Delete profile
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) {
            console.warn(`[Account Deletion] Profile cleanup warning:`, profileError.message);
        }

        // 5. Delete favorites
        const { error: favError } = await supabaseAdmin
            .from('product_favorites')
            .delete()
            .eq('user_id', userId);

        if (favError) {
            console.warn(`[Account Deletion] Favorites cleanup warning:`, favError.message);
        }

        // 6. Delete Prisma user record (if exists)
        try {
            await prisma.user.delete({ where: { id: userId } });
        } catch (prismaErr: any) {
            // P2025 = Record not found — safe to ignore
            if (prismaErr.code !== 'P2025') {
                console.warn(`[Account Deletion] Prisma user cleanup warning:`, prismaErr.message);
            }
        }

        // 7. Delete Supabase Auth record (FINAL — point of no return)
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (authDeleteError) {
            console.error(`[Account Deletion] CRITICAL: Auth deletion failed for ${userId}:`, authDeleteError);
            return res.status(500).json({ error: 'Failed to delete authentication record. Please contact support.' });
        }

        console.log(`[Account Deletion] Successfully deleted user: ${userId}`);
        res.json({ success: true, message: 'Account deleted successfully.' });

    } catch (error: any) {
        console.error('[Account Deletion] Error:', error.message);
        if (error.message === 'Missing or invalid token' || error.message === 'Unauthorized') {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        Sentry.captureException(error, { tags: { area: 'auth.delete-account' }, extra: {} });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Account deletion failed. Please try again.' });
    }
});

/**
 * GET /auth/merchant/draft
 * Fetches the current remote state for a merchant, used for pre-flight idempotency checks.
 */
app.get('/auth/merchant/draft', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const userId = user.id;

        const merchant = await prisma.merchant.findUnique({
            where: { id: userId }
        });

        if (!merchant) {
            return res.status(404).json({ error: 'Merchant draft not found' });
        }

        // Fetch the latest successful subscription for this merchant
        const subscription = await prisma.subscription.findFirst({
            where: { merchantId: userId, status: 'success' },
            orderBy: { createdAt: 'desc' }
        });

        res.json({
            success: true,
            merchant: {
                status: merchant.status,
                kycStatus: merchant.kycStatus,
                storeName: merchant.storeName
            },
            subscription: subscription ? {
                status: 'success',
                transactionId: subscription.transactionId,
                orderId: subscription.id,
                amount: subscription.amount
            } : null
        });
        } catch (e: any) {
        // Round-7 fix: merchant signup recovery — show real cause (auth error, RLS denial, etc.) not generic.
        return handleApiError(res, e, { area: 'auth.merchant.draft', extra: undefined, userMessage: e?.message || 'Failed to fetch draft' });
    }
});

/**
 * POST /auth/merchant/draft
 * Fired at Step 1 to create the initial draft record.
 */
app.post('/auth/merchant/draft', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const { ownerName, email, phone, verticalId } = req.body;
        const userId = user.id;

        if (verticalId !== undefined) {
            const verticalExists = await prisma.vertical.findUnique({
                where: { id: verticalId }
            });
            if (!verticalExists) {
                return res.status(400).json({ error: 'Invalid verticalId provided' });
            }
        }

        await prisma.$transaction(async (tx) => {
            const existingUser = await tx.user.findUnique({ where: { id: userId } });
            if (existingUser) {
                await tx.user.update({
                    where: { id: userId },
                    data: { role: 'MERCHANT', name: ownerName, phone: phone }
                });
            } else {
                await tx.user.create({
                    data: { id: userId, email: email || `${phone}@phone.pickatstore.app`, name: ownerName, role: 'MERCHANT', passwordHash: 'sso_auth_active', phone: phone, updatedAt: new Date() }
                });
            }

            const existingMerchant = await tx.merchant.findUnique({ where: { id: userId } });
            if (existingMerchant) {
                await tx.merchant.update({
                    where: { id: userId },
                    data: { ownerName, email, phone, status: 'inactive' }
                });
            } else {
                await tx.merchant.create({
                    data: {
                        id: userId,
                        ownerName,
                        email,
                        phone,
                        status: 'inactive',
                        kycStatus: 'pending',
                        storeName: null as any,
                        ...(verticalId ? { verticalId } : {})
                    }
                });
            }
        });

        res.json({ success: true, message: 'Draft created' });
        } catch (e: any) {
        // Round-7 fix: merchant signup step 1 — show real cause (duplicate phone, RLS denial, etc.).
        return handleApiError(res, e, { area: 'auth.merchant.draft', extra: undefined, userMessage: e?.message || 'Failed to create draft' });
    }
});

/**
 * PATCH /auth/merchant/draft
 * Incremental updates for subsequent signup steps.
 */
app.patch('/auth/merchant/draft', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
        const token = authHeader.split(' ')[1];
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

        const userId = user.id;
        const payload = req.body;

        if (payload.verticalId !== undefined) {
            const verticalExists = await prisma.vertical.findUnique({
                where: { id: payload.verticalId }
            });
            if (!verticalExists) {
                return res.status(400).json({ error: 'Invalid verticalId provided' });
            }
        }

        await prisma.$transaction(async (tx) => {
            const updateData: any = {};
            if (payload.ownerName !== undefined) updateData.ownerName = payload.ownerName;
            // 2026-06-04 (Phase 2.A2, spec blocker B2): designation captured at
            // Step 1; populates the signatory block on the partner-agreement PDF.
            if (payload.designation !== undefined) updateData.designation = payload.designation;
            if (payload.email !== undefined) updateData.email = payload.email;
            if (payload.phone !== undefined) updateData.phone = payload.phone;

            if (payload.storeName !== undefined) updateData.storeName = payload.storeName;
            if (payload.verticalId !== undefined) updateData.verticalId = payload.verticalId;
            if (payload.city !== undefined) updateData.city = payload.city;
            if (payload.address !== undefined) updateData.address = payload.address;
            if (payload.latitude !== undefined) updateData.latitude = payload.latitude;
            if (payload.longitude !== undefined) updateData.longitude = payload.longitude;
            if (payload.hasBranches !== undefined) updateData.hasBranches = payload.hasBranches;
            if (payload.kycStatus !== undefined) updateData.kycStatus = payload.kycStatus;
            if (payload.panNumber !== undefined) updateData.panNumber = payload.panNumber;
            if (payload.aadharNumber !== undefined) updateData.aadharNumber = payload.aadharNumber;
            if (payload.msmeNumber !== undefined) updateData.msmeNumber = payload.msmeNumber;
            if (payload.bankAccount !== undefined) updateData.bankAccountNumber = payload.bankAccount;
            if (payload.ifsc !== undefined) updateData.ifscCode = payload.ifsc;
            if (payload.beneficiaryName !== undefined) updateData.bankBeneficiaryName = payload.beneficiaryName;
            if (payload.turnoverRange !== undefined) updateData.turnoverRange = payload.turnoverRange;
            if (payload.gstNumber !== undefined) updateData.gstNumber = payload.gstNumber;
            if (payload.fssaiNumber !== undefined) updateData.fssaiNumber = payload.fssaiNumber;
            if (payload.docUrls) {
                if (payload.docUrls.pan) updateData.panDocUrl = payload.docUrls.pan;
                if (payload.docUrls.aadharFront) updateData.aadharFrontUrl = payload.docUrls.aadharFront;
                if (payload.docUrls.aadharBack) updateData.aadharBackUrl = payload.docUrls.aadharBack;
                if (payload.docUrls.msme) updateData.msmeCertificateUrl = payload.docUrls.msme;
                if (payload.docUrls.gst) updateData.gstCertificateUrl = payload.docUrls.gst;
                if (payload.docUrls.fssai) updateData.fssaiCertificateUrl = payload.docUrls.fssai;
            }
            if (payload.storePhotos) updateData.storePhotos = payload.storePhotos;
            if (payload.cuisines !== undefined) updateData.cuisines = payload.cuisines;
            if (payload.isVeg !== undefined) updateData.isVeg = payload.isVeg;
            if (payload.restaurantType !== undefined) updateData.restaurantType = payload.restaurantType;

            if (payload.finalize) {
                updateData.status = 'inactive';
                updateData.kycStatus = 'pending';
            }

            const existingMerchant = await tx.merchant.findUnique({ where: { id: userId } });
            if (existingMerchant) {
                await tx.merchant.update({
                    where: { id: userId },
                    data: updateData
                });
            } else {
                await tx.merchant.create({
                    data: {
                        id: userId,
                        phone: updateData.phone || user.phone || '0000000000',
                        status: updateData.status || 'inactive',
                        kycStatus: updateData.kycStatus || 'pending',
                        ...updateData
                    }
                });
            }

            // 2026-06-04 (Phase 2.C.3): v2 stores[] path. When the frontend sends
            // the consolidated stores array (Phase 2.C.2+), each Store becomes
            // a UUID-keyed MerchantBranch row. The Store row (singular, the
            // anchor row) uses the FIRST store's data for backward-compat with
            // legacy merchant-id lookups. NO main-branch convention is applied
            // for new merchants; existing merchants' main branch (id == merchant_id)
            // remains in place until a dedicated migration retires it.
            if (Array.isArray(payload.stores) && payload.stores.length > 0 && payload.stores[0]?.city) {
                const firstStore = payload.stores[0];
                const cityRecord = await tx.city.upsert({
                    where: { name: firstStore.city },
                    update: {},
                    create: { id: crypto.randomUUID(), name: firstStore.city, active: true, updatedAt: new Date() }
                });

                const existingStoreRow = await tx.store.findUnique({ where: { id: userId } });
                const anchorImage = firstStore.photos && firstStore.photos.length > 0 ? firstStore.photos[0] : null;

                if (existingStoreRow) {
                    await tx.store.update({
                        where: { id: userId },
                        data: {
                            name: firstStore.name || 'Main Store',
                            cityId: cityRecord.id,
                            address: firstStore.address,
                            latitude: firstStore.latitude ?? null,
                            longitude: firstStore.longitude ?? null,
                            image: anchorImage,
                            active: false,
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await tx.store.create({
                        data: { id: userId, managerId: userId, name: firstStore.name || 'Main Store', cityId: cityRecord.id, address: firstStore.address, latitude: firstStore.latitude ?? null, longitude: firstStore.longitude ?? null, active: false, image: anchorImage, updatedAt: new Date() }
                    });
                }

                // Upsert each Store as a UUID-keyed MerchantBranch row. The
                // frontend's Store.id is reused as MerchantBranch.id (text PK,
                // accepts any UUID-shaped string).
                for (const s of payload.stores) {
                    const branchData = {
                        merchantId: userId,
                        // Phase 2 FINAL — F1 (2026-06-16): parent Store is created at
                        // id=userId above; set store_id so the branch is reachable to
                        // its Store (no orphaned inventory). FK rejects a wrong value.
                        storeId: userId,
                        branchName: s.name || 'Store',
                        managerName: s.manager_name,
                        phone: s.phone,
                        address: s.address,
                        city: s.city ?? null,
                        latitude: s.latitude ?? null,
                        longitude: s.longitude ?? null,
                        isActive: true,
                        cuisines: s.cuisines || [],
                        isVeg: s.is_veg ?? null,
                        restaurantType: s.restaurant_type || null,
                        branchPhotos: s.photos || [],
                    };
                    await tx.merchantBranch.upsert({
                        where: { id: s.id },
                        update: branchData,
                        create: { id: s.id, ...branchData },
                    });
                }

                // Delete any branches owned by this merchant that are NOT in the
                // submitted stores[] list — handles store removal. Preserves the
                // existing main-branch row (id == merchant_id) ONLY if it's not
                // in the submitted list (so old merchants keep their main row).
                const submittedIds = payload.stores.map((s: any) => s.id);
                await tx.merchantBranch.deleteMany({
                    where: {
                        merchantId: userId,
                        id: { notIn: submittedIds.concat([userId]) }
                    }
                });
            }
            // 2026-06-04 (Phase 2.C.3): legacy v1 path retained as a fallback
            // for clients still sending the flat storeName/branches payload
            // (older app builds before Phase 2.C.2 ships). Removed in Phase 2.G
            // once the v2 build is universal.
            else if (payload.storeName && payload.city && payload.address) {
                const cityRecord = await tx.city.upsert({
                    where: { name: payload.city },
                    update: {},
                    create: { id: crypto.randomUUID(), name: payload.city, active: true, updatedAt: new Date() }
                });
                
                const existingStore = await tx.store.findUnique({ where: { id: userId } });
                const storeImage = payload.storePhotos && payload.storePhotos.length > 0 ? payload.storePhotos[0] : null;

                if (existingStore) {
                    await tx.store.update({
                        where: { id: userId },
                        data: {
                            name: payload.storeName,
                            cityId: cityRecord.id,
                            address: payload.address,
                            latitude: payload.latitude ?? null,
                            longitude: payload.longitude ?? null,
                            image: storeImage,
                            active: false, // Ensure it stays inactive during updates until re-approved
                            updatedAt: new Date()
                        }
                    });
                } else {
                    await tx.store.create({
                        data: { id: userId, managerId: userId, name: payload.storeName, cityId: cityRecord.id, address: payload.address, latitude: payload.latitude ?? null, longitude: payload.longitude ?? null, active: false, image: storeImage, updatedAt: new Date() }
                    });
                }

                // ALWAYS (re)create the merchant's MAIN branch (id == merchant_id) carrying the
                // store's coordinates. This is what customer discovery (get_nearby_stores) reads,
                // and it's the FK target for StoreProduct.branch_id. Mirrors the legacy
                // /auth/merchant/signup behaviour. Runs regardless of hasBranches so single-store
                // merchants are still geo-located and findable. (Fix: stores were invisible because
                // the old code only created added branches and deleted the main one.)
                const mainBranchData = {
                    // Phase 2 FINAL — F1 (2026-06-16): parent Store is at id=userId.
                    storeId: userId,
                    branchName: payload.storeName || 'Main Branch',
                    managerName: payload.ownerName,
                    phone: payload.phone,
                    address: payload.address,
                    city: payload.city ?? null,
                    latitude: payload.latitude ?? null,
                    longitude: payload.longitude ?? null,
                    isActive: true,
                    cuisines: payload.cuisines || [],
                    isVeg: payload.isVeg ?? null,
                    restaurantType: payload.restaurantType || null,
                    branchPhotos: payload.storePhotos || [],
                };
                await tx.merchantBranch.upsert({
                    where: { id: userId },
                    update: mainBranchData,
                    create: { id: userId, merchantId: userId, ...mainBranchData },
                });

                // Additional branches: replace only the NON-main branches (never the main),
                // and persist each branch's own coordinates (sent by the signup form).
                await tx.merchantBranch.deleteMany({ where: { merchantId: userId, id: { not: userId } } });
                if (payload.hasBranches && payload.branches && payload.branches.length > 0) {
                    await tx.merchantBranch.createMany({
                        data: payload.branches
                            // guard against a duplicate of the main branch's name (unique merchantId+branchName)
                            .filter((b: any) => (b.name || 'Branch') !== (payload.storeName || 'Main Branch'))
                            .map((b: any) => ({
                                merchantId: userId,
                                storeId: userId, // Phase 2 FINAL — F1 (2026-06-16): parent Store = userId
                                branchName: b.name || 'Branch',
                                managerName: b.manager_name,
                                phone: b.phone,
                                address: b.address,
                                city: b.city ?? payload.city ?? null,
                                latitude: b.latitude ?? null,
                                longitude: b.longitude ?? null,
                                isActive: true,
                                cuisines: b.cuisines || [],
                                isVeg: b.is_veg ?? null,
                                restaurantType: b.restaurant_type || null,
                                branchPhotos: b.branch_photos || [],
                            }))
                    });
                }
            }

            if (payload.subscription) {
                await tx.subscription.create({
                    data: {
                        merchantId: userId,
                        amount: payload.subscription.amount,
                        currency: 'INR',
                        status: 'success',
                        provider: 'razorpay',
                        transactionId: payload.subscription.paymentId
                    }
                });

                // 2026-06-04 (Phase 2.E2): Coupon redemption — atomic with the
                // subscription create. Server-side re-validation (defense in
                // depth: the frontend's couponDiscount can't be trusted as-is).
                // The UNIQUE(merchant_id) constraint on
                // merchant_signup_coupon_redemptions makes this idempotent —
                // a retried PATCH /auth/merchant/draft with the same payload
                // will throw P2002 on the second redemption attempt.
                if (payload.couponCode && Number(payload.couponDiscount) > 0) {
                    const normalized = String(payload.couponCode).trim().toUpperCase();
                    const coupon = await tx.merchantSignupCoupon.findFirst({
                        where: { code: { equals: normalized, mode: 'insensitive' } },
                    });
                    if (!coupon) {
                        throw new Error(`Coupon ${normalized} not found at redemption time.`);
                    }
                    if (!coupon.isActive) {
                        throw new Error(`Coupon ${normalized} is no longer active.`);
                    }
                    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
                        throw new Error(`Coupon ${normalized} expired.`);
                    }
                    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
                        throw new Error(`Coupon ${normalized} usage limit reached.`);
                    }
                    if (Number(payload.couponDiscount) !== coupon.discountInr) {
                        // Frontend sent a discount that doesn't match the coupon's
                        // server-side discount_inr. Reject — possible tampering.
                        throw new Error(
                            `Coupon ${normalized} discount mismatch (expected ₹${coupon.discountInr}).`,
                        );
                    }

                    await tx.merchantSignupCouponRedemption.create({
                        data: {
                            couponId: coupon.id,
                            merchantId: userId,
                            codeSnapshot: coupon.code,
                            amountInr: coupon.discountInr,
                        },
                    });
                    await tx.merchantSignupCoupon.update({
                        where: { id: coupon.id },
                        data: { usedCount: { increment: 1 } },
                    });
                }
            }
        });

        // Fire application-received email on finalize (non-blocking)
        if (payload.finalize) {
            const merchantRecord = await prisma.merchant.findUnique({ where: { id: userId } });
            const targetEmail = merchantRecord?.email || user.email;
            const targetName = merchantRecord?.ownerName || 'Partner';
            if (targetEmail) {
                sendApplicationReceivedEmail(targetEmail, targetName)
                    .catch(err => console.error('[Email] Application received email failed:', err));
            }
        }

        res.json({ success: true, message: 'Draft updated' });
        } catch (e: any) {
        // Round-7 fix: restore admin-visible message (regression from auto-refactor).
        return handleApiError(res, e, { area: 'auth.merchant.draft', extra: undefined, userMessage: e?.message || 'Failed to update draft' });
    }
});

/**
 * POST /merchants/:id/kyc-decision
 * Admin endpoint: Approve or Reject a merchant's KYC application.
 * Sends branded email notification to the merchant.
 */
app.post('/merchants/:id/kyc-decision', async (req, res) => {
    // RBAC: OPERATIONS owns KYC review per the 2026-06-02 doc. SUPER_ADMIN
    // always allowed by requireRole's wildcard.
    const caller = await requireRole(req, res, ['OPERATIONS']); if (!caller) return;
    try {
        const { id } = req.params;
        // `needsInfoDetails` is the per-merchant message the admin types when picking 'needs_info'
        // (e.g. "Please re-upload PAN; the file you sent was unreadable.").
        const { decision, rejectionReason, needsInfoDetails } = req.body;

        if (!decision || !['approve', 'reject', 'needs_info'].includes(decision)) {
            return res.status(400).json({ error: 'Invalid decision. Must be "approve", "reject", or "needs_info".' });
        }

        const merchant = await prisma.merchant.findUnique({ where: { id } });
        if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

        if (decision === 'approve') {
            await prisma.merchant.update({
                where: { id },
                data: { kycStatus: 'approved', status: 'active' }
            });

            // Activate the associated store
            const storeUpdate = await prisma.store.update({
                where: { id },
                data: { active: true }
            });
            console.log(`[KYC] Activated store ${id} for merchant ${merchant.storeName}. Result:`, storeUpdate.active);

            if (merchant.email) {
                sendStoreApprovedEmail(merchant.email, merchant.ownerName || 'Partner', merchant.storeName || 'Your Store')
                    .catch(err => console.error('[Email] Approval email failed:', err));
            }
            console.log(`[KYC] Approved merchant ${id} (${merchant.storeName})`);
        } else if (decision === 'needs_info') {
            // KYC stays in 'pending' / 'needs_info' state — store stays inactive.
            // The merchant fixes whatever's flagged and the admin re-reviews.
            await prisma.merchant.update({
                where: { id },
                data: { kycStatus: 'needs_info', kycRejectionReason: needsInfoDetails || null }
            });

            if (merchant.email) {
                sendStoreNeedsInfoEmail(merchant.email, merchant.ownerName || 'Partner', needsInfoDetails || '')
                    .catch(err => console.error('[Email] Needs-info email failed:', err));
            }
            console.log(`[KYC] Needs more info on merchant ${id} (${merchant.storeName})`);
        } else {
            await prisma.merchant.update({
                where: { id },
                data: { kycStatus: 'rejected', kycRejectionReason: rejectionReason || null }
            });

            if (merchant.email) {
                sendStoreRejectedEmail(merchant.email, merchant.ownerName || 'Partner', rejectionReason || '')
                    .catch(err => console.error('[Email] Rejection email failed:', err));
            }
            console.log(`[KYC] Rejected merchant ${id} (${merchant.storeName})`);
        }

        res.json({ success: true, decision });
        } catch (e: any) {
        // Round-7 fix: KYC reviewers need to see the specific reason (already_approved, invalid_transition, DB error).
        return handleApiError(res, e, { area: 'merchants.kyc-decision', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: e?.message || 'KYC decision failed' });
    }
});

/**
 * POST /auth/merchant/signup
 * Securely creates a User, Store, and merchant lookup record via a single Prisma transaction.
 * Header: Authorization: Bearer <token>
 */
const merchantSignupSchema = z.object({
    ownerName: z.string().min(2, "Owner name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(10, "Valid phone is required"),
    storeName: z.string().min(2, "Store name is required"),
    verticalId: z.string().uuid("Valid vertical ID is required"),
    city: z.string().min(2, "City is required"),
    address: z.string().min(5, "Address is required"),
    latitude: z.number(),
    longitude: z.number(),
    cuisines: z.array(z.string()).optional().default([]),
    isVeg: z.boolean().optional().default(false),
    restaurantType: z.string().optional().nullable(),
    hasBranches: z.boolean().default(false),
    status: z.string().default('inactive'),
    kycStatus: z.string().default('pending'),
    panNumber: z.string().min(10, "Valid PAN is required"),
    aadharNumber: z.string().min(12, "Valid Aadhaar is required"),
    msmeNumber: z.string().optional().nullable(),
    bankAccount: z.string().min(9, "Valid bank account is required"),
    ifsc: z.string().min(4, "Valid IFSC is required"),
    beneficiaryName: z.string().min(2, "Beneficiary name is required"),
    turnoverRange: z.string(),
    gstNumber: z.string().min(15, "Valid GST is required"),
    fssaiNumber: z.string().optional().nullable(),
    docUrls: z.object({
        pan: z.string().min(1, "Valid PAN doc required"),
        aadharFront: z.string().min(1, "Valid Aadhaar front required"),
        aadharBack: z.string().min(1, "Valid Aadhaar back required"),
        msme: z.string().nullable().optional(),
        gst: z.string().min(1, "Valid GST doc required"),
        fssai: z.string().nullable().optional(),
    }),
    storePhotos: z.array(z.string()),
    branches: z.array(z.object({
        name: z.string().optional(),
        address: z.string().optional(),
        manager_name: z.string().optional(),
        phone: z.string().optional()
    })).optional(),
    subscription: z.object({
        amount: z.number(),
        paymentId: z.string(),
        orderId: z.string(),
        signature: z.string()
    }).optional()
});

app.post('/auth/merchant/signup', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];

        // 1. Authenticate user from Supabase token
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
        // 2. Validate payload
        const parsed = merchantSignupSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        }
        const payload = parsed.data;

        const userId = user.id;

        // 3. Prevent duplicate creation
        const existingMerchant = await prisma.user.findUnique({ where: { id: userId } });
        if (existingMerchant && existingMerchant.role === 'MERCHANT') {
            return res.status(409).json({ error: 'Merchant already registered' });
        }

        // 4. Resolve City (Atomic resolution to prevent race condition)
        const cityRecord = await prisma.city.upsert({
            where: { name: payload.city },
            update: {}, // No updates needed if it exists
            create: {
                id: crypto.randomUUID(),
                name: payload.city,
                active: true,
                updatedAt: new Date()
            }
        });
        const cityId = cityRecord.id;

        // Validate the vertical exists
        const GROCERY_FALLBACK = 'c307b78e-b924-47a1-a5a7-4405777fa50c';
        let verticalId = payload.verticalId;
        if (verticalId) {
            const verticalExists = await prisma.vertical.findUnique({ where: { id: verticalId } });
            if (!verticalExists) {
                console.warn(`[Signup] Invalid verticalId ${verticalId}, falling back to Grocery`);
                verticalId = GROCERY_FALLBACK;
            }
        } else {
            verticalId = GROCERY_FALLBACK;
        }

        // 5. ACID Transaction
        try {
            await prisma.$transaction(async (tx) => {
                // 5a. Create/Update Prisma User (Role: MERCHANT) - user might exist as consumer
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

                // 5b. Create Prisma Store
                await tx.store.create({
                    data: {
                        id: userId,
                        name: payload.storeName,
                        cityId: cityId,
                        managerId: userId,
                        address: payload.address,
                        active: false,
                        image: payload.storePhotos.length > 0 ? payload.storePhotos[0] : null,
                        updatedAt: new Date()
                    }
                });

                // 5c. Create merchant record for Admin Dashboard (formal model managed by Prisma)
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
                        cuisines: payload.cuisines || [],
                        isVeg: payload.isVeg ?? false,
                        restaurantType: payload.restaurantType || null,
                        verticalId: verticalId
                    }
                });

                // 5d. ALWAYS create a default branch for the merchant's primary location.
                // Uses merchant_id as branch_id so single-store merchants have a valid
                // FK target for StoreProduct.branch_id, and the StoreContext fallback
                // (activeStoreId = merchant_id) resolves correctly. Without this, new
                // merchants who don't toggle "multi-branch" can't add products because
                // fk_storeproduct_branch fails on first save. (Bug fixed May 20, 2026.)
                await tx.merchantBranch.create({
                    data: {
                        id: userId, // critical: same UUID as merchant_id
                        merchantId: userId,
                        storeId: userId, // Phase 2 FINAL — F1 (2026-06-16): parent Store = userId
                        branchName: payload.storeName || 'Main Branch',
                        managerName: payload.ownerName,
                        phone: payload.phone,
                        address: payload.address,
                        city: payload.city,
                        latitude: payload.latitude,
                        longitude: payload.longitude,
                        isActive: true,
                        cuisines: payload.cuisines || [],
                        isVeg: payload.isVeg ?? null,
                        restaurantType: payload.restaurantType || null,
                        branchPhotos: payload.storePhotos || [],
                    }
                });

                // 5e. Insert ADDITIONAL branches if the merchant declared multi-store.
                // (Atomic, relying on Prisma to generate UUID keys for these.)
                if (payload.hasBranches && payload.branches && payload.branches.length > 0) {
                    await tx.merchantBranch.createMany({
                        data: payload.branches.map((b: any) => ({
                            merchantId: userId,
                            storeId: userId, // Phase 2 FINAL — F1 (2026-06-16): parent Store = userId
                            branchName: b.name || 'Branch',
                            managerName: b.manager_name,
                            phone: b.phone,
                            address: b.address,
                            isActive: true,
                            cuisines: b.cuisines || [],
                            isVeg: b.is_veg ?? null,
                            restaurantType: b.restaurant_type || null,
                            branchPhotos: b.branch_photos || [],
                        }))
                    });
                }

                // 5e. Insert Secure Subscription Record
                if (payload.subscription) {
                    await tx.subscription.create({
                        data: {
                            merchantId: userId,
                            amount: payload.subscription.amount,
                            currency: 'INR',
                            status: 'success',
                            provider: 'razorpay',
                            transactionId: payload.subscription.paymentId
                        }
                    });
                }
            });
        } catch (txnError: any) {
            console.error('[Signup Transaction Error]', txnError);
            if (txnError.code === 'P2002') {
                const target = txnError.meta?.target || 'field';
                return res.status(400).json({ error: `Registration failed: The ${target} is already in use by another merchant.` });
            }
            throw txnError; // let the outer catch block handle it
        }

        res.json({ success: true, message: 'Merchant successfully registered' });

        } catch (error: any) {
        // Round-7 fix: final-step signup failure must surface the specific reason
        // (Wati error, Razorpay error, Prisma constraint, etc.) so the merchant
        // knows whether to retry, fix the input, or contact support.
        return handleApiError(res, error, { area: 'auth.merchant.signup', extra: undefined, userMessage: error?.message || 'Registration failed' });
    }
});

/**
 * GET /auth/me
 * Fetch the authenticated user's profile using their Supabase JWT.
 * Header: Authorization: Bearer <token>
 */
app.get('/auth/me', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }

        const token = authHeader.split(' ')[1];

        // Verify token with Supabase
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

        if (authError || !user) {
            console.error('[Auth] Token verification failed:', authError);
            return res.status(401).json({ error: 'Unauthorized', details: authError?.message });
        }

        // Fetch profile from Prisma (Primary source of truth for user data)
        const profile = await prisma.profile.findUnique({
            where: { id: user.id }
        });

        // Return unified user/profile object
        res.json({
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone || (user.user_metadata?.phone)
            },
            profile: profile || { tier: 'Member', credits: 0 } // Fallback if profile row is missing
        });
        } catch (error: any) {
        return handleApiError(res, error, { area: 'auth.me', extra: undefined, userMessage: 'Failed to fetch user context' });
    }
});

// --- Sentry test endpoint (admin-gated) ---
// Throws on purpose. Useful to verify Sentry receives + that source maps are
// resolving (after the 2026-06-02 wizard pass, stack traces should show real
// function names). Locked behind requireAdmin so randos can't trigger alerts.
app.get('/debug-sentry', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    throw new Error(`[Sentry verification] Triggered by admin ${caller.id}`);
});

// --- Resend test endpoint (admin-gated) ---
// Sends one of the 4 template emails to a target address. Admin-locked so we
// can't spam customers + nobody else can fire test sends. Usage:
//   POST /debug-resend
//   { to: "you@example.com", template: "received" | "approved" | "rejected" | "needs_info" }
app.post('/debug-resend', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    const { to, template = 'received' } = req.body || {};
    if (!to || typeof to !== 'string') {
        return res.status(400).json({ error: 'Provide { to: "email@domain.com" }' });
    }
    try {
        const name = 'Test Partner';
        if (template === 'approved') {
            await sendStoreApprovedEmail(to, name, 'Test Store');
        } else if (template === 'rejected') {
            await sendStoreRejectedEmail(to, name, 'Test rejection reason (verification only).');
        } else if (template === 'needs_info') {
            await sendStoreNeedsInfoEmail(to, name, 'Please re-upload your GST certificate.\nThis is a test send.');
        } else {
            await sendApplicationReceivedEmail(to, name);
        }
        res.json({ success: true, to, template, triggeredBy: caller.id });
        } catch (e: any) {
        // Round-7 fix: the entire point of /debug-resend is to surface Resend errors.
        return handleApiError(res, e, { area: 'debug-resend', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: e?.message || 'Email send failed' });
    }
});

// --- Admin: invite a new admin-tier user (Super Admin only) ---
// Per the 2026-06-02 RBAC doc, only SUPER_ADMIN can create/edit admin accounts.
//
// Two paths:
//   - method: 'email' (default) — server generates a temp password, creates the
//     Supabase auth user via admin API, inserts User row, emails via Resend.
//     Invitee logs in with email/password and is force-prompted to change it.
//   - method: 'phone' — server inserts into AdminAllowlist with the chosen role.
//     Invitee opens admin.pickatstore.io, switches to phone-OTP login, gets OTP
//     via Wati (existing flow). On first verify-otp, the User row is JIT-created
//     and the role is promoted from AdminAllowlist. No template needed.
app.post('/admin/users/invite', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    try {
        const { method = 'email', email, phone, name, role } = req.body || {};
        if (!name || !role) {
            return res.status(400).json({ error: 'name and role are required' });
        }
        const allowedRoles = ['OPERATIONS', 'FINANCE', 'SUPPORT', 'SUPER_ADMIN'];
        if (!allowedRoles.includes(String(role).toUpperCase())) {
            return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}` });
        }
        const targetRole = String(role).toUpperCase();
        const inviterName = (caller as any).email?.split('@')[0] || 'A team member';
        const labels: Record<string, string> = {
            SUPER_ADMIN: 'Super Admin',
            OPERATIONS:  'Operations',
            FINANCE:     'Finance',
            SUPPORT:     'Customer Support',
        };

        // ─── Phone path ──────────────────────────────────────────────────
        if (method === 'phone') {
            if (!phone) {
                return res.status(400).json({ error: 'phone is required when method=phone' });
            }
            // Normalize: strip non-digits; require 10 digits; prepend 91 for India.
            const digits = String(phone).replace(/\D/g, '');
            if (digits.length < 10) {
                return res.status(400).json({ error: 'phone must be a 10-digit Indian number' });
            }
            const normPhone = digits.length === 10 ? `91${digits}` : digits;

            // Reject if already invited / allowlisted.
            const existingAllow = await prisma.adminAllowlist.findUnique({ where: { phone: normPhone } });
            if (existingAllow && existingAllow.isActive) {
                return res.status(409).json({ error: 'This phone is already in the admin allowlist' });
            }
            // Upsert allowlist row carrying the chosen role.
            await prisma.adminAllowlist.upsert({
                where: { phone: normPhone },
                update: { name, role: targetRole, isActive: true },
                create: { phone: normPhone, name, role: targetRole, isActive: true },
            });
            console.log(`[InviteAdmin] Phone allowlist ${normPhone} (role=${targetRole}) (invited by ${caller.id})`);
            return res.json({
                success: true,
                method: 'phone',
                phone: normPhone,
                role: targetRole,
                hint: `Tell ${name} to open admin.pickatstore.io, switch to phone-OTP login, and enter +${normPhone}.`,
            });
        }

        // ─── Email path (existing) ───────────────────────────────────────
        if (!email) {
            return res.status(400).json({ error: 'email is required when method=email' });
        }
        const targetEmail = String(email).trim().toLowerCase();
        const existing = await prisma.user.findFirst({ where: { email: targetEmail } });
        if (existing) {
            return res.status(409).json({ error: 'A user with this email already exists' });
        }

        const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
        let tempPassword = '';
        for (let i = 0; i < 16; i++) tempPassword += ALPHA[Math.floor(Math.random() * ALPHA.length)];

        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
            email: targetEmail,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name, mustChangePassword: true, invitedBy: caller.id },
        });
        if (createErr || !created?.user) {
            console.error('[InviteAdmin] createUser failed:', createErr);
            return res.status(500).json({ error: createErr?.message || 'Failed to create auth user' });
        }
        try {
            await prisma.user.create({
                data: {
                    id: created.user.id,
                    email: targetEmail,
                    name,
                    role: targetRole as any,
                    passwordHash: 'managed-by-supabase-auth',
                    updatedAt: new Date(),
                },
            });
        } catch (profileErr: any) {
            console.error('[InviteAdmin] User row insert failed, rolling back auth user:', profileErr);
            await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
            Sentry.captureException(profileErr, { tags: { area: 'admin.users.invite' }, extra: {} });
            markResponseAsReported(res);
            return res.status(500).json({ error: profileErr?.message || 'Failed to create user profile' });
        }
        try {
            await sendAdminInviteEmail(targetEmail, name, labels[targetRole] ?? targetRole, tempPassword, inviterName);
        } catch (mailErr: any) {
            console.warn('[InviteAdmin] Email send failed (user was still created):', mailErr?.message);
        }
        console.log(`[InviteAdmin] Email-created ${targetRole} ${targetEmail} (invited by ${caller.id})`);
        res.json({ success: true, method: 'email', id: created.user.id, email: targetEmail, role: targetRole });
        } catch (e: any) {
        // Round-7 fix: admin needs to see "Email already exists" / "Phone already allowlisted" / etc, not generic.
        return handleApiError(res, e, { area: 'admin.users.invite', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: e?.message || 'Invite failed' });
    }
});

// --- Admin: edit role / status of an existing user (Super Admin only) ---
//
// Body: { role?: string, status?: 'active'|'suspended', suspendedReason?: string }
//
// Safeguards:
//   - Self-suspend blocked (can't lock yourself out).
//   - Last-Super-Admin safeguard: demoting or suspending the only remaining
//     Super Admin is blocked. "Super Admin" here = role==='SUPER_ADMIN' OR
//     isAdmin===true (legacy). Counts only active users.
app.patch('/admin/users/:id', async (req, res) => {
    const caller = await requireAdmin(req, res); if (!caller) return;
    try {
        const { id } = req.params;
        const { role, status, suspendedReason } = req.body || {};

        if (!role && !status) {
            return res.status(400).json({ error: 'Provide at least one of: role, status' });
        }

        const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isAdmin: true, email: true } });
        if (!target) return res.status(404).json({ error: 'User not found' });

        // Self-suspend block.
        if (status === 'suspended' && id === caller.id) {
            return res.status(400).json({ error: "You can't suspend your own account." });
        }

        // Last-Super-Admin safeguard.
        const targetIsCurrentlySuperAdmin = target.role === 'SUPER_ADMIN' || target.isAdmin === true;
        const isDemoteOrSuspend =
            (role && String(role).toUpperCase() !== 'SUPER_ADMIN') ||
            status === 'suspended';
        if (targetIsCurrentlySuperAdmin && isDemoteOrSuspend) {
            const otherSuperAdmins = await prisma.user.count({
                where: {
                    id: { not: id },
                    status: { not: 'suspended' },
                    OR: [{ role: 'SUPER_ADMIN' }, { isAdmin: true }],
                },
            });
            if (otherSuperAdmins === 0) {
                return res.status(400).json({
                    error: 'Cannot demote or suspend the only remaining Super Admin. Promote another user first.',
                });
            }
        }

        // Validate role if provided.
        const allowedRoles = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'];
        const updates: any = { updatedAt: new Date() };
        if (role) {
            const normRole = String(role).toUpperCase();
            if (!allowedRoles.includes(normRole)) {
                return res.status(400).json({ error: `role must be one of: ${allowedRoles.join(', ')}` });
            }
            updates.role = normRole;
            // If they're being demoted to non-SUPER_ADMIN, also drop the legacy isAdmin flag
            // so requireAdmin doesn't keep treating them as Super Admin.
            if (normRole !== 'SUPER_ADMIN') {
                updates.isAdmin = false;
            } else {
                updates.isAdmin = true;
            }
        }
        if (status) {
            if (status !== 'active' && status !== 'suspended') {
                return res.status(400).json({ error: "status must be 'active' or 'suspended'" });
            }
            updates.status = status;
            if (status === 'suspended') {
                updates.suspendedAt = new Date();
                updates.suspendedReason = suspendedReason ?? null;
            } else {
                updates.suspendedAt = null;
                updates.suspendedReason = null;
            }
        }

        const updated = await prisma.user.update({
            where: { id },
            data: updates,
            select: { id: true, email: true, role: true, isAdmin: true, status: true, suspendedAt: true, suspendedReason: true },
        });
        console.log(`[AdminEdit] ${target.email}: ${JSON.stringify(updates)} (by ${caller.id})`);
        res.json({ success: true, user: updated });
        } catch (e: any) {
        // Round-7 fix: admin needs to see "Cannot demote yourself" / "Role conflict" / etc, not generic.
        return handleApiError(res, e, { area: 'admin.users', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: e?.message || 'Edit failed' });
    }
});

// --- Wati inbound webhook ---
// Wati sends a POST here every time a customer messages the business number.
// Activate by setting the webhook URL in Wati dashboard → Settings → Webhooks
// to: https://api.pickatstore.io/webhooks/wati
//
// Wati payload shape varies by message type — we capture the raw payload AND
// best-effort extract common fields. Admin Customer Support inbox reads from
// the wati_inbox table downstream.
//
// Security: the route is open by design (Wati can't sign requests with our
// secret), but we de-dup on Wati's own message_id so replay is harmless.
app.post('/webhooks/wati', async (req, res) => {
    try {
        const payload = req.body || {};
        // Wati v3 webhook common fields — fall back gracefully if shape differs.
        const watiMessageId = payload.id || payload.messageId || payload.whatsappMessageId || null;
        const waPhone = String(payload.waId || payload.from || payload.whatsappNumber || '').replace(/^\+/, '');
        const contactName = payload.senderName || payload.contactName || null;
        const messageType = payload.type || payload.eventType || 'text';
        const body =
            payload.text?.body ??
            payload.text ??
            payload.message ??
            payload.button?.text ??
            payload.interactive?.button_reply?.title ??
            null;

        if (!waPhone) {
            // Not a usable inbound — acknowledge so Wati doesn't retry.
            console.warn('[wati-webhook] payload missing wa phone; storing raw only', payload);
        }

        await prisma.watiInbox.create({
            data: {
                watiMessageId,
                waPhone: waPhone || 'unknown',
                contactName,
                messageType,
                body,
                rawPayload: payload,
            },
        }).catch((e: any) => {
            // Unique-constraint conflict on watiMessageId = duplicate webhook; that's fine.
            if (e?.code !== 'P2002') {
                console.error('[wati-webhook] persist error:', e?.message || e);
            }
        });

        // Always 200 — never block Wati.
        res.json({ ok: true });
    } catch (e: any) {
        console.error('[wati-webhook] error:', e?.message || e);
        // Still 200 — we don't want Wati's retry storm even on our errors.
        res.json({ ok: true, captured: false });
    }
});

// --- Wati inbox list ---
// RBAC: OPERATIONS / FINANCE / SUPPORT all read; SUPER_ADMIN via wildcard.
// Customer support team is the primary consumer.
app.get('/wati/inbox', async (req, res) => {
    const caller = await requireRole(req, res, ['OPERATIONS', 'FINANCE', 'SUPPORT']); if (!caller) return;
    try {
        const status = typeof req.query.status === 'string' ? req.query.status : undefined;
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 200);
        const rows = await prisma.watiInbox.findMany({
            where: status ? { status } : undefined,
            orderBy: { receivedAt: 'desc' },
            take: limit,
        });
        res.json({ data: rows, count: rows.length });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'wati.inbox', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch inbox' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin reads — proper architecture (added 2026-06-03 night)
//
// Why these exist:
//   admin-web's Customers + Orders pages were reading directly from Supabase
//   via PostgREST (.from('orders'), .from('User'), etc.). That repeatedly
//   hit "table not in schema cache" / RLS-blocked-row issues — admin-tier
//   users have no implicit read access to the production tables, and adding
//   table-by-table RLS policies for the admin UI is fragile.
//
//   These endpoints use Prisma (direct PG connection, service_role-equivalent)
//   gated by requireRole. Clean: auth at the API layer, RBAC enforced, no
//   PostgREST cache surprises, no RLS policy management for admin UIs.
//
// Roles allowed: SUPER_ADMIN + OPERATIONS + FINANCE + SUPPORT (all admin tiers).
//   Routes do not return raw passwords or sensitive auth fields.
// ────────────────────────────────────────────────────────────────────────────

const ANY_ADMIN_TIER = ['SUPER_ADMIN', 'OPERATIONS', 'FINANCE', 'SUPPORT'] as const;

// 2026-06-14: Global Config — platform_settings key/value store.
// GET/PATCH /admin/config (admin) + GET /config/public (apps consume).
app.get('/admin/config', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const rows: any[] = await prisma.$queryRawUnsafe(`SELECT key, value FROM public.platform_settings`);
        const settings: Record<string, any> = {};
        for (const r of rows) settings[r.key] = r.value;
        return res.json({ settings });
    } catch (e: any) {
        console.error('[admin/config GET] error:', e?.message || e);
        return res.status(500).json({ error: 'Failed to load config' });
    }
});

app.patch('/admin/config', async (req, res) => {
    const caller = await requireRole(req, res, ['SUPER_ADMIN'] as any); if (!caller) return;
    try {
        const updates = (req.body || {}) as Record<string, any>;
        const allowed = ['service_radius_km', 'min_order_value'];
        const entries = Object.entries(updates).filter(([k]) => allowed.includes(k));
        if (!entries.length) return res.status(400).json({ error: 'No valid settings provided' });
        for (const [k, v] of entries) {
            const num = Number(v);
            if (!isFinite(num) || num < 0) return res.status(400).json({ error: `${k} must be a non-negative number` });
            await prisma.$executeRaw`
                INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
                VALUES (${k}, to_jsonb(${num}::numeric), now(), ${caller.id}::uuid)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`;
        }
        await recordAdminAudit(req, {
            actorId: caller.id, action: 'config.update', targetTable: 'platform_settings',
            targetId: entries.map((e) => e[0]).join(','), after: Object.fromEntries(entries), reason: 'Global Config update',
        });
        return res.json({ ok: true });
    } catch (e: any) {
        console.error('[admin/config PATCH] error:', e?.message || e);
        return res.status(500).json({ error: 'Failed to update config' });
    }
});

// Public platform config for the consumer/merchant apps (no auth — 2 numbers only).
app.get('/config/public', async (_req, res) => {
    try {
        const rows: any[] = await prisma.$queryRawUnsafe(`SELECT key, value FROM public.platform_settings WHERE key IN ('service_radius_km','min_order_value')`);
        const cfg = { serviceRadiusKm: 10, minOrderValue: 0 };
        for (const r of rows) {
            if (r.key === 'service_radius_km') cfg.serviceRadiusKm = Number(r.value);
            if (r.key === 'min_order_value') cfg.minOrderValue = Number(r.value);
        }
        return res.json(cfg);
    } catch {
        return res.json({ serviceRadiusKm: 10, minOrderValue: 0 });
    }
});

// 2026-06-14: two-way Wati support inbox — threaded conversations + reply.
// Threads = wati_inbox grouped by waPhone (latest 500 messages).
app.get('/admin/wati/threads', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const rows = await prisma.watiInbox.findMany({ orderBy: { receivedAt: 'desc' }, take: 500 });
        const byPhone = new Map<string, any>();
        for (const r of rows) {
            if (!byPhone.has(r.waPhone)) {
                byPhone.set(r.waPhone, {
                    waPhone: r.waPhone,
                    contactName: r.contactName,
                    lastBody: r.body,
                    lastAt: r.receivedAt,
                    lastDirection: r.direction,
                    status: r.status,
                    unread: 0,
                    count: 0,
                });
            }
            const t = byPhone.get(r.waPhone);
            t.count++;
            if (r.direction === 'inbound' && !r.isRead) t.unread++;
        }
        return res.json({ threads: Array.from(byPhone.values()) });
    } catch (e: any) {
        return handleApiError(res, e, { area: 'wati.threads', extra: undefined, userMessage: 'Failed to load conversations' });
    }
});

// All messages for one conversation (asc). Marks inbound as read.
app.get('/admin/wati/thread', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const phone = String(req.query.phone || '');
        if (!phone) return res.status(400).json({ error: 'phone is required' });
        const messages = await prisma.watiInbox.findMany({
            where: { waPhone: phone }, orderBy: { receivedAt: 'asc' }, take: 300,
        });
        await prisma.watiInbox.updateMany({
            where: { waPhone: phone, direction: 'inbound', isRead: false }, data: { isRead: true },
        });
        return res.json({ phone, messages });
    } catch (e: any) {
        return handleApiError(res, e, { area: 'wati.thread', extra: undefined, userMessage: 'Failed to load conversation' });
    }
});

// Reply into a Wati thread (free-text session message, 24h window). Records the
// outbound message so the thread shows it. Returns 502 with Wati's reason if the
// window has expired / Wati rejects.
app.post('/admin/wati/reply', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const phone = String(req.body?.phone || '');
        const body = String(req.body?.body || '').trim();
        if (!phone || !body) return res.status(400).json({ error: 'phone and body are required' });
        const result = await watiService.sendSessionMessage(phone, body);
        if (!result.ok) {
            return res.status(502).json({ error: result.error || 'Failed to send WhatsApp reply' });
        }
        const saved = await prisma.watiInbox.create({
            data: {
                waPhone: phone,
                direction: 'outbound',
                messageType: 'text',
                body,
                rawPayload: { sentBy: caller.id, via: 'admin-support-inbox' } as any,
                status: 'open',
                isRead: true,
            },
        });
        return res.json({ ok: true, message: saved });
    } catch (e: any) {
        return handleApiError(res, e, { area: 'wati.reply', extra: undefined, userMessage: 'Failed to send reply' });
    }
});

/**
 * recordAdminAudit — best-effort audit-trail writer.
 *
 * Writes to `public.admin_audit_log` (see docs/migrations-pending-2026-06-04.sql
 * for the schema). Wrapped in try/catch so it NEVER fails the user-facing
 * action — if the table doesn't exist yet (founder hasn't applied the
 * migration), the audit attempt silently no-ops and the response still
 * returns 200. Once the migration is applied, entries land without further
 * code changes.
 *
 * Uses $executeRaw with parameter binding (not template substitution) so
 * this works without adding the table to schema.prisma.
 */
async function recordAdminAudit(req: express.Request, opts: {
    actorId: string;
    action: string;
    targetTable: string;
    targetId: string;
    before?: any;
    after?: any;
    reason?: string;
}) {
    try {
        await prisma.$executeRaw`
            INSERT INTO public.admin_audit_log (
                actor_id, action, target_table, target_id,
                before_value, after_value, reason,
                ip_address, user_agent
            ) VALUES (
                ${opts.actorId}::uuid,
                ${opts.action},
                ${opts.targetTable},
                ${opts.targetId},
                ${opts.before ? JSON.stringify(opts.before) : null}::jsonb,
                ${opts.after  ? JSON.stringify(opts.after)  : null}::jsonb,
                ${opts.reason ?? null},
                ${(req.headers['x-forwarded-for'] as string) || req.ip || null},
                ${(req.headers['user-agent'] as string) || null}
            )
        `;
    } catch (e: any) {
        // Common case before migration applied: relation "admin_audit_log" does not exist.
        console.warn('[audit] entry not written:', e?.message || String(e));
    }
}

/**
 * GET /admin/customers
 *
 * Returns every consumer + their orders (aggregated client-side for
 * LTV / AOV / recency) + a branch→city map so the UI can derive the
 * customer's location from their most recent order's branch.
 *
 * Shape (kept stable with the prior useCustomers hook so the client
 * mapping logic stays unchanged):
 *   {
 *     customers: [
 *       { id, name, email, phone, status, createdAt,
 *         orders: [{ total_amount, created_at, branch_id, status }] }
 *     ],
 *     branchCityMap: { [branchId]: city }
 *   }
 */
app.get('/admin/customers', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        // 2026-06-04: paginated. Default page = 500 customers, cap = 2000.
        // Client doesn't yet have a load-more UI; this is server-side hardening
        // so the endpoint can't be made to return 100k rows + their order arrays
        // in one shot as the consumer base grows.
        const limit  = Math.min(parseInt((req.query.limit  as string) || '500', 10) || 500, 2000);
        const offset = Math.max(parseInt((req.query.offset as string) || '0',   10) || 0,   0);

        // 2026-06-04 (Q2/Q3 fix): widened from `role: 'CONSUMER'` to "anyone who
        // signed up as a consumer OR has placed at least one order, regardless of
        // role". Pranav's audit showed 35/48 test orders (73%) were sitting under
        // MERCHANT-role users (phone matched a branch → JIT promoted to MERCHANT
        // at OTP-verify) so the prior filter hid them entirely.
        const customersWhere = {
            OR: [
                { role: 'CONSUMER' as const },
                { orders: { some: {} } },
            ],
        };

        const [users, totalCount] = await Promise.all([
            prisma.user.findMany({
                where: customersWhere,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    status: true,
                    role: true,
                    createdAt: true,
                    orders: {
                        select: {
                            totalAmount: true,
                            createdAt:   true,
                            branchId:    true,
                            status:      true,
                        },
                    },
                },
            }),
            prisma.user.count({ where: customersWhere }),
        ]);

        // Name fallback: for users with NULL User.name, look up profiles.full_name
        // (the consumer app's ProfileSetupScreen writes to public.profiles.full_name,
        // not User.name — that's the architectural split we're patching at the read
        // layer for now; Option A below writes User.name on future setups).
        const userIdsWithNullName = users.filter(u => !u.name).map(u => u.id);
        const profileNameMap: Record<string, string> = {};
        if (userIdsWithNullName.length > 0) {
            const profiles = await prisma.profile.findMany({
                where: { id: { in: userIdsWithNullName } },
                select: { id: true, fullName: true },
            });
            profiles.forEach(p => { if (p.fullName) profileNameMap[p.id] = p.fullName; });
        }

        // Collect unique branch IDs across every customer's orders → look up city.
        const branchIds = new Set<string>();
        users.forEach(u => u.orders.forEach(o => { if (o.branchId) branchIds.add(o.branchId); }));

        let branchCityMap: Record<string, string> = {};
        if (branchIds.size > 0) {
            const branches = await prisma.merchantBranch.findMany({
                where: { id: { in: Array.from(branchIds) } },
                select: { id: true, city: true },
            });
            branches.forEach(b => { if (b?.id && b?.city) branchCityMap[b.id] = b.city; });
        }

        // 2026-06-04 (Q1-A): pull consumer_addresses for the location column.
        // We return the DEFAULT address per user + a count of all addresses;
        // the full list ships via GET /admin/customers/:id/addresses for the drawer.
        const userIds = users.map(u => u.id);
        const addressCountByUser: Record<string, number> = {};
        const defaultAddressByUser: Record<string, {
            id: string; type: string | null; address: string | null;
            latitude: number | null; longitude: number | null;
        }> = {};
        if (userIds.length > 0) {
            try {
                const allAddrs = await prisma.consumer_addresses.findMany({
                    where: { user_id: { in: userIds } },
                    select: {
                        id: true, user_id: true, type: true, address: true,
                        latitude: true, longitude: true, is_default: true, created_at: true,
                    },
                });
                allAddrs.forEach(a => {
                    if (!a.user_id) return;
                    addressCountByUser[a.user_id] = (addressCountByUser[a.user_id] ?? 0) + 1;
                });
                // Default = is_default true; tie-break = most recent
                allAddrs.forEach(a => {
                    if (!a.user_id) return;
                    const cur = defaultAddressByUser[a.user_id];
                    const isBetter =
                        !cur ||
                        (a.is_default === true) ||
                        (a.created_at && cur && (a as any).created_at > (cur as any).created_at);
                    if (isBetter) {
                        defaultAddressByUser[a.user_id] = {
                            id:        a.id,
                            type:      a.type,
                            address:   a.address,
                            latitude:  a.latitude,
                            longitude: a.longitude,
                        };
                    }
                });
            } catch (e: any) {
                console.warn('[admin/customers] consumer_addresses lookup failed:', e?.message || e);
            }
        }

        // 2026-06-04 (Q2-C): fuzzy-detect likely duplicate accounts among the loaded
        // customers — phones within Levenshtein distance ≤ 1. Catches test typos
        // (e.g. 917842687373 ↔ 917842287373). Requires the `fuzzystrmatch` extension;
        // wrapped in try/catch so if it's not enabled, we silently return no hints.
        const phoneToIds: Record<string, string[]> = {};
        users.forEach(u => {
            if (u.phone) {
                if (!phoneToIds[u.phone]) phoneToIds[u.phone] = [];
                phoneToIds[u.phone].push(u.id);
            }
        });
        const possibleDupesByUser: Record<string, string[]> = {};
        try {
            const phones = Object.keys(phoneToIds);
            if (phones.length >= 2) {
                // Self-join only the phones we've actually loaded — bounded work.
                const rows = await prisma.$queryRaw<Array<{ a_phone: string; b_phone: string }>>`
                    SELECT a.phone AS a_phone, b.phone AS b_phone
                    FROM (SELECT unnest(${phones}::text[]) AS phone) a
                    JOIN (SELECT unnest(${phones}::text[]) AS phone) b
                      ON a.phone < b.phone
                     AND LENGTH(a.phone) = LENGTH(b.phone)
                     AND levenshtein(a.phone, b.phone) <= 1
                `;
                rows.forEach(({ a_phone, b_phone }) => {
                    const aIds = phoneToIds[a_phone] ?? [];
                    const bIds = phoneToIds[b_phone] ?? [];
                    aIds.forEach(aId => {
                        bIds.forEach(bId => {
                            if (!possibleDupesByUser[aId]) possibleDupesByUser[aId] = [];
                            if (!possibleDupesByUser[bId]) possibleDupesByUser[bId] = [];
                            possibleDupesByUser[aId].push(bId);
                            possibleDupesByUser[bId].push(aId);
                        });
                    });
                });
            }
        } catch (e: any) {
            // Most common cause: `levenshtein` function not available (fuzzystrmatch
            // extension not enabled). Apply the SQL doc to enable. Until then, the
            // duplicate-hint column is silently empty.
            console.warn('[admin/customers] fuzzy-dupe check skipped:', e?.message || e);
        }

        // Reshape to snake_case for the client (matches the previous PostgREST shape).
        const customers = users.map(u => ({
            id:        u.id,
            name:      u.name ?? profileNameMap[u.id] ?? null,
            email:     u.email,
            phone:     u.phone,
            status:    u.status,
            role:      u.role,
            createdAt: u.createdAt,
            orders: u.orders.map(o => ({
                total_amount: o.totalAmount,
                created_at:   o.createdAt,
                branch_id:    o.branchId,
                status:       o.status,
            })),
            default_address:      defaultAddressByUser[u.id] ?? null,
            address_count:        addressCountByUser[u.id] ?? 0,
            potential_duplicates: possibleDupesByUser[u.id] ?? [],
        }));

        res.json({
            customers, branchCityMap,
            total:    totalCount,
            limit, offset,
            hasMore:  offset + customers.length < totalCount,
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.customers', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch customers' });
    }
});

/**
 * GET /admin/orders
 *
 * Returns recent orders for the /orders Admin page. Optional `userId`
 * query param filters to a single customer's orders — used by the
 * "View orders" deep link from the Customers page.
 *
 * Shape mirrors the previous Supabase .from('orders') columns so the
 * OrderManager UI doesn't have to change beyond switching its data
 * source.
 */
app.get('/admin/orders', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const userId    = typeof req.query.userId    === 'string' ? req.query.userId    : undefined;
        const limit     = Math.min(parseInt((req.query.limit as string) || '500', 10) || 500, 1000);

        const rows = await prisma.order.findMany({
            where: userId ? { userId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id:              true,
                orderNumber:     true,
                customer_name:   true,
                customer_phone:  true,
                storeId:         true,
                store_name:      true,
                userId:          true,
                branchId:        true,
                status:          true,
                totalAmount:     true,
                items_count:     true,
                order_type:      true,
                cancelledReason: true,
                createdAt:       true,
            },
        });

        // Reshape to snake_case for the client.
        const orders = rows.map(o => ({
            id:               o.id,
            order_number:     o.orderNumber,
            customer_name:    o.customer_name,
            customer_phone:   o.customer_phone,
            store_id:         o.storeId,
            store_name:       o.store_name,
            user_id:          o.userId,
            branch_id:        o.branchId,
            status:           o.status,
            total_amount:     o.totalAmount,
            items_count:      o.items_count,
            order_type:       o.order_type,
            cancelled_reason: o.cancelledReason,
            created_at:       o.createdAt,
        }));

        res.json({ orders, count: orders.length });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.orders', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch orders' });
    }
});

/**
 * PATCH /admin/orders/:id
 *
 * Used by OrderManager's "Force complete" / "Force cancel" actions.
 * Status must be a valid OrderStatus enum value (uppercase).
 *
 * Restricted to SUPER_ADMIN + OPERATIONS (FINANCE/SUPPORT are view-only
 * for order status — they go through /refunds-disputes for refunds).
 */
app.patch('/admin/orders/:id', async (req, res) => {
    const caller = await requireRole(req, res, ['SUPER_ADMIN', 'OPERATIONS']); if (!caller) return;
    try {
        const { id } = req.params;
        const { status, cancelledReason } = req.body ?? {};
        // 2026-06-04: full 10-value OrderStatus enum. Was missing PREPARING +
        // RETURN_REQUESTED + RETURN_APPROVED + RETURN_REJECTED — admin
        // overrides to those states would 400 even though they're valid.
        const VALID: ReadonlyArray<string> = [
            'PENDING','CONFIRMED','PREPARING','READY','COMPLETED','CANCELLED',
            'RETURN_REQUESTED','RETURN_APPROVED','RETURN_REJECTED','REFUNDED',
        ];
        if (!status || !VALID.includes(status)) {
            return res.status(400).json({ error: `status must be one of ${VALID.join(', ')}` });
        }
        // Snapshot before-state for the audit log.
        const before = await prisma.order.findUnique({
            where: { id },
            select: { status: true, cancelledReason: true },
        });
        const updated = await prisma.order.update({
            where: { id },
            data: {
                status,
                ...(cancelledReason ? { cancelledReason } : {}),
            },
            select: { id: true, status: true },
        });
        // Best-effort audit — fire-and-forget pattern, but awaited so any
        // db connection errors get logged on this turn rather than orphaned.
        await recordAdminAudit(req, {
            actorId:     caller.id,
            action:      'order.status_change',
            targetTable: 'orders',
            targetId:    id,
            before:      before ? { status: before.status, cancelledReason: before.cancelledReason } : null,
            after:       { status: updated.status, cancelledReason: cancelledReason ?? null },
            reason:      cancelledReason,
        });
        res.json({ ok: true, order: updated });
    } catch (e: any) {
        console.error('[admin/orders] patch error:', e?.message || e);
        if (e?.code === 'P2025') return res.status(404).json({ error: 'Order not found' });
        Sentry.captureException(e, { tags: { area: 'admin.orders' }, extra: { id: req.params.id } });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to update order' });
    }
});

/**
 * GET /admin/customers/:id/orders
 *
 * Order history for the CustomerDetailsSheet drawer. Same role gate
 * as /admin/customers.
 */
app.get('/admin/customers/:id/orders', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const rows = await prisma.order.findMany({
            where: { userId: id },
            orderBy: { createdAt: 'desc' },
            take: 200,
            select: {
                id: true, orderNumber: true, store_name: true,
                totalAmount: true, status: true, createdAt: true,
            },
        });
        const orders = rows.map(o => ({
            id:           o.id,
            order_number: o.orderNumber,
            store_name:   o.store_name,
            total_amount: o.totalAmount,
            status:       o.status,
            created_at:   o.createdAt,
        }));
        res.json({ orders });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.customers.orders', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch customer orders' });
    }
});

/**
 * GET /admin/merchants/:id/orders
 *
 * Recent orders for a merchant — powers the Recent Orders tab in
 * MerchantDetailsSheet. Migrated from supabase.from('orders') direct
 * read (RLS-blocked for the authenticated JWT) to API + Prisma per the
 * "admin reads via API" architectural rule.
 */
app.get('/admin/merchants/:id/orders', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const limit = Math.min(parseInt((req.query.limit as string) || '50', 10) || 50, 500);
        const rows = await prisma.order.findMany({
            where: { storeId: id },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true, orderNumber: true, customer_name: true,
                totalAmount: true, status: true, createdAt: true,
                items_count: true, order_type: true,
            },
        });
        res.json({
            orders: rows.map(o => ({
                id:           o.id,
                order_number: o.orderNumber,
                customer_name:o.customer_name,
                total_amount: o.totalAmount,
                status:       o.status,
                created_at:   o.createdAt,
                items_count:  o.items_count,
                order_type:   o.order_type,
            })),
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.merchants.orders', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch merchant orders' });
    }
});

/**
 * GET /admin/customers/:id/addresses
 *
 * All addresses for one customer — used by the CustomerDetailsSheet "Addresses"
 * section. Returned ordered by is_default DESC, created_at DESC so the default
 * shows first.
 */
app.get('/admin/customers/:id/addresses', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const rows = await prisma.consumer_addresses.findMany({
            where: { user_id: id },
            orderBy: [{ is_default: 'desc' }, { created_at: 'desc' }],
            select: {
                id: true, type: true, address: true,
                latitude: true, longitude: true,
                is_default: true, created_at: true,
            },
        });
        res.json({
            addresses: rows.map(a => ({
                id:         a.id,
                type:       a.type,
                address:    a.address,
                latitude:   a.latitude,
                longitude:  a.longitude,
                is_default: a.is_default ?? false,
                created_at: a.created_at,
            })),
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.customers.addresses', extra: { id: req.params.id, userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to fetch customer addresses' });
    }
});

/**
 * PATCH /admin/customers/:id/name
 *
 * Lets any admin-tier user manually set / correct a customer's display name.
 * Use case: incomplete signups where User.name stayed NULL and ProfileSetup
 * was abandoned; admin can patch what they know from support context.
 *
 * Audited via recordAdminAudit. Failure to audit doesn't block the update.
 */
app.patch('/admin/customers/:id/name', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const { id } = req.params;
        const { name } = req.body ?? {};
        if (typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'name must be a string with at least 2 characters' });
        }
        const cleanName = name.trim();

        const before = await prisma.user.findUnique({
            where: { id },
            select: { id: true, name: true },
        });
        if (!before) return res.status(404).json({ error: 'User not found' });

        const updated = await prisma.user.update({
            where: { id },
            data:  { name: cleanName },
            select: { id: true, name: true },
        });

        // Best-effort audit.
        await recordAdminAudit(req, {
            actorId:     caller.id,
            action:      'customer.name_change',
            targetTable: 'User',
            targetId:    id,
            before:      { name: before.name },
            after:       { name: updated.name },
        });

        res.json({ ok: true, user: updated });
    } catch (e: any) {
        console.error('[admin/customers/:id/name] error:', e?.message || e);
        if (e?.code === 'P2025') return res.status(404).json({ error: 'User not found' });
        Sentry.captureException(e, { tags: { area: 'admin.customers.name' }, extra: { id: req.params.id } });
        markResponseAsReported(res);
        res.status(500).json({ error: 'Failed to update customer name' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Admin home dashboards — one endpoint per role-home (added 2026-06-04)
//
// The home dashboards under apps/admin-web/src/components/home/ were still
// reading via supabase.from() directly for KPI counts. RLS blocks those for
// admin-tier JWTs, so the tiles silently returned 0. Per the "admin reads
// go through API" architectural rule, each home now has a dedicated
// endpoint that aggregates everything it needs server-side via Prisma.
// ────────────────────────────────────────────────────────────────────────────

/**
 * GET /admin/home/super-admin
 *   Platform-wide overview tiles + Recent Activity feed.
 *   Range: 24h | 7d | 30d (default 30d) — for the "new customers in range" tile.
 */
app.get('/admin/home/super-admin', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const range = (typeof req.query.range === 'string' ? req.query.range : '30d') as '24h' | '7d' | '30d';
        const days  = range === '24h' ? 1 : range === '7d' ? 7 : 30;
        const since = new Date(); since.setDate(since.getDate() - days);

        const [newCustomers, activeBranches, recentOrders, recentMerchants] = await Promise.all([
            prisma.user.count({ where: { role: 'CONSUMER', createdAt: { gte: since } } }),
            prisma.merchantBranch.count({ where: { isActive: true } }),
            prisma.order.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true, orderNumber: true, customer_name: true,
                    totalAmount: true, status: true, createdAt: true,
                },
            }),
            prisma.merchant.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { id: true, storeName: true, status: true, createdAt: true },
            }),
        ]);

        res.json({
            newCustomers,
            activeBranches,
            recentOrders: recentOrders.map(o => ({
                id: o.id, order_number: o.orderNumber, customer_name: o.customer_name,
                total_amount: o.totalAmount, status: o.status, created_at: o.createdAt,
            })),
            recentMerchants: recentMerchants.map(m => ({
                id: m.id, store_name: m.storeName, status: m.status, created_at: m.createdAt,
            })),
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.home.super-admin', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to load super-admin home' });
    }
});

/**
 * GET /admin/home/operations
 *   Queue depths + today's order momentum (hourly buckets) + KYC + inbox feeds.
 */
app.get('/admin/home/operations', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const sinceMidnight = new Date(); sinceMidnight.setHours(0, 0, 0, 0);

        // Include the new PREPARING status in the "active queue" count (was missing
        // pre-2026-06-04). Cast to any so we don't need to import the Prisma enum here.
        const ACTIVE_FOR_QUEUE = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'] as any[];

        const [
            pendingOrders, kycPending, inboxUnread, activeBranches,
            pendingKycList, recentInboxRows, todaysOrders,
        ] = await Promise.all([
            prisma.order.count({ where: { status: { in: ACTIVE_FOR_QUEUE } } }),
            prisma.merchant.count({ where: { kycStatus: 'pending' } }),
            prisma.watiInbox.count({ where: { isRead: false } }),
            prisma.merchantBranch.count({ where: { isActive: true } }),
            prisma.merchant.findMany({
                where: { kycStatus: 'pending' },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: { id: true, storeName: true, kycStatus: true, createdAt: true },
            }),
            prisma.watiInbox.findMany({
                orderBy: { receivedAt: 'desc' },
                take: 8,
                select: {
                    id: true, contactName: true, waPhone: true, body: true,
                    receivedAt: true, isRead: true,
                },
            }),
            prisma.order.findMany({
                where: { createdAt: { gte: sinceMidnight } },
                select: { createdAt: true },
            }),
        ]);

        // Bucket today's orders into hours (server-side — was client-side before).
        const buckets: Record<number, number> = {};
        todaysOrders.forEach(o => {
            const h = new Date(o.createdAt).getHours();
            buckets[h] = (buckets[h] ?? 0) + 1;
        });
        const todaysOrdersHourly: { hour: string; orders: number }[] = [];
        const nowHour = new Date().getHours();
        for (let h = 0; h <= nowHour; h++) {
            todaysOrdersHourly.push({
                hour: `${h.toString().padStart(2, '0')}:00`,
                orders: buckets[h] ?? 0,
            });
        }

        res.json({
            pendingOrders, kycPending, inboxUnread, activeBranches,
            pendingKycList: pendingKycList.map(m => ({
                id: m.id, store_name: m.storeName,
                kyc_status: m.kycStatus, created_at: m.createdAt,
            })),
            recentInboxMessages: recentInboxRows.map(r => ({
                id: r.id, contact_name: r.contactName, wa_phone: r.waPhone,
                body: r.body, received_at: r.receivedAt, is_read: r.isRead,
            })),
            todaysOrdersHourly,
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.home.operations', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to load operations home' });
    }
});

/**
 * GET /admin/home/support
 *   Inbox + cancellation tiles + recent inbox/cancellations.
 */
app.get('/admin/home/support', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const sinceMidnight = new Date(); sinceMidnight.setHours(0, 0, 0, 0);

        const [
            inboxUnread, inboxTotal, cancelledToday,
            recentMessages, recentCancellations,
        ] = await Promise.all([
            prisma.watiInbox.count({ where: { isRead: false } }),
            prisma.watiInbox.count(),
            prisma.order.count({
                where: { status: 'CANCELLED', createdAt: { gte: sinceMidnight } },
            }),
            prisma.watiInbox.findMany({
                orderBy: { receivedAt: 'desc' },
                take: 12,
                select: {
                    id: true, contactName: true, waPhone: true, body: true,
                    receivedAt: true, isRead: true, status: true,
                },
            }),
            prisma.order.findMany({
                where: { status: 'CANCELLED' },
                orderBy: { createdAt: 'desc' },
                take: 8,
                select: {
                    id: true, orderNumber: true, customer_name: true,
                    customer_phone: true, totalAmount: true,
                    createdAt: true, cancelledReason: true,
                },
            }),
        ]);

        res.json({
            inboxUnread, inboxTotal, cancelledToday,
            recentMessages: recentMessages.map(r => ({
                id: r.id, contact_name: r.contactName, wa_phone: r.waPhone,
                body: r.body, received_at: r.receivedAt, is_read: r.isRead, status: r.status,
            })),
            recentCancellations: recentCancellations.map(o => ({
                id: o.id, order_number: o.orderNumber, customer_name: o.customer_name,
                customer_phone: o.customer_phone, total_amount: o.totalAmount,
                created_at: o.createdAt, cancelled_reason: o.cancelledReason,
            })),
        });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.home.support', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to load support home' });
    }
});

/**
 * GET /admin/home/finance
 *   Refund-pressure count. The rest of the Finance home uses
 *   get_super_admin_stats_in_range RPC which already works.
 */
app.get('/admin/home/finance', async (req, res) => {
    const caller = await requireRole(req, res, ANY_ADMIN_TIER as any); if (!caller) return;
    try {
        const refundLike = await prisma.order.count({
            where: { status: { in: ['CANCELLED', 'REFUNDED'] } },
        });
        res.json({ refundLike });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'admin.home.finance', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to load finance home' });
    }
});

// ────────────────────────────────────────────────────────────────────────────
// Self-profile update — consumer-side (added 2026-06-04, Option A)
//
// The consumer app's ProfileSetupScreen currently writes the user's name to
// public.profiles.full_name only. Our admin UI reads from public."User".name.
// Result: every user who completed profile-setup still showed "(no name)"
// in admin because the two columns were never synced.
//
// This endpoint accepts the same payload the screen already builds and
// writes to BOTH tables in a single Prisma transaction. The consumer app
// is being updated to call this instead of the direct supabase.from()
// upsert; the existing screen code path stays around as a fallback during
// the OTA rollout window.
// ────────────────────────────────────────────────────────────────────────────

app.post('/me/profile', async (req, res) => {
    const caller = await requireUser(req, res); if (!caller) return;
    try {
        const { name, email, dateOfBirth, avatarUrl } = req.body ?? {};

        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return res.status(400).json({ error: 'name must be a string with at least 2 characters' });
        }
        const cleanName = name.trim();

        // Resolve a phone if we already have one on the User row — needed only
        // when we create a fresh User (consumer JIT case).
        const existing = await prisma.user.findUnique({
            where: { id: caller.id },
            select: { id: true, phone: true, email: true },
        });
        const fallbackEmail = caller.email
            || existing?.email
            || `${caller.id}@user.pickatstore.app`;

        await prisma.$transaction([
            prisma.user.upsert({
                where: { id: caller.id },
                update: { name: cleanName },
                create: {
                    id:    caller.id,
                    email: fallbackEmail,
                    phone: existing?.phone ?? null,
                    name:  cleanName,
                    role:  'CONSUMER',
                },
            }),
            prisma.profile.upsert({
                where: { id: caller.id },
                update: {
                    fullName:         cleanName,
                    ...(email      ? { email }                                  : {}),
                    ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) }    : {}),
                    ...(avatarUrl  ? { avatarUrl }                              : {}),
                    profileCompleted: true,
                    updatedAt:        new Date(),
                },
                create: {
                    id:               caller.id,
                    fullName:         cleanName,
                    email:            email      ?? null,
                    dateOfBirth:      dateOfBirth ? new Date(dateOfBirth) : null,
                    avatarUrl:        avatarUrl  ?? null,
                    profileCompleted: true,
                    updatedAt:        new Date(),
                },
            }),
        ]);

        res.json({ ok: true, name: cleanName });
        } catch (e: any) {
        return handleApiError(res, e, { area: 'me.profile', extra: { userId: (req as any)?.user?.id ?? undefined }, userMessage: 'Failed to update profile' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// Phase 7C/7E (2026-06-10) — Settlement endpoints.
// Admin surface: close cycles, list/inspect, mark paid, manage commission
// rules + merchant settlement profiles. Merchant surface: own settlement
// history (7F backend — the merchant app calls with authHeaders; access is
// gated through userCanManageOrderStore, the same merchant-side guard the
// order endpoints use).
// ════════════════════════════════════════════════════════════════════════════

// Close a settlement cycle (defaults to the last fully elapsed IST week).
// Idempotent — safe to call alongside the Monday-02:00-IST cron.
app.post('/admin/settlements/close-cycle', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const weekOf = req.body?.weekOf ? new Date(String(req.body.weekOf)) : undefined;
        if (weekOf && isNaN(weekOf.getTime())) {
            return res.status(400).json({ error: 'weekOf must be a valid date' });
        }
        // 7G: drain the verification backlog first (batch-capped at 25/call)
        // so the close sees every verifiable order instead of holding them.
        for (let i = 0; i < 40; i++) {
            const n = await verifyPendingPayments(prisma);
            if (n < 25) break;
        }
        const result = await closeSettlementCycles(prisma, { weekOf, closedBy: admin.id });
        await writeAuditLog(admin.id, 'settlement.cycle_closed', 'settlement_period', result.periodStart, null, result as any);
        res.json(result);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlements.close', userMessage: error?.message || 'Failed to close settlement cycle' });
    }
});

// List cycles (admin) — filterable by status / merchant.
app.get('/admin/settlements', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const status = req.query.status ? String(req.query.status) : undefined;
        const merchantId = req.query.merchantId ? String(req.query.merchantId) : undefined;
        const cycles = await prisma.settlementCycle.findMany({
            where: { ...(status ? { status } : {}), ...(merchantId ? { merchantId } : {}) },
            orderBy: [{ periodStart: 'desc' }, { netPayout: 'desc' }],
            take: 200,
        });
        // Resolve store names in one pass for the table view.
        const ids = Array.from(new Set(cycles.map((c) => c.merchantId)));
        const stores = ids.length > 0 ? await prisma.store.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
        const nameById = new Map(stores.map((s) => [s.id, s.name]));
        res.json({ data: cycles.map((c) => ({ ...c, merchantName: nameById.get(c.merchantId) ?? null })) });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlements.list', userMessage: 'Failed to load settlements' });
    }
});

// Cycle detail + per-order lines (admin drill-down).
app.get('/admin/settlements/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const cycle = await prisma.settlementCycle.findUnique({
            where: { id: req.params.id },
            include: { lines: { orderBy: { createdAt: 'asc' } } },
        });
        if (!cycle) return res.status(404).json({ error: 'Settlement cycle not found' });
        const store = await prisma.store.findUnique({ where: { id: cycle.merchantId }, select: { name: true } });
        res.json({ ...cycle, merchantName: store?.name ?? null });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlements.detail', userMessage: 'Failed to load settlement' });
    }
});

// Mark a CLOSED cycle as PAID (manual money movement until the payout vendor
// lands — Phase 7b). Forward-only; blocked while the merchant is on hold.
app.post('/admin/settlements/:id/mark-paid', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const paymentReference = String(req.body?.paymentReference || '').trim();
        if (!paymentReference) {
            return res.status(400).json({ error: 'paymentReference is required (bank UTR / transfer id)' });
        }
        const cycle = await prisma.settlementCycle.findUnique({ where: { id: req.params.id } });
        if (!cycle) return res.status(404).json({ error: 'Settlement cycle not found' });
        if (cycle.status !== 'CLOSED') {
            return res.status(409).json({ error: `Cycle is ${cycle.status} — only CLOSED cycles can be marked paid` });
        }
        const profile = await prisma.merchantSettlementProfile.findUnique({ where: { id: cycle.merchantId } });
        if (profile?.settlementHold) {
            return res.status(409).json({ error: 'Merchant is on settlement hold — release the hold first' });
        }
        // Atomic forward-only flip.
        const flipped = await prisma.settlementCycle.updateMany({
            where: { id: cycle.id, status: 'CLOSED' },
            data: { status: 'PAID', paidAt: new Date(), paidBy: admin.id, paymentReference },
        });
        if (flipped.count === 0) {
            return res.status(409).json({ error: 'Cycle state changed concurrently — refresh and retry' });
        }
        await writeAuditLog(admin.id, 'settlement.marked_paid', 'settlement_cycle', cycle.id, null, { merchantId: cycle.merchantId, netPayout: cycle.netPayout, paymentReference } as any);
        res.json({ ok: true });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlements.markPaid', userMessage: 'Failed to mark settlement paid' });
    }
});

// Commission rules — list / update / create (admin).
app.get('/admin/commission-rules', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const rules = await prisma.commissionRule.findMany({
            orderBy: [{ category: 'asc' }, { orderType: 'asc' }, { tier: 'asc' }],
        });
        res.json({ data: rules });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'commissionRules.list', userMessage: 'Failed to load commission rules' });
    }
});

app.put('/admin/commission-rules/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const { ratePct, provisional } = req.body || {};
        const rate = Number(ratePct);
        if (!Number.isFinite(rate) || rate < 0 || rate > 50) {
            return res.status(400).json({ error: 'ratePct must be a number between 0 and 50' });
        }
        const before = await prisma.commissionRule.findUnique({ where: { id: req.params.id } });
        if (!before) return res.status(404).json({ error: 'Rule not found' });
        const updated = await prisma.commissionRule.update({
            where: { id: req.params.id },
            data: { ratePct: rate, ...(typeof provisional === 'boolean' ? { provisional } : {}) },
        });
        await writeAuditLog(admin.id, 'settlement.commission_rule_updated', 'commission_rule', updated.id, { ratePct: before.ratePct, provisional: before.provisional } as any, { ratePct: updated.ratePct, provisional: updated.provisional } as any);
        res.json(updated);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'commissionRules.update', userMessage: 'Failed to update commission rule' });
    }
});

// 7G — settlement profile worklist: every store with its profile state, so
// the admin can see who is configured and who is silently HELD. Without this
// the close holds 100% of merchants with no operable remediation surface.
app.get('/admin/settlement-profiles', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const stores = await prisma.store.findMany({
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
            take: 500,
        });
        const profiles = stores.length > 0 ? await prisma.merchantSettlementProfile.findMany({
            where: { id: { in: stores.map((s) => s.id) } },
        }) : [];
        const pById = new Map(profiles.map((p) => [p.id, p]));
        res.json({
            data: stores.map((s) => {
                const p = pById.get(s.id);
                return {
                    merchantId: s.id,
                    merchantName: s.name,
                    commissionCategory: p?.commissionCategory ?? null,
                    turnoverTier: p?.turnoverTier ?? null,
                    settlementHold: p?.settlementHold ?? false,
                    notes: p?.notes ?? null,
                    configured: !!p?.commissionCategory,
                };
            }),
        });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlementProfiles.list', userMessage: 'Failed to load profiles' });
    }
});

// 7G — manual payment-verification override (audit release valve): a paid
// order stuck unverified (Razorpay outage at create time + outside the cron's
// reach, or a false-positive amount-overrun hold) can be resolved by an admin
// after manual reconciliation against the Razorpay dashboard. Audit-logged.
app.post('/admin/orders/:id/payment-verification', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const verified = req.body?.verified;
        const note = String(req.body?.note || '').trim();
        if (typeof verified !== 'boolean') {
            return res.status(400).json({ error: 'verified must be true or false' });
        }
        if (!note) {
            return res.status(400).json({ error: 'note is required (what was reconciled and where)' });
        }
        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            select: { id: true, paymentVerified: true, paymentVerificationNote: true },
        });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        const updated = await prisma.order.update({
            where: { id: order.id },
            data: { paymentVerified: verified, paymentVerificationNote: `ADMIN OVERRIDE: ${note}`.slice(0, 500) },
            select: { id: true, paymentVerified: true, paymentVerificationNote: true },
        });
        await writeAuditLog(admin.id, 'settlement.payment_verification_override', 'order', order.id,
            { paymentVerified: order.paymentVerified, note: order.paymentVerificationNote } as any,
            { paymentVerified: updated.paymentVerified, note: updated.paymentVerificationNote } as any);
        res.json(updated);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlements.paymentOverride', userMessage: 'Failed to override payment verification' });
    }
});

// Merchant settlement profile — read/update (admin assigns category + tier).
app.get('/admin/settlement-profiles/:merchantId', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const profile = await prisma.merchantSettlementProfile.findUnique({ where: { id: req.params.merchantId } });
        res.json(profile ?? { id: req.params.merchantId, commissionCategory: null, turnoverTier: null, settlementHold: false, notes: null });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlementProfiles.get', userMessage: 'Failed to load profile' });
    }
});

app.put('/admin/settlement-profiles/:merchantId', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const { commissionCategory, turnoverTier, settlementHold, notes } = req.body || {};
        if (turnoverTier != null && (!Number.isInteger(turnoverTier) || turnoverTier < 1 || turnoverTier > 5)) {
            return res.status(400).json({ error: 'turnoverTier must be an integer 1-5 (or null)' });
        }
        const profile = await prisma.merchantSettlementProfile.upsert({
            where: { id: req.params.merchantId },
            create: {
                id: req.params.merchantId,
                commissionCategory: commissionCategory ?? null,
                turnoverTier: turnoverTier ?? null,
                settlementHold: !!settlementHold,
                notes: notes ?? null,
            },
            update: {
                ...(commissionCategory !== undefined ? { commissionCategory } : {}),
                ...(turnoverTier !== undefined ? { turnoverTier } : {}),
                ...(settlementHold !== undefined ? { settlementHold: !!settlementHold } : {}),
                ...(notes !== undefined ? { notes } : {}),
            },
        });
        await writeAuditLog(admin.id, 'settlement.profile_updated', 'merchant_settlement_profile', profile.id, null, profile as any);
        res.json(profile);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlementProfiles.update', userMessage: 'Failed to update profile' });
    }
});

// 7F backend — merchant's own settlement history (CLOSED + PAID only; OPEN
// cycles are internal). Auth: any user who can manage the store's orders.
app.get('/merchant/settlements', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const merchantId = String(req.query.merchantId || '');
        if (!merchantId) return res.status(400).json({ error: 'merchantId is required' });
        const canManage = await userCanManageOrderStore(user.id, merchantId);
        if (!canManage) return res.status(403).json({ error: 'Not authorized for this store' });
        const cycles = await prisma.settlementCycle.findMany({
            where: { merchantId, status: { in: ['CLOSED', 'PAID'] } },
            orderBy: { periodStart: 'desc' },
            take: 26, // ~6 months of weekly history
            select: {
                id: true, periodStart: true, periodEnd: true, status: true,
                grossSales: true, commissionAmount: true, couponReimbursement: true,
                couponAbsorbed: true, clawbackAmount: true, netPayout: true, paidAt: true,
            },
        });
        res.json({ data: cycles });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'settlements.merchant', userMessage: 'Failed to load settlements' });
    }
});


// ════════════════════════════════════════════════════════════════════════════
// Phase 8 (2026-06-11) — Merchant branch CRUD via the API.
// Replaces the merchant app's direct supabase-js writes to merchant_branches,
// which relied on over-permissive qual=true RLS (any authenticated user could
// modify/delete ANY branch). All three writes are gated by the branch/merchant
// authority helpers. Once the merchant OTA carrying these calls has propagated,
// a follow-up migration revokes anon/authenticated WRITE grants on
// merchant_branches (SELECT stays open — discovery + storefront need it, and
// branch data is semi-public). Body is camelCase (API convention); the app
// builds a camelCase payload.
// ════════════════════════════════════════════════════════════════════════════

// Create a branch under a merchant (auth: can-manage the parent merchant).
app.post('/merchant/branches', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const b = req.body || {};
        const merchantId = String(b.merchantId || '').trim();
        const branchName = String(b.branchName || '').trim();
        if (!merchantId) return res.status(400).json({ error: 'merchantId is required' });
        if (!branchName) return res.status(400).json({ error: 'branchName is required' });
        const canManage = (await userCanManageMerchant(user.id, merchantId)) || (await isPlatformAdmin(user.id));
        if (!canManage) return res.status(403).json({ error: 'Not authorized to add branches for this merchant' });

        const created = await prisma.merchantBranch.create({
            data: {
                ...(b.id ? { id: String(b.id) } : {}),
                merchantId,
                // Phase 2 FINAL — F1 (2026-06-16): merchantId is the parent Store id
                // (userCanManageMerchant verifies it against Store). Set store_id so
                // the new branch is reachable to its Store; FK rejects a wrong value.
                storeId: merchantId,
                branchName,
                address:     b.address ?? null,
                city:        b.city ?? null,
                latitude:    b.latitude ?? null,
                longitude:   b.longitude ?? null,
                managerName: b.managerName ?? null,
                phone:       b.phone ?? null,
                isActive:    b.isActive ?? true,
                ...(Array.isArray(b.cuisines)     ? { cuisines: b.cuisines } : {}),
                ...(typeof b.isVeg === 'boolean'  ? { isVeg: b.isVeg } : {}),
                ...(b.restaurantType !== undefined ? { restaurantType: b.restaurantType } : {}),
                ...(Array.isArray(b.branchPhotos) ? { branchPhotos: b.branchPhotos } : {}),
            },
        });
        // Return the snake_case DB row (matches supabase-js select('*'), which
        // the merchant app's Branch shape + optimistic list update expect).
        res.json(await branchRow(created.id));
    } catch (error: any) {
        if (error?.code === 'P2002') return res.status(409).json({ error: 'A branch with this name already exists for this merchant' });
        return handleApiError(res, error, { area: 'merchant.branches.create', userMessage: 'Failed to create branch' });
    }
});

// Update a branch (auth: can-manage the branch or its parent merchant).
// Never lets the client re-point a branch to a different merchant.
app.put('/merchant/branches/:id', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const id = req.params.id;
        const canManage = (await userCanManageBranchFull(user.id, id)) || (await isPlatformAdmin(user.id));
        if (!canManage) return res.status(403).json({ error: 'Not authorized to edit this branch' });
        const b = req.body || {};
        const data: any = {};
        if (b.branchName !== undefined)     data.branchName = String(b.branchName).trim();
        if (b.address !== undefined)        data.address = b.address;
        if (b.city !== undefined)           data.city = b.city;
        if (b.latitude !== undefined)       data.latitude = b.latitude;
        if (b.longitude !== undefined)      data.longitude = b.longitude;
        if (b.managerName !== undefined)    data.managerName = b.managerName;
        if (b.phone !== undefined)          data.phone = b.phone;
        if (b.isActive !== undefined)       data.isActive = b.isActive;
        if (Array.isArray(b.cuisines))      data.cuisines = b.cuisines;
        if (typeof b.isVeg === 'boolean')   data.isVeg = b.isVeg;
        if (b.restaurantType !== undefined) data.restaurantType = b.restaurantType;
        if (Array.isArray(b.branchPhotos))  data.branchPhotos = b.branchPhotos;
        // Operational fields (online/offline toggle, store timings, service
        // modes, slot config). Prisma field names are mixed snake/camel per the
        // schema — operating_hours/prep_time_minutes are snake, the rest camel.
        if (b.operatingHours !== undefined)      data.operating_hours = b.operatingHours;
        if (b.prepTimeMinutes !== undefined)     data.prep_time_minutes = b.prepTimeMinutes;
        if (typeof b.servicePickup === 'boolean')       data.servicePickup = b.servicePickup;
        if (typeof b.serviceDinein === 'boolean')       data.serviceDinein = b.serviceDinein;
        if (typeof b.serviceTableBooking === 'boolean') data.serviceTableBooking = b.serviceTableBooking;
        if (b.slotConfig !== undefined)          data.slotConfig = b.slotConfig;
        if (b.email !== undefined)               data.email = b.email;
        await prisma.merchantBranch.update({ where: { id }, data });
        res.json(await branchRow(id));
    } catch (error: any) {
        if (error?.code === 'P2025') return res.status(404).json({ error: 'Branch not found' });
        if (error?.code === 'P2002') return res.status(409).json({ error: 'A branch with this name already exists for this merchant' });
        return handleApiError(res, error, { area: 'merchant.branches.update', userMessage: 'Failed to update branch' });
    }
});

// Delete a branch + its store_staff rows (auth: can-manage the branch/merchant).
// store_staff deleted FIRST (FK-safe). FK violations from orders/products are
// surfaced as a clean "deactivate instead" message rather than a raw error.
app.delete('/merchant/branches/:id', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const id = req.params.id;
        const canManage = (await userCanManageBranchFull(user.id, id)) || (await isPlatformAdmin(user.id));
        if (!canManage) return res.status(403).json({ error: 'Not authorized to delete this branch' });
        await prisma.$transaction([
            prisma.storeStaff.deleteMany({ where: { storeId: id } }),
            prisma.merchantBranch.delete({ where: { id } }),
        ]);
        res.json({ ok: true });
    } catch (error: any) {
        if (error?.code === 'P2025') return res.status(404).json({ error: 'Branch not found' });
        if (error?.code === 'P2003') return res.status(409).json({ error: 'This branch has orders or products and cannot be deleted. Deactivate it instead.' });
        return handleApiError(res, error, { area: 'merchant.branches.delete', userMessage: 'Failed to delete branch' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// Phase 9a (2026-06-13) — merchants + Store writes via the API.
// Replaces direct supabase-js writes that relied on the over-permissive RLS on
// `merchants` ("Enable all operations for anon"!) and `Store` ("all access for
// all users"). Writes use supabaseAdmin (service_role) so they survive the
// follow-up write-lockdown; auth is enforced here in Express. Additive — the
// apps keep using their direct writes until refactored; only then does the
// lockdown migration land (gated on the merchant OTA). Bodies are snake_case
// (these tables have many snake_case columns; passthrough minimises app churn),
// but every field is WHITELISTED — clients cannot set status/commission/kyc via
// the merchant-facing endpoints.
// ════════════════════════════════════════════════════════════════════════════

const pick = (body: any, cols: string[]): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const c of cols) if (body && body[c] !== undefined) out[c] = body[c];
    return out;
};

// Merchant edits their own store profile (Settings → Store Details).
// Store {name,address}; dining-only merchants {cuisines,is_veg,restaurant_type}.
app.patch('/merchant/profile/:merchantId', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const merchantId = req.params.merchantId;
        const can = (await userCanManageMerchant(user.id, merchantId)) || (await isPlatformAdmin(user.id));
        if (!can) return res.status(403).json({ error: 'Not authorized to edit this store' });
        const b = req.body || {};
        const storeData: any = {};
        if (b.name !== undefined) storeData.name = String(b.name).trim();
        if (b.address !== undefined) storeData.address = b.address;
        if (Object.keys(storeData).length > 0) {
            await prisma.store.update({ where: { id: merchantId }, data: storeData });
        }
        const mData = pick(b, ['cuisines', 'is_veg', 'restaurant_type']);
        if (Object.keys(mData).length > 0) {
            const { error } = await supabaseAdmin.from('merchants').update(mData).eq('id', merchantId);
            if (error) throw new Error(error.message);
        }
        res.json({ ok: true });
    } catch (error: any) {
        if (error?.code === 'P2025') return res.status(404).json({ error: 'Store not found' });
        return handleApiError(res, error, { area: 'merchant.profile.update', userMessage: 'Failed to update store details' });
    }
});

// Merchant updates payout/bank details (Settings → Payouts). OWNER-ONLY —
// bank details are sensitive, so staff are excluded (unlike profile). Returns
// the updated row (the app reflects it immediately).
app.put('/merchant/payout/:merchantId', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const merchantId = req.params.merchantId;
        const store = await prisma.store.findUnique({ where: { id: merchantId }, select: { managerId: true } });
        let owner = !!store && store.managerId === user.id;
        if (!owner) {
            const [m, u] = await Promise.all([
                prisma.merchant.findUnique({ where: { id: merchantId }, select: { phone: true } }),
                prisma.user.findUnique({ where: { id: user.id }, select: { phone: true } }),
            ]);
            const a = u?.phone?.replace(/\D/g, '').slice(-10);
            const bn = m?.phone?.replace(/\D/g, '').slice(-10);
            if (a && a.length === 10 && a === bn) owner = true;
        }
        if (!owner && !(await isPlatformAdmin(user.id))) {
            return res.status(403).json({ error: 'Only the store owner can update payout details' });
        }
        const mData = pick(req.body, ['bank_account_number', 'ifsc_code', 'bank_name', 'bank_beneficiary_name', 'bank_accounts']);
        if (Object.keys(mData).length === 0) return res.status(400).json({ error: 'No payout fields provided' });
        const { data, error } = await supabaseAdmin.from('merchants').update(mData).eq('id', merchantId).select().single();
        if (error) throw new Error(error.message);
        res.json(data);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'merchant.payout.update', userMessage: 'Failed to update payout details' });
    }
});

// Admin-facing columns of the merchants table (trusted SUPER_ADMIN). Excludes
// id; everything else an admin legitimately sets when creating/editing a
// merchant from the dashboard.
const ADMIN_MERCHANT_COLS = [
    'store_name', 'branch_name', 'owner_name', 'designation', 'email', 'phone', 'city', 'address',
    'latitude', 'longitude', 'has_branches', 'kyc_status', 'status', 'rating', 'commission_rate',
    'operating_hours', 'operating_days', 'vertical', 'vertical_id', 'category', 'cuisines', 'is_veg',
    'restaurant_type', 'pan_number', 'aadhar_number', 'gst_number', 'msme_number', 'fssai_number',
    'turnover_range', 'bank_account_number', 'ifsc_code', 'bank_name', 'bank_beneficiary_name',
    'bank_accounts', 'pan_document_url', 'aadhar_front_url', 'aadhar_back_url', 'gst_certificate_url',
    'store_photos',
];

// 2026-06-14: refund/dispute resolution queue — surfaces stranded (charged but
// coherence-failed) payments + pending refunds for the admin Refunds & Disputes
// screen. requireAdmin.
app.get('/admin/disputes', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const shape = (o: any) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            totalAmount: o.totalAmount,
            status: o.status,
            isPaid: o.isPaid,
            storeName: o.store_name,
            createdAt: o.createdAt,
            paymentVerified: o.paymentVerified,
            hasPaymentId: !!((o.metadata as any)?.razorpayPaymentId),
            customer: o.user ? { name: o.user.name ?? null } : null,
        });
        const [stranded, pendingRefunds] = await Promise.all([
            prisma.order.findMany({
                where: { paymentVerified: false },
                orderBy: { createdAt: 'desc' }, take: 100,
                include: { user: { select: { name: true } } },
            }),
            prisma.order.findMany({
                where: { status: 'CANCELLED', isPaid: true },
                orderBy: { createdAt: 'desc' }, take: 100,
                include: { user: { select: { name: true } } },
            }),
        ]);
        // Exclude orders already refunded (refund id recorded in metadata).
        const notYetRefunded = pendingRefunds.filter((o: any) => !((o.metadata as any)?.razorpayRefundId));
        return res.json({ strandedPayments: stranded.map(shape), pendingRefunds: notYetRefunded.map(shape) });
    } catch (err: any) {
        console.error('[admin/disputes] error:', err?.message || err);
        return res.status(500).json({ error: 'Failed to load disputes' });
    }
});

// 2026-06-14: admin-issued refund (Refunds & Disputes queue). Issues a REAL
// Razorpay refund and only marks the order REFUNDED when Razorpay confirms.
// Idempotent (refuses already-refunded) + audited.
app.post('/admin/orders/:id/refund', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const { id } = req.params;
        const reason = req.body?.reason ? String(req.body.reason) : 'Admin refund (Refunds & Disputes)';
        const order = await prisma.order.findUnique({ where: { id } });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        if (!order.isPaid) return res.status(400).json({ error: 'Order is not paid — nothing to refund' });
        if (order.status === 'REFUNDED' || (order.metadata as any)?.razorpayRefundId) {
            return res.status(409).json({ error: 'Order has already been refunded' });
        }
        const amountInr = Math.round(order.totalAmount || 0);
        if (amountInr <= 0) return res.status(400).json({ error: 'Order amount is zero' });
        const paymentId = (order.metadata as any)?.razorpayPaymentId;
        if (!paymentId) {
            return res.status(400).json({ error: 'No Razorpay payment id on this order — it must be refunded manually.' });
        }

        let razorpayInstance: any = null;
        try {
            const Razorpay = require('razorpay');
            if (process.env.RAZORPAY_KEY_ID) {
                razorpayInstance = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
            }
        } catch { /* ignore */ }
        if (!razorpayInstance) {
            return res.status(503).json({ error: 'Refunds unavailable — Razorpay is not configured on the server.' });
        }

        let refund: any;
        try {
            refund = await razorpayInstance.payments.refund(paymentId, { amount: amountInr * 100 });
        } catch (rpErr: any) {
            console.error('[admin refund] Razorpay error:', rpErr?.message || rpErr);
            return res.status(502).json({ error: `Razorpay refund failed: ${rpErr?.error?.description || rpErr?.message || 'unknown error'}` });
        }

        const updated = await prisma.order.update({
            where: { id },
            data: {
                status: 'REFUNDED', isPaid: false,
                returnReason: reason,
                metadata: {
                    ...(typeof order.metadata === 'object' && order.metadata !== null ? (order.metadata as any) : {}),
                    razorpayRefundId: refund.id,
                    adminRefundAt: new Date().toISOString(),
                    adminRefundAmountInr: amountInr,
                    adminRefundBy: admin.id,
                } as any,
            },
        });
        await recordAdminAudit(req, {
            actorId: admin.id,
            action: 'order.refund',
            targetTable: 'orders',
            targetId: id,
            before: { status: order.status, isPaid: order.isPaid },
            after: { status: 'REFUNDED', refundRazorpayId: refund.id, refundAmountInr: amountInr },
            reason,
        });

        // REFUND_INITIATED → tell the consumer their money is on the way. This admin
        // path issues a REAL Razorpay refund and (unlike the cancel / return / SLA
        // refund paths, which already notify via their decision messages) had no
        // consumer notification. Fail-soft: a notify failure never fails the refund.
        // recipient_role='consumer' is set by the service → shows in the consumer inbox.
        notificationService.sendConsumerNotification({
            userId: order.userId,
            title: 'Refund on the way',
            body: `We've started a refund of ₹${amountInr} for order #${order.orderNumber}. It'll reach your account in 5–7 business days.`,
            type: 'REFUND_INITIATED',
            referenceId: id,
            link: '/(main)/orders',
            storeId: order.storeId,
            metadata: { orderNumber: order.orderNumber, refundInr: amountInr, razorpayRefundId: refund.id, source: 'admin' },
        }).catch((e: any) => console.error('[admin refund] REFUND_INITIATED notif failed:', e));

        return res.json({ ok: true, refundId: refund.id, amountInr, order: { id: updated.id, status: updated.status } });
    } catch (err: any) {
        console.error('[admin/orders/:id/refund] error:', err?.message || err);
        return res.status(500).json({ error: 'Refund failed' });
    }
});

// 2026-06-14: analytics depth — top products + GMV by category + by city for the
// Reports dashboard. GET /admin/analytics/breakdowns?from&to (ISO). requireAdmin.
app.get('/admin/analytics/breakdowns', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const from = new Date(String(req.query.from || ''));
        const to = new Date(String(req.query.to || ''));
        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return res.status(400).json({ error: 'from and to (ISO dates) are required' });
        }
        const [topProducts, byCategory, byCity] = await Promise.all([
            prisma.$queryRaw`
                SELECT oi.product_name AS name, SUM(oi.quantity)::int AS qty, SUM(oi.price * oi.quantity)::float AS revenue
                FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE o.created_at >= ${from} AND o.created_at < ${to}
                  AND o.status NOT IN ('CANCELLED','REFUNDED') AND oi.product_name IS NOT NULL
                GROUP BY oi.product_name ORDER BY revenue DESC LIMIT 10`,
            prisma.$queryRaw`
                SELECT COALESCE(v.name, 'Uncategorized') AS category, SUM(o.total_amount)::float AS gmv, COUNT(*)::int AS orders
                FROM orders o
                LEFT JOIN merchant_branches b ON b.id = o.branch_id
                LEFT JOIN merchants m ON m.id = b.merchant_id
                LEFT JOIN "Vertical" v ON v.id = m.vertical_id
                WHERE o.created_at >= ${from} AND o.created_at < ${to} AND o.status NOT IN ('CANCELLED','REFUNDED')
                GROUP BY v.name ORDER BY gmv DESC`,
            prisma.$queryRaw`
                SELECT COALESCE(b.city, 'Unknown') AS city, SUM(o.total_amount)::float AS gmv, COUNT(*)::int AS orders
                FROM orders o LEFT JOIN merchant_branches b ON b.id = o.branch_id
                WHERE o.created_at >= ${from} AND o.created_at < ${to} AND o.status NOT IN ('CANCELLED','REFUNDED')
                GROUP BY b.city ORDER BY gmv DESC LIMIT 15`,
        ]);
        return res.json({ topProducts, byCategory, byCity });
    } catch (err: any) {
        console.error('[admin/analytics/breakdowns] error:', err?.message || err);
        return res.status(500).json({ error: 'Failed to load analytics breakdowns' });
    }
});

// 2026-06-14: full merchant detail for the admin KYC review — resolves the
// vertical NAME (the list RPC exposes no vertical_id, so the screen's `category`
// was always blank) and surfaces signup fields the list omits (designation,
// multi-account bank, additional branches, store hours).
app.get('/admin/merchants/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const m = await prisma.merchant.findUnique({
            where: { id: req.params.id },
            include: { Vertical: { select: { name: true } }, branches: true },
        });
        if (!m) return res.status(404).json({ error: 'Merchant not found' });
        return res.json({
            verticalName: m.Vertical?.name ?? null,
            designation: m.designation ?? null,
            bankName: m.bankName ?? null,
            bankAccounts: m.bankAccounts ?? null,
            hasBranches: m.hasBranches ?? null,
            operatingHours: m.operatingHours ?? null,
            operatingDays: m.operatingDays ?? [],
            branches: m.branches.map((b) => ({
                id: b.id,
                branchName: b.branchName,
                managerName: b.managerName ?? null,
                address: b.address ?? null,
                city: b.city ?? null,
                latitude: b.latitude ?? null,
                longitude: b.longitude ?? null,
                isActive: b.isActive ?? null,
            })),
        });
    } catch (err: any) {
        console.error('[admin/merchants/:id detail] error:', err?.message || err);
        return res.status(500).json({ error: 'Failed to load merchant detail' });
    }
});

// 2026-06-14 (e-Sign V1): latest signed-agreement consent record for a merchant,
// for the admin KYC review screen. Returns { consent: null } when none exists.
app.get('/admin/merchants/:id/consent', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const consent = await prisma.merchantConsent.findFirst({
            where: { merchantId: req.params.id },
            orderBy: { createdAt: 'desc' },
        });
        if (!consent) return res.json({ consent: null });
        return res.json({
            consent: {
                id: consent.id,
                agreementType: consent.agreementType,
                agreementVersion: consent.agreementVersion,
                acceptedPrivacy: consent.acceptedPrivacy,
                acceptedTerms: consent.acceptedTerms,
                acceptedPartner: consent.acceptedPartner,
                signatoryName: consent.signatoryName,
                designation: consent.designation,
                signedPdfPath: consent.signedPdfPath,
                signedAt: consent.signedAt,
                ip: consent.ip,
                device: consent.device,
                docHash: consent.docHash,
                createdAt: consent.createdAt,
            },
        });
    } catch (err: any) {
        console.error('[admin/merchants/:id/consent] error:', err?.message || err);
        return res.status(500).json({ error: 'Failed to load consent' });
    }
});

// Admin creates a merchant (admin-web merchant directory). requireAdmin.
app.post('/admin/merchants', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const payload = pick(req.body, ADMIN_MERCHANT_COLS);
        if (!payload.store_name) return res.status(400).json({ error: 'store_name is required' });
        payload.kyc_status = payload.kyc_status ?? 'pending';
        payload.status = payload.status ?? 'active';
        const { data, error } = await supabaseAdmin.from('merchants').insert([payload]).select().single();
        if (error) throw new Error(error.message);
        await writeAuditLog(admin.id, 'merchant.created', 'merchant', data?.id ?? null, null, payload as any);
        res.json(data);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'admin.merchants.create', userMessage: 'Failed to create merchant' });
    }
});

// Admin updates a merchant (generic edit + KYC/status changes). requireAdmin.
app.patch('/admin/merchants/:id', async (req, res) => {
    try {
        const admin = await requireAdmin(req, res); if (!admin) return;
        const id = req.params.id;
        const updates = pick(req.body, ADMIN_MERCHANT_COLS);
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });
        updates.updated_at = new Date().toISOString();
        const { data, error } = await supabaseAdmin.from('merchants').update(updates).eq('id', id).select().single();
        if (error) throw new Error(error.message);
        await writeAuditLog(admin.id, 'merchant.updated', 'merchant', id, null, updates as any);
        res.json(data);
    } catch (error: any) {
        return handleApiError(res, error, { area: 'admin.merchants.update', userMessage: 'Failed to update merchant' });
    }
});

// ════════════════════════════════════════════════════════════════════════════
// Phase 9b (2026-06-13) — catalog/inventory writes via the API
// (StoreProduct + Product + ProductImage). Replaces direct supabase-js writes in
// the product modals (AddCustomProductModal, AddMenuProductModal,
// ConfigureProductsModal), useInventory, and admin StoreProductTable — all of
// which relied on the over-permissive qual=true RLS on these tables. Writes via
// supabaseAdmin (service_role) so they survive the lockdown; auth is the branch
// owner (userCanManageBranchFull on the StoreProduct.branch_id) or a platform
// admin. Faithful port of the existing (non-transactional, sequential) flows —
// same semantics, just authorized + lockdown-safe. Column names are the literal
// DB columns the apps already send (mixed snake/camel), whitelisted.
// ════════════════════════════════════════════════════════════════════════════

const PRODUCT_COLS = ['id', 'name', 'mrp', 'subcategory', 'brand', 'ean', 'uom', 'gstRate', 'description', 'image', 'createdByStoreId', 'extra_data', 'category', 'updatedAt'];
const STORE_PRODUCT_UPDATE_COLS = ['price', 'stock', 'active', 'variant', 'is_best_seller', 'is_deleted'];

// Look up a StoreProduct's branch, then authorize the caller against it.
async function authorizeStoreProduct(userId: string, storeProductId: string): Promise<{ ok: boolean; found: boolean }> {
    const rows = await prisma.$queryRaw<any[]>`SELECT "branch_id"::text AS branch_id FROM "public"."StoreProduct" WHERE "id" = ${storeProductId} LIMIT 1;`;
    if (rows.length === 0) return { ok: false, found: false };
    const branchId = rows[0].branch_id;
    const ok = (branchId && (await userCanManageBranchFull(userId, branchId))) || (await isPlatformAdmin(userId));
    return { ok: !!ok, found: true };
}

// Composite product save (create OR edit), for both custom + menu modals.
// body: { branchId, product{...}, images?: string[], storeProducts: [{price,stock,
//   active,variant,is_best_seller?,id?}], replaceVariants?: boolean }
app.post('/merchant/products/save', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const b = req.body || {};
        const branchId = String(b.branchId || '').trim();
        const product = b.product || {};
        const storeProducts: any[] = Array.isArray(b.storeProducts) ? b.storeProducts : [];
        if (!branchId) return res.status(400).json({ error: 'branchId is required' });
        if (!product.id) return res.status(400).json({ error: 'product.id is required' });
        if (storeProducts.length === 0) return res.status(400).json({ error: 'storeProducts is required' });
        const can = (await userCanManageBranchFull(user.id, branchId)) || (await isPlatformAdmin(user.id));
        if (!can) return res.status(403).json({ error: 'Not authorized to manage products for this branch' });

        const productId = String(product.id);

        // 1. Upsert the Product (PK = id).
        const productRow = pick(product, PRODUCT_COLS);
        productRow.id = productId;
        const { error: pErr } = await supabaseAdmin.from('Product').upsert(productRow);
        if (pErr) throw new Error(`Product: ${pErr.message}`);

        // 2. Replace images iff `images` was provided.
        if (Array.isArray(b.images)) {
            const { error: delErr } = await supabaseAdmin.from('ProductImage').delete().eq('productId', productId);
            if (delErr) throw new Error(`ProductImage delete: ${delErr.message}`);
            if (b.images.length > 0) {
                const imageData = b.images.map((url: string, idx: number) => ({
                    id: crypto.randomUUID(), productId, url, isPrimary: idx === 0, createdAt: new Date().toISOString(),
                }));
                const { error: insErr } = await supabaseAdmin.from('ProductImage').insert(imageData);
                if (insErr) throw new Error(`ProductImage insert: ${insErr.message}`);
            }
        }

        // 3. Optionally clear existing variants for this product+branch (menu edit).
        if (b.replaceVariants === true) {
            const { error: dErr } = await supabaseAdmin.from('StoreProduct').delete().eq('productId', productId).eq('branch_id', branchId);
            if (dErr) throw new Error(`StoreProduct clear: ${dErr.message}`);
        }

        // 4. Upsert StoreProduct rows. branch_id is the canonical key; the parent
        // Store is derivable via merchant_branches.store_id (Phase 2 FINAL B1-B5,
        // 2026-06-16). The vestigial StoreProduct.storeId column is dropped at B10
        // and intentionally NOT written here — new rows leave it NULL.
        const spRows = storeProducts.map((sp) => ({
            id: sp.id ? String(sp.id) : crypto.randomUUID(),
            branch_id: branchId,
            productId,
            price: Number(sp.price) || 0,
            stock: sp.stock != null ? Number(sp.stock) : 0,
            // Phase 3 Item 2 (2026-06-16): a ₹0 listing can never be live. Blinkit is
            // MRP-only so price coerces to 0; force inactive until a real price is set.
            active: (Number(sp.price) || 0) > 0 && (sp.active != null ? !!sp.active : true),
            variant: sp.variant ? String(sp.variant) : 'Standard',
            is_best_seller: !!sp.is_best_seller,
            updatedAt: new Date().toISOString(),
        }));
        const { error: spErr } = await supabaseAdmin.from('StoreProduct').upsert(spRows, { onConflict: 'branch_id,productId,variant' });
        if (spErr) throw new Error(`StoreProduct: ${spErr.message}`);

        res.json({ ok: true, productId });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'merchant.products.save', userMessage: error?.message || 'Failed to save product' });
    }
});

// Update a single StoreProduct (inventory: price/stock/active; admin table edits).
app.patch('/merchant/store-products/:id', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const id = req.params.id;
        const auth = await authorizeStoreProduct(user.id, id);
        if (!auth.found) return res.status(404).json({ error: 'Product not found' });
        if (!auth.ok) return res.status(403).json({ error: 'Not authorized to edit this product' });
        const updates = pick(req.body, STORE_PRODUCT_UPDATE_COLS);
        if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

        // Low-stock alerting (server-side). Capture the pre-edit stock so we can detect a
        // DOWNWARD threshold crossing after the write — only when this edit changes stock.
        // This replaces the merchant app's old client-side notifications insert
        // (useInventory.ts), which bypassed NotificationService → no push, no
        // recipient_role (invisible after the role cutover). Best-effort: a failure to
        // read the pre-edit row just skips the alert; it never blocks the inventory edit.
        const stockIsChanging = updates.stock != null;
        let preEdit: { stock: number; branchId: string; name: string } | null = null;
        if (stockIsChanging) {
            try {
                const spBefore = await prisma.storeProduct.findUnique({
                    where: { id },
                    select: { stock: true, branch_id: true, product: { select: { name: true } } },
                });
                if (spBefore) preEdit = { stock: Number(spBefore.stock ?? 0), branchId: spBefore.branch_id, name: spBefore.product?.name || 'Item' };
            } catch (e) {
                console.error('[PATCH /merchant/store-products] pre-edit stock fetch failed (alert skipped):', e);
            }
        }

        // Phase 3 Item 2 (2026-06-16): a ₹0 listing can never be live. If this edit
        // sets price ≤ 0, force the row inactive in the same write. (The activate-an-
        // existing-₹0-row edge case is caught by the DB CHECK backstop.)
        if (updates.price != null && (Number(updates.price) || 0) <= 0) {
            updates.active = false;
        }
        updates.updatedAt = new Date().toISOString();
        const { error } = await supabaseAdmin.from('StoreProduct').update(updates).eq('id', id);
        if (error) throw new Error(error.message);

        // Fire a low-stock / out-of-stock alert ONLY on a downward threshold crossing,
        // mirroring the order-decrement path (~index.ts:3339). Routes through
        // NotificationService → Expo push + recipient_role='merchant'. Floating + caught:
        // an alert failure must never fail the inventory edit.
        if (preEdit && stockIsChanging) {
            const newStock = Number(updates.stock);
            const oldStock = preEdit.stock;
            if (Number.isFinite(newStock) && newStock !== oldStock) {
                let alert: { title: string; body: string } | null = null;
                if (newStock === 0 && oldStock > 0) {
                    alert = { title: 'Out of Stock Alert', body: `${preEdit.name} is completely out of stock.` };
                } else if (newStock > 0 && newStock <= 5 && oldStock > 5) {
                    alert = { title: 'Low Stock Warning', body: `Action Required: Only ${newStock} left of ${preEdit.name}.` };
                }
                if (alert) {
                    notificationService.sendMerchantNotification({
                        storeId: preEdit.branchId,
                        title: alert.title,
                        body: alert.body,
                        type: 'LOW_STOCK',
                        link: '/(main)/inventory',
                        metadata: { storeProductId: id, productName: preEdit.name, stock: newStock, source: 'manual-edit' },
                    }).catch(e => console.error('[PATCH /merchant/store-products] Low stock notif failed:', e));
                }
            }
        }

        res.json({ ok: true });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'merchant.storeProducts.update', userMessage: 'Failed to update product' });
    }
});

// Soft-delete a StoreProduct (inventory delete).
app.delete('/merchant/store-products/:id', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const id = req.params.id;
        const auth = await authorizeStoreProduct(user.id, id);
        if (!auth.found) return res.status(404).json({ error: 'Product not found' });
        if (!auth.ok) return res.status(403).json({ error: 'Not authorized to delete this product' });
        const { error } = await supabaseAdmin.from('StoreProduct').update({ is_deleted: true, updatedAt: new Date().toISOString() }).eq('id', id);
        if (error) throw new Error(error.message);
        res.json({ ok: true });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'merchant.storeProducts.delete', userMessage: 'Failed to delete product' });
    }
});

// Phase 4 sub-2 (2026-06-17): paginated catalog picker. Browse the ~140k master
// catalog to list products. Keyset pagination on (createdAt,id); relation filters;
// excludes products this branch already lists; search hits the trigram GIN index.
// query: branchId (req), cursor, q, verticalId, categoryId, brand, isVeg, limit
app.get('/merchant/catalog', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const branchId = String(req.query.branchId || '').trim();
        if (!branchId) return res.status(400).json({ error: 'branchId is required' });
        const can = (await userCanManageBranchFull(user.id, branchId)) || (await isPlatformAdmin(user.id));
        if (!can) return res.status(403).json({ error: 'Not authorized for this branch' });

        const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? '30'), 10) || 30, 1), 50);
        const cursor = decodeCursor(req.query.cursor as string | undefined);
        const q = (req.query.q as string | undefined)?.trim();
        // verticalId + brand accept comma-separated lists (the FilterModal multi-selects)
        const verticalIds = String(req.query.verticalId || '').split(',').map((s) => s.trim()).filter(Boolean);
        const categoryId = (req.query.categoryId as string | undefined) || undefined;
        const brands = String(req.query.brand || '').split(',').map((s) => s.trim()).filter(Boolean);
        const isVegRaw = req.query.isVeg as string | undefined;
        const minPrice = req.query.minPrice != null && req.query.minPrice !== '' ? Number(req.query.minPrice) : undefined;
        const maxPrice = req.query.maxPrice != null && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : undefined;

        const where: any = {
            source: { in: ['blinkit', 'live_sync', 'purchased_catalog'] },
            mrp: {
                gt: 0,
                ...(minPrice != null && Number.isFinite(minPrice) ? { gte: minPrice } : {}),
                ...(maxPrice != null && Number.isFinite(maxPrice) ? { lte: maxPrice } : {}),
            },
            // exclude products this branch already lists (any non-deleted StoreProduct)
            NOT: { storeProducts: { some: { branch_id: branchId, is_deleted: false } } },
            ...(q && q.length >= 2 ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
            ...(verticalIds.length ? { vertical_id: { in: verticalIds } } : {}),
            ...(categoryId ? { category_id: categoryId } : {}),
            ...(brands.length ? { brand: { in: brands } } : {}),
            ...(isVegRaw === 'true' ? { isVeg: true } : isVegRaw === 'false' ? { isVeg: false } : {}),
        };

        const rows = await prisma.product.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: limit + 1,
            ...(cursor.id ? { cursor: { id: cursor.id }, skip: 1 } : {}),
            include: {
                Vertical: { select: { id: true, name: true, requiresFssai: true } },
                Tier2Category: { select: { id: true, name: true } },
            },
        });

        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = page[page.length - 1];
        const nextCursor = hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null;

        res.json({
            data: page.map((p: any) => ({
                id: p.id, name: p.name, brand: p.brand, mrp: p.mrp, image: p.image, uom: p.uom, isVeg: p.isVeg,
                vertical: p.Vertical ? { id: p.Vertical.id, name: p.Vertical.name, requiresFssai: p.Vertical.requiresFssai } : null,
                category: p.Tier2Category ? { id: p.Tier2Category.id, name: p.Tier2Category.name } : null,
            })),
            nextCursor,
            hasMore,
        });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'merchant.catalog', userMessage: 'Failed to load catalog' });
    }
});

// ─── Category-visibility feature · Task 5: admin enable/disable endpoints ───
// GET is open to all catalog-admin roles (read-only); the toggles are restricted to
// CATEGORY_TOGGLE_ROLES (ops-level) because disabling is platform-wide + high impact.
// Reads/writes go through prisma (service_role) → unaffected by the RESTRICTIVE RLS,
// so admin always sees + manages every category, including disabled ones.
app.get('/admin/categories', async (req, res) => {
    const caller = await requireRole(req, res, CATALOG_ADMIN_ROLES); if (!caller) return;
    try {
        const verticals = await prisma.vertical.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true, name: true, is_active: true, requiresFssai: true,
                _count: { select: { Product: true } },
                tier2Categories: {
                    orderBy: { name: 'asc' },
                    select: { id: true, name: true, active: true, _count: { select: { Product: true } } },
                },
            },
        });
        const categories = verticals.map((v: any) => ({
            id: v.id,
            name: v.name,
            isActive: v.is_active,
            requiresFssai: v.requiresFssai,
            productCount: v._count.Product,
            subcategories: v.tier2Categories.map((t: any) => ({
                id: t.id, name: t.name, active: t.active, productCount: t._count.Product,
            })),
        }));
        res.json({ categories });
    } catch (e: any) {
        Sentry.captureException(e);
        res.status(500).json({ error: e?.message || 'Failed to load categories' });
    }
});

app.patch('/admin/categories/vertical/:id', async (req, res) => {
    const caller = await requireRole(req, res, CATEGORY_TOGGLE_ROLES); if (!caller) return;
    try {
        const id = String(req.params.id);
        if (typeof req.body?.isActive !== 'boolean') return res.status(400).json({ error: 'isActive (boolean) is required' });
        const isActive: boolean = req.body.isActive;
        const before = await prisma.vertical.findUnique({ where: { id }, select: { id: true, name: true, is_active: true } });
        if (!before) return res.status(404).json({ error: 'Category not found' });
        const updated = await prisma.vertical.update({
            where: { id }, data: { is_active: isActive },
            select: { id: true, name: true, is_active: true },
        });
        await writeAuditLog(caller.id, isActive ? 'CATEGORY_ENABLE' : 'CATEGORY_DISABLE', 'Vertical', id,
            { is_active: before.is_active }, { is_active: updated.is_active });
        res.json({ id: updated.id, name: updated.name, isActive: updated.is_active });
    } catch (e: any) {
        Sentry.captureException(e);
        res.status(500).json({ error: e?.message || 'Failed to update category' });
    }
});

app.patch('/admin/categories/subcategory/:id', async (req, res) => {
    const caller = await requireRole(req, res, CATEGORY_TOGGLE_ROLES); if (!caller) return;
    try {
        const id = String(req.params.id);
        if (typeof req.body?.active !== 'boolean') return res.status(400).json({ error: 'active (boolean) is required' });
        const active: boolean = req.body.active;
        const before = await prisma.tier2Category.findUnique({ where: { id }, select: { id: true, name: true, active: true } });
        if (!before) return res.status(404).json({ error: 'Subcategory not found' });
        const updated = await prisma.tier2Category.update({
            where: { id }, data: { active },
            select: { id: true, name: true, active: true },
        });
        await writeAuditLog(caller.id, active ? 'SUBCATEGORY_ENABLE' : 'SUBCATEGORY_DISABLE', 'Tier2Category', id,
            { active: before.active }, { active: updated.active });
        res.json({ id: updated.id, name: updated.name, active: updated.active });
    } catch (e: any) {
        Sentry.captureException(e);
        res.status(500).json({ error: e?.message || 'Failed to update subcategory' });
    }
});

// Bulk-configure existing catalog products for a branch (ConfigureProductsModal).
// body: { branchId, items: [{ productId, variant, price, stock, active? }] }
app.post('/merchant/store-products/configure', async (req, res) => {
    try {
        const user = await requireUser(req, res); if (!user) return;
        const b = req.body || {};
        const branchId = String(b.branchId || '').trim();
        const items: any[] = Array.isArray(b.items) ? b.items : [];
        if (!branchId) return res.status(400).json({ error: 'branchId is required' });
        if (items.length === 0) return res.status(400).json({ error: 'items is required' });
        const can = (await userCanManageBranchFull(user.id, branchId)) || (await isPlatformAdmin(user.id));
        if (!can) return res.status(403).json({ error: 'Not authorized to configure products for this branch' });

        // Phase 4 sub-2 (2026-06-17): MRP-ceiling + FSSAI listing guards (spec §7).
        // The DB trigger backstops MRP; this returns a clean 400/403 with offenders.
        const itemList = items.map((it) => ({ productId: String(it.productId), price: Number(it.price) || 0, stock: Number(it.stock) || 0 }));
        const guardProducts = await prisma.product.findMany({
            where: { id: { in: itemList.map((i) => i.productId) } },
            select: {
                id: true, mrp: true, vertical_id: true, category_id: true,
                Vertical: { select: { requiresFssai: true, is_active: true } },
                Tier2Category: { select: { active: true } },
            },
        });
        const pmap = new Map(guardProducts.map((p: any) => [p.id, {
            mrp: p.mrp,
            requiresFssai: !!p.Vertical?.requiresFssai,
            // Category-visibility Task 5: null vertical/subcategory = not gated = enabled
            // (matches the RESTRICTIVE RLS + get_nearby_stores gate exactly).
            verticalEnabled: p.vertical_id == null || !!p.Vertical?.is_active,
            subcategoryEnabled: p.category_id == null || !!p.Tier2Category?.active,
        }]));
        const mrpCheck = validateMrpCeiling(itemList, pmap);
        if (!mrpCheck.ok) return res.status(400).json({ error: (mrpCheck as any).code, offenders: (mrpCheck as any).offenders });
        const guardBranch = await prisma.merchantBranch.findUnique({ where: { id: branchId }, select: { merchantId: true } });
        const guardMerchant = guardBranch?.merchantId
            ? await prisma.merchant.findUnique({ where: { id: guardBranch.merchantId }, select: { fssaiNumber: true } })
            : null;
        const fssaiCheck = validateFssaiGate(itemList, pmap, { fssaiNumber: guardMerchant?.fssaiNumber ?? null });
        if (!fssaiCheck.ok) return res.status(403).json({ error: (fssaiCheck as any).code, offenders: (fssaiCheck as any).offenders });
        // Category-visibility Task 5 (spec D6): reject NEW listings in a disabled category.
        // Existing parked stock is untouched; this only blocks fresh configure writes.
        const catCheck = validateCategoriesEnabled(itemList, pmap);
        if (!catCheck.ok) return res.status(403).json({ error: (catCheck as any).code, offenders: (catCheck as any).offenders });

        const now = new Date().toISOString();
        // branch_id is the canonical key; parent Store derives via
        // merchant_branches.store_id (Phase 2 FINAL B1-B5, 2026-06-16). storeId
        // (dropped at B10) intentionally NOT written — new rows leave it NULL.
        const rows = items.map((it) => ({
            id: it.id ? String(it.id) : crypto.randomUUID(),
            branch_id: branchId,
            productId: String(it.productId),
            variant: it.variant ? String(it.variant) : 'Standard',
            price: Number(it.price) || 0,
            stock: it.stock != null ? Number(it.stock) : 0,
            // Phase 3 Item 2 (2026-06-16): a ₹0 listing can never be live.
            active: (Number(it.price) || 0) > 0 && (it.active != null ? !!it.active : true),
            createdAt: now,
            updatedAt: now,
        }));
        const { error } = await supabaseAdmin.from('StoreProduct').upsert(rows, { onConflict: 'branch_id,productId,variant' });
        if (error) throw new Error(error.message);

        // Lazy image re-host (spec §8, D3): copy grofers.com images into our own bucket
        // on first listing. Failure-tolerant + bounded to 5s so a storage blip never
        // blocks the listing; the next listing of the same product retries.
        const rehoster = makeRehoster({
            findProduct: (id) => prisma.product.findUnique({ where: { id }, select: { image: true } }),
            download: async (url) => {
                const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
                if (!r.ok) throw new Error(`download ${r.status}`);
                return { data: Buffer.from(await r.arrayBuffer()), contentType: r.headers.get('content-type') || 'image/jpeg' };
            },
            upload: async (path, body, contentType) => {
                const up = await supabaseAdmin.storage.from('products').upload(path, body, { contentType, upsert: true });
                if (up.error) throw up.error;
                const { data } = supabaseAdmin.storage.from('products').getPublicUrl(path);
                return { publicUrl: data.publicUrl };
            },
            updateImage: async (productId, url) => { await prisma.product.update({ where: { id: productId }, data: { image: url } }); },
            captureException: (e, ctx) => Sentry.captureException(e, { extra: ctx }),
        });
        const rehostIds = itemList.map((i) => i.productId);
        const rehostTally = await Promise.race([
            rehoster.rehostMany(rehostIds),
            new Promise<{ ok: number; skipped: number; failed: number }>((resolve) =>
                setTimeout(() => resolve({ ok: 0, skipped: 0, failed: 0 }), 5_000)),
        ]);

        res.json({ ok: true, count: rows.length, rehosted: rehostTally.ok, rehostFailed: rehostTally.failed });
    } catch (error: any) {
        return handleApiError(res, error, { area: 'merchant.storeProducts.configure', userMessage: 'Failed to configure products' });
    }
});

// --- 404 Handler ---
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

// --- Sentry Express error handler ---
// Per Sentry's Express SDK guidance, this MUST be registered after all
// controllers + the 404 handler, and BEFORE any other error-handling middleware.
// It does NOT swallow the error — control flows on to the global error handler
// below, which still returns the JSON response to the client.
Sentry.setupExpressErrorHandler(app);

// --- Global Error Handler ---
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('[Global Error Handler]', err);
    if (res.headersSent) {
        return next(err);
    }
    // Force JSON response
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred',
        // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined 
    });
});

// --- Socket.io Setup ---
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PATCH"]
    }
});

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('join_store', (storeId) => {
        socket.join(`store_${storeId}`);
    });
});

/**
 * GET /auth/merchant/profile
 * Securely fetches the complete merchant profile with signed URLs for private documents.
 * Header: Authorization: Bearer <token>
 */
app.get('/auth/merchant/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid token' });
        }
        const token = authHeader.split(' ')[1];

        // 1. Authenticate user from Supabase token (Zero-Trust)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const userId = user.id;

        // 2. Fetch comprehensive merchant data via Prisma
        const merchantData = await prisma.merchant.findUnique({
            where: { id: userId },
            include: {
                branches: true,
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        if (!merchantData) {
            return res.status(404).json({ error: 'Merchant profile not found' });
        }

        // Fetch associated store (aligned with signup ID mapping)
        const storeData = await prisma.store.findUnique({
            where: { id: userId },
            include: {
                city: true
            }
        });

        // 3. Generate Signed URLs for private document storage (1-hour expiry)
        const signUrl = async (path: string | null) => {
            if (!path) return null;
            // Use supabaseAdmin to bypass public access requirements
            const { data, error } = await supabaseAdmin.storage
                .from('merchant-docs')
                .createSignedUrl(path, 3600);
            return error ? null : data?.signedUrl;
        };

        const [
            panUrl, 
            aadharFrontUrl, 
            aadharBackUrl, 
            msmeUrl, 
            gstUrl, 
            fssaiUrl
        ] = await Promise.all([
            signUrl(merchantData.panDocUrl),
            signUrl(merchantData.aadharFrontUrl),
            signUrl(merchantData.aadharBackUrl),
            signUrl(merchantData.msmeCertificateUrl),
            signUrl(merchantData.gstCertificateUrl),
            signUrl(merchantData.fssaiCertificateUrl)
        ]);

        // 4. Clean, Flattened Response (Data Sanitization)
        const profileResponse = {
            id: merchantData.id,
            ownerName: merchantData.ownerName,
            email: merchantData.email,
            phone: merchantData.phone,
            status: merchantData.status,
            kycStatus: merchantData.kycStatus,
            store: storeData ? {
                name: storeData.name,
                address: storeData.address,
                city: storeData.city?.name,
                image: storeData.image,
                active: storeData.active
            } : null,
            kyc: {
                panNumber: merchantData.panNumber,
                aadharNumber: merchantData.aadharNumber,
                msmeNumber: merchantData.msmeNumber,
                gstNumber: merchantData.gstNumber,
                fssaiNumber: merchantData.fssaiNumber,
                bankAccount: merchantData.bankAccountNumber,
                ifsc: merchantData.ifscCode,
                beneficiaryName: merchantData.bankBeneficiaryName,
                docUrls: {
                    pan: panUrl,
                    aadharFront: aadharFrontUrl,
                    aadharBack: aadharBackUrl,
                    msme: msmeUrl,
                    gst: gstUrl,
                    fssai: fssaiUrl
                }
            },
            branches: merchantData.branches.map(b => ({
                id: b.id,
                name: b.branchName,
                manager: b.managerName,
                phone: b.phone,
                isActive: b.isActive
            })),
            subscription: merchantData.subscriptions[0] ? {
                status: merchantData.subscriptions[0].status,
                amount: merchantData.subscriptions[0].amount,
                createdAt: merchantData.subscriptions[0].createdAt
            } : null
        };

        res.json(profileResponse);

        } catch (error: any) {
        return handleApiError(res, error, { area: 'auth.merchant.profile', extra: undefined, userMessage: 'Internal Server Error while fetching profile' });
    }
});

// --- Server Start ---
server.listen(Number(port), '0.0.0.0', () => {
    console.log(`[API] Server running on http://0.0.0.0:${port}`);
    console.log(`[API] Socket.io ready`);
});
