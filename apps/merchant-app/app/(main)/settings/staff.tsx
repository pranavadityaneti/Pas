import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import BottomModal from '../../../src/components/BottomModal';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import { useStore } from '../../../src/hooks/useStore';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import { useCreateManager } from '../../../src/hooks/useStaff';

const MOCK_BRANCHES = ['Main Store', 'Downtown Branch', 'Airport Branch'];

interface StaffMember {
    id: string;
    name: string;
    role: string;
    phone: string;
    initials: string;
    branchName: string;
    storeId: string;
    activities: string[];
}

export default function StaffScreen() {
    const { activeRole, merchantId } = useStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const { mutateAsync: provisionManager } = useCreateManager();

    // Fetch all branches for this merchant so we can (a) filter store_staff to all of them
    // and (b) resolve branch_name for each staff card.
    const [branchMap, setBranchMap] = useState<Map<string, string>>(new Map());
    const [branchIds, setBranchIds] = useState<string[]>([]);

    useEffect(() => {
        if (!merchantId) return;
        (async () => {
            const { data } = await supabase
                .from('merchant_branches')
                .select('id, branch_name')
                .eq('merchant_id', merchantId);
            if (data) {
                const map = new Map<string, string>();
                data.forEach((b: any) => map.set(b.id, b.branch_name));
                setBranchMap(map);
                setBranchIds(data.map((b: any) => b.id));
            }
        })();
    }, [merchantId]);

    // Realtime Data Hook — fetch all active staff (no store_id filter; client-side filter below)
    const { data: rawStaff, loading: tableLoading, setData } = useRealtimeTable({
        tableName: 'store_staff',
        filter: 'is_active=eq.true',
        orderBy: { column: 'created_at', ascending: false },
        enabled: branchIds.length > 0
    });

    const staff = useMemo(() => {
        const branchIdSet = new Set(branchIds);
        return rawStaff
            .filter(item => item.is_active !== false && branchIdSet.has(item.store_id))
            .map(item => ({
                id: item.id,
                name: item.name,
                role: item.role,
                phone: item.phone,
                storeId: item.store_id,
                branchName: branchMap.get(item.store_id) || 'Unknown branch',
                initials: item.name ? item.name.charAt(0).toUpperCase() : '?',
                activities: Array.isArray(item.activities) ? item.activities : []
            })) as StaffMember[];
    }, [rawStaff, branchMap, branchIds]);

    const loading = tableLoading && staff.length === 0;

    // Form State
    const [name, setName] = useState('');
    const [role, setRole] = useState('Cashier/Staff');
    const [phone, setPhone] = useState('');
    const [branch, setBranch] = useState(MOCK_BRANCHES[0]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Feature Flag / Logic for Branches
    const hasBranches = false;

    const openAddModal = () => {
        setEditingId(null);
        setName('');
        setRole('Cashier/Staff');
        setPhone('');
        setBranch(MOCK_BRANCHES[0]);
        setModalVisible(true);
    };

    const openEditModal = (member: StaffMember) => {
        setEditingId(member.id);
        setName(member.name);
        setRole(member.role);
        setPhone(member.phone);
        setBranch(member.branchName || MOCK_BRANCHES[0]);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name || !role || !phone) {
            Alert.alert('Error', 'Please fill in all mandatory fields');
            return;
        }

        const sanitizedPhone = phone.replace(/\D/g, '');

        if (sanitizedPhone.length !== 10) {
            Alert.alert('Error', 'Phone number must be exactly 10 digits');
            return;
        }

        if (!activeRole?.id) {
            Alert.alert('Error', 'Store/Branch ID not found. Refreshing your profile...');
            return;
        }

        setActionLoading(true);

        try {
            const payload = {
                store_id: activeRole.id,
                name,
                role,
                phone: sanitizedPhone,
                activities: []
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
                        activities: []
                    })
                    .eq('id', editingId);

                if (error) throw error;
                Alert.alert('Success', 'Staff member updated successfully');
            } else {
                // Optimistic Add
                const tempId = `temp-${Date.now()}`;
                const tempMember = { ...payload, id: tempId, is_active: true };
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

                // Replace temp ID with real ID
                // @ts-ignore
                setData(prev => prev.map(p => p.id === tempId ? newStaff : p));
                Alert.alert('Success', 'Staff member added successfully');
            }

            // --- RBAC KEYMAKER WIRING ---
            if (role.toLowerCase().includes('manager')) {
                try {
                    await provisionManager({
                        phone: sanitizedPhone,
                        name,
                        storeId: activeRole?.id || ''
                    });
                } catch (provisionError: any) {
                    console.error('Keymaker Provisioning Error:', provisionError);
                    Alert.alert(
                        'Staff Saved',
                        'Staff details saved successfully, but we failed to provision their manager account. They may not be able to log in yet.'
                    );
                }
            }
            // --- END RBAC WIRING ---

            setModalVisible(false);

        } catch (error: any) {
            console.error('Error saving staff:', error);
            const message = error.code === '23505' 
                ? 'A staff member with this phone number already exists.' 
                : 'Failed to save staff member. Please try again.';
            Alert.alert('Error', message);
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

                    {staff.map((member) => {
                        const isOwner = member.role?.toLowerCase() === 'owner';
                        const privileges = member.activities.length > 0
                            ? member.activities
                            : (isOwner ? ['Full access'] : ['Not set']);
                        return (
                            <View key={member.id} style={styles.card}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{member.initials}</Text>
                                </View>
                                <View style={styles.info}>
                                    <Text style={styles.name}>{member.name}</Text>
                                    <Text style={styles.role}>{member.role}</Text>
                                    <View style={styles.metaRow}>
                                        <Ionicons name="storefront-outline" size={12} color={Colors.textSecondary} />
                                        <Text style={styles.metaText}>{member.branchName}</Text>
                                    </View>
                                    <View style={styles.metaRow}>
                                        <Ionicons name="call-outline" size={12} color={Colors.textSecondary} />
                                        <Text style={styles.metaText}>{member.phone}</Text>
                                    </View>
                                    <View style={styles.privilegesRow}>
                                        {privileges.map((p, idx) => (
                                            <View key={idx} style={[styles.privilegeChip, isOwner && member.activities.length === 0 && styles.privilegeChipOwner]}>
                                                <Text style={[styles.privilegeText, isOwner && member.activities.length === 0 && styles.privilegeTextOwner]}>{p}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <View style={styles.actions}>
                                    <TouchableOpacity style={styles.iconButton} onPress={() => openEditModal(member)}>
                                        <Ionicons name="pencil" size={20} color={Colors.text} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })}

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
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {['Branch Manager', 'Cashier/Staff'].map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={{
                                        flex: 1,
                                        padding: 12,
                                        borderRadius: 12,
                                        borderWidth: 1,
                                        borderColor: role === r ? Colors.primary : Colors.border,
                                        backgroundColor: role === r ? Colors.primary + '10' : Colors.white,
                                        alignItems: 'center'
                                    }}
                                    onPress={() => setRole(r)}
                                >
                                    <Text style={{ 
                                        color: role === r ? Colors.primary : Colors.text,
                                        fontWeight: role === r ? '600' : '500'
                                    }}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Phone Number <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="10-digit mobile number"
                            placeholderTextColor={Colors.textSecondary}
                            keyboardType="phone-pad"
                            maxLength={10}
                            value={phone || ''} // Safety guard
                            onChangeText={setPhone}
                        />
                    </View>

                    {/* Conditional Branch Selector */}
                    {hasBranches && (
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Assign Branch</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchScroll}>
                                {MOCK_BRANCHES.map(b => (
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

    card: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors.white, padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.border, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
    avatarText: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary },
    info: { flex: 1, marginLeft: 12 },
    name: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
    role: { fontSize: 13, color: Colors.primary, marginTop: 2, fontWeight: '600' },
    phone: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
    branchRole: { fontSize: 11, color: Colors.primary, marginTop: 2, fontWeight: '600' },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    metaText: { fontSize: 12, color: Colors.textSecondary },
    privilegesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    privilegeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
    privilegeChipOwner: { backgroundColor: '#ECFDF5', borderColor: '#10B981' },
    privilegeText: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
    privilegeTextOwner: { color: '#065F46' },

    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    iconButton: { padding: 8 },

    addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, padding: 16, borderRadius: 16, marginTop: 24 },
    addButtonText: { color: Colors.white, fontSize: 16, fontWeight: 'bold' },

    loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
    emptyContainer: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emptyIconContainer: { width: 120, height: 120, borderRadius: 60, backgroundColor: Colors.border + '33', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 8, textAlign: 'center' },
    emptySubtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 20 },
    emptyAddButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
    emptyAddButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },

    form: { gap: 16, paddingBottom: 20 },
    inputGroup: {},
    inputLabel: { fontSize: 14, fontWeight: '600', color: Colors.text, marginBottom: 8 },
    input: { borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 14, fontSize: 16, color: Colors.text },

    branchScroll: { flexDirection: 'row', gap: 8 },
    branchPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.border, marginRight: 8 },
    branchPillActive: { backgroundColor: Colors.primary },
    branchText: { color: Colors.textSecondary, fontWeight: '600' },
    branchTextActive: { color: Colors.white },

    modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
    modalCancel: { flex: 1, padding: 16, backgroundColor: Colors.border, borderRadius: 12, alignItems: 'center' },
    modalCancelText: { fontWeight: '700', color: Colors.text, fontSize: 16 },
    modalSave: { flex: 1, padding: 16, backgroundColor: Colors.primary, borderRadius: 12, alignItems: 'center' },
    modalSaveText: { fontWeight: '700', color: Colors.white, fontSize: 16 },
});
