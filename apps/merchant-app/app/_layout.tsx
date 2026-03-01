import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider } from '../src/context/StoreContext';
import { NotificationProvider } from '../src/context/NotificationContext';
import { UserProvider } from '../src/context/UserContext';

import { DefaultTheme, ThemeProvider } from '@react-navigation/native';

export default function RootLayout() {
    console.log('[RootLayout] Rendering');
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <SafeAreaProvider>
                <ThemeProvider value={DefaultTheme}>
                    <UserProvider>
                        <StoreProvider>
                            <NotificationProvider>
                                <StatusBar style="dark" />
                                <Stack screenOptions={{ headerShown: false }}>
                                    <Stack.Screen name="(auth)" />
                                    <Stack.Screen name="(main)" />
                                </Stack>
                            </NotificationProvider>
                        </StoreProvider>
                    </UserProvider>
                </ThemeProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    );
}
