// @lock — Do NOT overwrite. Approved layout as of Feb 27, 2026.
// Location Context: Haversine proximity detection + address management.
// STAGGERED HANDSHAKE: Consumes user from AuthContext, never calls supabase.auth.getUser().
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
const LAST_LOCATION_KEY = 'pas_last_active_location'; // AsyncStorage key for manual selection persistence

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
    const prevUserRef = useRef<any>(null); // Track user transitions for hydration bridge

    const selectLocation = async (location: DeliveryLocation) => {
        setIsManualSelection(true);
        setActiveLocation(location);
        // Persist the manual selection to AsyncStorage so it survives app restarts
        try {
            await AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(location));
            console.log('[LocationContext] Persisted manual selection:', location.type);
        } catch (e) {
            console.warn('[LocationContext] Failed to persist manual selection:', e);
        }
    };

    const refreshLocation = async (passedUser?: any, forceRefresh: boolean = false) => {
        if (isManualSelection) {
            console.log("[LocationContext] Skipping auto-refresh due to manual selection");
            setIsLoadingLocation(false);
            return;
        }

        // --- Rate Limit Guard (bypassed on auth hydration) ---
        const now = Date.now();
        if (!forceRefresh && (isRefreshing.current || (now - lastRefreshTime.current < 3000))) {
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

            // --- PRIORITY 1: Restore last manual selection from AsyncStorage ---
            try {
                const cached = await AsyncStorage.getItem(LAST_LOCATION_KEY);
                if (cached) {
                    const lastLocation: DeliveryLocation = JSON.parse(cached);
                    // Validate it has coordinates (not a stale/corrupt entry)
                    if (lastLocation.latitude && lastLocation.longitude) {
                        // Only restore if user is still within 5km of that saved location
                        // (prevents snapping to "Home" when user is in a different city)
                        const distToLast = getDistanceFromLatLonInKm(
                            currentLat, currentLon,
                            lastLocation.latitude, lastLocation.longitude
                        );
                        if (distToLast <= 5) {
                            console.log(`[LocationContext] PRIORITY 1: Restoring persisted selection "${lastLocation.type}" (${distToLast.toFixed(1)}km away)`);
                            setActiveLocation(lastLocation);
                            return; // finally block will clean up
                        } else {
                            console.log(`[LocationContext] Persisted "${lastLocation.type}" is ${distToLast.toFixed(1)}km away — too far, clearing`);
                            await AsyncStorage.removeItem(LAST_LOCATION_KEY);
                        }
                    }
                }
            } catch (cacheErr) {
                console.warn('[LocationContext] Failed to read persisted location:', cacheErr);
            }

            // --- PRIORITY 2: Auto-snap to saved address within 2km ---
            if (resolvedUser) {
                try {
                    const addressTimeout = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Address lookup timeout (8s)')), 8000)
                    );
                    const { data: addresses, error } = await Promise.race([
                        supabase
                            .from('consumer_addresses')
                            .select('*')
                            .eq('user_id', resolvedUser.id),
                        addressTimeout
                    ]) as any;

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

                        if (closestAddress && minDistance <= 2) {
                            console.log(`[LocationContext] PRIORITY 2: Auto-snapping to "${closestAddress.type}" (${minDistance.toFixed(2)}km away)`);
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
            setActiveLocation(prev => prev || {
                type: 'Default Location',
                address: 'Bangalore, India (Fallback)',
                latitude: 12.9716,
                longitude: 77.5946
            });
        } finally {
            // Clear the failsafe since we resolved naturally
            if (failsafeTimer.current) clearTimeout(failsafeTimer.current);
            isRefreshing.current = false;
            setIsLoadingLocation(false);
        }
    };

    // --- Hydration Bridge ---
    // Detects when user transitions from null → populated (AsyncStorage session restored)
    // and force-refreshes to re-run the address query with a valid RLS session.
    useEffect(() => {
        const wasNull = prevUserRef.current === null || prevUserRef.current === undefined;
        const isNowPopulated = !!user;

        if (wasNull && isNowPopulated) {
            console.log('[LocationContext] Auth hydration detected (null → user). Force re-snapping...');
            refreshLocation(user, true); // bypass rate limiter
        } else if (!isNowPopulated && !wasNull) {
            // User logged out
            refreshLocation(null);
        } else if (!prevUserRef.current && !user) {
            // Initial mount with no user — get GPS anyway
            refreshLocation(null);
        }

        prevUserRef.current = user;
    }, [user]);

    // Auto-listen for explicit session changes (login/logout only)
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (_event === 'SIGNED_IN') {
                setIsManualSelection(false);
                refreshLocation(session?.user || null, true); // force bypass
            } else if (_event === 'SIGNED_OUT') {
                setIsManualSelection(false);
                setActiveLocation(null);
                // Clear persisted location cache to prevent stale address leak
                try {
                    await AsyncStorage.removeItem(LAST_LOCATION_KEY);
                } catch (e) {
                    console.warn('[LocationContext] Failed to clear location cache on logout:', e);
                }
                refreshLocation(null);
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
