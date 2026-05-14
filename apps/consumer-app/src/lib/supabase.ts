// @lock — Do NOT overwrite. Approved config as of May 1, 2026.
// Supabase Client: Initialization with AsyncStorage adapter + AppState-driven
// auto-refresh control (per Supabase React Native guide).
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

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

// Tell Supabase Auth to continuously refresh the session automatically only
// while the app is in the foreground. (Per official Supabase React Native guide.)
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});

/**
 * Manually establish a Supabase session using server-provided tokens after
 * OTP verification.
 *
 * IMPORTANT: We deliberately use `refreshSession({ refresh_token })` instead
 * of `setSession({ access_token, refresh_token })`.
 *
 * Why: in supabase-js v2, `setSession` with a non-expired access_token takes
 * an internal code path that calls `GET /auth/v1/user` to validate the token
 * and hydrate the user record. On this project that endpoint hangs after
 * login, holding the GoTrue auth lock and stalling every subsequent Supabase
 * query in the app (profile sync, store list, address lookup, etc.) until
 * each hits its own timeout.
 *
 * `refreshSession` takes a different code path:
 *   POST /auth/v1/token?grant_type=refresh_token
 * The response carries a fresh access_token AND the user record in one go,
 * so the client never has to call /auth/v1/user. Net cost is one cheap
 * round-trip and we burn the access_token the backend just minted (a brand
 * new one comes back). Worth it to avoid the hang.
 *
 * The `accessToken` argument is kept for call-site compatibility but is no
 * longer required — only the refresh_token is actually used.
 */
export async function setSessionFromTokens(accessToken: string, refreshToken: string) {
    // Log token expiry up-front so it's visible even if the call below hangs.
    try {
        const payload = JSON.parse(
            typeof Buffer !== 'undefined'
                ? Buffer.from(accessToken.split('.')[1], 'base64').toString('utf8')
                : atob(accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        const now = Math.floor(Date.now() / 1000);
        console.log('[supabase] backend access_token expires in', payload.exp - now, 'seconds');
    } catch {}

    const startTime = Date.now();
    console.log('[supabase] calling refreshSession...');
    const { data, error } = await supabase.auth.refreshSession({
        refresh_token: refreshToken,
    });
    console.log('[supabase] refreshSession finished in', Date.now() - startTime, 'ms');

    if (error) {
        console.error('[supabase] refreshSession failed:', error);
        throw error;
    }
    if (!data.session) {
        const e = new Error('refreshSession returned no session');
        console.error('[supabase]', e);
        throw e;
    }
}
