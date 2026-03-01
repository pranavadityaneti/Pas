import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { LocationProvider } from './src/context/LocationContext';
import { CartProvider } from './src/context/CartContext';

export default function App() {
    return (
        <SafeAreaProvider>
            <LocationProvider>
                <CartProvider>
                    <NavigationContainer>
                        <RootNavigator />
                    </NavigationContainer>
                </CartProvider>
            </LocationProvider>
        </SafeAreaProvider>
    );
}
