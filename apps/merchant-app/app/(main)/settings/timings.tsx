import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useStoreContext } from '../../../src/context/StoreContext';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function TimingsScreen() {
    const { store, loading: storeLoading, updateStoreDetails } = useStoreContext();
    const [saving, setSaving] = useState(false);

    const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5]);
    const [openTime, setOpenTime] = useState(new Date(2022, 0, 1, 9, 0));
    const [closeTime, setCloseTime] = useState(new Date(2022, 0, 1, 21, 0));

    // Lunch Break
    const [hasLunchBreak, setHasLunchBreak] = useState(false);
    const [lunchStart, setLunchStart] = useState(new Date(2022, 0, 1, 13, 0));
    const [lunchEnd, setLunchEnd] = useState(new Date(2022, 0, 1, 14, 0));

    // Picker State
    const [isPickerVisible, setPickerVisible] = useState(false);
    const [pickerMode, setPickerMode] = useState<'open' | 'close' | 'lunchStart' | 'lunchEnd'>('open');

    useEffect(() => {
        if (store?.operating_hours && Object.keys(store.operating_hours).length > 0) {
            const oh = store.operating_hours;

            if (oh.days) setSelectedDays(oh.days);

            // Helper to parse time string "HH:mm" to Date object
            const parseTime = (timeStr: string) => {
                const [h, m] = timeStr.split(':').map(Number);
                const d = new Date();
                d.setHours(h, m, 0, 0);
                return d;
            };

            if (oh.open) setOpenTime(parseTime(oh.open));
            if (oh.close) setCloseTime(parseTime(oh.close));

            if (oh.hasLunchBreak !== undefined) setHasLunchBreak(oh.hasLunchBreak);
            if (oh.lunchStart) setLunchStart(parseTime(oh.lunchStart));
            if (oh.lunchEnd) setLunchEnd(parseTime(oh.lunchEnd));
        }
    }, [store]);

    const toggleDay = (index: number) => {
        if (selectedDays.includes(index)) {
            setSelectedDays(selectedDays.filter(d => d !== index));
        } else {
            setSelectedDays([...selectedDays, index].sort());
        }
    };

    const showDatePicker = (mode: 'open' | 'close' | 'lunchStart' | 'lunchEnd') => {
        setPickerMode(mode);
        setPickerVisible(true);
    };

    const handleConfirm = (date: Date) => {
        if (pickerMode === 'open') setOpenTime(date);
        else if (pickerMode === 'close') setCloseTime(date);
        else if (pickerMode === 'lunchStart') setLunchStart(date);
        else if (pickerMode === 'lunchEnd') setLunchEnd(date);

        setPickerVisible(false);
    };

    const handleSave = async () => {
        if (!store?.id) return;
        setSaving(true);

        // Format dates to HH:mm string
        const formatTime = (date: Date) => {
            return date.getHours().toString().padStart(2, '0') + ':' +
                date.getMinutes().toString().padStart(2, '0');
        };

        const payload = {
            days: selectedDays,
            open: formatTime(openTime),
            close: formatTime(closeTime),
            hasLunchBreak,
            lunchStart: hasLunchBreak ? formatTime(lunchStart) : null,
            lunchEnd: hasLunchBreak ? formatTime(lunchEnd) : null,
        };

        try {
            // Use Context for Optimistic Update
            const { success, error } = await updateStoreDetails({ operating_hours: payload });

            if (!success) throw new Error(error);

            Alert.alert('Success', 'Store timings updated successfully');
            router.back();
        } catch (error) {
            Alert.alert('Error', 'Failed to update store timings');
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const TimeDisplay = ({ time, label, onPress }: { time: Date, label: string, onPress: () => void }) => (
        <TouchableOpacity style={styles.timeBox} onPress={onPress}>
            <Text style={styles.timeValue}>
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Ionicons name="time-outline" size={20} color="#666" style={{ position: 'absolute', right: 12 }} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Store Timings</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <View style={styles.iconCircle}>
                            <Ionicons name="time" size={24} color={Colors.white} />
                        </View>
                        <View>
                            <Text style={styles.cardTitle}>Operating Hours</Text>
                            <Text style={styles.cardSubtitle}>Set your store's opening and closing time</Text>
                        </View>
                    </View>

                    <View style={styles.timeRow}>
                        <View style={styles.timeCol}>
                            <Text style={styles.label}>OPENS AT</Text>
                            <TimeDisplay time={openTime} label="Open" onPress={() => showDatePicker('open')} />
                        </View>
                        <View style={styles.timeCol}>
                            <Text style={styles.label}>CLOSES AT</Text>
                            <TimeDisplay time={closeTime} label="Close" onPress={() => showDatePicker('close')} />
                        </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.rowBetween}>
                        <Text style={[styles.label, { marginBottom: 0 }]}>LUNCH / DINNER</Text>
                        <Switch
                            value={hasLunchBreak}
                            onValueChange={setHasLunchBreak}
                            trackColor={{ false: Colors.border, true: Colors.text }}
                            thumbColor={Colors.white}
                        />
                    </View>

                    {hasLunchBreak && (
                        <View style={[styles.timeRow, { marginTop: 16 }]}>
                            <View style={styles.timeCol}>
                                <Text style={styles.label}>STARTS AT</Text>
                                <TimeDisplay time={lunchStart} label="Lunch Start" onPress={() => showDatePicker('lunchStart')} />
                            </View>
                            <View style={styles.timeCol}>
                                <Text style={styles.label}>ENDS AT</Text>
                                <TimeDisplay time={lunchEnd} label="Lunch End" onPress={() => showDatePicker('lunchEnd')} />
                            </View>
                        </View>
                    )}

                    <View style={styles.divider} />

                    <Text style={styles.label}>OPEN DAYS</Text>
                    <View style={styles.daysContainer}>
                        {DAYS.map((day, index) => {
                            const isSelected = selectedDays.includes(index);
                            return (
                                <TouchableOpacity
                                    key={index}
                                    style={[styles.dayPill, isSelected && styles.dayPillActive]}
                                    onPress={() => toggleDay(index)}
                                >
                                    <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={[styles.saveButton, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                    <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
            </View>

            <DateTimePickerModal
                isVisible={isPickerVisible}
                mode="time"
                onConfirm={handleConfirm}
                onCancel={() => setPickerVisible(false)}
                date={
                    pickerMode === 'open' ? openTime
                        : pickerMode === 'close' ? closeTime
                            : pickerMode === 'lunchStart' ? lunchStart
                                : lunchEnd
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    card: { backgroundColor: Colors.white, borderRadius: 20, padding: 24, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.text, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    cardSubtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },

    timeRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
    timeCol: { flex: 1 },
    label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
    timeBox: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: Colors.white },
    timeValue: { fontSize: 18, fontWeight: 'bold', color: Colors.text },

    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 24 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    daysContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    dayPill: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
    dayPillActive: { backgroundColor: Colors.text },
    dayText: { color: Colors.textSecondary, fontWeight: 'bold', fontSize: 14 },
    dayTextActive: { color: Colors.white },

    footer: { padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
    saveButton: { backgroundColor: Colors.text, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    saveText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
});
