import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Image, Dimensions, ScrollView, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/Colors';
import { supabase } from '../lib/supabase';
import uuid from 'react-native-uuid';
import { InventoryItem } from '../hooks/useInventory';
import { useStore } from '../hooks/useStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const MENU_SECTIONS = ['Starters', 'Main Course', 'Desserts', 'Beverages', 'Sides', 'Specials', 'Custom...'];

const VARIANT_PRESETS = [
    { id: 'none', label: 'None' },
    { id: 'half-full', label: 'Half / Full', values: ['Half', 'Full'] },
    { id: 's-m-l', label: 'Small / Medium / Large', values: ['Small', 'Medium', 'Large'] },
    { id: 'reg-jumbo', label: 'Regular / Jumbo', values: ['Regular', 'Jumbo'] },
    { id: 'single-double', label: 'Single / Double', values: ['Single', 'Double'] },
    { id: 'custom', label: 'Custom' }
];

interface AddMenuProductModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    storeId: string;
    initialName?: string;
    itemToEdit?: InventoryItem | null;
}

export default function AddMenuProductModal({ visible, onClose, onSuccess, storeId, initialName, itemToEdit }: AddMenuProductModalProps) {
    const { activeRole, hasRealBranch } = useStore();
    const insets = useSafeAreaInsets();
    const [loading, setLoading] = useState(false);
    
    // Core Product Fields
    const [name, setName] = useState(initialName || '');
    const [menuSectionPreset, setMenuSectionPreset] = useState('');
    const [customMenuSection, setCustomMenuSection] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<string[]>([]);
    
    // GST
    const [gstPreset, setGstPreset] = useState<'5' | '12' | '18' | 'custom'>('5');
    const [customGst, setCustomGst] = useState('');

    // StoreProduct Fields
    const [menuPrice, setMenuPrice] = useState(''); 
    const [discountedPrice, setDiscountedPrice] = useState(''); 
    const [availableToday, setAvailableToday] = useState(true);

    // Extra Data Fields (JSONB)
    const [dietaryTag, setDietaryTag] = useState<'veg' | 'non-veg' | 'egg' | 'vegan'>('veg');
    const [spiceLevel, setSpiceLevel] = useState<'none' | 'mild' | 'medium' | 'spicy' | 'extra-spicy'>('none');

    // Portion Variants
    const [variantPreset, setVariantPreset] = useState<string>('none');
    const [variants, setVariants] = useState<{ variant: string, price: string }[]>([]);
    const [newVariantName, setNewVariantName] = useState('');
    const [newVariantPrice, setNewVariantPrice] = useState('');

    useEffect(() => {
        if (itemToEdit && visible) {
            setName(itemToEdit.product.name);
            
            const sub = itemToEdit.product.subcategory || '';
            if (MENU_SECTIONS.includes(sub)) {
                setMenuSectionPreset(sub);
            } else {
                setMenuSectionPreset('Custom...');
                setCustomMenuSection(sub);
            }

            setDescription(itemToEdit.product.description || '');
            setAvailableToday(itemToEdit.active);

            const itemGst = itemToEdit.product.gstRate?.toString() || '5';
            if (['5', '12', '18'].includes(itemGst)) {
                setGstPreset(itemGst as any);
            } else {
                setGstPreset('custom');
                setCustomGst(itemGst);
            }

            const extraData = itemToEdit.product.extra_data || {};
            setDietaryTag(extraData.dietaryTag || (extraData.isVeg ? 'veg' : 'non-veg'));
            setSpiceLevel(extraData.spice_level || 'none');

            if (itemToEdit.product.image) {
                setImages([itemToEdit.product.image]);
            }
            fetchExtraImages(itemToEdit.productId);
            fetchVariants(itemToEdit.productId);
        } else if (!itemToEdit && visible) {
            resetForm();
        }
    }, [itemToEdit, visible]);

    const fetchExtraImages = async (productId: string) => {
        try {
            const { data } = await supabase.from('ProductImage').select('url').eq('productId', productId).order('createdAt', { ascending: true });
            if (data && data.length > 0) {
                setImages(data.map(img => img.url));
            }
        } catch (error) {
            console.error("Error fetching images:", error);
        }
    };

    const fetchVariants = async (productId: string) => {
        try {
            const { data } = await supabase.from('StoreProduct').select('variant, price').eq('productId', productId).eq('storeId', storeId);
            if (data && data.length > 1) { 
                const allVariants = data.map(d => ({ variant: d.variant, price: d.price.toString() }));
                setVariants(allVariants);
                setVariantPreset('custom'); // We don't try to reverse-match presets perfectly
                setMenuPrice('');
                setDiscountedPrice('');
            } else if (data && data.length === 1) {
                const single = data[0];
                if (single.variant && single.variant !== 'Standard') {
                    setVariants([{ variant: single.variant, price: single.price.toString() }]);
                    setVariantPreset('custom');
                    setMenuPrice('');
                } else {
                    setVariantPreset('none');
                    if (itemToEdit?.product.mrp) setMenuPrice(itemToEdit.product.mrp.toString());
                    setDiscountedPrice(single.price.toString());
                }
            }
        } catch (error) {
            console.error("Error fetching variants:", error);
        }
    };

    const resetForm = () => {
        setName(initialName || '');
        setMenuPrice('');
        setDiscountedPrice('');
        setMenuSectionPreset('');
        setCustomMenuSection('');
        setDescription('');
        setGstPreset('5');
        setCustomGst('');
        setImages([]);
        setAvailableToday(true);
        setDietaryTag('veg');
        setSpiceLevel('none');
        setVariantPreset('none');
        setVariants([]);
        setNewVariantName('');
        setNewVariantPrice('');
    };

    const handlePresetChange = (presetId: string) => {
        setVariantPreset(presetId);
        setMenuPrice('');
        setDiscountedPrice('');

        const preset = VARIANT_PRESETS.find(p => p.id === presetId);
        if (preset && preset.values && preset.values.length > 0) {
            setVariants(preset.values.map(v => ({ variant: v, price: '' })));
        } else if (presetId === 'none') {
            setVariants([]);
        } else if (presetId === 'custom') {
            // keep existing variants but let them edit
        }
    };

    const handleUpdateVariantPrice = (index: number, price: string) => {
        const newVariants = [...variants];
        newVariants[index].price = price;
        setVariants(newVariants);
    };

    const handleAddVariant = () => {
        if (!newVariantName || !newVariantPrice) return;
        setVariants([...variants, { variant: newVariantName, price: newVariantPrice }]);
        setMenuPrice('');
        setDiscountedPrice('');
        setNewVariantName('');
        setNewVariantPrice('');
    };

    const handleRemoveVariant = (index: number) => {
        const newVariants = [...variants];
        newVariants.splice(index, 1);
        setVariants(newVariants);
    };

    const pickImage = async () => {
        if (images.length >= 4) {
            Alert.alert("Limit Reached", "You can only add up to 4 images.");
            return;
        }

        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            selectionLimit: 4 - images.length,
            quality: 0.6,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            const newUris = result.assets.map(a => a.uri);
            setImages([...images, ...newUris].slice(0, 4));
        }
    };

    const uploadImage = async (uri: string) => {
        try {
            const formData = new FormData();
            const fileName = `custom-${activeRole?.id || storeId}-${Date.now()}-${Math.random()}.jpg`;

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
        // Layer 3 defense (May 20, 2026): refuse to write StoreProduct rows when
        // no real merchant_branches row exists. Without this, fk_storeproduct_branch
        // would violate on the upsert at line 395.
        if (!hasRealBranch) {
            return Alert.alert(
                'Set up your branch first',
                'You need to add at least one branch before adding menu items. Go to Settings → Branches → Add Branch.',
            );
        }

        const finalMenuSection = menuSectionPreset === 'Custom...' ? customMenuSection : menuSectionPreset;

        // 1. Name
        if (!name.trim()) return Alert.alert("Required", "Please enter the item name.");

        // 2. Menu Section
        if (!finalMenuSection.trim()) return Alert.alert("Required", "Please select or enter a menu section.");

        // 3. Images (at least 1)
        if (images.length === 0) return Alert.alert("Required", "Please add at least one photo.");

        // 4. GST Validation
        let finalGstRate = 5;
        if (gstPreset === 'custom') {
            finalGstRate = parseFloat(customGst);
            if (isNaN(finalGstRate) || finalGstRate < 0) {
                return Alert.alert("Invalid Input", "Please enter a valid positive GST rate.");
            }
        } else {
            finalGstRate = parseFloat(gstPreset);
        }

        // 5. Pricing & Variants Validation
        let finalMrp = 0;
        
        if (variantPreset === 'none') {
            const parsedPrice = parseFloat(menuPrice);
            if (isNaN(parsedPrice) || parsedPrice <= 0) {
                return Alert.alert("Invalid Input", "Please enter a valid Menu Price greater than 0.");
            }
            if (discountedPrice.trim() !== '') {
                const parsedDiscount = parseFloat(discountedPrice);
                if (isNaN(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > parsedPrice) {
                    return Alert.alert("Invalid Input", "Discounted Price must be a valid number and cannot be greater than the Menu Price.");
                }
            }
            finalMrp = parsedPrice;
        } else {
            if (variants.length === 0) {
                return Alert.alert("Required", "Please add at least one variant or select 'None'.");
            }
            for (let i = 0; i < variants.length; i++) {
                const parsedPrice = parseFloat(variants[i].price);
                if (isNaN(parsedPrice) || parsedPrice <= 0) {
                    return Alert.alert("Invalid Input", `Please enter a valid price for the '${variants[i].variant}' variant.`);
                }
            }
            finalMrp = parseFloat(variants[0].price);
        }

        setLoading(true);

        try {
            const isEditing = !!itemToEdit;
            let productId = isEditing ? itemToEdit.productId : uuid.v4().toString();

            // Check if a Product with the same name already exists for this store (prevents unique constraint violation)
            if (!isEditing) {
                const { data: existing } = await supabase
                    .from('Product')
                    .select('id')
                    .eq('createdByStoreId', activeRole?.id || storeId)
                    .eq('name', name.trim())
                    .limit(1)
                    .maybeSingle();
                if (existing) {
                    productId = existing.id;
                }
            }

            // 1. Upload Images
            const uploadedUrls = [];
            for (const imgUri of images) {
                if (imgUri.startsWith('http')) {
                    uploadedUrls.push(imgUri);
                } else {
                    const url = await uploadImage(imgUri);
                    uploadedUrls.push(url);
                }
            }
            const primaryImageUrl = uploadedUrls[0] || null;
            
            const isVeg = dietaryTag === 'veg' || dietaryTag === 'vegan';

            const productPayload = {
                id: productId,
                name: name.trim(),
                subcategory: finalMenuSection.trim(),
                mrp: finalMrp,
                gstRate: finalGstRate,
                description: description.trim(),
                image: primaryImageUrl,
                createdByStoreId: activeRole?.id || storeId, 
                extra_data: {
                    isVeg,
                    dietaryTag,
                    spice_level: spiceLevel,
                    prep_time_minutes: 15
                },
                updatedAt: new Date().toISOString()
            };

            console.log('[Product upsert] Payload:', JSON.stringify(productPayload, null, 2));
            console.log('[Product upsert] activeRole?.id:', activeRole?.id, 'storeId prop:', storeId);

            const { error: pError } = await supabase.from('Product').upsert(productPayload);
            if (pError) throw pError;

            if (uploadedUrls.length > 0) {
                await supabase.from('ProductImage').delete().eq('productId', productId);
                const imageData = uploadedUrls.map((url, i) => ({
                    id: uuid.v4().toString(),
                    productId,
                    url,
                    isPrimary: i === 0
                }));
                await supabase.from('ProductImage').insert(imageData);
            }

            let variantsToSave = variants;
            if (variantPreset === 'none' || variants.length === 0) {
                variantsToSave = [{ variant: 'Standard', price: discountedPrice || menuPrice }];
            }

            if (isEditing) {
                await supabase.from('StoreProduct').delete().eq('productId', productId).eq('storeId', storeId);
            }

            const branchId = activeRole?.id || storeId;
            const storeProductPayloads = variantsToSave.map(v => ({
                id: uuid.v4().toString(),
                storeId: branchId,
                branch_id: branchId,
                productId,
                price: parseFloat(v.price),
                stock: 0,
                active: availableToday,
                variant: v.variant,
                is_best_seller: false,
                updatedAt: new Date().toISOString()
            }));

            const { error: spError } = await supabase
                .from('StoreProduct')
                .upsert(storeProductPayloads, {
                    onConflict: 'branch_id,productId,variant',
                    ignoreDuplicates: false,
                });
            if (spError) throw spError;

            onSuccess();
            resetForm();
        } catch (error: any) {
            console.error("Save error:", error);
            Alert.alert("Error", error.message || "Failed to save product");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: '#f8f9fa' }}>
                <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 20 : insets.top }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                        <Ionicons name="close" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{itemToEdit ? 'Edit Menu Item' : 'Add Menu Item'}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
                    <Text style={styles.sectionTitle}>Item Photos (Max 4)</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                        {images.map((uri, index) => (
                            <View key={index} style={styles.imageContainer}>
                                <Image source={{ uri }} style={styles.imagePreview} />
                                <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImages(images.filter((_, i) => i !== index))}>
                                    <Ionicons name="close" size={14} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        ))}
                        {images.length < 4 && (
                            <TouchableOpacity style={styles.addImageBtn} onPress={pickImage}>
                                <Ionicons name="camera-outline" size={32} color="#666" />
                                <Text style={styles.addImageText}>Add Photo</Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>

                    <View style={styles.card}>
                        <Text style={styles.label}>Item Name *</Text>
                        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Masala Dosa" />

                        <Text style={styles.label}>Menu Section *</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                            {MENU_SECTIONS.map(sec => (
                                <TouchableOpacity key={sec} style={[styles.pill, menuSectionPreset === sec && styles.pillActive]} onPress={() => setMenuSectionPreset(sec)}>
                                    <Text style={[styles.pillText, menuSectionPreset === sec && styles.pillTextActive]}>{sec}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        {menuSectionPreset === 'Custom...' && (
                            <TextInput style={styles.input} value={customMenuSection} onChangeText={setCustomMenuSection} placeholder="Enter custom section name" />
                        )}

                        <Text style={styles.label}>Description</Text>
                        <TextInput style={[styles.input, { height: 80, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Ingredients, taste, etc." multiline />
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Pricing & Variants</Text>

                        <Text style={styles.label}>Portion Sizes / Variants</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                            {VARIANT_PRESETS.map(preset => (
                                <TouchableOpacity key={preset.id} style={[styles.pill, variantPreset === preset.id && styles.pillActive]} onPress={() => handlePresetChange(preset.id)}>
                                    <Text style={[styles.pillText, variantPreset === preset.id && styles.pillTextActive]}>{preset.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        
                        {variantPreset === 'none' ? (
                            <View style={styles.row}>
                                <View style={{ flex: 1, marginRight: 10 }}>
                                    <Text style={styles.label}>Menu Price (₹) *</Text>
                                    <TextInput style={styles.input} value={menuPrice} onChangeText={setMenuPrice} placeholder="0" keyboardType="numeric" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Discounted Price (₹)</Text>
                                    <TextInput style={styles.input} value={discountedPrice} onChangeText={setDiscountedPrice} placeholder="Optional" keyboardType="numeric" />
                                </View>
                            </View>
                        ) : (
                            <View>
                                <View style={styles.infoBox}>
                                    <Ionicons name="information-circle-outline" size={16} color="#666" />
                                    <Text style={styles.infoText}>Adding variants? Each variant gets its own price.</Text>
                                </View>
                                
                                {variants.map((v, index) => (
                                    <View key={index} style={styles.variantInputRow}>
                                        <Text style={styles.variantInputLabel}>{v.variant}</Text>
                                        <TextInput 
                                            style={[styles.input, { flex: 1, marginBottom: 0 }]} 
                                            value={v.price} 
                                            onChangeText={(text) => handleUpdateVariantPrice(index, text)} 
                                            placeholder="Price (₹)" 
                                            keyboardType="numeric" 
                                        />
                                        {variantPreset === 'custom' && (
                                            <TouchableOpacity onPress={() => handleRemoveVariant(index)} style={{ marginLeft: 10 }}>
                                                <Ionicons name="trash-outline" size={24} color="red" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}

                                {variantPreset === 'custom' && (
                                    <View style={[styles.row, { marginTop: 10 }]}>
                                        <TextInput style={[styles.input, { flex: 2, marginRight: 10, marginBottom: 0 }]} value={newVariantName} onChangeText={setNewVariantName} placeholder="e.g. Extra Cheese" />
                                        <TextInput style={[styles.input, { flex: 1, marginRight: 10, marginBottom: 0 }]} value={newVariantPrice} onChangeText={setNewVariantPrice} placeholder="₹ Price" keyboardType="numeric" />
                                        <TouchableOpacity style={styles.addVariantBtn} onPress={handleAddVariant}>
                                            <Ionicons name="add" size={24} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}
                    </View>

                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Dietary & Details</Text>
                        
                        <Text style={styles.label}>Dietary Tag</Text>
                        <View style={styles.pillContainer}>
                            {['veg', 'non-veg', 'egg', 'vegan'].map(tag => (
                                <TouchableOpacity key={tag} style={[styles.pill, dietaryTag === tag && styles.pillActive]} onPress={() => setDietaryTag(tag as any)}>
                                    <Text style={[styles.pillText, dietaryTag === tag && styles.pillTextActive]}>{tag.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>Spice Level</Text>
                        <View style={styles.pillContainer}>
                            {['none', 'mild', 'medium', 'spicy', 'extra-spicy'].map(level => (
                                <TouchableOpacity key={level} style={[styles.pill, spiceLevel === level && styles.pillActive]} onPress={() => setSpiceLevel(level as any)}>
                                    <Text style={[styles.pillText, spiceLevel === level && styles.pillTextActive]}>{level.toUpperCase()}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>GST Rate (%)</Text>
                        <View style={styles.pillContainer}>
                            {['5', '12', '18', 'custom'].map(rate => (
                                <TouchableOpacity key={rate} style={[styles.pill, gstPreset === rate && styles.pillActive]} onPress={() => setGstPreset(rate as any)}>
                                    <Text style={[styles.pillText, gstPreset === rate && styles.pillTextActive]}>{rate === 'custom' ? 'Custom' : rate + '%'}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        {gstPreset === 'custom' && (
                            <TextInput style={styles.input} value={customGst} onChangeText={setCustomGst} placeholder="Custom GST %" keyboardType="numeric" />
                        )}
                    </View>

                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.label}>Available Today</Text>
                            <TouchableOpacity onPress={() => setAvailableToday(!availableToday)}>
                                <Ionicons name={availableToday ? 'toggle' : 'toggle-outline'} size={32} color={availableToday ? Colors.primary : '#ccc'} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Menu Item</Text>}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    closeBtn: { padding: 5 },
    scrollContent: { padding: 20, paddingBottom: 100 },
    card: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
    label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 5 },
    input: { backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginBottom: 15 },
    row: { flexDirection: 'row', alignItems: 'center' },
    rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    imageScroll: { marginBottom: 15 },
    imageContainer: { marginRight: 10, position: 'relative' },
    imagePreview: { width: 80, height: 80, borderRadius: 10 },
    removeImageBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 4 },
    addImageBtn: { width: 80, height: 80, borderRadius: 10, borderWidth: 1, borderColor: '#ccc', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9f9f9' },
    addImageText: { fontSize: 12, color: '#666', marginTop: 5 },
    pillScroll: { marginBottom: 15 },
    pillContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    pill: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f9f9f9', marginRight: 8, marginBottom: 8 },
    pillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    pillText: { fontSize: 13, color: '#666', fontWeight: '500' },
    pillTextActive: { color: '#fff', fontWeight: 'bold' },
    variantInputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    variantInputLabel: { flex: 1, fontSize: 15, fontWeight: '500' },
    addVariantBtn: { backgroundColor: Colors.primary, width: 45, height: 45, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 15, gap: 5 },
    infoText: { fontSize: 13, color: '#666', fontStyle: 'italic' },
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
    saveBtn: { backgroundColor: Colors.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
