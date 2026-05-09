import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
    const registrationAttempted = useRef(false);

    useEffect(() => {
        // Prevent duplicate registration on re-renders
        if (registrationAttempted.current) return;
        registrationAttempted.current = true;

        registerForPushNotifications();
    }, []);

    async function registerForPushNotifications() {
        try {
            // 1. Physical device check — simulators cannot generate push tokens
            if (!Device.isDevice) {
                console.warn('[Push] Not a physical device — skipping token registration');
                return;
            }

            // 2. Configure Android notification channel (required for Android 8+)
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('orders', {
                    name: 'Order Alerts',
                    importance: Notifications.AndroidImportance.MAX,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                    lightColor: '#F6C344',
                });
            }

            // 3. Check existing permissions
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            // 4. Request if not yet determined
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }

            setPermissionStatus(finalStatus);

            if (finalStatus !== 'granted') {
                console.log('[Push] Permission denied by user');
                return;
            }

            // 5. Generate Expo push token
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (!projectId) {
                console.error('[Push] EAS projectId not found in app.json — cannot generate token');
                return;
            }

            let token: string;
            try {
                const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
                token = tokenData.data;
            } catch (tokenError: any) {
                // Expo Go on Android (SDK 53+) cannot generate push tokens.
                // This is expected — push only works in development/production builds.
                console.warn('[Push] Cannot generate token (likely Expo Go):', tokenError.message);
                return;
            }

            console.log('[Push] Token generated:', token.substring(0, 30) + '...');
            setExpoPushToken(token);

            // 6. Persist locally (needed for logout deregistration)
            await AsyncStorage.setItem('expo_push_token', token);

            // 7. Register with backend
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.warn('[Push] No auth user — skipping backend registration');
                return;
            }

            const response = await fetch(`${API_URL}/push-tokens/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    expoPushToken: token,
                    platform: Platform.OS,
                }),
            });

            if (response.ok) {
                console.log('[Push] Token registered with backend successfully');
            } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('[Push] Backend registration failed:', response.status, errorData);
            }
        } catch (error) {
            console.error('[Push] Registration error:', error);
        }
    }

    return { expoPushToken, permissionStatus };
}

/**
 * Call this BEFORE supabase.auth.signOut() during logout.
 * Deactivates the push token on the backend so the user stops receiving notifications.
 */
export async function deregisterPushToken(): Promise<void> {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const savedToken = await AsyncStorage.getItem('expo_push_token');

        if (user && savedToken) {
            await fetch(`${API_URL}/push-tokens/deregister`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.id,
                    expoPushToken: savedToken,
                }),
            });
            await AsyncStorage.removeItem('expo_push_token');
            console.log('[Push] Token deregistered successfully');
        }
    } catch (error) {
        // Non-blocking — don't prevent logout if this fails
        console.error('[Push] Deregistration failed:', error);
    }
}
