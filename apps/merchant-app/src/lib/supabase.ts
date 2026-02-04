import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = 'https://llhxkonraqaxtradyycj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxsaHhrb25yYXFheHRyYWR5eWNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNTc5MDUsImV4cCI6MjA4NDczMzkwNX0.pZ5TxEEfPRiihRT3h4evAzvcSEUlz0YdhDzyMEqcdEk';

// Custom storage adapter for React Native using SecureStore
const ExpoSecureStoreAdapter = {
    getItem: async (key: string): Promise<string | null> => {
        try {
            if (Platform.OS === 'web') {
                return localStorage.getItem(key);
            }
            return await SecureStore.getItemAsync(key);
        } catch {
            return null;
        }
    },
    setItem: async (key: string, value: string): Promise<void> => {
        try {
            if (Platform.OS === 'web') {
                localStorage.setItem(key, value);
                return;
            }
            await SecureStore.setItemAsync(key, value);
        } catch {
            // Ignore errors
        }
    },
    removeItem: async (key: string): Promise<void> => {
        try {
            if (Platform.OS === 'web') {
                localStorage.removeItem(key);
                return;
            }
            await SecureStore.deleteItemAsync(key);
        } catch {
            // Ignore errors
        }
    },
};

import axios from 'axios';

// Custom fetch implementation using Axios to bypass RN fetch issues
const axiosFetch = async (url: string | any, options: any = {}) => {
    try {
        const response = await axios({
            url: url.toString(),
            method: options.method ? options.method : 'GET',
            headers: options.headers ? options.headers : {},
            data: options.body ? options.body : undefined,
            validateStatus: () => true, // Don't throw on error status
        });

        return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            headers: new Headers(response.headers as any),
            json: async () => response.data,
            text: async () => typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
            blob: async () => response.data,
        } as unknown as Response;
    } catch (error: any) {
        console.error('Supabase Axios Fetch Error:', error);
        throw new TypeError('Network request failed');
    }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // storage: ExpoSecureStoreAdapter, // Keep disabled for now
        autoRefreshToken: true,
        persistSession: false,
        detectSessionInUrl: false,
    },
    global: {
        fetch: axiosFetch, // Use our valid axios adapter
    }
});
