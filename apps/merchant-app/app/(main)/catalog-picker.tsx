// @lock — DO NOT EDIT THE FilterModal INVOCATION OR DEFAULT_FILTERS WITHOUT EXPLICIT USER PERMISSION.
// FilterModal Pass 3 approved May 19, 2026.
// `DEFAULT_FILTERS` MUST stay in sync with `FilterState` in `src/components/FilterModal.tsx`
// (must include menuSections, dietaryTags, spiceLevels) or TypeScript will break.
// The `isGlobalInventory` + `verticalPills` props on FilterModal are the reason this catalog
// flow renders the vertical-UUID category pills (instead of the per-store name-string options).
// Edits to other parts of this screen are fine.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../src/lib/supabase';
import { useInventory } from '../../src/hooks/useInventory';
import { useCatalogPicker } from '../../src/hooks/useCatalogPicker';
import { CatalogProduct } from '../../src/services/catalog';
import ConfigureProductsModal from '../../src/components/ConfigureProductsModal';
import FilterModal, { FilterState } from '../../src/components/FilterModal';
import AddCustomProductModal from '../../src/components/AddCustomProductModal';
import AddMenuProductModal from '../../src/components/AddMenuProductModal';
import { useStore } from '../../src/context/StoreContext';

const DEFAULT_FILTERS: FilterState = {
    sortBy: 'price_low',
    categories: [],
    availability: [],
    priceRange: [0, 10000],
    brands: [],
    onlyDiscounted: false,
    showInactive: false,
    isBestSeller: false,
    menuSections: [],
    dietaryTags: [],
    spiceLevels: [],
};

export default function CatalogPicker() {
    const router = useRouter();
    const { branchId, refetch: refetchInventory, loading: inventoryLoading } = useInventory();
    const { store } = useStore();

    const [search, setSearch] = useState('');

    // Server-paginated master catalog (keyset cursor + server-side filters).
    const { rows, hasMore, isLoading, setFilters, loadMore, reload } = useCatalogPicker(branchId);
    const loading = isLoading;
    // Locked <FilterModal> below reads `products` (for its Brand-tab cascade);
    // feed it the current catalog page. FilterModal is shape-tolerant.
    const products = rows;

    // Multi-Select State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Modal State
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showCustomModal, setShowCustomModal] = useState(false);

    // Filter State
    const [filterVisible, setFilterVisible] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<FilterState | null>(null);

    // Vertical pills fetched from master Vertical table
    const [verticalPills, setVerticalPills] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        supabase.from('Vertical').select('id, name').order('name').then(({ data, error }) => {
            if (error) console.error('Failed to fetch verticals:', error);
            if (data) setVerticalPills(data);
        });
    }, []);

    // Debounced search → server query (≥2 chars per API; <2 chars clears `q`).
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
        return () => clearTimeout(t);
    }, [search]);

    // Translate the UI filter state (appliedFilters + category pills) into
    // server-side query params, and push them to the hook. Runs whenever the
    // applied filters or the debounced search change.
    useEffect(() => {
        const q = debouncedSearch.length >= 2 ? debouncedSearch : undefined;
        const verticalId = appliedFilters && appliedFilters.categories.length > 0
            ? appliedFilters.categories.join(',')
            : undefined;
        const brand = appliedFilters && appliedFilters.brands.length > 0
            ? appliedFilters.brands.join(',')
            : undefined;
        const minPrice = appliedFilters ? appliedFilters.priceRange[0] : undefined;
        const maxPrice = appliedFilters ? appliedFilters.priceRange[1] : undefined;

        setFilters({ q, verticalId, brand, minPrice, maxPrice });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, appliedFilters]);

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
        if (!branchId) {
            alert("No Active Store found! Please try restarting the app or contact support.");
            return;
        }
        setShowConfigModal(true);
    };

    const handleSuccess = () => {
        setShowConfigModal(false);
        setSelectedIds([]);
        refetchInventory();
        reload(); // drop the just-listed items off the picker
        router.push('/(main)/inventory');
    };

    const handleCustomSuccess = () => {
        setShowCustomModal(false);
        reload(); // Refresh list to see new item
        refetchInventory(); // Also refresh inventory
        // router.push('/(main)/inventory'); // Optional: redirect immediate
        Alert.alert("Success", "Product Created", [
            { text: "Go to Inventory", onPress: () => router.push('/(main)/inventory') },
            { text: "Add More", onPress: () => { } }
        ]);
    };

    const renderItem = ({ item }: { item: CatalogProduct }) => {
        const isSelected = selectedIds.includes(item.id);
        const isDark = isSelected;
        const metaLine = [item.brand, item.uom].filter(Boolean).join(' · ');

        return (
            <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => toggleSelection(item.id)}
                style={[styles.card, isDark && styles.cardDark]}
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
                        {item.isVeg !== null && (
                            <View style={[styles.vegDot, item.isVeg ? styles.vegDotVeg : styles.vegDotNonVeg]} />
                        )}
                    </View>

                    {metaLine ? (
                        <Text style={[styles.details, isDark && { color: '#aaa' }]} numberOfLines={1}>{metaLine}</Text>
                    ) : null}

                    {item.category?.name ? (
                        <Text style={[styles.details, isDark && { color: '#aaa' }]} numberOfLines={1}>{item.category.name}</Text>
                    ) : null}

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

                <TouchableOpacity style={[styles.filterChip, { borderColor: Colors.primary, backgroundColor: '#fff' }]} onPress={() => setShowCustomModal(true)}>
                    <Ionicons name="add" size={16} color={Colors.primary} />
                    <Text style={[styles.chipText, { color: Colors.primary }]}>Add Custom</Text>
                </TouchableOpacity>
            </View>

            {/* Categories Scroll */}
            <View>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    contentContainerStyle={styles.categoryScroll}
                >
                    {/* "All" pill */}
                    <TouchableOpacity
                        style={[styles.catChip, (!appliedFilters || appliedFilters.categories.length === 0) && styles.catChipActive]}
                        onPress={() => setAppliedFilters(prev => prev ? { ...prev, categories: [] } : null)}
                    >
                        <Text style={[styles.catChipText, (!appliedFilters || appliedFilters.categories.length === 0) && styles.catChipTextActive]}>
                            All
                        </Text>
                    </TouchableOpacity>

                    {verticalPills.map(v => {
                        const isSelected = appliedFilters?.categories.includes(v.id) ?? false;
                        return (
                            <TouchableOpacity
                                key={v.id}
                                style={[styles.catChip, isSelected && styles.catChipActive]}
                                onPress={() => {
                                    setAppliedFilters(prev => {
                                        const currentCats = prev?.categories || [];
                                        const nextCats = currentCats.includes(v.id)
                                            ? currentCats.filter(c => c !== v.id)
                                            : [...currentCats, v.id];
                                        return { ...(prev || DEFAULT_FILTERS), categories: nextCats };
                                    });
                                }}
                            >
                                <Text style={[styles.catChipText, isSelected && styles.catChipTextActive]}>
                                    {v.name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <FlatList
                data={rows}
                renderItem={renderItem}
                keyExtractor={i => i.id}
                contentContainerStyle={styles.list}
                onEndReached={loadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={
                    isLoading && rows.length > 0 ? (
                        <View style={styles.footerLoader}>
                            <ActivityIndicator size="small" color={Colors.primary} />
                        </View>
                    ) : null
                }
                ListEmptyComponent={
                    !loading ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No products found.</Text>
                            <TouchableOpacity style={styles.emptyBtn} onPress={() => setShowCustomModal(true)}>
                                <Text style={styles.emptyBtnText}>
                                    {search.trim() ? `+ Add "${search}" as Custom Product` : "+ Add Custom Product"}
                                </Text>
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
                storeId={branchId!}
                products={rows.filter(p => selectedIds.includes(p.id))}
            />

            {/* Custom Product Modal */}
            {store?.isDining ? (
                <AddMenuProductModal
                    visible={showCustomModal}
                    onClose={() => setShowCustomModal(false)}
                    onSuccess={handleCustomSuccess}
                    storeId={branchId!}
                    initialName={search}
                />
            ) : (
                <AddCustomProductModal
                    visible={showCustomModal}
                    onClose={() => setShowCustomModal(false)}
                    onSuccess={handleCustomSuccess}
                    storeId={branchId!}
                    initialName={search}
                    verticalPills={verticalPills}
                />
            )}

            {/* Filter Modal */}
            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={setAppliedFilters}
                isGlobalInventory={true}
                initialFilters={appliedFilters || undefined}
                verticalPills={verticalPills}
                products={products}
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

    categoryScroll: { paddingHorizontal: 20, paddingBottom: 15, gap: 8 },
    catChip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eee' },
    catChipActive: { backgroundColor: '#000', borderColor: '#000' },
    catChipText: { fontSize: 13, fontWeight: '500', color: '#666' },
    catChipTextActive: { color: '#fff', fontWeight: 'bold' },

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

    // Veg / Non-veg indicator dot
    vegDot: { width: 12, height: 12, borderRadius: 3, marginTop: 4 },
    vegDotVeg: { backgroundColor: '#16A34A' },
    vegDotNonVeg: { backgroundColor: '#92400E' },

    // Pagination footer spinner
    footerLoader: { paddingVertical: 16, alignItems: 'center' },

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
