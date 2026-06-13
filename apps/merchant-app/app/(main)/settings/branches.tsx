
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, LogBox, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import uuid from 'react-native-uuid';
import * as ImagePicker from 'expo-image-picker';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import { useUser } from '../../../src/context/UserContext';
import { useStore } from '../../../src/context/StoreContext';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors'
import BottomModal from '../../../src/components/BottomModal';
import { useCreateManager } from '../../../src/hooks/useStaff';
import { useImageUpload } from '../../../src/hooks/useImageUpload';
import { createBranch, updateBranch, deleteBranch, BranchWritePayload } from '../../../src/services/branches';

LogBox.ignoreLogs(['VirtualizedLists should never be nested']);interface Branch {
    id: string;
    branch_name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    manager_name: string | null;
    phone: string | null;
    is_active: boolean;
    cuisines?: string[];
    is_veg?: boolean;
    restaurant_type?: string;
    branch_photos?: string[];
}

const RESTAURANT_TYPES = ['Casual Dining', 'Fine Dining', 'Cafe', 'Quick Service', 'Dhaba', 'Cloud Kitchen'];
const CUISINE_OPTIONS = ['North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'];

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
    const { refreshStore, merchantId } = useStore();
    const [isDining, setIsDining] = useState(false);

    // 2026-06-04 (Phase 1.5.C): file→storage upload extracted to the shared
    // useImageUpload primitive (src/hooks/useImageUpload.ts). Bucket stays
    // 'merchant-assets' — same destination as before. Branches now inherit
    // signup's 3-attempt retry policy (was: zero retry → silent drop on
    // failure). Skip-already-uploaded guard preserved.
    const { uploadFile } = useImageUpload({ bucket: 'merchant-assets' });

    // Lookup whether this merchant's vertical is dining
    useEffect(() => {
        const targetId = merchantId || user?.id;
        if (!targetId) return;
        (async () => {
            const { data: mData } = await supabase
                .from('merchants')
                .select('vertical_id')
                .eq('id', targetId)
                .single();
            console.log('[Branches] merchant lookup:', { targetId, mData });
            if (mData?.vertical_id) {
                const { data: vData } = await supabase
                    .from('Vertical')
                    .select('isDining')
                    .eq('id', mData.vertical_id)
                    .single();
                console.log('[Branches] vertical lookup:', vData);
                if (vData) setIsDining(!!(vData as any).isDining);
            }
        })();
    }, [merchantId, user?.id]);

    // Fetch branches from DB
    const { data: branches, loading, error, setData: setBranches } = useRealtimeTable({
        tableName: 'merchant_branches',
        select: '*',
        filter: (merchantId || user?.id) ? `merchant_id=eq.${merchantId || user?.id}` : undefined,
        enabled: !!(merchantId || user?.id)
    });

    // Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [saving, setSaving] = useState(false);
    const { mutateAsync: provisionManager } = useCreateManager();
    const placesRef = useRef<GooglePlacesAutocompleteRef | null>(null);

    // Form State
    const [form, setForm] = useState({
        name: '',
        address: '',
        latitude: null as number | null,
        longitude: null as number | null,
        city: '',
        manager: '',
        phone: '',
        cuisines: [] as string[],
        isVeg: false,
        restaurantType: '',
        branchPhotos: [] as string[],
    });

    const openAddModal = () => {
        setEditingBranch(null);
        setForm({ name: '', address: '', latitude: null, longitude: null, city: '', manager: '', phone: '', cuisines: [], isVeg: false, restaurantType: '', branchPhotos: [] });
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
            phone: branch.phone || '',
            cuisines: branch.cuisines || [],
            isVeg: branch.is_veg ?? false,
            restaurantType: branch.restaurant_type || '',
            branchPhotos: branch.branch_photos || [],
        });
        setTimeout(() => placesRef.current?.setAddressText(branch.address || ''), 100);
        setModalVisible(true);
    };

    const pickPhotos = async () => {
        if (form.branchPhotos.length >= 5) {
            Alert.alert('Limit Reached', 'Maximum 5 photos per branch.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 5 - form.branchPhotos.length,
            quality: 0.7,
        });
        if (!result.canceled && result.assets) {
            const newUris = result.assets.map(a => a.uri);
            setForm(prev => ({ ...prev, branchPhotos: [...prev.branchPhotos, ...newUris].slice(0, 5) }));
        }
    };

    const removePhoto = (idx: number) => {
        setForm(prev => ({ ...prev, branchPhotos: prev.branchPhotos.filter((_, i) => i !== idx) }));
    };

    const uploadBranchPhotos = async (branchId: string, photos: string[]): Promise<string[]> => {
        // 2026-06-04 (Phase 1.5.C): delegates to the shared useImageUpload hook
        // declared at the top of BranchesScreen(). The hook handles:
        //   - skip-already-uploaded guard (any non-file://, non-content:// URI)
        //   - 3-attempt retry with attempt*1500ms backoff (NEW for branches)
        //   - base64 + FileSystem.readAsStringAsync upload mechanism
        // The per-photo try/catch below preserves this file's PRIOR silent-skip
        // semantic for permanent upload failures (matches the original
        // `if (!error) uploaded.push(path)` pattern). With retries now in
        // place, transient failures are far less likely to ever land here.
        const uploaded: string[] = [];
        for (let i = 0; i < photos.length; i++) {
            const uri = photos[i];
            const ext = uri.split('.').pop() || 'jpg';
            const path = `branches/${branchId}/photo_${i}.${ext}`;
            try {
                const result = await uploadFile(uri, path);
                if (result) uploaded.push(result);
            } catch (e: any) {
                console.error(`[branches.uploadBranchPhotos] photo ${i} failed after retries:`, e?.message || e);
            }
        }
        return uploaded;
    };

    const handleSave = async () => {
        const targetMerchantId = merchantId || user?.id;
        if (!targetMerchantId) return;
        if (!form.name.trim() || !form.address.trim() || !form.manager.trim() || !form.phone.trim()) {
            Alert.alert('Error', 'All fields are mandatory. Please fill in all details.');
            return;
        }

        if (form.address.trim() && (form.latitude === null || form.longitude === null)) {
            Alert.alert(
                'Select Address',
                'Please select an address from the dropdown suggestions so we can capture the precise location.'
            );
            return;
        }

        setSaving(true);
        try {
            let finalBranchId = editingBranch?.id;
            // Phase 8 (2026-06-11): branch writes go through the API
            // (services/branches.ts) instead of direct supabase-js. camelCase
            // body; the API returns the snake_case DB row, so the optimistic
            // list update below stays shape-consistent with the read.
            const payload: BranchWritePayload = {
                merchantId: targetMerchantId,
                branchName: form.name.trim(),
                address: form.address.trim() || null,
                latitude: form.latitude,
                longitude: form.longitude,
                city: form.city.trim() || null,
                managerName: form.manager.trim() || null,
                phone: form.phone.trim() || null,
                isActive: true
            };

            if (isDining) {
                payload.cuisines = form.cuisines;
                payload.isVeg = form.isVeg;
                payload.restaurantType = form.restaurantType || null;
            }

            if (editingBranch) {
                // Upload photos
                const photoPaths = await uploadBranchPhotos(editingBranch.id, form.branchPhotos);
                payload.branchPhotos = photoPaths;

                const updatedBranch = await updateBranch(editingBranch.id, payload);
                if (updatedBranch) {
                    setBranches(prev => prev.map(b => b.id === updatedBranch.id ? updatedBranch : b));
                }
            } else {
                const newId = uuid.v4() as string;
                // Upload photos
                const photoPaths = await uploadBranchPhotos(newId, form.branchPhotos);
                payload.branchPhotos = photoPaths;

                const newBranch = await createBranch({ ...payload, id: newId });
                if (newBranch) {
                    finalBranchId = newBranch.id;
                    setBranches(prev => [newBranch, ...prev]);
                }
            }

            // --- RBAC KEYMAKER WIRING ---
            try {
                const sanitizedPhone = form.phone.trim().replace(/\D/g, '');
                await provisionManager({
                    phone: sanitizedPhone,
                    name: form.manager.trim(),
                    storeId: finalBranchId || ''
                });
            } catch (provisionError: any) {
                console.error('Keymaker Provisioning Error:', provisionError);
                Alert.alert(
                    'Branch Saved',
                    'The branch details were saved successfully, but we failed to create or update the manager account. Please try again from Staff Management if needed.'
                );
            }

            // Refresh the StoreContext so the new branch appears in the store switcher immediately
            await refreshStore();

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
                    const previousBranches = branches;
                    setBranches(prev => prev.filter(b => b.id !== id));

                    // Phase 8: API deletes the branch AND its store_staff rows
                    // (FK-safe order) under one authorization check.
                    try {
                        await deleteBranch(id);
                        await refreshStore();
                    } catch (e: any) {
                        setBranches(previousBranches);
                        Alert.alert('Error', e?.message || 'Failed to delete branch');
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
                <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
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

                        {/* Dining-specific fields */}
                        {isDining && (
                            <>
                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Restaurant Type</Text>
                                    <View style={styles.chipContainer}>
                                        {RESTAURANT_TYPES.map(t => (
                                            <TouchableOpacity
                                                key={t}
                                                onPress={() => setForm(prev => ({ ...prev, restaurantType: prev.restaurantType === t ? '' : t }))}
                                                style={[styles.chip, form.restaurantType === t && styles.chipActive]}
                                            >
                                                <Text style={[styles.chipText, form.restaurantType === t && styles.chipTextActive]}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Cuisines</Text>
                                    <View style={styles.chipContainer}>
                                        {CUISINE_OPTIONS.map(c => {
                                            const selected = form.cuisines.includes(c);
                                            return (
                                                <TouchableOpacity
                                                    key={c}
                                                    onPress={() => {
                                                        const next = selected
                                                            ? form.cuisines.filter(x => x !== c)
                                                            : [...form.cuisines, c];
                                                        setForm(prev => ({ ...prev, cuisines: next }));
                                                    }}
                                                    style={[styles.chip, selected && styles.chipActive]}
                                                >
                                                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{c}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <TouchableOpacity
                                    onPress={() => setForm(prev => ({ ...prev, isVeg: !prev.isVeg }))}
                                    style={[styles.vegToggle, form.isVeg && styles.vegToggleActive]}
                                >
                                    <View style={[styles.vegCheck, form.isVeg && styles.vegCheckActive]}>
                                        {form.isVeg && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Pure Vegetarian</Text>
                                        <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>No non-veg items served</Text>
                                    </View>
                                </TouchableOpacity>
                            </>
                        )}

                        {/* Branch Photos */}
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Branch Photos ({form.branchPhotos.length}/5)</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                                {form.branchPhotos.map((photo, idx) => (
                                    <View key={idx} style={styles.photoThumb}>
                                        <Image source={{ uri: photo.startsWith('branches/') || photo.startsWith('http') ? `https://llhxkonraqaxtradyycj.supabase.co/storage/v1/object/public/merchant-assets/${photo}` : photo }} style={styles.photoImg} />
                                        <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(idx)}>
                                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                {form.branchPhotos.length < 5 && (
                                    <TouchableOpacity style={styles.photoAdd} onPress={pickPhotos}>
                                        <Ionicons name="camera-outline" size={24} color="#9CA3AF" />
                                        <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>Add</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Save Branch</Text>}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
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

    chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
    chipActive: { borderColor: Colors.primary, backgroundColor: Colors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
    chipTextActive: { color: '#FFFFFF' },

    vegToggle: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF', marginBottom: 16 },
    vegToggleActive: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
    vegCheck: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#9CA3AF', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    vegCheckActive: { borderColor: '#10B981', backgroundColor: '#10B981' },

    photoThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 10, position: 'relative' },
    photoImg: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#F3F4F6' },
    photoRemove: { position: 'absolute', top: -6, right: -6 },
    photoAdd: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },

    saveButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    coordsBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#F0FDF4', borderRadius: 6, alignSelf: 'flex-start', gap: 4 },
    coordsText: { fontSize: 11, color: '#059669', fontWeight: '500' },
});
