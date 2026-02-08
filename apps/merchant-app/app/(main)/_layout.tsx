import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

export default function MainLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: Colors.primary,
                tabBarInactiveTintColor: '#9CA3AF',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E5E7EB',
                    height: 85,
                    paddingTop: 12,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
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
