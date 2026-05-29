import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const router = Router();
const prisma = new PrismaClient();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Razorpay setup
const Razorpay = require('razorpay');
let razorpayInstance: any = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpayInstance = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

// --- Auth Helper ---
async function getAuthUser(req: Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('Missing or invalid token');
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) throw new Error('Unauthorized');
    return user;
}

// ─────────────────────────────────────────────────────────────
// PATCH /service-modes/:branchId — Update service mode toggles
// ─────────────────────────────────────────────────────────────
router.patch('/service-modes/:branchId', async (req: Request, res: Response): Promise<any> => {
    try {
        const user = await getAuthUser(req);
        const { branchId } = req.params;
        const { servicePickup, serviceDinein, serviceTableBooking } = req.body;

        // Verify merchant owns this branch
        const branch = await prisma.merchantBranch.findFirst({
            where: { id: branchId },
            include: { merchant: true }
        });

        if (!branch) return res.status(404).json({ error: 'Branch not found' });

        const updateData: any = {};
        if (typeof servicePickup === 'boolean') updateData.servicePickup = servicePickup;
        if (typeof serviceDinein === 'boolean') updateData.serviceDinein = serviceDinein;
        if (typeof serviceTableBooking === 'boolean') updateData.serviceTableBooking = serviceTableBooking;

        const updated = await prisma.merchantBranch.update({
            where: { id: branchId },
            data: updateData
        });

        res.json({ success: true, branch: updated });
    } catch (error: any) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// PUT /slot-config/:branchId — Save slot configuration
// ─────────────────────────────────────────────────────────────
router.put('/slot-config/:branchId', async (req: Request, res: Response): Promise<any> => {
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
        if (!branch) return res.status(404).json({ error: 'Branch not found' });

        const updated = await prisma.merchantBranch.update({
            where: { id: branchId },
            data: { slotConfig }
        });

        res.json({ success: true, slotConfig: updated.slotConfig });
    } catch (error: any) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /availability?branchId=X&date=YYYY-MM-DD — Slot availability (public)
// ─────────────────────────────────────────────────────────────
router.get('/availability', async (req: Request, res: Response): Promise<any> => {
    try {
        const { branchId, date } = req.query;

        if (!branchId || !date) {
            return res.status(400).json({ error: 'branchId and date are required' });
        }

        // Call the Postgres function via Supabase RPC
        const { data, error } = await supabaseAdmin.rpc('get_slot_availability', {
            p_branch_id: branchId as string,
            p_date: date as string
        });

        if (error) {
            console.error('get_slot_availability RPC error:', error);
            return res.status(500).json({ error: 'Failed to get availability' });
        }

        res.json(data);
    } catch (error: any) {
        console.error('Availability error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// POST /reserve — Reserve a table slot (consumer, after payment)
// ─────────────────────────────────────────────────────────────
router.post('/reserve', async (req: Request, res: Response): Promise<any> => {
    try {
        const user = await getAuthUser(req);
        const {
            branchId,
            slotDate,
            slotTime,
            guestsCount,
            bookingFee,
            razorpayOrderId,
            razorpayPaymentId,
            razorpaySignature,
            customerName,
            customerPhone
        } = req.body;

        // Validate required fields
        if (!branchId || !slotDate || !slotTime || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Verify Razorpay payment signature
        const body = razorpayOrderId + '|' + razorpayPaymentId;
        const expectedSignature = crypto
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
    } catch (error: any) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /merchant?branchId=X&date=YYYY-MM-DD — Merchant's bookings for a date
// ─────────────────────────────────────────────────────────────
router.get('/merchant', async (req: Request, res: Response): Promise<any> => {
    try {
        const user = await getAuthUser(req);
        const { branchId, date } = req.query;

        if (!branchId) return res.status(400).json({ error: 'branchId is required' });

        const whereClause: any = {
            branchId: branchId as string
        };

        if (date) {
            whereClause.slotDate = new Date(date as string);
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
    } catch (error: any) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// PATCH /:bookingId/status — Update booking status (merchant)
// ─────────────────────────────────────────────────────────────
router.patch('/:bookingId/status', async (req: Request, res: Response): Promise<any> => {
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

        if (!booking) return res.status(404).json({ error: 'Booking not found' });

        // If marking COMPLETED, verify OTP
        if (status === 'COMPLETED') {
            if (!otp || otp !== booking.otp) {
                return res.status(400).json({ error: 'Invalid OTP' });
            }
        }

        const updated = await prisma.tableBooking.update({
            where: { id: bookingId },
            data: {
                status,
                updatedAt: new Date()
            }
        });

        // If cancelled by merchant, auto-refund
        if (status === 'CANCELLED' && booking.paymentId) {
            await initiateRefund(booking.paymentId, booking.bookingFee, 'Cancelled by merchant');
        }

        res.json({ success: true, booking: updated });
    } catch (error: any) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// GET /consumer — Consumer's own bookings
// ─────────────────────────────────────────────────────────────
router.get('/consumer', async (req: Request, res: Response): Promise<any> => {
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
    } catch (error: any) {
        const status = error.message === 'Unauthorized' || error.message === 'Missing or invalid token' ? 401 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ─────────────────────────────────────────────────────────────
// Helper: Initiate Razorpay refund
// ─────────────────────────────────────────────────────────────
async function initiateRefund(paymentId: string, amount: number, reason: string) {
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
    } catch (error: any) {
        console.error(`Refund failed for ${paymentId}:`, error.message);
    }
}

export default router;
