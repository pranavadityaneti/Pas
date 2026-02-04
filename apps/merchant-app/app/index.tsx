import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '../src/lib/supabase';
import { Colors } from '../constants/Colors';

export default function Index() {
    const [loading, setLoading] = useState(true);
    const [session, setSession] = useState<any>(null);
    const [merchantStatus, setMerchantStatus] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session?.user) {
                checkMerchantStatus(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session?.user) {
                checkMerchantStatus(session.user.id);
            } else {
                setMerchantStatus(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const checkMerchantStatus = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('merchants')
                .select('status')
                .eq('id', userId)
                .single();

            if (error) throw error;
            setMerchantStatus(data?.status || null);
        } catch (error) {
            console.error('Error checking merchant status:', error);
            setMerchantStatus(null);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    if (!session) {
        console.log('[Index] Redirecting to login');
        return <Redirect href="/(auth)/login" />;
    }

    if (merchantStatus === 'active') {
        return <Redirect href="/(main)/dashboard" />;
    }

    return <Redirect href="/(auth)/pending" />;
}
