import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import BottomModal from '../../../src/components/BottomModal';
import { Colors } from '../../../constants/Colors';
import { supabase } from '../../../src/lib/supabase';
import { useStore } from '../../../src/hooks/useStore';

const MOCK_BRANCHES = ['Main Store', 'Downtown Branch', 'Airport Branch'];

interface StaffMember {
    id: string;
    name: string;
    role: string;
    phone: string;
    initials: string;
    branch?: string;
}

export default function StaffScreen() {
    const { storeId } = useStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [phone, setPhone] = useState('');
    const [branch, setBranch] = useState(MOCK_BRANCHES[0]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Feature Flag / Logic for Branches
    const hasBranches = false;

    useEffect(() => {
        if (storeId) {
            fetchStaff();
        }
    }, [storeId]);

    const fetchStaff = async () => {
        try {
            const { data, error } = await supabase
                .from('StoreStaff')
                .select('*')
                .eq('store_id', storeId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                // Map DB fields to UI if needed, currently they match roughly
                // initials are generated in DB but good to have fallback
                const formatted: StaffMember[] = data.map(item => ({
                    id: item.id,
                    name: item.name,
                    role: item.role,
                    phone: item.phone,
                    branch: item.branch,
                    initials: item.name ? item.name.charAt(0).toUpperCase() : '?'
                }));
                setStaff(formatted);
            }
        } catch (error) {
            console.error('Error fetching staff:', error);
        } finally {
            setLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingId(null);
        setName('');
        setRole('');
        setPhone('');
        setBranch(MOCK_BRANCHES[0]);
        setModalVisible(true);
    };

    const openEditModal = (member: StaffMember) => {
        setEditingId(member.id);
        setName(member.name);
        setRole(member.role);
        setPhone(member.phone);
        setBranch(member.branch || MOCK_BRANCHES[0]);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!name || !role || !phone) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        if (!storeId) return;

        setActionLoading(true);

        try {
            if (editingId) {
                // Update Existing
                const { error } = await supabase
                    .from('StoreStaff')
                    .update({ name, role, phone, branch })
                    .eq('id', editingId);

                if (error) throw error;
            } else {
                // Add New
                const { error } = await supabase
                    .from('StoreStaff')
                    .insert([{
                        store_id: storeId,
                        name,
                        role,
                        phone,
                        branch
                    }]);

                if (error) throw error;
            }

            // Refresh list
            await fetchStaff();
            setModalVisible(false);

        } catch (error) {
            console.error('Error saving staff:', error);
            Alert.alert('Error', 'Failed to save staff member');
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Staff', 'Are you sure you want to remove this staff member?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        const { error } = await supabase
                            .from('StoreStaff')
                            .delete()
                            .eq('id', id);

                        if (error) throw error;

                        // Optimistic update or refetch
                        setStaff(staff.filter(s => s.id !== id));
                    } catch (error) {
                        console.error('Error deleting staff:', error);
                        Alert.alert('Error', 'Failed to delete staff member');
                    }
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Staff Management</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Staff Members</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{staff.length} Active</Text>
                    </View>
                </View>

                {loading ? (
                    <View style={styles.loaderContainer}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <>
                        {staff.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <View style={styles.emptyIconContainer}>
                                    <Ionicons name="people-outline" size={64} color={Colors.border} />
                                </View>
                                <Text style={styles.emptyTitle}>No Staff Members Yet</Text>
                                <Text style={styles.emptySubtitle}>Add your team members here to help manage your store operations.</Text>
                                <TouchableOpacity style={styles.emptyAddButton} onPress={openAddModal}>
                                    <Ionicons name="person-add" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.emptyAddButtonText}>Add Your First Staff</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <>
                                {staff.map(member => (
                                    <TouchableOpacity key={member.id} style={styles.card} onPress={() => openEditModal(member)}>
                                        <View style={styles.avatar}>
                                            <Text style={styles.avatarText}>{member.initials}</Text>
                                        </View>
                                        <View style={styles.info}>
                                            <Text style={styles.name}>{member.name}</Text>
                                            <Text style={styles.role}>{member.role}</Text>
                                            <Text style={styles.phone}>{member.phone}</Text>
                                            {hasBranches && <Text style={styles.branchRole}>{member.branch}</Text>}
                                        </View>
                                        <View style={styles.actions}>
                                            <TouchableOpacity onPress={() => openEditModal(member)} style={styles.iconButton}>
                                                <MaterialCommunityIcons name="pencil-outline" size={20} color={Colors.textSecondary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(member.id); }} style={styles.iconButton}>
                                                <Ionicons name="trash-outline" size={20} color={Colors.error} />
                                            </TouchableOpacity>
                                        </View>
                                    </TouchableOpacity>
                                ))}

                                <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
                                    <Ionicons name="person-add-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                                    <Text style={styles.addButtonText}>Add New Staff</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </>
                )}
            </ScrollView>

            <BottomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={editingId ? "Edit Staff" : "Add New Staff"}
            >
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Full Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Ravi Kumar"
                            placeholderTextColor={Colors.textSecondary}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Role</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Store Manager"
                            placeholderTextColor={Colors.textSecondary}
                            value={role}
                            onChangeText={setRole}
                        />
                    </View>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Phone Number</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="+91 XXXXX XXXXX"
                            placeholderTextColor={Colors.textSecondary}
                            keyboardType="phone-pad"
                            value={phone}
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
