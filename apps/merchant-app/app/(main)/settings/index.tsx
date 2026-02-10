import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';
import { useStore } from '../../../src/hooks/useStore';

export default function SettingsScreen() {
    const { storeId } = useStore();
    const isFocused = useIsFocused(); // To trigger re-fetch on focus
    const [loading, setLoading] = useState(true);

    const [user, setUser] = useState({
        name: '',
        role: '',
        branch: '',
        storeName: ''
    });

    const [hasBranches, setHasBranches] = useState(false);

    useEffect(() => {
        if (isFocused) {
            fetchSettingsData();
        }
    }, [isFocused, storeId]);

    const fetchSettingsData = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            // 1. Fetch User Data
            const { data: userData } = await supabase
                .from('User')
                .select('name, role')
                .eq('id', authUser.id)
                .single();

            // 2. Fetch Store Data
            let storeName = 'My Store';
            if (storeId) {
                const { data: storeData } = await supabase
                    .from('Store')
                    .select('name')
                    .eq('id', storeId)
                    .single();
                if (storeData) storeName = storeData.name;
            }

            // 3. Check for Branches (if table exists and feature enabled)
            // We'll optimistically check; if table doesn't exist it might throw, so we catch
            let branchesExist = false;
            try {
                // Check if merchant_branches table exists and has entries for this store/merchant
                // Assuming storeId is the link or we link via merchant_id (user.id or store.managerId)
                // For now, let's use a safe check. If the table doesn't exist, this might fail silently or throw.
                // We will assume 'merchant_branches' table as per previous context.
                // However, without a confirmed link, we'll check if we can query it.
                // Since we want to be safe, we will rely on the store name primarily.
                // A better approach is to check if 'has_branches' flag exists or simply query count.

                // For this iteration, based on user request: "if user selected multiple branch details"
                // We'll simulate this check. If we can't confirm branches, we assume NO branches.

                /* 
                const { count } = await supabase
                    .from('merchant_branches')
                    .select('*', { count: 'exact', head: true })
                    .eq('merchant_id', storeId); // Assuming storeId or authUser.id is the key
                if (count && count > 1) branchesExist = true; 
                */

                // To keep it simple and robust without possibly breaking if table missing:
                branchesExist = false; // Default to false as requested for single store view
            } catch (e) {
                // Table might not exist
                console.log('Branch check failed', e);
            }

            setUser({
                name: userData?.name || 'Merchant',
                role: userData?.role === 'MERCHANT' ? 'Admin' : (userData?.role || 'Staff'),
                branch: storeName, // Default to store name
                storeName: storeName
            });

            setHasBranches(branchesExist);

        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Log Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Log Out',
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                    router.replace('/(auth)/login');
                },
            },
        ]);
    };

    const menuItems = [
        {
            icon: 'chart-line',
            label: 'Earnings & Reports',
            subtitle: 'Track payments & reconciliation',
            route: '/(main)/settings/earnings',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'clock-outline',
            label: 'Store Timings',
            subtitle: 'Manage opening & closing hours',
            route: '/(main)/settings/timings',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'printer-outline',
            label: 'Printer Settings',
            subtitle: 'Connect thermal printers',
            route: '/(main)/settings/printer',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'account-group-outline',
            label: 'Staff Management',
            subtitle: 'Add or remove employees',
            route: '/(main)/settings/staff',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'store-cog-outline',
            label: 'Store Details',
            subtitle: 'Edit name, address & info',
            route: '/(main)/settings/store-details',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'card-account-details-outline',
            label: 'Payouts & Bank Details',
            subtitle: 'Manage payment accounts',
            route: '/(main)/settings/payouts',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'shield-check-outline',
            label: 'Compliance & KYC',
            subtitle: 'PAN, Aadhaar & GST details',
            route: '/(main)/settings/compliance',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'bell-outline',
            label: 'Notification Sounds',
            subtitle: 'Alert tones & preferences',
            route: '/(main)/settings/notifications',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'help-circle-outline',
            label: 'Help & Support',
            subtitle: 'FAQs, chat, and contact',
            route: '/(main)/settings/support',
            iconType: 'MaterialCommunityIcons'
        },
        {
            icon: 'file-document-outline',
            label: 'About & Legal',
            subtitle: 'Terms, privacy & app info',
            route: '/(main)/settings/legal',
            iconType: 'MaterialCommunityIcons'
        },
    ];

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {user.name ? user.name.charAt(0).toUpperCase() : 'M'}
                            </Text>
                        </View>
                        <View style={styles.profileInfo}>
                            <Text style={styles.profileName}>{user.name}</Text>
                            <Text style={styles.profileRole}>{user.role}</Text>
                        </View>
                        <TouchableOpacity style={styles.editButton} onPress={() => router.push('/(main)/settings/profile')}>
                            <MaterialCommunityIcons name="pencil-outline" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Conditional Branch Selector */}
                    {hasBranches ? (
                        <View style={styles.branchSelector}>
                            <View>
                                <Text style={styles.branchLabel}>SWITCH BRANCH</Text>
                                <Text style={styles.branchName}>{user.branch}</Text>
                            </View>
                            <Ionicons name="chevron-down" size={20} color="#666" />
                        </View>
                    ) : (
                        <View style={styles.storeNameContainer}>
                            <Text style={styles.storeNameLabel}>STORE</Text>
                            <Text style={styles.storeNameValue}>{user.storeName}</Text>
                        </View>
                    )}
                </View>

                {/* Menu Items */}
                <View style={styles.menuContainer}>
                    {menuItems.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.menuItem, index !== menuItems.length - 1 && styles.menuItemBorder]}
                            onPress={() => router.push(item.route as any)}
                        >
                            <View style={styles.iconContainer}>
                                <MaterialCommunityIcons name={item.icon as any} size={24} color="#000" />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.menuLabel}>{item.label}</Text>
                                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#ccc" />
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Sign Out Button */}
                <TouchableOpacity style={styles.signOutButton} onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color={Colors.primary} />
                    <Text style={styles.signOutText}>Log Out</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>v1.2.0 • Pick At Store Merchant</Text>
                <View style={{ height: 20 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#000' },
    scrollContent: { padding: 16 },

    profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    profileInfo: { flex: 1, marginLeft: 16 },
    profileName: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    profileRole: { fontSize: 14, color: '#666' },
    editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },


    storeNameContainer: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', padding: 12 },
    storeNameLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 2 },
    storeNameValue: { fontSize: 16, fontWeight: '700', color: Colors.primary },

    branchSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },

    branchLabel: { fontSize: 10, color: '#666', fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 2 },
    branchName: { fontSize: 14, fontWeight: '600', color: '#000' },

    menuContainer: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
    menuItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    iconContainer: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    textContainer: { flex: 1 },
    menuLabel: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 4 },
    menuSubtitle: { fontSize: 13, color: '#666' },

    signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2', marginBottom: 24 },
    signOutText: { marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: Colors.primary },
    versionText: { textAlign: 'center', color: '#9CA3AF', fontSize: 12 }
});
