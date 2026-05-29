import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';
import { useStore } from '../../src/context/StoreContext';

export default function MainLayout() {
    const insets = useSafeAreaInsets();
    const bottomPadding = Math.max(insets.bottom, 12);
    const tabBarHeight = 70 + insets.bottom;

    // Register push token after successful auth (runs once on mount)
    usePushNotifications();

    // Defense-in-depth approval gate: only admin-approved merchants may reach the
    // main app. A draft/awaiting-approval merchant (Store.active=false) has a Store
    // row but must NOT be able to manage it or add inventory before completing +
    // paying for onboarding. index.tsx routes here too; this guard also catches
    // direct deep-links into protected tabs.
    const { store, loading, isApproved } = useStore();
    if (!loading && store && !isApproved) {
        return <Redirect href="/(auth)/pending" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E5E7EB',
                    height: tabBarHeight,
                    paddingBottom: bottomPadding,
                    paddingTop: 12,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '700',
                    marginTop: 4,
                },
                tabBarIconStyle: {
                    marginBottom: 2,
                }
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inventory"
                options={{
                    title: 'Inventory',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'cube' : 'cube-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'settings' : 'settings-outline'} size={22} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="catalog-picker"
                options={{
                    href: null,
                }}
            />
            <Tabs.Screen
                name="notifications"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
