// Maps a notification (by type) to a consumer-app React Navigation target.
//
// Why type-based and not the server `link`: the server writes paths like
// `/orders/<id>` (an Expo-Router-style string used by the merchant app). The
// consumer app uses React Navigation screen *names*, not path routes, so we map
// by notification type instead. For v1 every order-related notification opens the
// "Your Orders" list — finer deep-linking to a specific order detail waits on the
// OrderDetail screen rework (post-brand-team architecture work).
import { navigationRef } from '../navigation/navigationRef';

export type NotifLike = {
    type?: string | null;
    link?: string | null;
    reference_id?: string | null;
};

/** Pure mapper — returns the React Navigation target, or null if no nav is appropriate. */
export function routeForNotification(n: NotifLike): { screen: string; params?: any } | null {
    switch ((n.type || '').toUpperCase()) {
        case 'ORDER_CONFIRMED':
        case 'PAYMENT_SUCCESSFUL':
        case 'ORDER_READY':
        case 'DINING_READY':
        case 'DINING_BOOKED':
        case 'ORDER_COMPLETED':
        case 'ORDER_CANCELLED':
        case 'PICKUP_REMINDER_30MIN':
        case 'PICKUP_REMINDER_10MIN':
        case 'DINING_REMINDER_30MIN':
            return { screen: 'YourOrders' };
        default:
            // Every notification today is order-related, so a tap should always
            // land somewhere useful. Default to the orders list rather than a no-op.
            // (Revisit when non-order notification types — promos, referrals — exist.)
            return { screen: 'YourOrders' };
    }
}

/**
 * Navigate using the global navigationRef. Used from contexts that live OUTSIDE
 * a screen (the foreground toast, the OS push-tap listener) where useNavigation()
 * isn't available. Best-effort + guarded so a cold-start race can't crash.
 */
export function navigateForNotification(n: NotifLike): void {
    const route = routeForNotification(n);
    if (route && navigationRef.isReady()) {
        try {
            // navigationRef is created with <any>; cast the call to sidestep the
            // strict overload tuple-typing on the container ref's navigate().
            (navigationRef as any).navigate(route.screen, route.params);
        } catch (e: any) {
            console.warn('[Notif] navigate failed:', e?.message || e);
        }
    }
}
