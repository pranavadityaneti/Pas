import 'react-native-url-polyfill/auto';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
    console.log('[RootLayout] Rendering');
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(main)" />
            </Stack>
        </GestureHandlerRootView>
    );
}
