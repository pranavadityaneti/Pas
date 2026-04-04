import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { Clock } from 'lucide-react-native';

export default function WaitingRoomScreen() {
    const navigation = useNavigation();

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center p-6">
            <View className="bg-orange-50 w-24 h-24 rounded-full items-center justify-center mb-6 border border-orange-100">
                <Clock size={48} color="#EA580C" />
            </View>
            <Text className="text-[24px] font-extrabold text-gray-900 mb-2 text-center">Orders Sent!</Text>
            <Text className="text-[15px] font-medium text-gray-500 text-center mb-10 leading-6 px-4">
                We're waiting for the merchants to confirm your orders. You will be notified shortly.
            </Text>
            <TouchableOpacity 
                onPress={() => navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }))}
                className="w-full bg-[#111827] py-4 rounded-2xl items-center"
            >
                <Text className="text-white font-bold text-[16px]">Return Home</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}
