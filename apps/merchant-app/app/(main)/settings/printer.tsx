import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, ActivityIndicator, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';

interface Device {
    id: string;
    name: string;
    type: string;
}

export default function PrinterSettingsScreen() {
    const [isScanning, setIsScanning] = useState(false);
    const [devices, setDevices] = useState<Device[]>([]);
    const [connectedId, setConnectedId] = useState<string | null>(null);
    const [autoPrint, setAutoPrint] = useState(false);

    const handleScan = () => {
        setIsScanning(true);
        setDevices([]);
        // Simulate a scan
        setTimeout(() => {
            setDevices([
                { id: '1', name: 'BT-PRINTER-45A0', type: 'Bluetooth Printer' },
                { id: '2', name: 'T-80L Thermal', type: 'Bluetooth Printer' },
                { id: '3', name: 'Inner-Printer', type: 'System Printer' },
            ]);
            setIsScanning(false);
        }, 2000);
    };

    const handleConnect = (id: string) => {
        setConnectedId(id);
    };

    const renderDevice = ({ item }: { item: Device }) => {
        const isConnected = connectedId === item.id;
        return (
            <TouchableOpacity
                style={[styles.deviceCard, isConnected && styles.deviceCardActive]}
                onPress={() => handleConnect(item.id)}
            >
                <View style={styles.deviceIcon}>
                    <MaterialCommunityIcons name="printer-pos" size={24} color={isConnected ? Colors.white : Colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.deviceName, isConnected && styles.textWhite]}>{item.name}</Text>
                    <Text style={[styles.deviceType, isConnected && { color: '#aaa' }]}>{item.type}</Text>
                </View>
                {isConnected ? (
                    <View style={styles.connectedBadge}>
                        <Text style={styles.connectedText}>Connected</Text>
                    </View>
                ) : (
                    <Ionicons name="bluetooth" size={18} color="#9CA3AF" />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Printer Settings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                {/* Auto Print Toggle */}
                <View style={styles.settingsCard}>
                    <View style={styles.rowBetween}>
                        <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={styles.settingTitle}>Auto-print Receipts</Text>
                            <Text style={styles.settingDesc}>Automatically print a receipt when an order is accepted.</Text>
                        </View>
                        <Switch
                            value={autoPrint}
                            onValueChange={setAutoPrint}
                            trackColor={{ false: Colors.border, true: Colors.primary }}
                            thumbColor={Colors.white}
                        />
                    </View>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Available Printers</Text>
                    <TouchableOpacity onPress={handleScan} disabled={isScanning}>
                        {isScanning ? (
                            <ActivityIndicator size="small" color={Colors.primary} />
                        ) : (
                            <Text style={styles.scanText}>Rescan</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {devices.length === 0 && !isScanning ? (
                    <View style={styles.emptyState}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="print-outline" size={48} color="#9CA3AF" />
                        </View>
                        <Text style={styles.emptyTitle}>No Printer Found</Text>
                        <Text style={styles.emptyText}>Tap Scan to search for nearby Bluetooth thermal printers.</Text>
                        <TouchableOpacity style={styles.scanButton} onPress={handleScan}>
                            <Text style={styles.scanButtonText}>Scan for Devices</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.deviceList}>
                        {isScanning && devices.length === 0 ? (
                            <View style={styles.scanningPlaceholder}>
                                <ActivityIndicator size="large" color={Colors.primary} />
                                <Text style={styles.scanningText}>Searching for devices...</Text>
                            </View>
                        ) : (
                            devices.map(d => renderDevice({ item: d }))
                        )}
                    </View>
                )}

                <View style={styles.infoBox}>
                    <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
                    <Text style={styles.infoText}>
                        Make sure your Bluetooth printer is turned on and discoverable. Support for ESC/POS commands only.
                    </Text>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    settingsCard: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 32, borderWidth: 1, borderColor: Colors.border },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    settingDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    scanText: { color: Colors.primary, fontWeight: 'bold', fontSize: 14 },

    emptyState: { alignItems: 'center', paddingVertical: 40 },
    iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.white, justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 8 },
    emptyText: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
    scanButton: { backgroundColor: Colors.text, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16 },
    scanButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },

    deviceList: { gap: 12 },
    deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
    deviceCardActive: { backgroundColor: Colors.text, borderColor: Colors.text },
    deviceIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F9FAFB', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    deviceName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    deviceType: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    textWhite: { color: Colors.white },
    connectedBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    connectedText: { color: Colors.white, fontSize: 11, fontWeight: 'bold' },

    scanningPlaceholder: { alignItems: 'center', paddingVertical: 40 },
    scanningText: { marginTop: 16, color: Colors.textSecondary, fontSize: 14 },

    infoBox: { flexDirection: 'row', gap: 12, marginTop: 32, paddingHorizontal: 8 },
    infoText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
});
