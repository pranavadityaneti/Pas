/**
 * StepPhotos — Step 3 of merchant signup (store photo gallery).
 *
 * 2026-06-04 (Phase 1.7.B): Extracted from app/(auth)/signup.tsx. Both
 * the picker (`pickStorePhoto`) and remover (`removeStorePhoto`) handlers
 * move with the component because they're Step-3-only. `storePhotos` and
 * `setStorePhotos` come from useSignupContext.
 *
 * Hard-coded limits preserved verbatim from the orchestrator:
 *   - At least 2 photos required (validation lives in validations.validatePhotos)
 *   - Max 5 photos accepted by the picker UI
 *   - quality: 0.7 on ImagePicker
 *   - allowsMultipleSelection: true (no explicit selectionLimit so the
 *     library default applies — matches prior behavior)
 */

import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

export function StepPhotos() {
    const { storePhotos, setStorePhotos } = useSignupContext();

    const pickStorePhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const uris = result.assets.map(a => a.uri);
            setStorePhotos(prev => [...prev, ...uris]);
        }
    };

    const removeStorePhoto = (idx: number) => {
        setStorePhotos(prev => prev.filter((_, i) => i !== idx));
    };

    return (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Ionicons name="images-outline" size={20} color={Colors.primary} />
                <Text style={styles.cardTitle}>Store Photos <Text style={styles.required}>*</Text></Text>
            </View>
            <Text style={styles.label}>Please upload at least 2 photos of your store (Front view, Inside view, etc.)</Text>

            <View style={styles.photoGrid}>
                {storePhotos.map((uri, idx) => (
                    <View key={idx} style={styles.photoWrapper}>
                        <Image source={{ uri }} style={styles.photoBox} resizeMode="cover" />
                        <TouchableOpacity style={styles.removePhoto} onPress={() => removeStorePhoto(idx)}>
                            <Ionicons name="close-circle" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ))}
                {storePhotos.length < 5 && (
                    <TouchableOpacity style={styles.addPhotoBox} onPress={pickStorePhoto}>
                        <Ionicons name="add" size={32} color={Colors.primary} />
                        <Text style={styles.addPhotoText}>Add Photo</Text>
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.photoCounter}>{storePhotos.length} / 5 photos selected</Text>
        </View>
    );
}
