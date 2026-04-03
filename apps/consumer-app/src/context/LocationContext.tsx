// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Location Context: Haversine proximity detection + address management.
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { Alert } from 'react-native';

interface DeliveryLocation {
    type: string;
    address: string;
    latitude?: number;
    longitude?: number;
}

interface LocationContextType {
    activeLocation: DeliveryLocation | null;
    isLoadingLocation: boolean;
    permissionDenied: boolean;
    refreshLocation: () => Promise<void>;
    selectLocation: (location: DeliveryLocation) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

// Math utility to calculate straight-line distance between two GPS coordinates
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export const LocationProvider = ({ children }: { children: ReactNode }) => {
    const [activeLocation, setActiveLocation] = useState<DeliveryLocation | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isManualSelection, setIsManualSelection] = useState(false);
    const lastRefreshTime = useRef<number>(0);
    const isRefreshing = useRef<boolean>(false);

    const selectLocation = (location: DeliveryLocation) => {
        setIsManualSelection(true);
        setActiveLocation(location);
    };

    const refreshLocation = async (passedUser?: any) => {
        if (isManualSelection) {
            console.log("Skipping auto-refresh due to manual selection");
            return;
        }

        // --- Rate Limit Guard ---
        const now = Date.now();
        if (isRefreshing.current || (now - lastRefreshTime.current < 3000)) {
            console.log("Debouncing location refresh - too frequent");
            return;
        }

        try {
            isRefreshing.current = true;
            lastRefreshTime.current = now;
            setIsLoadingLocation(true);

            // 1. Get User Session
            let user = passedUser;
            if (user === undefined) {
                const { data } = await supabase.auth.getUser();
                user = data.user;
            }

            // 2. Request GPS Permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermissionDenied(true);
                setIsLoadingLocation(false);
                return;
            }
            setPermissionDenied(false);

            // 3. Ping Live GPS
            // Try last known first for snappiness
            const lastKnown = await Location.getLastKnownPositionAsync({});
            if (lastKnown && !activeLocation) {
                // If we don't have a location yet, use the last known one temporarily
                // This prevents the "not found" state while waiting for fresh GPS
                const lastLat = lastKnown.coords.latitude;
                const lastLon = lastKnown.coords.longitude;
                // (Don't return, keep going to get fresh High accuracy)
            }

            const locationConfig = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High
            });
            const currentLat = locationConfig.coords.latitude;
            const currentLon = locationConfig.coords.longitude;

            // 4. If logged in, check saved addresses for proximity
            if (user) {
                const { data: addresses, error } = await supabase
                    .from('consumer_addresses')
                    .select('*')
                    .eq('user_id', user.id);

                if (!error && addresses && addresses.length > 0) {
                    let closestAddress = null;
                    let minDistance = Infinity;

                    // Find closest address
                    for (const addr of addresses) {
                        if (addr.latitude && addr.longitude) {
                            const dist = getDistanceFromLatLonInKm(currentLat, currentLon, addr.latitude, addr.longitude);
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestAddress = addr;
                            }
                        }
                    }

                    // 5km threshold match
                    if (closestAddress && minDistance <= 5) {
                        setActiveLocation({
                            type: closestAddress.type, // 'Home', 'Work', etc.
                            address: closestAddress.address,
                            latitude: closestAddress.latitude,
                            longitude: closestAddress.longitude,
                        });
                        setIsLoadingLocation(false);
                        return; // Successfully bound to a saved address, exit early!
                    }
                }
            }

            // 5. Fallback: Reverse Geocode the Live GPS if no saved addresses are nearby or user is logged out
            try {
                const geocodeCache = await Location.reverseGeocodeAsync({ latitude: currentLat, longitude: currentLon });
                if (geocodeCache.length > 0) {
                    const place = geocodeCache[0];
                    let fallbackAddress = '';

                    if (place.street) {
                        fallbackAddress = `${place.street}, ${place.city || place.subregion}`;
                    } else if (place.name) {
                        fallbackAddress = `${place.name}, ${place.city || place.subregion}`;
                    } else {
                        fallbackAddress = `${place.city || place.subregion}, ${place.region}`;
                    }

                    setActiveLocation({
                        type: 'Current Location',
                        address: fallbackAddress,
                        latitude: currentLat,
                        longitude: currentLon
                    });
                }
            } catch (geoError) {
                console.warn("Geocoding failed, using generic fallback:", geoError);
                setActiveLocation({
                    type: 'Current Location',
                    address: 'GPS coordinates',
                    latitude: currentLat,
                    longitude: currentLon
                });
            }

        } catch (error) {
            console.warn("Smart routing error:", error);
        } finally {
            isRefreshing.current = false;
            setIsLoadingLocation(false);
        }
    };

    // Auto-run on mount
    useEffect(() => {
        // Listen for Auth changes to reload location logic 
        // (e.g. they log in, now we should check their saved addresses!)
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            // Reset manual selection on login/logout to allow smart logic to re-evaluate
            setIsManualSelection(false);
            refreshLocation(session?.user || null);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    return (
        <LocationContext.Provider value={{ activeLocation, isLoadingLocation, permissionDenied, refreshLocation, selectLocation }}>
            {children}
        </LocationContext.Provider>
    );
};

export const useLocation = () => {
    const context = useContext(LocationContext);
    if (context === undefined) {
        throw new Error('useLocation must be used within a LocationProvider');
    }
    return context;
};
