import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SCREEN_WIDTH = Dimensions.get('window').width;
const TOAST_DURATION = 4500; // Auto-dismiss after 4.5s

// --- Type Map for icon + accent color ---
// Canonical UPPERCASE notification types — matches what the server emits.
// Keep in sync with NotificationType in useNotifications.ts and getIcon in app/(main)/notifications.tsx.
const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
    NEW_ORDER:          { icon: 'receipt',           color: '#10B981', bg: '#ECFDF5' },
    NEW_ORDER_REQUEST:  { icon: 'file-tray',         color: '#10B981', bg: '#ECFDF5' },
    ORDER_CANCELLED:    { icon: 'close-circle',      color: '#EF4444', bg: '#FEF2F2' },
    CANCELLED:          { icon: 'close-circle',      color: '#EF4444', bg: '#FEF2F2' },
    COMPLETED:          { icon: 'checkmark-circle',  color: '#10B981', bg: '#ECFDF5' },
    READY:              { icon: 'bag-check',         color: '#3B82F6', bg: '#EFF6FF' },
    ORDER_UPDATE:       { icon: 'refresh-circle',    color: '#8B5CF6', bg: '#F5F3FF' },
    LOW_STOCK:          { icon: 'warning',           color: '#F59E0B', bg: '#FFFBEB' },
    RIDER_ARRIVED:      { icon: 'bicycle',           color: '#06B6D4', bg: '#ECFEFF' },
    DEFAULT:            { icon: 'notifications',     color: '#6B7280', bg: '#F9FAFB' },
};

interface ToastData {
    title: string;
    body: string;
    type?: string;
}

// --- Global ref for imperative showToast() calls ---
let globalToastRef: ToastContainerHandle | null = null;

export function showToast(data: ToastData) {
    if (globalToastRef) {
        globalToastRef.show(data);
    }
}

export interface ToastContainerHandle {
    show: (data: ToastData) => void;
}

// --- Toast Container (mount once at root) ---
export const ToastContainer = forwardRef<ToastContainerHandle>((_, ref) => {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [visible, setVisible] = useState(false);
    const [toastData, setToastData] = useState<ToastData | null>(null);
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const dismissTimer = useRef<NodeJS.Timeout | null>(null);

    const dismiss = useCallback(() => {
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
            dismissTimer.current = null;
        }
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -150,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start(() => {
            setVisible(false);
            setToastData(null);
        });
    }, [translateY, opacity]);

    const show = useCallback((data: ToastData) => {
        // If already showing, dismiss first then show new
        if (dismissTimer.current) {
            clearTimeout(dismissTimer.current);
        }

        setToastData(data);
        setVisible(true);

        // Reset position
        translateY.setValue(-150);
        opacity.setValue(0);

        // Animate in with spring
        Animated.parallel([
            Animated.spring(translateY, {
                toValue: 0,
                tension: 80,
                friction: 10,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start();

        // Auto-dismiss
        dismissTimer.current = setTimeout(dismiss, TOAST_DURATION);
    }, [translateY, opacity, dismiss]);

    // Expose show() via ref
    useImperativeHandle(ref, () => ({ show }), [show]);

    // Register global ref
    useEffect(() => {
        globalToastRef = { show };
        return () => {
            globalToastRef = null;
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
        };
    }, [show]);

    if (!visible || !toastData) return null;

    const typeKey = toastData.type?.toUpperCase() || 'DEFAULT';
    const config = TYPE_CONFIG[typeKey] || TYPE_CONFIG.DEFAULT;

    return (
        <Animated.View
            style={[
                styles.container,
                {
                    top: insets.top + 8,
                    transform: [{ translateY }],
                    opacity,
                },
            ]}
        >
            <TouchableOpacity
                style={[styles.toast, { borderLeftColor: config.color }]}
                activeOpacity={0.9}
                onPress={() => {
                    dismiss();
                    router.push('/(main)/notifications');
                }}
            >
                <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                    <Ionicons name={config.icon as any} size={22} color={config.color} />
                </View>
                <View style={styles.content}>
                    <Text style={styles.title} numberOfLines={1}>
                        {toastData.title}
                    </Text>
                    <Text style={styles.body} numberOfLines={2}>
                        {toastData.body}
                    </Text>
                </View>
                <TouchableOpacity
                    style={styles.dismissButton}
                    onPress={dismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <Ionicons name="close" size={18} color="#9CA3AF" />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
});

ToastContainer.displayName = 'ToastContainer';

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 12,
        right: 12,
        zIndex: 99999,
        elevation: 99999,
    },
    toast: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        borderLeftWidth: 4,
        ...Platform.select({
            ios: {
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
            },
            android: {
                elevation: 8,
            },
        }),
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 2,
    },
    body: {
        fontSize: 13,
        color: '#6B7280',
        lineHeight: 18,
    },
    dismissButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
