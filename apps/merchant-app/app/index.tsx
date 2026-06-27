import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { useStore } from '../src/context/StoreContext';

export default function Index() {
    const { store, loading, isApproved, isDraft } = useStore();

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

    // STRICT payment gate (2026-06-26): a 'draft' merchant — signup not yet paid /
    // submitted — is routed back to signup (which resumes at the payment step via the
    // AsyncStorage draft restore), NOT to "under review". Payment is a hard gate: they
    // cannot reach the pending/approval queue without a server-verified payment.
    if (isDraft) {
        console.log('[Index] Merchant is a draft (unpaid) — routing to signup (payment step)');
        return <Redirect href="/(auth)/signup" />;
    }

    // Approval gate: a Store row exists during signup (created at the draft step,
    // BEFORE payment/approval). Only admin-approved merchants (Store.active=true)
    // may enter the app. Drafts / awaiting-approval are routed to the pending screen,
    // which offers a path back into signup. Prevents accessing/editing a store
    // without completing + paying for onboarding.
    if (!isApproved) {
        console.log('[Index] Store not approved (draft/pending), routing to pending');
        return <Redirect href="/(auth)/pending" />;
    }

    // Approved store, redirect to dashboard
    return <Redirect href="/(main)/dashboard" />;
}
