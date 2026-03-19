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

import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
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
            } catch (err) {
                console.warn(err);
            }
        };

        loadLocalData();

        // Listen for auth state changes (automatically triggers INITIAL_SESSION event)
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                if (!mounted) return;
                
                if (session) {
                    const pending = await SecureStore.getItemAsync('pending_profile_setup');
                    if (pending === 'true') {
                        setPendingProfileSetup(true);
                        // Removed: await SecureStore.deleteItemAsync('pending_profile_setup');
                        // ProfileSetupScreen must remove it when completed or skipped to prevent a race condition
                    } else {
                        setPendingProfileSetup(false);
                    }
                } else {
                    setPendingProfileSetup(false);
                }
                
                setSession(session);
                setIsLoading(false);
            }
        );

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []);

    if (isLoading) {
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
                </>
            )}
        </Stack.Navigator>
    );
}
