const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
    const phone = '919959777027';
    const formattedPhone = `+${phone}`;
    const syntheticEmail = `${phone}@phone.pickatstore.app`;

    const authUsers = await prisma.$queryRaw`SELECT id, email, phone FROM auth.users WHERE phone = ${formattedPhone} OR phone = ${phone} OR email = ${syntheticEmail}`;
    const existingUser = authUsers.length > 0 ? authUsers[0] : null;

    if (!existingUser) {
        console.log("No existing user found for", phone);
        return;
    }

    console.log("Found user:", existingUser.id, existingUser.email);

    const tempPassword = `PAS_OTP_${phone}_${Date.now()}_${Math.random().toString(36)}`;
    const signInEmail = existingUser.email || `${phone}@phone.pickatstore.app`;

    const updatePayload = { password: tempPassword, email_confirm: true };
    if (!existingUser.email) {
        updatePayload.email = signInEmail;
    }

    console.log("Updating user with payload:", updatePayload);
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, updatePayload);
    
    if (updateError) {
        console.error("Update Error:", updateError);
        return;
    }
    console.log("Update success. Attempting sign in...");

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: tempPassword
    });

    if (signInError) {
        console.error("Sign-in Error:", signInError);
    } else {
        console.log("Sign-in Success! Session:", !!signInData.session);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
