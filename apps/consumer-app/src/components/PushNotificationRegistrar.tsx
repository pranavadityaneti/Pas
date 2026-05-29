import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePushNotifications, deregisterPushToken } from '../hooks/usePushNotifications';

/**
 * Mount once at the app root, beneath <AuthProvider>.
 *
 * Two jobs:
 *   1. Calls usePushNotifications() — registers the user's push token with the
 *      backend when they're logged in.
 *   2. Watches for logout transitions (user.id: non-null → null) and calls
 *      deregisterPushToken so the server stops sending pushes to a device that
 *      just signed out. Avoids touching the locked AuthContext — we observe
 *      the same user state through useAuth() instead.
 */
export default function PushNotificationRegistrar() {
    const { user } = useAuth();
    const previousUserIdRef = useRef<string | null>(null);

    usePushNotifications();

    useEffect(() => {
        const previous = previousUserIdRef.current;
        const current = user?.id || null;

        // Detect logout: previously had a user, now don't.
        if (previous && !current) {
            console.log('[Push] Logout detected — deregistering push token for', previous);
            deregisterPushToken(previous).catch(e =>
                console.error('[Push] deregister on logout failed:', e)
            );
        }

        previousUserIdRef.current = current;
    }, [user?.id]);

    return null;
}
