import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { supabase } from '../lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AddCustomProductModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    storeId: string;
    initialName?: string;
}

export default function AddCustomProductModal({ visible, onClose, onSuccess, storeId, initialName }: AddCustomProductModalProps) {
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(initialName || '');
    const [mrp, setMrp] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<string[]>([]);

    // Dropdown State
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    // Predefined simple categories for MVP
    const SUGGESTED_CATEGORIES = ["Dairy", "Snacks", "Beverages", "Spices", "Grains", "Household", "Personal Care"];

    const pickImage = async () => {
        if (images.length >= 4) {
            Alert.alert("Limit Reached", "You can only add up to 4 images.");
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImages([...images, result.assets[0].uri]);
        }
    };

    const removeImage = (index: number) => {
        const newImages = [...images];
        newImages.splice(index, 1);
        setImages(newImages);
    };

    const uploadImage = async (uri: string) => {
        try {
            const formData = new FormData();
            const fileName = `custom-${storeId}-${Date.now()}-${Math.random()}.jpg`;

            // @ts-ignore
            formData.append('file', {
                uri,
                name: fileName,
                type: 'image/jpeg',
            });

            const { data, error } = await supabase.storage
                .from('products')
                .upload(fileName, formData, {
                    contentType: 'image/jpeg',
                });

            if (error) throw error;

            const { data: publicData } = supabase.storage
                .from('products')
                .getPublicUrl(fileName);

            return publicData.publicUrl;
        } catch (error) {
            console.error("Image upload failed:", error);
            throw error;
        }
    };

    const handleSave = async () => {
        // Validation
        if (!name.trim() || !mrp.trim() || !category.trim()) {
            Alert.alert("Error", "Please fill Name, MRP, and Category");
            return;
        }
        if (images.length < 1) {
            Alert.alert("Error", "Please add at least 1 product image.");
            return;
        }

        setLoading(true);
        try {
            // 1. Upload Images
            const uploadedUrls = [];
            for (const imgUri of images) {
                const url = await uploadImage(imgUri);
                uploadedUrls.push(url);
            }
            const mainImage = uploadedUrls[0]; // First image is main

            // 2. Create Product in Global Table (Private to Store)
            const { data: productData, error: productError } = await supabase
                .from('Product')
                .insert({
                    name: name.trim(),
                    mrp: parseFloat(mrp),
                    category: category.trim(),
                    description: description.trim(),
                    createdByStoreId: storeId, // CRITICAL: Marks it as custom/private
                    image: mainImage
                })
                .select()
                .single();

            if (productError) throw productError;

            // 3. Link to Store Inventory (StoreProduct)
            const { error: storeProductError } = await supabase
                .from('StoreProduct')
                .insert({
                    storeId: storeId,
                    productId: productData.id,
                    price: parseFloat(mrp), // Default selling price = MRP
                    stock: 0,
                    active: true
                });

            if (storeProductError) throw storeProductError;

            Alert.alert("Success", "Custom product created!");
            onSuccess();
            resetForm();
        } catch (error: any) {
            console.error('Error creating product:', error);
            Alert.alert("Error", error.message || "Failed to create product");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setMrp('');
        setCategory('');
        setDescription('');
        setImages([]);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Add Custom Product</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={Colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Image Picker */}
                        <Text style={styles.label}>Product Photos (Min 1, Max 4) *</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                            {images.map((uri, index) => (
                                <View key={index} style={styles.imagePreview}>
                                    <Image source={{ uri }} style={styles.thumb} />
                                    <TouchableOpacity style={styles.removeBtn} onPress={() => removeImage(index)}>
                                        <Ionicons name="close" size={12} color="#fff" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {images.length < 4 && (
                                <TouchableOpacity style={styles.addBtn} onPress={pickImage}>
                                    <Ionicons name="camera" size={24} color="#666" />
                                    <Text style={styles.addBtnText}>Add</Text>
                                </TouchableOpacity>
                            )}
                        </ScrollView>

                        <Text style={styles.label}>Product Name *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Mom's Special Pickle"
                            value={name}
                            onChangeText={setName}
                        />

                        <View style={styles.row}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.label}>MRP (₹) *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="500"
                                    keyboardType="numeric"
                                    value={mrp}
                                    onChangeText={setMrp}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>Category *</Text>
                                <TouchableOpacity
                                    style={[styles.input, styles.dropdownBtn]}
                                    onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                >
                                    <Text style={{ color: category ? '#000' : '#aaa' }}>
                                        {category || "Select..."}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Dropdown List */}
                        {showCategoryDropdown && (
                            <View style={styles.dropdownList}>
                                {SUGGESTED_CATEGORIES.map(cat => (
                                    <TouchableOpacity
                                        key={cat}
                                        style={styles.dropdownItem}
                                        onPress={() => {
                                            setCategory(cat);
                                            setShowCategoryDropdown(false);
                                        }}
                                    >
                                        <Text>{cat}</Text>
                                        {category === cat && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <Text style={styles.label}>Description (Optional)</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Product details..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            numberOfLines={3}
                        />

                    </ScrollView>

                    <View style={styles.footer}>
                        <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                            <Text style={styles.cancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.btn, styles.saveBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSave}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Create & Add</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: Platform.OS === 'android' ? SCREEN_HEIGHT * 0.9 : '90%',
        paddingBottom: 20
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
    title: { fontSize: 20, fontWeight: 'bold' },
    content: { padding: 20 },
    label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: Colors.text },
    input: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#eee', marginBottom: 16, fontSize: 16 },
    textArea: { height: 80, textAlignVertical: 'top' },
    row: { flexDirection: 'row' },

    // Image Picker Styles
    imageScroll: { flexDirection: 'row', marginBottom: 16 },
    imagePreview: { width: 70, height: 70, marginRight: 10, borderRadius: 8, overflow: 'hidden', position: 'relative' },
    thumb: { width: '100%', height: '100%' },
    removeBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 2 },
    addBtn: { width: 70, height: 70, borderRadius: 8, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#aaa' },
    addBtnText: { fontSize: 10, color: '#666', marginTop: 2 },

    // Dropdown Styles
    dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dropdownList: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#eee', borderRadius: 8, marginBottom: 16, marginTop: -10, elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
    dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', flexDirection: 'row', justifyContent: 'space-between' },

    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#eee', flexDirection: 'row', gap: 12 },
    btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: '#f5f5f5' },
    saveBtn: { backgroundColor: Colors.primary },
    cancelText: { fontWeight: 'bold', color: Colors.text },
    saveText: { fontWeight: 'bold', color: '#fff' },
});
