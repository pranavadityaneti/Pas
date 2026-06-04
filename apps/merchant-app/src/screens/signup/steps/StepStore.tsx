/**
 * StepStore — Step 2 of merchant signup (store info, category modal,
 * Hyderabad-defaulted map, Google Places address, dining-vertical fields).
 *
 * 2026-06-04 (Phase 1.7.G): Largest single-step extraction. The category
 * picker modal + showCategoryPicker local state + requestLocation handler
 * all move into this component. store / setStore / verticals /
 * verticalsLoading / verticalsError / fetchVerticals / selectedVertical
 * come from useSignupContext.
 *
 * NOTE: store.latitude / store.longitude default to Hyderabad
 * (17.385, 78.4867) per the v2 spec's deferred B-decision — the sentinel
 * coordinates are handled by validators + payload code at the orchestrator
 * level. This component renders whatever store.latitude / store.longitude
 * is at the time, including the Hyderabad sentinel on a fresh signup.
 *
 * GOOGLE_MAPS_API_KEY + extractCity inlined here (also duplicated in
 * StepBranches.tsx). Stage 1.7.H will hoist both to a shared util file
 * if you like — for now, the duplication is kept minimal and contained.
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, TouchableWithoutFeedback, ActivityIndicator, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

const GOOGLE_MAPS_API_KEY =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyAQAg7zpYvmd2BJGCGmf1opDLDC4KXbKUg';

function extractCity(details: any): string {
    const component = details?.address_components?.find((c: any) =>
        c.types.includes('locality'),
    );
    return component?.long_name || '';
}

export function StepStore() {
    const {
        store, setStore,
        verticals, verticalsLoading, verticalsError,
        selectedVertical, fetchVerticals,
    } = useSignupContext();

    // 2026-06-04 (Phase 1.7.G): showCategoryPicker is purely Step-2-local
    // (modal open/closed state). Moved here from the orchestrator where it
    // was a stranded local useState.
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    const requestLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required');
                return;
            }
            const location = await Location.getCurrentPositionAsync({});
            setStore(prev => ({
                ...prev,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            }));
            Alert.alert('Success', 'Location captured!');
        } catch (error) {
            Alert.alert('Error', 'Could not get location');
        }
    };

    return (
        <>
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="storefront-outline" size={20} color={Colors.primary} />
                    <Text style={styles.cardTitle}>Store Information</Text>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Store Name <Text style={styles.required}>*</Text></Text>
                    <TextInput
                        style={styles.input}
                        placeholder="My Kirana Store"
                        placeholderTextColor="#9CA3AF"
                        value={store.storeName}
                        onChangeText={(t) => setStore({ ...store, storeName: t })}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
                    <TouchableOpacity
                        style={styles.selectInput}
                        onPress={() => setShowCategoryPicker(true)}
                    >
                        <Text style={store.categoryId ? styles.selectText : styles.selectPlaceholder}>
                            {store.categoryName || 'Select category'}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#6B7280" />
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

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>City</Text>
                    <TextInput
                        style={styles.input}
                        value={store.city}
                        onChangeText={(t) => setStore({ ...store, city: t })}
                    />
                </View>
            </View>

            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="location-outline" size={20} color={Colors.primary} />
                    <Text style={styles.cardTitle}>Store Location</Text>
                </View>

                <TouchableOpacity style={styles.locationButton} onPress={requestLocation}>
                    <Ionicons name="navigate" size={20} color={Colors.primary} />
                    <Text style={styles.locationButtonText}>Use My Current Location</Text>
                </TouchableOpacity>

                <View style={{ height: 200, borderRadius: 12, overflow: 'hidden', marginVertical: 12 }}>
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        style={{ flex: 1 }}
                        region={{
                            latitude: store.latitude,
                            longitude: store.longitude,
                            latitudeDelta: 0.005,
                            longitudeDelta: 0.005,
                        }}
                    >
                        <Marker coordinate={{ latitude: store.latitude, longitude: store.longitude }} />
                    </MapView>
                </View>
                <Text style={styles.coordinatesText}>
                    📍 {store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}
                </Text>

                <View style={[styles.inputGroup, { zIndex: 9999 }]}>
                    <Text style={styles.label}>Full Address</Text>
                    <GooglePlacesAutocomplete
                        placeholder="Search store address..."
                        fetchDetails={true}
                        onPress={(data, details = null) => {
                            const city = extractCity(details);
                            setStore((prev) => ({
                                ...prev,
                                address: details?.formatted_address || data.description,
                                latitude: details?.geometry?.location?.lat ?? prev.latitude,
                                longitude: details?.geometry?.location?.lng ?? prev.longitude,
                                city: city || prev.city,
                            }));
                        }}
                        onFail={(error) => {
                            console.error('Google API Error:', error);
                        }}
                        textInputProps={{
                            onChangeText: (text: string) => {
                                setStore((prev) => ({ ...prev, address: text }));
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
                </View>
            </View>

            {selectedVertical?.isDining && (
                <View style={styles.card}>
                    <View style={styles.cardHeader}>
                        <Ionicons name="restaurant-outline" size={20} color={Colors.primary} />
                        <Text style={styles.cardTitle}>Restaurant Details</Text>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Restaurant Type</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {['Casual Dining', 'Fine Dining', 'Cafe', 'Quick Service', 'Dhaba', 'Cloud Kitchen'].map((t) => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setStore({ ...store, restaurantType: t })}
                                    style={{
                                        paddingHorizontal: 14,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        borderWidth: 1,
                                        borderColor: store.restaurantType === t ? Colors.primary : '#E5E7EB',
                                        backgroundColor: store.restaurantType === t ? Colors.primary : '#FFFFFF',
                                    }}
                                >
                                    <Text style={{ fontSize: 13, fontWeight: '600', color: store.restaurantType === t ? '#FFFFFF' : '#374151' }}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Cuisines (select all that apply)</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {['North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'].map((c) => {
                                const selected = store.cuisines.includes(c);
                                return (
                                    <TouchableOpacity
                                        key={c}
                                        onPress={() => {
                                            const next = selected
                                                ? store.cuisines.filter(x => x !== c)
                                                : [...store.cuisines, c];
                                            setStore({ ...store, cuisines: next });
                                        }}
                                        style={{
                                            paddingHorizontal: 14,
                                            paddingVertical: 8,
                                            borderRadius: 20,
                                            borderWidth: 1,
                                            borderColor: selected ? Colors.primary : '#E5E7EB',
                                            backgroundColor: selected ? Colors.primary : '#FFFFFF',
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? '#FFFFFF' : '#374151' }}>{c}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.inputGroup}>
                        <TouchableOpacity
                            onPress={() => setStore({ ...store, isVeg: !store.isVeg })}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                padding: 14,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: store.isVeg ? '#10B981' : '#E5E7EB',
                                backgroundColor: store.isVeg ? '#ECFDF5' : '#FFFFFF',
                            }}
                        >
                            <View style={{
                                width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                                borderColor: store.isVeg ? '#10B981' : '#9CA3AF',
                                backgroundColor: store.isVeg ? '#10B981' : 'transparent',
                                alignItems: 'center', justifyContent: 'center', marginRight: 12,
                            }}>
                                {store.isVeg && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Pure Vegetarian Restaurant</Text>
                                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>We do not serve any non-vegetarian items</Text>
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </>
    );
}
