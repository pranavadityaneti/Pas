// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Main Tab Navigator: Bottom tabs (Home, Pickup, Dining, Cart) with redline effect.
import React from 'react';
import { View, Image } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Store, Utensils, ShoppingBag } from 'lucide-react-native';

import HomeFeedScreen from '../screens/HomeFeedScreen';
import DiningScreen from '../screens/DiningScreen';
import CartScreen from '../screens/CartScreen';
import HomeScreen from '../screens/HomeScreen';

export type MainTabParamList = {
    Home: undefined;
    Pickup: undefined;
    Dining: undefined;
    Cart: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
    return (
        <Tab.Navigator
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
                    if (route.name === 'Pickup') return <Store color={color} size={iconSize} fill={focused ? color : 'transparent'} />;
                    if (route.name === 'Dining') return <Utensils color={color} size={iconSize} fill={focused ? color : 'transparent'} />;
                    if (route.name === 'Cart') return <ShoppingBag color={color} size={iconSize} fill={focused ? color : 'transparent'} />;
                    return null;
                },
                tabBarLabel: route.name === 'Home' ? () => null : undefined,
                tabBarActiveTintColor: '#B52725', // brand-red
                tabBarInactiveTintColor: '#A0AEC0',
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopLeftRadius: 30,
                    borderTopRightRadius: 30,
                    height: 85,
                    paddingBottom: 25,
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
            <Tab.Screen name="Home" component={HomeScreen} />
            <Tab.Screen name="Pickup" component={HomeFeedScreen} />
            <Tab.Screen name="Dining" component={DiningScreen} />
            <Tab.Screen name="Cart" component={CartScreen} />
        </Tab.Navigator>
    );
}
