
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, LogBox } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import uuid from 'react-native-uuid';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import { useUser } from '../../../src/context/UserContext'; // Or useStore if linked strictly to store
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors'
import BottomModal from '../../../src/components/BottomModal';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);interface Branch {
    id: string;
    branch_name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    manager_name: string | null;
    phone: string | null;
    is_active: boolean;
}

// Helper to extract city from Google Places address_components
function extractCity(details: any): string {
    const component = details?.address_components?.find((c: any) =>
        c.types.includes('locality')
    );
    return component?.long_name || '';
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAQAg7zpYvmd2BJGCGmf1opDLDC4KXbKUg';

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
    const placesRef = useRef<GooglePlacesAutocompleteRef | null>(null);

    // Form State
    const [form, setForm] = useState({
        name: '',
        address: '',
        latitude: null as number | null,
        longitude: null as number | null,
        city: '',
        manager: '',
        phone: ''
    });

    const openAddModal = () => {
        setEditingBranch(null);
        setForm({ name: '', address: '', latitude: null, longitude: null, city: '', manager: '', phone: '' });
        // Reset the autocomplete text after a brief delay (component needs to mount first)
        setTimeout(() => placesRef.current?.setAddressText(''), 100);
        setModalVisible(true);
    };

    const openEditModal = (branch: Branch) => {
        setEditingBranch(branch);
        setForm({
            name: branch.branch_name,
            address: branch.address || '',
            latitude: branch.latitude ?? null,
            longitude: branch.longitude ?? null,
            city: '',
            manager: branch.manager_name || '',
            phone: branch.phone || ''
        });
        // Pre-fill the autocomplete text
        setTimeout(() => placesRef.current?.setAddressText(branch.address || ''), 100);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!user?.id) return;
        if (!form.name.trim() || !form.address.trim() || !form.manager.trim() || !form.phone.trim()) {
            Alert.alert('Error', 'All fields are mandatory. Please fill in all details.');
            return;
        }

        // Validate that coordinates were captured from place selection
        if (form.address.trim() && (form.latitude === null || form.longitude === null)) {
            Alert.alert(
                'Select Address',
                'Please select an address from the dropdown suggestions so we can capture the precise location.'
            );
            return;
        }

        setSaving(true);
        try {
            const payload = {
                merchant_id: user.id,
                branch_name: form.name.trim(),
                address: form.address.trim() || null,
                latitude: form.latitude,
                longitude: form.longitude,
                city: form.city.trim() || null,
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
                    .insert({
                        ...payload,
                        id: uuid.v4() // Explicitly generate ID to avoid null constraint error
                    })
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
                                <View style={styles.branchDetailRow}>
                                    <Ionicons name="location-outline" size={14} color="#6B7280" />
                                    <Text style={styles.branchAddress} numberOfLines={1}>
                                        {item.address || 'No address provided'}
                                    </Text>
                                </View>
                                {(item.manager_name || item.phone) && (
                                    <View style={styles.managerInfoRow}>
                                        {item.manager_name && (
                                            <View style={styles.managerDetail}>
                                                <Ionicons name="person-outline" size={14} color="#6B7280" />
                                                <Text style={styles.managerText}>{item.manager_name}</Text>
                                            </View>
                                        )}
                                        {item.phone && (
                                            <View style={styles.managerDetail}>
                                                <Ionicons name="call-outline" size={14} color="#6B7280" />
                                                <Text style={styles.managerText}>{item.phone}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}
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

                    <View style={[styles.inputGroup, { zIndex: 9999 }]}>
                        <Text style={styles.label}>Address <Text style={{ color: '#EF4444' }}>*</Text></Text>
                        {GOOGLE_MAPS_API_KEY ? (
                            <GooglePlacesAutocomplete
                                ref={placesRef}
                                placeholder="Search address..."
                                fetchDetails={true}
                                onPress={(data, details = null) => {
                                    const city = extractCity(details);
                                    setForm(prev => ({
                                        ...prev,
                                        address: details?.formatted_address || data.description,
                                        latitude: details?.geometry?.location?.lat ?? null,
                                        longitude: details?.geometry?.location?.lng ?? null,
                                        city: city || prev.city,
                                    }));
                                }}
                                onFail={(error) => {
                                    console.error('Google API Error:', error);
                                    Alert.alert('Google Maps Error', String(error) || 'Check terminal for details');
                                }}
                                textInputProps={{
                                    onChangeText: (text: string) => {
                                        setForm(prev => ({ ...prev, address: text, latitude: null, longitude: null }));
                                    },
                                    placeholderTextColor: '#9CA3AF',
                                }}
                                query={{
                                    key: GOOGLE_MAPS_API_KEY,
                                    language: 'en',
                                    components: 'country:in',
                                }}
                                styles={{
                                    container: { flex: 0, width: '100%', zIndex: 9999 },
                                    textInput: {
                                        borderWidth: 1,
                                        borderColor: '#E5E7EB',
                                        borderRadius: 8,
                                        height: 50,
                                        paddingHorizontal: 16,
                                        backgroundColor: '#F9FAFB',
                                        fontSize: 16,
                                        color: '#000',
                                    },
                                    listView: {
                                        position: 'absolute',
                                        top: 50,
                                        zIndex: 10000,
                                        elevation: 10000,
                                        backgroundColor: 'white',
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.25,
                                        shadowRadius: 3.84,
                                        borderRadius: 8,
                                    },
                                    row: { paddingVertical: 12, paddingHorizontal: 12 },
                                    description: { fontSize: 14, color: '#374151' },
                                    separator: { height: 1, backgroundColor: '#F3F4F6' },
                                }}
                                enablePoweredByContainer={false}
                                debounce={300}
                                minLength={3}
                                nearbyPlacesAPI="GooglePlacesSearch"
                            />
                        ) : (
                            <TextInput
                                style={[styles.input, { height: 80 }]}
                                placeholder="Full address (API key missing)"
                                multiline
                                value={form.address}
                                onChangeText={t => setForm({ ...form, address: t })}
                            />
                        )}
                        {form.latitude !== null && (
                            <View style={styles.coordsBadge}>
                                <Ionicons name="location" size={12} color="#10B981" />
                                <Text style={styles.coordsText}>
                                    📍 {form.latitude.toFixed(5)}, {form.longitude?.toFixed(5)}
                                </Text>
                            </View>
                        )}
                    </View>

                    <View style={styles.row}>
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Manager Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Store Manager"
                                value={form.manager}
                                onChangeText={t => setForm({ ...form, manager: t })}
                            />
                        </View>
                        <View style={{ width: 12 }} />
                        <View style={[styles.inputGroup, { flex: 1 }]}>
                            <Text style={styles.label}>Phone <Text style={{ color: '#EF4444' }}>*</Text></Text>
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
    branchDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    branchAddress: { fontSize: 13, color: '#6B7280', flex: 1 },
    managerInfoRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 },
    managerDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    managerText: { fontSize: 12, color: '#6B7280' },

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
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    coordsBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F0FDF4', borderRadius: 6, alignSelf: 'flex-start', gap: 4 },
    coordsText: { fontSize: 11, color: '#059669', fontWeight: '500' },
});
