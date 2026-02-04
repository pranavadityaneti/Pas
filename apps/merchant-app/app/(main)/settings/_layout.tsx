import { Stack } from 'expo-router';

export default function SettingsLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                // Ensure the stack background is consistent
                contentStyle: { backgroundColor: '#F9FAFB' },
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="timings" />
            <Stack.Screen name="staff" />
            <Stack.Screen name="payouts" />
            <Stack.Screen name="earnings" />
            <Stack.Screen name="printer" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="support" />
            <Stack.Screen name="legal" />
            <Stack.Screen name="store-details" />
        </Stack>
    );
}
