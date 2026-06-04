/**
 * StepBranches — Step 4 of merchant signup (multi-branch toggle + per-branch
 * editor with Google Places autocomplete, dining-vertical fields, and
 * per-branch photo gallery).
 *
 * 2026-06-04 (Phase 1.7.F): Largest step component, ~210 lines of JSX
 * extracted verbatim from signup.tsx. The handlers addBranch / removeBranch /
 * updateBranch move with the component (Step-4-only). Branch photo picker
 * stays inline in JSX where it was. hasBranches / setHasBranches / branches /
 * setBranches / selectedVertical consumed via useSignupContext.
 *
 * GOOGLE_MAPS_API_KEY + extractCity helper are inlined here (Step-4-only
 * uses; if Step 2 also needs them after extraction in Stage 1.7.G we can
 * promote them to a shared util, but the duplication is small enough that
 * cross-file coupling isn't worth introducing now).
 *
 * Dining-vertical fields (restaurant type chips + cuisines + Pure Veg flag)
 * gated on selectedVertical?.isDining — preserved verbatim.
 *
 * 5-photo cap on per-branch picker preserved (allowsMultipleSelection +
 * selectionLimit = 5 - currentCount).
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';
import type { Branch } from '../shared/types';
import { GOOGLE_MAPS_API_KEY, extractCity } from '../shared/googlePlaces';

export function StepBranches() {
    const { hasBranches, setHasBranches, branches, setBranches, selectedVertical } = useSignupContext();

    const addBranch = () => setBranches([
        ...branches,
        { name: '', address: '', latitude: null, longitude: null, city: '', manager_name: '', phone: '', cuisines: [], isVeg: false, restaurantType: '', photos: [] },
    ]);
    const removeBranch = (i: number) => setBranches(branches.filter((_, idx) => idx !== i));
    const updateBranch = (i: number, field: keyof Branch, value: any) => {
        const updated = [...branches];
        (updated[i] as any)[field] = value;
        setBranches(updated);
    };

    return (
        <>
            <View style={styles.card}>
                <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => setHasBranches(!hasBranches)}
                >
                    <View style={[styles.checkbox, hasBranches && styles.checkboxChecked]}>
                        {hasBranches && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                    </View>
                    <View>
                        <Text style={styles.checkboxLabel}>Do you have other branches?</Text>
                        <Text style={styles.checkboxHint}>Enable if you manage multiple outlets</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {hasBranches && (
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="git-branch-outline" size={20} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Branches</Text>
                        <TouchableOpacity style={styles.addButton} onPress={addBranch}>
                            <Ionicons name="add" size={18} color={Colors.primary} />
                            <Text style={styles.addButtonText}>Add</Text>
                        </TouchableOpacity>
                    </View>

                    {branches.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No branches added yet</Text>
                        </View>
                    ) : (
                        branches.map((branch, i) => (
                            <View key={i} style={styles.branchCard}>
                                <View style={styles.branchHeader}>
                                    <Text style={styles.branchTitle}>Branch {i + 1}</Text>
                                    <TouchableOpacity onPress={() => removeBranch(i)}>
                                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Branch Name"
                                    placeholderTextColor="#9CA3AF"
                                    value={branch.name}
                                    onChangeText={(t) => updateBranch(i, 'name', t)}
                                />
                                <View style={{ marginTop: 8, zIndex: 9000 - i }}>
                                    <GooglePlacesAutocomplete
                                        placeholder="Search branch address..."
                                        fetchDetails={true}
                                        onPress={(data, details = null) => {
                                            const city = extractCity(details);
                                            setBranches((prev) => prev.map((b, idx) => idx === i ? {
                                                ...b,
                                                address: details?.formatted_address || data.description,
                                                latitude: details?.geometry?.location?.lat ?? null,
                                                longitude: details?.geometry?.location?.lng ?? null,
                                                city: city || b.city,
                                            } : b));
                                        }}
                                        onFail={(error) => {
                                            console.error('Google API Error:', error);
                                        }}
                                        textInputProps={{
                                            onChangeText: (text: string) => {
                                                setBranches((prev) => prev.map((b, idx) => idx === i ? { ...b, address: text, latitude: null, longitude: null } : b));
                                            },
                                            placeholderTextColor: '#9CA3AF',
                                        }}
                                        query={{
                                            key: GOOGLE_MAPS_API_KEY,
                                            language: 'en',
                                            components: 'country:in',
                                        }}
                                        styles={{
                                            container: { flex: 0, width: '100%', zIndex: 9000 - i },
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
                                    {branch.latitude !== null && branch.longitude !== null && (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                            <Ionicons name="location" size={12} color="#10B981" />
                                            <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>
                                                📍 {branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        placeholder="Manager Name"
                                        placeholderTextColor="#9CA3AF"
                                        value={branch.manager_name}
                                        onChangeText={(t) => updateBranch(i, 'manager_name', t)}
                                    />
                                    <TextInput
                                        style={[styles.input, { flex: 1 }]}
                                        placeholder="Manager Phone"
                                        placeholderTextColor="#9CA3AF"
                                        keyboardType="phone-pad"
                                        value={branch.phone}
                                        onChangeText={(t) => updateBranch(i, 'phone', t)}
                                    />
                                </View>

                                {/* Dining fields per branch */}
                                {selectedVertical?.isDining && (
                                    <View style={{ marginTop: 12 }}>
                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Restaurant Type</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                            {['Casual Dining', 'Fine Dining', 'Cafe', 'Quick Service', 'Dhaba', 'Cloud Kitchen'].map(t => (
                                                <TouchableOpacity key={t} onPress={() => updateBranch(i, 'restaurantType', branch.restaurantType === t ? '' : t)}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: branch.restaurantType === t ? Colors.primary : '#E5E7EB', backgroundColor: branch.restaurantType === t ? Colors.primary : '#fff' }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: branch.restaurantType === t ? '#fff' : '#374151' }}>{t}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 }}>Cuisines</Text>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                            {['North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'].map(c => {
                                                const sel = branch.cuisines?.includes(c);
                                                return (
                                                    <TouchableOpacity key={c} onPress={() => {
                                                        const next = sel ? branch.cuisines.filter(x => x !== c) : [...(branch.cuisines || []), c];
                                                        updateBranch(i, 'cuisines', next);
                                                    }}
                                                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: sel ? Colors.primary : '#E5E7EB', backgroundColor: sel ? Colors.primary : '#fff' }}>
                                                        <Text style={{ fontSize: 12, fontWeight: '600', color: sel ? '#fff' : '#374151' }}>{c}</Text>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>

                                        <TouchableOpacity onPress={() => updateBranch(i, 'isVeg', !branch.isVeg)}
                                            style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: branch.isVeg ? '#10B981' : '#E5E7EB', backgroundColor: branch.isVeg ? '#ECFDF5' : '#fff' }}>
                                            <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: branch.isVeg ? '#10B981' : '#9CA3AF', backgroundColor: branch.isVeg ? '#10B981' : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                                {branch.isVeg && <Ionicons name="checkmark" size={12} color="#fff" />}
                                            </View>
                                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>Pure Vegetarian</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Branch Photos */}
                                <View style={{ marginTop: 12 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Photos ({branch.photos?.length || 0}/5)</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        {(branch.photos || []).map((photo, pIdx) => (
                                            <View key={pIdx} style={{ width: 64, height: 64, borderRadius: 8, marginRight: 8, position: 'relative' }}>
                                                <Image source={{ uri: photo }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#F3F4F6' }} />
                                                <TouchableOpacity onPress={() => updateBranch(i, 'photos', branch.photos.filter((_: any, pi: number) => pi !== pIdx))} style={{ position: 'absolute', top: -4, right: -4 }}>
                                                    <Ionicons name="close-circle" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}
                                        {(branch.photos?.length || 0) < 5 && (
                                            <TouchableOpacity
                                                onPress={async () => {
                                                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 5 - (branch.photos?.length || 0), quality: 0.7 });
                                                    if (!result.canceled && result.assets) {
                                                        updateBranch(i, 'photos', [...(branch.photos || []), ...result.assets.map(a => a.uri)].slice(0, 5));
                                                    }
                                                }}
                                                style={{ width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name="camera-outline" size={20} color="#9CA3AF" />
                                            </TouchableOpacity>
                                        )}
                                    </ScrollView>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            )}

            {!hasBranches && (
                <View style={styles.emptyCard}>
                    <Ionicons name="storefront-outline" size={48} color="#E5E7EB" />
                    <Text style={styles.emptyCardTitle}>Single Store Operation</Text>
                </View>
            )}
        </>
    );
}
