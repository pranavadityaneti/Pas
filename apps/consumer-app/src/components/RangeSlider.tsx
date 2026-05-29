import React, { useCallback, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    runOnJS,
} from 'react-native-reanimated';

const THUMB_SIZE = 24;
const TRACK_HEIGHT = 4;

interface RangeSliderProps {
    min: number;
    max: number;
    step?: number;
    lowValue: number;
    highValue: number;
    onValueChange: (low: number, high: number) => void;
    formatLabel?: (value: number) => string;
    trackColor?: string;
    activeTrackColor?: string;
    thumbColor?: string;
}

export default function RangeSlider({
    min,
    max,
    step = 1,
    lowValue,
    highValue,
    onValueChange,
    formatLabel = (v) => `${v}`,
    trackColor = '#E5E7EB',
    activeTrackColor = '#1F2937',
    thumbColor = '#1F2937',
}: RangeSliderProps) {
    const [trackWidth, setTrackWidth] = useState(0);

    // Convert value to pixel position
    const valueToX = useCallback((value: number) => {
        if (max === min) return 0;
        return ((value - min) / (max - min)) * trackWidth;
    }, [min, max, trackWidth]);

    // Convert pixel position to snapped value
    const xToValue = useCallback((x: number) => {
        if (trackWidth === 0) return min;
        const ratio = Math.max(0, Math.min(1, x / trackWidth));
        const raw = min + ratio * (max - min);
        const snapped = Math.round(raw / step) * step;
        return Math.max(min, Math.min(max, snapped));
    }, [min, max, step, trackWidth]);

    // Shared values for dragging
    const lowX = useSharedValue(valueToX(lowValue));
    const highX = useSharedValue(valueToX(highValue));
    const lowStart = useSharedValue(0);
    const highStart = useSharedValue(0);

    // Keep shared values in sync with props when trackWidth changes
    React.useEffect(() => {
        if (trackWidth > 0) {
            lowX.value = valueToX(lowValue);
            highX.value = valueToX(highValue);
        }
    }, [trackWidth, lowValue, highValue]);

    const updateValues = useCallback((lx: number, hx: number) => {
        const newLow = xToValue(lx);
        const newHigh = xToValue(hx);
        onValueChange(Math.min(newLow, newHigh), Math.max(newLow, newHigh));
    }, [xToValue, onValueChange]);

    // Low thumb gesture
    const lowGesture = Gesture.Pan()
        .onStart(() => {
            lowStart.value = lowX.value;
        })
        .onUpdate((e) => {
            const newX = Math.max(0, Math.min(highX.value - 1, lowStart.value + e.translationX));
            lowX.value = newX;
            runOnJS(updateValues)(newX, highX.value);
        })
        .hitSlop({ top: 16, bottom: 16, left: 16, right: 16 });

    // High thumb gesture
    const highGesture = Gesture.Pan()
        .onStart(() => {
            highStart.value = highX.value;
        })
        .onUpdate((e) => {
            const newX = Math.max(lowX.value + 1, Math.min(trackWidth, highStart.value + e.translationX));
            highX.value = newX;
            runOnJS(updateValues)(lowX.value, newX);
        })
        .hitSlop({ top: 16, bottom: 16, left: 16, right: 16 });

    // Animated styles
    const lowThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: lowX.value - THUMB_SIZE / 2 }],
    }));

    const highThumbStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: highX.value - THUMB_SIZE / 2 }],
    }));

    const activeTrackStyle = useAnimatedStyle(() => ({
        left: lowX.value,
        width: highX.value - lowX.value,
    }));

    const handleLayout = (e: LayoutChangeEvent) => {
        setTrackWidth(e.nativeEvent.layout.width);
    };

    return (
        <View style={{ paddingTop: 8, paddingBottom: 4 }}>
            {/* Current range label */}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937' }}>
                    {formatLabel(lowValue)} – {formatLabel(highValue)}
                </Text>
            </View>

            {/* Track container */}
            <View
                onLayout={handleLayout}
                style={{
                    height: THUMB_SIZE,
                    justifyContent: 'center',
                }}
            >
                {/* Background track */}
                <View
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        height: TRACK_HEIGHT,
                        borderRadius: TRACK_HEIGHT / 2,
                        backgroundColor: trackColor,
                    }}
                />

                {/* Active track */}
                {trackWidth > 0 && (
                    <Animated.View
                        style={[
                            {
                                position: 'absolute',
                                height: TRACK_HEIGHT,
                                borderRadius: TRACK_HEIGHT / 2,
                                backgroundColor: activeTrackColor,
                            },
                            activeTrackStyle,
                        ]}
                    />
                )}

                {/* Low thumb */}
                {trackWidth > 0 && (
                    <GestureDetector gesture={lowGesture}>
                        <Animated.View
                            style={[
                                {
                                    position: 'absolute',
                                    width: THUMB_SIZE,
                                    height: THUMB_SIZE,
                                    borderRadius: THUMB_SIZE / 2,
                                    backgroundColor: thumbColor,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.2,
                                    shadowRadius: 3,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 4,
                                },
                                lowThumbStyle,
                            ]}
                        />
                    </GestureDetector>
                )}

                {/* High thumb */}
                {trackWidth > 0 && (
                    <GestureDetector gesture={highGesture}>
                        <Animated.View
                            style={[
                                {
                                    position: 'absolute',
                                    width: THUMB_SIZE,
                                    height: THUMB_SIZE,
                                    borderRadius: THUMB_SIZE / 2,
                                    backgroundColor: thumbColor,
                                    shadowColor: '#000',
                                    shadowOpacity: 0.2,
                                    shadowRadius: 3,
                                    shadowOffset: { width: 0, height: 2 },
                                    elevation: 4,
                                },
                                highThumbStyle,
                            ]}
                        />
                    </GestureDetector>
                )}
            </View>

            {/* Min/Max labels */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>
                    {formatLabel(min)}
                </Text>
                <Text style={{ fontSize: 12, color: '#9CA3AF', fontWeight: '500' }}>
                    {formatLabel(max)}
                </Text>
            </View>
        </View>
    );
}
