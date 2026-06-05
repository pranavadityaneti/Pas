// Foreground in-app toast for the consumer app.
//
// Mounted once at the app root (App.tsx). A module-level ref lets any code call
// showToast({...}) imperatively — useNotifications() fires it when a realtime
// INSERT lands on the user's notifications while the app is foregrounded.
//
// Adapted from the merchant app's NotificationToast: same animation + global-ref
// pattern, but swapped to the consumer's icon set (lucide) and React Navigation
// (navigationRef) instead of Ionicons + expo-router.
import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { CheckCircle2, ShoppingBag, Utensils, XCircle, Clock, Bell, X, Package, RefreshCw } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { navigationRef } from '../navigation/navigationRef';

const TOAST_DURATION = 4500; // auto-dismiss after 4.5s

// Keep type keys in sync with the server's consumer notification `type` values
// (apps/api/src/index.ts dispatch sites + scheduled-jobs.ts).
const TYPE_CONFIG: Record<string, { Icon: any; color: string; bg: string }> = {
    PAYMENT_SUCCESSFUL:    { Icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
    ORDER_CONFIRMED:       { Icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
    ORDER_COMPLETED:       { Icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' },
    ORDER_READY:           { Icon: ShoppingBag,  color: '#3B82F6', bg: '#EFF6FF' },
    DINING_BOOKED:         { Icon: Utensils,     color: '#10B981', bg: '#ECFDF5' },
    DINING_READY:          { Icon: Utensils,     color: '#3B82F6', bg: '#EFF6FF' },
    ORDER_CANCELLED:       { Icon: XCircle,      color: '#EF4444', bg: '#FEF2F2' },
    PICKUP_REMINDER_30MIN: { Icon: Clock,        color: '#F59E0B', bg: '#FFFBEB' },
    PICKUP_REMINDER_10MIN: { Icon: Clock,        color: '#F59E0B', bg: '#FFFBEB' },
    DINING_REMINDER_30MIN: { Icon: Clock,        color: '#F59E0B', bg: '#FFFBEB' },
    // Round-5: WS2 lifecycle notif types. Distinct colors so the customer
    // can tell at a glance whether a return/exchange is pending or decided.
    RETURN_REQUESTED:      { Icon: Package,      color: '#F97316', bg: '#FFF7ED' }, // orange — pending
    RETURN_DECISION:       { Icon: Package,      color: '#10B981', bg: '#ECFDF5' }, // green — resolved
    EXCHANGE_REQUESTED:    { Icon: RefreshCw,    color: '#8B5CF6', bg: '#F5F3FF' }, // violet — pending
    EXCHANGE_DECISION:     { Icon: RefreshCw,    color: '#10B981', bg: '#ECFDF5' }, // green — resolved
    DEFAULT:               { Icon: Bell,         color: '#6B7280', bg: '#F9FAFB' },
};

interface ToastData {
    title: string;
    body: string;
    type?: string;
}

let globalToastRef: ToastContainerHandle | null = null;

export function showToast(data: ToastData) {
    if (globalToastRef) globalToastRef.show(data);
}

export interface ToastContainerHandle {
    show: (data: ToastData) => void;
}

export const ToastContainer = forwardRef<ToastContainerHandle>((_, ref) => {
    const insets = useSafeAreaInsets();
    const [visible, setVisible] = useState(false);
    const [toastData, setToastData] = useState<ToastData | null>(null);
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const dismiss = useCallback(() => {
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }
        Animated.parallel([
            Animated.timing(translateY, { toValue: -150, duration: 300, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => {
            setVisible(false);
            setToastData(null);
        });
    }, [translateY, opacity]);

    const show = useCallback((data: ToastData) => {
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        setToastData(data);
        setVisible(true);
        translateY.setValue(-150);
        opacity.setValue(0);
        Animated.parallel([
            Animated.spring(translateY, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
        dismissTimer.current = setTimeout(dismiss, TOAST_DURATION);
    }, [translateY, opacity, dismiss]);

    useImperativeHandle(ref, () => ({ show }), [show]);

    useEffect(() => {
        globalToastRef = { show };
        return () => {
            globalToastRef = null;
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
    }, [show]);

    if (!visible || !toastData) return null;

    const config = TYPE_CONFIG[toastData.type?.toUpperCase() || 'DEFAULT'] || TYPE_CONFIG.DEFAULT;
    const Icon = config.Icon;

    return (
        <Animated.View style={[styles.container, { top: insets.top + 8, transform: [{ translateY }], opacity }]}>
            <TouchableOpacity
                style={[styles.toast, { borderLeftColor: config.color }]}
                activeOpacity={0.9}
                onPress={() => {
                    dismiss();
                    if (navigationRef.isReady()) {
                        try {
                            navigationRef.navigate('Notifications' as never);
                        } catch {
                            // no-op — navigation not ready / route missing
                        }
                    }
                }}
            >
                <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                    <Icon size={22} color={config.color} />
                </View>
                <View style={styles.content}>
                    <Text style={styles.title} numberOfLines={1}>{toastData.title}</Text>
                    <Text style={styles.body} numberOfLines={2}>{toastData.body}</Text>
                </View>
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={dismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
});

ToastContainer.displayName = 'ToastContainer';

const styles = StyleSheet.create({
    container: { position: 'absolute', left: 12, right: 12, zIndex: 99999, elevation: 99999 },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderLeftWidth: 4,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 },
            android: { elevation: 8 },
        }),
    },
    iconCircle: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    content: { flex: 1, marginRight: 8 },
    title: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 2 },
    body: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
    dismissButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
});
