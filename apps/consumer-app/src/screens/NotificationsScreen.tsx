// Consumer notification inbox. Reached from the bell in GlobalHeader (and from
// the foreground toast / OS push tap). Reads from NotificationContext; tapping a
// row marks it read and deep-links via routeForNotification.
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Bell, BellOff, CheckCircle2, ShoppingBag, Utensils, XCircle, Clock, Package, RefreshCw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNotificationContext } from '../context/NotificationContext';
import { routeForNotification } from '../lib/notificationRoute';
import type { ConsumerNotification } from '../hooks/useNotifications';
import type { RootStackParamList } from '../navigation/types';

const PRIMARY = '#B52725';

function iconForType(type: string): { Icon: any; color: string; bg: string } {
    switch ((type || '').toUpperCase()) {
        case 'PAYMENT_SUCCESSFUL':
        case 'ORDER_CONFIRMED':
        case 'ORDER_COMPLETED':
            return { Icon: CheckCircle2, color: '#10B981', bg: '#ECFDF5' };
        case 'ORDER_READY':
            return { Icon: ShoppingBag, color: '#3B82F6', bg: '#EFF6FF' };
        case 'DINING_BOOKED':
            return { Icon: Utensils, color: '#10B981', bg: '#ECFDF5' };
        case 'DINING_READY':
            return { Icon: Utensils, color: '#3B82F6', bg: '#EFF6FF' };
        case 'ORDER_CANCELLED':
            return { Icon: XCircle, color: '#EF4444', bg: '#FEF2F2' };
        case 'PICKUP_REMINDER_30MIN':
        case 'PICKUP_REMINDER_10MIN':
        case 'DINING_REMINDER_30MIN':
            return { Icon: Clock, color: '#F59E0B', bg: '#FFFBEB' };
        // Round-5: WS2 lifecycle notif types — themed by lifecycle stage.
        case 'RETURN_REQUESTED':
            return { Icon: Package, color: '#F97316', bg: '#FFF7ED' };
        case 'RETURN_DECISION':
            return { Icon: Package, color: '#10B981', bg: '#ECFDF5' };
        case 'EXCHANGE_REQUESTED':
            return { Icon: RefreshCw, color: '#8B5CF6', bg: '#F5F3FF' };
        case 'EXCHANGE_DECISION':
            return { Icon: RefreshCw, color: '#10B981', bg: '#ECFDF5' };
        default:
            return { Icon: Bell, color: '#6B7280', bg: '#F3F4F6' };
    }
}

function timeAgo(iso: string): string {
    const then = new Date(iso).getTime();
    if (isNaN(then)) return '';
    const diffMins = Math.floor((Date.now() - then) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export default function NotificationsScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const { notifications, loading, unreadCount, markAsRead, markAllAsRead, refetch } = useNotificationContext();
    const [refreshing, setRefreshing] = useState(false);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await refetch();
        setRefreshing(false);
    }, [refetch]);

    const handlePress = useCallback(
        async (n: ConsumerNotification) => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (!n.is_read) await markAsRead(n.id);
            const route = routeForNotification({ type: n.type, link: n.link, reference_id: n.reference_id });
            if (route) {
                try {
                    navigation.navigate(route.screen as any, route.params as any);
                } catch (e: any) {
                    console.warn('[Notif tap] nav failed:', e?.message || e);
                }
            }
        },
        [markAsRead, navigation]
    );

    const renderItem = ({ item }: { item: ConsumerNotification }) => {
        const { Icon, color, bg } = iconForType(item.type);
        return (
            <TouchableOpacity
                onPress={() => handlePress(item)}
                activeOpacity={0.85}
                className="flex-row bg-white rounded-2xl p-4 mb-3"
                style={!item.is_read ? { borderLeftWidth: 4, borderLeftColor: PRIMARY } : undefined}
            >
                <View className="w-11 h-11 rounded-full items-center justify-center mr-3" style={{ backgroundColor: bg }}>
                    <Icon size={20} color={color} />
                </View>
                <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-gray-900 mb-1">{item.title}</Text>
                    <Text className="text-[13px] text-gray-500 mb-1.5">{item.message}</Text>
                    <Text className="text-[11px] text-gray-400">{timeAgo(item.created_at)}</Text>
                </View>
                {!item.is_read && <View className="w-2 h-2 rounded-full mt-1.5" style={{ backgroundColor: PRIMARY }} />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }} edges={['top']}>
            <View className="flex-row items-center justify-between px-5 py-4 bg-white">
                <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <ArrowLeft size={24} color="#111827" />
                </TouchableOpacity>
                <Text className="text-[20px] font-bold text-gray-900">Notifications</Text>
                {unreadCount > 0 ? (
                    <TouchableOpacity onPress={markAllAsRead} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Text className="text-[13px] font-semibold" style={{ color: PRIMARY }}>Mark all read</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 24 }} />
                )}
            </View>

            {loading ? (
                <View className="flex-1 items-center justify-center">
                    <ActivityIndicator size="large" color={PRIMARY} />
                </View>
            ) : (
                <FlatList
                    data={notifications}
                    keyExtractor={(n) => n.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, flexGrow: 1 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PRIMARY} />}
                    ListEmptyComponent={
                        <View className="flex-1 items-center justify-center pt-24">
                            <BellOff size={56} color="#E5E7EB" />
                            <Text className="text-[15px] text-gray-400 mt-4">No notifications yet</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}
