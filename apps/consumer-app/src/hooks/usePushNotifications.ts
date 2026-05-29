import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { navigateForNotification } from '../lib/notificationRoute';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
const STORAGE_KEY = 'consumer_expo_push_token';

// Foreground presentation: suppress the OS heads-up BANNER while the app is open.
// We show our own in-app toast (NotificationToast) on the realtime INSERT instead,
// so the user doesn't get a doubled banner + toast. We still log to the OS list/tray,
// keep the app-icon badge, and allow the sound. Background/killed delivery is
// unaffected (the OS shows those normally — this handler only governs foreground).
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export function usePushNotifications() {
    const { user } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
    const [permissionStatus, setPermissionStatus] = useState<string | null>(null);
    // Track which userId we last registered for; re-register on user change (logout → login as another)
    const registeredUserIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        if (registeredUserIdRef.current === user.id) return;
        // Do NOT set the ref yet — only mark this userId as "done" after
        // backend registration actually succeeds. Otherwise transient failures
        // (permission denied, network blip, missing projectId, Expo error) would
        // permanently lock out future retries on this device.
        registerForPushNotifications(user.id);
    }, [user?.id]);

    // Step 5 — deep-link when the user TAPS an OS push notification.
    // The server attaches { type, referenceId, link } to the push `data` payload
    // (see sendConsumerNotification in apps/api/src/services/notification.service.ts).
    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
            const data: any = response?.notification?.request?.content?.data || {};
            navigateForNotification({ type: data.type, link: data.link, reference_id: data.referenceId });
        });

        // Cold start: app launched by tapping a notification while it was killed.
        Notifications.getLastNotificationResponseAsync()
            .then((response) => {
                if (!response) return;
                const data: any = response.notification.request.content.data || {};
                navigateForNotification({ type: data.type, link: data.link, reference_id: data.referenceId });
            })
            .catch(() => { /* no-op */ });

        return () => {
            sub.remove();
        };
    }, []);

    async function registerForPushNotifications(userId: string) {
        try {
            // 1. Physical device check — simulators cannot generate push tokens
            if (!Device.isDevice) {
                console.warn('[Push] Not a physical device — skipping token registration');
                return;
            }

            // 2. Configure Android notification channel (required for Android 8+).
            //    Sound is hardcoded to 'default' for now; per-customer sound selection
            //    can be added later in the same way the merchant app has its sound prefs.
            if (Platform.OS === 'android') {
                await Notifications.setNotificationChannelAsync('orders', {
                    name: 'Order Updates',
                    importance: Notifications.AndroidImportance.HIGH,
                    vibrationPattern: [0, 250, 250, 250],
                    sound: 'default',
                });
            }

            // 3. Check existing permissions, request if not granted yet
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            setPermissionStatus(finalStatus);

            if (finalStatus !== 'granted') {
                console.log('[Push] Permission denied by user — token registration skipped');
                return;
            }

            // 4. Generate Expo push token
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

            // 5. Persist locally (needed for logout deregistration)
            await AsyncStorage.setItem(STORAGE_KEY, token);

            // 6. Compute a stable deviceId for multi-device dedupe (mirrors merchant C2 fix)
            const deviceId = Device.osBuildId
                || `${Device.modelName ?? 'unknown'}-${Device.osVersion ?? 'unknown'}`;

            // 7. Register with backend (reuses the existing endpoint shared with the merchant app)
            const response = await fetch(`${API_URL}/push-tokens/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    expoPushToken: token,
                    platform: Platform.OS,
                    deviceId,
                }),
            });

            if (response.ok) {
                console.log('[Push] Token registered with backend successfully');
                // ONLY mark this userId as "done" after successful backend registration.
                // Subsequent renders for the same userId become no-ops; logout + re-login
                // as a different user re-fires the effect because the ref no longer matches.
                registeredUserIdRef.current = userId;
            } else {
                const errorBody = await response.json().catch(() => ({}));
                console.error('[Push] Backend registration failed:', response.status, errorBody);
                // Leave registeredUserIdRef unchanged so the next app launch will retry.
            }
        } catch (error) {
            console.error('[Push] Registration error:', error);
            // Leave registeredUserIdRef unchanged so the next app launch will retry.
        }
    }

    return { expoPushToken, permissionStatus };
}

/**
 * Call this BEFORE supabase.auth.signOut() during logout.
 * Deactivates the push token on the backend so the user stops receiving notifications.
 * Non-blocking — logout proceeds even if this fails.
 */
export async function deregisterPushToken(userId: string): Promise<void> {
    try {
        const savedToken = await AsyncStorage.getItem(STORAGE_KEY);
        if (!userId || !savedToken) return;

        await fetch(`${API_URL}/push-tokens/deregister`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, expoPushToken: savedToken }),
        });
        await AsyncStorage.removeItem(STORAGE_KEY);
        console.log('[Push] Token deregistered successfully');
    } catch (error) {
        // Non-blocking — don't prevent logout if this fails
        console.error('[Push] Deregistration failed:', error);
    }
}
