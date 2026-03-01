import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useEarnings } from '../../../src/hooks/useEarnings';

export default function EarningsScreen() {
    const { stats, loading } = useEarnings();

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Earnings & Reports</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Main Stats Card */}
                <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>TOTAL REVENUE</Text>
                    <Text style={styles.totalAmount}>₹{stats.total.toLocaleString()}</Text>
                    <View style={styles.totalMeta}>
                        <View style={styles.metaItem}>
                            <Ionicons name="receipt-outline" size={16} color="#9CA3AF" />
                            <Text style={styles.metaText}>{stats.orderCount} Orders</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <Ionicons name="time-outline" size={16} color="#9CA3AF" />
                            <Text style={styles.metaText}>Updated now</Text>
                        </View>
                    </View>
                </View>

                {/* Sub Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Today</Text>
                        <Text style={styles.statValue}>₹{stats.today.toLocaleString()}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>This Week</Text>
                        <Text style={styles.statValue}>₹{stats.weekly.toLocaleString()}</Text>
                    </View>
                </View>

                <View style={styles.pendingCard}>
                    <View style={styles.pendingIcon}>
                        <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.pendingTitle}>{stats.pendingCount} Ongoing Orders</Text>
                        <Text style={styles.pendingDesc}>These orders are in progress and not yet added to revenue.</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push('/(main)/orders')}>
                        <Text style={styles.viewLink}>View</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.sectionTitle}>Reports & Insights</Text>

                <TouchableOpacity style={styles.reportItem}>
                    <View style={[styles.reportIcon, { backgroundColor: '#DBEAFE' }]}>
                        <Ionicons name="calendar-outline" size={24} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.reportTitle}>Daily Breakdown</Text>
                        <Text style={styles.reportDesc}>Detailed sales log for the last 30 days</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.reportItem}>
                    <View style={[styles.reportIcon, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="cube-outline" size={24} color="#10B981" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.reportTitle}>Product Sales</Text>
                        <Text style={styles.reportDesc}>See which items are selling the most</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    totalCard: { backgroundColor: Colors.text, borderRadius: 24, padding: 32, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    totalLabel: { color: '#9CA3AF', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    totalAmount: { color: Colors.white, fontSize: 40, fontWeight: 'bold' },
    totalMeta: { flexDirection: 'row', marginTop: 24, gap: 16 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: '#9CA3AF', fontSize: 13, fontWeight: '500' },

    statsRow: { flexDirection: 'row', gap: 16, marginBottom: 20 },
    statBox: { flex: 1, backgroundColor: Colors.white, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: Colors.border },
    statLabel: { fontSize: 13, color: Colors.textSecondary, marginBottom: 4, fontWeight: '600' },
    statValue: { fontSize: 20, fontWeight: 'bold', color: Colors.text },

    pendingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#FEF3C7', marginBottom: 32 },
    pendingIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    pendingTitle: { fontSize: 15, fontWeight: 'bold', color: '#92400E' },
    pendingDesc: { fontSize: 12, color: '#B45309', marginTop: 2, lineHeight: 16 },
    viewLink: { color: '#D97706', fontWeight: 'bold', fontSize: 14, marginLeft: 8 },

    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 16, marginLeft: 4 },
    reportItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
    reportIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    reportTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    reportDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
});
