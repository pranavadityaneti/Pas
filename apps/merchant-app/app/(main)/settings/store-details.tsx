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
        photos: [] as string[]
    });
    const [initialDetails, setInitialDetails] = useState<typeof details | null>(null);

    // Realtime Merchant Extras (Signup Data)
    const { data: merchantDataList, loading: merchantLoading } = useRealtimeTable({
        tableName: 'merchants',
        select: 'store_name, address, city, vertical_id, store_photos',
        filter: store?.id ? `id=eq.${store.id}` : undefined,
        enabled: !!store?.id
    });

    useEffect(() => {
        if (merchantLoading) return;

        if (merchantDataList && merchantDataList.length > 0) {
            const mData = merchantDataList[0];
            
            // Handle Photos (Priority: Store.image, Fallback: merchants.store_photos)
            let photosArray: string[] = [];
            
            // Step 1: Add main image from Store table
            if (store?.image) {
                photosArray.push(store.image);
            }

            // Step 2: Add additional photos from merchants table (parsing JSON if needed)
            try {
                const rawPhotos = mData.store_photos;
                let additionalPhotos: string[] = [];
                if (Array.isArray(rawPhotos)) {
                    additionalPhotos = rawPhotos;
                } else if (typeof rawPhotos === 'string' && rawPhotos.startsWith('[')) {
                    additionalPhotos = JSON.parse(rawPhotos);
                } else if (rawPhotos) {
                    additionalPhotos = [rawPhotos];
                }
                
                // Avoid duplicating the main image if it's already in the list
                additionalPhotos.forEach(p => {
                    if (!photosArray.includes(p)) photosArray.push(p);
                });
            } catch (e) {
                console.warn('[StoreDetails] Photo parsing error:', e);
            }

            // Prepend Storage URL
            const fullPhotoUrls = photosArray.map(p => {
                const cleanPath = p.startsWith('/') ? p.substring(1) : p;
                const fullUri = (p.startsWith('http') || p.startsWith('data:')) ? p : `${STORAGE_BASE_URL}${cleanPath}`;
                console.log("DEBUG PHOTO URI:", fullUri);
                return fullUri;
            });

            const label = mData.vertical_id === 'c307b78e-b924-47a1-a5a7-4405777fa50c' ? 'Kirana Store' : 'General Store';

            const newDetails = {
                name: mData.store_name || '',
                address: mData.address || '',
                category: label,
                photos: fullPhotoUrls,
                cityId: mData.city || ''
            };
            setDetails(newDetails);
            setInitialDetails(newDetails);
        }
        setLoading(false);
    }, [merchantDataList, merchantLoading, store?.image]);

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
            // Updated to use Supabase directly (Fixing localhost issue)
            const { error } = await supabase
                .from('Store')
                .update({
                    name: details.name,
                    address: details.address,
                    // cityId and category are read-only or managed elsewhere
                    // photos: details.photos // Photos update logic might need storage upload, skipped for now as per UI
                })
                .eq('id', store.id);

            if (error) throw error;

            setInitialDetails(details); // Update initial state on success
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
                                    defaultSource={require('../../../assets/images/icon.png')} // Fallback if local
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
