import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, CommonActions } from '@react-navigation/native';
import { Clock, CheckCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { RootStackParamList } from '../navigation/types';
import * as Haptics from 'expo-haptics';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function WaitingRoomScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'WaitingRoomScreen'>>();
    const orderIds = route.params?.orderIds || [];
    
    // UI State
    const [acceptedOrders, setAcceptedOrders] = useState<string[]>([]);
    const [timeLeft, setTimeLeft] = useState(120);
    const [storeMetadata, setStoreMetadata] = useState<{id: string, name: string}[]>([]);
    const [isLoadingStores, setIsLoadingStores] = useState(true);

    // Fetch store names on mount
    useEffect(() => {
        const fetchStoreNames = async () => {
            if (!orderIds || orderIds.length === 0) {
                setIsLoadingStores(false);
                return;
            }
            try {
                // Try to fetch orders along with their store names.
                // Assuming foreign key to 'stores' table exists or 'store_name' is on the 'orders' table.
                const { data, error } = await supabase
                    .from('orders')
                    .select('id, store_id')
                    .in('id', orderIds);
                    
                if (error) throw error;

                if (data) {
                    const storeIds = [...new Set(data.map(d => d.store_id).filter(Boolean))];
                    const { data: stores, error: storesError } = await supabase
                        .from('stores')
                        .select('id, name')
                        .in('id', storeIds);
                    
                    const storesMap = new Map();
                    if (!storesError && stores) {
                        stores.forEach(s => storesMap.set(s.id, s.name));
                    }

                    const mapped = data.map(o => ({
                        id: o.id,
                        name: storesMap.get(o.store_id) || `Store #${o.store_id}`
                    }));
                    setStoreMetadata(mapped);
                }
            } catch (err) {
                console.warn("Could not fetch store metadata", err);
                const fallback = orderIds.map(id => ({ id, name: "Connecting Store..." }));
                setStoreMetadata(fallback);
            } finally {
                setIsLoadingStores(false);
            }
        };

        fetchStoreNames();
    }, [orderIds]);

    // Timer & Auto-Reject Logic
    useEffect(() => {
        if (!orderIds || orderIds.length === 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    // Time elapsed without acceptance -> trigger SwapScreen
                    navigation.replace('SwapScreen' as any);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [orderIds, navigation]);

    // Realtime Listener
    useEffect(() => {
        console.log("WAITING_ROOM_IDS:", orderIds);

        if (!orderIds || orderIds.length === 0) return;

        const channel = supabase.channel('waiting_room_status')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                (payload) => {
                    const newStatus = payload.new.status;
                    const orderId = payload.new.id;

                    if (orderIds.includes(orderId)) {
                        if (newStatus === 'CONFIRMED') {
                            setAcceptedOrders(prev => {
                                const nextState = prev.includes(orderId) ? prev : [...prev, orderId];
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                
                                if (nextState.length === orderIds.length) {
                                    navigation.replace('PaymentScreen' as any); 
                                }
                                return nextState;
                            });
                        } else if (newStatus === 'CANCELLED') {
                            navigation.replace('SwapScreen' as any);
                        }
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [orderIds, navigation]);

    // Cancel Request
    const handleCancel = () => {
        Alert.alert(
            "Cancel Request?",
            "Are you sure? Merchants might be preparing to accept your order.",
            [
                { text: "No, Keep Waiting", style: "cancel" },
                { 
                    text: "Yes, Cancel", 
                    style: "destructive", 
                    onPress: async () => {
                        try {
                            if (orderIds.length > 0) {
                                await supabase
                                    .from('orders')
                                    .update({ status: 'CANCELLED' })
                                    .in('id', orderIds);
                            }
                        } catch (err) {
                            console.warn("Failed to cancel orders", err);
                        }
                        navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }));
                    }
                }
            ]
        );
    };

    // Format timer
    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <SafeAreaView className="flex-1 bg-white p-6">
            <View className="flex-1 items-center justify-center">
                {/* Timer Display */}
                <View className="bg-orange-50 w-32 h-32 rounded-full items-center justify-center mb-6 border-4 border-orange-200">
                    <Text className="text-[32px] font-extrabold text-orange-600">
                        {formatTime(timeLeft)}
                    </Text>
                </View>
                
                <Text className="text-[24px] font-extrabold text-gray-900 mb-2 text-center">Orders Sent!</Text>
                <Text className="text-[15px] font-medium text-gray-500 text-center mb-10 leading-6 px-4">
                    Please wait while merchants confirm your items. This typically takes less than 2 minutes.
                </Text>

                {/* Live Store Checklist */}
                <View className="w-full bg-gray-50 rounded-2xl p-5 border border-gray-100 mb-8">
                    {isLoadingStores ? (
                        <ActivityIndicator color="#EA580C" size="small" />
                    ) : (
                        storeMetadata.map((store) => {
                            const isAccepted = acceptedOrders.includes(store.id);
                            return (
                                <View key={store.id} className="flex-row items-center justify-between mb-4 last:mb-0 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <Text className="text-[15px] font-bold text-gray-900 flex-1 pr-4" numberOfLines={1}>{store.name}</Text>
                                    <View className="flex-row items-center">
                                        {isAccepted ? (
                                            <>
                                                <Text className="text-[13px] font-bold text-green-600 mr-2">Store Accepted</Text>
                                                <CheckCircle size={20} color="#16A34A" />
                                            </>
                                        ) : (
                                            <>
                                                <Text className="text-[13px] font-medium text-gray-500 mr-2">Waiting...</Text>
                                                <View className="w-2.5 h-2.5 rounded-full bg-orange-400 opacity-60" />
                                            </>
                                        )}
                                    </View>
                                </View>
                            );
                        })
                    )}
                </View>

                {/* Safety & Cleanup */}
                <TouchableOpacity 
                    onPress={handleCancel}
                    className="mt-auto py-4"
                >
                    <Text className="text-gray-400 font-bold text-[15px] text-center">Cancel Request</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
