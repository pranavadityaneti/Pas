import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, ActivityIndicator, Alert, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import BottomModal from '../../../src/components/BottomModal';
import { playSound } from '../../../src/lib/audio';

const SOUND_OPTIONS = [
    { id: 'Amber', label: 'Amber Alert ⚠️' },
    { id: 'Bell', label: 'Service Bell 🛎️' },
    { id: 'Alarm', label: 'Loud Alarm ⏰' },
    { id: 'Siren', label: 'Emergency Siren 🚨' },
];

export default function NotificationsScreen() {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);

    const [settings, setSettings] = useState({
        newOrder: true,
        orderCancelled: true,
        sound: true,
        vibration: true,
        soundType: 'Amber'
    });

    useEffect(() => {
        fetchUserAndSettings();
    }, []);

    const fetchUserAndSettings = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            setUserId(user.id);

            const { data, error } = await supabase
                .from('User')
                .select('notification_preferences')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching settings:', error);
            }

            if (data?.notification_preferences) {
                setSettings(prev => ({ ...prev, ...data.notification_preferences }));
            }
        } catch (error) {
            console.error('Error in fetchUserAndSettings:', error);
        } finally {
            setLoading(false);
        }
    };

    const updateSettings = async (newSettings: typeof settings) => {
        setSettings(newSettings); // Optimistic update
        if (!userId) return;

        try {
            const { error } = await supabase
                .from('User')
                .update({ notification_preferences: newSettings })
                .eq('id', userId);

            if (error) throw error;
        } catch (error) {
            console.error('Error updating settings:', error);
            // Revert on error? For now, we just log it.
        }
    };

    const toggle = (key: keyof typeof settings) => {
        const updated = { ...settings, [key]: !settings[key] };
        if (key === 'vibration' && !settings.vibration) {
            // Vibrate when turning on
            Vibration.vibrate();
        }
        updateSettings(updated);
    };

    const selectSound = (soundId: string) => {
        const updated = { ...settings, soundType: soundId };
        updateSettings(updated);
        setModalVisible(false);
        playSound(soundId);
        if (settings.vibration) {
            Vibration.vibrate();
        }
    };

    const currentSoundLabel = SOUND_OPTIONS.find(s => s.id === settings.soundType)?.label || 'Amber Alert';

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notification Sounds</Text>
                </View>
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notification Sounds</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <Text style={styles.sectionTitle}>Order Alerts</Text>

                <View style={styles.settingItem}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>New Order</Text>
                        <Text style={styles.settingDesc}>Get notified when a customer places an order</Text>
                    </View>
                    <Switch
                        value={settings.newOrder}
                        onValueChange={() => toggle('newOrder')}
                        trackColor={{ true: Colors.text, false: Colors.border }}
                    />
                </View>

                <View style={[styles.settingItem, styles.borderTop]}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Order Cancelled</Text>
                        <Text style={styles.settingDesc}>Alerts for customer cancellations</Text>
                    </View>
                    <Switch
                        value={settings.orderCancelled}
                        onValueChange={() => toggle('orderCancelled')}
                        trackColor={{ true: Colors.text, false: Colors.border }}
                    />
                </View>

                <Text style={[styles.sectionTitle, { marginTop: 32 }]}>General</Text>

                <View style={styles.settingItem}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>App Sounds</Text>
                        <Text style={styles.settingDesc}>Play sounds for in-app interactions</Text>
                    </View>
                    <Switch
                        value={settings.sound}
                        onValueChange={() => toggle('sound')}
                        trackColor={{ true: Colors.text, false: Colors.border }}
                    />
                </View>

                {/* Sound Selection Row - Only visible if sound is enabled */}
                {settings.sound && (
                    <TouchableOpacity style={[styles.settingItem, styles.borderTop]} onPress={() => setModalVisible(true)}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingLabel}>Alert Tone</Text>
                            <Text style={styles.settingDesc}>Choose a sound for important alerts</Text>
                        </View>
                        <View style={styles.valueRow}>
                            <Text style={styles.valueText}>{currentSoundLabel}</Text>
                            <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                        </View>
                    </TouchableOpacity>
                )}

                <View style={[styles.settingItem, styles.borderTop]}>
                    <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>Vibration</Text>
                        <Text style={styles.settingDesc}>Vibrate on incoming alerts</Text>
                    </View>
                    <Switch
                        value={settings.vibration}
                        onValueChange={() => toggle('vibration')}
                        trackColor={{ true: Colors.text, false: Colors.border }}
                    />
                </View>

            </ScrollView>

            <BottomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title="Select Alert Sound"
            >
                <View style={styles.modalContent}>
                    {SOUND_OPTIONS.map((option) => (
                        <TouchableOpacity
                            key={option.id}
                            style={styles.soundOption}
                            onPress={() => selectSound(option.id)}
                        >
                            <View style={styles.soundInfo}>
                                <Ionicons
                                    name={option.id === settings.soundType ? "radio-button-on" : "radio-button-off"}
                                    size={24}
                                    color={option.id === settings.soundType ? Colors.primary : Colors.textSecondary}
                                />
                                <Text style={[
                                    styles.soundLabel,
                                    option.id === settings.soundType && styles.soundLabelActive
                                ]}>
                                    {option.label}
                                </Text>
                            </View>
                            {option.id === settings.soundType && (
                                <Ionicons name="checkmark" size={20} color={Colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </BottomModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },

    settingItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, backgroundColor: Colors.white, paddingHorizontal: 16, borderRadius: 12 },
    borderTop: { borderTopWidth: 1, borderTopColor: Colors.border, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: -1 }, // Fixed margin
    settingInfo: { flex: 1, marginRight: 16 },
    settingLabel: { fontSize: 16, fontWeight: '600', color: Colors.text },
    settingDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    valueText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' },

    modalContent: { paddingBottom: 20 },
    soundOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
    soundInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    soundLabel: { fontSize: 16, color: Colors.textSecondary, fontWeight: '500' },
    soundLabelActive: { color: Colors.text, fontWeight: 'bold' },
});
