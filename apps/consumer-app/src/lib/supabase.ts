// @lock — Do NOT overwrite. Approved config as of Mar 12, 2026.
// Supabase Client: Initialization with SecureStore adapter.
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

const TokenStorageAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            console.log(`[Storage] getItem: ${key}`);
            if (Platform.OS === 'web') return localStorage.getItem(key);
            const res = await SecureStore.getItemAsync(key);
            console.log(`[Storage] getItem success: ${key}`);
            return res;
        } catch (err) {
            console.error(`[Storage] getItem error: ${key}`, err);
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            console.log(`[Storage] setItem: ${key}`);
            if (Platform.OS === 'web') {
                localStorage.setItem(key, value);
                return;
            }
            await SecureStore.setItemAsync(key, value);
            console.log(`[Storage] setItem success: ${key}`);
        } catch (err) {
            console.error(`[Storage] setItem error: ${key}`, err);
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            console.log(`[Storage] removeItem: ${key}`);
            if (Platform.OS === 'web') {
                localStorage.removeItem(key);
                return;
            }
            await SecureStore.deleteItemAsync(key);
            console.log(`[Storage] removeItem success: ${key}`);
        } catch (err) {
            console.error(`[Storage] removeItem error: ${key}`, err);
        }
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: TokenStorageAdapter,
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

