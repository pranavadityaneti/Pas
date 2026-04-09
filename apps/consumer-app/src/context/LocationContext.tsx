// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Location Context: Haversine proximity detection + address management.
// STAGGERED HANDSHAKE: Consumes user from AuthContext, never calls supabase.auth.getUser().
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';

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

const FAILSAFE_TIMEOUT_MS = 8000; // Force-unblock spinners after 8 seconds

// Math utility to calculate straight-line distance between two GPS coordinates
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export const LocationProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth(); // STRICT: Consume user from AuthContext, no direct Supabase auth calls
    const [activeLocation, setActiveLocation] = useState<DeliveryLocation | null>(null);
    const [isLoadingLocation, setIsLoadingLocation] = useState(true);
    const [permissionDenied, setPermissionDenied] = useState(false);
    const [isManualSelection, setIsManualSelection] = useState(false);
    const lastRefreshTime = useRef<number>(0);
    const isRefreshing = useRef<boolean>(false);
    const failsafeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const selectLocation = (location: DeliveryLocation) => {
        setIsManualSelection(true);
        setActiveLocation(location);
    };

    const refreshLocation = async (passedUser?: any) => {
        if (isManualSelection) {
            console.log("[LocationContext] Skipping auto-refresh due to manual selection");
            setIsLoadingLocation(false);
            return;
        }

        // --- Rate Limit Guard ---
        const now = Date.now();
        if (isRefreshing.current || (now - lastRefreshTime.current < 3000)) {
            console.log("[LocationContext] Debouncing location refresh");
            return;
        }

        // --- Failsafe Timer: Force-unblock after 8 seconds ---
        if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
        failsafeTimer.current = setTimeout(() => {
            console.warn("[LocationContext] FAILSAFE: Forcing isLoadingLocation=false after 8s timeout");
            isRefreshing.current = false;
            setIsLoadingLocation(false);
        }, FAILSAFE_TIMEOUT_MS);

        try {
            isRefreshing.current = true;
            lastRefreshTime.current = now;
            setIsLoadingLocation(true);

            // STRICT: Use the passed user or the AuthContext user. NEVER call supabase.auth.getUser().
            const resolvedUser = passedUser !== undefined ? passedUser : user;

            // 1. Request GPS Permissions
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setPermissionDenied(true);
                return; // finally block will clean up
            }
            setPermissionDenied(false);

            // 2. Ping Live GPS
            const locationConfig = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High
            });
            const currentLat = locationConfig.coords.latitude;
            const currentLon = locationConfig.coords.longitude;

            // 3. If logged in, check saved addresses for proximity
            if (resolvedUser) {
                try {
                    const { data: addresses, error } = await supabase
                        .from('consumer_addresses')
                        .select('*')
                        .eq('user_id', resolvedUser.id);

                    if (!error && addresses && addresses.length > 0) {
                        let closestAddress = null;
                        let minDistance = Infinity;

                        for (const addr of addresses) {
                            if (addr.latitude && addr.longitude) {
                                const dist = getDistanceFromLatLonInKm(currentLat, currentLon, addr.latitude, addr.longitude);
                                if (dist < minDistance) {
                                    minDistance = dist;
                                    closestAddress = addr;
                                }
                            }
                        }

                        if (closestAddress && minDistance <= 5) {
                            setActiveLocation({
                                type: closestAddress.type,
                                address: closestAddress.address,
                                latitude: closestAddress.latitude,
                                longitude: closestAddress.longitude,
                            });
                            return; // finally block will clean up
                        }
                    }
                } catch (dbError) {
                    console.warn("[LocationContext] Supabase address lookup failed, falling back to GPS:", dbError);
                    // Don't rethrow — fall through to geocoding
                }
            }

            // 4. Fallback: Reverse Geocode the Live GPS
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
                console.warn("[LocationContext] Geocoding failed, using raw GPS:", geoError);
                setActiveLocation({
                    type: 'Current Location',
                    address: 'GPS coordinates',
                    latitude: currentLat,
                    longitude: currentLon
                });
            }

        } catch (error) {
            console.warn("[LocationContext] Smart routing error:", error);
        } finally {
            // Clear the failsafe since we resolved naturally
            if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
            isRefreshing.current = false;
            setIsLoadingLocation(false);
        }
    };

    // --- Mount-Time Proactive Refresh ---
    // Fires on mount and re-fires when AuthContext provides the user object.
    useEffect(() => {
        refreshLocation(user || null);
    }, [user]);

    // Auto-listen for explicit session changes (login/logout only)
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            if (_event === 'SIGNED_IN' || _event === 'SIGNED_OUT') {
                setIsManualSelection(false);
                refreshLocation(session?.user || null);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Cleanup failsafe timer on unmount
    useEffect(() => {
        return () => {
            if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
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
