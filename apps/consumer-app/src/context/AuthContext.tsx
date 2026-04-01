// @lock — Do NOT overwrite. Approved global auth & network timeout logic as of April 1, 2026.
import React, { createContext, useContext, useEffect, useState } from 'react';
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

    const fetchProfile = async (userId: string) => {
        if (!userId) {
            setIsProfileLoading(false);
            return;
        }

        let isCached = false;

        // 1. Instant Cache Hydration (Offline Read)
        try {
            const cachedProfile = await AsyncStorage.getItem(`@profile_${userId}`);
            if (cachedProfile) {
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
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Supabase DB Timeout')), 5000)
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
                setProfile(data);
                if (data) {
                    await AsyncStorage.setItem(`@profile_${userId}`, JSON.stringify(data));
                } else {
                    await AsyncStorage.removeItem(`@profile_${userId}`); // Guest fallback
                }
                
                setIsProfileLoading(false);
                return; // Exit loop on success
                
            } catch (error) {
                attempt++;
                if (attempt >= MAX_RETRIES) {
                    console.error('[AuthContext] PostgREST Sync Failed fully after max retries:', error);
                    // If we never loaded a cache, fall back gracefully
                    if (!isCached) setProfile(null); 
                    setIsProfileLoading(false);
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

    useEffect(() => {
        // 1. Initial Session Probe
        const initializeAuth = async () => {
            try {
                const { data: { session: initialSession } } = await supabase.auth.getSession();
                setSession(initialSession);
                setUser(initialSession?.user ?? null);
                
                if (initialSession?.user) {
                    await fetchProfile(initialSession.user.id);
                }
            } catch (error) {
                console.error('[AuthContext] Error initializing session:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();

        // 2. Listen for Auth State Changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log(`[AuthContext] State change detected: ${event}`);
                setSession(newSession);
                const newUser = newSession?.user ?? null;
                setUser(newUser);

                if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newUser) {
                    await fetchProfile(newUser.id);
                } else if (event === 'SIGNED_OUT') {
                    setProfile(null);
                    setIsProfileLoading(false);
                }
                
                setIsLoading(false);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

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
