const { Resend } = require('resend');

const resend = new Resend('re_QpUCXtcd_9hnn1ubvTX6Q58BKqv43QAux');

async function test() {
    try {
        console.log('Sending test email...');
        const data = await resend.emails.send({
            from: 'onboarding@resend.dev', // Use the default Resend sandbox sender
            to: 'nickeynick63@gmail.com',
            subject: 'Test Email from PAS',
            html: '<p>If you see this, Resend integration is working!</p>'
        });
        console.log('Success:', data);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
