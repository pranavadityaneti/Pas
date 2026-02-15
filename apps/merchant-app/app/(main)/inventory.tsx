import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import LottieView from 'lottie-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const Lottie = LottieView as any;
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useInventory } from '../../src/hooks/useInventory';
import InventoryCard from '../../src/components/InventoryCard';
import FilterModal, { FilterState } from '../../src/components/FilterModal';
import { Colors } from '../../constants/Colors';

const DEFAULT_FILTERS: FilterState = {
    sortBy: 'price_low',
    categories: [],
    availability: [],
    priceRange: [0, 10000],
    brands: [],
    onlyDiscounted: false,
    showInactive: false,
    isBestSeller: false,
};

export default function InventoryScreen() {
    const router = useRouter();
    const { inventory, loading, refreshing, refetch, updateItem, deleteItem, toggleStatus } = useInventory();

    // Refetch on Focus
    useFocusEffect(
        useCallback(() => {
            refetch();
        }, [])
    );
    const [search, setSearch] = useState('');
    const [filterVisible, setFilterVisible] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<FilterState | null>(null);
    const [filterTab, setFilterTab] = useState('sort');

    // Initial Loading State
    if (loading && !refreshing) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    // Filter Logic (Client Side)
    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.product.name.toLowerCase().includes(search.toLowerCase());

        // Apply Advanced Filters
        let matchesFilter = true;
        if (appliedFilters) {
            if (appliedFilters.categories.length > 0 && !appliedFilters.categories.includes(item.product.category)) matchesFilter = false;

            // Availability
            if (appliedFilters.availability.includes('Low Stock') && item.stock >= 5) matchesFilter = false;
            if (appliedFilters.availability.includes('Out of Stock') && item.stock > 0) matchesFilter = false;
            if (appliedFilters.availability.includes('In Stock') && item.stock === 0) matchesFilter = false;

            // Brand (if applicable)
            if (appliedFilters.brands.length > 0 && !appliedFilters.brands.includes(item.product.brand || '')) matchesFilter = false;

            // Price Range
            if (item.price < appliedFilters.priceRange[0] || item.price > appliedFilters.priceRange[1]) matchesFilter = false;

            // Discount
            if (appliedFilters.onlyDiscounted && item.price >= item.product.mrp) matchesFilter = false;

            // Inactive
            if (!appliedFilters.showInactive && !item.active) matchesFilter = false;

            // Best Seller (Real field check)
            if (appliedFilters.isBestSeller && !item.is_best_seller) matchesFilter = false;
        } else {
            // Default: Hide Inactive
            if (!item.active) matchesFilter = false;
        }

        return matchesSearch && matchesFilter;
    });

    // Sorting
    const sortedInventory = [...filteredInventory].sort((a, b) => {
        if (!appliedFilters) return 0;
        switch (appliedFilters.sortBy) {
            case 'price_low': return a.price - b.price;
            case 'price_high': return b.price - a.price;
            case 'name_asc': return a.product.name.localeCompare(b.product.name);
            case 'newest': return 0; // Need createdAt in hook to sort
            default: return 0;
        }
    });

    // Empty State (If NO items at all in the DB, not just search results)
    const isInventoryEmpty = inventory.length === 0;

    if (!loading && isInventoryEmpty) {
        return (
            <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
                <View style={[styles.header, { borderBottomWidth: 0 }]}>
                    <Text style={styles.title}>Inventory</Text>
                    <View style={styles.storeBadge}>
                        <Text style={styles.storeText}>Active Store</Text>
                    </View>
                </View>

                <View style={styles.emptyContainer}>
                    <Lottie
                        source={{ uri: 'https://assets5.lottiefiles.com/packages/lf20_t9gkkhz4.json' }}
                        autoPlay
                        loop
                        style={styles.illustration}
                    />
                    <Text style={styles.emptyTitle}>Your inventory is empty</Text>
                    <Text style={styles.emptyDesc}>Add items from the Master Catalog to start selling.</Text>

                    <TouchableOpacity style={styles.bigAddBtn} onPress={() => router.push('/(main)/catalog-picker')}>
                        <Text style={styles.bigAddText}>Start Adding Products</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Inventory</Text>
                <View style={styles.stats}>
                    <Text style={styles.totalLabel}>Total Items</Text>
                    <Text style={styles.totalValue}>{inventory.length}</Text>
                </View>
            </View>

            {/* Sticky Search & Filter */}
            <View style={styles.controls}>
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search products..."
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>

                {/* Horizontal Filter Chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.chip, !appliedFilters && styles.activeChip]}
                        onPress={() => setAppliedFilters(null)}
                    >
                        <Text style={[styles.chipText, !appliedFilters && { color: '#fff' }]}>All Items</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.chip} onPress={() => setFilterVisible(true)}>
                        <Ionicons name="options-outline" size={16} color="#000" />
                        <Text style={styles.chipText}>Filters</Text>
                        {appliedFilters && (
                            <View style={styles.filterDot} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, appliedFilters?.sortBy !== 'price_low' && styles.activeChip]}
                        onPress={() => {
                            setFilterTab('sort');
                            setFilterVisible(true);
                        }}
                    >
                        <MaterialCommunityIcons name="sort-descending" size={16} color={appliedFilters?.sortBy !== 'price_low' ? "#fff" : "#000"} />
                        <Text style={[styles.chipText, appliedFilters?.sortBy !== 'price_low' && { color: '#fff' }]}>Sort</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, appliedFilters?.availability.includes('Out of Stock') && styles.activeChip]}
                        onPress={() => {
                            const current = appliedFilters?.availability || [];
                            const next = current.includes('Out of Stock')
                                ? current.filter(i => i !== 'Out of Stock')
                                : [...current, 'Out of Stock'];
                            setAppliedFilters(prev => ({
                                ...(prev || DEFAULT_FILTERS),
                                availability: next
                            }));
                        }}
                    >
                        <MaterialCommunityIcons name="package-variant-remove" size={16} color={appliedFilters?.availability.includes('Out of Stock') ? "#fff" : "#000"} />
                        <Text style={[styles.chipText, appliedFilters?.availability.includes('Out of Stock') && { color: '#fff' }]}>Out of Stock</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, appliedFilters?.availability.includes('Low Stock') && styles.activeChip]}
                        onPress={() => {
                            const current = appliedFilters?.availability || [];
                            const next = current.includes('Low Stock')
                                ? current.filter(i => i !== 'Low Stock')
                                : [...current, 'Low Stock'];
                            setAppliedFilters(prev => ({
                                ...(prev || DEFAULT_FILTERS),
                                availability: next
                            }));
                        }}
                    >
                        <MaterialCommunityIcons name="alert-outline" size={16} color={appliedFilters?.availability.includes('Low Stock') ? "#fff" : "#000"} />
                        <Text style={[styles.chipText, appliedFilters?.availability.includes('Low Stock') && { color: '#fff' }]}>Low Stock</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, appliedFilters?.isBestSeller && styles.activeChip]}
                        onPress={() => {
                            setAppliedFilters(prev => ({
                                ...(prev || DEFAULT_FILTERS),
                                isBestSeller: !prev?.isBestSeller
                            }));
                        }}
                    >
                        <MaterialCommunityIcons name="star-outline" size={16} color={appliedFilters?.isBestSeller ? "#fff" : "#000"} />
                        <Text style={[styles.chipText, appliedFilters?.isBestSeller && { color: '#fff' }]}>Best Sellers</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.chip, appliedFilters?.showInactive && styles.activeChip]}
                        onPress={() => {
                            setAppliedFilters(prev => ({
                                ...(prev || DEFAULT_FILTERS),
                                showInactive: !prev?.showInactive
                            }));
                        }}
                    >
                        <MaterialCommunityIcons name="eye-off-outline" size={16} color={appliedFilters?.showInactive ? "#fff" : "#000"} />
                        <Text style={[styles.chipText, appliedFilters?.showInactive && { color: '#fff' }]}>Inactive</Text>
                    </TouchableOpacity>
                </ScrollView>
            </View>

            {/* Add Button */}
            <TouchableOpacity style={styles.mainAddBtn} onPress={() => router.push('/(main)/catalog-picker')}>
                <Ionicons name="add" size={24} color="#fff" />
                <Text style={styles.mainAddText}>Add Products to Inventory</Text>
            </TouchableOpacity>

            <FlatList
                data={sortedInventory}
                renderItem={({ item }) => (
                    <InventoryCard
                        item={item}
                        onUpdate={updateItem}
                        onDelete={deleteItem}
                        onToggleStatus={toggleStatus}
                    />
                )}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshing={refreshing}
                onRefresh={refetch}
                ListHeaderComponent={<View style={{ height: 10 }} />}
                ListEmptyComponent={
                    <View style={styles.listEmpty}>
                        <Text style={{ color: '#666' }}>No items found matching your search.</Text>
                    </View>
                }
            />

            <FilterModal
                visible={filterVisible}
                onClose={() => setFilterVisible(false)}
                onApply={setAppliedFilters}
                initialFilters={appliedFilters || undefined}
                initialTab={filterTab}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8f9fa' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
    title: { fontSize: 28, fontWeight: 'bold', color: '#000' },
    stats: { alignItems: 'flex-end' },
    totalLabel: { fontSize: 12, color: '#666' },
    totalValue: { fontSize: 16, fontWeight: 'bold', color: '#000' },
    storeBadge: { backgroundColor: '#f0f0f0', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
    storeText: { fontSize: 12, fontWeight: '600', color: '#000' },

    controls: { paddingHorizontal: 20, paddingTop: 10 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 15, borderRadius: 10, height: 50, borderWidth: 1, borderColor: '#eee', marginBottom: 15 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, fontSize: 16, color: '#000' },

    filterRow: { paddingBottom: 10, gap: 10 },
    chip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#ddd', marginRight: 8, gap: 6 },
    activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    chipText: { fontSize: 13, fontWeight: '600', color: '#333' },
    filterDot: { position: 'absolute', top: -4, right: -4, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, borderWidth: 2, borderColor: '#fff' },

    mainAddBtn: { flexDirection: 'row', backgroundColor: Colors.primary, marginHorizontal: 20, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginVertical: 10, shadowColor: Colors.primary, shadowOpacity: 0.3, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    mainAddText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },

    list: { paddingHorizontal: 20, paddingBottom: 40 },
    listEmpty: { alignItems: 'center', padding: 40 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    illustration: { width: 200, height: 200, marginBottom: 20, opacity: 0.5 },
    emptyTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 10, textAlign: 'center', color: '#000' },
    emptyDesc: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 30 },
    bigAddBtn: { backgroundColor: Colors.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30 },
    bigAddText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
