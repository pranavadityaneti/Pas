import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function SupportScreen() {

    // Actions - These would open actual links/dials/emails
    const handleCall = () => Linking.openURL('tel:+919876543210');
    const handleEmail = () => Linking.openURL('mailto:support@pickatstore.com');
    const handleChat = () => alert('Live Chat feature coming soon!');

    const FAQ_ITEMS = [
        { label: 'Payment Settlements', route: '#' },
        { label: 'Order Cancellation Policy', route: '#' },
        { label: 'Updating Store Menu', route: '#' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Help & Support</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Hero Card */}
                <View style={styles.heroCard}>
                    <Text style={styles.heroTitle}>How can we help?</Text>
                    <Text style={styles.heroText}>Our support team is available 24/7 to assist you with any issues.</Text>
                    <TouchableOpacity style={styles.chatButton} onPress={handleChat}>
                        <Ionicons name="chatbubble-outline" size={20} color="#000" style={{ marginRight: 8 }} />
                        <Text style={styles.chatButtonText}>Start Live Chat</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Contact Us</Text>

                <TouchableOpacity style={styles.contactItem} onPress={handleCall}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="call-outline" size={24} color="#374151" />
                    </View>
                    <View style={styles.contactInfo}>
                        <Text style={styles.contactLabel}>Call Support</Text>
                        <Text style={styles.contactValue}>+91 98765 43210</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.contactItem, { marginTop: 12 }]} onPress={handleEmail}>
                    <View style={styles.iconCircle}>
                        <Ionicons name="mail-outline" size={24} color="#374151" />
                    </View>
                    <View style={styles.contactInfo}>
                        <Text style={styles.contactLabel}>Email Us</Text>
                        <Text style={styles.contactValue}>support@pickatstore.com</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                </TouchableOpacity>

                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Common Topics</Text>

                <View style={styles.faqList}>
                    {FAQ_ITEMS.map((item, index) => (
                        <TouchableOpacity key={index} style={[styles.faqItem, index !== FAQ_ITEMS.length - 1 && styles.borderBottom]}>
                            <Text style={styles.faqText}>{item.label}</Text>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))}
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },

    heroCard: { backgroundColor: '#000', borderRadius: 20, padding: 24, paddingVertical: 32, alignItems: 'center', marginBottom: 32, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
    heroTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
    heroText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
    chatButton: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30, flexDirection: 'row', alignItems: 'center' },
    chatButtonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 16 },

    contactItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6' },
    iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginRight: 16, borderWidth: 1, borderColor: '#F3F4F6' },
    contactInfo: { flex: 1 },
    contactLabel: { fontSize: 16, fontWeight: 'bold', color: '#000' },
    contactValue: { fontSize: 14, color: '#6B7280', marginTop: 2 },

    faqList: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
    faqItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    borderBottom: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    faqText: { fontSize: 16, fontWeight: '600', color: '#374151' },
});
