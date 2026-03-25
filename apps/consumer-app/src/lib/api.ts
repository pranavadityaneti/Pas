import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import { navigationRef } from '../../App';
import { Alert } from 'react-native';

import Constants from 'expo-constants';

export const getApiUrl = () => {
    // 1. Manually set environment variable (Priority)
    if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

    // 2. Dynamic Local Development IP
    if (__DEV__) {
        const debuggerHost = Constants.expoConfig?.hostUri;
        const address = debuggerHost?.split(':')[0];
        if (address) return `http://${address}:3000`;
        return 'http://localhost:3000'; // Pure fallback
    }

    // 3. Production Fallback
    return 'http://pas-api-prod.eba-njbp437w.ap-south-1.elasticbeanstalk.com';
};

export const API_URL = getApiUrl();

/**
 * Hardened API Client with Global 401 Interceptor
 */
export const apiClient = {
    fetch: async (endpoint: string, options: any = {}) => {
        const { timeout = 10000, ...fetchOptions } = options;
        
        // 1. Get Auth Token
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                ...fetchOptions,
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                    ...fetchOptions.headers,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            // 2. Global 401 Interceptor (Mandate 1)
            if (response.status === 401) {
                console.warn('[API] 401 Unauthorized detected. Purging session...');
                await purgeAuthSession();
                return response; // Caller handles the rest if needed, but nav has been triggered
            }

            return response;
        } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') throw new Error('Network timeout');
            throw error;
        }
    }
};

/**
 * Purges all cached PII and forces navigation to Auth
 */
export const purgeAuthSession = async () => {
    // Safety wrapper to prevent keychain wipe from freezing the app
    const withTimeout = (promise: Promise<any>, ms = 2000) => 
        Promise.race([
            promise, 
            new Promise((_, ref) => setTimeout(() => ref(new Error('SecureStore Timeout')), ms))
        ]);

    try {
        console.log('[Auth] Global session purge initiated.');
        
        // Purge Secure Cache
        try {
            await withTimeout(SecureStore.deleteItemAsync('last_known_profile'));
        } catch (e: any) {
            console.warn('[Auth] Cache deletion bypassed due to lock:', e.message);
        }
        
        // Force Supabase SignOut (local)
        await supabase.auth.signOut({ scope: 'local' });

        // Force UI Redirect
        if (navigationRef.isReady()) {
            navigationRef.reset({
                index: 0,
                routes: [{ name: 'Auth' }],
            });
        }
        
    } catch (err) {
        console.error('[Auth] Error during session purge:', err);
    }
};
