// Main Tab Navigator: Bottom tabs (Home, Pickup, Dining, Cart) with redline effect.
import React from 'react';
import { View, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeFeedScreen from '../screens/HomeFeedScreen';
import DiningScreen from '../screens/DiningScreen';
import CartScreen from '../screens/CartScreen';
import HomeScreen from '../screens/HomeScreen';
import StorefrontScreen from '../screens/StorefrontScreen';
import CategoryDetailScreen from '../screens/CategoryDetailScreen';
import SpotlightDetailScreen from '../screens/SpotlightDetailScreen';
import DiningCheckoutScreen from '../screens/DiningCheckoutScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

export type MainTabParamList = {
    Home: undefined;
    Pickup: undefined;
    Dining: undefined;
    Cart: { selectedCoupon?: { code: string; discount: number } } | undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createNativeStackNavigator();
const PickupStack = createNativeStackNavigator();
const DiningStack = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();

function HomeStackNavigator() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen name="HomeMain" component={HomeScreen} />
            <HomeStack.Screen name="Storefront" component={StorefrontScreen} />
            <HomeStack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
            <HomeStack.Screen name="SpotlightDetail" component={SpotlightDetailScreen} />
        </HomeStack.Navigator>
    );
}

function PickupStackNavigator() {
    return (
        <PickupStack.Navigator screenOptions={{ headerShown: false }}>
            <PickupStack.Screen name="PickupMain" component={HomeFeedScreen} />
            <PickupStack.Screen name="Storefront" component={StorefrontScreen} />
            <PickupStack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
        </PickupStack.Navigator>
    );
}

function DiningStackNavigator() {
    return (
        <DiningStack.Navigator screenOptions={{ headerShown: false }}>
            <DiningStack.Screen name="DiningMain" component={DiningScreen} />
            <DiningStack.Screen name="Storefront" component={StorefrontScreen} />
            <DiningStack.Screen name="SpotlightDetail" component={SpotlightDetailScreen} />
        </DiningStack.Navigator>
    );
}

function CartStackNavigator() {
    return (
        <CartStack.Navigator screenOptions={{ headerShown: false }}>
            <CartStack.Screen name="CartMain" component={CartScreen} />
            <CartStack.Screen name="DiningCheckout" component={DiningCheckoutScreen} options={{ gestureEnabled: false }} />
            <CartStack.Screen name="Checkout" component={CheckoutScreen} options={{ gestureEnabled: false }} />
        </CartStack.Navigator>
    );
}

export default function MainTabNavigator() {
    const insets = useSafeAreaInsets();

    return (
        <Tab.Navigator
            backBehavior="history"
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarIcon: ({ color, size, focused }) => {
                    let iconSize = focused ? size + 2 : size;
                    if (route.name === 'Home') {
                        return (
                            <Image
                                source={require('../../assets/brand/logo_icon.png')}
                                style={{ width: iconSize + 16, height: iconSize + 16, marginTop: 10 }}
                                resizeMode="contain"
                                className={focused ? '' : 'opacity-40'}
                            />
                        );
                    }
                    if (route.name === 'Pickup') return <Ionicons name={focused ? "storefront" : "storefront-outline"} color={color} size={iconSize} />;
                    if (route.name === 'Dining') return <Ionicons name={focused ? "restaurant" : "restaurant-outline"} color={color} size={iconSize} />;
                    if (route.name === 'Cart') return <Ionicons name={focused ? "cart" : "cart-outline"} color={color} size={iconSize} />;
                    return null;
                },
                tabBarLabel: route.name === 'Home' ? () => null : undefined,
                tabBarActiveTintColor: '#B52725', // brand-red
                tabBarInactiveTintColor: '#A0AEC0',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    height: 60 + Math.max(insets.bottom, 15),
                    paddingBottom: Math.max(insets.bottom, 15),
                    paddingTop: 10,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -10 },
                    shadowOpacity: 0.05,
                    shadowRadius: 20,
                    borderTopWidth: 1,
                    borderTopColor: '#B52725',
                    position: 'absolute',
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '600',
                    marginTop: 4,
                }
            })}
        >
            <Tab.Screen name="Home" component={HomeStackNavigator} />
            <Tab.Screen name="Pickup" component={PickupStackNavigator} />
            <Tab.Screen name="Dining" component={DiningStackNavigator} />
            <Tab.Screen name="Cart" component={CartStackNavigator} />
        </Tab.Navigator>
    );
}
