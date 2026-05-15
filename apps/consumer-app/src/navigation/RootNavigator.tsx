// Root Navigator: Guest-friendly stack — Main feed always accessible.
// Apple Guideline 5.1.1(v): Auth is deferred to transactional moments only.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';

import MainTabNavigator from './MainTabNavigator';
import StorefrontScreen from '../screens/StorefrontScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import OffersScreen from '../screens/OffersScreen';
import SpotlightDetailScreen from '../screens/SpotlightDetailScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import YourOrdersScreen from '../screens/YourOrdersScreen';
import CartScreen from '../screens/CartScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import SupportScreen from '../screens/SupportScreen';
import AddPaymentMethodScreen from '../screens/AddPaymentMethodScreen';
import SwapScreen from '../screens/SwapScreen';
import { RootStackParamList } from './types';
import { useAuth } from '../context/AuthContext';
import FloatingCartBand from '../components/FloatingCartBand';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const { session, isLoading: authLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(true);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
    const [pendingProfileSetup, setPendingProfileSetup] = useState(false);

    useEffect(() => {
        let mounted = true;

        const loadLocalData = async () => {
            try {
                const seen = await SecureStore.getItemAsync('has_seen_onboarding');
                if (mounted && seen === 'true') {
                    setHasSeenOnboarding(true);
                }
                
                // Track pending profile setup status from SecureStore
                if (session) {
                    const pending = await SecureStore.getItemAsync('pending_profile_setup');
                    setPendingProfileSetup(pending === 'true');
                } else {
                    setPendingProfileSetup(false);
                }
                
            } catch (err) {
                console.warn(err);
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        if (!authLoading) {
            loadLocalData();
        }

        return () => {
            mounted = false;
        };
    }, [authLoading, session]);

    if (isLoading || authLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-white">
                <ActivityIndicator size="large" color="#B52725" />
            </View>
        );
    }

    // Determine initial route: Onboarding (first launch) → ProfileSetup (new user) → Main (default)
    const getInitialRoute = (): keyof RootStackParamList => {
        if (!hasSeenOnboarding) return 'Onboarding';
        if (session && pendingProfileSetup) return 'ProfileSetup';
        return 'Main';
    };

    return (
        <>
            <Stack.Navigator
                initialRouteName={getInitialRoute()}
                screenOptions={{ headerShown: false }}
            >
                {/* Onboarding — shown only on first launch */}
                <Stack.Screen name="Onboarding" component={OnboardingScreen} />

                {/* Main feed — ALWAYS accessible, even as guest */}
                <Stack.Screen name="Main" component={MainTabNavigator} />

                {/* Auth — navigable screen, NOT a gate */}
                <Stack.Screen name="Auth" component={AuthScreen} options={{ presentation: 'modal' }} />

                {/* Browsable screens — no session required */}
                <Stack.Screen name="Storefront" component={StorefrontScreen} />
                <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
                <Stack.Screen name="SpotlightDetail" component={SpotlightDetailScreen} />
                <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ presentation: 'fullScreenModal' }} />

                {/* Auth-gated screens — individual screens handle auth checks */}
                <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                <Stack.Screen name="Offers" component={OffersScreen} />
                <Stack.Screen name="YourOrders" component={YourOrdersScreen} />
                <Stack.Screen name="Favorites" component={FavoritesScreen} />
                <Stack.Screen name="Support" component={SupportScreen} />
                <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
                <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} />
                <Stack.Screen name="SwapScreen" component={SwapScreen} />
                <Stack.Screen name="Cart" component={CartScreen} />
            </Stack.Navigator>
            <FloatingCartBand />
        </>
    );
}
