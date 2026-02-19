
import axios from 'axios';

// CRITICAL: This service handles SMS notifications. 
// Do NOT delete or modify without ensuring alternative SMS handling is in place.
// Credentials and templates are specific to the DLT provider (smslogin.co).
class SmsService {
    private readonly baseUrl = 'https://smslogin.co/v3/api.php';
    private readonly username = 'PICKAT';
    private readonly apiKey = 'd262cc524c1c53a84e2c';
    private readonly senderId = 'PICKAT'; // Placeholder, needs approval

    /**
     * Send SMS via smslogin.co
     * @param mobile Mobile number (10 digits)
     * @param message Message content
     * @param templateId DLT Template ID (Required for India)
     */
    async sendSms(mobile: string, message: string, templateId?: string): Promise<boolean> {
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

            const response = await axios.get(`${this.baseUrl}?${params.toString()}`);

            if (response.status === 200) {
                console.log('SMS sent successfully:', response.data);
                return true;
            } else {
                console.error('SMS API Error:', response.data);
                return false;
            }
        } catch (error) {
            console.error('SMS Service Error:', error);
            return false;
        }
    }

    async sendOtp(mobile: string, otp: string): Promise<boolean> {
        const message = `Your PickAtStore verification code is ${otp}. Valid for 10 minutes.`;
        // TODO: Add Template ID
        return this.sendSms(mobile, message);
    }

    async sendOrderUpdate(mobile: string, orderId: string, status: string): Promise<boolean> {
        const message = `Your order #${orderId} is now ${status}. Track it on the app.`;
        // TODO: Add Template ID
        return this.sendSms(mobile, message);
    }
}

export const smsService = new SmsService();
