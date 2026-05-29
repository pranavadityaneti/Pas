import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCart } from '../context/CartContext';
import { navigationRef } from '../navigation/navigationRef';

const HIDDEN_SCREENS = [
    'Cart',
    'CartMain',
    'Checkout',
    'CheckoutScreen',
    'DiningCheckout',
    'DiningCheckoutScreen',
    'BookingModal',
    'Login',
    'OTPVerification',
    'AuthScreen',
    'Auth',
    'Onboarding',
    'ProfileSetup',
];

function getActiveRouteName(): string {
    try {
        if (!navigationRef.isReady()) return '';
        let state = navigationRef.getRootState();
        if (!state) return '';
        let route = state.routes[state.index];
        while (route.state && route.state.index !== undefined) {
            route = (route.state as any).routes[(route.state as any).index];
        }
        return route.name || '';
    } catch {
        return '';
    }
}

export default function FloatingCartBand() {
    const { getItemCount, getTotal } = useCart();
    const insets = useSafeAreaInsets();
    const [currentRoute, setCurrentRoute] = useState('');

    useEffect(() => {
        if (!navigationRef.isReady()) return;

        // Set initial route
        setCurrentRoute(getActiveRouteName());

        // Listen for route changes
        const unsubscribe = navigationRef.addListener('state', () => {
            setCurrentRoute(getActiveRouteName());
        });

        return unsubscribe;
    }, []);

    const itemCount = getItemCount();
    const totalAmount = getTotal();

    if (itemCount === 0) return null;
    if (HIDDEN_SCREENS.includes(currentRoute)) return null;

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                paddingHorizontal: 20,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 20) + 60,
                backgroundColor: 'transparent',
                zIndex: 999,
            }}
        >
            <TouchableOpacity
                delayPressIn={0}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    if (navigationRef.isReady()) {
                        navigationRef.navigate('Main', { screen: 'Cart', params: { screen: 'CartMain' } } as any);
                    }
                }}
                style={{
                    height: 64,
                    backgroundColor: '#B52725',
                    borderRadius: 24,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 24,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.15,
                    shadowRadius: 10,
                    elevation: 10,
                }}
                activeOpacity={0.9}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>
                        {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                    </Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.9)' }}>
                        ₹{totalAmount} (estimated)
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF', marginRight: 8 }}>Proceed</Text>
                    <ChevronRight size={20} color="#FFFFFF" />
                </View>
            </TouchableOpacity>
        </View>
    );
}
