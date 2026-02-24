
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../../../src/context/UserContext'; // Or useStore if linked strictly to store
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';
import BottomModal from '../../../src/components/BottomModal';

interface Branch {
    id: string;
    branch_name: string;
    address: string | null;
    manager_name: string | null;
    phone: string | null;
    is_active: boolean;
}

export default function BranchesScreen() {
    const router = useRouter();
    const { user } = useUser();

    // Fetch branches from DB
    const { data: branches, loading, error, setData: setBranches } = useRealtimeTable({
        tableName: 'merchant_branches',
        select: '*',
        filter: user?.id ? `merchant_id=eq.${user.id}` : undefined,
        enabled: !!user?.id
    });

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [saving, setSaving] = useState(false);

    // Form State
    const [form, setForm] = useState({
        name: '',
        address: '',
        manager: '',
        phone: ''
    });

    const openAddModal = () => {
        setEditingBranch(null);
        setForm({ name: '', address: '', manager: '', phone: '' });
        setModalVisible(true);
    };

    const openEditModal = (branch: Branch) => {
        setEditingBranch(branch);
        setForm({
            name: branch.branch_name,
            address: branch.address || '',
            manager: branch.manager_name || '',
            phone: branch.phone || ''
        });
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!user?.id) return;
        if (!form.name.trim()) {
            Alert.alert('Error', 'Branch Name is required');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                merchant_id: user.id,
                branch_name: form.name.trim(),
                address: form.address.trim() || null,
                manager_name: form.manager.trim() || null,
                phone: form.phone.trim() || null,
                is_active: true
            };

            if (editingBranch) {
                // Update
                const { data: updatedBranch, error: updateError } = await supabase
                    .from('merchant_branches')
                    .update(payload)
                    .eq('id', editingBranch.id)
                    .select()
                    .single();

                if (updateError) throw updateError;

                // Instant Update
                if (updatedBranch) {
                    setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
                }
            } else {
                // Insert
                const { data: newBranch, error: insertError } = await supabase
                    .from('merchant_branches')
                    .insert(payload)
                    .select()
                    .single();

                if (insertError) throw insertError;

                // Instant Add
                if (newBranch) {
                    setBranches(prev => [newBranch, ...prev]);
                }
            }

            setModalVisible(false);
            Alert.alert('Success', `Branch ${editingBranch ? 'updated' : 'added'} successfully`);
        } catch (e: any) {
            console.error('Save Error:', e);
            Alert.alert('Error', e.message || 'Failed to save branch');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('Delete Branch', 'Are you sure you want to delete this branch? This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    // Optimistic Delete
                    const previousBranches = branches;
                    setBranches(prev => prev.filter(b => b.id !== id));

                    const { error } = await supabase.from('merchant_branches').delete().eq('id', id);
                    if (error) {
                        // Revert on error
                        setBranches(previousBranches);
                        Alert.alert('Error', error.message);
                    }
                }
            }
        ]);
    };

    if (loading && !branches.length) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Branches</Text>
                <TouchableOpacity onPress={openAddModal} style={styles.addButton}>
                    <Ionicons name="add" size={24} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <FlatList
                data={branches}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="git-branch-outline" size={64} color="#E5E7EB" />
                        <Text style={styles.emptyText}>No branches added yet.</Text>
                        <TouchableOpacity style={styles.emptyBtn} onPress={openAddModal}>
                            <Text style={styles.emptyBtnText}>Add Your First Branch</Text>
                        </TouchableOpacity>
                    </View>
                }
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.iconBox}>
                                <Ionicons name="storefront-outline" size={24} color={Colors.primary} />
                            </View>
                            <View style={styles.cardInfo}>
                                <Text style={styles.branchName}>{item.branch_name}</Text>
                                <Text style={styles.branchAddress} numberOfLines={1}>
                                    {item.address || 'No address provided'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.cardActions}>
                            <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
                                <Text style={styles.actionText}>Edit</Text>
                            </TouchableOpacity>
                            <View style={styles.divider} />
                            <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
                                <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />

            <BottomModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                title={editingBranch ? "Edit Branch" : "Add New Branch"}
            >
                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Branch Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Kondapur Branch"
                            value={form.name}
                            onChangeText={t => setForm({ ...form, name: t })}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address</Text>
                        <TextInput
                            style={[styles.input, { height: 80 }]}
                            placeholder="Full address"
                            multiline
                            value={form.address}
                            onChangeText={t => setForm({ ...form, address: t })}
                        />
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Manager Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Store Manager"
                                value={form.manager}
                                onChangeText={t => setForm({ ...form, manager: t })}
                            />
                        </View>
                        <View style={{ width: 12 }} />
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Phone</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Contact Number"
                                keyboardType="phone-pad"
                                value={form.phone}
                                onChangeText={t => setForm({ ...form, phone: t })}
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, saving && { opacity: 0.7 }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Branch</Text>}
                    </TouchableOpacity>
                </View>
            </BottomModal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { padding: 4 },
    addButton: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    list: { padding: 20 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { marginTop: 16, fontSize: 16, color: '#6B7280', marginBottom: 24 },
    emptyBtn: { backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    emptyBtnText: { color: '#fff', fontWeight: 'bold' },

    card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    iconBox: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    cardInfo: { flex: 1 },
    branchName: { fontSize: 16, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
    branchAddress: { fontSize: 13, color: '#6B7280' },

    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
    actionBtn: { flex: 1, alignItems: 'center', paddingVertical: 4 },
    divider: { width: 1, backgroundColor: '#F3F4F6' },
    actionText: { fontWeight: '600', color: '#374151' },

    form: { paddingBottom: 20 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 12, fontSize: 15, backgroundColor: '#fff' },
    row: { flexDirection: 'row' },

    saveButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
