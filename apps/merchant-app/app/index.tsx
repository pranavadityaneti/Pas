import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { useStore } from '../src/context/StoreContext';

export default function Index() {
    const { store, loading } = useStore();

    // If the context is still loading data, show a spinner
    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' }}>
                <ActivityIndicator size="large" color={Colors.primary} />
            </View>
        );
    }

    // If we are NOT loading and there is NO store, redirect to login
    if (!store) {
        console.log('[Index] No store in context, redirecting to login');
        return <Redirect href="/(auth)/login" />;
    }

    // Store exists, redirect to dashboard
    return <Redirect href="/(main)/dashboard" />;
}
