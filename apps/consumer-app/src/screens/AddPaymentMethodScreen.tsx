import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

interface SelectionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}

const SelectionCard = ({ icon, title, subtitle, onPress }: SelectionCardProps) => (
  <TouchableOpacity 
    onPress={onPress}
    className="flex-row items-center bg-[#F9FAFB] border border-gray-200 p-5 rounded-2xl mb-4 shadow-sm"
    activeOpacity={0.7}
  >
    <View className="w-12 h-12 bg-white rounded-xl items-center justify-center border border-gray-100 shadow-sm">
      <Ionicons name={icon} size={24} color="#111827" />
    </View>
    <View className="flex-1 ml-4">
      <Text className="text-[#111827] font-bold text-base">{title}</Text>
      <Text className="text-gray-400 text-sm font-medium mt-0.5">{subtitle}</Text>
    </View>
    <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
  </TouchableOpacity>
);

export default function AddPaymentMethodScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center border-b border-gray-50">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#B52725" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-[#111827]">Add Payment Method</Text>
      </View>

      <ScrollView className="flex-1 px-6 pt-8">
        <Text className="text-gray-500 text-base leading-relaxed mb-8">
          Choose your preferred payment method to link to your account.
        </Text>

        <View className="space-y-4">
          <SelectionCard 
            icon="card-outline"
            title="Credit / Debit Card"
            subtitle="Visa, Mastercard, RuPay, etc."
            onPress={() => {/* Navigate to Card Add Flow */}}
          />
          
          <SelectionCard 
            icon="flash-outline"
            title="UPI"
            subtitle="Google Pay, PhonePe, BHIM"
            onPress={() => {/* Navigate to UPI Add Flow */}}
          />

          <SelectionCard 
            icon="wallet-outline"
            title="Wallets"
            subtitle="Paytm, Amazon Pay, etc."
            onPress={() => {/* Navigate to Wallet Add Flow */}}
          />
        </View>

        <View className="mt-12 items-center">
            <View className="flex-row items-center bg-gray-50 px-4 py-2 rounded-full">
                <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
                <Text className="text-gray-400 text-[12px] font-bold ml-2">PCI-DSS COMPLIANT STORAGE</Text>
            </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
