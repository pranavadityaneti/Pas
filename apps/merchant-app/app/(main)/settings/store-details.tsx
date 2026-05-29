// @lock — Do NOT overwrite. Approved layout as of March 22, 2026.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';
import { useStoreContext } from '../../../src/context/StoreContext';
import { useUser } from '../../../src/context/UserContext';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import Constants from 'expo-constants';

const SUPABASE_PROJECT_ID = 'llhxkonraqaxtradyycj';
const STORAGE_BASE_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/storage/v1/object/public/merchant-assets/`;

const VERTICAL_MAP: { [key: string]: string } = {
    'c307b78e-b924-47a1-a5a7-4405777fa50c': 'Kirana Store',
    'default': 'General Store'
};

export default function StoreDetailsScreen() {
    const { store, merchantId } = useStoreContext();
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [details, setDetails] = useState({
        name: '',
        address: '',
        cityId: '',
        category: '',
        photos: [] as string[],
        cuisines: [] as string[],
        isVeg: false,
        restaurantType: '',
    });
    const [initialDetails, setInitialDetails] = useState<typeof details | null>(null);
    const [isDining, setIsDining] = useState(false);

    // Step 1: Fix Fetch Logic
    const targetId = store?.id;

    // Realtime Store Data (Main image, name, address)
    const { data: storeDataList, loading: storeLoading } = useRealtimeTable({
        tableName: 'Store',
        select: 'name, address, image',
        filter: targetId ? `id.eq.${targetId}` : undefined,
        enabled: !!targetId
    });

    // Realtime Merchant Extras (Signup Data)
    const { data: merchantDataList, loading: merchantLoading } = useRealtimeTable({
        tableName: 'merchants',
        select: 'city, vertical_id, cuisines, is_veg, restaurant_type',
        filter: targetId ? `id.eq.${targetId}` : undefined,
        enabled: !!targetId
    });

    useEffect(() => {
        if (storeLoading || merchantLoading) return;

        // Step 2: Add Array Validation
        console.log("RAW_STORE_DATA:", storeDataList);

        const sData = storeDataList && storeDataList.length > 0 ? storeDataList[0] : null;
        const mData = merchantDataList && merchantDataList.length > 0 ? merchantDataList[0] : null;

        if (sData || mData) {
            // Step 1 & 2: Constuct URI from Store.image and merchant-assets bucket
            const photosArray: string[] = [];
            if (sData?.image) {
                const cleanPath = sData.image.startsWith('/') ? sData.image.substring(1) : sData.image;
                // Step 3: Correct the URI Formatting
                const photoUri = `${STORAGE_BASE_URL}${cleanPath}`;
                
                // Mandatory Debug Log
                console.log("FINAL_IMAGE_URL_CHECK:", photoUri);
                photosArray.push(photoUri);
            }

            // Step 4: Mandatory Category Label Mapping
            const vertical_id = mData?.vertical_id;
            const label = vertical_id === 'c307b78e-b924-47a1-a5a7-4405777fa50c' ? 'Kirana Store' : 'General Store';

            const newDetails = {
                name: sData?.name || '',
                address: sData?.address || '',
                category: label,
                photos: photosArray,
                cityId: mData?.city || '',
                cuisines: mData?.cuisines || [],
                isVeg: mData?.is_veg ?? false,
                restaurantType: mData?.restaurant_type || '',
            };
            setDetails(newDetails);
            setInitialDetails(newDetails);

            // Lookup Vertical.isDining to gate dining-specific fields
            if (mData?.vertical_id) {
                supabase.from('Vertical').select('isDining').eq('id', mData.vertical_id).single().then(({ data }) => {
                    if (data) setIsDining(!!(data as any).isDining);
                });
            }
        }
        setLoading(false);
    }, [storeDataList, merchantDataList, storeLoading, merchantLoading]);

    // Removed redundant store sync to prioritize single source of truth from signup metadata

    const isDirty = initialDetails && JSON.stringify(details) !== JSON.stringify(initialDetails);

    const handleSave = async () => {
        if (!details.name.trim()) {
            Alert.alert('Validation', 'Store name is required');
            return;
        }

        if (!store?.id) return;

        setSaving(true);
        try {
            const { error } = await supabase
                .from('Store')
                .update({
                    name: details.name,
                    address: details.address,
                })
                .eq('id', store.id);

            if (error) throw error;

            if (isDining) {
                const { error: mError } = await supabase
                    .from('merchants')
                    .update({
                        cuisines: details.cuisines,
                        is_veg: details.isVeg,
                        restaurant_type: details.restaurantType,
                    })
                    .eq('id', store.id);
                if (mError) throw mError;
            }

            setInitialDetails(details);
            Alert.alert('Success', 'Store details updated successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);

            // Trigger refresh in context
            // refreshStore(); // We can access refreshStore from hook if needed, but Realtime should handle it
        } catch (error) {
            console.error('Error saving store details:', error);
            Alert.alert('Error', 'Failed to save changes. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Store Details</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
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
                <Text style={styles.headerTitle}>Store Details</Text>
            </View>

            {/* @ts-ignore: Library type definition missing children prop */}
            <KeyboardAwareScrollView
                contentContainerStyle={styles.content}
                enableOnAndroid={true}
                extraScrollHeight={80}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Store Name</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: '#F3F4F6', color: '#666' }]}
                        value={details.name}
                        editable={false}
                        placeholder="Enter store name"
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: '#F3F4F6', color: '#666' }]}
                        value={details.address}
                        editable={false}
                        placeholder="Enter full address"
                        multiline
                        numberOfLines={3}
                    />
                </View>

                {/* City ID is often fixed or needs a selector, keeping simple for now */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Category</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: '#F3F4F6', color: '#666' }]}
                        value={details.category}
                        editable={false}
                        placeholder="Not Specified"
                    />
                </View>

                {/* Store Photos */}
                <View style={[styles.formGroup, { marginTop: 10 }]}>
                    <Text style={styles.label}>Store Photos ({details.photos.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                        {details.photos.map((photo, index) => (
                            <View key={index} style={styles.photoWrapper}>
                                <Image 
                                    source={{ uri: photo }} 
                                    style={styles.photo} 
                                    defaultSource={require('../../../assets/icon.png')} // Fallback if local
                                />
                            </View>
                        ))}
                        {details.photos.length === 0 && (
                            <View style={styles.noPhotoBox}>
                                <Ionicons name="image-outline" size={24} color="#9CA3AF" />
                                <Text style={styles.noPhotoText}>No photos provided</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {isDining && (
                    <>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Restaurant Type</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {['Casual Dining', 'Fine Dining', 'Cafe', 'Quick Service', 'Dhaba', 'Cloud Kitchen'].map((t) => (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => setDetails({ ...details, restaurantType: t })}
                                        style={{
                                            paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                            borderWidth: 1,
                                            borderColor: details.restaurantType === t ? Colors.primary : '#E5E7EB',
                                            backgroundColor: details.restaurantType === t ? Colors.primary : '#FFFFFF',
                                        }}
                                    >
                                        <Text style={{ fontSize: 13, fontWeight: '600', color: details.restaurantType === t ? '#FFFFFF' : '#374151' }}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>Cuisines (select all that apply)</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {['North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'].map((c) => {
                                    const selected = details.cuisines.includes(c);
                                    return (
                                        <TouchableOpacity
                                            key={c}
                                            onPress={() => {
                                                const next = selected
                                                    ? details.cuisines.filter(x => x !== c)
                                                    : [...details.cuisines, c];
                                                setDetails({ ...details, cuisines: next });
                                            }}
                                            style={{
                                                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
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

                        <View style={styles.formGroup}>
                            <TouchableOpacity
                                onPress={() => setDetails({ ...details, isVeg: !details.isVeg })}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: details.isVeg ? '#10B981' : '#E5E7EB',
                                    backgroundColor: details.isVeg ? '#ECFDF5' : '#FFFFFF',
                                }}
                            >
                                <View style={{
                                    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                                    borderColor: details.isVeg ? '#10B981' : '#9CA3AF',
                                    backgroundColor: details.isVeg ? '#10B981' : 'transparent',
                                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                }}>
                                    {details.isVeg && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Pure Vegetarian Restaurant</Text>
                                    <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>We do not serve any non-vegetarian items</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: '#999' }]}>City (Read Only)</Text>
                    <TextInput
                        style={[styles.input, { backgroundColor: '#F3F4F6', color: '#666' }]}
                        value={details.cityId}
                        editable={false}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.saveButton, (saving || !isDirty) && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving || !isDirty}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </KeyboardAwareScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
    input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14, fontSize: 16, backgroundColor: '#fff', color: '#000' },
    saveButton: { backgroundColor: '#000', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    saveButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    photosScroll: { flexDirection: 'row', marginTop: 8 },
    photoWrapper: { marginRight: 12 },
    photo: { width: 120, height: 120, borderRadius: 12, backgroundColor: '#F3F4F6' },
    noPhotoBox: { width: 120, height: 120, borderRadius: 12, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#D1D5DB' },
    noPhotoText: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }
});
