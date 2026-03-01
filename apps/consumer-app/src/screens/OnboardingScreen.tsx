// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Onboarding Screen: First-launch onboarding slides.
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, FlatList, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as SecureStore from 'expo-secure-store';

const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        title: 'Discover Local Stores',
        description: 'Find the best grocery stores, restaurants, and local vendors around you.',
    },
    {
        id: '2',
        title: 'Fast Delivery & Pickup',
        description: 'Get your orders delivered to your doorstep in minutes, or pick them up on the go.',
    },
    {
        id: '3',
        title: 'Seamless Dining',
        description: 'Reserve tables, pre-order your meals, and skip the line at your favorite restaurants.',
    }
];

export default function OnboardingScreen() {
    const navigation = useNavigation<any>();
    const flatListRef = useRef<FlatList>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        setCurrentIndex(index);
    };

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
        }
    };

    const handleGetStarted = async () => {
        // Tag that onboarding is complete
        await SecureStore.setItemAsync('has_seen_onboarding', 'true');
        navigation.replace('Auth');
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onScroll={onScroll}
                scrollEventThrottle={16}
                keyExtractor={(item) => item.id}
                renderItem={({ item, index }) => (
                    <View style={{ width, paddingHorizontal: 32, justifyContent: 'center' }} className="flex-1">
                        {/* Placeholder for Illustration */}
                        <View className="mb-12 items-center">
                            <View className="w-64 h-64 bg-red-50 rounded-full items-center justify-center">
                                <Text className="text-6xl text-[#B52725] font-bold">{index + 1}</Text>
                            </View>
                        </View>

                        <Text className="text-4xl font-bold text-black-shadow mb-4">{item.title}</Text>
                        <Text className="text-lg text-gray-500 font-medium leading-7">{item.description}</Text>
                    </View>
                )}
            />

            {/* Bottom Controls */}
            <View className="absolute bottom-12 left-0 right-0 px-8 flex-row items-center justify-between">
                {/* Dots indicator */}
                <View className="flex-row items-center space-x-2">
                    {SLIDES.map((_, index) => (
                        <View
                            key={index}
                            className={`h-2 rounded-full ${currentIndex === index ? 'w-8 bg-[#B52725]' : 'w-2 bg-gray-200'}`}
                        />
                    ))}
                </View>

                {/* Next / Get Started Button */}
                {currentIndex === SLIDES.length - 1 ? (
                    <TouchableOpacity
                        onPress={handleGetStarted}
                        className="bg-[#B52725] px-8 py-4 rounded-full shadow-lg"
                    >
                        <Text className="text-white font-bold text-lg">Get Started</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={handleNext}
                        className="bg-[#B52725] w-14 h-14 rounded-full items-center justify-center shadow-lg"
                    >
                        <Text className="text-white font-bold text-xl">→</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}
