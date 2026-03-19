// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Cart Summary Bar: Floating cart bar at bottom of screens.
import React from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { ShoppingBag, ArrowRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

interface CartSummaryBarProps {
    itemCount: number;
    totalAmount: number;
}

export default function CartSummaryBar({ itemCount, totalAmount }: CartSummaryBarProps) {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    if (itemCount === 0) return null;

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate('Main', { screen: 'Cart' } as any);
    };

    return (
        <View className="absolute bottom-6 left-5 right-5 z-50">
            <TouchableOpacity
                delayPressIn={0}
                onPress={handlePress}
                activeOpacity={0.9}
                className="bg-brand h-16 rounded-2xl flex-row items-center px-5 shadow-xl shadow-brand/30"
            >
                <View className="flex-1 flex-row items-center">
                    <View className="w-10 h-10 rounded-xl bg-white/20 items-center justify-center">
                        <ShoppingBag size={20} color="white" strokeWidth={2.5} />
                    </View>
                    <View className="ml-4">
                        <Text className="text-white font-bold text-sm">{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</Text>
                        <Text className="text-white/80 text-[10px] font-bold uppercase tracking-wider">₹{totalAmount} plus taxes</Text>
                    </View>
                </View>

                <View className="flex-row items-center">
                    <Text className="text-white font-bold mr-2">View Cart</Text>
                    <ArrowRight size={18} color="white" strokeWidth={3} />
                </View>
            </TouchableOpacity>
        </View>
    );
}
