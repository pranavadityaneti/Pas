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
                    height: 70, // Tighter height
                    paddingTop: 10,
                    paddingBottom: 10,  // Reduced padding
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '600',
                },
            }}
        >
            <Tabs.Screen
                name="dashboard"
                options={{
                    title: 'Dashboard',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders"
                options={{
                    title: 'Orders',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'receipt' : 'receipt-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="inventory"
                options={{
                    title: 'Inventory',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'cube' : 'cube-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ color, focused }) => (
                        <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="catalog-picker"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}
