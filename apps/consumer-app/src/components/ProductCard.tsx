import React, { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { Plus, Minus, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProductFavorites } from '../hooks/useProductFavorites';
import Svg, { Path } from 'react-native-svg';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 40 - 16) / 2; // (Screen Width - 2*Padding(20px each side) - Gap(16px)) / 2

interface ProductCardProps {
    item: {
        id: number | string;
        name: string;
        price: number;
        image: any;
        discount?: number;
        isBestseller?: boolean;
        uom?: string; // e.g. "1000gm" or "per kg"
        storeId?: number | string;
        storeName?: string;
        distance?: string;
        rating?: string | number;
        isVeg?: boolean;
    };
    quantity: number;
    onAdd: (item: any) => void;
    onIncrement: (id: string, newQty: number) => void;
    onDecrement: (id: string, quantity: number) => void;
    onPress?: () => void;
    fullWidth?: boolean;
}

export default function ProductCard({
    item,
    quantity,
    onAdd,
    onIncrement,
    onDecrement,
    onPress,
    fullWidth = false
}: ProductCardProps) {
    const cardWidthStyle = fullWidth ? { width: '100%' } : { width: CARD_WIDTH };

    const { productFavorites, toggleProductFavorite } = useProductFavorites();
    const isFavorited = productFavorites.includes(String(item.id));

    return (
        <TouchableOpacity
            delayPressIn={0}
            activeOpacity={0.95}
            onPress={onPress}
            style={[cardWidthStyle as any, { backgroundColor: '#FFFFFF', height: 300 }]}
            className="rounded-[20px] overflow-hidden border border-gray-100 shadow-sm relative mb-4"
        >
            {/* 1. UPPER SECTION (Image) */}
            <View className="w-full h-[140px] bg-[#F9FAFB] items-center justify-center p-4 relative">
                <Image
                    source={typeof item.image === 'string' ? { uri: item.image } : item.image}
                    className="w-full h-full"
                    resizeMode="contain"
                />

                {/* Veg / Non-Veg Indicator */}
                {item.isVeg !== undefined && (
                    <View className={`absolute top-2 left-2 w-3.5 h-3.5 border items-center justify-center bg-white/80 ${item.isVeg ? 'border-green-600' : 'border-red-600'}`} style={{ borderWidth: 1.5, borderRadius: 2 }}>
                        <View className={`w-1.5 h-1.5 rounded-full ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                    </View>
                )}

                <TouchableOpacity
                    delayPressIn={0}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        toggleProductFavorite(String(item.id));
                    }}
                    className="absolute top-2 right-2 bg-white/90 rounded-full items-center justify-center shadow-sm"
                    style={{ width: 28, height: 28 }}
                >
                    <Heart size={14} color="#B52725" fill={isFavorited ? '#B52725' : 'transparent'} />
                </TouchableOpacity>
            </View>

            {/* 2. LOWER SECTION (Content) */}
            <View className="bg-white px-3 py-3 rounded-b-[20px]" style={{ height: 160, justifyContent: 'space-between' }}>
                <View>

                {/* Meta Row (Distance & Rating) */}
                {(item.distance || item.rating) && (
                    <View className="flex-row items-center justify-between mb-1.5">
                        {item.distance && (
                            <Text className="text-[11px] font-semibold text-[#64748B]">
                                📍 {item.distance}
                            </Text>
                        )}
                        {item.rating && (
                            <Text className="text-[11px] font-bold text-[#EAB308]">
                                ★ {item.rating}
                            </Text>
                        )}
                    </View>
                )}

                {/* Title Block */}
                <Text className="text-[14px] font-bold text-[#334155] leading-[18px] text-left mb-1" numberOfLines={2}>
                    {item.name}
                </Text>

                {/* Subtext / Venue Name */}
                {item.storeName && (
                    <Text className="text-[12px] font-medium text-[#94A3B8] mb-1.5" numberOfLines={1}>
                        from {item.storeName}
                    </Text>
                )}

                {/* Unit Block */}
                <Text className="text-[12px] font-medium text-[#94A3B8] mb-2 text-left">
                    {item.uom || '1 Pc'}
                </Text>

                </View>

                {/* Action Row (Price & Add Button) - Perfectly aligned at bottom */}
                <View className="flex-row items-center justify-between">
                    <Text className="text-[16px] font-bold text-[#166534]">
                        ₹{item.price}
                    </Text>

                    {/* Add / Counter Button */}
                    {quantity > 0 ? (
                        <View className="flex-row items-center bg-[#B52725] rounded-full h-8 px-1 shadow-sm">
                            <TouchableOpacity
                                delayPressIn={0}
                                onPress={() => onDecrement(String(item.id), quantity - 1)}
                                className="w-6 h-full items-center justify-center active:opacity-70"
                            >
                                <Minus size={14} color="white" strokeWidth={3} />
                            </TouchableOpacity>
                            <Text className="text-white font-bold text-[13px] min-w-[12px] text-center mx-1">
                                {quantity}
                            </Text>
                            <TouchableOpacity
                                delayPressIn={0}
                                onPress={() => onIncrement(String(item.id), quantity + 1)}
                                className="w-6 h-full items-center justify-center active:opacity-70"
                            >
                                <Plus size={14} color="white" strokeWidth={3} />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            delayPressIn={0}
                            onPress={() => onAdd(item)}
                            className="w-8 h-8 rounded-full bg-[#B52725] items-center justify-center shadow-sm active:opacity-80 shrink-0"
                        >
                            <Plus size={18} color="white" strokeWidth={3} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}
