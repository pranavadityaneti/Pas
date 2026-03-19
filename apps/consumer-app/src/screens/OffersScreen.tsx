import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Image, Dimensions, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, CheckCircle, Tag, Search, Info, Percent, CreditCard } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

const AVAILABLE_COUPONS = [
    {
        code: 'PASFIRST',
        discount: 100,
        description: 'Flat ₹100 off on your first order',
        minOrder: 500,
        type: 'Flat',
        category: 'RESTAURANT',
        color: '#E11D48' // Rose 600
    },
    {
        code: 'SUNDAY50',
        discount: 50,
        description: '₹50 off on lazy Sundays',
        minOrder: 299,
        type: 'Flat',
        category: 'RESTAURANT',
        color: '#F59E0B' // Amber 500
    },
    {
        code: 'HUNGRY20',
        discount: 0.20,
        description: '20% off up to ₹100',
        isPercentage: true,
        maxDiscount: 100,
        minOrder: 400,
        type: 'Percentage',
        category: 'RESTAURANT',
        color: '#059669' // Emerald 600
    },
    {
        code: 'VISA250',
        discount: 250,
        description: 'Get flat ₹250 off using Visa Platinum Cards',
        minOrder: 1200,
        type: 'Bank',
        category: 'PAYMENT',
        color: '#2563EB' // Blue 600
    },
    {
        code: 'GPAY75',
        discount: 75,
        description: 'Get flat ₹75 off using Google Pay UPI',
        minOrder: 499,
        type: 'UPI',
        category: 'PAYMENT',
        color: '#7C3AED' // Violet 600
    },
];

export default function OffersScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<RouteProp<RootStackParamList, 'Offers'>>();
    const { subtotal } = route.params;
    const [manualCode, setManualCode] = useState('');

    const handleApplyCoupon = (coupon: any) => {
        if (subtotal < coupon.minOrder) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            alert(`Add ₹${coupon.minOrder - subtotal} more to avail this offer!`);
            return;
        }

        let disc = 0;
        if (coupon.isPercentage) {
            disc = Math.min(Math.round(subtotal * (coupon.discount as number)), coupon.maxDiscount || 999);
        } else {
            disc = coupon.discount as number;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('Main' as any, {
            screen: 'Cart',
            params: {
                selectedCoupon: {
                    code: coupon.code,
                    discount: disc
                }
            }
        });
    };
    const restaurantOffers = AVAILABLE_COUPONS.filter(c => c.category === 'RESTAURANT');
    const paymentOffers = AVAILABLE_COUPONS.filter(c => c.category === 'PAYMENT');

    const OfferCard = ({ coupon }: { coupon: any }) => (
        <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handleApplyCoupon(coupon)}
            className="bg-white rounded-2xl mb-4 overflow-hidden border border-gray-100 shadow-sm flex-row h-[100px]"
        >
            {/* Left Side: Brand Stub */}
            <View
                className="w-[75px] items-center justify-center relative"
                style={{ backgroundColor: coupon.color + '15' }}
            >
                <View className="bg-white rounded-full p-2 shadow-sm border border-gray-50">
                    {coupon.category === 'PAYMENT' ? (
                        <CreditCard size={20} color={coupon.color} fill={coupon.color + '20'} />
                    ) : (
                        <Tag size={20} color={coupon.color} fill={coupon.color + '20'} />
                    )}
                </View>

                {/* Inner Left Cutout */}
                <View
                    className="absolute left-[-10px] w-[20px] h-[20px] rounded-full bg-[#F8F9FA]"
                    style={{ top: '50%', marginTop: -10 }}
                />
            </View>

            {/* Ticket Divider */}
            <View className="w-[1px] relative items-center">
                <View
                    className="absolute top-[-8px] w-[16px] h-[16px] rounded-full bg-[#F8F9FA]"
                    style={{ left: -8, zIndex: 10 }}
                />
                <View className="flex-1 border-l border-dashed border-gray-200 my-2" />
                <View
                    className="absolute bottom-[-8px] w-[16px] h-[16px] rounded-full bg-[#F8F9FA]"
                    style={{ left: -8, zIndex: 10 }}
                />
            </View>

            {/* Right Side: Info Section */}
            <View className="flex-1 px-4 py-3 justify-between relative bg-white">
                <View className="flex-row justify-between items-start">
                    <View className="flex-1 mr-2">
                        <Text className="text-[18px] font-bold leading-tight" style={{ color: coupon.color }}>
                            {coupon.isPercentage ? `${coupon.discount * 100}% OFF` : `₹${coupon.discount} OFF`}
                        </Text>
                        <View className="flex-row items-center mt-0.5">
                            <View className="px-1.5 py-0.5 rounded-md bg-gray-50 border border-gray-100 mr-2">
                                <Text className="text-[8px] font-bold text-gray-500 uppercase tracking-tighter">
                                    {coupon.category === 'PAYMENT' ? 'Payment' : 'Platform'}
                                </Text>
                            </View>
                            <Text className="text-[13px] font-bold text-gray-400 tracking-wider uppercase">
                                {coupon.code}
                            </Text>
                        </View>
                    </View>
                    <View className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Text className="text-[12px] font-bold text-[#B52725] uppercase">Apply</Text>
                    </View>
                </View>

                <View className="flex-row items-center">
                    <Info size={10} color="#9CA3AF" />
                    <Text className="text-[11px] font-medium text-gray-400 ml-1.5 flex-1" numberOfLines={1}>
                        {coupon.description}
                    </Text>
                </View>

                {/* Inner Right Cutout */}
                <View
                    className="absolute right-[-10px] w-[20px] h-[20px] rounded-full bg-[#F8F9FA]"
                    style={{ top: '50%', marginTop: -10 }}
                />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView className="flex-1 bg-[#F8F9FA]">
            {/* Header */}
            <View className="bg-white px-5 py-4 border-b border-gray-100 flex-row items-center">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="w-10 h-10 items-center justify-center rounded-full bg-gray-50 mr-3"
                >
                    <ArrowLeft size={20} color="#1F2937" />
                </TouchableOpacity>
                <View>
                    <Text className="text-[18px] font-bold text-gray-900">APPLY COUPON</Text>
                    <Text className="text-[11px] font-bold text-gray-400">Your cart: ₹{subtotal}</Text>
                </View>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Manual Input */}
                <View className="p-5 bg-white mb-6">
                    <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-2xl px-4 h-[60px]">
                        <TextInput
                            className="flex-1 text-[15px] font-bold text-gray-900"
                            placeholder="Enter Coupon Code"
                            placeholderTextColor="#9CA3AF"
                            autoCapitalize="characters"
                            value={manualCode}
                            onChangeText={setManualCode}
                        />
                        <TouchableOpacity
                            disabled={!manualCode}
                            onPress={() => {
                                // Simulate checking manual code
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                const found = AVAILABLE_COUPONS.find(c => c.code === manualCode.toUpperCase());
                                if (found) handleApplyCoupon(found);
                                else alert('Invalid coupon code');
                            }}
                        >
                            <Text className={`font-bold uppercase tracking-widest ${manualCode ? 'text-[#B52725]' : 'text-gray-300'}`}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Restaurant Offers Section */}
                <View className="px-5 mb-4">
                    <Text className="text-[12px] font-bold text-gray-500 mb-4 uppercase tracking-[1px]">Restaurant & Platform</Text>
                    {restaurantOffers.map((coupon, idx) => <OfferCard key={`rest-${idx}`} coupon={coupon} />)}
                </View>

                {/* Payment Offers Section */}
                <View className="px-5">
                    <Text className="text-[12px] font-bold text-gray-500 mb-4 uppercase tracking-[1px]">Bank & Payment Offers</Text>
                    {paymentOffers.map((coupon, idx) => <OfferCard key={`pay-${idx}`} coupon={coupon} />)}
                </View>

                {/* Bottom padding for safety */}
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}
