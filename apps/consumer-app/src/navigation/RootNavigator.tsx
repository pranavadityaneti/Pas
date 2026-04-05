// @lock — Do NOT overwrite. Approved layout as of Mar 12, 2026.
// Root Navigator: Auth-aware stack navigator with session-based routing.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';

import MainTabNavigator from './MainTabNavigator';
import StorefrontScreen from '../screens/StorefrontScreen';
import LocationPickerScreen from '../screens/LocationPickerScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import DiningCheckoutScreen from '../screens/DiningCheckoutScreen';
import OffersScreen from '../screens/OffersScreen';
import SpotlightDetailScreen from '../screens/SpotlightDetailScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import YourOrdersScreen from '../screens/YourOrdersScreen';
import CartScreen from '../screens/CartScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import PaymentMethodsScreen from '../screens/PaymentMethodsScreen';
import SupportScreen from '../screens/SupportScreen';
import AddPaymentMethodScreen from '../screens/AddPaymentMethodScreen';
import WaitingRoomScreen from '../screens/WaitingRoomScreen';
import PaymentScreen from '../screens/PaymentScreen';
import SwapScreen from '../screens/SwapScreen';
import { RootStackParamList } from './types';

import { useAuth } from '../context/AuthContext';

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

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!session ? (
                <>
                    {!hasSeenOnboarding && (
                        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
                    )}
                    <Stack.Screen name="Auth" component={AuthScreen} />
                    <Stack.Screen name="Main" component={MainTabNavigator} />
                    <Stack.Screen name="Storefront" component={StorefrontScreen} />
                    <Stack.Screen name="Checkout" component={CheckoutScreen} />
                    <Stack.Screen name="DiningCheckout" component={DiningCheckoutScreen} />
                    <Stack.Screen name="Offers" component={OffersScreen} />
                    <Stack.Screen name="SpotlightDetail" component={SpotlightDetailScreen} />
                    <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
                    <Stack.Screen name="YourOrders" component={YourOrdersScreen} />
                    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ presentation: 'fullScreenModal' }} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="Favorites" component={FavoritesScreen} />
                    <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
                    <Stack.Screen name="Support" component={SupportScreen} />
                    <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} />
                    <Stack.Screen name="WaitingRoomScreen" component={WaitingRoomScreen} />
                    <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
                    <Stack.Screen name="SwapScreen" component={SwapScreen} />
                </>
            ) : (
                <>
                    {pendingProfileSetup ? (
                        <>
                            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                            <Stack.Screen name="Main" component={MainTabNavigator} />
                        </>
                    ) : (
                        <>
                            <Stack.Screen name="Main" component={MainTabNavigator} />
                            <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
                        </>
                    )}
                    <Stack.Screen name="Storefront" component={StorefrontScreen} />
                    <Stack.Screen name="Checkout" component={CheckoutScreen} />
                    <Stack.Screen name="DiningCheckout" component={DiningCheckoutScreen} />
                    <Stack.Screen name="Offers" component={OffersScreen} />
                    <Stack.Screen name="SpotlightDetail" component={SpotlightDetailScreen} />
                    <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
                    <Stack.Screen name="YourOrders" component={YourOrdersScreen} />
                    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ presentation: 'fullScreenModal' }} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                    <Stack.Screen name="Favorites" component={FavoritesScreen} />
                    <Stack.Screen name="Support" component={SupportScreen} />
                    <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
                    <Stack.Screen name="AddPaymentMethod" component={AddPaymentMethodScreen} />
                    <Stack.Screen name="WaitingRoomScreen" component={WaitingRoomScreen} />
                    <Stack.Screen name="PaymentScreen" component={PaymentScreen} />
                    <Stack.Screen name="SwapScreen" component={SwapScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}
