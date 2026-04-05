import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

export default function PaymentScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

    const handlePayment = () => {
        Alert.alert("Success", "Payment simulated.", [
            { text: "OK", onPress: () => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] })) }
        ]);
    };

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
            <Text className="text-[24px] font-bold text-gray-900 mb-6">Complete Payment</Text>
            <TouchableOpacity 
                onPress={handlePayment}
                className="w-full bg-[#111827] py-4 rounded-2xl items-center"
            >
                <Text className="text-white font-bold text-[16px]">Pay via Razorpay</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}
