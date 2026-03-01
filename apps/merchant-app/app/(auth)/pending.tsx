import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';

export default function PendingScreen() {
    const handleSignOut = async () => {
        Alert.alert(
            'Log Out',
            'Are you sure you want to log out?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Log Out',
                    style: 'destructive',
                    onPress: async () => {
                        await supabase.auth.signOut();
                        router.replace('/(auth)/login');
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <View style={styles.iconOuter}>
                        <View style={styles.iconInner}>
                            <Ionicons name="hourglass-outline" size={48} color="#F59E0B" />
                        </View>
                    </View>
                </View>

                <Text style={styles.title}>Application Under Review</Text>

                <Text style={styles.description}>
                    Thank you for applying to become a Pick At Store merchant partner. Our team is currently reviewing your application.
                </Text>

                <View style={styles.statusCard}>
                    <View style={styles.statusRow}>
                        <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                        <Text style={styles.statusText}>Application Submitted</Text>
                    </View>
                    <View style={styles.statusRow}>
                        <Ionicons name="hourglass-outline" size={20} color="#F59E0B" />
                        <Text style={styles.statusText}>Verification in Progress</Text>
                    </View>
                    <View style={styles.statusRow}>
                        <Ionicons name="ellipse-outline" size={20} color="#D1D5DB" />
                        <Text style={styles.statusTextPending}>Approval Pending</Text>
                    </View>
                </View>

                <View style={styles.infoCard}>
                    <Ionicons name="time-outline" size={20} color="#6B7280" />
                    <Text style={styles.infoText}>
                        This usually takes 24-48 hours. We'll notify you via email once your account is approved.
                    </Text>
                </View>

                <TouchableOpacity style={styles.contactButton}>
                    <Ionicons name="mail-outline" size={20} color={Colors.primary} />
                    <Text style={styles.contactButtonText}>Contact Support</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
                <Ionicons name="arrow-back" size={20} color="#EF4444" />
                <Text style={styles.signOutText}>Back to Login</Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    iconContainer: {
        marginBottom: 24,
    },
    iconOuter: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FDE68A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        textAlign: 'center',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 32,
    },
    statusCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    statusText: {
        fontSize: 15,
        color: '#111827',
        marginLeft: 12,
        fontWeight: '500',
    },
    statusTextPending: {
        fontSize: 15,
        color: '#9CA3AF',
        marginLeft: 12,
    },
    infoCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 12,
        lineHeight: 20,
    },
    contactButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
        borderRadius: 12,
        backgroundColor: Colors.primary + '08',
    },
    contactButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: Colors.primary,
        marginLeft: 8,
    },
    signOutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        marginHorizontal: 24,
        marginBottom: 16,
    },
    signOutText: {
        fontSize: 15,
        color: '#EF4444',
        marginLeft: 8,
        fontWeight: '500',
    },
});
