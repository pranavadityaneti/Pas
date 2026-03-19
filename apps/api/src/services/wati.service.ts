import axios from 'axios';

/**
 * Wati WhatsApp API Service
 * Sends OTP messages using a pre-approved WhatsApp Authentication Template.
 *
 * Prerequisites:
 *   - Approved authentication template named in WATI_AUTH_TEMPLATE_NAME env var
 *   - Template must have {{1}} placeholder for the OTP code
 */
class WatiService {
    private readonly apiEndpoint: string;
    private readonly apiToken: string;
    private readonly templateName: string;

    constructor() {
        this.apiEndpoint = process.env.WATI_API_ENDPOINT || '';
        this.apiToken = process.env.WATI_API_TOKEN || '';
        this.templateName = process.env.WATI_AUTH_TEMPLATE_NAME || 'otp';
    }

    /**
     * Send OTP via WhatsApp using Wati's sendTemplateMessage API.
     * @param phone Phone number in format "91XXXXXXXXXX" (no + prefix)
     * @param otp The OTP code to send
     * @returns true if message was accepted by Wati API
     */
    async sendOtp(phone: string, otp: string): Promise<boolean> {
        if (!this.apiEndpoint || !this.apiToken) {
            console.error('[Wati] Missing WATI_API_ENDPOINT or WATI_API_TOKEN env vars');
            return false;
        }

        // In test mode, just log
        if (process.env.NODE_ENV === 'test') {
            console.log(`[Wati MOCK] OTP ${otp} → ${phone}`);
            return true;
        }

        try {
            const url = `${this.apiEndpoint}/api/v1/sendTemplateMessage`;

            const response = await axios.post(
                url,
                {
                    template_name: this.templateName,
                    broadcast_name: `otp_${Date.now()}`,
                    parameters: [
                        { name: '1', value: otp }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiToken}`,
                        'Content-Type': 'application/json'
                    },
                    params: {
                        whatsappNumber: phone
                    },
                    timeout: 10000
                }
            );

            if (response.data?.result === true || response.status === 200) {
                console.log(`[Wati] OTP sent to ${phone}`);
                return true;
            } else {
                console.error('[Wati] Unexpected response:', response.data);
                return false;
            }
        } catch (error: any) {
            console.error('[Wati] SendOTP Error:', error.response?.data || error.message);
            return false;
        }
    }
}

export const watiService = new WatiService();
