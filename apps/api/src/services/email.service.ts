import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_ADDRESS = 'PickAtStore <onboarding@updates.pickatstore.io>';

/**
 * Email #1: Sent when a merchant submits their application (finalize = true).
 */
export async function sendApplicationReceivedEmail(to: string, merchantName: string) {
    const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: 'Application Received – PickAtStore',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #B52725; font-size: 24px; margin: 0;">PickAtStore</h1>
                </div>
                <h2 style="color: #1a1a1a; font-size: 20px;">Welcome aboard!</h2>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${merchantName},</p>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    We have successfully received your store partner application.
                </p>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Our team is currently reviewing your KYC documents and business profile. 
                    We will notify you at this email address the moment your merchant dashboard is approved and active.
                </p>
                <div style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #B52725;">
                    <p style="color: #555; font-size: 14px; margin: 0;">
                        <strong>What happens next?</strong><br/>
                        Our verification team typically processes applications within 24–48 hours. 
                        You'll receive another email once your store is live.
                    </p>
                </div>
                <br/>
                <p style="color: #333; font-size: 15px;">Best Regards,</p>
                <p style="color: #333; font-size: 15px;"><strong>The PickAtStore Team</strong></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} PickAtStore. All rights reserved.
                </p>
            </div>
        `
    });

    if (error) {
        console.error('[Email] Application received email error:', error);
        throw error;
    }
    console.log('[Email] Application received email sent to', to, '| ID:', data?.id);
}

/**
 * Email #2: Sent when an admin approves a merchant's store from the KYC Queue.
 */
export async function sendStoreApprovedEmail(to: string, merchantName: string, storeName: string) {
    const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: 'Your Store is Now Live! – PickAtStore',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #B52725; font-size: 24px; margin: 0;">PickAtStore</h1>
                </div>
                <h2 style="color: #1a1a1a; font-size: 20px;">Congratulations, ${merchantName}! 🎉</h2>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Great news — your store <strong>${storeName}</strong> has been approved and is now live on PickAtStore.
                </p>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    You can now log in to your merchant app to start managing your store, 
                    add products, and begin accepting orders from customers in your area.
                </p>
                <div style="text-align: center; margin: 32px 0;">
                    <a href="https://pickatstore.io" 
                       style="background: #B52725; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                        Open Merchant Dashboard
                    </a>
                </div>
                <br/>
                <p style="color: #333; font-size: 15px;">If you have any questions, feel free to reply to this email.</p>
                <p style="color: #333; font-size: 15px;">Best Regards,</p>
                <p style="color: #333; font-size: 15px;"><strong>The PickAtStore Team</strong></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} PickAtStore. All rights reserved.
                </p>
            </div>
        `
    });

    if (error) {
        console.error('[Email] Store approved email error:', error);
        throw error;
    }
    console.log('[Email] Store approved email sent to', to, '| ID:', data?.id);
}

/**
 * Email #3: Sent when an admin rejects a merchant's application from the KYC Queue.
 */
export async function sendStoreRejectedEmail(to: string, merchantName: string, reason: string) {
    const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: 'Application Update – PickAtStore',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #B52725; font-size: 24px; margin: 0;">PickAtStore</h1>
                </div>
                <h2 style="color: #1a1a1a; font-size: 20px;">Application Update</h2>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${merchantName},</p>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Unfortunately, we were unable to approve your store application at this time.
                </p>
                <div style="background: #fff3f3; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #B52725;">
                    <p style="color: #333; font-size: 14px; margin: 0;">
                        <strong>Reason:</strong> ${reason || 'Your documents require re-submission or additional verification.'}
                    </p>
                </div>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Please update your documents and re-apply through the merchant app, 
                    or reply to this email for assistance.
                </p>
                <br/>
                <p style="color: #333; font-size: 15px;">Best Regards,</p>
                <p style="color: #333; font-size: 15px;"><strong>The PickAtStore Team</strong></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} PickAtStore. All rights reserved.
                </p>
            </div>
        `
    });

    if (error) {
        console.error('[Email] Store rejected email error:', error);
        throw error;
    }
    console.log('[Email] Store rejected email sent to', to, '| ID:', data?.id);
}
