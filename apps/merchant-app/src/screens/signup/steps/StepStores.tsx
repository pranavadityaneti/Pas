/**
 * StepStores — Step 3 of merchant signup (v2 CONSOLIDATED).
 *
 * 2026-06-04 (Phase 2.C.1): Replaces v1's three separate steps:
 *   - Step 2 (Store)    — single main store
 *   - Step 3 (Photos)   — store photos
 *   - Step 4 (Branches) — optional has_branches toggle + N branch editor
 *
 * v2 collapses these into one Step 3 where the merchant can add unlimited
 * stores via "Add Another Store". Each store is structurally identical (no
 * "main store" distinction, no is_primary flag). Per spec
 * docs/merchant-signup-v2-spec.md (Step 3):
 *  - Step opens with one empty store card (seeded in SignupContext)
 *  - Per-store: name, address (Google Places, mandatory non-null coords),
 *    city (auto-extracted), managerName, managerPhone, photos (min 2)
 *  - Food-vertical fields (cuisines, isVeg, restaurantType) only when
 *    selectedVertical?.requiresFssai or selectedVertical?.isDining
 *
 * State + setters come from useSignupContext. Photo upload uses the shared
 * pickStorePhotos handler defined inline (taps the same expo-image-picker
 * the orchestrator's old pickStorePhoto used).
 *
 * Validation: validateStores in shared/validations.ts (called by orchestrator).
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Alert, Modal, TouchableWithoutFeedback, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext, createEmptyStore } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';
import { GOOGLE_MAPS_API_KEY, extractCity } from '../shared/googlePlaces';
import type { Store } from '../shared/types';

const RESTAURANT_TYPES = ['Dine-in', 'Takeaway', 'Delivery', 'Cloud Kitchen'];

const COMMON_CUISINES = [
    'North Indian', 'South Indian', 'Chinese', 'Italian',
    'Continental', 'Fast Food', 'Desserts', 'Beverages',
];

export function StepStores() {
    const {
        stores, setStores,
        store, setStore,
        verticals, verticalsLoading, verticalsError, fetchVerticals,
        selectedVertical,
    } = useSignupContext();

    /**
     * 2026-06-04 (Phase 2.C.2): The vertical (categoryId/categoryName) lives
     * on the legacy `store` context object — it's per-merchant, not per-store.
     * Keeping the v1 storage shape here avoids churning SignupContext again
     * during this stage; Phase 2.G will lift verticalId/Name into their own
     * context fields and retire the legacy `store` object entirely.
     */
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    const showFoodFields = !!(selectedVertical?.requiresFssai || selectedVertical?.isDining);

    const addStore = () => setStores([...stores, createEmptyStore()]);
    const removeStore = (i: number) => {
        if (stores.length === 1) {
            Alert.alert('At Least One Store', 'You need at least one store to continue. Edit this store or come back later.');
            return;
        }
        setStores(stores.filter((_, idx) => idx !== i));
    };
    const updateStore = (i: number, field: keyof Store, value: any) => {
        const updated = [...stores];
        (updated[i] as any)[field] = value;
        setStores(updated);
    };

    const pickStorePhotos = async (i: number) => {
        const currentCount = stores[i].photos.length;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: Math.max(0, 10 - currentCount),
            quality: 0.7,
        });
        if (!result.canceled && result.assets) {
            const newUris = result.assets.map(a => a.uri);
            updateStore(i, 'photos', [...stores[i].photos, ...newUris]);
        }
    };

    const removePhoto = (storeIdx: number, photoIdx: number) => {
        const updated = stores[storeIdx].photos.filter((_, pi) => pi !== photoIdx);
        updateStore(storeIdx, 'photos', updated);
    };

    return (
        <>
            {/* Vertical (business category) picker — first thing the merchant chooses. */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="grid-outline" size={20} color={Colors.primary} />
                    <Text style={styles.cardTitle}>Business Category</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12 }}>
                    Pick the category that best describes all your stores.
                </Text>
                <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setShowCategoryPicker(true)}
                >
                    <Text style={store.categoryName ? styles.selectText : styles.selectPlaceholder}>
                        {store.categoryName || 'Select category'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#9CA3AF" />
                </TouchableOpacity>

                <Modal
                    visible={showCategoryPicker}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setShowCategoryPicker(false)}
                >
                    <TouchableWithoutFeedback onPress={() => setShowCategoryPicker(false)}>
                        <View style={styles.modalOverlay}>
                            <View style={styles.modalContent}>
                                <Text style={styles.modalTitle}>Select Category</Text>
                                {verticalsLoading ? (
                                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
                                ) : verticalsError ? (
                                    <View style={{ alignItems: 'center', padding: 20 }}>
                                        <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: 12 }}>{verticalsError}</Text>
                                        <TouchableOpacity onPress={fetchVerticals} style={{ padding: 8, backgroundColor: Colors.primary, borderRadius: 8 }}>
                                            <Text style={{ color: '#FFF' }}>Retry</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <ScrollView style={{ maxHeight: 300 }}>
                                        {verticals.map((v) => (
                                            <TouchableOpacity
                                                key={v.id}
                                                style={styles.modalItem}
                                                onPress={() => {
                                                    setStore({ ...store, categoryId: v.id, categoryName: v.name });
                                                    setShowCategoryPicker(false);
                                                }}
                                            >
                                                <Text style={[
                                                    styles.modalItemText,
                                                    store.categoryId === v.id && styles.modalItemTextActive
                                                ]}>{v.name}</Text>
                                                {store.categoryId === v.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}
                                <TouchableOpacity
                                    style={styles.modalCloseBtn}
                                    onPress={() => setShowCategoryPicker(false)}
                                >
                                    <Text style={styles.modalCloseText}>Close</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </TouchableWithoutFeedback>
                </Modal>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="storefront-outline" size={20} color={Colors.primary} />
                    <Text style={styles.cardTitle}>Your Stores</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>
                    Add every store you operate. All stores are treated equally — no main vs branch distinction.
                </Text>
            </View>

            {stores.map((store, i) => (
                <View key={store.id} style={styles.card}>
                    <View style={styles.branchHeader}>
                        <Text style={styles.branchTitle}>Store {i + 1}</Text>
                        {stores.length > 1 && (
                            <TouchableOpacity onPress={() => removeStore(i)}>
                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Store Name <Text style={styles.required}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Main Branch, Banjara Outlet"
                            placeholderTextColor="#9CA3AF"
                            value={store.name}
                            onChangeText={(t) => updateStore(i, 'name', t)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Address <Text style={styles.required}>*</Text></Text>
                        <GooglePlacesAutocomplete
                            placeholder={store.address || 'Search for an address'}
                            fetchDetails={true}
                            onPress={(data, details = null) => {
                                if (!details) return;
                                const lat = details.geometry?.location?.lat;
                                const lng = details.geometry?.location?.lng;
                                if (typeof lat !== 'number' || typeof lng !== 'number') {
                                    Alert.alert('Location Error', 'Could not get coordinates for this address. Try another result.');
                                    return;
                                }
                                const updated = [...stores];
                                updated[i] = {
                                    ...updated[i],
                                    address: data.description,
                                    latitude: lat,
                                    longitude: lng,
                                    city: extractCity(details),
                                };
                                setStores(updated);
                            }}
                            query={{
                                key: GOOGLE_MAPS_API_KEY,
                                language: 'en',
                                components: 'country:in',
                            }}
                            styles={{
                                // 2026-06-26 fix: `flex: 0` WITHOUT a width collapses the
                                // dropdown to ~zero width. The library wraps every row in a
                                // horizontal ScrollView sized to the container width, so the
                                // prediction Text renders at zero width → blank rows (with
                                // separators) even though predictions load fine. `width: '100%'`
                                // (mirroring the proven settings/branches.tsx config) gives the
                                // rows real width so the text shows. row/description/separator
                                // also mirror branches for consistent, visible styling.
                                container: { flex: 0, width: '100%' },
                                textInput: styles.input,
                                listView: { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 12, marginTop: 4 },
                                row: { paddingVertical: 12, paddingHorizontal: 12 },
                                description: { fontSize: 14, color: '#374151' },
                                separator: { height: 1, backgroundColor: '#F3F4F6' },
                            }}
                            enablePoweredByContainer={false}
                            minLength={2}
                            debounce={300}
                        />
                        {store.address ? (
                            <Text style={{ fontSize: 12, color: '#10B981', marginTop: 6 }}>
                                ✓ {store.address}{store.city ? ` · ${store.city}` : ''}
                            </Text>
                        ) : null}
                        {(store.latitude !== null && store.longitude !== null) ? (
                            <Text style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                                {store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}
                            </Text>
                        ) : null}
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Manager Name <Text style={styles.required}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="John Doe"
                            placeholderTextColor="#9CA3AF"
                            value={store.managerName}
                            onChangeText={(t) => updateStore(i, 'managerName', t)}
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Manager Phone <Text style={styles.required}>*</Text></Text>
                        <TextInput
                            style={styles.input}
                            placeholder="98765 43210"
                            placeholderTextColor="#9CA3AF"
                            keyboardType="phone-pad"
                            maxLength={10}
                            value={store.managerPhone}
                            onChangeText={(t) => updateStore(i, 'managerPhone', t)}
                        />
                    </View>

                    {/* Photos */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>
                            Store Photos <Text style={styles.required}>*</Text>
                            <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '400' }}>  (min 2)</Text>
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {store.photos.map((photo, pIdx) => (
                                <View key={pIdx} style={{ width: 80, height: 80, borderRadius: 8, marginRight: 8, position: 'relative' }}>
                                    <Image source={{ uri: photo }} style={{ width: 80, height: 80, borderRadius: 8, backgroundColor: '#F3F4F6' }} />
                                    <TouchableOpacity onPress={() => removePhoto(i, pIdx)} style={{ position: 'absolute', top: -6, right: -6 }}>
                                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                onPress={() => pickStorePhotos(i)}
                                style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 2, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="camera-outline" size={22} color="#9CA3AF" />
                                <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>Add</Text>
                            </TouchableOpacity>
                        </ScrollView>
                        <Text style={{ fontSize: 11, color: store.photos.length >= 2 ? '#10B981' : '#9CA3AF', marginTop: 6 }}>
                            {store.photos.length} / 2 min photos
                        </Text>
                    </View>

                    {/* Food-vertical fields */}
                    {showFoodFields && (
                        <>
                            <View style={styles.divider} />
                            <Text style={styles.sectionHeader}>Restaurant Details</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Restaurant Type</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {RESTAURANT_TYPES.map(type => (
                                        <TouchableOpacity
                                            key={type}
                                            onPress={() => updateStore(i, 'restaurantType', type)}
                                            style={[
                                                { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
                                                store.restaurantType === type && { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
                                            ]}
                                        >
                                            <Text style={[
                                                { fontSize: 13, color: '#374151' },
                                                store.restaurantType === type && { color: Colors.primary, fontWeight: '600' },
                                            ]}>{type}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Cuisines</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                    {COMMON_CUISINES.map(c => {
                                        const selected = store.cuisines.includes(c);
                                        return (
                                            <TouchableOpacity
                                                key={c}
                                                onPress={() => {
                                                    const next = selected ? store.cuisines.filter(x => x !== c) : [...store.cuisines, c];
                                                    updateStore(i, 'cuisines', next);
                                                }}
                                                style={[
                                                    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB' },
                                                    selected && { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
                                                ]}
                                            >
                                                <Text style={[
                                                    { fontSize: 13, color: '#374151' },
                                                    selected && { color: Colors.primary, fontWeight: '600' },
                                                ]}>{c}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => updateStore(i, 'isVeg', !store.isVeg)}
                                style={styles.checkboxRow}
                            >
                                <View style={[styles.checkbox, store.isVeg && styles.checkboxChecked]}>
                                    {store.isVeg && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                                </View>
                                <Text style={styles.checkboxLabel}>Pure Vegetarian</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            ))}

            <TouchableOpacity
                onPress={addStore}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.primary + '40', backgroundColor: Colors.primary + '08', marginBottom: 16 }}
            >
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                <Text style={{ color: Colors.primary, fontWeight: '600', marginLeft: 8 }}>
                    Save & Add Another Store
                </Text>
            </TouchableOpacity>
        </>
    );
}
