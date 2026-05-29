import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, Modal, ScrollView,
    Dimensions, Pressable
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { X, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import RangeSlider from './RangeSlider';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export interface ProductFilterState {
    sortBy: 'relevance' | 'price_low' | 'price_high' | 'popularity';
    vegFilter: 'all' | 'veg' | 'non-veg';
    priceMin: number;
    priceMax: number;
    bestsellerOnly: boolean;
    offersOnly: boolean;
}

export const DEFAULT_PRODUCT_FILTERS: ProductFilterState = {
    sortBy: 'relevance',
    vegFilter: 'all',
    priceMin: 0,
    priceMax: 1000,
    bestsellerOnly: false,
    offersOnly: false,
};

interface FilterSortModalProps {
    visible: boolean;
    filters: ProductFilterState;
    onApply: (filters: ProductFilterState) => void;
    onClose: () => void;
    matchCount: number;
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

export default function FilterSortModal({ visible, filters, onApply, onClose, matchCount }: FilterSortModalProps) {
    const [draft, setDraft] = useState<ProductFilterState>(filters);

    // Sync draft when modal opens
    React.useEffect(() => {
        if (visible) setDraft(filters);
    }, [visible, filters]);

    const update = (patch: Partial<ProductFilterState>) => {
        setDraft(prev => ({ ...prev, ...patch }));
    };

    const handleClearAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setDraft({ ...DEFAULT_PRODUCT_FILTERS });
    };

    const handleApply = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onApply(draft);
        onClose();
    };

    const activeCount = [
        draft.sortBy !== 'relevance',
        draft.vegFilter !== 'all',
        draft.priceMin > 0 || draft.priceMax < 1000,
        draft.bestsellerOnly,
        draft.offersOnly,
    ].filter(Boolean).length;

    return (
        <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {/* Backdrop */}
            <Pressable className="flex-1 bg-black/50" onPress={onClose} />

            {/* Sheet */}
            <View className="bg-white rounded-t-3xl" style={{ maxHeight: SCREEN_HEIGHT * 0.75 }}>
                {/* Handle Bar */}
                <View className="items-center pt-3 pb-1">
                    <View className="w-10 h-1 rounded-full bg-gray-300" />
                </View>

                {/* Header */}
                <View className="flex-row items-center justify-between px-5 pb-3 border-b border-gray-100">
                    <Text className="text-[18px] font-bold text-gray-900">Filter & Sort</Text>
                    <TouchableOpacity onPress={onClose} className="p-2 -mr-2">
                        <X size={22} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                {/* Scrollable Content */}
                <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>

                    {/* Sort By */}
                    <SectionHeader title="Sort By" />
                    <View className="flex-row flex-wrap">
                        {([
                            { id: 'relevance', label: 'Relevance' },
                            { id: 'price_low', label: 'Price: Low to High' },
                            { id: 'price_high', label: 'Price: High to Low' },
                            { id: 'popularity', label: 'Popularity' },
                        ] as const).map(opt => (
                            <Chip key={opt.id} label={opt.label} active={draft.sortBy === opt.id} onPress={() => update({ sortBy: opt.id })} />
                        ))}
                    </View>

                    {/* Dietary */}
                    <SectionHeader title="Dietary" />
                    <View className="flex-row flex-wrap">
                        {([
                            { id: 'all', label: 'All' },
                            { id: 'veg', label: 'Pure Veg' },
                            { id: 'non-veg', label: 'Non-Veg' },
                        ] as const).map(opt => (
                            <Chip key={opt.id} label={opt.label} active={draft.vegFilter === opt.id} onPress={() => update({ vegFilter: opt.id })} />
                        ))}
                    </View>

                    {/* Price Range — Drag Slider */}
                    <SectionHeader title="Price Range" />
                    <RangeSlider
                        min={0}
                        max={1000}
                        step={50}
                        lowValue={draft.priceMin}
                        highValue={draft.priceMax}
                        onValueChange={(low, high) => update({ priceMin: low, priceMax: high })}
                        formatLabel={(v) => v >= 1000 ? '₹1000+' : `₹${v}`}
                    />

                    {/* Toggles */}
                    <SectionHeader title="More Filters" />
                    <Toggle label="Bestsellers Only" active={draft.bestsellerOnly} onPress={() => update({ bestsellerOnly: !draft.bestsellerOnly })} />
                    <Toggle label="Offers / Discounts Only" active={draft.offersOnly} onPress={() => update({ offersOnly: !draft.offersOnly })} />
                </ScrollView>

                {/* Footer */}
                <View className="flex-row items-center px-5 py-4 border-t border-gray-100" style={{ gap: 12 }}>
                    <TouchableOpacity onPress={handleClearAll} className="flex-row items-center px-5 py-3 rounded-xl border border-gray-300">
                        <RotateCcw size={14} color="#6B7280" />
                        <Text className="text-[13px] font-bold text-gray-600 ml-2">Clear All</Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={handleApply} className="flex-1 bg-[#B52725] py-3.5 rounded-xl items-center justify-center shadow-sm">
                        <Text className="text-white font-bold text-[14px]">
                            {matchCount > 0 ? `Show ${matchCount} items` : activeCount > 0 ? `Apply (${activeCount})` : 'Apply'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
    );
}
