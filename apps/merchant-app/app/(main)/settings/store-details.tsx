import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';
import { useStore } from '../../../src/hooks/useStore';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://localhost:3000';

export default function StoreDetailsScreen() {
    const { storeId } = useStore();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [details, setDetails] = useState({
        name: '',
        address: '',
        cityId: '',
        category: '',
        photos: [] as string[]
    });

    useEffect(() => {
        if (storeId) fetchStoreDetails();
    }, [storeId]);

    const fetchStoreDetails = async () => {
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser) return;

            // 1. Try Store table
            // explicitly cast to any to allow merging in later steps
            let { data: storeData, error } = await supabase
                .from('Store')
                .select('name, address, cityId')
                .eq('id', storeId || '')
                .maybeSingle();

            let finalData: any = storeData;

            // 2. If not found, try merchants table using auth userId
            if (!finalData) {
                const { data: merchantData } = await supabase
                    .from('merchants')
                    .select('store_name, address, city, category, store_photos')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (merchantData) {
                    finalData = {
                        name: merchantData.store_name,
                        address: merchantData.address,
                        cityId: merchantData.city, // city name as temporary ID or logic
                        category: merchantData.category,
                        photos: merchantData.store_photos || []
                    };
                }
            } else {
                // Fetch extra merchant details even if store exists for photos/category
                const { data: merchantData } = await supabase
                    .from('merchants')
                    .select('category, store_photos')
                    .eq('id', authUser.id)
                    .maybeSingle();

                if (merchantData) {
                    finalData = {
                        ...finalData,
                        category: merchantData.category,
                        photos: merchantData.store_photos || []
                    };
                }
            }

            if (finalData) {
                setDetails({
                    name: finalData.name || '',
                    address: finalData.address || '',
                    cityId: finalData.cityId || '',
                    category: finalData.category || '',
                    photos: finalData.photos || []
                });
            }
        } catch (error) {
            console.error('Error fetching store details:', error);
            Alert.alert('Error', 'Failed to load store details');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!details.name.trim()) {
            Alert.alert('Validation', 'Store name is required');
            return;
        }

        setSaving(true);
        try {
            // Call our new API endpoint
            const response = await fetch(`${API_URL}/stores/${storeId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(details),
            });

            if (!response.ok) {
                throw new Error('Failed to update store');
            }

            Alert.alert('Success', 'Store details updated successfully', [
                { text: 'OK', onPress: () => router.back() }
            ]);
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

            <View style={styles.content}>
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Store Name</Text>
                    <TextInput
                        style={styles.input}
                        value={details.name}
                        onChangeText={(t) => setDetails({ ...details, name: t })}
                        placeholder="Enter store name"
                    />
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.label}>Address</Text>
                    <TextInput
                        style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                        value={details.address}
                        onChangeText={(t) => setDetails({ ...details, address: t })}
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
                                <Image source={{ uri: photo }} style={styles.photo} />
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
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.saveButtonText}>Save Changes</Text>
                    )}
                </TouchableOpacity>
            </View>
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
