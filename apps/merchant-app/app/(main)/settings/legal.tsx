import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

export default function LegalScreen() {

    const LEGAL_LINKS = [
        { label: 'Terms of Service', bg: '#F9FAFB', icon: 'file-document-outline' },
        { label: 'Privacy Policy', bg: '#F9FAFB', icon: 'shield-check-outline' },
        { label: 'Merchant Agreement', bg: '#F9FAFB', icon: 'handshake-outline' },
        { label: 'Open Source Licenses', bg: '#F9FAFB', icon: 'code-tags' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>About & Legal</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.logoContainer}>
                    <View style={styles.logoBox}>
                        <Text style={styles.logoText}>PAS</Text>
                    </View>
                    <Text style={styles.appName}>Pick At Store</Text>
                    <Text style={styles.version}>Merchant App v1.2.0</Text>
                </View>

                <View style={styles.linksContainer}>
                    {LEGAL_LINKS.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.linkItem, { marginTop: index === 0 ? 0 : 12 }]}
                            onPress={() => {
                                if (item.label === 'Privacy Policy') {
                                    Linking.openURL('https://www.pickatstore.io/privacypolicy/merchant-app');
                                }
                            }}
                        >
                            <View style={styles.iconBox}>
                                <MaterialCommunityIcons name={item.icon as any} size={20} color="#6B7280" />
                            </View>
                            <Text style={styles.linkLabel}>{item.label}</Text>
                            <Ionicons name="open-outline" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2026 Pick At Store Inc.</Text>
                    <Text style={styles.footerText}>Made with ❤️ in Hyderabad</Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },

    logoContainer: { alignItems: 'center', marginVertical: 40 },
    logoBox: { width: 80, height: 80, backgroundColor: '#000', borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    logoText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    appName: { fontSize: 24, fontWeight: 'bold', color: '#000' },
    version: { fontSize: 14, color: '#6B7280', marginTop: 4 },

    linksContainer: { marginBottom: 60 },
    linkItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    iconBox: { marginRight: 12 },
    linkLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#374151' },

    footer: { alignItems: 'center' },
    footerText: { fontSize: 13, color: '#9CA3AF', lineHeight: 20 },
});
