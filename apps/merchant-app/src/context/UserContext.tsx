import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Session } from '@supabase/supabase-js';

type UserProfile = {
    id: string;
    email: string;
    phone: string; // The user's phone number as stored in 'User' table (or auth metadata)
    name: string | null;
    role: 'MERCHANT' | 'ADMIN' | 'STAFF';
    notification_preferences?: {
        newOrder: boolean;
        orderCancelled: boolean;
        sound: boolean;
        vibration: boolean;
        soundType: string;
    };
};

type UserContextType = {
    user: UserProfile | null;
    session: Session | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Refs to prevent cascading updates
    const sessionRef = useRef<Session | null>(null);
    const isRefreshing = useRef(false);
    const userIdRef = useRef<string | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const refreshUser = useCallback(async () => {
        // Prevent concurrent refresh calls
        if (isRefreshing.current) {
            console.log('[UserContext] refreshUser skipped (already refreshing)');
            return;
        }
        isRefreshing.current = true;

        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();

            // Only update session state if it actually changed
            if (currentSession?.user?.id !== sessionRef.current?.user?.id) {
                sessionRef.current = currentSession;
                setSession(currentSession);
            }

            if (!currentSession?.user) {
                setUser(null);
                return;
            }

            // Fetch user profile from 'User' table
            const { data, error } = await supabase
                .from('User')
                .select('*')
                .eq('id', currentSession.user.id)
                .single();

            if (error) {
                console.error('[UserContext] Error fetching user profile:', error);
            }

            if (data) {
                setUser(data as UserProfile);
            } else {
                // Fallback to auth metadata if user record doesn't exist yet
                setUser({
                    id: currentSession.user.id,
                    email: currentSession.user.email || '',
                    phone: currentSession.user.phone || '',
                    name: currentSession.user.user_metadata?.full_name || null,
                    role: 'MERCHANT' // Default
                });
            }

        } catch (error) {
            console.error('[UserContext] Error refreshing user:', error);
        } finally {
            setLoading(false);
            isRefreshing.current = false;
        }
    }, []);

    // Auth initialization + listener (runs once)
    useEffect(() => {
        let hasInitialized = false;

        // Listen for Auth State Changes
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
            console.log('[UserContext] Auth state changed:', _event);

            // Update refs and state only if user ID actually changed
            const newUserId = newSession?.user?.id || null;
            const oldUserId = sessionRef.current?.user?.id || null;

            if (newUserId !== oldUserId) {
                sessionRef.current = newSession;
                setSession(newSession);
            }

            if (newSession?.user) {
                // Only refresh once on initial load, then on actual sign-in changes
                if (!hasInitialized || _event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
                    hasInitialized = true;
                    refreshUser();
                }
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        // Don't call refreshUser() separately — onAuthStateChange fires INITIAL_SESSION
        // which handles the initial load. Calling it here too causes double-fetch.

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, [refreshUser]);

    // Realtime Subscription — setup once when we have a user ID
    useEffect(() => {
        const userId = session?.user?.id;

        // Skip if userId hasn't actually changed
        if (userId === userIdRef.current) return;
        userIdRef.current = userId || null;

        // Clean up previous channel
        if (channelRef.current) {
            console.log('[UserContext] Cleaning up previous subscription');
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        if (!userId) return;

        console.log('[UserContext] Setting up realtime subscription for user:', userId);

        const channel = supabase.channel(`user_profile_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'User',
                    filter: `id=eq.${userId}`
                },
                (payload) => {
                    console.log('[UserContext] Realtime update received for User table');
                    if (payload.new) {
                        setUser(prev => {
                            if (!prev) return null;
                            return { ...prev, ...(payload.new as UserProfile) };
                        });
                    }
                }
            )
            .subscribe((status) => {
                console.log(`[UserContext] Subscription status for ${userId}:`, status);
            });

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                console.log('[UserContext] Cleaning up subscription');
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
                userIdRef.current = null;
            }
        };
    }, [session?.user?.id]);

    return (
        <UserContext.Provider value={{ user, session, loading, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
