import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShoppingBag } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';

export default function CartScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
            <View className="w-20 h-20 bg-red-50 rounded-full items-center justify-center mb-6">
                <ShoppingBag size={40} color="#B52725" />
            </View>
            <Text className="text-xl font-bold text-[#111827] mb-2 text-center">Your Cart is Empty</Text>
            <Text className="text-gray-500 text-center mb-10 px-4">
                Looks like you haven't added anything to your cart yet.
            </Text>
            <TouchableOpacity
                onPress={() => navigation.navigate('Main')}
                className="bg-[#B52725] px-6 py-3.5 rounded-2xl shadow-sm"
            >
                <Text className="text-white font-bold text-base">Start Shopping</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}
