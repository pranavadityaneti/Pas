// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
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
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import ConfirmPreOrderScreen from '../screens/ConfirmPreOrderScreen';
import OffersScreen from '../screens/OffersScreen';

import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
    const [isLoading, setIsLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
    const [isProfileIncomplete, setIsProfileIncomplete] = useState(false);
    const [isCheckingProfile, setIsCheckingProfile] = useState(false);

    useEffect(() => {
        setupApp();

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (_event, session) => {
                setSession(session);
                if (session) {
                    await checkProfileStatus(session.user.id);
                } else {
                    setIsProfileIncomplete(false);
                }
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const setupApp = async () => {
        try {
            const { data } = await supabase.auth.getSession();
            setSession(data.session);

            const seen = await SecureStore.getItemAsync('has_seen_onboarding');
            if (seen === 'true') {
                setHasSeenOnboarding(true);
            }

            if (data.session) {
                await checkProfileStatus(data.session.user.id);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const checkProfileStatus = async (userId: string) => {
        try {
            setIsCheckingProfile(true);
            const { data, error } = await supabase
                .from('profiles')
                .select('full_name, date_of_birth')
                .eq('id', userId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
                if (error.code === '42703') {
                    console.warn('Database schema out of sync: profiles.date_of_birth missing. Please run migrations.');
                } else {
                    console.error('Profile check error:', error);
                }
                return;
            }

            if (!data || !data.full_name || !data.date_of_birth) {
                setIsProfileIncomplete(true);
            } else {
                setIsProfileIncomplete(false);
            }
        } catch (err) {
            console.error('Catch error checkProfile:', err);
        } finally {
            setIsCheckingProfile(false);
        }
    };

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
                    <Stack.Screen name="ConfirmPreOrder" component={ConfirmPreOrderScreen} />
                    <Stack.Screen name="Offers" component={OffersScreen} />
                    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ presentation: 'fullScreenModal' }} />
                </>
            ) : isProfileIncomplete ? (
                <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
            ) : (
                <>
                    <Stack.Screen name="Main" component={MainTabNavigator} />
                    <Stack.Screen name="Storefront" component={StorefrontScreen} />
                    <Stack.Screen name="ConfirmPreOrder" component={ConfirmPreOrderScreen} />
                    <Stack.Screen name="Offers" component={OffersScreen} />
                    <Stack.Screen name="LocationPicker" component={LocationPickerScreen} options={{ presentation: 'fullScreenModal' }} />
                    <Stack.Screen name="Profile" component={ProfileScreen} />
                </>
            )}
        </Stack.Navigator>
    );
}
