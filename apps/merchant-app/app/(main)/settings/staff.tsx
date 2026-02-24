import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import BottomModal from '../../../src/components/BottomModal';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import { useStore } from '../../../src/hooks/useStore';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';



interface StaffMember {
    id: string;
    name: string;
    role: string;
    phone: string;
    initials: string;
    branch?: string;
    activities?: string[];
}

export default function StaffScreen() {
    const { storeId } = useStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);

    // Realtime Data Hook
    const { data: rawStaff, loading: tableLoading, setData } = useRealtimeTable({
        tableName: 'store_staff',
        filter: storeId ? `store_id=eq.${storeId}` : undefined,
        orderBy: { column: 'created_at', ascending: false },
        enabled: !!storeId
    });

    const staff = useMemo(() => {
        return rawStaff.map(item => ({
            id: item.id,
            name: item.name,
            role: item.role,
            phone: item.phone,
            branch: item.branch,
            initials: item.name ? item.name.charAt(0).toUpperCase() : '?',
            activities: Array.isArray(item.activities) ? item.activities : []
        })) as StaffMember[];
    }, [rawStaff]);

    const loading = tableLoading && staff.length === 0;

    // Form State
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [phone, setPhone] = useState('');
    const [branch, setBranch] = useState('');
    const [activities, setActivities] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Feature Flag / Logic for Branches
    const hasBranches = false;

    const ACTIVITY_OPTIONS = [
        'Order Management',
        'Analytics & Reports',
        'Settings & Profile',
        'Staff Management'
    ];

    const openAddModal = () => {
        setEditingId(null);
        setName('');
        setRole('');
        setPhone('');
        setBranch('');
        setActivities([]);
        setModalVisible(true);
    };

    const openEditModal = (member: StaffMember) => {
        setEditingId(member.id);
        setName(member.name);
        setRole(member.role);
        setPhone(member.phone);
        setBranch(member.branch || '');
        // @ts-ignore: assuming activities exists in member or I need to update fetch
        setActivities(member.activities || []);
        setModalVisible(true);
    };

    const toggleActivity = (activity: string) => {
        if (activities.includes(activity)) {
            setActivities(activities.filter(a => a !== activity));
        } else {
            setActivities([...activities, activity]);
        }
    };

    const handleSave = async () => {
        if (!name || !role || !phone) {
            Alert.alert('Error', 'Please fill in all mandatory fields');
            return;
        }

        if (!storeId) return;

        setActionLoading(true);

        try {
            const payload = {
                store_id: storeId,
                name,
                role,
                phone,
                branch,
                activities: activities
            };

            if (editingId) {
                // Optimistic Update
                // @ts-ignore
                setData(prev => prev.map(p => p.id === editingId ? { ...p, ...payload } : p));

                // Update Existing
                const { error } = await supabase
                    .from('store_staff')
                    .update({
                        name,
                        role,
                        phone,
                        branch,
                        activities
                    })
                    .eq('id', editingId);

                if (error) throw error;
            } else {
                // Optimistic Add
                const tempId = `temp-${Date.now()}`;
                const tempMember = { ...payload, id: tempId };
                // @ts-ignore
                setData(prev => [tempMember, ...prev]);

                // Add New
                const { data: newStaff, error } = await supabase
                    .from('store_staff')
                    .insert([payload])
                    .select()
                    .single();

                if (error) {
                    // Revert optimistic add on error
                    // @ts-ignore
                    setData(prev => prev.filter(p => p.id !== tempId));
                    throw error;
                }

                // Replace temp ID with real ID (if Realtime doesn't beat us to it)
                // @ts-ignore
                setData(prev => prev.map(p => p.id === tempId ? newStaff : p));
            }

            // Refresh list
            // await fetchStaff(); // Auto-updated via realtime
            setModalVisible(false);

        } catch (error) {
            console.error('Error saving staff:', error);
            Alert.alert('Error', 'Failed to save staff member');
        } finally {
            setActionLoading(false);
        }
    };

    // ... handleDelete ...

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Staff Management</Text>
            </View>

            {/* List */}
            {loading ? (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : staff.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconContainer}>
                        <Ionicons name="people-outline" size={60} color={Colors.text} />
                    </View>
                    <Text style={styles.emptyTitle}>No Staff Members</Text>
                    <Text style={styles.emptySubtitle}>
                        Add staff members to help manage your store operations.
                    </Text>
                    <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
                        <Ionicons name="add" size={24} color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.emptyAddButtonText}>Add First Staff</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Total Staff</Text>
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{staff.length}</Text>
                        </View>
                    </View>

                    {staff.map((member) => (
                        <View key={member.id} style={styles.card}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{member.initials}</Text>
                            </View>
                            <View style={styles.info}>
                                <Text style={styles.name}>{member.name}</Text>
                                <Text style={styles.role}>{member.role}</Text>
                                <Text style={styles.phone}>{member.phone}</Text>
                                {member.branch && <Text style={styles.branchRole}>{member.branch}</Text>}
                            </View>
                            <View style={styles.actions}>
                                <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(member)}>
                                    <Ionicons name="pencil" size={20} color={Colors.text} />
                                </TouchableOpacity>
                                {/* Note: Delete functionality should be added here later */}
                            </View>
                        </View>
                    ))}

                    <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                        <Ionicons name="add" size={24} color={Colors.white} style={{ marginRight: 8 }} />
                        <Text style={styles.addButtonText}>Add Staff Member</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            <BottomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={editingId ? "Edit Staff" : "Add New Staff"}
            >

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Full Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Ravi Kumar"
                            placeholderTextColor={Colors.textSecondary}
                            value={name || ''} // Safety guard
                            onChangeText={setName}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Role <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Store Manager"
                            placeholderTextColor={Colors.textSecondary}
                            value={role || ''} // Safety guard
                            onChangeText={setRole}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Phone Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="+91 XXXXX XXXXX"
                            placeholderTextColor={Colors.textSecondary}
                            keyboardType="phone-pad"
                            value={phone || ''} // Safety guard
                            onChangeText={setPhone}
                        />
                    </View>

                    {/* Conditional Branch Selector */}
                    {hasBranches && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Assign Branch</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchScroll}>
                                {['Main Store'].map(b => (
                                    <TouchableOpacity
                                        key={b}
                                        style={[styles.branchPill, branch === b && styles.branchPillActive]}
                                        onPress={() => setBranch(b)}
                                    >
                                        <Text style={[styles.branchText, branch === b && styles.branchTextActive]}>{b}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Allowed Activities</Text>
                        <Text style={{ fontSize: 12, color: Colors.textSecondary, marginBottom: 8 }}>Select what this staff member can access</Text>
                        <View style={{ gap: 8 }}>
                            {ACTIVITY_OPTIONS.map((activity) => {
                                const isSelected = activities.includes(activity);
                                return (
                                    <TouchableOpacity
                                        key={activity}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 12,
                                            borderRadius: 12,
                                            backgroundColor: isSelected ? Colors.text + '10' : Colors.white,
                                            borderWidth: 1,
                                            borderColor: isSelected ? Colors.text : Colors.border
                                        }}
                                        onPress={() => toggleActivity(activity)}
                                    >
                                        <View style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: 6,
                                            borderWidth: 1.5,
                                            borderColor: isSelected ? Colors.text : Colors.textSecondary,
                                            backgroundColor: isSelected ? Colors.text : 'transparent',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                            marginRight: 12
                                        }}>
                                            {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                                        </View>
                                        <Text style={{
                                            fontSize: 14,
                                            fontWeight: isSelected ? '600' : '500',
                                            color: Colors.text
                                        }}>{activity}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.modalActions}>
                        <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.modalSave, actionLoading && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={actionLoading}
                        >
                            <Text style={styles.modalSaveText}>
                                {actionLoading ? 'Saving...' : (editingId ? 'Update Staff' : 'Add Staff')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

            </BottomModal >
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.border },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
    content: { padding: 16 },

    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    badge: { backgroundColor: Colors.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    badgeText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
    emptyText: { textAlign: 'center', color: Colors.textSecondary, marginTop: 20, fontSize: 14 },

    card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 20, borderRadius: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 20, fontWeight: '600', color: Colors.textSecondary },
    info: { flex: 1, marginLeft: 16 },
    name: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
    role: { fontSize: 15, color: Colors.textSecondary, marginTop: 4 },
    phone: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
    branchRole: { fontSize: 11, color: Colors.primary, marginTop: 2, fontWeight: '600' },

    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconButton: { padding: 8 },

    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.text, padding: 16, borderRadius: 16, marginTop: 24 },
    addButtonText: { color: Colors.white, fontSize: 16, fontWeight: 'bold' },

    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.border + '33', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 8, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
    emptyAddButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.text, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
    emptyAddButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },

    form: { gap: 16, paddingBottom: 20 },
    inputGroup: {},
    inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 16, color: Colors.text },

    branchScroll: { flexDirection: 'row', gap: 8 },
    branchPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.border, marginRight: 8 },
    branchPillActive: { backgroundColor: Colors.text },
    branchText: { color: Colors.textSecondary, fontWeight: '600' },
    branchTextActive: { color: Colors.white },

    modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalCancel: { flex: 1, padding: 16, backgroundColor: Colors.border, borderRadius: 12, alignItems: 'center' },
    modalCancelText: { fontWeight: '700', color: Colors.text, fontSize: 16 },
    modalSave: { flex: 1, padding: 16, backgroundColor: Colors.text, borderRadius: 12, alignItems: 'center' },
    modalSaveText: { fontWeight: '700', color: Colors.white, fontSize: 16 },
});
