// @lock — Do NOT overwrite. Approved global auth & network timeout logic as of April 1, 2026.
import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: any | null;
    isLoading: boolean;
    isProfileLoading: boolean;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<any | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProfileLoading, setIsProfileLoading] = useState(false);

    // FIX 3: Circuit breaker to prevent state updates on unmounted components
    const isMounted = useRef(true);
    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);

    // --- Core Sync Logic ---
    // Decoupled from Location or other providers to prevent Cold Start hangs.

    const fetchProfile = async (userId: string) => {
        if (!userId) {
            setIsProfileLoading(false);
            setIsLoading(false);
            return;
        }

        let isCached = false;

        // 1. Instant Cache Hydration (Offline Read)
        try {
            const cachedProfile = await AsyncStorage.getItem(`@profile_${userId}`);
            if (cachedProfile) {
                if (!isMounted.current) return;
                setProfile(JSON.parse(cachedProfile));
                setIsProfileLoading(false); // Unblock UI immediately
                isCached = true;
            }
        } catch (e) {
            console.warn('[AuthContext] Cache read failed:', e);
        }

        if (!isCached) setIsProfileLoading(true);

        const MAX_RETRIES = 3;
        const BASE_DELAY = 1000;
        let attempt = 0;

        // 2. Exponential Backoff Sync Loop
        while (attempt < MAX_RETRIES) {
            try {
                console.log('[AuthContext] Fetching profile...');
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Supabase DB Timeout')), attempt === 0 ? 15000 : 8000)
                );

                const { data, error } = await Promise.race([
                    supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', userId)
                        .maybeSingle(),
                    timeoutPromise
                ]) as any;

                if (error) throw error;

                // 3. Sync Successful: Verify user hasn't logged out during the delay
                const { data: currentSessionData } = await supabase.auth.getSession();
                if (currentSessionData.session?.user?.id !== userId) {
                    console.warn('[AuthContext] Fetch resolved but user changed/logged out. Aborting state update.');
                    return;
                }

                // Update state and rewrite cache
                if (!isMounted.current) return;
                setProfile(data);
                if (data) {
                    await AsyncStorage.setItem(`@profile_${userId}`, JSON.stringify(data));
                } else {
                    await AsyncStorage.removeItem(`@profile_${userId}`); // Guest fallback
                }
                
                setIsProfileLoading(false);
                setIsLoading(false); // Unblock main navigation loading
                return; // Exit loop on success
                
            } catch (error) {
                attempt++;
                if (attempt >= MAX_RETRIES) {
                    console.error('[AuthContext] PostgREST Sync Failed fully after max retries:', error);
                    // If we never loaded a cache, fall back gracefully
                    if (!isMounted.current) return;
                    if (!isCached) setProfile(null); 
                    setIsProfileLoading(false);
                    setIsLoading(false); // Unblock main navigation loading even on failure
                    return;
                }
                
                const delayMs = BASE_DELAY * Math.pow(2, attempt - 1);
                console.warn(`[AuthContext] Retrying profile sync in ${delayMs}ms due to API drop...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    };

    const refreshProfile = async () => {
        if (user?.id) {
            await fetchProfile(user.id);
        }
    };

    // Hook 1: Pure Auth State Management
    useEffect(() => {
        // 1. Initial Session Probe
        const initializeAuth = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                if (!isMounted.current) return;
                
                setSession(initialSession);
                setUser(initialSession?.user ?? null);
            } catch (error) {
                console.error('[AuthContext] Error initializing session:', error);
            } finally {
                // FIX 2: Prevent infinite loading if offline/failed
                if (isMounted.current) setIsLoading(false); 
            }
        };

        initializeAuth();

        // 2. Listen for Auth State Changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, newSession) => {
                setTimeout(() => {
                    if (!isMounted.current) return;

                    console.log(`[AuthContext] State change detected: ${event}`);

                    // FIX 1: Close the render gap BEFORE updating the user state
                    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession?.user) {
                        setIsProfileLoading(true); 
                    }

                    setSession(newSession);
                    setUser(newSession?.user ?? null);

                    if (event === 'SIGNED_OUT') {
                        setProfile(null);
                        setIsProfileLoading(false);
                    }
                    
                    setIsLoading(false);
                }, 0);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Hook 2: Profile Sync based on User State
    useEffect(() => {
        if (user?.id) {
            fetchProfile(user.id).catch(err => {
                if (isMounted.current) console.error('[AuthContext] Background profile sync failed:', err);
            });
        } else {
            if (isMounted.current) {
                setIsProfileLoading(false);
                setIsLoading(false);
            }
        }
    }, [user?.id]);

    const signOut = async () => {
        if (user?.id) {
            try {
                await AsyncStorage.removeItem(`@profile_${user.id}`);
            } catch (error) {
                console.error('[AuthContext] Failed to invalidate profile cache on logout:', error);
            }
        }
        await supabase.auth.signOut();
    };

    const value = {
        session,
        user,
        profile,
        isLoading,
        isProfileLoading,
        signOut,
        refreshProfile,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
