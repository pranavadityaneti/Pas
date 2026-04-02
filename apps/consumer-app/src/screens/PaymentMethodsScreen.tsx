import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';

interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'wallet';
  label: string;
  subtitle: string;
}

export default function PaymentMethodsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const renderIcon = (type: PaymentMethod['type']) => {
    switch (type) {
      case 'card':
        return <Ionicons name="card-outline" size={24} color="#111827" />;
      case 'upi':
        return <Ionicons name="phone-portrait-outline" size={24} color="#111827" />;
      case 'wallet':
        return <Ionicons name="wallet-outline" size={24} color="#111827" />;
      default:
        return <Ionicons name="help-circle-outline" size={24} color="#111827" />;
    }
  };

  const renderContent = () => {
    if (paymentMethods.length === 0) {
      return (
        <View className="flex-1 items-center justify-center px-10">
          <View className="w-24 h-24 bg-gray-50 rounded-full items-center justify-center mb-6">
            <Ionicons name="card" size={48} color="#D1D5DB" />
          </View>
          <Text className="text-xl font-bold text-[#111827] mb-2 text-center">No payment methods added</Text>
          <Text className="text-gray-400 text-center mb-8 leading-relaxed">
            Your saved cards and UPI IDs will appear here for a faster checkout experience.
          </Text>
          
          <TouchableOpacity 
            className="bg-[#B52725] w-full py-4 rounded-2xl items-center shadow-lg"
            onPress={() => navigation.navigate('AddPaymentMethod' as any)}
          >
            <Text className="text-white font-bold text-base">Add New Payment Method</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView className="flex-1 px-6">
        <Text className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Saved Methods</Text>
        {paymentMethods.map((method) => (
          <View 
            key={method.id} 
            className="flex-row items-center bg-white border border-gray-100 p-4 rounded-2xl mb-4 shadow-sm"
          >
            <View className="w-12 h-12 bg-gray-50 rounded-xl items-center justify-center mr-4">
              {renderIcon(method.type)}
            </View>
            <View className="flex-1">
              <Text className="text-gray-900 font-bold text-base">{method.label}</Text>
              <Text className="text-gray-400 text-sm font-medium">{method.subtitle}</Text>
            </View>
            <TouchableOpacity onPress={() => {/* Remove logic */}}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity 
          className="flex-row items-center justify-center py-4 border-2 border-dashed border-gray-200 rounded-2xl mt-4"
          onPress={() => navigation.navigate('AddPaymentMethod' as any)}
        >
          <Ionicons name="add" size={24} color="#B52725" />
          <Text className="text-[#B52725] font-bold text-base ml-2">Add Another Method</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-gray-50">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#B52725" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-[#111827]">Payment Methods</Text>
      </View>

      {renderContent()}
    </SafeAreaView>
  );
}
