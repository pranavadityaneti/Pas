import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../src/lib/supabase';
import { useInventory } from '../../src/hooks/useInventory';
import ConfigureProductsModal from '../../src/components/ConfigureProductsModal';
import FilterModal, { FilterState } from '../../src/components/FilterModal';
import AddCustomProductModal from '../../src/components/AddCustomProductModal';

export default function CatalogPicker() {
    const router = useRouter();
    const { storeId, refetch: refetchInventory, loading: inventoryLoading } = useInventory();

    const [products, setProducts] = useState<any[]>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    // Multi-Select State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showCustomModal, setShowCustomModal] = useState(false);

    // Filter State
    const [filterVisible, setFilterVisible] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<FilterState | null>(null);
    const [onlyBestSellers, setOnlyBestSellers] = useState(false);

    useEffect(() => {
        fetchGlobalCatalog();
    }, [storeId]);

    const fetchGlobalCatalog = async () => {
        setLoading(true);
        try {
            // Attempt to fetch Global (null) OR Store Specific (storeId)
            let query = supabase
                .from('Product')
                .select('*');

            if (storeId) {
                query = query.or(`createdByStoreId.is.null,createdByStoreId.eq.${storeId}`);
            } else {
                query = query.is('createdByStoreId', null);
            }

            const { data, error } = await query;

            if (error) {
                console.error("Advanced fetch failed (column might be missing), falling back:", error);
                throw error;
            }

            if (data) {
                console.log("Fetched products:", data.length);
                const uniqueMap = new Map();
                data.forEach(p => {
                    const cleanName = p.name.replace(/\s*\([^)]+\)/g, '').trim();
                    if (!uniqueMap.has(cleanName)) {
                        uniqueMap.set(cleanName, { ...p, name: cleanName });
                    }
                });
                setProducts(Array.from(uniqueMap.values()));
            }
        } catch (e) {
            console.warn("Falling back to basic fetch all");
            // Fallback: Fetch EVERYTHING (if the column filter fails)
            // This ensures the screen isn't empty while the notification propagates
            const { data } = await supabase.from('Product').select('*');
            if (data) {
                const uniqueMap = new Map();
                data.forEach(p => {
                    const cleanName = p.name.replace(/\s*\([^)]+\)/g, '').trim();
                    if (!uniqueMap.has(cleanName)) {
                        uniqueMap.set(cleanName, { ...p, name: cleanName });
                    }
                });
                setProducts(Array.from(uniqueMap.values()));
            }
        } finally {
            setLoading(false);
        }
    };

    const toggleSelection = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleAddSelected = () => {
        if (inventoryLoading) {
            alert("Please wait, setting up your store...");
            return;
        }
        if (!storeId) {
            alert("No Active Store found! Please try restarting the app or contact support.");
            return;
        }
        setShowConfigModal(true);
    };

    const handleSuccess = () => {
        setShowConfigModal(false);
        setSelectedIds([]);
        refetchInventory();
        router.push('/(main)/inventory');
    };

    const handleCustomSuccess = () => {
        setShowCustomModal(false);
        fetchGlobalCatalog(); // Refresh list to see new item
        refetchInventory(); // Also refresh inventory
        // router.push('/(main)/inventory'); // Optional: redirect immediate
        Alert.alert("Success", "Product Created", [
            { text: "Go to Inventory", onPress: () => router.push('/(main)/inventory') },
            { text: "Add More", onPress: () => { } }
        ]);
    };

    // Filter Logic
    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());

        let matchesFilter = true;

        if (onlyBestSellers) {
            // Simulate best sellers by category or rating if not in DB
            if (p.category !== 'Electronics' && p.category !== 'Dairy') matchesFilter = false;
        }

        if (appliedFilters) {
            if (appliedFilters.categories.length > 0 && !appliedFilters.categories.includes(p.category)) matchesFilter = false;
            if (appliedFilters.brands.length > 0 && !appliedFilters.brands.includes(p.brand)) matchesFilter = false;
            if (p.mrp < appliedFilters.priceRange[0] || p.mrp > appliedFilters.priceRange[1]) matchesFilter = false;
        }

        return matchesSearch && matchesFilter;
    }).sort((a, b) => {
        if (!appliedFilters?.sortBy) return 0;

        switch (appliedFilters.sortBy) {
            case 'price_low': return a.mrp - b.mrp;
            case 'price_high': return b.mrp - a.mrp;
            case 'name_asc': return a.name.localeCompare(b.name);
            case 'newest': return 0;
            default: return 0;
        }
    });

    const renderItem = ({ item }: { item: any }) => {
        const isSelected = selectedIds.includes(item.id);
        const isDark = isSelected;
        // Highlight custom products
        const isCustom = item.createdByStoreId === storeId;

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => toggleSelection(item.id)}
                style={[styles.card, isDark && styles.cardDark, isCustom && styles.cardCustom]}
            >
                {/* Checkbox */}
                <View style={[styles.checkbox, isDark && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#000" />}
                </View>

                {/* Image */}
                <Image source={{ uri: item.image || 'https://placehold.co/100x100' }} style={styles.image} />

                {/* Content */}
                <View style={styles.info}>
                    <View style={styles.rowBetween}>
                        <Text
                            style={[styles.name, isDark && styles.textWhite]}
                            numberOfLines={2}
                        >
                            {item.name}
                        </Text>
                        {isCustom && (
                            <View style={styles.customBadge}>
                                <Text style={styles.customText}>MY PRODUCT</Text>
                            </View>
                        )}
                        {!isCustom && (
                            <View style={[styles.ratingBadge, isDark && { backgroundColor: '#fff' }]}>
                                <Ionicons name="star" size={10} color={isDark ? "#000" : "#fff"} />
                                <Text style={[styles.ratingText, isDark && { color: '#000' }]}>4.5</Text>
                            </View>
                        )}
                    </View>

                    <Text style={[styles.details, isDark && { color: '#aaa' }]}>{item.category}</Text>

                    <View style={styles.rowBetween}>
                        <Text style={[styles.price, isDark && styles.textWhite]}>
                            MRP: <Text style={{ fontWeight: 'bold' }}>₹{item.mrp}</Text>
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.push('/(main)/inventory')} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.title}>Global Inventory</Text>
                <TouchableOpacity onPress={() => setShowCustomModal(true)}>
                    <Ionicons name="add-circle" size={28} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.searchRow}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search or add custom..."
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
            </View>

            {/* Filters Row */}
            <View style={styles.filterRow}>
                <TouchableOpacity
                    style={[styles.filterChip, filterVisible && { borderColor: Colors.primary, backgroundColor: '#FEF2F2' }]}
                    onPress={() => setFilterVisible(true)}
                >
                    <Ionicons name="filter" size={16} color={filterVisible ? Colors.primary : "#000"} />
                    <Text style={[styles.chipText, filterVisible && { color: Colors.primary }]}>Filter</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.filterChip, onlyBestSellers && { borderColor: Colors.primary, backgroundColor: '#FEF2F2' }]}
                    onPress={() => setOnlyBestSellers(!onlyBestSellers)}
                >
                    <Ionicons name="star" size={16} color={onlyBestSellers ? Colors.primary : "#000"} />
                    <Text style={[styles.chipText, onlyBestSellers && { color: Colors.primary }]}>Best Sellers</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.filterChip, { borderColor: Colors.primary, backgroundColor: '#fff' }]} onPress={() => setShowCustomModal(true)}>
                    <Ionicons name="add" size={16} color={Colors.primary} />
                    <Text style={[styles.chipText, { color: Colors.primary }]}>Add Custom</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={filteredProducts}
                renderItem={renderItem}
                keyExtractor={i => i.id}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No products found.</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCustomModal(true)}>
                                <Text style={styles.emptyBtnText}>+ Add "{search}" as Custom Product</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null
                }
            />

            {/* Footer Action */}
            {selectedIds.length > 0 && (
                <View style={styles.footer}>
                    <TouchableOpacity style={[styles.mainAddBtn, { backgroundColor: Colors.primary }]} onPress={handleAddSelected}>
                        <Text style={styles.mainAddText}>Add Selected ({selectedIds.length})</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Config Modal */}
            <ConfigureProductsModal
                visible={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                onSuccess={handleSuccess}
                storeId={storeId!}
                products={products.filter(p => selectedIds.includes(p.id))}
            />

            {/* Custom Product Modal */}
            <AddCustomProductModal
                visible={showCustomModal}
                onClose={() => setShowCustomModal(false)}
                onSuccess={handleCustomSuccess}
                storeId={storeId!}
                initialName={search}
            />

            {/* Filter Modal */}
            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={setAppliedFilters}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
    title: { fontSize: 22, fontWeight: 'bold' },
    backBtn: { padding: 5 },

    searchRow: { paddingHorizontal: 20, marginBottom: 15 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 12, height: 50, borderWidth: 1, borderColor: '#eee' },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16 },

    filterRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 15, gap: 10 },
    filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#eee', gap: 6 },
    chipText: { fontSize: 13, fontWeight: '600' },

    list: { paddingHorizontal: 20, paddingBottom: 100 },

    // Card Design
    card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f0f0f0' },
    cardDark: { backgroundColor: '#111827', borderColor: '#111827' }, // Dark background for selected

    checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', marginRight: 12, justifyContent: 'center', alignItems: 'center' },
    checkboxSelected: { backgroundColor: '#fff', borderColor: '#fff' },

    image: { width: 60, height: 60, borderRadius: 10, backgroundColor: '#f5f5f5' },
    info: { flex: 1, marginLeft: 12 },

    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },

    name: { fontSize: 16, fontWeight: 'bold', color: '#000', marginBottom: 4, flex: 1, marginRight: 8 },
    textWhite: { color: '#fff' },

    details: { fontSize: 12, color: '#666', marginBottom: 6 },

    price: { fontSize: 13, color: '#000' },

    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, gap: 2 },
    ratingText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    bestsellerTag: { backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    bestsellerText: { fontSize: 10, fontWeight: 'bold', color: '#000' },

    // Footer
    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee' },
    mainAddBtn: { backgroundColor: '#000', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    mainAddText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    // Empty State
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 50, padding: 20 },
    emptyText: { fontSize: 16, color: '#666', marginBottom: 16 },
    emptyBtn: { backgroundColor: '#000', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 25 },
    emptyBtnText: { color: '#fff', fontWeight: 'bold' },

    // Custom Card Styles
    cardCustom: { borderColor: Colors.primary, borderWidth: 1.5 },
    customBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    customText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

});
