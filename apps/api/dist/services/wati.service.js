"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watiService = void 0;
const axios_1 = __importDefault(require("axios"));
/**
 * Wati WhatsApp API Service
 *
 * Outbound WhatsApp messages — each method maps 1:1 to a Meta-approved template.
 * Full template content + submission instructions in `docs/wati-automation-spec.md`.
 *
 * Rollout pattern:
 *   1. Submit template in Wati dashboard → Meta approves (24-48h)
 *   2. Set the matching env var (e.g., WATI_TEMPLATE_ORDER_PLACED=order_placed) on EB
 *   3. The corresponding method goes from no-op to live with no code change
 *
 * Until the env var is set, the method logs and returns false — never throws.
 * That's intentional so callers can safely fire-and-forget while approvals roll in.
 *
 * 2026-06-02 — Extended from OTP-only to all 11 customer + merchant templates.
 *              Original sendOtp() preserved unchanged.
 */
class WatiService {
    constructor() {
        this.apiEndpoint = process.env.WATI_API_ENDPOINT || '';
        this.apiToken = process.env.WATI_API_TOKEN || '';
        this.templateName = process.env.WATI_AUTH_TEMPLATE_NAME || 'otp';
    }
    /**
     * Internal — generic Wati sendTemplateMessage caller.
     * Each public method below builds its variable map and calls this.
     */
    async sendTemplate(phone, templateName, values, broadcastTag) {
        if (!this.apiEndpoint || !this.apiToken) {
            console.error('[Wati] Missing WATI_API_ENDPOINT or WATI_API_TOKEN env vars');
            return false;
        }
        if (!templateName) {
            // Env var not set yet — silent no-op so callers can fire-and-forget.
            console.warn(`[Wati] template not configured (${broadcastTag}) — skipping send`);
            return false;
        }
        if (process.env.NODE_ENV === 'test') {
            console.log(`[Wati MOCK] ${templateName} → ${phone} with`, values);
            return true;
        }
        try {
            const url = `${this.apiEndpoint}/api/v1/sendTemplateMessage`;
            const response = await axios_1.default.post(url, {
                template_name: templateName,
                broadcast_name: `${broadcastTag}_${Date.now()}`,
                // Wati expects parameters as { name: '1', value: 'x' }
                parameters: values.map((v, i) => ({ name: String(i + 1), value: v ?? '' })),
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/json',
                },
                params: { whatsappNumber: phone },
                timeout: 10000,
            });
            if (response.data?.result === true || response.status === 200) {
                console.log(`[Wati] ${templateName} sent to ${phone}`);
                return true;
            }
            console.error(`[Wati] ${templateName} unexpected response:`, response.data);
            return false;
        }
        catch (error) {
            console.error(`[Wati] ${templateName} error:`, error.response?.data || error.message);
            return false;
        }
    }
    /**
     * Send a free-text SESSION message (WhatsApp 24-hour customer-service window).
     * Used by the admin support inbox to reply to a customer. Returns ok:false
     * with an error when the window has expired or Wati rejects — the caller
     * surfaces it. (Outside the 24h window WhatsApp only allows template sends.)
     */
    async sendSessionMessage(phone, text) {
        if (!this.apiEndpoint || !this.apiToken) {
            return { ok: false, error: 'Wati is not configured on the server.' };
        }
        if (process.env.NODE_ENV === 'test') {
            console.log(`[Wati MOCK] session → ${phone}: ${text}`);
            return { ok: true };
        }
        try {
            const url = `${this.apiEndpoint}/api/v1/sendSessionMessage/${encodeURIComponent(phone)}`;
            const response = await axios_1.default.post(url, {}, {
                headers: { 'Authorization': `Bearer ${this.apiToken}` },
                params: { messageText: text },
                timeout: 10000,
            });
            if (response.data?.result === true || response.status === 200) {
                return { ok: true };
            }
            return { ok: false, error: response.data?.info || 'Wati rejected the message — the 24-hour reply window may have expired.' };
        }
        catch (error) {
            const msg = error.response?.data?.info || error.response?.data?.message || error.message;
            console.error('[Wati] sendSessionMessage error:', msg);
            return { ok: false, error: msg };
        }
    }
    // ─── AUTHENTICATION (live) ───────────────────────────────────────────────
    /**
     * Send OTP via WhatsApp using the approved authentication template.
     * @param phone Phone number "91XXXXXXXXXX" (no + prefix)
     * @param otp 6-digit code
     */
    async sendOtp(phone, otp) {
        return this.sendTemplate(phone, this.templateName, [otp], 'otp');
    }
    // ─── CUSTOMER · ORDER LIFECYCLE ──────────────────────────────────────────
    /** Triggered: POST /orders after Razorpay verifies payment. */
    async sendOrderPlaced(phone, name, store, orderNumber, total) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_ORDER_PLACED || '', [name, store, orderNumber, String(total)], 'order_placed');
    }
    /** Triggered: merchant accepts an order request. */
    async sendOrderAccepted(phone, name, store, orderNumber, eta) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_ORDER_ACCEPTED || '', [name, store, orderNumber, eta], 'order_accepted');
    }
    /** Triggered: merchant marks order ready. CRITICAL — contains pickup OTP. */
    async sendOrderReady(phone, orderNumber, store, pickupOtp, latestPickupTime) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_ORDER_READY || '', [orderNumber, store, pickupOtp, latestPickupTime], 'order_ready');
    }
    /** Triggered: merchant verifies pickup OTP at the counter. */
    async sendOrderCompleted(phone, orderNumber, store, total) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_ORDER_COMPLETED || '', [orderNumber, store, String(total)], 'order_completed');
    }
    /** Triggered: merchant cancels an accepted order. */
    async sendOrderCancelledByMerchant(phone, name, store, orderNumber, reason, amount) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_ORDER_CANCELLED_MERCHANT || '', [name, store, orderNumber, reason, String(amount)], 'order_cancelled_merchant');
    }
    /** Triggered: customer cancels pre-pickup (WS2). */
    async sendOrderCancelledByCustomer(phone, orderNumber, store, amount) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_ORDER_CANCELLED_CUSTOMER || '', [orderNumber, store, String(amount)], 'order_cancelled_customer');
    }
    /** Triggered: return/exchange refund initiated (WS2). */
    async sendRefundInitiated(phone, amount, orderNumber) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_REFUND_INITIATED || '', [String(amount), orderNumber], 'refund_initiated');
    }
    // ─── CUSTOMER · DINING ───────────────────────────────────────────────────
    /** Triggered: dining order success. */
    async sendDiningBookingConfirmed(phone, restaurant, dateTime, guests) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_DINING_BOOKING_CONFIRMED || '', [restaurant, dateTime, String(guests)], 'dining_booking_confirmed');
    }
    /** Triggered: scheduled job, 1h before slot (not yet wired). */
    async sendDiningSlotReminder(phone, restaurant, guests, slot) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_DINING_SLOT_REMINDER || '', [restaurant, String(guests), slot], 'dining_slot_reminder');
    }
    // ─── MERCHANT ────────────────────────────────────────────────────────────
    /** Triggered: customer order placement → merchant gets pinged. */
    async sendMerchantNewOrder(phone, orderNumber, customer, items, total) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_MERCHANT_NEW_ORDER || '', [orderNumber, customer, items, String(total)], 'merchant_new_order');
    }
    /**
     * Triggered: POST /merchants/:id/kyc-decision. Fires alongside the Resend
     * email — same content, two channels for higher delivery confidence.
     *
     * `headline` and `detail` are pre-formatted by the caller so a single template
     * covers all three decision paths (approved / needs_info / rejected).
     */
    async sendMerchantKycStatus(phone, name, headline, detail) {
        return this.sendTemplate(phone, process.env.WATI_TEMPLATE_MERCHANT_KYC_STATUS || '', [name, headline, detail], 'merchant_kyc_status');
    }
}
exports.watiService = new WatiService();
//# sourceMappingURL=wati.service.js.map