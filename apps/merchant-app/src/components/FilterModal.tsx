// @lock — DO NOT EDIT WITHOUT EXPLICIT USER PERMISSION.
// FilterModal — Pass 3 approved May 19, 2026.
// Covers (cumulative):
//   - isDining-driven sidebar split (dining: Sort/Menu Section/Dietary/Spice/Price/Availability;
//     pickup: Sort/Price/Category/Brand/Availability/Discounts; global catalog: isGlobalInventory)
//   - Canonical Menu Sections / Dietary (incl. "Both" shortcut for Veg+Non-Veg) / Spice Level lists
//   - Active/Inactive availability for dining; In/Out/Low Stock for pickup
//   - Category tab: name-string options derived from inventory (via `availableCategories` prop)
//     for per-store flow; vertical UUID pills for global catalog flow (via isGlobalInventory)
//   - Brand tab: shape-tolerant `cascadedBrands` (handles both InventoryItem and flat-product shapes)
//   - Android keyboard handled via percentage `height: '75%'` on modal container plus
//     `softwareKeyboardLayoutMode: "resize"` (app.json). No manual keyboardHeight math.
// Any modification to the filter options, wiring, or keyboard handling REQUIRES the user's
// explicit chat-confirmed approval before editing this file.
// This is a hard lock — do not edit, refactor, "clean up", or auto-fix without permission.
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Pressable, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface FilterModalProps {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: FilterState) => void;
    initialFilters?: FilterState;
    initialTab?: string;
    isGlobalInventory?: boolean;
    isDining?: boolean;
    verticalPills?: { id: string; name: string }[];
    products?: any[];
    availableCategories?: string[];
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
    menuSections: string[];
    dietaryTags: string[];
    spiceLevels: string[];
}

const SIDEBAR_ITEMS_PICKUP = [
    { id: 'sort', label: 'Sort By' },
    { id: 'price', label: 'Price Range' },
    { id: 'category', label: 'Category' },
    { id: 'brand', label: 'Brand' },
    { id: 'availability', label: 'Availability' },
    { id: 'discount', label: 'Discounts' }
];

const SIDEBAR_ITEMS_DINING = [
    { id: 'sort', label: 'Sort By' },
    { id: 'menu_section', label: 'Menu Section' },
    { id: 'dietary', label: 'Dietary' },
    { id: 'spice', label: 'Spice Level' },
    { id: 'price', label: 'Price Range' },
    { id: 'availability', label: 'Availability' },
];

const DIETARY_OPTIONS = [
    { id: 'veg', label: 'Vegetarian', color: '#22C55E' },
    { id: 'non-veg', label: 'Non-Vegetarian', color: '#EF4444' },
    { id: 'egg', label: 'Egg / Eggetarian', color: '#F59E0B' },
    { id: 'vegan', label: 'Vegan', color: '#22C55E' },
];

const SPICE_OPTIONS = [
    { id: 'none', label: 'No Spice' },
    { id: 'mild', label: 'Mild' },
    { id: 'medium', label: 'Medium' },
    { id: 'spicy', label: 'Spicy' },
    { id: 'extra-spicy', label: 'Extra Spicy' },
];

const MENU_SECTION_OPTIONS = ['Starters', 'Main Course', 'Desserts', 'Beverages', 'Sides', 'Specials'];

export default function FilterModal({ visible, onClose, onApply, initialFilters, initialTab = 'sort', isGlobalInventory = false, isDining = false, verticalPills = [], products = [], availableCategories = [] }: FilterModalProps) {
    const insets = useSafeAreaInsets();
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
        menuSections: [],
        dietaryTags: [],
        spiceLevels: [],
    });

    useEffect(() => {
        if (initialFilters) setFilters(initialFilters);
    }, [initialFilters, visible]);

    // Cascading brands: derive from products filtered by selected categories.
    // Supports BOTH data shapes:
    //   - InventoryItem (per-store inventory): { product: { brand, subcategory, category_id } }
    //   - Flat product (global catalog-picker): { brand, vertical_id }
    const cascadedBrands = useMemo(() => {
        if (!products || products.length === 0) return [];
        const pool = filters.categories.length > 0
            ? products.filter((p: any) => {
                const sub = p.product?.subcategory ?? p.subcategory;
                const catId = p.product?.category_id ?? p.category_id;
                const vertId = p.vertical_id;
                return filters.categories.includes(sub || '')
                    || (vertId && filters.categories.includes(vertId))
                    || (catId && filters.categories.includes(catId));
            })
            : products;
        return [...new Set(
            pool.map((p: any) => p.product?.brand ?? p.brand).filter(Boolean)
        )].sort() as string[];
    }, [products, filters.categories]);

    // Android keyboard avoidance is handled entirely by `softwareKeyboardLayoutMode: "resize"`
    // (app.json) plus the percentage `height: '75%'` on the modal container, which makes the
    // bottom sheet resize naturally with the (shrunk) window. No manual keyboard math needed.

    // "Both" dietary shortcut: selects Veg + Non-Veg together
    const isBothSelected = filters.dietaryTags.includes('veg') && filters.dietaryTags.includes('non-veg');
    const toggleBoth = () => {
        setFilters(prev => {
            if (isBothSelected) {
                return { ...prev, dietaryTags: prev.dietaryTags.filter(t => t !== 'veg' && t !== 'non-veg') };
            }
            const next = [...prev.dietaryTags];
            if (!next.includes('veg')) next.push('veg');
            if (!next.includes('non-veg')) next.push('non-veg');
            return { ...prev, dietaryTags: next };
        });
    };

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
            menuSections: [],
            dietaryTags: [],
            spiceLevels: [],
        });
    };

    const toggleArrayItem = (key: 'categories' | 'availability' | 'brands' | 'menuSections' | 'dietaryTags' | 'spiceLevels', value: string) => {
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
                if (isGlobalInventory) {
                    // Global catalog-picker flow: vertical UUID pills
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
                }
                // Per-store inventory flow: category-name strings derived from inventory
                return (
                    <ScrollView contentContainerStyle={styles.optionList}>
                        {availableCategories.length === 0 ? (
                            <Text style={styles.helperText}>No categories found in your inventory.</Text>
                        ) : availableCategories.map(catName => (
                            <TouchableOpacity key={catName} style={styles.checkRow} onPress={() => toggleArrayItem('categories', catName)}>
                                <Text style={styles.checkLabel}>{catName}</Text>
                                <View style={[styles.checkBox, filters.categories.includes(catName) && styles.checkActive]}>
                                    {filters.categories.includes(catName) && <Ionicons name="checkmark" size={14} color="#fff" />}
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

            case 'menu_section':
                return (
                    <ScrollView contentContainerStyle={styles.optionList}>
                        {MENU_SECTION_OPTIONS.map(section => (
                            <TouchableOpacity key={section} style={styles.checkRow} onPress={() => toggleArrayItem('menuSections', section)}>
                                <Text style={styles.checkLabel}>{section}</Text>
                                <View style={[styles.checkBox, filters.menuSections.includes(section) && styles.checkActive]}>
                                    {filters.menuSections.includes(section) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                );

            case 'dietary':
                return (
                    <ScrollView contentContainerStyle={styles.optionList}>
                        {/* Vegetarian */}
                        {(() => {
                            const opt = DIETARY_OPTIONS.find(o => o.id === 'veg')!;
                            return (
                                <TouchableOpacity key={opt.id} style={styles.checkRow} onPress={() => toggleArrayItem('dietaryTags', opt.id)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: opt.color, marginRight: 10 }} />
                                        <Text style={styles.checkLabel}>{opt.label}</Text>
                                    </View>
                                    <View style={[styles.checkBox, filters.dietaryTags.includes(opt.id) && styles.checkActive]}>
                                        {filters.dietaryTags.includes(opt.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })()}

                        {/* Non-Vegetarian */}
                        {(() => {
                            const opt = DIETARY_OPTIONS.find(o => o.id === 'non-veg')!;
                            return (
                                <TouchableOpacity key={opt.id} style={styles.checkRow} onPress={() => toggleArrayItem('dietaryTags', opt.id)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: opt.color, marginRight: 10 }} />
                                        <Text style={styles.checkLabel}>{opt.label}</Text>
                                    </View>
                                    <View style={[styles.checkBox, filters.dietaryTags.includes(opt.id) && styles.checkActive]}>
                                        {filters.dietaryTags.includes(opt.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })()}

                        {/* Both (Veg + Non-Veg shortcut) */}
                        <TouchableOpacity key="both" style={styles.checkRow} onPress={toggleBoth}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ flexDirection: 'row', marginRight: 10 }}>
                                    <View style={{ width: 12, height: 12, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, backgroundColor: '#22C55E' }} />
                                    <View style={{ width: 12, height: 12, borderTopRightRadius: 6, borderBottomRightRadius: 6, backgroundColor: '#EF4444' }} />
                                </View>
                                <Text style={styles.checkLabel}>Both (Veg + Non-Veg)</Text>
                            </View>
                            <View style={[styles.checkBox, isBothSelected && styles.checkActive]}>
                                {isBothSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                        </TouchableOpacity>

                        {/* Egg */}
                        {(() => {
                            const opt = DIETARY_OPTIONS.find(o => o.id === 'egg')!;
                            return (
                                <TouchableOpacity key={opt.id} style={styles.checkRow} onPress={() => toggleArrayItem('dietaryTags', opt.id)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: opt.color, marginRight: 10 }} />
                                        <Text style={styles.checkLabel}>{opt.label}</Text>
                                    </View>
                                    <View style={[styles.checkBox, filters.dietaryTags.includes(opt.id) && styles.checkActive]}>
                                        {filters.dietaryTags.includes(opt.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })()}

                        {/* Vegan */}
                        {(() => {
                            const opt = DIETARY_OPTIONS.find(o => o.id === 'vegan')!;
                            return (
                                <TouchableOpacity key={opt.id} style={styles.checkRow} onPress={() => toggleArrayItem('dietaryTags', opt.id)}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: opt.color, marginRight: 10 }} />
                                        <Text style={styles.checkLabel}>{opt.label}</Text>
                                    </View>
                                    <View style={[styles.checkBox, filters.dietaryTags.includes(opt.id) && styles.checkActive]}>
                                        {filters.dietaryTags.includes(opt.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })()}
                    </ScrollView>
                );

            case 'spice':
                return (
                    <ScrollView contentContainerStyle={styles.optionList}>
                        {SPICE_OPTIONS.map(opt => (
                            <TouchableOpacity key={opt.id} style={styles.checkRow} onPress={() => toggleArrayItem('spiceLevels', opt.id)}>
                                <Text style={styles.checkLabel}>{opt.label}</Text>
                                <View style={[styles.checkBox, filters.spiceLevels.includes(opt.id) && styles.checkActive]}>
                                    {filters.spiceLevels.includes(opt.id) && <Ionicons name="checkmark" size={14} color="#fff" />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                );

            case 'availability':
                return (
                    <View style={styles.optionList}>
                        {(isDining ? ['Active', 'Inactive'] : ['In Stock', 'Out of Stock', 'Low Stock']).map(status => (
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
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={styles.optionList}>
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
                        </View>
                    </TouchableWithoutFeedback>
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
                            {(isDining ? SIDEBAR_ITEMS_DINING : SIDEBAR_ITEMS_PICKUP).filter(item => {
                                if (isGlobalInventory && (item.id === 'availability' || item.id === 'discount')) return false;
                                return true;
                            }).map(item => (
                                <TouchableOpacity
                                    key={item.id}
                                    style={[styles.sidebarItem, selectedTab === item.id && styles.sidebarItemActive]}
                                    onPress={() => { Keyboard.dismiss(); setSelectedTab(item.id); }}
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
                    <View style={[styles.footer, { paddingBottom: Math.max(30, insets.bottom + 10) }]}>
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
        height: '75%',
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
