// @lock — Do NOT overwrite. Approved global auth & network timeout logic as of May 1, 2026.
import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ProfileStatus = 'idle' | 'loading' | 'success' | 'error';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    profile: any | null;
    isLoading: boolean;
    isProfileLoading: boolean;
    profileStatus: ProfileStatus; // Explicit state machine for UI
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
    const [profileStatus, setProfileStatus] = useState<ProfileStatus>('idle');

    const isMounted = useRef(true);
    const hasInitialized = useRef(false);
    // Dedup lock keyed by userId so a stale anonymous fetch doesn't get
    // returned to the new authenticated user post-OTP.
    const fetchProfilePromise = useRef<{ userId: string; promise: Promise<void> } | null>(null);
    // Track auto-retry attempts on 'error' so we recover from transient
    // post-OTP failures without forcing the user to kill the app.
    const errorRetryCount = useRef(0);

    // FIX: React 18 StrictMode unmount/remount trap patched
    useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    const fetchProfile = useCallback(async (userId: string, isManualRefresh = false) => {
        // 1. DEDUPLICATION GUARD (keyed by userId)
        if (fetchProfilePromise.current?.userId === userId) {
            console.log('[AuthContext] Profile fetch already in flight for this user. Deduplicating...');
            return fetchProfilePromise.current.promise;
        }

        const executeFetch = async () => {
            if (!userId) {
                if (isMounted.current) {
                    setProfileStatus('idle');
                    setIsProfileLoading(false);
                }
                return;
            }

            // NOTE: We deliberately do NOT call `await supabase.auth.getSession()`
            // before the query. That call acquires the GoTrue internal lock, and
            // if the client is in a stuck state (e.g. immediately after OTP
            // verify on certain supabase-js versions), it hangs forever with no
            // timeout, freezing this entire function. The DB query below is
            // wrapped in Promise.race with an explicit timeout, so even if the
            // client is unhealthy we surface an error instead of spinning.

            let isCached = false;

            try {
                const cachedProfile = await AsyncStorage.getItem(`@profile_${userId}`);
                if (cachedProfile && isMounted.current) {
                    setProfile(JSON.parse(cachedProfile));
                    setProfileStatus('success');
                    if (!isManualRefresh) setIsProfileLoading(false);
                    isCached = true;
                }
            } catch (e) {
                console.warn('[AuthContext] Cache read failed:', e);
            }

            if ((!isCached || isManualRefresh) && isMounted.current) {
                setIsProfileLoading(true);
                setProfileStatus('loading');
            }

            // 2. AGGRESSIVE TIMEOUTS FOR E-COMMERCE (Max ~6 seconds total)
            const MAX_RETRIES = 1;
            let attempt = 0;

            while (attempt <= MAX_RETRIES) {
                let timerId: ReturnType<typeof setTimeout> | undefined;
                try {
                    const timeoutPromise = new Promise((_, reject) => {
                        const timeoutMs = attempt === 0 ? 4000 : 2000;
                        timerId = setTimeout(() => reject(new Error('Supabase DB Timeout')), timeoutMs);
                    });

                    // Prevent unhandled rejection leaks if Supabase fails first
                    timeoutPromise.catch(() => { });

                    const { data, error } = await Promise.race([
                        supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
                        timeoutPromise
                    ]) as any;

                    if (error) throw error;

                    // Confirm session still belongs to the same user before
                    // committing the result. Wrap getSession in a short timeout
                    // so a stuck GoTrue lock can't freeze us here either.
                    let currentSessionUserId: string | undefined;
                    try {
                        const sessionTimeout = new Promise<never>((_, reject) => {
                            setTimeout(() => reject(new Error('getSession Timeout')), 1500);
                        });
                        sessionTimeout.catch(() => { });
                        const { data: currentSessionData } = await Promise.race([
                            supabase.auth.getSession(),
                            sessionTimeout
                        ]) as any;
                        currentSessionUserId = currentSessionData?.session?.user?.id;
                    } catch {
                        // If getSession is stuck, fall through and trust the
                        // userId we were called with — better than dropping a
                        // successful query result on the floor.
                        currentSessionUserId = userId;
                    }

                    if (currentSessionUserId !== userId) {
                        if (isMounted.current) setIsProfileLoading(false);
                        return;
                    }

                    if (data) {
                        await AsyncStorage.setItem(`@profile_${userId}`, JSON.stringify(data));
                    } else {
                        await AsyncStorage.removeItem(`@profile_${userId}`);
                    }

                    if (isMounted.current) {
                        setProfile(data);
                        setProfileStatus('success');
                        setIsProfileLoading(false);
                        errorRetryCount.current = 0; // Reset on success
                    }
                    return;

                } catch (error) {
                    attempt++;
                    if (attempt > MAX_RETRIES) {
                        console.error('[AuthContext] Profile sync FAILED:', error);
                        if (isMounted.current) {
                            if (!isCached) setProfile(null);
                            setProfileStatus('error'); // 3. EXPLICIT FAILURE STATE FOR UI
                            setIsProfileLoading(false);
                        }
                        return;
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                } finally {
                    if (timerId) clearTimeout(timerId); // Guarantee timer cleanup
                }
            }
        };

        // Assign the execution to the lock (keyed by userId), then clear when done
        const promise = executeFetch().finally(() => {
            if (fetchProfilePromise.current?.userId === userId) {
                fetchProfilePromise.current = null;
            }
        });
        fetchProfilePromise.current = { userId, promise };

        return promise;
    }, []);

    const refreshProfile = useCallback(async () => {
        if (user?.id) await fetchProfile(user.id, true);
    }, [user?.id, fetchProfile]);

    const signOut = useCallback(async () => {
        if (user?.id) {
            try { await AsyncStorage.removeItem(`@profile_${user.id}`); }
            catch (error) { console.error('Cache clear failed:', error); }
        }
        await supabase.auth.signOut();
    }, [user?.id]);

    // Hook 1: Pure Auth State Management
    useEffect(() => {
        let authSettleTimer: ReturnType<typeof setTimeout> | undefined;
        let bootTimerId: ReturnType<typeof setTimeout> | undefined;

        const initializeAuth = async () => {
            try {
                const timeoutPromise = new Promise((_, reject) => {
                    bootTimerId = setTimeout(() => reject(new Error('Boot Session Timeout')), 3000);
                });
                timeoutPromise.catch(() => { });

                const safeGetSession = Promise.race([
                    supabase.auth.getSession(),
                    timeoutPromise
                ]) as Promise<any>;

                const { data: { session: initialSession } } = await safeGetSession;

                if (!isMounted.current) return;
                setSession(initialSession);
                setUser(initialSession?.user ?? null);
                hasInitialized.current = true;
            } catch (error) {
                console.warn('[AuthContext] Session init skipped (Network/Timeout). Falling back to listener.');
            } finally {
                if (bootTimerId) clearTimeout(bootTimerId);
                if (isMounted.current) setIsLoading(false);
            }
        };

        initializeAuth();

        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, newSession) => {
                const settleBufferMs = event === 'SIGNED_IN' ? 500 : 0;

                if (authSettleTimer) clearTimeout(authSettleTimer);

                authSettleTimer = setTimeout(() => {
                    if (!isMounted.current) return;
                    if (event === 'INITIAL_SESSION' && hasInitialized.current) return;

                    if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession?.user) {
                        setIsProfileLoading(true);
                        setProfileStatus('loading');
                    }

                    setSession(newSession);
                    setUser(newSession?.user ?? null);

                    if (event === 'SIGNED_OUT') {
                        setProfile(null);
                        setProfileStatus('idle');
                        setIsProfileLoading(false);
                        errorRetryCount.current = 0;
                    }

                    setIsLoading(false);
                    hasInitialized.current = true;
                }, settleBufferMs);
            }
        );

        return () => {
            authListener.subscription.unsubscribe();
            if (authSettleTimer) clearTimeout(authSettleTimer);
        };
    }, []);

    // Hook 2: Profile Sync
    useEffect(() => {
        if (user?.id) {
            fetchProfile(user.id).catch(err => {
                if (isMounted.current) console.error('[AuthContext] Background sync failed:', err);
            });
        } else {
            if (isMounted.current) {
                setProfileStatus('idle');
                setIsProfileLoading(false);
                setIsLoading(false);
            }
        }
    }, [user?.id, fetchProfile]);

    // Hook 3 — Auto-retry once on transient 'error' state.
    useEffect(() => {
        if (profileStatus !== 'error' || !user?.id) return;
        if (errorRetryCount.current >= 1) return; // One auto-retry only

        const retryTimer = setTimeout(() => {
            if (!isMounted.current || !user?.id) return;
            errorRetryCount.current += 1;
            console.log('[AuthContext] Auto-retrying profile fetch after error...');
            fetchProfile(user.id, true).catch(err => {
                if (isMounted.current) console.error('[AuthContext] Auto-retry failed:', err);
            });
        }, 3000);

        return () => clearTimeout(retryTimer);
    }, [profileStatus, user?.id, fetchProfile]);

    // Memoize the context value to prevent massive app-wide re-renders
    const value = useMemo(() => ({
        session, user, profile, isLoading, isProfileLoading, profileStatus, signOut, refreshProfile
    }), [session, user, profile, isLoading, isProfileLoading, profileStatus, signOut, refreshProfile]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};