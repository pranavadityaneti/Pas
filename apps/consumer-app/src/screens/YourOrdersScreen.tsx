import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView,
    ActivityIndicator, RefreshControl, Platform, Image, Alert, Linking
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

        let subscription: any = null;
        
        const setupRealtime = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            subscription = supabase
                .channel('schema-db-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'orders',
                        filter: `user_id=eq.${user.id}`,
                    },
                    (payload) => {
                        console.log('Realtime Order Update received:', payload);
                        fetchOrders();
                    }
                )
                .subscribe();
        };

        setupRealtime();

        return () => {
            if (subscription) {
                supabase.removeChannel(subscription);
            }
        };
    }, []);

    const fetchOrders = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('orders')
                .select(`
                    *,
                    order_items (*),
                    branch:merchant_branches(address, city, phone, manager_name)
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

    const getStatusDisplay = (status: string, orderType?: string) => {
        const normalized = (status || '').toUpperCase();
        const isDining = orderType === 'dine-in';
        
        if (normalized === 'PENDING') return { text: 'CONFIRMED', bg: 'bg-black', textClass: 'text-white' };
        if (normalized === 'ACCEPTED' || normalized === 'READY') {
            return isDining 
                ? { text: 'RESERVED', bg: 'bg-blue-100', textClass: 'text-blue-800' }
                : { text: 'PREPARING', bg: 'bg-yellow-400', textClass: 'text-black' };
        }
        if (normalized === 'COMPLETED' || normalized === 'DELIVERED') return { text: 'COMPLETED', bg: 'bg-green-100', textClass: 'text-green-800' };
        return { text: 'CANCELLED', bg: 'bg-red-100', textClass: 'text-red-800' }; // Fallback
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
                    orders.map((order) => {
                        console.log("ORDER STATUS DEBUG:", order.id, "STATUS:", order.status);
                        const statusConfig = getStatusDisplay(order.status, order.order_type);
                        return (
                        <TouchableOpacity
                            key={order.id}
                            className="bg-white rounded-3xl p-5 mb-5 border border-gray-100 shadow-sm"
                            activeOpacity={0.7}
                        >
                            {/* Block 1: Header */}
                            <View className="bg-[#B52725] rounded-xl p-4 flex-row items-center justify-between mb-4">
                                <View className="flex-row items-center flex-1">
                                    <View className="w-10 h-10 bg-white/20 rounded-full items-center justify-center mr-3 shadow-sm">
                                        <ShoppingBag size={20} color="white" />
                                    </View>
                                    <View className="flex-1 pr-2">
                                        <Text className="text-[18px] font-bold text-white" numberOfLines={1}>{order.store_name}</Text>
                                        <Text className="text-[13px] text-red-50 font-medium mt-0.5">
                                            {order.order_type === 'dine-in' ? 'Booking' : 'Pickup'}: {order.arrival_time || 'ASAP'}
                                        </Text>
                                    </View>
                                </View>
                                <View className={`px-3 py-1 rounded-full ${statusConfig.bg}`}>
                                    <Text className={`text-[12px] font-extrabold uppercase ${statusConfig.textClass}`}>
                                        {statusConfig.text}
                                    </Text>
                                </View>
                            </View>

                            {/* Block 2: Financials & Order Number */}
                            <View className="px-1 mb-4">
                                <View className="flex-row justify-between items-center mb-2">
                                    <Text className="text-[14px] text-gray-500 font-medium">Order #</Text>
                                    <Text className="text-[14px] text-gray-900 font-mono font-bold">{order.order_number}</Text>
                                </View>
                                {order.order_type !== 'dine-in' && (
                                    <View className="flex-row justify-between items-center mb-1">
                                        <Text className="text-[13px] text-gray-500 font-medium">GST (5%)</Text>
                                        <Text className="text-[13px] text-gray-500 font-medium">₹{(order.amount * 0.05).toFixed(2)}</Text>
                                    </View>
                                )}
                                <View className="flex-row justify-between items-center mb-3">
                                    <Text className="text-[15px] font-bold text-gray-900">
                                        {order.order_type === 'dine-in' ? 'Booking Deposit' : 'Total'}
                                    </Text>
                                    <Text className="text-[18px] font-bold text-gray-900">₹{order.order_type === 'dine-in' ? order.amount : (order.amount * 1.05).toFixed(2)}</Text>
                                </View>
                                <View className="border-b border-gray-100" />
                            </View>

                            {/* Block 3: Order Details (food) OR Reservation Details (dine-in) */}
                            {order.order_type === 'dine-in' ? (
                                <View className="px-1 mb-4">
                                    <Text className="text-[13px] text-gray-500 font-bold uppercase tracking-wider mb-3">Reservation Details</Text>
                                    <View className="flex-row items-center mb-2">
                                        <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-3" />
                                        <Text className="text-[14px] text-gray-700 font-medium flex-1">
                                            {order.guests_count || 1} {(order.guests_count || 1) === 1 ? 'Guest' : 'Guests'}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center mb-2">
                                        <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-3" />
                                        <Text className="text-[14px] text-gray-700 font-medium flex-1">
                                            Arrival: {order.arrival_time || 'Not specified'}
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="px-1 mb-4">
                                    <Text className="text-[13px] text-gray-500 font-bold uppercase tracking-wider mb-3">Order Details</Text>
                                    {order.order_items && order.order_items.map((item: any, idx: number) => (
                                        <View key={idx} className="flex-row items-center mb-2">
                                            <View className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-3" />
                                            <Text className="text-[14px] text-gray-700 font-medium flex-1">{item.quantity}x {item.product_name}</Text>
                                            <Text className="text-[14px] text-gray-900 font-semibold">₹{item.price * item.quantity}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            {/* Block 4: Contact & Location */}
                            <View className="border-b border-gray-100 mb-4" />
                            <View className="px-1 mb-4">
                                {order.branch && (
                                    <>
                                        <TouchableOpacity onPress={() => {
                                            const encodedAddress = encodeURIComponent(`${order.branch.address}, ${order.branch.city}`);
                                            Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
                                        }}>
                                            <Text className="text-[14px] text-blue-600 font-bold mb-1" numberOfLines={2}>
                                                <MapPin size={14} color="#2563EB" /> {order.branch.address}{order.branch.city ? `, ${order.branch.city}` : ''}
                                            </Text>
                                        </TouchableOpacity>
                                        <Text className="text-[13px] text-gray-500 font-medium mt-1">Manager: {order.branch.manager_name || 'N/A'}</Text>
                                        <Text className="text-[13px] text-gray-500 font-medium mt-0.5">Phone: {order.branch.phone || 'N/A'}</Text>
                                    </>
                                )}
                            </View>

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
                            </View>
                        </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
