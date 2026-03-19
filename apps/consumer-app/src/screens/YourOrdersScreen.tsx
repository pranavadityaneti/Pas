import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    ActivityIndicator, RefreshControl, Platform, Image, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    ArrowLeftCircle, ShoppingBag, Clock, ChevronRight,
    MapPin, CheckCircle, Ticket
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { supabase } from '../lib/supabase';
import * as Haptics from 'expo-haptics';

export default function YourOrdersScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [orders, setOrders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (*)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchOrders();
    };

    const showOrderDetails = (order: any) => {
        const itemDetails = (order.order_items && order.order_items.length > 0)
            ? order.order_items
                .map((item: any) => `• ${item.product_name} (x${item.quantity}) - ₹${item.price * item.quantity}`)
                .join('\n')
            : 'No pre-ordered items (Table Reservation)';

        const moreInfo = [
            order.order_type === 'dine-in' ? `Arrival: ${order.arrival_time || 'ASAP'}` : null,
            order.order_type === 'dine-in' ? `Guests: ${order.guests_count || 1}` : null,
            order.special_instructions ? `Instructions: ${order.special_instructions}` : null
        ].filter(Boolean).join('\n');

        Alert.alert(
            `Order Details`,
            `Store: ${order.store_name}\nTotal: ₹${order.amount}\nOTP: ${order.otp_code || 'N/A'}\n${moreInfo ? `\n${moreInfo}\n` : ''}\nItems:\n${itemDetails}`,
            [{ text: "OK", style: "default" }]
        );
    };

    const StatusBadge = ({ status }: { status: string }) => {
        const colors: any = {
            PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
            CONFIRMED: 'bg-blue-50 text-blue-700 border-blue-100',
            PREPARING: 'bg-indigo-50 text-indigo-700 border-indigo-100',
            READY: 'bg-purple-50 text-purple-700 border-purple-100',
            COMPLETED: 'bg-green-50 text-green-700 border-green-100',
            CANCELLED: 'bg-red-50 text-red-700 border-red-100',
            pending: 'bg-amber-50 text-amber-700 border-amber-100',
            processing: 'bg-blue-50 text-blue-700 border-blue-100',
            completed: 'bg-green-50 text-green-700 border-green-100',
            cancelled: 'bg-red-50 text-red-700 border-red-100',
        };
        const colorClass = colors[status] || 'bg-gray-50 text-gray-700 border-gray-100';

        return (
            <View className={`${colorClass.split(' ')[0]} ${colorClass.split(' ')[2]} border px-2 py-0.5 rounded-lg`}>
                <Text className={`${colorClass.split(' ')[1]} text-[10px] font-bold uppercase tracking-wider`}>
                    {status}
                </Text>
            </View>
        );
    };

    if (loading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color="#B52725" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-gray-50" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-5 py-4 bg-white border-b border-gray-100">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="mr-4"
                >
                    <ArrowLeftCircle size={28} color="#1F2937" fill="white" />
                </TouchableOpacity>
                <Text className="text-[20px] font-bold text-gray-900">Your Orders</Text>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B52725" />
                }
            >
                {orders.length === 0 ? (
                    <View className="flex-1 items-center justify-center py-20">
                        <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
                            <ShoppingBag size={40} color="#D1D5DB" />
                        </View>
                        <Text className="text-lg font-bold text-gray-900">No orders yet</Text>
                        <Text className="text-gray-400 text-center mt-2 px-10">
                            Place your first pre-order from a store or restaurant to see it here!
                        </Text>
                        <TouchableOpacity
                            onPress={() => navigation.navigate('Main')}
                            className="mt-8 bg-[#B52725] px-8 py-3.5 rounded-2xl"
                        >
                            <Text className="text-white font-bold">Start Exploring</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    orders.map((order) => (
                        <TouchableOpacity
                            key={order.id}
                            className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm"
                            activeOpacity={0.7}
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View className="flex-1 mr-4">
                                    <View className="flex-row items-center mb-1">
                                        <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mr-2">
                                            {order.order_type === 'dine-in' && order.items_count === 0
                                                ? 'Table Reservation'
                                                : order.order_type === 'dine-in'
                                                    ? 'Dine-in Pre-order'
                                                    : 'Store Pickup'}
                                        </Text>
                                        <StatusBadge status={order.status} />
                                    </View>
                                    <Text className="text-[17px] font-bold text-gray-900" numberOfLines={1}>
                                        {order.store_name}
                                    </Text>
                                </View>
                                <Text className="text-[16px] font-bold text-gray-900">₹{order.amount}</Text>
                            </View>

                            <View className="flex-row items-center mb-4">
                                <Clock size={14} color="#9CA3AF" />
                                <Text className="ml-2 text-gray-500 text-[13px] font-medium">
                                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })} • {new Date(order.created_at).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                            </View>

                            {/* Arrival & Guests for dining orders */}
                            {order.order_type === 'dine-in' && order.arrival_time && (
                                <View className="flex-row items-center mb-3">
                                    <MapPin size={14} color="#9CA3AF" />
                                    <Text className="ml-2 text-gray-500 text-[13px] font-medium">
                                        {order.arrival_time}{order.guests_count ? ` • ${order.guests_count} ${order.guests_count === 1 ? 'guest' : 'guests'}` : ''}
                                    </Text>
                                </View>
                            )}

                            <View className="bg-gray-50 rounded-2xl p-4 flex-row items-center justify-between border border-gray-100">
                                <View className="flex-row items-center">
                                    <View className="w-8 h-8 rounded-full bg-white items-center justify-center border border-gray-200">
                                        <Ticket size={16} color="#B52725" />
                                    </View>
                                    <View className="ml-3">
                                        <Text className="text-[10px] font-bold text-gray-400 uppercase">OTP PIN</Text>
                                        <Text className="text-[16px] font-bold text-gray-900 tracking-[2px]">{order.otp_code || '----'}</Text>
                                    </View>
                                </View>
                                <ChevronRight size={18} color="#D1D5DB" />
                            </View>

                            <TouchableOpacity
                                className="mt-4 pt-4 border-t border-gray-50 flex-row justify-between"
                                onPress={() => showOrderDetails(order)}
                            >
                                <Text className="text-gray-400 text-xs font-medium">
                                    {order.items_count > 0 ? `${order.items_count} ${order.items_count === 1 ? 'item' : 'items'}` : 'Table Reservation'}
                                </Text>
                                <Text className="text-[#B52725] text-xs font-bold uppercase tracking-wider">
                                    View Details
                                </Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
