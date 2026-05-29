import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Modal, ScrollView,
    Dimensions, Pressable
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { X, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RangeSlider from './RangeSlider';
import type { SortOption } from '../utils/filterConfig';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface StoreModalFilters {
    sortBy: 'relevance' | 'rating' | 'distance' | 'most_items' | 'prep_time';
    minRating: number | null;       // null = any, 3.5, 4.0, 4.5
    maxDistance: number | null;      // null = any, 1, 3, 5, 10 (km)
    openNow: boolean;
    priceMin: number;
    priceMax: number;
    pureVeg: boolean;
    brands: string[];
}

export const DEFAULT_MODAL_FILTERS: StoreModalFilters = {
    sortBy: 'relevance',
    minRating: null,
    maxDistance: null,
    openNow: false,
    priceMin: 0,
    priceMax: 1000,
    pureVeg: false,
    brands: [],
};

const ALL_SORT_OPTIONS: { id: SortOption; label: string }[] = [
    { id: 'relevance', label: 'Relevance' },
    { id: 'rating', label: 'Rating: High to Low' },
    { id: 'distance', label: 'Distance: Nearest' },
    { id: 'most_items', label: 'Most Items' },
    { id: 'prep_time', label: 'Prep Time: Fastest' },
];

interface Props {
    visible: boolean;
    filters: StoreModalFilters;
    onApply: (filters: StoreModalFilters) => void;
    onClose: () => void;
    showBrands?: boolean;
    availableBrands?: string[];
    showRatings?: boolean;
    showDietary?: boolean;
    showPriceRange?: boolean;
    showSortOptions?: SortOption[];
}

// ─── Chip Component ───
const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        className={`px-4 py-2.5 rounded-xl mr-2 mb-2 border ${active
            ? 'bg-[#1F2937] border-[#1F2937]'
            : 'bg-white border-gray-200'
        }`}
    >
        <Text className={`font-bold text-[12px] ${active ? 'text-white' : 'text-gray-600'}`}>
            {label}
        </Text>
    </TouchableOpacity>
);

// ─── Toggle Switch ───
const Toggle = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity
        onPress={() => { Haptics.selectionAsync(); onPress(); }}
        className="flex-row items-center justify-between py-3"
    >
        <Text className="text-[14px] font-semibold text-gray-800">{label}</Text>
        <View className={`w-12 h-7 rounded-full justify-center px-0.5 ${active ? 'bg-[#B52725]' : 'bg-gray-300'}`}>
            <View
                className="w-6 h-6 rounded-full bg-white shadow-sm"
                style={{ alignSelf: active ? 'flex-end' : 'flex-start' }}
            />
        </View>
    </TouchableOpacity>
);

// ─── Section Header ───
const SectionHeader = ({ title }: { title: string }) => (
    <Text className="text-[15px] font-bold text-gray-900 mb-3 mt-5">{title}</Text>
);

export default function StoreFilterModal({
    visible, filters, onApply, onClose,
    showBrands = false,
    availableBrands,
    showRatings = false,
    showDietary = false,
    showPriceRange = true,
    showSortOptions,
}: Props) {
    const [draft, setDraft] = useState<StoreModalFilters>(filters);

    // Sync draft when modal opens
    React.useEffect(() => {
        if (visible) setDraft(filters);
    }, [visible, filters]);

    const update = (patch: Partial<StoreModalFilters>) => {
        setDraft(prev => ({ ...prev, ...patch }));
    };

    const handleClearAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDraft({ ...DEFAULT_MODAL_FILTERS });
    };

    const handleApply = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onApply(draft);
        onClose();
    };

    // Filter sort options based on what the parent wants to show
    const sortOptions = showSortOptions
        ? ALL_SORT_OPTIONS.filter(opt => showSortOptions.includes(opt.id))
        : ALL_SORT_OPTIONS.filter(opt => opt.id !== 'prep_time'); // default: hide prep_time

    // Only count filters from visible sections
    const activeCount = [
        draft.sortBy !== 'relevance',
        showRatings && draft.minRating !== null,
        draft.maxDistance !== null,
        draft.openNow,
        showPriceRange && (draft.priceMin > 0 || draft.priceMax < 1000),
        showDietary && draft.pureVeg,
        showBrands && draft.brands.length > 0,
    ].filter(Boolean).length;

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {/* Backdrop */}
            <Pressable
                className="flex-1 bg-black/50"
                onPress={onClose}
            />

            {/* Sheet */}
            <View
                className="bg-white rounded-t-3xl"
                style={{ maxHeight: SCREEN_HEIGHT * 0.75 }}
            >
                {/* Handle Bar */}
                <View className="items-center pt-3 pb-1">
                    <View className="w-10 h-1 rounded-full bg-gray-300" />
                </View>

                {/* Header */}
                <View className="flex-row items-center justify-between px-5 pb-3 border-b border-gray-100">
                    <Text className="text-[18px] font-bold text-gray-900">Filters</Text>
                    <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
                        <X size={22} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                {/* Scrollable Content */}
                <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

                    {/* ── Sort By ── */}
                    <SectionHeader title="Sort By" />
                    <View className="flex-row flex-wrap">
                        {sortOptions.map(opt => (
                            <Chip
                                key={opt.id}
                                label={opt.label}
                                active={draft.sortBy === opt.id}
                                onPress={() => update({ sortBy: opt.id })}
                            />
                        ))}
                    </View>

                    {/* ── Rating (conditional) ── */}
                    {showRatings && (
                        <>
                            <SectionHeader title="Rating" />
                            <View className="flex-row flex-wrap">
                                {([
                                    { value: null, label: 'Any' },
                                    { value: 3.5, label: '3.5+' },
                                    { value: 4.0, label: '4.0+' },
                                    { value: 4.5, label: '4.5+' },
                                ] as const).map(opt => (
                                    <Chip
                                        key={String(opt.value)}
                                        label={opt.label}
                                        active={draft.minRating === opt.value}
                                        onPress={() => update({ minRating: opt.value })}
                                    />
                                ))}
                            </View>
                        </>
                    )}

                    {/* ── Distance ── */}
                    <SectionHeader title="Distance" />
                    <View className="flex-row flex-wrap">
                        {([
                            { value: null, label: 'Any' },
                            { value: 1, label: 'Under 1 km' },
                            { value: 3, label: 'Under 3 km' },
                            { value: 5, label: 'Under 5 km' },
                            { value: 10, label: 'Under 10 km' },
                        ] as const).map(opt => (
                            <Chip
                                key={String(opt.value)}
                                label={opt.label}
                                active={draft.maxDistance === opt.value}
                                onPress={() => update({ maxDistance: opt.value })}
                            />
                        ))}
                    </View>

                    {/* ── Availability ── */}
                    <SectionHeader title="Availability" />
                    <Toggle
                        label="Open Now"
                        active={draft.openNow}
                        onPress={() => update({ openNow: !draft.openNow })}
                    />

                    {/* ── Price Range — Drag Slider (conditional) ── */}
                    {showPriceRange && (
                        <>
                            <SectionHeader title="Price Range (Avg. Product Price)" />
                            <RangeSlider
                                min={0}
                                max={1000}
                                step={50}
                                lowValue={draft.priceMin}
                                highValue={draft.priceMax}
                                onValueChange={(low, high) => update({ priceMin: low, priceMax: high })}
                                formatLabel={(v) => v >= 1000 ? '₹1000+' : `₹${v}`}
                            />
                        </>
                    )}

                    {/* ── Dietary (conditional) ── */}
                    {showDietary && (
                        <>
                            <SectionHeader title="Dietary" />
                            <Toggle
                                label="Pure Veg Only"
                                active={draft.pureVeg}
                                onPress={() => update({ pureVeg: !draft.pureVeg })}
                            />
                        </>
                    )}

                    {/* ── Brands (conditional) ── */}
                    {showBrands && availableBrands && availableBrands.length > 0 && (
                        <>
                            <SectionHeader title="Brands" />
                            <View className="flex-row flex-wrap">
                                {availableBrands.map(brand => (
                                    <Chip
                                        key={brand}
                                        label={brand}
                                        active={draft.brands.includes(brand)}
                                        onPress={() => {
                                            const next = draft.brands.includes(brand)
                                                ? draft.brands.filter(b => b !== brand)
                                                : [...draft.brands, brand];
                                            update({ brands: next });
                                        }}
                                    />
                                ))}
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* Footer */}
                <View className="flex-row items-center px-5 py-4 border-t border-gray-100" style={{ gap: 12 }}>
                    <TouchableOpacity
                        onPress={handleClearAll}
                        className="flex-row items-center px-5 py-3 rounded-xl border border-gray-300"
                    >
                        <RotateCcw size={14} color="#6B7280" />
                        <Text className="text-[13px] font-bold text-gray-600 ml-2">Clear All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleApply}
                        className="flex-1 bg-[#B52725] py-3.5 rounded-xl items-center justify-center shadow-sm"
                    >
                        <Text className="text-white font-bold text-[14px]">
                            Apply Filters{activeCount > 0 ? ` (${activeCount})` : ''}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
    );
}
