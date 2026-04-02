import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { LocationProvider } from './src/context/LocationContext';
import { CartProvider } from './src/context/CartContext';
import { CategoryProvider } from './src/context/CategoryContext';

import { AuthProvider } from './src/context/AuthContext';

export const navigationRef = createNavigationContainerRef<any>();

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <CategoryProvider>
                    <LocationProvider>
                        <CartProvider>
                            <NavigationContainer ref={navigationRef}>
                                <RootNavigator />
                            </NavigationContainer>
                        </CartProvider>
                    </LocationProvider>
                </CategoryProvider>
            </AuthProvider>
        </SafeAreaProvider>
    );
}
