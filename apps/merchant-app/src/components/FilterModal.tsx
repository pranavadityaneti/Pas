import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions, Pressable, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';


const { height } = Dimensions.get('window');

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    initialFilters?: FilterState;
    initialTab?: string;
    isGlobalInventory?: boolean;
    verticalPills?: { id: string; name: string }[];
    products?: any[];
}



export interface FilterState {
    sortBy: string;
    categories: string[];
    availability: string[];
    priceRange: [number, number];
    brands: string[];
    onlyDiscounted: boolean;
    showInactive: boolean;
    isBestSeller: boolean;
}

const SIDEBAR_ITEMS = [
    { id: 'sort', label: 'Sort By' },
    { id: 'price', label: 'Price Range' },
    { id: 'category', label: 'Category' },
    { id: 'brand', label: 'Brand' },
    { id: 'availability', label: 'Availability' },
    { id: 'discount', label: 'Discounts' }
];

export default function FilterModal({ visible, onClose, onApply, initialFilters, initialTab = 'sort', isGlobalInventory = false, verticalPills = [], products = [] }: FilterModalProps) {
    const [selectedTab, setSelectedTab] = useState(initialTab);

    useEffect(() => {
        if (visible && initialTab) {
            setSelectedTab(initialTab);
        }
    }, [visible, initialTab]);
    const [filters, setFilters] = useState<FilterState>({
        sortBy: 'price_low',
        categories: [],
        availability: [],
        priceRange: [0, 10000],
        brands: [],
        onlyDiscounted: false,
        showInactive: false,
        isBestSeller: false,
    });

    useEffect(() => {
        if (initialFilters) setFilters(initialFilters);
    }, [initialFilters, visible]);

    // Cascading brands: derive from products filtered by selected categories
    const cascadedBrands = useMemo(() => {
        if (!products || products.length === 0) return [];
        const pool = filters.categories.length > 0
            ? products.filter(p => filters.categories.includes(p.vertical_id))
            : products;
        return [...new Set(pool.map((p: any) => p.brand).filter(Boolean))].sort() as string[];
    }, [products, filters.categories]);

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({
            sortBy: 'price_low',
            categories: [],
            availability: [],
            priceRange: [0, 10000],
            brands: [],
            onlyDiscounted: false,
            showInactive: false,
            isBestSeller: false,
        });
    };

    const toggleArrayItem = (key: 'categories' | 'availability' | 'brands', value: string) => {
        setFilters(prev => {
            const list = prev[key];
            return {
                ...prev,
                [key]: list.includes(value) ? list.filter(i => i !== value) : [...list, value]
            };
        });
    };

    const renderRightContent = () => {
        switch (selectedTab) {
            case 'sort':
                return (
                    <View style={styles.optionList}>
                        {[
                            { id: 'price_low', label: 'Price: Low to High' },
                            { id: 'price_high', label: 'Price: High to Low' },
                            { id: 'name_asc', label: 'Name: A to Z' },
                            { id: 'newest', label: 'Newest First' }
                        ].map((opt) => (
                            <TouchableOpacity
                                key={opt.id}
                                style={styles.radioRow}
                                onPress={() => setFilters({ ...filters, sortBy: opt.id })}
                            >
                                <Text style={[styles.radioLabel, filters.sortBy === opt.id && styles.activeText]}>{opt.label}</Text>
                                <View style={[styles.radioCircle, filters.sortBy === opt.id && styles.radioActive]}>
                                    {filters.sortBy === opt.id && <View style={styles.radioDot} />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                );
            case 'category':
                return (
                    <ScrollView contentContainerStyle={styles.optionList}>
                        {verticalPills.map(v => (
                            <TouchableOpacity key={v.id} style={styles.checkRow} onPress={() => toggleArrayItem('categories', v.id)}>
                                <Text style={styles.checkLabel}>{v.name}</Text>
                                <View style={[styles.checkBox, filters.categories.includes(v.id) && styles.checkActive]}>
                                    {filters.categories.includes(v.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                );

            case 'brand':
                return (
                    <ScrollView contentContainerStyle={styles.optionList}>
                        {cascadedBrands.map(brand => (
                            <TouchableOpacity key={brand} style={styles.checkRow} onPress={() => toggleArrayItem('brands', brand)}>
                                <Text style={styles.checkLabel}>{brand}</Text>
                                <View style={[styles.checkBox, filters.brands.includes(brand) && styles.checkActive]}>
                                    {filters.brands.includes(brand) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                );

            case 'availability':
                return (
                    <View style={styles.optionList}>
                        {['In Stock', 'Out of Stock', 'Low Stock'].map(status => (
                            <TouchableOpacity key={status} style={styles.checkRow} onPress={() => toggleArrayItem('availability', status)}>
                                <Text style={styles.checkLabel}>{status}</Text>
                                <View style={[styles.checkBox, filters.availability.includes(status) && styles.checkActive]}>
                                    {filters.availability.includes(status) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                );

            case 'discount':
                return (
                    <View style={styles.optionList}>
                        <TouchableOpacity style={styles.checkRow} onPress={() => setFilters(prev => ({ ...prev, onlyDiscounted: !prev.onlyDiscounted }))}>
                            <Text style={styles.checkLabel}>High Discount Only ({'>'} 20%)</Text>
                            <View style={[styles.checkBox, filters.onlyDiscounted && styles.checkActive]}>
                                {filters.onlyDiscounted && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                        </TouchableOpacity>
                    </View>
                );

            case 'price':
                return (
                    /* @ts-ignore */
                    <KeyboardAwareScrollView
                        contentContainerStyle={styles.optionList}
                        keyboardShouldPersistTaps="handled"
                        enableOnAndroid={true}
                    >
                        <Text style={styles.sectionTitle}>Price Range (₹)</Text>
                        <View style={styles.priceRow}>
                            <View style={styles.priceInputWrap}>
                                <Text style={styles.currency}>₹</Text>
                                <TextInput
                                    style={styles.priceInput}
                                    placeholder="Min"
                                    keyboardType="numeric"
                                    value={filters.priceRange[0].toString()}
                                    onChangeText={(text) => {
                                        const val = parseInt(text) || 0;
                                        setFilters({ ...filters, priceRange: [val, filters.priceRange[1]] });
                                    }}
                                />
                            </View>
                            <Text style={styles.rangeSep}>to</Text>
                            <View style={styles.priceInputWrap}>
                                <Text style={styles.currency}>₹</Text>
                                <TextInput
                                    style={styles.priceInput}
                                    placeholder="Max"
                                    keyboardType="numeric"
                                    value={filters.priceRange[1].toString()}
                                    onChangeText={(text) => {
                                        const val = parseInt(text) || 0;
                                        setFilters({ ...filters, priceRange: [filters.priceRange[0], val] });
                                    }}
                                />
                            </View>
                        </View>
                        <Text style={styles.helperText}>Shows products between ₹{filters.priceRange[0]} and ₹{filters.priceRange[1]}</Text>
                    </KeyboardAwareScrollView>
                );

            default:
                return null;
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.overlay}>
                <Pressable style={styles.dismissArea} onPress={onClose} />
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>Filters</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>

                    {/* Content: Split View */}
                    <View style={styles.content}>
                        {/* Sidebar */}
                        <View style={styles.sidebar}>
                            {SIDEBAR_ITEMS.filter(item => {
                                if (isGlobalInventory && (item.id === 'availability' || item.id === 'discount')) return false;
                                return true;
                            }).map(item => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.sidebarItem, selectedTab === item.id && styles.sidebarItemActive]}
                                    onPress={() => setSelectedTab(item.id)}
                                >
                                    <Text style={[styles.sidebarText, selectedTab === item.id && styles.sidebarTextActive]}>
                                        {item.label}
                                    </Text>
                                    {/* Show count dot if filter applied in this category? Future polish */}
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Right Panel */}
                        <View style={styles.rightPanel}>
                            {renderRightContent()}
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <TouchableOpacity onPress={handleReset}>
                            <Text style={styles.resetText}>Reset</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
                            <Text style={styles.applyText}>Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    dismissArea: {
        flex: 1,
    },
    container: {
        backgroundColor: '#fff',
        height: height * 0.75,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#000',
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    sidebar: {
        width: '35%',
        backgroundColor: '#f8f9fa',
        borderRightWidth: 1,
        borderRightColor: '#eee',
    },
    sidebarItem: {
        paddingVertical: 15,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    sidebarItemActive: {
        backgroundColor: '#fff',
        borderLeftWidth: 3,
        borderLeftColor: '#000',
    },
    sidebarText: {
        fontSize: 14,
        color: '#666',
    },
    sidebarTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    rightPanel: {
        flex: 1,
        backgroundColor: '#fff',
    },
    optionList: {
        padding: 20,
    },
    radioRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    radioLabel: {
        fontSize: 15,
        color: '#333',
    },
    activeText: {
        color: '#000',
        fontWeight: '600',
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#ddd',
        justifyContent: 'center',
        alignItems: 'center',
    },
    radioActive: {
        borderColor: '#000',
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#000',
    },
    checkRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f5f5f5',
    },
    checkLabel: {
        fontSize: 15,
        color: '#333',
    },
    checkBox: {
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#ddd',
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkActive: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#eee',
        paddingBottom: 30,
    },
    resetText: {
        color: '#666',
        fontSize: 15,
        fontWeight: '600',
    },
    applyBtn: {
        backgroundColor: '#000',
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 25,
    },
    applyText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 15,
        color: '#333',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    priceInputWrap: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 45,
        backgroundColor: '#f9f9f9',
    },
    currency: {
        fontSize: 14,
        color: '#666',
        marginRight: 4,
    },
    priceInput: {
        flex: 1,
        fontSize: 16,
        color: '#000',
    },
    rangeSep: {
        marginHorizontal: 10,
        color: '#999',
    },
    helperText: {
        fontSize: 13,
        color: '#888',
        marginTop: 5,
    },
});
