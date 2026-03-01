// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Location Picker Screen: Interactive map + Google Places Autocomplete search.
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { ChevronLeft, MapPin, Target, Plus, Check, Search, X, Trash2, Edit2 } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useLocation } from '../context/LocationContext';
import Constants from 'expo-constants';

export default function LocationPickerScreen() {
    const navigation = useNavigation();
    const { activeLocation, refreshLocation, selectLocation } = useLocation();
    const [mapRegion, setMapRegion] = useState({
        latitude: 12.9716, // Default center
        longitude: 77.5946,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
    });
    const [currentPos, setCurrentPos] = useState<{ latitude: number, longitude: number } | null>(null);

    // Modal & Form State
    const [showModal, setShowModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [addressForm, setAddressForm] = useState({
        street: '',
        apt: '',
        city: '',
        state: '',
        pincode: '',
        type: 'Home' // Home, Work, Other
    });

    const [savedAddresses, setSavedAddresses] = useState<any[]>([]);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);

    // Search Mode State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isLocationConfirmed, setIsLocationConfirmed] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
    const [customType, setCustomType] = useState('');

    const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey
        || Constants.expoConfig?.ios?.config?.googleMapsApiKey
        || Constants.expoConfig?.android?.config?.googleMaps?.apiKey;

    const debounceTimer = useRef<any>(null);
    const hasInitiallyCentered = useRef(false);

    const searchPlaces = (query: string) => {
        setSearchQuery(query);
        setIsLocationConfirmed(false); // Reset button state if user modifies search

        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (query.length === 0) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        if (!GOOGLE_API_KEY) {
            console.error("Missing Google Maps API Key in app.json");
            return;
        }

        if (query.length > 2) {
            setIsSearching(true);
            debounceTimer.current = setTimeout(async () => {
                try {
                    const response = await fetch(
                        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=en&components=country:in`
                    );
                    const data = await response.json();
                    if (data.status === 'OK') {
                        setSearchResults(data.predictions);
                    } else {
                        setSearchResults([]);
                    }
                } catch (error) {
                    console.error("Places Array err: ", error);
                } finally {
                    setIsSearching(false);
                }
            }, 500);
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }
    };

    const handleSearchClear = () => {
        setSearchQuery('');
        setSearchResults([]);
        setIsLocationConfirmed(false);
        setIsSearching(false);
        Keyboard.dismiss();
    };

    const handlePlaceSelect = async (placeId: string, description: string) => {
        if (!GOOGLE_API_KEY) return;

        try {
            setIsSearching(true);
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,address_component&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.result.geometry) {
                const location = data.result.geometry.location;
                const coords = {
                    latitude: location.lat,
                    longitude: location.lng,
                };

                setCurrentPos(coords);
                setMapRegion({
                    ...mapRegion,
                    ...coords,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                });

                // Clear search and show "Confirm Location"
                setSearchQuery(description);
                setSearchResults([]);
                setIsSearchFocused(false);
                setIsLocationConfirmed(true);
                Keyboard.dismiss();

                // Parse address components for the modal precisely
                const components = data.result.address_components;
                let city = '';
                let state = '';
                let zip = '';
                let streetInfo = description.split(',')[0];

                components.forEach((c: any) => {
                    if (c.types.includes('locality')) city = c.long_name;
                    if (c.types.includes('administrative_area_level_1')) state = c.long_name;
                    if (c.types.includes('postal_code')) zip = c.long_name;
                });

                setAddressForm({
                    ...addressForm,
                    city,
                    state,
                    pincode: zip,
                    street: streetInfo,
                });
            }
        } catch (error) {
            console.error('Place Details error:', error);
            Alert.alert("Error", "Could not fetch details for this location.");
        } finally {
            setIsSearching(false);
        }
    };

    const handleSearchSubmit = async () => {
        if (!searchQuery.trim() || !GOOGLE_API_KEY) return;

        setIsSearching(true);
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchQuery)}&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results[0]?.geometry) {
                const location = data.results[0].geometry.location;
                const coords = {
                    latitude: location.lat,
                    longitude: location.lng,
                };

                setCurrentPos(coords);
                setMapRegion({
                    ...mapRegion,
                    ...coords,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                });

                setIsLocationConfirmed(true);
                setSearchResults([]);
                setIsSearchFocused(false);
                Keyboard.dismiss();

                // Populate form for the modal fallback
                const components = data.results[0].address_components;
                let city = '';
                let state = '';
                let zip = '';
                let streetInfo = searchQuery.split(',')[0];

                components.forEach((c: any) => {
                    if (c.types.includes('locality')) city = c.long_name;
                    if (c.types.includes('administrative_area_level_1')) state = c.long_name;
                    if (c.types.includes('postal_code')) zip = c.long_name;
                });

                setAddressForm({
                    ...addressForm,
                    city,
                    state,
                    pincode: zip,
                    street: streetInfo,
                });
            } else {
                Alert.alert("Location Not Found", "We couldn't find coordinates for that address. Please be more specific or pick a suggestion.");
            }
        } catch (error) {
            console.error('Geocoding error:', error);
            Alert.alert("Error", "Something went wrong while searching for that location.");
        } finally {
            setIsSearching(false);
        }
    };

    // Fetch addresses on mount and when modal closes
    useEffect(() => {
        fetchAddresses();
    }, [showModal]);

    const resetForm = () => {
        setAddressForm({
            street: '',
            apt: '',
            city: '',
            state: '',
            pincode: '',
            type: 'Home'
        });
        setCustomType('');
        setEditingAddressId(null);
    };

    // Request location once on initial mount
    useEffect(() => {
        if (!hasInitiallyCentered.current) {
            requestLocation();
            hasInitiallyCentered.current = true;
        }
    }, []);

    const fetchAddresses = async () => {
        try {
            setIsLoadingAddresses(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setSavedAddresses([]);
                return;
            }

            const { data, error } = await supabase
                .from('consumer_addresses')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSavedAddresses(data || []);
        } catch (error) {
            console.error('Error fetching addresses:', error);
        } finally {
            setIsLoadingAddresses(false);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            // Check if we are deleting the currently active location
            const addressToDelete = savedAddresses.find(a => a.id === id);
            const isActive = activeLocation?.address === addressToDelete?.address && activeLocation?.type === addressToDelete?.type;

            const { error } = await supabase.from('consumer_addresses').delete().eq('id', id);
            if (error) throw error;

            await fetchAddresses();

            if (isActive) {
                // If the active one was deleted, we must allow the GPS logic to take over again
                // We'll call refreshLocation which resets the smart binding
                await refreshLocation();
            } else {
                await refreshLocation(); // Still refresh proximity logic
            }
        } catch (error) {
            console.error('Error deleting address:', error);
            Alert.alert('Error', 'Could not delete address');
        }
    };

    const handleEdit = (address: any) => {
        setEditingAddressId(address.id);

        // Populate form by parsing the full address string:
        // format: "apt, street, city, state - pincode"
        const parts = address.address.split(', ');
        const statePart = parts[parts.length - 1] || '';
        const [state, pincode] = statePart.split(' - ');

        const isStandard = ['Home', 'Work'].includes(address.type);
        setAddressForm({
            apt: parts.length > 3 ? parts[0] : '',
            street: parts.length > 3 ? parts[1] : (parts[0] || ''),
            city: parts.length > 2 ? parts[parts.length - 2] : '',
            state: state || '',
            pincode: pincode || '',
            type: isStandard ? address.type : 'Other'
        });

        if (!isStandard) {
            setCustomType(address.type);
        }

        // Set Map
        const coords = {
            latitude: address.latitude,
            longitude: address.longitude,
        };
        setCurrentPos(coords);
        setMapRegion({
            ...mapRegion,
            ...coords,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        });

        setIsLocationConfirmed(true);
        setShowModal(true);
    };

    const handleSelectAddress = (loc: any) => {
        selectLocation({
            type: loc.type,
            address: loc.address,
            latitude: loc.latitude,
            longitude: loc.longitude
        });
        navigation.goBack();
    };

    const requestLocation = async () => {
        // ... previous code exactly the same below...

        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required to detect your address.');
                return;
            }

            Alert.alert('Detecting Location', 'Fetching your exact GPS coordinates...');

            const location = await Location.getCurrentPositionAsync({});
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };

            setCurrentPos(coords);
            setMapRegion({ ...mapRegion, ...coords });

            // Reverse Geocoding
            const geocodeCache = await Location.reverseGeocodeAsync(coords);
            if (geocodeCache.length > 0) {
                const place = geocodeCache[0];
                setAddressForm({
                    ...addressForm,
                    city: place.city || place.subregion || '',
                    state: place.region || '',
                    pincode: place.postalCode || '',
                    street: place.street || '',
                });

                // Populate search bar with current location so user knows it snapped
                setSearchQuery(`${place.street || place.name || ''}, ${place.city || place.subregion || ''}`);
                setIsLocationConfirmed(true);
            }

        } catch (error) {
            console.log('Location error', error);
            Alert.alert('Error', 'Could not detect your current location.');
        }
    };

    const handleSaveAddress = async () => {
        if (!addressForm.street) {
            Alert.alert('Required', 'Please enter your Street Address');
            return;
        }

        try {
            setIsSaving(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                Alert.alert('Login Required', 'You must be logged in to save addresses.');
                setIsSaving(false);
                return;
            }

            const finalType = addressForm.type === 'Other' ? customType || 'Other' : addressForm.type;
            const fullAddress = `${addressForm.apt ? addressForm.apt + ', ' : ''}${addressForm.street}, ${addressForm.city}, ${addressForm.state} - ${addressForm.pincode}`;

            const isDuplicate = savedAddresses.some(addr =>
                addr.type === finalType &&
                (finalType === 'Home' || finalType === 'Work') &&
                addr.id !== editingAddressId
            );

            if (isDuplicate) {
                Alert.alert(
                    `${finalType} Tag Already Saved`,
                    `You already have a "${finalType}" address. Please select a different tag or custom name.`
                );
                setIsSaving(false);
                return;
            }

            let result;
            if (editingAddressId) {
                result = await supabase.from('consumer_addresses').update({
                    type: finalType,
                    address: fullAddress,
                    latitude: currentPos?.latitude || mapRegion.latitude,
                    longitude: currentPos?.longitude || mapRegion.longitude
                }).eq('id', editingAddressId);
            } else {
                result = await supabase.from('consumer_addresses').insert({
                    user_id: user.id,
                    type: finalType,
                    address: fullAddress,
                    latitude: currentPos?.latitude || mapRegion.latitude,
                    longitude: currentPos?.longitude || mapRegion.longitude
                });
            }

            if (result.error) throw result.error;

            Alert.alert('Success', editingAddressId ? 'Address updated successfully!' : 'Address saved successfully!');
            setShowModal(false);
            resetForm();

            // To fetch the new list of addresses we will query Supabase in the next tick
            // and we MUST refresh the global context so the Home Header recalculates distance
            await refreshLocation();

        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', error.message || 'Failed to save address');
        } finally {
            setIsSaving(false);
        }
    };
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-1 bg-white">
            {/* Header */}
            <View
                style={{ paddingTop: Math.max(insets.top, 20) }}
                className="bg-white z-10 border-b border-gray-100 pb-2"
            >
                <View className="px-4 flex-row items-center justify-between">
                    <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2">
                        <ChevronLeft color="#121212" size={24} />
                    </TouchableOpacity>
                    <Text className="font-bold text-lg text-black-shadow">Select Location</Text>
                    <View style={{ width: 24 }} />
                </View>
            </View>

            {/* Map Area */}
            <View className="h-[40%] bg-gray-200 relative">
                <MapView
                    provider={PROVIDER_GOOGLE}
                    style={StyleSheet.absoluteFillObject}
                    region={mapRegion}
                    showsUserLocation={true}
                    onTouchStart={() => {
                        setIsSearchFocused(false);
                        Keyboard.dismiss();
                    }}
                >
                    {currentPos && (
                        <Marker coordinate={currentPos} />
                    )}
                </MapView>

                {/* Floating Search Bar Overlay */}
                <View className="absolute top-4 left-4 right-4 z-20" style={{ elevation: 5 }}>
                    <View className="flex-row items-center bg-white px-4 h-12 rounded-xl shadow-md border border-gray-100">
                        <Search size={18} color="#B52725" />
                        <TextInput
                            className="flex-1 ml-3 font-medium text-black"
                            style={{ paddingVertical: 0, height: 20, lineHeight: 20, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                            placeholder="Search area, street, or building..."
                            placeholderTextColor="#9CA3AF"
                            value={searchQuery}
                            onChangeText={searchPlaces}
                            onFocus={() => setIsSearchFocused(true)}
                            onSubmitEditing={handleSearchSubmit}
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={handleSearchClear} className="mx-2">
                                <X size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                        {isSearching && <ActivityIndicator size="small" color="#B52725" />}
                    </View>

                    {/* Autocomplete Results */}
                    {isSearchFocused && searchResults.length > 0 && (
                        <View className="bg-white mt-2 rounded-xl shadow-lg border border-gray-100 max-h-56 overflow-hidden">
                            <ScrollView keyboardShouldPersistTaps="handled">
                                {searchResults.map((item, index) => (
                                    <TouchableOpacity
                                        key={item.place_id}
                                        className={`p-4 flex-row items-center ${index < searchResults.length - 1 ? 'border-b border-gray-100' : ''}`}
                                        onPress={() => handlePlaceSelect(item.place_id, item.description)}
                                    >
                                        <View className="w-8 h-8 rounded-full bg-red-50 items-center justify-center mr-3">
                                            <MapPin size={14} color="#B52725" />
                                        </View>
                                        <View className="flex-1 pr-2">
                                            <Text className="font-bold text-gray-800" numberOfLines={1}>
                                                {item.structured_formatting?.main_text || item.description.split(',')[0]}
                                            </Text>
                                            {item.structured_formatting?.secondary_text && (
                                                <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
                                                    {item.structured_formatting.secondary_text}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Floating Bottom Button */}
                <View className="absolute bottom-4 left-4 right-4 items-center mb-2">
                    {!isLocationConfirmed ? (
                        <TouchableOpacity
                            onPress={requestLocation}
                            className="bg-location-yellow px-6 py-3 rounded-full flex-row items-center space-x-2 shadow-sm border border-[#D4A017]/20"
                        >
                            <Target color="#000" size={18} />
                            <Text className="font-bold text-sm text-black">Use Current Location</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            onPress={() => setShowModal(true)}
                            className="bg-location-yellow px-6 py-3 rounded-full flex-row items-center space-x-2 shadow-sm border border-[#D4A017]/20"
                        >
                            <Check color="#000" size={18} />
                            <Text className="font-bold text-sm text-black">Confirm Location</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Address List */}
            <ScrollView className="flex-1 px-5 pt-6 bg-white">
                <Text className="font-bold text-lg text-black-shadow mb-4">Saved Addresses</Text>

                {isLoadingAddresses ? (
                    <View className="py-8 items-center justify-center">
                        <ActivityIndicator color="#B52725" size="large" />
                    </View>
                ) : savedAddresses.length === 0 ? (
                    <View className="py-8 items-center justify-center">
                        <MapPin size={48} color="#D1D5DB" />
                        <Text className="text-gray-500 mt-4 text-center font-medium">No saved addresses yet.</Text>
                        <Text className="text-sm text-gray-400 mt-1 text-center">Add a location below to get started.</Text>
                    </View>
                ) : (
                    savedAddresses.map((loc) => {
                        const isActive = activeLocation?.address === loc.address && activeLocation?.type === loc.type;
                        return (
                            <TouchableOpacity
                                key={loc.id}
                                onPress={() => handleSelectAddress(loc)}
                                className={`flex-row items-center py-4 border-b border-gray-100 px-2 rounded-xl ${isActive ? 'bg-red-50/50 border-red-100' : ''}`}
                            >
                                <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isActive ? 'bg-[#B52725]' : 'bg-gray-50'}`}>
                                    <MapPin size={20} color={isActive ? '#FFF' : '#B52725'} />
                                </View>
                                <View className="flex-1 pr-4">
                                    <View className="flex-row items-center">
                                        <Text className={`font-bold text-base ${isActive ? 'text-[#B52725]' : 'text-black-shadow'}`}>{loc.type}</Text>
                                        {isActive && (
                                            <View className="ml-2 bg-[#B52725] rounded-full p-0.5">
                                                <Check size={10} color="#FFF" />
                                            </View>
                                        )}
                                    </View>
                                    <Text className="text-sm text-gray-500 mt-1 leading-5" numberOfLines={2}>{loc.address}</Text>
                                </View>
                                <View className="flex-row items-center space-x-2">
                                    <TouchableOpacity
                                        onPress={() => handleEdit(loc)}
                                        className="p-2 bg-gray-50 rounded-full"
                                    >
                                        <Edit2 size={16} color="#4B5563" />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => handleDelete(loc.id)}
                                        className="p-2 bg-red-50 rounded-full"
                                    >
                                        <Trash2 size={16} color="#B52725" />
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}

                <TouchableOpacity
                    onPress={() => {
                        resetForm();
                        setShowModal(true);
                    }}
                    className="flex-row items-center justify-center py-4 mt-6 border border-dashed border-gray-300 rounded-2xl mb-10"
                >
                    <Plus size={20} color="#B52725" />
                    <Text className="font-bold text-[#B52725] ml-2">Add New Address</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Address Setup Modal */}
            <Modal
                visible={showModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-end bg-black/40"
                >
                    <View className="bg-white rounded-t-3xl pt-6 pb-10 px-6 max-h-[90%]">
                        <View className="flex-row justify-between items-center mb-6">
                            <Text className="font-bold text-xl text-black">Address Details</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)} className="p-2">
                                <Text className="font-bold text-gray-400">Cancel</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
                            {/* Tags */}
                            <Text className="font-bold text-sm text-gray-500 mb-3">Save As</Text>
                            <View className="flex-row space-x-3 mb-6">
                                {['Home', 'Work', 'Other'].map(type => {
                                    const isTaken = (type === 'Home' || type === 'Work') && savedAddresses.some(a => a.type === type);
                                    return (
                                        <TouchableOpacity
                                            key={type}
                                            onPress={() => setAddressForm({ ...addressForm, type })}
                                            className={`px-6 py-2 rounded-full border ${addressForm.type === type ? 'border-[#B52725] bg-red-50' : 'border-gray-200 bg-white'} ${isTaken ? 'opacity-50' : ''}`}
                                        >
                                            <View className="flex-row items-center">
                                                <Text className={`font-bold ${addressForm.type === type ? 'text-[#B52725]' : 'text-gray-600'}`}>
                                                    {type}
                                                </Text>
                                                {isTaken && <View className="ml-1 w-1.5 h-1.5 rounded-full bg-gray-400" />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {addressForm.type === 'Other' && (
                                <View className="mb-6">
                                    <Text className="font-bold text-sm text-gray-500 mb-2">Custom Name</Text>
                                    <TextInput
                                        className="w-full bg-gray-50 px-4 h-14 rounded-xl border border-gray-200 font-medium text-black"
                                        placeholder="e.g. Gym, Cafe, Parents"
                                        value={customType}
                                        onChangeText={setCustomType}
                                        style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                    />
                                </View>
                            )}

                            {/* Form Fields */}
                            <View className="space-y-4">
                                <View>
                                    <Text className="font-bold text-sm text-gray-500 mb-2">Street Address <Text className="text-[#B52725]">*</Text></Text>
                                    <TextInput
                                        className="w-full bg-gray-50 px-4 h-14 rounded-xl border border-gray-200 font-medium text-black"
                                        placeholder="House No, Building, Street"
                                        value={addressForm.street}
                                        onChangeText={(t) => setAddressForm({ ...addressForm, street: t })}
                                        style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                    />
                                </View>

                                <View>
                                    <Text className="font-bold text-sm text-gray-500 mb-2">APT, Floor, Landmark (Optional)</Text>
                                    <TextInput
                                        className="w-full bg-gray-50 px-4 h-14 rounded-xl border border-gray-200 font-medium text-black"
                                        placeholder="e.g. 1st Floor, Near Park"
                                        value={addressForm.apt}
                                        onChangeText={(t) => setAddressForm({ ...addressForm, apt: t })}
                                        style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                    />
                                </View>

                                <View className="flex-row space-x-4">
                                    <View className="flex-1">
                                        <Text className="font-bold text-sm text-gray-500 mb-2">City</Text>
                                        <TextInput
                                            className="w-full bg-gray-100 px-4 h-14 rounded-xl border border-gray-200 font-medium text-gray-500"
                                            value={addressForm.city}
                                            editable={false}
                                            style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="font-bold text-sm text-gray-500 mb-2">Pincode</Text>
                                        <TextInput
                                            className="w-full bg-gray-100 px-4 h-14 rounded-xl border border-gray-200 font-medium text-gray-500"
                                            value={addressForm.pincode}
                                            editable={false}
                                            style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                        />
                                    </View>
                                </View>

                                <View>
                                    <Text className="font-bold text-sm text-gray-500 mb-2">State</Text>
                                    <TextInput
                                        className="w-full bg-gray-100 px-4 h-14 rounded-xl border border-gray-200 font-medium text-gray-500"
                                        value={addressForm.state}
                                        editable={false}
                                        style={{ paddingVertical: 0, height: 24, lineHeight: 24, textAlignVertical: 'center', includeFontPadding: false, top: 1 }}
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* Save Button */}
                        <TouchableOpacity
                            onPress={handleSaveAddress}
                            disabled={isSaving}
                            className={`w-full py-4 rounded-2xl flex-row justify-center items-center shadow-sm ${isSaving ? 'bg-gray-400' : 'bg-[#B52725]'}`}
                        >
                            {isSaving ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <>
                                    <Text className="font-bold text-white text-lg mr-2">Save Address</Text>
                                    <Check color="white" size={20} />
                                </>
                            )}
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </Modal >
        </View >
    );
}
