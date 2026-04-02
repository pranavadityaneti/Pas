// @lock — Do NOT overwrite. Approved config as of Mar 12, 2026.
// Supabase Client: Initialization with AsyncStorage adapter.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('FATAL: Missing Supabase Environment Variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: AsyncStorage as any,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

/**
 * Manually set a Supabase session from server-provided tokens.
 * Used after OTP verification when the backend issues tokens.
 */
export async function setSessionFromTokens(accessToken: string, refreshToken: string) {
    const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
    });
    if (error) {
        console.error('Failed to set session from tokens:', error);
        throw error;
    }
}
