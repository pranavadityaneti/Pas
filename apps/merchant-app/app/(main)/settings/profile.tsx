import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import BottomModal from '../../../src/components/BottomModal';
import { Colors } from '../../../constants/Colors';

export default function ProfileScreen() {
    const [modalVisible, setModalVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState('');
    const [verifying, setVerifying] = useState(false);

    const [user, setUser] = useState({
        id: '',
        name: '',
        role: 'Store Owner',
        phone: '',
        email: ''
    });

    // To track changes
    const [originalUser, setOriginalUser] = useState<any>(null);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            const { data, error } = await supabase
                .from('User')
                .select('id, name, email, phone, role')
                .eq('id', authUser.id)
                .single();

            if (data) {
                // If the user is a MERCHANT, we label them as 'Admin' for the UI
                // If role is missing but they are in this app, they are likely Store Owner
                const userData = {
                    id: data.id,
                    name: data.name || (authUser.user_metadata?.name) || 'Merchant User',
                    email: data.email || authUser.email || '',
                    phone: data.phone || '',
                    role: data.role === 'MERCHANT' ? 'Admin' : (data.role || 'Store Owner')
                };
                setUser(userData);
                setOriginalUser(userData);
            } else {
                // Fallback: Check merchants table directly
                const { data: merchantData } = await supabase
                    .from('merchants')
                    .select('owner_name, phone, email')
                    .eq('id', authUser.id)
                    .single();

                if (merchantData) {
                    const userData = {
                        id: authUser.id,
                        name: merchantData.owner_name,
                        email: merchantData.email,
                        phone: merchantData.phone,
                        role: 'Admin'
                    };
                    setUser(userData);
                    setOriginalUser(userData);
                }
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleInitialSave = async () => {
        // Check if phone number changed
        if (user.phone !== originalUser.phone) {
            // Trigger OTP Flow
            setOtpSent(true);
            Alert.alert('Verification Code Sent', 'A verification code has been sent to your new number (Mock: 123456)');
        } else {
            // Normal Save
            handleFinalSave();
        }
    };

    const handleVerifyAndSave = async () => {
        if (otp !== '123456') {
            Alert.alert('Invalid OTP', 'Please enter the correct verification code.');
            return;
        }
        handleFinalSave();
    };

    const handleFinalSave = async () => {
        if (!user.id) return;
        setSaving(true);
        setVerifying(true);

        try {
            const { error } = await supabase
                .from('User')
                .update({
                    name: user.name,
                    email: user.email,
                    phone: user.phone
                })
                .eq('id', user.id);

            if (error) throw error;

            // Success
            setModalVisible(false);
            setOtpSent(false);
            setOtp('');
            setOriginalUser(user); // Update original state
            Alert.alert('Success', 'Profile updated successfully');

        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Error', 'Failed to update profile');
        } finally {
            setSaving(false);
            setVerifying(false);
        }
    };

    const handleClose = () => {
        setModalVisible(false);
        setOtpSent(false);
        setOtp('');
        // Reset to original if cancelled? 
        if (originalUser) setUser(originalUser);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Profile</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.avatarContainer}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </Text>
                    </View>
                    <Text style={styles.name}>{user.name || 'Set Name'}</Text>
                    <Text style={styles.role}>{user.role}</Text>
                </View>

                <View style={styles.infoCard}>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Full Name</Text>
                        <Text style={styles.value}>{user.name || '-'}</Text>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Phone Number</Text>
                        <Text style={styles.value}>{user.phone || '-'}</Text>
                    </View>
                    <View style={styles.separator} />
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Email</Text>
                        <Text style={styles.value}>{user.email || '-'}</Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.editButton} onPress={() => {
                    if (originalUser) setUser(originalUser); // Reset edits on open
                    setModalVisible(true);
                }}>
                    <Text style={styles.editButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <BottomModal
                visible={modalVisible}
                onClose={handleClose}
                title={otpSent ? "Verify Phone Number" : "Edit Profile"}
            >
                <View style={styles.form}>
                    {!otpSent ? (
                        <>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Full Name</Text>
                                <TextInput
                                    style={styles.input}
                                    value={user.name}
                                    onChangeText={t => setUser({ ...user, name: t })}
                                    placeholder="Enter full name"
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Role</Text>
                                <TextInput
                                    style={[styles.input, { backgroundColor: '#F3F4F6', color: '#6B7280' }]}
                                    value={user.role}
                                    editable={false}
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Phone Number</Text>
                                <TextInput
                                    style={styles.input}
                                    value={user.phone}
                                    onChangeText={t => setUser({ ...user, phone: t })}
                                    placeholder="Enter phone number"
                                    keyboardType="phone-pad"
                                />
                            </View>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Email (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={user.email}
                                    onChangeText={t => setUser({ ...user, email: t })}
                                    placeholder="Enter email"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.modalCancel} onPress={handleClose}>
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalSave, saving && { opacity: 0.7 }]}
                                    onPress={handleInitialSave}
                                    disabled={saving}
                                >
                                    <Text style={styles.modalSaveText}>
                                        {user.phone !== originalUser?.phone ? 'Verify & Save' : 'Save Changes'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            <Text style={{ textAlign: 'center', marginBottom: 20, color: '#666' }}>
                                We've sent a verification code to {user.phone}. Please enter it below.
                            </Text>
                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>Verification Code (OTP)</Text>
                                <TextInput
                                    style={[styles.input, { textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
                                    value={otp}
                                    onChangeText={setOtp}
                                    placeholder="123456"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                    textContentType="oneTimeCode"
                                />
                            </View>
                            <View style={styles.modalActions}>
                                <TouchableOpacity style={styles.modalCancel} onPress={() => setOtpSent(false)}>
                                    <Text style={styles.modalCancelText}>Back</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalSave, verifying && { opacity: 0.7 }]}
                                    onPress={handleVerifyAndSave}
                                    disabled={verifying}
                                >
                                    <Text style={styles.modalSaveText}>{verifying ? 'Verifying...' : 'Confirm'}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </BottomModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },

    avatarContainer: { alignItems: 'center', marginBottom: 30 },
    avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    avatarText: { fontSize: 40, color: '#fff', fontWeight: 'bold' },
    name: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
    role: { fontSize: 16, color: '#666' },

    infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2, marginBottom: 30 },
    infoRow: { paddingVertical: 12 },
    label: { fontSize: 14, color: '#666', marginBottom: 4 },
    value: { fontSize: 16, fontWeight: '600', color: '#000' },
    separator: { height: 1, backgroundColor: '#F3F4F6' },

    editButton: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', padding: 16, borderRadius: 12, alignItems: 'center' },
    editButtonText: { fontSize: 16, fontWeight: '600', color: '#000' },

    form: { gap: 16, paddingBottom: 20 },
    inputGroup: {},
    inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, color: '#000' },

    modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalCancel: { flex: 1, padding: 16, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' },
    modalCancelText: { fontWeight: '700', color: '#374151', fontSize: 16 },
    modalSave: { flex: 1, padding: 16, backgroundColor: '#000', borderRadius: 12, alignItems: 'center' },
    modalSaveText: { fontWeight: '700', color: '#fff', fontSize: 16 },
});
