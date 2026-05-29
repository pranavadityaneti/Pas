import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useStoreContext } from '../../../src/context/StoreContext';
import { Colors } from '../../../constants/Colors';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const GAP_OPTIONS = [30, 45, 60];

interface SlotRule {
    days: number[];
    tables_per_slot: number;
    slot_gap_minutes: number;
}

export default function SlotConfigScreen() {
    const { store, updateStoreDetails } = useStoreContext();
    const [saving, setSaving] = useState(false);
    const [rules, setRules] = useState<SlotRule[]>([
        { days: [0, 1, 2, 3, 4], tables_per_slot: 3, slot_gap_minutes: 30 }
    ]);

    useEffect(() => {
        if (store?.slot_config && Array.isArray(store.slot_config) && store.slot_config.length > 0) {
            setRules(store.slot_config);
        }
    }, [store]);

    const toggleDay = (ruleIndex: number, dayIndex: number) => {
        setRules(prev => {
            const updated = [...prev];
            const rule = { ...updated[ruleIndex] };
            if (rule.days.includes(dayIndex)) {
                rule.days = rule.days.filter(d => d !== dayIndex);
            } else {
                rule.days = [...rule.days, dayIndex].sort();
            }
            updated[ruleIndex] = rule;
            return updated;
        });
    };

    const updateTablesPerSlot = (ruleIndex: number, delta: number) => {
        setRules(prev => {
            const updated = [...prev];
            const rule = { ...updated[ruleIndex] };
            const newVal = rule.tables_per_slot + delta;
            if (newVal >= 1 && newVal <= 20) {
                rule.tables_per_slot = newVal;
            }
            updated[ruleIndex] = rule;
            return updated;
        });
    };

    const updateGap = (ruleIndex: number, gap: number) => {
        setRules(prev => {
            const updated = [...prev];
            updated[ruleIndex] = { ...updated[ruleIndex], slot_gap_minutes: gap };
            return updated;
        });
    };

    const addRule = () => {
        // Find unused days
        const usedDays = rules.flatMap(r => r.days);
        const availableDays = [0, 1, 2, 3, 4, 5, 6].filter(d => !usedDays.includes(d));
        if (availableDays.length === 0) {
            Alert.alert('All Days Assigned', 'All days of the week are already assigned to a rule.');
            return;
        }
        setRules(prev => [...prev, { days: availableDays, tables_per_slot: 3, slot_gap_minutes: 30 }]);
    };

    const removeRule = (index: number) => {
        if (rules.length <= 1) {
            Alert.alert('Minimum Required', 'At least one slot rule is required.');
            return;
        }
        setRules(prev => prev.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        // Validate
        for (const rule of rules) {
            if (rule.days.length === 0) {
                Alert.alert('Invalid Config', 'Each rule must have at least one day selected.');
                return;
            }
        }

        setSaving(true);
        try {
            const { success, error } = await updateStoreDetails({ slot_config: rules } as any);
            if (!success) throw new Error(error);
            Alert.alert('Success', 'Slot configuration saved');
            router.back();
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to save slot configuration');
        } finally {
            setSaving(false);
        }
    };

    // Generate preview slots based on operating hours
    const generatePreview = (rule: SlotRule) => {
        if (!store?.operating_hours) return [];
        const oh = store.operating_hours;
        const openMinutes = parseTimeToMinutes(oh.open || '09:00');
        const closeMinutes = parseTimeToMinutes(oh.close || '22:00');
        const lunchStart = oh.hasLunchBreak ? parseTimeToMinutes(oh.lunchStart || '13:00') : null;
        const lunchEnd = oh.hasLunchBreak ? parseTimeToMinutes(oh.lunchEnd || '14:00') : null;

        const slots: string[] = [];
        for (let m = openMinutes; m <= closeMinutes - rule.slot_gap_minutes; m += rule.slot_gap_minutes) {
            if (lunchStart !== null && lunchEnd !== null && m >= lunchStart && m < lunchEnd) continue;
            const h = Math.floor(m / 60);
            const min = m % 60;
            slots.push(`${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
        }
        return slots;
    };

    const parseTimeToMinutes = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };

    const formatTime12h = (time24: string) => {
        const [h, m] = time24.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
    };

    if (!store?.service_table_booking) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Table Booking Slots</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
                    <Ionicons name="lock-closed-outline" size={48} color="#9CA3AF" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' }}>
                        Table Booking is disabled
                    </Text>
                    <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center' }}>
                        Enable "Table Booking" in Store Timings → Service Modes to configure slots.
                    </Text>
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
                <Text style={styles.headerTitle}>Table Booking Slots</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {rules.map((rule, ruleIndex) => (
                    <View key={ruleIndex} style={styles.card}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.cardTitle}>Rule {ruleIndex + 1}</Text>
                            {rules.length > 1 && (
                                <TouchableOpacity onPress={() => removeRule(ruleIndex)}>
                                    <Ionicons name="trash-outline" size={20} color="#DC2626" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Days selector */}
                        <Text style={styles.label}>DAYS</Text>
                        <View style={styles.daysContainer}>
                            {DAYS.map((day, dayIndex) => {
                                const isSelected = rule.days.includes(dayIndex);
                                // Check if used in another rule
                                const usedElsewhere = rules.some((r, i) => i !== ruleIndex && r.days.includes(dayIndex));
                                return (
                                    <TouchableOpacity
                                        key={dayIndex}
                                        style={[
                                            styles.dayPill,
                                            isSelected && styles.dayPillActive,
                                            usedElsewhere && !isSelected && { opacity: 0.3 }
                                        ]}
                                        onPress={() => !usedElsewhere && toggleDay(ruleIndex, dayIndex)}
                                        disabled={usedElsewhere && !isSelected}
                                    >
                                        <Text style={[styles.dayText, isSelected && styles.dayTextActive]}>{day}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        <View style={styles.divider} />

                        {/* Tables per slot */}
                        <Text style={styles.label}>TABLES PER SLOT</Text>
                        <View style={styles.stepperRow}>
                            <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={() => updateTablesPerSlot(ruleIndex, -1)}
                                disabled={rule.tables_per_slot <= 1}
                            >
                                <Ionicons name="remove" size={20} color={rule.tables_per_slot <= 1 ? '#D1D5DB' : Colors.text} />
                            </TouchableOpacity>
                            <View style={styles.stepperValue}>
                                <Text style={styles.stepperValueText}>{rule.tables_per_slot}</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.stepperButton}
                                onPress={() => updateTablesPerSlot(ruleIndex, 1)}
                                disabled={rule.tables_per_slot >= 20}
                            >
                                <Ionicons name="add" size={20} color={rule.tables_per_slot >= 20 ? '#D1D5DB' : Colors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.divider} />

                        {/* Slot gap */}
                        <Text style={styles.label}>SLOT GAP</Text>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {GAP_OPTIONS.map((gap) => (
                                <TouchableOpacity
                                    key={gap}
                                    style={[
                                        styles.gapChip,
                                        rule.slot_gap_minutes === gap && styles.gapChipActive
                                    ]}
                                    onPress={() => updateGap(ruleIndex, gap)}
                                >
                                    <Text style={[
                                        styles.gapChipText,
                                        rule.slot_gap_minutes === gap && styles.gapChipTextActive
                                    ]}>{gap}m</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.divider} />

                        {/* Preview */}
                        <Text style={styles.label}>SLOT PREVIEW</Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 8 }}>
                            {rule.days.map(d => DAY_NAMES[d]).join(', ')} • {rule.tables_per_slot} tables/slot
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: 6, paddingVertical: 4 }}>
                                {generatePreview(rule).map((slot) => (
                                    <View key={slot} style={styles.previewChip}>
                                        <Text style={styles.previewChipText}>{formatTime12h(slot)}</Text>
                                    </View>
                                ))}
                            </View>
                        </ScrollView>
                    </View>
                ))}

                {/* Add Rule Button */}
                <TouchableOpacity style={styles.addRuleButton} onPress={addRule}>
                    <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                    <Text style={styles.addRuleText}>Add Weekend/Weekday Rule</Text>
                </TouchableOpacity>
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons name="save-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.saveText}>Save Slot Config</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16, paddingBottom: 100 },

    card: { backgroundColor: Colors.white, borderRadius: 20, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },

    label: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
    divider: { height: 1, backgroundColor: Colors.border, marginVertical: 16 },

    daysContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    dayPill: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    dayPillActive: { backgroundColor: Colors.primary },
    dayText: { color: Colors.textSecondary, fontWeight: 'bold', fontSize: 13 },
    dayTextActive: { color: Colors.white },

    stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepperButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
    stepperValue: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: '#F3F4F6', borderRadius: 12 },
    stepperValueText: { fontSize: 20, fontWeight: '700', color: Colors.text },

    gapChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.white },
    gapChipActive: { backgroundColor: Colors.primary + '10', borderColor: Colors.primary },
    gapChipText: { fontWeight: '600', color: Colors.textSecondary },
    gapChipTextActive: { color: Colors.primary },

    previewChip: { paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#F0FDF4', borderRadius: 8, borderWidth: 1, borderColor: '#BBF7D0' },
    previewChipText: { fontSize: 11, fontWeight: '600', color: '#166534' },

    addRuleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', marginBottom: 16 },
    addRuleText: { marginLeft: 8, fontSize: 14, fontWeight: '600', color: Colors.primary },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: Colors.white, borderTopWidth: 1, borderTopColor: Colors.border },
    saveButton: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    saveText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
});
