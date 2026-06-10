"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendApplicationReceivedEmail = sendApplicationReceivedEmail;
exports.sendAdminInviteEmail = sendAdminInviteEmail;
exports.sendStoreApprovedEmail = sendStoreApprovedEmail;
exports.sendStoreNeedsInfoEmail = sendStoreNeedsInfoEmail;
exports.sendStoreRejectedEmail = sendStoreRejectedEmail;
const resend_1 = require("resend");
const resend = new resend_1.Resend(process.env.RESEND_API_KEY || 're_123_dummy');
const FROM_ADDRESS = 'PickAtStore <onboarding@updates.pickatstore.io>';
/**
 * Email #1: Sent when a merchant submits their application (finalize = true).
 */
async function sendApplicationReceivedEmail(to, merchantName) {
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
 * Email #5: Sent when a Super Admin invites a new admin-tier user.
 * Contains a temporary password the invitee uses for their first login; they're
 * forced to change it via ForcePasswordChange before they can use the dashboard.
 */
async function sendAdminInviteEmail(to, name, roleLabel, tempPassword, invitedByName) {
    const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: `You've been invited to the PickAtStore Admin Console`,
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #B52725; font-size: 24px; margin: 0;">PickAtStore</h1>
                </div>
                <h2 style="color: #1a1a1a; font-size: 20px;">Welcome to the team, ${name}!</h2>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    ${invitedByName} has invited you to join the PickAtStore Admin Console as a
                    <strong>${roleLabel}</strong>.
                </p>
                <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 24px 0; border-left: 4px solid #B52725;">
                    <p style="color: #555; font-size: 14px; margin: 0 0 12px 0;"><strong>Your login details:</strong></p>
                    <p style="color: #2a2a2a; font-size: 14px; margin: 0 0 4px 0;">Email: <strong>${to}</strong></p>
                    <p style="color: #2a2a2a; font-size: 14px; margin: 0 0 4px 0;">
                        Temporary password: <strong style="font-family: monospace; background: #fff; padding: 2px 6px; border-radius: 4px; border: 1px solid #ddd;">${tempPassword}</strong>
                    </p>
                    <p style="color: #888; font-size: 12px; margin: 12px 0 0 0;">
                        For security, you'll be asked to change this password the first time you log in.
                    </p>
                </div>
                <div style="text-align: center; margin: 28px 0;">
                    <a href="https://admin.pickatstore.io"
                       style="background: #B52725; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
                        Open Admin Console
                    </a>
                </div>
                <p style="color: #888; font-size: 13px; line-height: 1.6;">
                    If you weren't expecting this invitation, you can safely ignore this email or
                    reply to it letting us know.
                </p>
                <p style="color: #333; font-size: 15px;">Best Regards,</p>
                <p style="color: #333; font-size: 15px;"><strong>The PickAtStore Team</strong></p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #999; font-size: 12px; text-align: center;">
                    © ${new Date().getFullYear()} PickAtStore. All rights reserved.
                </p>
            </div>
        `,
    });
    if (error) {
        console.error('[Email] Admin invite email error:', error);
        throw error;
    }
    console.log('[Email] Admin invite email sent to', to, '| ID:', data?.id);
}
/**
 * Email #2: Sent when an admin approves a merchant's store from the KYC Queue.
 */
async function sendStoreApprovedEmail(to, merchantName, storeName) {
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
 * Email #4: Sent when an admin requests additional information from a merchant.
 * Decision: needs_info (between approved and rejected). The application stays open;
 * the merchant updates their docs and the admin re-reviews.
 */
async function sendStoreNeedsInfoEmail(to, merchantName, requestDetails) {
    const { data, error } = await resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject: 'Action Required – PickAtStore Application',
        html: `
            <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #ffffff;">
                <div style="text-align: center; margin-bottom: 24px;">
                    <h1 style="color: #B52725; font-size: 24px; margin: 0;">PickAtStore</h1>
                </div>
                <h2 style="color: #1a1a1a; font-size: 20px;">A small step to finish your onboarding</h2>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi ${merchantName},</p>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Thanks for applying to be a PickAtStore partner — our verification team
                    has reviewed your application and needs a bit more information before
                    we can activate your store.
                </p>
                <div style="background: #fffaf0; border-radius: 8px; padding: 16px; margin: 24px 0; border-left: 4px solid #B52725;">
                    <p style="color: #333; font-size: 14px; margin: 0 0 8px 0;">
                        <strong>What we need from you:</strong>
                    </p>
                    <p style="color: #555; font-size: 14px; margin: 0; white-space: pre-line;">
                        ${requestDetails || 'Please reply to this email with the additional details our team has requested.'}
                    </p>
                </div>
                <p style="color: #333; font-size: 15px; line-height: 1.6;">
                    Once you've sent the requested information, we'll review again — usually
                    within 24 hours — and email you the moment your store is approved.
                </p>
                <div style="text-align: center; margin: 28px 0;">
                    <a href="mailto:onboarding@updates.pickatstore.io"
                       style="background: #B52725; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px;">
                        Reply with details
                    </a>
                </div>
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
        console.error('[Email] Store needs-info email error:', error);
        throw error;
    }
    console.log('[Email] Store needs-info email sent to', to, '| ID:', data?.id);
}
/**
 * Email #3: Sent when an admin rejects a merchant's application from the KYC Queue.
 */
async function sendStoreRejectedEmail(to, merchantName, reason) {
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
//# sourceMappingURL=email.service.js.map