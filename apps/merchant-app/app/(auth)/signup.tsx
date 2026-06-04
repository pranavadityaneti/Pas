// @lock — Orchestrator only. After Phase 1.7 (2026-06-04), this file holds:
//   - SignupProvider mount + isRestoring loading view
//   - useSignupOtpVerify + useImageUpload hook instances (shared down to steps)
//   - Cross-cutting handlers: validateStep, handleNext, handleBack,
//     handleFinalSubmit, handlePayment, syncDraftState
//   - renderStepIndicator (top), Back/Next footer (bottom)
//   - Step dispatch: {step === N && <StepX />}
// Per-step UI lives in src/screens/signup/steps/Step{Identity,Store,Photos,
// Branches,Kyc,Subscription,Review}.tsx — those are NOT locked. Edits to
// THIS file require explicit chat-confirmed approval from Pranav.
import React from 'react';
import { View, Text, TouchableOpacity, Platform, ActivityIndicator, Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    validateIdentity,
    validateStore,
    validatePhotos,
    validateBranches,
    validateKyc,
    validatePayment,
    type ValidationResult,
} from '../../src/screens/signup/shared/validations';
import { useSignupOtpVerify } from '../../src/screens/signup/shared/useSignupOtpVerify';
import { useImageUpload } from '../../src/hooks/useImageUpload';
import { SignupProvider, useSignupContext } from '../../src/screens/signup/shared/SignupContext';
import { styles } from '../../src/screens/signup/shared/signupStyles';
import { StepIdentity } from '../../src/screens/signup/steps/StepIdentity';
import { StepStore } from '../../src/screens/signup/steps/StepStore';
import { StepPhotos } from '../../src/screens/signup/steps/StepPhotos';
import { StepBranches } from '../../src/screens/signup/steps/StepBranches';
import { StepKyc } from '../../src/screens/signup/steps/StepKyc';
import { StepSubscription } from '../../src/screens/signup/steps/StepSubscription';
import { StepReview } from '../../src/screens/signup/steps/StepReview';

let RazorpayCheckout: any = null;
if (Constants.appOwnership !== 'expo') {
    try {
        RazorpayCheckout = require('react-native-razorpay').default;
    } catch (e) {
        console.warn('Razorpay not loaded (likely in dev/sim):', e);
    }
}

const STEPS = ['Identity', 'Store', 'Photos', 'Branches', 'KYC', 'Subscription', 'Review'];

function SignupScreenInner() {
    // 2026-06-04 (Phase 1.6.B): master signup state lifted into SignupProvider
    // (../../src/screens/signup/shared/SignupContext.tsx). This destructure
    // exposes the SAME variable names that signup.tsx used previously, so
    // every handler + JSX reference below continues to work unchanged.
    const {
        step, setStep,
        loading, setLoading,
        isRestoring,
        identity, setIdentity,
        store, setStore,
        verticals, verticalsLoading, verticalsError,
        selectedVertical,
        storePhotos, setStorePhotos,
        hasBranches, setHasBranches,
        branches, setBranches,
        kyc, setKyc,
        docFiles, setDocFiles,
        paymentStatus, setPaymentStatus,
        paymentDetails, setPaymentDetails,
        fetchVerticals,
        fetchRemoteMerchantState,
    } = useSignupContext();

    // 2026-06-04 (Phase 1.4.B): OTP state + handlers extracted to
    // ../../src/screens/signup/shared/useSignupOtpVerify.ts — a mid-layer hook
    // composing useOtpPad + useSendVerifyOtp + the signup-specific duplicate-
    // merchant guard. Behavior preserved verbatim. The onVerified arrow closes
    // over fetchRemoteMerchantState (now provided by useSignupContext above).
    const otp = useSignupOtpVerify({
        phone: identity.phone,
        onVerified: (data) => fetchRemoteMerchantState(data.session.access_token),
        setLoading,
    });

    // 2026-06-04 (Phase 1.5.B): file→storage upload extracted to the shared
    // useImageUpload primitive (apps/merchant-app/src/hooks/useImageUpload.ts).
    // Bucket stays 'merchant-docs' — same destination as before. Retry policy
    // (3 attempts, attempt*1500ms backoff) and skip-already-uploaded guard
    // preserved verbatim.
    const { uploadFile } = useImageUpload({ bucket: 'merchant-docs' });

    const getApiUrl = () => {
        return process.env.EXPO_PUBLIC_API_URL;
    };

    const fetchWithTimeout = async (resource: string, options: any = {}) => {
        const { timeout = 15000, ...fetchOptions } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(resource, { ...fetchOptions, signal: controller.signal as any });
            clearTimeout(id);
            return response;
        } catch (error: any) {
            clearTimeout(id);
            if (error.name === 'AbortError') throw new Error('Network timeout.');
            throw error;
        }
    };

    const validateStep = () => {
        // 2026-06-04 (Phase 1.3b): per-step validators extracted to
        // ../../src/screens/signup/shared/validations.ts. This function is now
        // a thin switch that delegates to those pure helpers and presents the
        // resulting Alert. Error titles + messages are preserved verbatim.
        let result: ValidationResult = { ok: true };
        if (step === 1) result = validateIdentity(identity, otp.verified);
        else if (step === 2) result = validateStore(store);
        else if (step === 3) result = validatePhotos(storePhotos);
        else if (step === 4) result = validateBranches(hasBranches, branches);
        else if (step === 5) result = validateKyc(kyc, docFiles, selectedVertical);
        else if (step === 6) result = validatePayment(paymentStatus);

        if (!result.ok) {
            Alert.alert(result.title, result.message);
            return false;
        }
        return true;
    };

    const handlePayment = async () => {
        const isPremium = selectedVertical?.isPremium || false;
        const subscriptionAmount = isPremium ? 2999 : 999;
        
        let orderId = '';
        try {
            const apiUrl = getApiUrl();
            const res = await fetch(`${apiUrl}/payments/create-order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    amount: subscriptionAmount, 
                    type: 'merchant', 
                    userId: identity.phone || 'merchant',
                    notes: {
                        plan_type: isPremium ? 'Premium Subscription' : 'Standard Subscription',
                        store_category: store.categoryId
                    }
                })
            });
            const data = await res.json();
            if (data.order_id) {
                orderId = data.order_id;
            } else {
                Alert.alert('Payment Error', 'Failed to initialize secure payment on the server.');
                return;
            }
        } catch (error) {
            console.error('Create order error:', error);
            Alert.alert('Error', 'Could not connect to secure payment server.');
            return;
        }

        const options = {
            description: 'Lifetime Partner Subscription',
            image: 'https://pickatstore.com/logo.png', // Replace with real logo URL
            currency: 'INR',
            amount: subscriptionAmount * 100,
            key: process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_RnWZnS9NxCVC6V',
            order_id: orderId,
            name: 'PickAtStore',
            prefill: {
                email: identity.email,
                contact: identity.phone,
                name: identity.ownerName
            },
            theme: { color: Colors.primary }
        };

        // Check if running in Expo Go or if Native Module is missing
        if (Constants.appOwnership === 'expo' || !RazorpayCheckout) {
            Alert.alert(
                'Development Mode',
                'Native Payment Module not available in Expo Go. Simulating successful payment for testing.',
                [
                    {
                        text: 'Simulate Success',
                        onPress: () => {
                            setPaymentStatus('success');
                            setPaymentDetails({
                                paymentId: 'pay_simulated_123',
                                orderId: 'order_simulated_123',
                                signature: 'sig_simulated_123'
                            });
                            
                            // Simulate Final PATCH sync
                            setLoading(true);
                            syncDraftState(true, {
                                amount: isPremium ? 2999 : 999,
                                paymentId: 'pay_simulated_123',
                                orderId: 'order_simulated_123',
                                signature: 'sig_simulated_123'
                            }).then(async () => {
                                Alert.alert('Welcome!', 'Application simulated successfully.');
                                await AsyncStorage.removeItem('@merchant_signup_draft');
                                setLoading(false);
                                router.replace('/(auth)/pending');
                            }).catch((err) => {
                                console.error('[Signup] Simulation sync failed:', err);
                                setLoading(false);
                                Alert.alert('Error', 'Failed to synchronize draft state.');
                            });
                        }
                    },
                    { text: 'Cancel', style: 'cancel' }
                ]
            );
            return;
        }

        try {
            const data = await RazorpayCheckout.open(options);
            // On success
            console.log('Payment Processed. Verifying...', data);
            
            try {
                const apiUrl = getApiUrl();
                const verifyRes = await fetch(`${apiUrl}/payments/verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        razorpay_order_id: data.razorpay_order_id,
                        razorpay_payment_id: data.razorpay_payment_id,
                        razorpay_signature: data.razorpay_signature
                    })
                });
                const verifyData = await verifyRes.json();
                
                if (!verifyData.success) {
                    Alert.alert('Security Error', 'Payment signature could not be verified. Please contact support.');
                    return;
                }
            } catch (err) {
                 Alert.alert('Error', 'Payment verification failed due to network error.');
                 return;
            }

            const paymentDetailsRecord = {
                paymentId: data.razorpay_payment_id,
                orderId: data.razorpay_order_id,
                signature: data.razorpay_signature
            };
            setPaymentStatus('success');
            setPaymentDetails(paymentDetailsRecord);
            
            setLoading(true);
            try {
                // Ensure Sync finishes before proceeding to navigation/cleanup
                await syncDraftState(true, {
                    amount: subscriptionAmount,
                    ...paymentDetailsRecord
                });
                
                // Final safety await for disk operation
                await AsyncStorage.removeItem('@merchant_signup_draft');
                
                Alert.alert('Welcome!', 'Application completed successfully.');
                setLoading(false);
                
                // Final async push to pending
                setTimeout(() => {
                    router.replace('/(auth)/pending');
                }, 100);
            } catch (err) {
                setLoading(false);
                console.error('[Signup] Post-payment sync crash prevented:', err);
                Alert.alert('Warning', 'Payment verified but failed to synchronize online. Support will contact you.');
            }
        } catch (error: any) {
            console.error('Payment Error:', error);
            Alert.alert('Payment Cancelled', 'Payment failed or cancelled. Please try again.');
        }
    };

    const syncDraftState = async (finalize = false, paymentOverrides?: any) => {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData?.session) return;
        const userId = sessionData.session.user.id;

        const docUrlsLocal = {
            pan: docFiles.pan ? await uploadFile(docFiles.pan, `${userId}/pan.jpg`) : null,
            aadharFront: docFiles.aadharFront ? await uploadFile(docFiles.aadharFront, `${userId}/aadhar_front.jpg`) : null,
            aadharBack: docFiles.aadharBack ? await uploadFile(docFiles.aadharBack, `${userId}/aadhar_back.jpg`) : null,
            msme: docFiles.msme ? await uploadFile(docFiles.msme, `${userId}/msme.jpg`) : null,
            gst: docFiles.gst ? await uploadFile(docFiles.gst, `${userId}/gst.jpg`) : null,
            fssai: docFiles.fssai ? await uploadFile(docFiles.fssai, `${userId}/fssai.jpg`) : null,
        };

        const storePhotoUrls = await Promise.all(storePhotos.map((uri, idx) => uploadFile(uri, `${userId}/store_photo_${idx}.jpg`)));

        // Upload branch photos
        const branchPhotoUrls = await Promise.all(
            branches.map(async (branch, bIdx) => {
                if (!branch.photos || branch.photos.length === 0) return [];
                const urls = await Promise.all(
                    branch.photos.map((uri, pIdx) => uploadFile(uri, `${userId}/branch_${bIdx}/photo_${pIdx}.jpg`))
                );
                return urls.filter(u => u !== null) as string[];
            })
        );

        const payload = {
            ownerName: identity.ownerName,
            email: identity.email,
            phone: identity.phone,
            storeName: store.storeName,
            verticalId: store.categoryId,
            city: store.city,
            address: store.address,
            latitude: store.latitude,
            longitude: store.longitude,
            hasBranches: hasBranches,
            cuisines: store.cuisines,
            isVeg: store.isVeg,
            restaurantType: store.restaurantType,
            panNumber: kyc.panNumber,
            aadharNumber: kyc.aadharNumber,
            msmeNumber: kyc.msmeNumber,
            bankAccount: kyc.bankAccount,
            ifsc: kyc.ifsc,
            beneficiaryName: kyc.beneficiaryName,
            turnoverRange: kyc.turnoverRange,
            gstNumber: kyc.gstNumber,
            fssaiNumber: kyc.fssaiNumber,
            docUrls: docUrlsLocal,
            storePhotos: storePhotoUrls.filter(url => url !== null),
            branches: hasBranches ? branches.map((b, i) => ({
                name: b.name,
                address: b.address,
                latitude: b.latitude,
                longitude: b.longitude,
                city: b.city || store.city,
                manager_name: b.manager_name,
                phone: b.phone,
                cuisines: b.cuisines || [],
                is_veg: b.isVeg || false,
                restaurant_type: b.restaurantType || null,
                branch_photos: branchPhotoUrls[i] || [],
            })) : [],
            finalize,
            subscription: paymentOverrides
        };

        const response = await fetchWithTimeout(`${getApiUrl()}/auth/merchant/draft`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${sessionData.session.access_token}` },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || 'Server rejected synchronization');
        }
    };

    const handleNext = async () => {
        if (!validateStep()) return;
        
        if (step === 5) {
            setLoading(true);
            try {
                await syncDraftState(false);
                setStep(6);
            } catch (err: any) {
                Alert.alert('Sync Error', err.message || 'Failed to save progress to server.');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (step < 7) {
            // Note: Since step 7 logic was absorbed by Payment (Step 6), standard navigation works here.
            setStep(step + 1);
        }
    };

    const handleFinalSubmit = async () => {
        setLoading(true);
        try {
            await syncDraftState(true);
            Alert.alert('Welcome!', 'Application completed successfully.');
            await AsyncStorage.removeItem('@merchant_signup_draft');
            router.replace('/(auth)/pending');
        } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to submit application.');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else router.back();
    };

    const renderStepIndicator = () => (
        <View style={styles.stepContainer}>
            {STEPS.map((label, i) => {
                const stepNum = i + 1;
                const isActive = stepNum === step;
                const isCompleted = stepNum < step;
                return (
                    <View key={i} style={isActive ? styles.stepPill : styles.stepCircle}>
                        {isCompleted ? (
                            <Ionicons name="checkmark" size={16} color="#6B7280" />
                        ) : isActive ? (
                            <Text style={styles.stepPillText}>{label}</Text>
                        ) : (
                            <Text style={styles.stepNumber}>{stepNum}</Text>
                        )}
                    </View>
                );
            })}
        </View>
    );

    if (isRestoring) {
        return (
            <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={{ marginTop: 12, color: '#6B7280' }}>Resuming your application...</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {renderStepIndicator()}
            </View>

            <KeyboardAwareScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                enableOnAndroid={true}
                extraScrollHeight={Platform.OS === 'ios' ? 100 : 80}
                enableAutomaticScroll={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
            >
                <View style={{ flex: 1, padding: 16 }}>
                {step === 1 && <StepIdentity otp={otp} />}

                {step === 2 && <StepStore />}

                {step === 3 && <StepPhotos />}

                {step === 4 && <StepBranches />}

                {step === 5 && <StepKyc />}

                {step === 6 && <StepSubscription onPayment={handlePayment} />}

                {step === 7 && <StepReview />}
                </View>

                <View style={styles.footer}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Ionicons name="chevron-back" size={20} color="#6B7280" />
                        <Text style={styles.backButtonText}>Back</Text>
                    </TouchableOpacity>

                    <Text style={styles.stepCounter}>Step {step} of {STEPS.length}</Text>

                    <TouchableOpacity
                        style={[styles.nextButton, loading && styles.buttonDisabled]}
                        onPress={step === STEPS.length ? handleFinalSubmit : handleNext}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : step === 7 ? (
                            <>
                                <Text style={styles.nextButtonText}>Submit</Text>
                                <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                            </>
                        ) : (
                            <>
                                <Text style={styles.nextButtonText}>Next</Text>
                                <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                            </>
                        )}
                    </TouchableOpacity>
                </View>

            </KeyboardAwareScrollView>

        </SafeAreaView>
    );
}

// 2026-06-04 (Phase 1.6.B): default export is now a thin wrapper that mounts
// the SignupProvider around SignupScreenInner. All cross-step state lives in
// the provider; SignupScreenInner consumes it via useSignupContext().
export default function SignupScreen() {
    return (
        <SignupProvider>
            <SignupScreenInner />
        </SignupProvider>
    );
}
