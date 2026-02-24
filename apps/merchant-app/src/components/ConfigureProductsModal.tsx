import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, ScrollView, Image, Dimensions, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { supabase } from '../lib/supabase';
import { Colors } from '../../constants/Colors';

const { height } = Dimensions.get('window');

// Simple UUID generator to avoid dependency issues
const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

interface ConfigureProductsModalProps {
    visible: boolean;
    storeId: string;
    products: any[];
    onClose: () => void;
    onSuccess: () => void;
}

// Mock Variant Logic with Smart Ratios
// ratio: 1.0 = 100% of Base MRP
const getVariantsForCategory = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('dairy') || cat.includes('beverage')) {
        return [
            { label: '250ml', ratio: 0.3 },
            { label: '500ml', ratio: 0.55 },
            { label: '1L', ratio: 1.0 }
        ];
    }
    if (cat.includes('fashion') || cat.includes('cloth')) {
        return [
            { label: 'S', ratio: 1.0 },
            { label: 'M', ratio: 1.0 },
            { label: 'L', ratio: 1.0 },
            { label: 'XL', ratio: 1.0 }
        ];
    }
    if (cat.includes('footwear')) {
        return [
            { label: 'UK 7', ratio: 1.0 },
            { label: 'UK 8', ratio: 1.0 },
            { label: 'UK 9', ratio: 1.0 },
            { label: 'UK 10', ratio: 1.0 }
        ];
    }
    return [{ label: 'Standard', ratio: 1.0 }];
};

export default function ConfigureProductsModal({ visible, storeId, products, onClose, onSuccess }: ConfigureProductsModalProps) {
    // Config Structure: { [productId]: { [variantLabel]: { price, stock, active } } }
    const [config, setConfig] = useState<Record<string, Record<string, { price: string; stock: string; active: boolean }>>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadExistingConfig = async () => {
            const productIds = products.map(p => p.id);
            if (productIds.length === 0) return;

            const { data: existingData } = await supabase
                .from('StoreProduct')
                .select('productId, variant, price, stock, active')
                .eq('storeId', storeId)
                .in('productId', productIds);

            const initialConfig: any = {};

            // Initialize base config structure
            products.forEach(p => {
                const variants = getVariantsForCategory(p.category);
                initialConfig[p.id] = {};
                variants.forEach(v => {
                    const calculatedDefaultPrice = Math.round((p.mrp || 0) * v.ratio);
                    initialConfig[p.id][v.label] = {
                        price: calculatedDefaultPrice.toString(),
                        stock: v.label === 'Standard' ? '10' : '0',
                        active: v.label === 'Standard'
                    };
                });
            });

            // Overlay existing data
            if (existingData) {
                existingData.forEach((row: any) => {
                    const vLabel = row.variant || 'Standard';
                    if (initialConfig[row.productId] && initialConfig[row.productId][vLabel]) {
                        initialConfig[row.productId][vLabel] = {
                            price: row.price.toString(),
                            stock: row.stock.toString(),
                            active: row.active
                        };
                    }
                });
            }

            if (mounted) setConfig(initialConfig);
        };

        loadExistingConfig();

        return () => { mounted = false; };
    }, [products, storeId]);

    const handleChange = (prodId: string, variantLabel: string, field: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            [prodId]: {
                ...prev[prodId],
                [variantLabel]: { ...prev[prodId][variantLabel], [field]: value }
            }
        }));
    };

    const handleSave = async () => {
        if (!storeId) return;

        // 1. Validation: Price > MRP Check
        let priceError = '';
        products.forEach(p => {
            Object.entries(config[p.id] || {}).forEach(([variantLabel, data]: [string, any]) => {
                if (data.active) {
                    // Calculate Variant MRP again to match render logic
                    const variantDefs = getVariantsForCategory(p.category);
                    const def = variantDefs.find(v => v.label === variantLabel);
                    if (def) {
                        const variantMrp = Math.round((p.mrp || 0) * def.ratio);
                        const sellingPrice = parseFloat(data.price || '0');
                        if (sellingPrice > variantMrp) {
                            priceError = `Selling price for ${p.name} (${variantLabel}) cannot exceed MRP ₹${variantMrp}`;
                        }
                    }
                }
            });
        });

        if (priceError) {
            Alert.alert("Invalid Price", priceError);
            return;
        }

        setIsSubmitting(true);

        try {
            // 2. Fetch Existing Items to Handle Upsert
            const productIds = products.map(p => p.id);
            const { data: existingData } = await supabase
                .from('StoreProduct')
                .select('id, productId, variant') // Added variant
                .eq('storeId', storeId)
                .in('productId', productIds);

            // Map using composite key: productId_variant
            const existingIdMap = new Map();
            existingData?.forEach(row => existingIdMap.set(`${row.productId}_${row.variant || 'Standard'}`, row.id));

            const updates: any[] = [];

            products.forEach(p => {
                Object.entries(config[p.id] || {}).forEach(([variantLabel, data]: [string, any]) => {
                    if (data.active) {
                        const compositeKey = `${p.id}_${variantLabel}`;
                        const existingId = existingIdMap.get(compositeKey);

                        updates.push({
                            id: existingId || generateUUID(),
                            storeId,
                            productId: p.id,
                            variant: variantLabel, // Save variant
                            price: parseFloat(data.price || '0'),
                            stock: parseInt(data.stock || '0'),
                            active: true,
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });
                    }
                });
            });

            if (updates.length > 0) {
                // 3. Upsert
                // Modified onConflict to look at storeId,productId,variant due to new constraint
                const { error } = await supabase.from('StoreProduct').upsert(updates, { onConflict: 'storeId, productId, variant' });

                if (error) {
                    Alert.alert('Error', error.message);
                } else {
                    Alert.alert(
                        'Success',
                        'Products saved successfully!',
                        [{ text: 'OK', onPress: onSuccess }]
                    );
                }
            } else {
                onSuccess();
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const cleanName = (name: string) => name.replace(/\s*\([^)]+\)/g, '').trim();

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Configure Products ({products.length})</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* @ts-ignore */}
                <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={80} style={{ flex: 1 }}>
                    {products.map(product => {
                        const variantDefs = getVariantsForCategory(product.category);
                        const productConfig = config[product.id] || {};
                        const displayName = cleanName(product.name);

                        return (
                            <View key={product.id} style={styles.card}>
                                {/* Product Header */}
                                <View style={styles.productHeader}>
                                    <Image source={{ uri: product.image || 'https://placehold.co/100x100' }} style={styles.image} />
                                    <View style={styles.info}>
                                        <Text style={styles.name}>{displayName}</Text>
                                        <Text style={styles.category}>{product.category}</Text>
                                        {/* Global MRP Removed - Contextual MRP used below */}
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                {/* Variants */}
                                <View style={styles.variantsContainer}>
                                    {variantDefs.map((def) => {
                                        const data = productConfig[def.label];
                                        if (!data) return null; // Should not happen

                                        const variantMrp = Math.round((product.mrp || 0) * def.ratio);

                                        return (
                                            <View key={def.label} style={styles.variantBlock}>
                                                {/* Variant Checkbox Row */}
                                                <TouchableOpacity
                                                    style={styles.checkboxRow}
                                                    activeOpacity={0.7}
                                                    onPress={() => handleChange(product.id, def.label, 'active', !data.active)}
                                                >
                                                    <View style={[styles.checkbox, data.active && styles.checkboxActive]}>
                                                        {data.active && <Ionicons name="checkmark" size={14} color="#fff" />}
                                                    </View>
                                                    <Text style={styles.variantName}>
                                                        {def.label} <Text style={styles.inlineMrp}>(MRP: ₹{variantMrp})</Text>
                                                    </Text>
                                                </TouchableOpacity>

                                                {/* Inputs (Only if Active) */}
                                                {data.active && (
                                                    <View style={styles.inputsRow}>
                                                        <View style={styles.inputGroup}>
                                                            <Text style={styles.label}>Your Selling Price</Text>
                                                            <View style={styles.inputWrapper}>
                                                                <Text style={styles.currencyPrefix}>₹</Text>
                                                                <TextInput
                                                                    style={styles.input}
                                                                    value={data.price}
                                                                    keyboardType="numeric"
                                                                    onChangeText={t => handleChange(product.id, def.label, 'price', t)}
                                                                />
                                                            </View>
                                                        </View>

                                                        <View style={styles.inputGroup}>
                                                            <Text style={styles.label}>Initial Stock</Text>
                                                            <View style={styles.inputWrapper}>
                                                                <TextInput
                                                                    style={styles.input}
                                                                    value={data.stock}
                                                                    keyboardType="numeric"
                                                                    onChangeText={t => handleChange(product.id, def.label, 'stock', t)}
                                                                />
                                                            </View>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        );
                    })}
                </KeyboardAwareScrollView>

                {/* Footer */}
                <View style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.saveBtn, isSubmitting && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
                            <Text style={styles.saveText}>Saving...</Text>
                        ) : (
                            <Text style={styles.saveText}>Save Products</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },

    // Header
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
    },
    backButton: { padding: 4 },
    title: { fontSize: 18, fontWeight: '700', color: '#111827' },

    // Content
    scrollContent: { padding: 16, paddingBottom: 100 },

    // Card
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2
    },

    // Product Header
    productHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    image: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F3F4F6' },
    info: { marginLeft: 16, flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
    category: { fontSize: 13, color: '#6B7280', marginBottom: 4 },

    divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 16 },

    // Variants
    variantsContainer: { gap: 16 },
    variantBlock: { flexDirection: 'column' },

    checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: Colors.primary,
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    checkboxActive: { backgroundColor: Colors.primary },
    variantName: { fontSize: 16, fontWeight: '600', color: '#111827' },
    inlineMrp: { fontSize: 14, fontWeight: '400', color: '#6B7280' },

    // Inputs
    inputsRow: { flexDirection: 'row', gap: 12 },
    inputGroup: { flex: 1 },

    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },

    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB', // Grey border
        borderRadius: 12,
        height: 50,
        paddingHorizontal: 12
    },
    currencyPrefix: { fontSize: 16, fontWeight: '600', color: '#111827', marginRight: 4 },
    input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827', height: '100%' },

    // Footer
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingBottom: Platform.OS === 'ios' ? 32 : 16
    },
    saveBtn: {
        backgroundColor: Colors.primary,
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveText: { fontSize: 16, fontWeight: '700', color: '#fff' }
});
