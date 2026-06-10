"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsService = void 0;
const axios_1 = __importDefault(require("axios"));
// CRITICAL: This service handles SMS notifications. 
// Do NOT delete or modify without ensuring alternative SMS handling is in place.
// Credentials and templates are specific to the DLT provider (smslogin.co).
class SmsService {
    constructor() {
        this.baseUrl = 'https://smslogin.co/v3/api.php';
        this.username = 'PICKAT';
        this.apiKey = 'd262cc524c1c53a84e2c';
        this.senderId = 'PICKAT'; // Placeholder, needs approval
    }
    /**
     * Send SMS via smslogin.co
     * @param mobile Mobile number (10 digits)
     * @param message Message content
     * @param templateId DLT Template ID (Required for India)
     */
    async sendSms(mobile, message, templateId) {
        try {
            // In development/test mode, we might want to just log
            if (process.env.NODE_ENV === 'test') {
                console.log(`[SMS MOCK] To: ${mobile}, Msg: ${message}`);
                return true;
            }
            const params = new URLSearchParams({
                username: this.username,
                apikey: this.apiKey,
                senderid: this.senderId,
                mobile,
                message,
                // templateid: templateId || '' // Uncomment when templates are available
            });
            const response = await axios_1.default.get(`${this.baseUrl}?${params.toString()}`);
            if (response.status === 200) {
                console.log('SMS sent successfully:', response.data);
                return true;
            }
            else {
                console.error('SMS API Error:', response.data);
                return false;
            }
        }
        catch (error) {
            console.error('SMS Service Error:', error);
            return false;
        }
    }
    async sendOtp(mobile, otp) {
        const message = `Your PickAtStore verification code is ${otp}. Valid for 10 minutes.`;
        // TODO: Add Template ID
        return this.sendSms(mobile, message);
    }
    async sendOrderUpdate(mobile, orderId, status) {
        const message = `Your order #${orderId} is now ${status}. Track it on the app.`;
        // TODO: Add Template ID
        return this.sendSms(mobile, message);
    }
}
exports.smsService = new SmsService();
//# sourceMappingURL=sms.service.js.map