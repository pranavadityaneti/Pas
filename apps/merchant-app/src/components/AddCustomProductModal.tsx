// @lock — Do NOT overwrite. Approved layout & hardened duplicate prevention as of Mar 16, 2026.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, Image, Dimensions, ScrollView, Keyboard, KeyboardAvoidingView } from 'react-native';
// Remove KeyboardAwareScrollView to avoid ghost padding issues
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { supabase } from '../lib/supabase';
import uuid from 'react-native-uuid';
import { InventoryItem } from '../hooks/useInventory';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AddCustomProductModalProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
    storeId: string;
    initialName?: string;
    itemToEdit?: InventoryItem | null;
    verticalPills?: { id: string; name: string }[];
}

export default function AddCustomProductModal({ visible, onClose, onSuccess, storeId, initialName, itemToEdit, verticalPills = [] }: AddCustomProductModalProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState(initialName || '');
    const [mrp, setMrp] = useState('');
    const [sellingPrice, setSellingPrice] = useState('');
    const [brand, setBrand] = useState('');
    const [sku, setSku] = useState('');
    const [stock, setStock] = useState('0');
    const [uom, setUom] = useState('');
    const [gst, setGst] = useState('0');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [images, setImages] = useState<string[]>([]);

    // Dropdown State
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    // Change Detection
    const [originalData, setOriginalData] = useState<{
        name: string;
        mrp: string;
        sellingPrice: string;
        brand: string;
        sku: string;
        stock: string;
        uom: string;
        gst: string;
        category: string;
        description: string;
        images: string[];
    } | null>(null);

    // Suggestions State
    const [catalogSuggestion, setCatalogSuggestion] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (itemToEdit && visible) {
            console.log('[AddCustomProductModal] Edit Mode. Item:', itemToEdit.productId);
            setName(itemToEdit.product.name);
            setMrp(itemToEdit.product.mrp.toString());
            setSellingPrice(itemToEdit.price.toString());
            setBrand(itemToEdit.product.brand || '');
            setSku(itemToEdit.product.ean || '');
            setStock(itemToEdit.stock.toString());
            setUom(itemToEdit.product.uom || '');
            setGst(itemToEdit.product.gstRate?.toString() || '0');
            setCategory(itemToEdit.product.subcategory || '');
            setDescription(itemToEdit.product.description || '');

            // Set change detection baseline
            const initial = {
                name: itemToEdit.product.name,
                mrp: itemToEdit.product.mrp.toString(),
                sellingPrice: itemToEdit.price.toString(),
                brand: itemToEdit.product.brand || '',
                sku: itemToEdit.product.ean || '',
                stock: itemToEdit.stock.toString(),
                uom: itemToEdit.product.uom || '',
                gst: itemToEdit.product.gstRate?.toString() || '0',
                category: itemToEdit.product.subcategory || '',
                description: itemToEdit.product.description || '',
                images: [itemToEdit.product.image].filter(Boolean) as string[]
            };
            setOriginalData(initial);

            // Set initial image from product object
            if (itemToEdit.product.image) {
                setImages([itemToEdit.product.image]);
            }

            // Fetch all images (including primary) from ProductImage table
            fetchExtraImages(itemToEdit.productId);
        } else if (!itemToEdit && visible) {
            resetForm();
            setOriginalData(null);
        }
    }, [itemToEdit, visible]);

    // Update originalData with full image list once fetched
    useEffect(() => {
        if (itemToEdit && visible && originalData && images.length > 1 && originalData.images.length === 1) {
            setOriginalData(prev => prev ? { ...prev, images } : null);
        }
    }, [images, itemToEdit, visible]);

    // Debounced Catalog Check
    useEffect(() => {
        if (!visible || !name || name.length < 3 || itemToEdit) {
            setCatalogSuggestion(null);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const { data } = await supabase
                    .from('Product')
                    .select('id, name')
                    .is('createdByStoreId', null)
                    .ilike('name', `${name.trim()}%`) // Trailing wildcard for better performance
                    .limit(1)
                    .maybeSingle();
                
                if (data) {
                    setCatalogSuggestion(data);
                } else {
                    setCatalogSuggestion(null);
                }
            } catch (err) {
                console.error("Suggestion fetch failed:", err);
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [name, visible, itemToEdit]);

    const hasChanges = () => {
        if (!itemToEdit || !originalData) return true; // Enable for new products
        
        return (
            name.trim() !== originalData.name.trim() ||
            mrp.trim() !== originalData.mrp.trim() ||
            sellingPrice.trim() !== (originalData.sellingPrice || '').trim() ||
            brand.trim() !== (originalData.brand || '').trim() ||
            sku.trim() !== (originalData.sku || '').trim() ||
            stock.trim() !== originalData.stock.trim() ||
            uom.trim() !== (originalData.uom || '').trim() ||
            gst.trim() !== originalData.gst.trim() ||
            category.trim() !== originalData.category.trim() ||
            description.trim() !== (originalData.description || '').trim() ||
            JSON.stringify(images) !== JSON.stringify(originalData.images)
        );
    };

    const fetchExtraImages = async (productId: string) => {
        if (!productId) {
            console.warn("[AddCustomProductModal] No productId provided to fetchExtraImages");
            return;
        }
        try {
            console.log("[AddCustomProductModal] Fetching images for PID:", productId);
            const { data, error } = await supabase
                .from('ProductImage')
                .select('url')
                .eq('productId', productId)
                .order('isPrimary', { ascending: false });
            
            if (error) {
                console.error("[AddCustomProductModal] Supabase Error fetching images:", error);
                return;
            }

            if (data && data.length > 0) {
                const urls = data.map(img => img.url);
                console.log("[AddCustomProductModal] Fetched images:", urls.length);
                setImages(urls);
            } else {
                console.log("[AddCustomProductModal] No extra images found in ProductImage table");
            }
        } catch (err) {
            console.error("[AddCustomProductModal] Catch error in fetchExtraImages:", err);
        }
    };



    const pickImage = async () => {
        if (images.length >= 4) {
            Alert.alert("Limit Reached", "You can only add up to 4 images.");
            return;
        }

        Alert.alert(
            "Add Photo",
            "Choose a source",
            [
                {
                    text: "Take Photo",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestCameraPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert("Permission Required", "Camera access is needed to take a photo.");
                            return;
                        }
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsEditing: true,
                            aspect: [1, 1],
                            quality: 0.5,
                        });
                        if (!result.canceled) {
                            setImages([...images, result.assets[0].uri]);
                        }
                    }
                },
                {
                    text: "Choose from Gallery",
                    onPress: async () => {
                        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                        if (status !== 'granted') {
                            Alert.alert("Permission Required", "Gallery access is needed to pick a photo.");
                            return;
                        }
                        
                        const remainingSlots = 4 - images.length;
                        const result = await ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            allowsMultipleSelection: true,
                            selectionLimit: remainingSlots,
                            aspect: [1, 1],
                            quality: 0.5,
                        });

                        if (!result.canceled) {
                            const newUris = result.assets.map(asset => asset.uri);
                            // Avoid exceeding 4 images total
                            const combined = [...images, ...newUris].slice(0, 4);
                            setImages(combined);
                        }
                    }
                },
                {
                    text: "Cancel",
                    style: "cancel"
                }
            ]
        );
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

    const checkDuplicateProduct = async (name: string, brand: string, uom: string) => {
        try {
            let query = supabase
                .from('Product')
                .select('id, name, createdByStoreId')
                .ilike('name', name.trim());
            
            if (brand.trim()) {
                query = query.ilike('brand', brand.trim());
            } else {
                query = query.is('brand', null);
            }

            if (uom.trim()) {
                query = query.ilike('uom', uom.trim());
            } else {
                query = query.is('uom', null);
            }

            const { data, error } = await query
                .or(`createdByStoreId.eq.${storeId},createdByStoreId.is.null`)
                .limit(1)
                .maybeSingle();

            if (error) {
                console.error("[AddCustomProductModal] Error checking for duplicates:", error);
                return null;
            }

            return data;
        } catch (err) {
            console.error("[AddCustomProductModal] Duplicate check failed:", err);
            return null;
        }
    };

    const handleSave = async () => {
        // Validation
        const parsedMrp = parseFloat(mrp);
        const parsedSellingPrice = parseFloat(sellingPrice || mrp);

        if (!name.trim() || !mrp.trim() || !category.trim()) {
            Alert.alert("Error", "Please fill Name, MRP, and Category");
            return;
        }

        if (isNaN(parsedMrp) || parsedMrp <= 0 || !/^\d+(\.\d{1,2})?$/.test(mrp)) {
            Alert.alert("Error", "Please enter a valid numeric MRP (e.g. 500 or 500.50)");
            return;
        }

        if (sellingPrice && !/^\d+(\.\d{1,2})?$/.test(sellingPrice)) {
            Alert.alert("Error", "Please enter a valid numeric Selling Price");
            return;
        }

        if (parsedMrp > 99999) {
            Alert.alert("Error", "MRP cannot exceed ₹99,999");
            return;
        }

        if (sellingPrice && parsedSellingPrice > parsedMrp) {
            Alert.alert("Error", "Selling price cannot be greater than MRP");
            return;
        }

        if (images.length < 1) {
            Alert.alert("Error", "Please add at least 1 product image.");
            return;
        }

        setLoading(true);
        try {
            const isEditing = !!itemToEdit;

            // 0. Pre-save Duplicate Check
            if (!isEditing) {
                const duplicate = await checkDuplicateProduct(name, brand, uom);
                if (duplicate) {
                    setLoading(false);
                    const isMaster = duplicate.createdByStoreId === null;
                    Alert.alert(
                        isMaster ? "Available in Catalog" : "Duplicate Product",
                        isMaster 
                            ? `"${name}" is already available in our master catalog. Please add it from there to ensure accurate data.`
                            : `A product named "${name}" with the same brand and unit already exists in your inventory.`,
                        [
                            { text: "Cancel", style: "cancel" },
                            { 
                                text: isMaster ? "Go to Catalog" : "View Inventory", 
                                onPress: () => {
                                    onClose();
                                    if (isMaster) {
                                        router.push({
                                            pathname: '/(main)/catalog-picker',
                                            params: { search: name }
                                        } as any);
                                    }
                                }
                            }
                        ]
                    );
                    return;
                }
            }

            // SKU Uniqueness Check (if provided)
            if (sku.trim()) {
                const { data: skuMatch } = await supabase
                    .from('Product')
                    .select('id, name')
                    .eq('ean', sku.trim())
                    .neq('id', isEditing ? itemToEdit.productId : '')
                    .maybeSingle();
                
                if (skuMatch) {
                    setLoading(false);
                    Alert.alert("SKU Conflict", `The SKU/Barcode "${sku}" is already assigned to "${skuMatch.name}". Please use a unique SKU.`);
                    return;
                }
            }

            // 1. Upload Images (Only new ones if they are local URIs)
            const uploadedUrls = [];
            for (const imgUri of images) {
                if (imgUri.startsWith('http')) {
                    uploadedUrls.push(imgUri);
                } else {
                    const url = await uploadImage(imgUri);
                    uploadedUrls.push(url);
                }
            }
            const mainImage = uploadedUrls[0];

            let productId = isEditing ? itemToEdit.productId : uuid.v4().toString();

            // 2. Upsert Product
            const productPayload = {
                name: name.trim(),
                mrp: parsedMrp,
                subcategory: category.trim(),
                brand: brand.trim() || null,
                ean: sku.trim() || null,
                uom: uom.trim() || null,
                gstRate: parseFloat(gst) || 0,
                description: description.trim(),
                image: mainImage,
                updatedAt: new Date().toISOString(),
            };

            if (isEditing) {
                const { error: productError } = await supabase
                    .from('Product')
                    .update(productPayload)
                    .eq('id', productId);
                if (productError) throw productError;
            } else {
                const { error: productError } = await supabase
                    .from('Product')
                    .insert({
                        id: productId,
                        ...productPayload,
                        createdByStoreId: storeId,
                    });
                if (productError) throw productError;
            }

            // 3. Upsert StoreProduct
            const storeProductPayload = {
                price: parsedSellingPrice,
                stock: parseInt(stock) || 0,
                updatedAt: new Date().toISOString(),
            };

            if (isEditing) {
                const { error: storeProductError } = await supabase
                    .from('StoreProduct')
                    .update(storeProductPayload)
                    .eq('id', itemToEdit.id);
                if (storeProductError) throw storeProductError;
            } else {
                const { error: storeProductError } = await supabase
                    .from('StoreProduct')
                    .insert({
                        id: uuid.v4().toString(),
                        storeId: storeId,
                        productId: productId,
                        ...storeProductPayload,
                        active: true,
                        variant: "Standard",
                        is_best_seller: false
                    });
                if (storeProductError) throw storeProductError;
            }

            // 4. Update Images in ProductImage table
            // Simple approach: Delete all existing for this product and re-insert
            if (uploadedUrls.length > 0) {
                console.log("[AddCustomProductModal] Saving images. Total:", uploadedUrls.length);
                const { error: delError } = await supabase.from('ProductImage').delete().eq('productId', productId);
                if (delError) console.warn("[AddCustomProductModal] Error deleting old images:", delError);
                
                const imageData = uploadedUrls.map((url, idx) => ({
                    id: uuid.v4().toString(),
                    productId: productId,
                    url,
                    isPrimary: idx === 0,
                    createdAt: new Date().toISOString()
                }));

                console.log("[AddCustomProductModal] Inserting image data count:", imageData.length);
                const { error: imageError } = await supabase
                    .from('ProductImage')
                    .insert(imageData);

                if (imageError) {
                    console.error("[AddCustomProductModal] Failed to save product images:", imageError);
                } else {
                    console.log("[AddCustomProductModal] Successfully saved images to ProductImage");
                }
            }

            Alert.alert("Success", isEditing ? "Product updated!" : "Custom product created!");
            onSuccess();
            onClose();
            resetForm();
        } catch (error: any) {
            console.error('Error saving product:', error);
            Alert.alert("Error", error.message || "Failed to save product");
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setName('');
        setMrp('');
        setSellingPrice('');
        setBrand('');
        setSku('');
        setStock('0');
        setUom('');
        setGst('0');
        setCategory('');
        setDescription('');
        setImages([]);
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose} statusBarTranslucent={true}>
            <View style={styles.overlay}>
                <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 20) }]}>
                    {/* Header stays pinned at top of container */}
                    <View style={styles.header}>
                        <Text style={styles.title}>{itemToEdit ? "Edit Product" : "Add Custom Product"}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={Colors.text} />
                        </TouchableOpacity>
                    </View>

                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1 }}
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                    >
                        <View style={{ flex: 1 }}>
                            <ScrollView
                                style={{ flex: 1 }}
                                contentContainerStyle={styles.content}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                            >
                                {/* Image Picker */}
                                <Text style={styles.label}>Product Photos (Min 1) <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
                                    {images.map((uri: string, index: number) => (
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

                                <Text style={styles.label}>Product Name <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Mom's Special Pickle"
                                    value={name}
                                    onChangeText={setName}
                                />

                                {catalogSuggestion && (
                                    <View style={styles.suggestionBanner}>
                                        <Ionicons name="information-circle" size={18} color={Colors.primary} />
                                        <Text style={styles.suggestionText}>
                                            Similar product found: <Text style={{ fontWeight: 'bold' }}>{catalogSuggestion.name}</Text>. 
                                            {"\n"}Pick from catalog instead?
                                        </Text>
                                        <TouchableOpacity 
                                            style={styles.suggestionBtn}
                                            onPress={() => {
                                                onClose();
                                                router.push({
                                                    pathname: '/(main)/catalog-picker',
                                                    params: { search: catalogSuggestion.name }
                                                } as any);
                                            }}
                                        >
                                            <Text style={styles.suggestionBtnText}>Go to Catalog</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.label}>Brand Name</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. Homemade"
                                            value={brand}
                                            onChangeText={setBrand}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Category <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                        <TouchableOpacity
                                            style={[styles.input, styles.dropdownBtn]}
                                            onPress={() => {
                                                Keyboard.dismiss();
                                                setShowCategoryDropdown(!showCategoryDropdown);
                                            }}
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
                                        {verticalPills.map(v => (
                                            <TouchableOpacity
                                                key={v.id}
                                                style={styles.dropdownItem}
                                                onPress={() => {
                                                    setCategory(v.name);
                                                    setShowCategoryDropdown(false);
                                                }}
                                            >
                                                <Text>{v.name}</Text>
                                                {category === v.name && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}

                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.label}>MRP (₹) <Text style={{ color: '#EF4444' }}>*</Text></Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="500"
                                            keyboardType="numeric"
                                            value={mrp}
                                            onChangeText={setMrp}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Selling Price (₹)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder={mrp || "450"}
                                            keyboardType="numeric"
                                            value={sellingPrice}
                                            onChangeText={setSellingPrice}
                                        />
                                    </View>
                                </View>

                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.label}>Unit (e.g. 500g, 1L)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="500ml"
                                            value={uom}
                                            onChangeText={setUom}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>Initial Stock</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="10"
                                            keyboardType="numeric"
                                            value={stock}
                                            onChangeText={setStock}
                                        />
                                    </View>
                                </View>

                                <View style={styles.row}>
                                    <View style={{ flex: 1, marginRight: 10 }}>
                                        <Text style={styles.label}>SKU / Barcode</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Optional"
                                            value={sku}
                                            onChangeText={setSku}
                                        />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.label}>GST Rate (%)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="0"
                                            keyboardType="numeric"
                                            value={gst}
                                            onChangeText={setGst}
                                        />
                                    </View>
                                </View>

                                <Text style={styles.label}>Description (Optional)</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Product details..."
                                    value={description}
                                    onChangeText={setDescription}
                                    multiline
                                    numberOfLines={3}
                                    onFocus={() => setShowCategoryDropdown(false)}
                                />
                            </ScrollView>
                        </View>

                        {/* Sticky Footer moves with keyboard */}
                        <View style={styles.footer}>
                            <TouchableOpacity style={[styles.btn, styles.cancelBtn]} onPress={onClose}>
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.btn,
                                    styles.saveBtn,
                                    (loading || (!!itemToEdit && !hasChanges())) && { opacity: 0.5 }
                                ]}
                                onPress={handleSave}
                                disabled={loading || (!!itemToEdit && !hasChanges())}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.saveText}>{itemToEdit ? "Save Changes" : "Create & Add"}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    container: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: SCREEN_HEIGHT * 0.9,
        flex: 1,
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

    // Suggestion Banner
    suggestionBanner: {
        backgroundColor: '#f0f7ff',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#cce3ff',
        marginBottom: 16,
        flexDirection: 'column',
        gap: 8,
    },
    suggestionText: {
        fontSize: 13,
        color: '#0056b3',
        lineHeight: 18,
    },
    suggestionBtn: {
        backgroundColor: '#0056b3',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    suggestionBtnText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});
