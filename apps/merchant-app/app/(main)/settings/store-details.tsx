import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../../src/lib/supabase';
import { Colors } from '../../../constants/Colors';
import { useStoreContext } from '../../../src/context/StoreContext';
import { useUser } from '../../../src/context/UserContext';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';
import Constants from 'expo-constants';

export default function StoreDetailsScreen() {
    const { store } = useStoreContext();
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

    // Realtime Merchant Extras (Photos, Category)
    const { data: merchantDataList, loading: merchantLoading } = useRealtimeTable({
        tableName: 'merchants',
        select: 'category, store_photos, city',
        filter: user?.email ? `email=eq.${user.email}` : undefined,
        enabled: !!user?.email
    });

    useEffect(() => {
        if (merchantLoading) return;

        if (merchantDataList && merchantDataList.length > 0) {
            const mData = merchantDataList[0];
            setDetails(prev => ({
                ...prev,
                category: mData.category || '',
                photos: mData.store_photos || [],
                cityId: mData.city || ''
            }));
        }
        setLoading(false);
    }, [merchantDataList, merchantLoading]);

    // Sync with Store Context (Realtime)
    useEffect(() => {
        if (store) {
            setDetails(prev => {
                // Only update if changed to avoid cursor jumps if we were typing? 
                // Actually, if we are typing, we don't want external updates to overwrite us immediately
                // But for "Realtime", we generally expect latest server state.
                // To keep it simple: We update local state if it differs from Store Context, 
                // but we might want to check if the user is currently editing?
                // For now, we will just sync. If user is typing and another device updates, it might jump.
                // A better UX is to show a "New data available" toast, but requirements said "Realtime Sync".
                // So we will overwrite.

                const newDetails = {
                    ...prev,
                    name: store.name || prev.name,
                    address: store.address || prev.address
                };

                // Update initial details to the new baseline so 'isDirty' works correctly
                setInitialDetails(current => ({
                    ...current,
                    ...newDetails
                } as typeof details));

                return newDetails;
            });
        }
    }, [store]);

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

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={100}
            >
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
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
                </ScrollView>
            </KeyboardAvoidingView>
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
