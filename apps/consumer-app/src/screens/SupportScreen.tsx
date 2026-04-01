// @lock — Do NOT overwrite. Approved layout & FAQ logic as of April 1, 2026.
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Linking, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const CUSTOMER_FAQS = [
  { question: "What is PickAtStore?", answer: "PickAtStore is a unified retail BOPIS marketplace that allows you to browse products across different categories, order online, and pick up in store." },
  { question: "How is PickAtStore different from other online marketplaces like Swiggy, Zomato, or Amazon?", answer: "PickAtStore is only an aggregator that connects every customer to every store in the city. Customers can place their orders online, but have to visit the stores personally to collect their order." },
  { question: "Can I order from multiple stores in one order?", answer: "Yes, however each store will have its individual order ID, invoice, and OTP." },
  { question: "Are app prices the same as in-store prices?", answer: "Pricing is very transparent on PickAtStore. Vendors have full control over product pricing. Cost can be the same as in-store or lesser if they choose to give discounts." },
  { question: "What if I want to return or exchange my purchase?", answer: "Return eligibility depends on the individual store’s policy. This will be shown before checkout. Customers can return or exchange their products instantly at the store. You can initiate return or exchange on the app after discussing valid concerns with the vendor. If the vendor approves, the process will be completed on the spot." },
  { question: "Who do I contact if there is an issue with my order?", answer: "You can contact customer support through the app or website help section." }
];

export default function SupportScreen() {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleWebsite = () => Linking.openURL('https://www.pickatstore.io');
  const handleEmail = () => Linking.openURL('mailto:support@pickatstore.io');
  const handleTerms = () => Linking.openURL('https://www.pickatstore.io/terms');

  const filteredFaqs = CUSTOMER_FAQS.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleAccordion = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'left', 'right']}>
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-4">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-[#111827]">FAQ and Support</Text>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        {/* Support Subtitle */}
        <View className="mb-8">
          <Text className="text-gray-500 text-base leading-relaxed">
            Didn't find the answer you were looking for? Contact our support center!
          </Text>
        </View>

        {/* Quick Links Section */}
        <View className="mb-10 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <TouchableOpacity 
            onPress={handleWebsite}
            className="flex-row items-center px-5 py-4 border-b border-gray-50"
          >
            <Ionicons name="globe-outline" size={22} color="#4B5563" />
            <Text className="ml-4 text-gray-900 font-bold text-[15px]">Go to our Website</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" className="ml-auto" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleEmail}
            className="flex-row items-center px-5 py-4 border-b border-gray-50"
          >
            <Ionicons name="mail-outline" size={22} color="#4B5563" />
            <Text className="ml-4 text-gray-900 font-bold text-[15px]">Email Us</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" className="ml-auto" />
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleTerms}
            className="flex-row items-center px-5 py-4"
          >
            <Ionicons name="document-text-outline" size={22} color="#4B5563" />
            <Text className="ml-4 text-gray-900 font-bold text-[15px]">Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" className="ml-auto" />
          </TouchableOpacity>
        </View>

        {/* Search Bar - Brand Styled */}
        <View className="mb-8 p-1 bg-[#B52725] rounded-2xl flex-row items-center shadow-md">
          <View className="px-3">
            <Ionicons name="search" size={20} color="white" />
          </View>
          <TextInput
            placeholder="Search FAQs..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            className="flex-1 py-3.5 text-white font-bold text-base"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="px-3">
              <Ionicons name="close-circle" size={20} color="white" />
            </TouchableOpacity>
          )}
        </View>

        {/* FAQ Accordion List */}
        <View className="mb-10">
          <Text className="text-xl font-bold text-[#111827] mb-4">Frequently Asked Questions</Text>
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq, index) => (
              <View 
                key={index} 
                className="mb-4 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm"
              >
                <TouchableOpacity 
                  onPress={() => toggleAccordion(index)}
                  className="px-5 py-4 flex-row items-center justify-between"
                  activeOpacity={0.7}
                >
                  <Text className="flex-1 text-[15px] font-bold text-gray-900 pr-2">
                    {faq.question}
                  </Text>
                  <Ionicons 
                    name={expandedIndex === index ? "chevron-up" : "chevron-down"} 
                    size={20} 
                    color="#111827" 
                  />
                </TouchableOpacity>
                
                {expandedIndex === index && (
                  <View className="px-5 pb-5 pt-1 border-t border-gray-50">
                    <Text className="text-[14px] text-gray-400 leading-6 font-medium">
                      {faq.answer}
                    </Text>
                  </View>
                )}
              </View>
            ))
          ) : (
            <View className="items-center py-10">
              <Text className="text-gray-400 font-bold">No results found for "{searchQuery}"</Text>
            </View>
          )}
        </View>

        <View className="mb-12 items-center">
            <Text className="text-gray-300 text-[10px] font-bold uppercase tracking-[4px]">Pick At Store Support</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
