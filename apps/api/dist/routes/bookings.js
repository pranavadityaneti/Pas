"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const supabase_js_1 = require("@supabase/supabase-js");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});
// Razorpay setup
const Razorpay = require('razorpay');
let razorpayInstance = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}
// --- Auth Helper ---
async function getAuthUser(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user)
        throw new Error('Unauthorized');
    return user;
}
// Audit A2 (2026-06-26): branch-ownership check. Mirrors index.ts userCanManageBranch
// (kept local to avoid a circular import — index.ts mounts this router). A user manages
// a branch if they are the branch owner, a phone-matched manager, or store_staff for it.
// This router previously had NO ownership checks → IDOR on every branch-scoped endpoint.
async function userManagesBranch(userId, branchId) {
    const branch = await prisma.merchantBranch.findUnique({
        where: { id: branchId },
        select: { merchantId: true, phone: true },
    });
    if (!branch)
        return false;
    if (branch.merchantId && branch.merchantId === userId)
        return true;
    if (branch.phone) {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
        if (u?.phone && u.phone === branch.phone)
            return true;
    }
    const staff = await prisma.storeStaff.findFirst({
        where: { storeId: branchId, OR: [{ user_id: userId }, { authUserId: userId }] },
        select: { id: true },
    });
    return !!staff;
}
// ─────────────────────────────────────────────────────────────
// PATCH /service-modes/:branchId — Update service mode toggles
// ─────────────────────────────────────────────────────────────
router.patch('/service-modes/:branchId', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const { branchId } = req.params;
        const { servicePickup, serviceDinein, serviceTableBooking } = req.body;
        // Verify merchant owns this branch
        const branch = await prisma.merchantBranch.findFirst({
            where: { id: branchId },
            include: { merchant: true }
        });
        if (!branch)
            return res.status(404).json({ error: 'Branch not found' });
        const updateData = {};
        if (typeof servicePickup === 'boolean')
            updateData.servicePickup = servicePickup;
        if (typeof serviceDinein === 'boolean')
            updateData.serviceDinein = serviceDinein;
        if (typeof serviceTableBooking === 'boolean')
            updateData.serviceTableBooking = serviceTableBooking;
        const updated = await prisma.merchantBranch.update({
            where: { id: branchId },
            data: updateData
        });
        res.json({ success: true, branch: updated });
    }
    catch (error) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// PUT /slot-config/:branchId — Save slot configuration
// ─────────────────────────────────────────────────────────────
router.put('/slot-config/:branchId', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const { branchId } = req.params;
        const { slotConfig } = req.body;
        if (!Array.isArray(slotConfig)) {
            return res.status(400).json({ error: 'slotConfig must be an array' });
        }
        // Validate structure
        for (const entry of slotConfig) {
            if (!Array.isArray(entry.days) || !entry.tables_per_slot || !entry.slot_gap_minutes) {
                return res.status(400).json({ error: 'Each slot config entry must have days, tables_per_slot, and slot_gap_minutes' });
            }
        }
        const branch = await prisma.merchantBranch.findFirst({ where: { id: branchId } });
        if (!branch)
            return res.status(404).json({ error: 'Branch not found' });
        const updated = await prisma.merchantBranch.update({
            where: { id: branchId },
            data: { slotConfig }
        });
        res.json({ success: true, slotConfig: updated.slotConfig });
    }
    catch (error) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// GET /availability?branchId=X&date=YYYY-MM-DD — Slot availability (public)
// ─────────────────────────────────────────────────────────────
router.get('/availability', async (req, res) => {
    try {
        const { branchId, date } = req.query;
        if (!branchId || !date) {
            return res.status(400).json({ error: 'branchId and date are required' });
        }
        // Call the Postgres function via Supabase RPC
        const { data, error } = await supabaseAdmin.rpc('get_slot_availability', {
            p_branch_id: branchId,
            p_date: date
        });
        if (error) {
            console.error('get_slot_availability RPC error:', error);
            return res.status(500).json({ error: 'Failed to get availability' });
        }
        res.json(data);
    }
    catch (error) {
        console.error('Availability error:', error);
        res.status(500).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// POST /reserve — Reserve a table slot (consumer, after payment)
// ─────────────────────────────────────────────────────────────
router.post('/reserve', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const { branchId, slotDate, slotTime, guestsCount, bookingFee, razorpayOrderId, razorpayPaymentId, razorpaySignature, customerName, customerPhone } = req.body;
        // Validate required fields
        if (!branchId || !slotDate || !slotTime || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Verify Razorpay payment signature
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = crypto_1.default
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
            .update(body)
            .digest('hex');
        if (expectedSignature !== razorpaySignature) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }
        // Call atomic reservation function
        const { data, error } = await supabaseAdmin.rpc('reserve_table_slot', {
            p_branch_id: branchId,
            p_user_id: user.id,
            p_slot_date: slotDate,
            p_slot_time: slotTime,
            p_guests_count: guestsCount || 2,
            p_booking_fee: bookingFee || 25,
            p_payment_id: razorpayPaymentId,
            p_razorpay_order_id: razorpayOrderId,
            p_customer_name: customerName || null,
            p_customer_phone: customerPhone || null
        });
        if (error) {
            console.error('reserve_table_slot RPC error:', error);
            // Auto-refund since payment was verified but reservation failed
            await initiateRefund(razorpayPaymentId, bookingFee || 25, 'Slot unavailable');
            return res.status(409).json({ error: 'Reservation failed, payment will be refunded', refunded: true });
        }
        if (!data.success) {
            // Slot was full — auto-refund
            await initiateRefund(razorpayPaymentId, bookingFee || 25, 'Slot full');
            return res.status(409).json({ error: data.error, refunded: true });
        }
        res.json({
            success: true,
            bookingId: data.booking_id,
            otp: data.otp,
            slotDate,
            slotTime,
            guestsCount: guestsCount || 2
        });
    }
    catch (error) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// GET /merchant?branchId=X&date=YYYY-MM-DD — Merchant's bookings for a date
// ─────────────────────────────────────────────────────────────
router.get('/merchant', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const { branchId, date } = req.query;
        if (!branchId)
            return res.status(400).json({ error: 'branchId is required' });
        // Authorization (audit A2): only the branch's manager may read its bookings.
        const canManage = await userManagesBranch(user.id, branchId);
        if (!canManage)
            return res.status(403).json({ error: 'You do not manage this branch.' });
        const whereClause = {
            branchId: branchId
        };
        if (date) {
            whereClause.slotDate = new Date(date);
        }
        const bookings = await prisma.tableBooking.findMany({
            where: whereClause,
            orderBy: [{ slotDate: 'asc' }, { slotTime: 'asc' }]
        });
        // Summary stats
        const confirmed = bookings.filter(b => b.status === 'CONFIRMED').length;
        const completed = bookings.filter(b => b.status === 'COMPLETED').length;
        const cancelled = bookings.filter(b => b.status === 'CANCELLED').length;
        const noShow = bookings.filter(b => b.status === 'NO_SHOW').length;
        res.json({
            bookings,
            summary: {
                total: bookings.length,
                confirmed,
                completed,
                cancelled,
                noShow
            }
        });
    }
    catch (error) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// PATCH /:bookingId/status — Update booking status (merchant)
// ─────────────────────────────────────────────────────────────
router.patch('/:bookingId/status', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const { bookingId } = req.params;
        const { status, otp } = req.body;
        const validStatuses = ['COMPLETED', 'CANCELLED', 'NO_SHOW'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
        }
        const booking = await prisma.tableBooking.findUnique({
            where: { id: bookingId }
        });
        if (!booking)
            return res.status(404).json({ error: 'Booking not found' });
        // Authorization (audit A2): only the booking's own branch manager may act on it.
        // Previously there was NO ownership check — any authenticated user could cancel
        // any booking by id (IDOR) and trigger its refund.
        const canManage = await userManagesBranch(user.id, booking.branchId);
        if (!canManage)
            return res.status(403).json({ error: "You do not manage this booking's branch." });
        // If marking COMPLETED, verify OTP
        if (status === 'COMPLETED') {
            if (!otp || otp !== booking.otp) {
                return res.status(400).json({ error: 'Invalid OTP' });
            }
        }
        // Atomic compare-and-set (audit A2): only transition a booking that is NOT already
        // terminal. Without this, two concurrent CANCELLED calls both updated and both
        // refunded → DOUBLE REFUND. Now exactly one wins; the refund below runs only for it.
        const upd = await prisma.tableBooking.updateMany({
            where: { id: bookingId, status: { notIn: ['CANCELLED', 'COMPLETED', 'NO_SHOW'] } },
            data: { status, updatedAt: new Date() },
        });
        if (upd.count === 0) {
            return res.status(409).json({ error: 'Booking is already finalized (cancelled / completed / no-show).' });
        }
        // If cancelled, refund the booking fee. (Refund still issued here for now; the
        // strict "move booking-fee refunds to admin" change is a flagged follow-up.)
        if (status === 'CANCELLED' && booking.paymentId) {
            await initiateRefund(booking.paymentId, booking.bookingFee, 'Cancelled by merchant');
        }
        const updated = await prisma.tableBooking.findUnique({ where: { id: bookingId } });
        res.json({ success: true, booking: updated });
    }
    catch (error) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// GET /consumer — Consumer's own bookings
// ─────────────────────────────────────────────────────────────
router.get('/consumer', async (req, res) => {
    try {
        const user = await getAuthUser(req);
        const bookings = await prisma.tableBooking.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: 'desc' },
            include: {
                branch: {
                    select: {
                        id: true,
                        branchName: true,
                        address: true,
                        phone: true,
                        merchant: {
                            select: { storeName: true }
                        }
                    }
                }
            },
            take: 20
        });
        res.json({ bookings });
    }
    catch (error) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});
// ─────────────────────────────────────────────────────────────
// Helper: Initiate Razorpay refund
// ─────────────────────────────────────────────────────────────
async function initiateRefund(paymentId, amount, reason) {
    try {
        if (!razorpayInstance) {
            console.error('Razorpay not configured, cannot refund');
            return;
        }
        const refund = await razorpayInstance.payments.refund(paymentId, {
            amount: Math.round(amount * 100), // convert to paise
            notes: { reason }
        });
        console.log(`Refund initiated: ${refund.id} for payment ${paymentId}`);
        return refund;
    }
    catch (error) {
        console.error(`Refund failed for ${paymentId}:`, error.message);
    }
}
exports.default = router;
//# sourceMappingURL=bookings.js.map