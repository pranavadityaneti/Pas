import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import api from '../lib/api';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isAdmin?: boolean;
}

interface AuthContextType {
    user: AdminUser | null;
    session: Session | null;
    loading: boolean;
    profileError: string | null;
    isAuthenticated: boolean;
    mustChangePassword: boolean;
    login: (email: string, password: string) => Promise<{ error: string | null }>;
    sendAdminOtp: (phone: string) => Promise<{ error: string | null }>;
    loginWithOtp: (phone: string, otp: string) => Promise<{ error: string | null }>;
    logout: () => Promise<void>;
    createAdmin: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
    clearPasswordChangeFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// An authorized admin is either a legacy email SUPER_ADMIN or a phone-OTP admin
// flagged via User.isAdmin (which survives the merchant JIT role overwrite).
function isAdminProfile(profile: AdminUser | null): boolean {
    return !!profile && (profile.role === 'SUPER_ADMIN' || profile.isAdmin === true);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [mustChangePassword, setMustChangePassword] = useState(false);

    // Fetch user profile from database
    const fetchUserProfile = async (supabaseUser: SupabaseUser): Promise<{ profile: AdminUser | null, error: string | null }> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        try {
            // @ts-ignore
            const { data, error } = await supabase
                .from('User')
                .select('id, email, name, role, isAdmin')
                .eq('id', supabaseUser.id)
                .single()
                .abortSignal(controller.signal);

            clearTimeout(timeoutId);

            if (error) {
                console.error('Error fetching user profile for ID:', supabaseUser.id, error);
                // 406 means row not found (usually)
                if (error.code === 'PGRST116' || error.code === '406') {
                    return { profile: null, error: 'User record not found in database' };
                }
                return { profile: null, error: error.message };
            }

            return { profile: data as AdminUser, error: null };
        } catch (e: any) {
            clearTimeout(timeoutId);
            const isTimeout = e.name === 'AbortError';
            console.error('Profile fetch exception:', isTimeout ? 'Request timed out' : e);
            return { 
                profile: null, 
                error: isTimeout ? 'Network timeout while fetching profile' : 'Connection error' 
            };
        }
    };

    // Initialize auth state with timeout to prevent infinite loading
    useEffect(() => {
        let isMounted = true;

        const fallbackTimeout = setTimeout(() => {
            console.warn('[Auth] getSession hung. Forcing load completion.');
            if (isMounted) setLoading(false);
        }, 5000);

        const initAuth = async () => {
            try {
                setProfileError(null);
                const { data: { session }, error } = await supabase.auth.getSession();
                
                // Clear the fallback timeout once getSession resolves or fails
                clearTimeout(fallbackTimeout);

                if (error) {
                    console.error('Session error, clearing auth:', error);
                    if (isMounted) {
                        setSession(null);
                        setUser(null);
                    }
                    return;
                }

                if (isMounted) setSession(session);

                if (session?.user && isMounted) {
                    const { profile, error: fetchError } = await fetchUserProfile(session.user);
                    
                    if (fetchError && fetchError.includes('Connection')) {
                        // Network error - preserve session but flag error
                        setProfileError(fetchError);
                    } else if (isAdminProfile(profile)) {
                        if (isMounted) setUser(profile);
                    } else {
                        // User exists but is definitively not an admin OR record missing
                        console.warn('Unauthorized access attempt or missing profile, signing out');
                        await supabase.auth.signOut();
                        if (isMounted) {
                            setSession(null);
                            setUser(null);
                        }
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!isMounted) return;

            // PREVENT DEADLOCK: Let initAuth handle the initial load exclusively
            // This prevents race conditions where initAuth and this listener fire simultaneously
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
                console.log(`[Auth] Ignoring ${event} in listener to prevent deadlock`);
                return;
            }

            console.log('[Auth] Event changed:', event);
            setSession(session);
            setProfileError(null);

            if (session?.user) {
                const { profile, error: fetchError } = await fetchUserProfile(session.user);
                
                if (fetchError && fetchError.includes('Connection')) {
                    setProfileError(fetchError);
                } else if (isAdminProfile(profile)) {
                    if (isMounted) setUser(profile);
                } else {
                    if (isMounted) setUser(null);
                    // Only auto-signout if definitively unauthorized
                    if (!fetchError) {
                        await supabase.auth.signOut();
                    }
                }
            } else {
                if (isMounted) setUser(null);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const login = async (email: string, password: string): Promise<{ error: string | null }> => {
        try {
            console.log('Attempting login for:', email);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            
            if (error) {
                console.error('Sign in error:', error);
                return { error: error.message };
            }
            
            if (data.user) {
                console.log('User authenticated, fetching profile sequentially...');
                const { profile, error: fetchError } = await fetchUserProfile(data.user);
                
                if (fetchError) {
                    await supabase.auth.signOut();
                    return { error: `Profile error: ${fetchError}` };
                }
                
                if (isAdminProfile(profile)) {
                    // Check if user needs to change password
                    const userMetadata = data.user.user_metadata;
                    if (userMetadata?.mustChangePassword) {
                        setMustChangePassword(true);
                    }

                    setUser(profile);
                    return { error: null };
                } else {
                    await supabase.auth.signOut();
                    return { error: 'Access denied. Super Admin privileges required.' };
                }
            }
            return { error: 'Unknown login error' };
        } catch (err) {
            console.error('Login exception:', err);
            return { error: `Exception: ${err instanceof Error ? err.message : String(err)}` };
        }
    };

    const sendAdminOtp = async (phone: string): Promise<{ error: string | null }> => {
        try {
            await api.post('/auth/send-otp', { phone, purpose: 'admin' });
            return { error: null };
        } catch (err: any) {
            return { error: err?.response?.data?.error || err?.message || 'Failed to send OTP' };
        }
    };

    const loginWithOtp = async (phone: string, otp: string): Promise<{ error: string | null }> => {
        try {
            const resp = await api.post('/auth/verify-otp', { phone, otp, purpose: 'admin' });
            const sess = resp.data?.session;
            if (!sess?.access_token || !sess?.refresh_token) {
                return { error: 'No session returned from server' };
            }
            const { data, error } = await supabase.auth.setSession({
                access_token: sess.access_token,
                refresh_token: sess.refresh_token,
            });
            if (error || !data.user) {
                return { error: error?.message || 'Failed to establish session' };
            }
            const { profile, error: fetchError } = await fetchUserProfile(data.user);
            if (fetchError) {
                await supabase.auth.signOut();
                return { error: `Profile error: ${fetchError}` };
            }
            if (isAdminProfile(profile)) {
                setUser(profile);
                return { error: null };
            }
            await supabase.auth.signOut();
            return { error: 'Access denied. Admin privileges required.' };
        } catch (err: any) {
            return { error: err?.response?.data?.error || err?.message || 'OTP verification failed' };
        }
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
        setMustChangePassword(false);
    };

    const clearPasswordChangeFlag = () => {
        setMustChangePassword(false);
    };

    const createAdmin = async (
        email: string,
        password: string,
        name: string
    ): Promise<{ error: string | null }> => {
        try {
            // Check if email already exists in User table
            const { data: existingUser } = await supabase
                .from('User')
                .select('id')
                .eq('email', email)
                .single();

            if (existingUser) {
                return { error: 'An admin with this email already exists' };
            }

            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                        mustChangePassword: true
                    },
                },
            });

            if (authError) {
                return { error: authError.message };
            }

            if (!authData.user) {
                return { error: 'Failed to create user' };
            }

            // Create user profile in database
            const now = new Date().toISOString();
            const { error: profileError } = await supabase
                .from('User')
                .insert({
                    id: authData.user.id,
                    email,
                    name,
                    role: 'SUPER_ADMIN',
                    passwordHash: 'managed-by-supabase-auth',
                    createdAt: now,
                    updatedAt: now,
                });

            if (profileError) {
                console.error('Profile creation error:', profileError);
                return { error: `Profile creation failed: ${profileError.message}` };
            }

            return { error: null };
        } catch (err) {
            console.error('Create admin exception:', err);
            return { error: `An unexpected error occurred: ${err instanceof Error ? err.message : String(err)}` };
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                loading,
                profileError,
                isAuthenticated: !!user,
                mustChangePassword,
                login,
                sendAdminOtp,
                loginWithOtp,
                logout,
                createAdmin,
                clearPasswordChangeFlag,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
