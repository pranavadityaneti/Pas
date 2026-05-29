import 'react-native-url-polyfill/auto';
import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { LocationProvider } from './src/context/LocationContext';
import { CartProvider } from './src/context/CartContext';
import { CategoryProvider } from './src/context/CategoryContext';

import { AuthProvider } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ToastContainer } from './src/components/NotificationToast';
import { navigationRef } from './src/navigation/navigationRef';
import PushNotificationRegistrar from './src/components/PushNotificationRegistrar';

export default function App() {
    return (
        <SafeAreaProvider>
            <AuthProvider>
                <PushNotificationRegistrar />
                <NotificationProvider>
                    <CategoryProvider>
                        <LocationProvider>
                            <CartProvider>
                                <NavigationContainer ref={navigationRef}>
                                    <RootNavigator />
                                </NavigationContainer>
                            </CartProvider>
                        </LocationProvider>
                    </CategoryProvider>
                </NotificationProvider>
            </AuthProvider>
            {/* Mounted once at root; module-level ref lets useNotifications() fire it. */}
            <ToastContainer />
        </SafeAreaProvider>
    );
}
