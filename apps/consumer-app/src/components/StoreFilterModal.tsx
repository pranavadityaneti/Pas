import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Modal, ScrollView,
    Dimensions, Pressable
} from 'react-native';
import { X, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface StoreModalFilters {
    sortBy: 'relevance' | 'rating' | 'distance' | 'most_items';
    minRating: number | null;       // null = any, 3.5, 4.0, 4.5
    maxDistance: number | null;      // null = any, 1, 2, 5 (km)
    openNow: boolean;
    priceRange: 'any' | 'budget' | 'mid' | 'premium';
    pureVeg: boolean;
}

export const DEFAULT_MODAL_FILTERS: StoreModalFilters = {
    sortBy: 'relevance',
    minRating: null,
    maxDistance: null,
    openNow: false,
    priceRange: 'any',
    pureVeg: false,
};

interface Props {
    visible: boolean;
    filters: StoreModalFilters;
    onApply: (filters: StoreModalFilters) => void;
    onClose: () => void;
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

export default function StoreFilterModal({ visible, filters, onApply, onClose }: Props) {
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

    const activeCount = [
        draft.sortBy !== 'relevance',
        draft.minRating !== null,
        draft.maxDistance !== null,
        draft.openNow,
        draft.priceRange !== 'any',
        draft.pureVeg,
    ].filter(Boolean).length;

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
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
                        {([
                            { id: 'relevance', label: 'Relevance' },
                            { id: 'rating', label: 'Rating: High → Low' },
                            { id: 'distance', label: 'Distance: Nearest' },
                            { id: 'most_items', label: 'Most Items' },
                        ] as const).map(opt => (
                            <Chip
                                key={opt.id}
                                label={opt.label}
                                active={draft.sortBy === opt.id}
                                onPress={() => update({ sortBy: opt.id })}
                            />
                        ))}
                    </View>

                    {/* ── Rating ── */}
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

                    {/* ── Distance ── */}
                    <SectionHeader title="Distance" />
                    <View className="flex-row flex-wrap">
                        {([
                            { value: null, label: 'Any' },
                            { value: 1, label: 'Under 1 km' },
                            { value: 2, label: 'Under 2 km' },
                            { value: 5, label: 'Under 5 km' },
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

                    {/* ── Price Range ── */}
                    <SectionHeader title="Price Range (Avg. Product Price)" />
                    <View className="flex-row flex-wrap">
                        {([
                            { id: 'any', label: 'Any' },
                            { id: 'budget', label: 'Budget (< ₹100)' },
                            { id: 'mid', label: 'Mid-range (₹100–₹300)' },
                            { id: 'premium', label: 'Premium (₹300+)' },
                        ] as const).map(opt => (
                            <Chip
                                key={opt.id}
                                label={opt.label}
                                active={draft.priceRange === opt.id}
                                onPress={() => update({ priceRange: opt.id })}
                            />
                        ))}
                    </View>

                    {/* ── Dietary ── */}
                    <SectionHeader title="Dietary" />
                    <Toggle
                        label="Pure Veg Only"
                        active={draft.pureVeg}
                        onPress={() => update({ pureVeg: !draft.pureVeg })}
                    />
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
        </Modal>
    );
}
