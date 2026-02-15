import React, { createContext, useContext, useEffect, useState } from 'react';
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

    const refreshUser = async () => {
        try {
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            setSession(currentSession);

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
                // Fallback to auth metadata if user record doesn't exist yet (though it should)
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
        }
    };

    useEffect(() => {
        refreshUser();

        // Listen for Auth State Changes
        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                refreshUser();
            } else {
                setUser(null);
                setLoading(false);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    // Realtime Subscription
    useEffect(() => {
        let channel: ReturnType<typeof supabase.channel> | null = null;

        const setupSubscription = async () => {
            if (!session?.user?.id) return;

            const userId = session.user.id;
            console.log('[UserContext] Setting up realtime subscription for user:', userId);

            channel = supabase.channel(`user_profile_${userId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        filter: `id=eq.${userId}`
                    },
                    (payload) => {
                        // console.log('[UserContext] Realtime update received:', payload);
                        if (payload.new) {
                            if (payload.table !== 'User' && payload.table !== 'user') {
                                // Ignore updates from other tables if they happen to share the ID (unlikely but safe)
                                return;
                            }
                            setUser(prev => {
                                if (!prev) return null;
                                return { ...prev, ...(payload.new as UserProfile) };
                            });

                            // Robustness: Fetch latest data to ensure consistency (like StoreContext)
                            refreshUser();
                        }
                    }
                )
                .subscribe((status) => {
                    console.log(`[UserContext] Subscription status for ${userId}:`, status);
                });
        };

        setupSubscription();

        return () => {
            if (channel) {
                console.log('[UserContext] Cleaning up subscription');
                supabase.removeChannel(channel);
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
