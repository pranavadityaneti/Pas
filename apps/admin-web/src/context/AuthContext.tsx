import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';

interface AdminUser {
    id: string;
    email: string;
    name: string | null;
    role: string;
}

interface AuthContextType {
    user: AdminUser | null;
    session: Session | null;
    loading: boolean;
    isAuthenticated: boolean;
    mustChangePassword: boolean;
    login: (email: string, password: string) => Promise<{ error: string | null }>;
    logout: () => Promise<void>;
    createAdmin: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
    clearPasswordChangeFlag: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AdminUser | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [mustChangePassword, setMustChangePassword] = useState(false);

    // Fetch user profile from database
    const fetchUserProfile = async (supabaseUser: SupabaseUser): Promise<AdminUser | null> => {
        const { data, error } = await supabase
            .from('User')
            .select('id, email, name, role')
            .eq('email', supabaseUser.email)
            .single();

        if (error || !data) {
            console.error('Error fetching user profile:', error);
            return null;
        }

        return data as AdminUser;
    };

    // Initialize auth state with timeout to prevent infinite loading
    useEffect(() => {
        let isMounted = true;

        const initAuth = async () => {
            try {
                // Add timeout to prevent hanging - reduced to 2 seconds
                const timeoutId = setTimeout(() => {
                    console.warn('Auth initialization timeout - forcing loading complete');
                    if (isMounted) setLoading(false);
                }, 2000); // 2 second timeout

                const { data: { session }, error } = await supabase.auth.getSession();

                clearTimeout(timeoutId);

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
                    const profile = await fetchUserProfile(session.user);
                    if (profile?.role === 'SUPER_ADMIN') {
                        if (isMounted) setUser(profile);
                    } else {
                        // User exists but is not an admin - sign out
                        await supabase.auth.signOut();
                        if (isMounted) setSession(null);
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                // On error, ensure we clear the session to show login
                if (isMounted) {
                    setSession(null);
                    setUser(null);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        initAuth();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!isMounted) return;
            setSession(session);

            if (session?.user) {
                const profile = await fetchUserProfile(session.user);
                if (profile?.role === 'SUPER_ADMIN') {
                    if (isMounted) setUser(profile);
                } else {
                    if (isMounted) setUser(null);
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
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                return { error: error.message };
            }

            if (data.user) {
                const profile = await fetchUserProfile(data.user);

                if (!profile) {
                    await supabase.auth.signOut();
                    return { error: 'User profile not found' };
                }

                if (profile.role !== 'SUPER_ADMIN') {
                    await supabase.auth.signOut();
                    return { error: 'Access denied. Super Admin privileges required.' };
                }

                // Check if user needs to change password
                const userMetadata = data.user.user_metadata;
                if (userMetadata?.mustChangePassword) {
                    setMustChangePassword(true);
                }

                setUser(profile);
            }

            return { error: null };
        } catch (err) {
            return { error: 'An unexpected error occurred' };
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
            return { error: 'An unexpected error occurred' };
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                session,
                loading,
                isAuthenticated: !!user,
                mustChangePassword,
                login,
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
