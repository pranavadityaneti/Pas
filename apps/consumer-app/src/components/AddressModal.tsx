import React, { useState, useRef, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, ActivityIndicator, Alert, Keyboard, Dimensions } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { Search, MapPin, X, Target, Check, ChevronLeft } from 'lucide-react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';

interface AddressModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (address: { address: string, latitude: number, longitude: number }) => void;
}

export default function AddressModal({ visible, onClose, onSelect }: AddressModalProps) {
    const [mapRegion, setMapRegion] = useState({
        latitude: 12.9716, // Bangalore
        longitude: 77.5946,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    });
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
    const [isConfirmed, setIsConfirmed] = useState(false);
    const debounceTimer = useRef<any>(null);

    const GOOGLE_API_KEY = Constants.expoConfig?.extra?.googleMapsApiKey
        || Constants.expoConfig?.ios?.config?.googleMapsApiKey
        || Constants.expoConfig?.android?.config?.googleMaps?.apiKey;

    useEffect(() => {
        if (visible) {
            requestCurrentLocation();
        }
    }, [visible]);

    const requestCurrentLocation = async () => {
        try {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please enable location permissions in your settings to use this feature.');
                return;
            }

            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
            const coords = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            };
            setMapRegion({
                ...mapRegion,
                ...coords,
            });
            reverseGeocode(coords.latitude, coords.longitude);
        } catch (error) {
            console.warn('Error fetching location:', error);
        }
    };

    const reverseGeocode = async (lat: number, lng: number) => {
        if (!GOOGLE_API_KEY) return;
        setIsSearching(true);
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();
            if (data.status === 'OK' && data.results.length > 0) {
                const address = data.results[0].formatted_address;
                setSelectedAddress(address);
                setSearchQuery(address);
                setIsConfirmed(true);
            }
        } catch (error) {
            console.error('Reverse Geocode error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const searchPlaces = (query: string) => {
        setSearchQuery(query);
        setIsConfirmed(false);

        if (debounceTimer.current) clearTimeout(debounceTimer.current);

        if (query.length < 3) {
            setSearchResults([]);
            return;
        }

        debounceTimer.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(
                    `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&language=en&components=country:in`
                );
                const data = await response.json();
                if (data.status === 'OK') {
                    setSearchResults(data.predictions);
                } else {
                    setSearchResults([{ id: 'no-results', description: 'No results found' }]);
                }
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                setIsSearching(false);
            }
        }, 500);
    };

    const handlePlaceSelect = async (placeId: string, description: string) => {
        if (placeId === 'no-results') return;
        setIsSearching(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_API_KEY}`
            );
            const data = await response.json();
            if (data.status === 'OK' && data.result.geometry) {
                const { lat, lng } = data.result.geometry.location;
                const coords = { latitude: lat, longitude: lng };
                setMapRegion({ ...mapRegion, ...coords });
                setSelectedAddress(description);
                setSearchQuery(description);
                setSearchResults([]);
                setIsConfirmed(true);
                Keyboard.dismiss();
            }
        } catch (error) {
            console.error('Place Details error:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleConfirm = () => {
        if (selectedAddress) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onSelect({
                address: selectedAddress,
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude
            });
            onClose();
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View className="flex-1 bg-white">
                {/* Header */}
                <View className="flex-row items-center px-4 py-4 border-b border-gray-100 bg-white z-10">
                    <TouchableOpacity onPress={onClose} className="p-2 -ml-2">
                        <X size={24} color="#000" />
                    </TouchableOpacity>
                    <Text className="text-lg font-bold ml-2">Select Primary Address</Text>
                </View>

                {/* Search Bar Floating */}
                <View className="absolute top-[80px] left-5 right-5 z-20">
                    <View className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <View className="flex-row items-center px-4 h-14">
                            <Search size={20} color="#9CA3AF" />
                            <TextInput
                                className="flex-1 ml-3 font-semibold text-gray-800"
                                placeholder="Search building, area or street..."
                                value={searchQuery}
                                onChangeText={searchPlaces}
                            />
                            {(searchQuery.length > 0 || isSearching) && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    {isSearching ? <ActivityIndicator size="small" color="#B52725" /> : <X size={18} color="#9CA3AF" />}
                                </TouchableOpacity>
                            )}
                        </View>

                        {searchResults.length > 0 && (
                            <View className="bg-white border-t border-gray-50 max-h-[300px]">
                                {searchResults.map((item) => (
                                    <TouchableOpacity
                                        key={item.place_id || item.id}
                                        onPress={() => handlePlaceSelect(item.place_id, item.description)}
                                        className="flex-row items-center px-4 py-4 border-b border-gray-50"
                                    >
                                        <MapPin size={18} color={item.id === 'no-results' ? '#EF4444' : '#9CA3AF'} />
                                        <View className="ml-3 flex-1">
                                            <Text className={`text-sm font-bold ${item.id === 'no-results' ? 'text-gray-400 font-medium' : 'text-gray-800'}`} numberOfLines={1}>
                                                {item.structured_formatting?.main_text || item.description}
                                            </Text>
                                            {item.structured_formatting?.secondary_text && (
                                                <Text className="text-[11px] text-gray-500" numberOfLines={1}>
                                                    {item.structured_formatting.secondary_text}
                                                </Text>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                </View>

                {/* Map */}
                <View className="flex-1">
                    <MapView
                        provider={PROVIDER_GOOGLE}
                        className="w-full h-full"
                        region={mapRegion}
                        onRegionChangeComplete={(region: any) => {
                            setMapRegion(region);
                            if (!isSearching && !isConfirmed) {
                                reverseGeocode(region.latitude, region.longitude);
                            }
                        }}
                        onRegionChange={() => {
                            if (isConfirmed) setIsConfirmed(false);
                        }}
                    />

                    {/* Fixed Marker in Center */}
                    <View className="absolute top-1/2 left-1/2 -ml-6 -mt-12 pointer-events-none">
                        <MapPin size={48} color="#B52725" fill="#B52725" />
                        <View className="w-2 h-2 rounded-full bg-black/20 self-center -mt-1" />
                    </View>

                    {/* Locate Me Button */}
                    <TouchableOpacity
                        onPress={requestCurrentLocation}
                        className="absolute bottom-[220px] right-5 w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg border border-gray-100"
                    >
                        <Target size={24} color="#B52725" />
                    </TouchableOpacity>
                </View>

                {/* Bottom Sheet Action */}
                <View className="bg-white p-6 shadow-2xl rounded-t-[32px] border-t border-gray-100">
                    <View className="flex-row items-center mb-4">
                        <MapPin size={24} color="#B52725" strokeWidth={2.5} />
                        <View className="ml-3 flex-1">
                            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Location</Text>
                            <Text className="text-sm font-bold text-gray-800" numberOfLines={2}>
                                {selectedAddress || (isSearching ? 'Fetching address...' : 'Move map to select')}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={!isConfirmed || isSearching}
                        className={`h-16 rounded-2xl items-center justify-center shadow-md ${(!isConfirmed || isSearching) ? 'bg-gray-200' : 'bg-[#B52725]'}`}
                    >
                        {isSearching ? (
                            <ActivityIndicator color="#FFF" />
                        ) : (
                            <View className="flex-row items-center">
                                <Text className="text-white font-bold text-lg mr-2">Confirm Location</Text>
                                <Check size={20} color="#FFF" strokeWidth={3} />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
