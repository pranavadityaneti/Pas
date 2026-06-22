import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Image, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { configureStoreProducts, CatalogProduct } from '../services/catalog';
import { Colors } from '../../constants/Colors';
import { useStore } from '../hooks/useStore';

const { height } = Dimensions.get('window');

interface ConfigureProductsModalProps {
    visible: boolean;
    storeId: string; // branchId — passed as `storeId` by the picker
    products: CatalogProduct[];
    onClose: () => void;
    onSuccess: () => void;
}

interface RowConfig {
    price: string;
    stock: string;
}

export default function ConfigureProductsModal({ visible, storeId, products, onClose, onSuccess }: ConfigureProductsModalProps) {
    const router = useRouter();
    const { hasRealBranch } = useStore();
    const insets = useSafeAreaInsets();

    // One row of inputs per product.
    const [config, setConfig] = useState<Record<string, RowConfig>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Server-side guards surfaced reactively after a Save attempt.
    const [fssaiBlocked, setFssaiBlocked] = useState(false);
    const [mrpOffenders, setMrpOffenders] = useState<Set<string>>(new Set());

    // Whether any selected product belongs to an FSSAI-gated vertical.
    const hasFood = products.some(p => p.vertical?.requiresFssai);

    // Initialise a blank input row for each product when the selection changes.
    useEffect(() => {
        setConfig(prev => {
            const next: Record<string, RowConfig> = {};
            products.forEach(p => {
                next[p.id] = prev[p.id] || { price: '', stock: '' };
            });
            return next;
        });
        // Clear stale server-error state when the selection changes.
        setFssaiBlocked(false);
        setMrpOffenders(new Set());
    }, [products]);

    const handleChange = (productId: string, field: keyof RowConfig, value: string) => {
        setConfig(prev => ({
            ...prev,
            [productId]: { ...(prev[productId] || { price: '', stock: '' }), [field]: value },
        }));
        // Editing an offender clears its highlight.
        if (field === 'price' && mrpOffenders.has(productId)) {
            setMrpOffenders(prev => {
                const next = new Set(prev);
                next.delete(productId);
                return next;
            });
        }
    };

    // Client-side validation mirroring the server contract.
    // price: required, number, > 0, <= mrp. stock: required, integer >= 0.
    const priceError = (p: CatalogProduct): string | null => {
        const raw = config[p.id]?.price ?? '';
        if (raw.trim() === '') return 'Required';
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) return 'Enter a valid price';
        if (n > p.mrp) return `Max ₹${p.mrp}`;
        return null;
    };

    const stockError = (p: CatalogProduct): string | null => {
        const raw = config[p.id]?.stock ?? '';
        if (raw.trim() === '') return 'Required';
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) return 'Whole number ≥ 0';
        return null;
    };

    const anyInvalid = products.some(p => priceError(p) !== null || stockError(p) !== null);
    const canSave = products.length > 0 && !anyInvalid && !isSubmitting;

    const handleSave = async () => {
        if (!storeId) {
            Alert.alert('Error', 'No active store or branch selected. Please try switching stores.');
            return;
        }
        // Layer 3 defense (May 20, 2026): refuse to write StoreProduct rows when
        // no real merchant_branches row exists — otherwise the FK
        // fk_storeproduct_branch violates and the user sees a raw DB error.
        if (!hasRealBranch) {
            Alert.alert(
                'Set up your branch first',
                'You need to add at least one branch before adding products. Go to Settings → Branches → Add Branch.',
            );
            return;
        }
        if (anyInvalid) return;

        setIsSubmitting(true);
        setFssaiBlocked(false);
        setMrpOffenders(new Set());

        const items = products.map(p => ({
            productId: p.id,
            price: Number(config[p.id]?.price ?? '0'),
            stock: Number(config[p.id]?.stock ?? '0'),
        }));

        try {
            await configureStoreProducts(storeId, items);
            onSuccess();
        } catch (err: any) {
            // surface() throws an Error whose message is the API error code.
            const code = err?.message;
            if (code === 'FSSAI_REQUIRED') {
                // Keep the modal open + show the banner.
                setFssaiBlocked(true);
            } else if (code === 'MRP_CEILING_VIOLATED') {
                // Mark every row whose price still exceeds MRP.
                const offenders = new Set<string>();
                products.forEach(p => {
                    const n = Number(config[p.id]?.price ?? '0');
                    if (Number.isFinite(n) && n > p.mrp) offenders.add(p.id);
                });
                setMrpOffenders(offenders);
                Alert.alert('Price too high', 'Some prices exceed the product MRP. Please fix the highlighted rows.');
            } else {
                Alert.alert('Error', code || 'An unexpected error occurred.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

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

                {/* FSSAI banner — shown only after a 403 FSSAI_REQUIRED */}
                {hasFood && fssaiBlocked && (
                    <View style={styles.fssaiBanner}>
                        <Ionicons name="warning" size={20} color="#92400E" style={{ marginRight: 8 }} />
                        <Text style={styles.fssaiText}>Add an FSSAI licence to list food products</Text>
                        <TouchableOpacity
                            style={styles.fssaiBtn}
                            onPress={() => { onClose(); router.push('/(main)/settings'); }}
                        >
                            <Text style={styles.fssaiBtnText}>Go to Settings</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* @ts-ignore */}
                <KeyboardAwareScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" enableOnAndroid={true} extraScrollHeight={80} style={{ flex: 1 }}>
                    {products.map(product => {
                        const pErr = priceError(product);
                        const sErr = stockError(product);
                        const isOffender = mrpOffenders.has(product.id);
                        const metaLine = [product.brand, product.uom, `MRP ₹${product.mrp}`].filter(Boolean).join(' · ');

                        return (
                            <View key={product.id} style={[styles.card, isOffender && styles.cardOffender]}>
                                {/* Product Header */}
                                <View style={styles.productHeader}>
                                    <Image source={{ uri: product.image || 'https://placehold.co/100x100' }} style={styles.image} />
                                    <View style={styles.info}>
                                        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
                                        <Text style={styles.meta} numberOfLines={1}>{metaLine}</Text>
                                    </View>
                                </View>

                                <View style={styles.divider} />

                                {/* Inputs */}
                                <View style={styles.inputsRow}>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Your price</Text>
                                        <View style={[styles.inputWrapper, (pErr || isOffender) && styles.inputWrapperError]}>
                                            <Text style={styles.currencyPrefix}>₹</Text>
                                            <TextInput
                                                style={styles.input}
                                                value={config[product.id]?.price ?? ''}
                                                placeholder="Your price"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                                onChangeText={t => handleChange(product.id, 'price', t)}
                                            />
                                        </View>
                                        {(pErr || isOffender) && (
                                            <Text style={styles.helperError}>{pErr || `Max ₹${product.mrp}`}</Text>
                                        )}
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Stock</Text>
                                        <View style={[styles.inputWrapper, sErr && styles.inputWrapperError]}>
                                            <TextInput
                                                style={styles.input}
                                                value={config[product.id]?.stock ?? ''}
                                                placeholder="0"
                                                placeholderTextColor="#9CA3AF"
                                                keyboardType="numeric"
                                                onChangeText={t => handleChange(product.id, 'stock', t)}
                                            />
                                        </View>
                                        {sErr && <Text style={styles.helperError}>{sErr}</Text>}
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </KeyboardAwareScrollView>

                {/* Footer */}
                <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom + 8) }]}>
                    <TouchableOpacity
                        style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                        onPress={handleSave}
                        disabled={!canSave}
                    >
                        <Text style={styles.saveText}>{isSubmitting ? 'Saving...' : 'Save Products'}</Text>
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

    // FSSAI banner
    fssaiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF3C7',
        borderBottomWidth: 1,
        borderBottomColor: '#FDE68A',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    fssaiText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E' },
    fssaiBtn: { backgroundColor: '#92400E', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginLeft: 8 },
    fssaiBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

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
    cardOffender: { borderWidth: 1.5, borderColor: '#DC2626' },

    // Product Header
    productHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    image: { width: 60, height: 60, borderRadius: 12, backgroundColor: '#F3F4F6' },
    info: { marginLeft: 16, flex: 1 },
    name: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
    meta: { fontSize: 13, color: '#6B7280' },

    divider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 16 },

    // Inputs
    inputsRow: { flexDirection: 'row', gap: 12 },
    inputGroup: { flex: 1 },

    label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },

    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        height: 50,
        paddingHorizontal: 12
    },
    inputWrapperError: { borderColor: '#DC2626' },
    currencyPrefix: { fontSize: 16, fontWeight: '600', color: '#111827', marginRight: 4 },
    input: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111827', height: '100%' },
    helperError: { fontSize: 12, color: '#DC2626', marginTop: 6, fontWeight: '600' },

    // Footer
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
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
