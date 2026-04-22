import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, Platform, ActionSheetIOS, Modal, TextInput, ActivityIndicator, KeyboardAvoidingView, Linking } from 'react-native';
import uuid from 'react-native-uuid';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';
import { useStore } from '../../../src/hooks/useStore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DELETE_REASONS = [
    { id: 'closing', label: 'Closing my business' },
    { id: 'switching', label: 'Switching to another platform' },
    { id: 'difficult', label: 'Too difficult to use' },
    { id: 'features', label: 'Missing features I need' },
    { id: 'other', label: 'Other reason' },
];

export default function SettingsScreen() {
    const { storeId, branches, activeStoreId, switchBranch, merchantId, refreshStore, availableRoles, switchRole, isSwitching, store, isCurrentStoreOwner } = useStore();
    const isFocused = useIsFocused(); // To trigger re-fetch on focus
    const [loading, setLoading] = useState(true);

    // Compute active role type based on current context
    const activeRole = useMemo(() => {
        // Check if activeStoreId matches a manager role
        const managerRole = availableRoles.find(r => r.type === 'manager' && r.id === activeStoreId);
        if (managerRole) return managerRole;
        
        // Check if we have an owner role matching merchantId
        const ownerRole = availableRoles.find(r => r.type === 'owner' && r.id === merchantId);
        if (ownerRole) return ownerRole;
        
        // Default to first available role
        return availableRoles[0] || null;
    }, [availableRoles, activeStoreId, merchantId]);

    // Only owners can delete their account (robust check)
    const isOwnerRole = (activeStoreId && merchantId && activeStoreId === merchantId) || activeRole?.type === 'owner';

    // Store Switcher Modal
    const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState(false);

    // Delete Account Modal
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteReason, setDeleteReason] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const [user, setUser] = useState({
        name: '',
        role: '',
        branch: '',
        storeName: ''
    });

    const hasBranches = branches && branches.length > 1;
    const isOwner = activeStoreId === merchantId || activeStoreId === null;
    const [isCreateBranchModalOpen, setIsCreateBranchModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [branchForm, setBranchForm] = useState({
        name: '',
        manager: '',
        phone: '',
        city: '',
    });

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



            setUser({
                name: userData?.name || 'Partner',
                role: userData?.role === 'MERCHANT' ? 'Admin' : (userData?.role || 'Staff'),
                branch: storeName, // Default to store name
                storeName: storeName
            });

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

    const handleSwitchBranch = () => {
        const branchNames = branches.map(b => b.name);
        const addOption = isOwner ? ['+ Add New Branch'] : [];

        if (Platform.OS === 'ios') {
            const options = [...branchNames, ...addOption, 'Cancel'];
            const cancelIndex = options.length - 1;
            const addIndex = isOwner ? branchNames.length : -1;

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    cancelButtonIndex: cancelIndex,
                    title: 'Switch Branch',
                },
                (buttonIndex) => {
                    if (buttonIndex === addIndex) {
                        setIsCreateBranchModalOpen(true);
                    } else if (buttonIndex < branches.length) {
                        switchBranch(branches[buttonIndex].id);
                    }
                }
            );
        } else {
            const alertOptions: any[] = [
                ...branches.map(b => ({
                    text: b.name,
                    onPress: () => switchBranch(b.id),
                })),
                ...(isOwner ? [{
                    text: '+ Add New Branch',
                    onPress: () => setIsCreateBranchModalOpen(true),
                }] : []),
                { text: 'Cancel', style: 'cancel' as const },
            ];
            Alert.alert('Switch Branch', 'Select a branch to manage', alertOptions);
        }
    };

    const handleCreateBranch = async () => {
        if (!branchForm.name.trim()) {
            Alert.alert('Required', 'Branch name is required.');
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('merchant_branches')
                .insert({
                    id: uuid.v4(),
                    merchant_id: merchantId,
                    branch_name: branchForm.name.trim(),
                    manager_name: branchForm.manager.trim() || null,
                    phone: branchForm.phone.trim() || null,
                    city: branchForm.city.trim() || null,
                    is_active: true,
                });
            if (error) throw error;

            Alert.alert('Success', `Branch "${branchForm.name}" created successfully.`);
            setBranchForm({ name: '', manager: '', phone: '', city: '' });
            setIsCreateBranchModalOpen(false);
            await refreshStore();
        } catch (err: any) {
            console.error('[CreateBranch] Error:', JSON.stringify(err, null, 2));
            Alert.alert('Error', err.message || 'Failed to create branch.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!deleteReason) return;
        
        setIsDeleting(true);
        try {
            // Get the current user info for the email
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const userIdentifier = authUser?.phone || authUser?.email || 'Unknown';
            const reasonLabel = DELETE_REASONS.find(r => r.id === deleteReason)?.label || deleteReason;
            
            // Compose the email content
            const subject = encodeURIComponent('Account Deletion Request - Pick At Store Merchant');
            const body = encodeURIComponent(
                `Hello Pick At Store Support,\n\n` +
                `I would like to request deletion of my merchant account.\n\n` +
                `Account Details:\n` +
                `- Phone/Email: ${userIdentifier}\n` +
                `- Store: ${store?.name || 'N/A'}\n` +
                `- Merchant ID: ${merchantId || 'N/A'}\n\n` +
                `Reason for deletion: ${reasonLabel}\n\n` +
                `Please process this request and confirm once completed.\n\n` +
                `Thank you.`
            );
            
            const mailtoUrl = `mailto:support@pickatstore.com?subject=${subject}&body=${body}`;
            
            // Try to open the email client
            const canOpen = await Linking.canOpenURL(mailtoUrl);
            if (canOpen) {
                await Linking.openURL(mailtoUrl);
            } else {
                Alert.alert('Error', 'Unable to open email client. Please email support@pickatstore.com directly.');
            }
            
            // Clear local data and sign out
            await AsyncStorage.clear();
            await supabase.auth.signOut();
            
            Alert.alert(
                'Request Initiated',
                'Please send the email that was opened to complete your deletion request. Our support team will process it within 7 business days.',
                [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
            );
        } catch (error: any) {
            console.error('[DeleteAccount] Error:', error);
            Alert.alert('Error', 'Failed to process request. Please contact support@pickatstore.com directly.');
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
            setDeleteReason(null);
        }
    };

    const allMenuItems = [
        {
            icon: 'chart-line',
            label: 'Earnings & Reports',
            subtitle: 'Track payments & reconciliation',
            route: '/(main)/settings/earnings',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: false,
        },
        {
            icon: 'refresh',
            label: 'Returns & Refunds',
            subtitle: 'Manage requests & approvals',
            route: '/(main)/settings/returns',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: false,
        },
        {
            icon: 'clock-outline',
            label: 'Store Timings',
            subtitle: 'Manage opening & closing hours',
            route: '/(main)/settings/timings',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: false,
        },
        {
            icon: 'account-group-outline',
            label: 'Staff Management',
            subtitle: 'Add or remove employees',
            route: '/(main)/settings/staff',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: true,
        },
        {
            icon: 'store-cog-outline',
            label: 'Store Details',
            subtitle: 'Edit name, address & info',
            route: '/(main)/settings/store-details',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: true,
        },
        {
            icon: 'source-branch',
            label: 'Branch Management',
            subtitle: 'Add or manage store branches',
            route: '/(main)/settings/branches',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: true,
        },
        {
            icon: 'card-account-details-outline',
            label: 'Payouts & Bank Details',
            subtitle: 'Manage payment accounts',
            route: '/(main)/settings/payouts',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: true,
        },
        {
            icon: 'shield-check-outline',
            label: 'Compliance & KYC',
            subtitle: 'PAN, Aadhaar & GST details',
            route: '/(main)/settings/compliance',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: true,
        },
        {
            icon: 'bell-outline',
            label: 'Notification Sounds',
            subtitle: 'Alert tones & preferences',
            route: '/(main)/settings/notifications',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: false,
        },
        {
            icon: 'help-circle-outline',
            label: 'Help & Support',
            subtitle: 'FAQs, chat, and contact',
            route: '/(main)/settings/support',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: false,
        },
        {
            icon: 'file-document-outline',
            label: 'About & Legal',
            subtitle: 'Terms, privacy & app info',
            route: '/(main)/settings/legal',
            iconType: 'MaterialCommunityIcons',
            ownerOnly: false,
        },
    ];

    const menuItems = allMenuItems.filter(item => !item.ownerOnly || isCurrentStoreOwner);

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

                    {/* Store Dropdown - Always visible & tappable for diagnostics */}
                    <TouchableOpacity 
                        style={styles.storeDropdown} 
                        onPress={() => setIsStoreSwitcherOpen(true)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.storeDropdownLeft}>
                            <Text style={styles.storeDropdownLabel}>CURRENT STORE</Text>
                            <Text style={styles.storeDropdownName}>{store?.name || 'My Store'}</Text>
                        </View>
                        <Ionicons name="chevron-down" size={20} color="#666" />
                    </TouchableOpacity>
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

                {/* Danger Zone - Only visible for store owners */}
                {isCurrentStoreOwner && (
                    <View style={styles.dangerZone}>
                        <Text style={styles.dangerZoneTitle}>Danger Zone</Text>
                        <TouchableOpacity 
                            style={styles.deleteAccountButton} 
                            onPress={() => setIsDeleteModalOpen(true)}
                        >
                            <Ionicons name="trash-outline" size={22} color="#DC2626" />
                            <Text style={styles.deleteAccountText}>Delete Account</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.versionText}>v1.2.0 • Pick At Store Partner</Text>
                <View style={{ height: 20 }} />
            </ScrollView>

            {/* Create Branch Modal */}
            <Modal
                visible={isCreateBranchModalOpen}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setIsCreateBranchModalOpen(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add New Branch</Text>
                            <TouchableOpacity onPress={() => setIsCreateBranchModalOpen(false)}>
                                <Ionicons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Branch Name *"
                            placeholderTextColor="#999"
                            value={branchForm.name}
                            onChangeText={(t) => setBranchForm(prev => ({ ...prev, name: t }))}
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Manager Name"
                            placeholderTextColor="#999"
                            value={branchForm.manager}
                            onChangeText={(t) => setBranchForm(prev => ({ ...prev, manager: t }))}
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="Manager Phone"
                            placeholderTextColor="#999"
                            value={branchForm.phone}
                            onChangeText={(t) => setBranchForm(prev => ({ ...prev, phone: t }))}
                            keyboardType="phone-pad"
                        />
                        <TextInput
                            style={styles.modalInput}
                            placeholder="City"
                            placeholderTextColor="#999"
                            value={branchForm.city}
                            onChangeText={(t) => setBranchForm(prev => ({ ...prev, city: t }))}
                        />

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setIsCreateBranchModalOpen(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalSubmitButton, isSubmitting && { opacity: 0.6 }]}
                                onPress={handleCreateBranch}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.modalSubmitText}>Create Branch</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Switching Overlay */}
            {isSwitching && (
                <View style={styles.switchingOverlay}>
                    <View style={styles.switchingModal}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.switchingText}>Switching store...</Text>
                    </View>
                </View>
            )}

            {/* Store Switcher Bottom Sheet */}
            <Modal
                visible={isStoreSwitcherOpen}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setIsStoreSwitcherOpen(false)}
            >
                <TouchableOpacity 
                    style={styles.modalBackdrop} 
                    activeOpacity={1} 
                    onPress={() => setIsStoreSwitcherOpen(false)}
                >
                    <View style={styles.bottomSheet}>
                        <View style={styles.bottomSheetHandle} />
                        <Text style={styles.bottomSheetTitle}>Switch Store</Text>
                        
                        {availableRoles.map((role) => {
                            const isActive = (role.type === 'owner' && role.id === merchantId) || 
                                           (role.type === 'manager' && role.id === activeStoreId);
                            return (
                                <TouchableOpacity
                                    key={role.id}
                                    style={[styles.roleOption, isActive && styles.roleOptionActive]}
                                    onPress={() => {
                                        if (!isActive) {
                                            switchRole(role);
                                            setIsStoreSwitcherOpen(false);
                                        }
                                    }}
                                    disabled={isSwitching}
                                >
                                    <Text style={styles.roleOptionIcon}>
                                        {role.type === 'owner' ? '👑' : '🏪'}
                                    </Text>
                                    <View style={styles.roleOptionInfo}>
                                        <Text style={styles.roleOptionName}>{role.name}</Text>
                                        <Text style={styles.roleOptionType}>
                                            {role.type === 'owner' ? 'Store Owner' : 'Branch Manager'}
                                        </Text>
                                    </View>
                                    {isActive && (
                                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                                    )}
                                </TouchableOpacity>
                            );
                        })}

                        {/* Add New Branch - Only for Owners */}
                        {availableRoles.some(r => r.type === 'owner') && (
                            <TouchableOpacity 
                                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 8 }}
                                onPress={() => {
                                    setIsStoreSwitcherOpen(false);
                                    router.push('/(main)/settings/branches' as any);
                                }}
                            >
                                <Ionicons name="add-circle-outline" size={24} color={Colors.primary} style={{ marginRight: 16 }} />
                                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.primary }}>Add New Branch</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Delete Account Modal */}
            <Modal
                visible={isDeleteModalOpen}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsDeleteModalOpen(false)}
            >
                <View style={styles.deleteModalBackdrop}>
                    <View style={styles.deleteModalContent}>
                        <View style={styles.deleteModalHeader}>
                            <Ionicons name="warning" size={48} color="#DC2626" />
                            <Text style={styles.deleteModalTitle}>Delete Account?</Text>
                            <Text style={styles.deleteModalSubtitle}>
                                This action is permanent. All your store data, orders, and settings will be deleted.
                            </Text>
                        </View>

                        <Text style={styles.deleteReasonLabel}>Please tell us why you're leaving:</Text>
                        
                        {DELETE_REASONS.map((reason) => (
                            <TouchableOpacity
                                key={reason.id}
                                style={[
                                    styles.deleteReasonOption,
                                    deleteReason === reason.id && styles.deleteReasonSelected
                                ]}
                                onPress={() => setDeleteReason(reason.id)}
                            >
                                <View style={[
                                    styles.deleteReasonRadio,
                                    deleteReason === reason.id && styles.deleteReasonRadioSelected
                                ]} />
                                <Text style={styles.deleteReasonText}>{reason.label}</Text>
                            </TouchableOpacity>
                        ))}

                        <View style={styles.deleteModalActions}>
                            <TouchableOpacity
                                style={styles.deleteCancelButton}
                                onPress={() => {
                                    setIsDeleteModalOpen(false);
                                    setDeleteReason(null);
                                }}
                            >
                                <Text style={styles.deleteCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            
                            <TouchableOpacity
                                style={[
                                    styles.deleteConfirmButton,
                                    !deleteReason && styles.deleteConfirmDisabled
                                ]}
                                onPress={handleDeleteAccount}
                                disabled={!deleteReason || isDeleting}
                            >
                                {isDeleting ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Text style={styles.deleteConfirmText}>Delete Account</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff' },
    headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#000' },
    scrollContent: { padding: 16 },

    profileCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    profileHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
    profileInfo: { flex: 1, marginLeft: 16 },
    profileName: { fontSize: 18, fontWeight: 'bold', color: '#000' },
    profileRole: { fontSize: 14, color: '#666' },
    editButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },

    // Store Dropdown in Profile Card
    storeDropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    storeDropdownLeft: { flex: 1 },
    storeDropdownLabel: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 0.5, marginBottom: 2 },
    storeDropdownName: { fontSize: 16, fontWeight: '600', color: '#000' },

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

    signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#FEE2E2', marginBottom: 16 },
    signOutText: { marginLeft: 8, fontSize: 16, fontWeight: 'bold', color: Colors.primary },

    // Danger Zone
    dangerZone: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: '#FECACA' },
    dangerZoneTitle: { fontSize: 12, fontWeight: '700', color: '#DC2626', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
    deleteAccountButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#DC2626' },
    deleteAccountText: { marginLeft: 8, fontSize: 16, fontWeight: '600', color: '#DC2626' },

    versionText: { textAlign: 'center', color: '#9CA3AF', fontSize: 12 },

    // Create Branch Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#000' },
    modalInput: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, fontSize: 16, color: '#000', marginBottom: 12, borderWidth: 1, borderColor: '#F3F4F6' },
    modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalCancelButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
    modalCancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
    modalSubmitButton: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: Colors.primary, alignItems: 'center' },
    modalSubmitText: { fontSize: 16, fontWeight: '600', color: '#fff' },

    // Store Switcher Styles (kept for compatibility)
    storeSwitcherCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    storeSwitcherTitle: { fontSize: 12, fontWeight: '700', color: '#666', letterSpacing: 0.5, marginBottom: 12, textTransform: 'uppercase' },
    roleItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    roleItemActive: { backgroundColor: '#F0FDF4', marginHorizontal: -16, paddingHorizontal: 16, borderRadius: 12 },
    roleItemBorder: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    roleIcon: { fontSize: 24, marginRight: 14 },
    roleInfo: { flex: 1 },
    roleName: { fontSize: 16, fontWeight: '600', color: '#000', marginBottom: 2 },
    roleNameActive: { color: '#10B981' },
    roleType: { fontSize: 13, color: '#666' },

    // Switching Overlay
    switchingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
    switchingModal: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 },
    switchingText: { marginTop: 16, fontSize: 16, fontWeight: '600', color: '#374151' },

    // Bottom Sheet Modal for Store Switcher
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
    bottomSheetHandle: { width: 40, height: 4, backgroundColor: '#DDD', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
    bottomSheetTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
    roleOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    roleOptionActive: { backgroundColor: '#F0FDF4', marginHorizontal: -24, paddingHorizontal: 24 },
    roleOptionIcon: { fontSize: 28, marginRight: 16 },
    roleOptionInfo: { flex: 1 },
    roleOptionName: { fontSize: 16, fontWeight: '600', color: '#000' },
    roleOptionType: { fontSize: 13, color: '#666', marginTop: 2 },

    // Delete Account Modal
    deleteModalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    deleteModalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 400 },
    deleteModalHeader: { alignItems: 'center', marginBottom: 24 },
    deleteModalTitle: { fontSize: 22, fontWeight: '700', color: '#DC2626', marginTop: 12 },
    deleteModalSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, lineHeight: 20 },
    deleteReasonLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 12 },
    deleteReasonOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    deleteReasonSelected: { backgroundColor: '#FEF2F2', marginHorizontal: -24, paddingHorizontal: 24 },
    deleteReasonRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12 },
    deleteReasonRadioSelected: { borderColor: '#DC2626', backgroundColor: '#DC2626' },
    deleteReasonText: { fontSize: 15, color: '#374151' },
    deleteModalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
    deleteCancelButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
    deleteCancelText: { fontSize: 16, fontWeight: '600', color: '#374151' },
    deleteConfirmButton: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#DC2626', alignItems: 'center' },
    deleteConfirmDisabled: { opacity: 0.5 },
    deleteConfirmText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
