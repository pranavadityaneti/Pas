// @lock — Do NOT overwrite. Approved layout as of March 22, 2026.
import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, StyleSheet,
    Platform, ActivityIndicator, Image, ScrollView, Modal, TouchableWithoutFeedback, Alert
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import axios from 'axios';
import { supabase, setSessionFromTokens } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Vertical, Branch, IdentityState, StoreState, KycState } from '../../src/screens/signup/shared/types';
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

let RazorpayCheckout: any = null;
if (Constants.appOwnership !== 'expo') {
    try {
        RazorpayCheckout = require('react-native-razorpay').default;
    } catch (e) {
        console.warn('Razorpay not loaded (likely in dev/sim):', e);
    }
}


// Helper to extract city from Google Places address_components
function extractCity(details: any): string {
    const component = details?.address_components?.find((c: any) =>
        c.types.includes('locality')
    );
    return component?.long_name || '';
}

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyAQAg7zpYvmd2BJGCGmf1opDLDC4KXbKUg';

const STEPS = ['Identity', 'Store', 'Photos', 'Branches', 'KYC', 'Subscription', 'Review'];

// 2026-06-04 (Phase 1.1): Vertical + Branch types extracted to
// ../../src/screens/signup/shared/types.ts — see import above.

export default function SignupScreen() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);

    // Step 1: Identity
    const [identity, setIdentity] = useState<IdentityState>({
        ownerName: '',
        phone: '',
        email: '',
    });

    // 2026-06-04 (Phase 1.4.B): OTP state + handlers extracted to
    // ../../src/screens/signup/shared/useSignupOtpVerify.ts — a mid-layer hook
    // composing useOtpPad + useSendVerifyOtp + the signup-specific duplicate-
    // merchant guard. Behavior preserved verbatim. The onVerified arrow closes
    // over fetchRemoteMerchantState (declared below in this same function) —
    // safe because the arrow is invoked only after user-triggered verify().
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

    // Step 2: Store
    const [store, setStore] = useState<StoreState>({
        storeName: '',
        categoryId: '',
        categoryName: '',
        city: 'Hyderabad',
        address: '',
        latitude: 17.385,
        longitude: 78.4867,
        cuisines: [] as string[],
        isVeg: false,
        restaurantType: '',
    });
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    const [verticals, setVerticals] = useState<Vertical[]>([]);
    const [verticalsLoading, setVerticalsLoading] = useState(false);
    const [verticalsError, setVerticalsError] = useState('');

    const fetchVerticals = async () => {
        setVerticalsLoading(true);
        setVerticalsError('');
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/verticals`, { method: 'GET' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch verticals');
            setVerticals(Array.isArray(data) ? data : data.verticals || []);
        } catch (err: any) {
            setVerticalsError(err.message || 'Error fetching verticals');
        } finally {
            setVerticalsLoading(false);
        }
    };

    useEffect(() => {
        fetchVerticals();
    }, []);

    const selectedVertical = verticals.find(v => v.id === store.categoryId);

    // Step 3: Branches
    const [hasBranches, setHasBranches] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Step 4: KYC
    const [kyc, setKyc] = useState<KycState>({
        panNumber: '',
        aadharNumber: '',
        msmeNumber: '',
        bankAccount: '',
        ifsc: '',
        turnoverRange: '<20L',
        gstNumber: '',
        fssaiNumber: '',
        beneficiaryName: '',
    });

    const [docFiles, setDocFiles] = useState<{ [key: string]: string | null }>({
        pan: null,
        aadharFront: null,
        aadharBack: null,
        msme: null,
        gst: null,
        fssai: null,
    });

    const [storePhotos, setStorePhotos] = useState<string[]>([]);

    // Step 6: Payment
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');
    const [paymentDetails, setPaymentDetails] = useState<any>(null);

    const fetchRemoteMerchantState = async (token?: string) => {
        try {
            let activeToken = token;
            if (!activeToken) {
                const { data: sessionData } = await supabase.auth.getSession();
                activeToken = sessionData?.session?.access_token;
            }
            if (!activeToken) return;

            const response = await fetchWithTimeout(`${getApiUrl()}/auth/merchant/draft`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${activeToken}` }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.subscription && data.subscription.status === 'success') {
                    console.log('[Guard] Found existing successful subscription. Bypassing Step 6.');
                    setPaymentStatus('success');
                    setPaymentDetails({
                        paymentId: data.subscription.transactionId,
                        orderId: data.subscription.orderId,
                        amount: data.subscription.amount
                    });
                    // If they are on the subscription step, move them forward
                    if (step === 6) setStep(7);
                }
            }
        } catch (err) {
            console.warn('[Guard] Pre-flight check failed:', err);
        }
    };

    // Initial Draft Restoration
    useEffect(() => {
        const loadDraft = async () => {
            try {
                const draft = await AsyncStorage.getItem('@merchant_signup_draft');
                if (draft) {
                    const parsed = JSON.parse(draft);
                    if (parsed.step) setStep(parsed.step);
                    if (parsed.identity) setIdentity(parsed.identity);
                    if (parsed.store) {
                        setStore({
                            ...parsed.store,
                            categoryId: parsed.store.categoryId || '',
                            categoryName: parsed.store.categoryName || parsed.store.category || '',
                            cuisines: parsed.store.cuisines || [],
                            isVeg: parsed.store.isVeg ?? false,
                            restaurantType: parsed.store.restaurantType || '',
                        });
                    }
                    if (parsed.hasBranches !== undefined) setHasBranches(parsed.hasBranches);
                    if (parsed.branches) setBranches(parsed.branches);
                    if (parsed.kyc) setKyc(parsed.kyc);
                    if (parsed.docFiles) setDocFiles(parsed.docFiles);
                    if (parsed.storePhotos) setStorePhotos(parsed.storePhotos);
                    console.log('[Signup] Draft restored securely. Resuming from step:', parsed.step);
                    
                    // After restoring local draft, check remote for subscription guard
                    fetchRemoteMerchantState();
                }
            } catch (e) {
                console.error('[Signup] Failed to restore draft state', e);
            } finally {
                setIsRestoring(false);
            }
        };
        loadDraft();
    }, []);

    // Debounced Draft Persistence (Saves state robustly against App Background Kills)
    useEffect(() => {
        if (isRestoring) return; // Do not overwrite draft with empty initial states during mount
        const timer = setTimeout(() => {
            const snapshot = { step, identity, store, hasBranches, branches, kyc, docFiles, storePhotos };
            AsyncStorage.setItem('@merchant_signup_draft', JSON.stringify(snapshot)).catch(e => {
                console.error('[Signup] Failed to synchronize draft with disk:', e);
            });
        }, 1000); // 1-second debounce per QA instructions
        return () => clearTimeout(timer);
    }, [step, identity, store, hasBranches, branches, kyc, docFiles, storePhotos, isRestoring]);

    const pickDocument = async (type: string) => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            setDocFiles(prev => ({ ...prev, [type]: result.assets[0].uri }));
        }
    };

    const requestLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required');
                return;
            }
            const location = await Location.getCurrentPositionAsync({});
            setStore(prev => ({
                ...prev,
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
            }));
            Alert.alert('Success', 'Location captured!');
        } catch (error) {
            Alert.alert('Error', 'Could not get location');
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

    const addBranch = () => setBranches([...branches, { name: '', address: '', latitude: null, longitude: null, city: '', manager_name: '', phone: '', cuisines: [], isVeg: false, restaurantType: '', photos: [] }]);
    const removeBranch = (i: number) => setBranches(branches.filter((_, idx) => idx !== i));
    const updateBranch = (i: number, field: keyof Branch, value: any) => {
        const updated = [...branches];
        (updated[i] as any)[field] = value;
        setBranches(updated);
    };

    const pickStorePhoto = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const uris = result.assets.map(a => a.uri);
            setStorePhotos(prev => [...prev, ...uris]);
        }
    };

    const removeStorePhoto = (idx: number) => {
        setStorePhotos(prev => prev.filter((_, i) => i !== idx));
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
                {step === 1 && (
                    <View style={styles.authLogoContainer}>
                        <Image source={require('../../assets/logo.png')} style={styles.authLogo} resizeMode="contain" />
                        <Text style={styles.authTitle}>Join Pick At Store</Text>
                        <Text style={styles.authSubtitle}>Grow your business with our partner network</Text>
                    </View>
                )}

                {step === 1 && (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="person-outline" size={20} color={Colors.primary} />
                            <Text style={styles.cardTitle}>Owner Details</Text>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Owner Name <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                placeholder="John Doe"
                                placeholderTextColor="#9CA3AF"
                                value={identity.ownerName}
                                onChangeText={(t) => setIdentity({ ...identity, ownerName: t })}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>WhatsApp Number <Text style={styles.required}>*</Text></Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 16 }}>
                                <Text style={{ fontSize: 16, color: '#6B7280', fontWeight: '600', marginRight: 8 }}>+91</Text>
                                <View style={{ width: 1, height: 24, backgroundColor: '#E5E7EB', marginRight: 8 }} />
                                <TextInput
                                    style={{ flex: 1, height: 48, fontSize: 16, color: '#111827', fontWeight: 'bold' }}
                                    placeholder="98765 43210"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="phone-pad"
                                    maxLength={10}
                                    value={identity.phone}
                                    onChangeText={(t) => setIdentity({ ...identity, phone: t })}
                                    editable={!otp.verified}
                                />
                                {otp.verified ? (
                                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                                ) : (
                                    <TouchableOpacity
                                        onPress={otp.send}
                                        disabled={loading || identity.phone.length !== 10}
                                        style={{ backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, opacity: (loading || identity.phone.length !== 10) ? 0.5 : 1 }}
                                    >
                                        <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>{otp.sent ? 'Resend' : 'Verify'}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {otp.sent && !otp.verified && (
                            <View style={styles.inputGroup}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={styles.label}>Enter 6-digit OTP</Text>
                                    {otp.resendTimer > 0 ? (
                                        <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Resend in {otp.resendTimer}s</Text>
                                    ) : null}
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                    {otp.values.map((val, i) => (
                                        <TextInput
                                            key={i}
                                            ref={ref => { otp.refs.current[i] = ref; }}
                                            style={{ width: 44, height: 52, borderWidth: 1, borderColor: val ? Colors.primary : '#E5E7EB', borderRadius: 12, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#111827', backgroundColor: val ? '#FFFFFF' : '#F9FAFB' }}
                                            maxLength={1}
                                            keyboardType="number-pad"
                                            value={val}
                                            onChangeText={(text) => otp.onChange(text, i)}
                                            onKeyPress={(e) => otp.onKeyPress(e, i)}
                                        />
                                    ))}
                                </View>

                                <TouchableOpacity
                                    style={[{ height: 52, backgroundColor: Colors.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, (loading || otp.getValue().length !== 6) && { opacity: 0.6 }]}
                                    onPress={otp.verify}
                                    disabled={loading || otp.getValue().length !== 6}
                                >
                                    {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>Verify OTP</Text>}
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                placeholder="owner@store.com"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={identity.email}
                                onChangeText={(t) => setIdentity({ ...identity, email: t })}
                            />
                        </View>
                    </View>
                )}

                {step === 2 && (
                    <>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="storefront-outline" size={20} color={Colors.primary} />
                                <Text style={styles.cardTitle}>Store Information</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Store Name <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="My Kirana Store"
                                    placeholderTextColor="#9CA3AF"
                                    value={store.storeName}
                                    onChangeText={(t) => setStore({ ...store, storeName: t })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity
                                    style={styles.selectInput}
                                    onPress={() => setShowCategoryPicker(true)}
                                >
                                    <Text style={store.categoryId ? styles.selectText : styles.selectPlaceholder}>
                                        {store.categoryName || 'Select category'}
                                    </Text>
                                    <Ionicons name="chevron-down" size={20} color="#6B7280" />
                                </TouchableOpacity>

                                <Modal
                                    visible={showCategoryPicker}
                                    transparent={true}
                                    animationType="fade"
                                    onRequestClose={() => setShowCategoryPicker(false)}
                                >
                                    <TouchableWithoutFeedback onPress={() => setShowCategoryPicker(false)}>
                                        <View style={styles.modalOverlay}>
                                            <View style={styles.modalContent}>
                                                <Text style={styles.modalTitle}>Select Category</Text>
                                                {verticalsLoading ? (
                                                    <ActivityIndicator size="large" color={Colors.primary} style={{ marginVertical: 20 }} />
                                                ) : verticalsError ? (
                                                    <View style={{ alignItems: 'center', padding: 20 }}>
                                                        <Text style={{ color: '#EF4444', textAlign: 'center', marginBottom: 12 }}>{verticalsError}</Text>
                                                        <TouchableOpacity onPress={fetchVerticals} style={{ padding: 8, backgroundColor: Colors.primary, borderRadius: 8 }}>
                                                            <Text style={{ color: '#FFF' }}>Retry</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ) : (
                                                    <ScrollView style={{ maxHeight: 300 }}>
                                                        {verticals.map((v) => (
                                                            <TouchableOpacity
                                                                key={v.id}
                                                                style={styles.modalItem}
                                                                onPress={() => {
                                                                    setStore({ ...store, categoryId: v.id, categoryName: v.name });
                                                                    setShowCategoryPicker(false);
                                                                }}
                                                            >
                                                                <Text style={[
                                                                    styles.modalItemText,
                                                                    store.categoryId === v.id && styles.modalItemTextActive
                                                                ]}>{v.name}</Text>
                                                                {store.categoryId === v.id && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                                                            </TouchableOpacity>
                                                        ))}
                                                    </ScrollView>
                                                )}
                                                <TouchableOpacity
                                                    style={styles.modalCloseBtn}
                                                    onPress={() => setShowCategoryPicker(false)}
                                                >
                                                    <Text style={styles.modalCloseText}>Close</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </TouchableWithoutFeedback>
                                </Modal>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>City</Text>
                                <TextInput
                                    style={styles.input}
                                    value={store.city}
                                    onChangeText={(t) => setStore({ ...store, city: t })}
                                />
                            </View>
                        </View>

                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="location-outline" size={20} color={Colors.primary} />
                                <Text style={styles.cardTitle}>Store Location</Text>
                            </View>

                            <TouchableOpacity style={styles.locationButton} onPress={requestLocation}>
                                <Ionicons name="navigate" size={20} color={Colors.primary} />
                                <Text style={styles.locationButtonText}>Use My Current Location</Text>
                            </TouchableOpacity>

                            <View style={{ height: 200, borderRadius: 12, overflow: 'hidden', marginVertical: 12 }}>
                                <MapView
                                    provider={PROVIDER_GOOGLE}
                                    style={{ flex: 1 }}
                                    region={{
                                        latitude: store.latitude,
                                        longitude: store.longitude,
                                        latitudeDelta: 0.005,
                                        longitudeDelta: 0.005,
                                    }}
                                >
                                    <Marker coordinate={{ latitude: store.latitude, longitude: store.longitude }} />
                                </MapView>
                            </View>
                            <Text style={styles.coordinatesText}>
                                📍 {store.latitude.toFixed(5)}, {store.longitude.toFixed(5)}
                            </Text>

                            <View style={[styles.inputGroup, { zIndex: 9999 }]}>
                                <Text style={styles.label}>Full Address</Text>
                                <GooglePlacesAutocomplete
                                    placeholder="Search store address..."
                                    fetchDetails={true}
                                    onPress={(data, details = null) => {
                                        const city = extractCity(details);
                                        setStore((prev) => ({
                                            ...prev,
                                            address: details?.formatted_address || data.description,
                                            latitude: details?.geometry?.location?.lat ?? prev.latitude,
                                            longitude: details?.geometry?.location?.lng ?? prev.longitude,
                                            city: city || prev.city,
                                        }));
                                    }}
                                    onFail={(error) => {
                                        console.error('Google API Error:', error);
                                    }}
                                    textInputProps={{
                                        onChangeText: (text: string) => {
                                            setStore((prev) => ({ ...prev, address: text }));
                                        },
                                        placeholderTextColor: '#9CA3AF',
                                    }}
                                    query={{
                                        key: GOOGLE_MAPS_API_KEY,
                                        language: 'en',
                                        components: 'country:in',
                                    }}
                                    styles={{
                                        container: { flex: 0, width: '100%', zIndex: 9999 },
                                        textInput: {
                                            borderWidth: 1,
                                            borderColor: '#E5E7EB',
                                            borderRadius: 8,
                                            height: 50,
                                            paddingHorizontal: 16,
                                            backgroundColor: '#F9FAFB',
                                            fontSize: 16,
                                            color: '#000',
                                        },
                                        listView: {
                                            position: 'absolute',
                                            top: 50,
                                            zIndex: 10000,
                                            elevation: 10000,
                                            backgroundColor: 'white',
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 2 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 3.84,
                                            borderRadius: 8,
                                        },
                                        row: { paddingVertical: 12, paddingHorizontal: 12 },
                                        description: { fontSize: 14, color: '#374151' },
                                        separator: { height: 1, backgroundColor: '#F3F4F6' },
                                    }}
                                    enablePoweredByContainer={false}
                                    debounce={300}
                                    minLength={3}
                                    nearbyPlacesAPI="GooglePlacesSearch"
                                />
                            </View>
                        </View>

                        {selectedVertical?.isDining && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="restaurant-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.cardTitle}>Restaurant Details</Text>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Restaurant Type</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {['Casual Dining', 'Fine Dining', 'Cafe', 'Quick Service', 'Dhaba', 'Cloud Kitchen'].map((t) => (
                                            <TouchableOpacity
                                                key={t}
                                                onPress={() => setStore({ ...store, restaurantType: t })}
                                                style={{
                                                    paddingHorizontal: 14,
                                                    paddingVertical: 8,
                                                    borderRadius: 20,
                                                    borderWidth: 1,
                                                    borderColor: store.restaurantType === t ? Colors.primary : '#E5E7EB',
                                                    backgroundColor: store.restaurantType === t ? Colors.primary : '#FFFFFF',
                                                }}
                                            >
                                                <Text style={{ fontSize: 13, fontWeight: '600', color: store.restaurantType === t ? '#FFFFFF' : '#374151' }}>{t}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <Text style={styles.label}>Cuisines (select all that apply)</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                        {['North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'].map((c) => {
                                            const selected = store.cuisines.includes(c);
                                            return (
                                                <TouchableOpacity
                                                    key={c}
                                                    onPress={() => {
                                                        const next = selected
                                                            ? store.cuisines.filter(x => x !== c)
                                                            : [...store.cuisines, c];
                                                        setStore({ ...store, cuisines: next });
                                                    }}
                                                    style={{
                                                        paddingHorizontal: 14,
                                                        paddingVertical: 8,
                                                        borderRadius: 20,
                                                        borderWidth: 1,
                                                        borderColor: selected ? Colors.primary : '#E5E7EB',
                                                        backgroundColor: selected ? Colors.primary : '#FFFFFF',
                                                    }}
                                                >
                                                    <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? '#FFFFFF' : '#374151' }}>{c}</Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>

                                <View style={styles.inputGroup}>
                                    <TouchableOpacity
                                        onPress={() => setStore({ ...store, isVeg: !store.isVeg })}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 14,
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: store.isVeg ? '#10B981' : '#E5E7EB',
                                            backgroundColor: store.isVeg ? '#ECFDF5' : '#FFFFFF',
                                        }}
                                    >
                                        <View style={{
                                            width: 20, height: 20, borderRadius: 4, borderWidth: 2,
                                            borderColor: store.isVeg ? '#10B981' : '#9CA3AF',
                                            backgroundColor: store.isVeg ? '#10B981' : 'transparent',
                                            alignItems: 'center', justifyContent: 'center', marginRight: 12,
                                        }}>
                                            {store.isVeg && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>Pure Vegetarian Restaurant</Text>
                                            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>We do not serve any non-vegetarian items</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </>
                )}

                {step === 3 && (
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Ionicons name="images-outline" size={20} color={Colors.primary} />
                            <Text style={styles.cardTitle}>Store Photos <Text style={styles.required}>*</Text></Text>
                        </View>
                        <Text style={styles.label}>Please upload at least 2 photos of your store (Front view, Inside view, etc.)</Text>

                        <View style={styles.photoGrid}>
                            {storePhotos.map((uri, idx) => (
                                <View key={idx} style={styles.photoWrapper}>
                                    <Image source={{ uri }} style={styles.photoBox} resizeMode="cover" />
                                    <TouchableOpacity style={styles.removePhoto} onPress={() => removeStorePhoto(idx)}>
                                        <Ionicons name="close-circle" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            {storePhotos.length < 5 && (
                                <TouchableOpacity style={styles.addPhotoBox} onPress={pickStorePhoto}>
                                    <Ionicons name="add" size={32} color={Colors.primary} />
                                    <Text style={styles.addPhotoText}>Add Photo</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text style={styles.photoCounter}>{storePhotos.length} / 5 photos selected</Text>
                    </View>
                )}

                {step === 4 && (
                    <>
                        <View style={styles.card}>
                            <TouchableOpacity
                                style={styles.checkboxRow}
                                onPress={() => setHasBranches(!hasBranches)}
                            >
                                <View style={[styles.checkbox, hasBranches && styles.checkboxChecked]}>
                                    {hasBranches && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                                </View>
                                <View>
                                    <Text style={styles.checkboxLabel}>Do you have other branches?</Text>
                                    <Text style={styles.checkboxHint}>Enable if you manage multiple outlets</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {hasBranches && (
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <Ionicons name="git-branch-outline" size={20} color={Colors.primary} />
                                    <Text style={styles.cardTitle}>Branches</Text>
                                    <TouchableOpacity style={styles.addButton} onPress={addBranch}>
                                        <Ionicons name="add" size={18} color={Colors.primary} />
                                        <Text style={styles.addButtonText}>Add</Text>
                                    </TouchableOpacity>
                                </View>

                                {branches.length === 0 ? (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyText}>No branches added yet</Text>
                                    </View>
                                ) : (
                                    branches.map((branch, i) => (
                                        <View key={i} style={styles.branchCard}>
                                            <View style={styles.branchHeader}>
                                                <Text style={styles.branchTitle}>Branch {i + 1}</Text>
                                                <TouchableOpacity onPress={() => removeBranch(i)}>
                                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="Branch Name"
                                                placeholderTextColor="#9CA3AF"
                                                value={branch.name}
                                                onChangeText={(t) => updateBranch(i, 'name', t)}
                                            />
                                            <View style={{ marginTop: 8, zIndex: 9000 - i }}>
                                                <GooglePlacesAutocomplete
                                                    placeholder="Search branch address..."
                                                    fetchDetails={true}
                                                    onPress={(data, details = null) => {
                                                        const city = extractCity(details);
                                                        setBranches((prev) => prev.map((b, idx) => idx === i ? {
                                                            ...b,
                                                            address: details?.formatted_address || data.description,
                                                            latitude: details?.geometry?.location?.lat ?? null,
                                                            longitude: details?.geometry?.location?.lng ?? null,
                                                            city: city || b.city,
                                                        } : b));
                                                    }}
                                                    onFail={(error) => {
                                                        console.error('Google API Error:', error);
                                                    }}
                                                    textInputProps={{
                                                        onChangeText: (text: string) => {
                                                            setBranches((prev) => prev.map((b, idx) => idx === i ? { ...b, address: text, latitude: null, longitude: null } : b));
                                                        },
                                                        placeholderTextColor: '#9CA3AF',
                                                    }}
                                                    query={{
                                                        key: GOOGLE_MAPS_API_KEY,
                                                        language: 'en',
                                                        components: 'country:in',
                                                    }}
                                                    styles={{
                                                        container: { flex: 0, width: '100%', zIndex: 9000 - i },
                                                        textInput: {
                                                            borderWidth: 1,
                                                            borderColor: '#E5E7EB',
                                                            borderRadius: 8,
                                                            height: 50,
                                                            paddingHorizontal: 16,
                                                            backgroundColor: '#F9FAFB',
                                                            fontSize: 16,
                                                            color: '#000',
                                                        },
                                                        listView: {
                                                            position: 'absolute',
                                                            top: 50,
                                                            zIndex: 10000,
                                                            elevation: 10000,
                                                            backgroundColor: 'white',
                                                            shadowColor: '#000',
                                                            shadowOffset: { width: 0, height: 2 },
                                                            shadowOpacity: 0.25,
                                                            shadowRadius: 3.84,
                                                            borderRadius: 8,
                                                        },
                                                        row: { paddingVertical: 12, paddingHorizontal: 12 },
                                                        description: { fontSize: 14, color: '#374151' },
                                                        separator: { height: 1, backgroundColor: '#F3F4F6' },
                                                    }}
                                                    enablePoweredByContainer={false}
                                                    debounce={300}
                                                    minLength={3}
                                                    nearbyPlacesAPI="GooglePlacesSearch"
                                                />
                                                {branch.latitude !== null && branch.longitude !== null && (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                                                        <Ionicons name="location" size={12} color="#10B981" />
                                                        <Text style={{ fontSize: 12, color: '#10B981', fontWeight: '600' }}>
                                                            📍 {branch.latitude.toFixed(5)}, {branch.longitude.toFixed(5)}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                                                <TextInput
                                                    style={[styles.input, { flex: 1 }]}
                                                    placeholder="Manager Name"
                                                    placeholderTextColor="#9CA3AF"
                                                    value={branch.manager_name}
                                                    onChangeText={(t) => updateBranch(i, 'manager_name', t)}
                                                />
                                                <TextInput
                                                    style={[styles.input, { flex: 1 }]}
                                                    placeholder="Manager Phone"
                                                    placeholderTextColor="#9CA3AF"
                                                    keyboardType="phone-pad"
                                                    value={branch.phone}
                                                    onChangeText={(t) => updateBranch(i, 'phone', t)}
                                                />
                                            </View>

                                            {/* Dining fields per branch */}
                                            {selectedVertical?.isDining && (
                                                <View style={{ marginTop: 12 }}>
                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Restaurant Type</Text>
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                        {['Casual Dining', 'Fine Dining', 'Cafe', 'Quick Service', 'Dhaba', 'Cloud Kitchen'].map(t => (
                                                            <TouchableOpacity key={t} onPress={() => updateBranch(i, 'restaurantType', branch.restaurantType === t ? '' : t)}
                                                                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: branch.restaurantType === t ? Colors.primary : '#E5E7EB', backgroundColor: branch.restaurantType === t ? Colors.primary : '#fff' }}>
                                                                <Text style={{ fontSize: 12, fontWeight: '600', color: branch.restaurantType === t ? '#fff' : '#374151' }}>{t}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>

                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 }}>Cuisines</Text>
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                                                        {['North Indian', 'South Indian', 'Chinese', 'Street Food', 'Mughlai', 'Continental', 'Italian', 'Multi-Cuisine'].map(c => {
                                                            const sel = branch.cuisines?.includes(c);
                                                            return (
                                                                <TouchableOpacity key={c} onPress={() => {
                                                                    const next = sel ? branch.cuisines.filter(x => x !== c) : [...(branch.cuisines || []), c];
                                                                    updateBranch(i, 'cuisines', next);
                                                                }}
                                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: sel ? Colors.primary : '#E5E7EB', backgroundColor: sel ? Colors.primary : '#fff' }}>
                                                                    <Text style={{ fontSize: 12, fontWeight: '600', color: sel ? '#fff' : '#374151' }}>{c}</Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>

                                                    <TouchableOpacity onPress={() => updateBranch(i, 'isVeg', !branch.isVeg)}
                                                        style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: branch.isVeg ? '#10B981' : '#E5E7EB', backgroundColor: branch.isVeg ? '#ECFDF5' : '#fff' }}>
                                                        <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: branch.isVeg ? '#10B981' : '#9CA3AF', backgroundColor: branch.isVeg ? '#10B981' : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                                                            {branch.isVeg && <Ionicons name="checkmark" size={12} color="#fff" />}
                                                        </View>
                                                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>Pure Vegetarian</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            {/* Branch Photos */}
                                            <View style={{ marginTop: 12 }}>
                                                <Text style={{ fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 6 }}>Photos ({branch.photos?.length || 0}/5)</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                    {(branch.photos || []).map((photo, pIdx) => (
                                                        <View key={pIdx} style={{ width: 64, height: 64, borderRadius: 8, marginRight: 8, position: 'relative' }}>
                                                            <Image source={{ uri: photo }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#F3F4F6' }} />
                                                            <TouchableOpacity onPress={() => updateBranch(i, 'photos', branch.photos.filter((_: any, pi: number) => pi !== pIdx))} style={{ position: 'absolute', top: -4, right: -4 }}>
                                                                <Ionicons name="close-circle" size={18} color="#EF4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                    {(branch.photos?.length || 0) < 5 && (
                                                        <TouchableOpacity
                                                            onPress={async () => {
                                                                const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsMultipleSelection: true, selectionLimit: 5 - (branch.photos?.length || 0), quality: 0.7 });
                                                                if (!result.canceled && result.assets) {
                                                                    updateBranch(i, 'photos', [...(branch.photos || []), ...result.assets.map(a => a.uri)].slice(0, 5));
                                                                }
                                                            }}
                                                            style={{ width: 64, height: 64, borderRadius: 8, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' }}>
                                                            <Ionicons name="camera-outline" size={20} color="#9CA3AF" />
                                                        </TouchableOpacity>
                                                    )}
                                                </ScrollView>
                                            </View>
                                        </View>
                                    ))
                                )}
                            </View>
                        )}

                        {!hasBranches && (
                            <View style={styles.emptyCard}>
                                <Ionicons name="storefront-outline" size={48} color="#E5E7EB" />
                                <Text style={styles.emptyCardTitle}>Single Store Operation</Text>
                            </View>
                        )}
                    </>
                )}

                {step === 5 && (
                    <>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={Colors.primary} />
                                <Text style={styles.cardTitle}>KYC Details</Text>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Annual Turnover <Text style={styles.required}>*</Text></Text>
                                <View style={styles.turnoverGrid}>
                                    {['<20L', '20L-40L', '40L-1Cr', '>1Cr'].map((range) => (
                                        <TouchableOpacity
                                            key={range}
                                            style={[
                                                styles.turnoverButton,
                                                kyc.turnoverRange === range && styles.turnoverButtonActive
                                            ]}
                                            onPress={() => setKyc({ ...kyc, turnoverRange: range })}
                                        >
                                            <Text style={[
                                                styles.turnoverTextOption,
                                                kyc.turnoverRange === range && styles.turnoverTextActive
                                            ]}>{range}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Upload PAN Card <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('pan')}>
                                    <Ionicons name={docFiles.pan ? "checkmark-circle" : "cloud-upload-outline"} size={22} color={docFiles.pan ? "#10B981" : Colors.primary} />
                                    <Text style={[styles.uploadText, docFiles.pan && { color: '#10B981' }]}>{docFiles.pan ? "PAN Image Selected" : "Tap to Upload PAN"}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>PAN Number <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="ABCDE1234F"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="characters"
                                    maxLength={10}
                                    value={kyc.panNumber}
                                    onChangeText={(t) => setKyc({ ...kyc, panNumber: t.toUpperCase() })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Upload Aadhaar (Front) <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('aadharFront')}>
                                    <Ionicons name={docFiles.aadharFront ? "checkmark-circle" : "cloud-upload-outline"} size={22} color={docFiles.aadharFront ? "#10B981" : "#6366F1"} />
                                    <Text style={[styles.uploadText, docFiles.aadharFront && { color: '#10B981' }]}>{docFiles.aadharFront ? "Front Selected" : "Upload Front Side"}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Upload Aadhaar (Back) <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('aadharBack')}>
                                    <Ionicons name={docFiles.aadharBack ? "checkmark-circle" : "cloud-upload-outline"} size={22} color={docFiles.aadharBack ? "#10B981" : "#6366F1"} />
                                    <Text style={[styles.uploadText, docFiles.aadharBack && { color: '#10B981' }]}>{docFiles.aadharBack ? "Back Selected" : "Upload Back Side"}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Aadhaar Number <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="1234 5678 9012"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    maxLength={12}
                                    value={kyc.aadharNumber}
                                    onChangeText={(t) => setKyc({ ...kyc, aadharNumber: t })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Upload GST Certificate <Text style={styles.required}>*</Text></Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('gst')}>
                                    <Ionicons name={docFiles.gst ? "checkmark-circle" : "cloud-upload-outline"} size={22} color={docFiles.gst ? "#10B981" : "#6366F1"} />
                                    <Text style={[styles.uploadText, docFiles.gst && { color: '#10B981' }]}>{docFiles.gst ? "GST Certificate Selected" : "Upload GST Certificate"}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>GSTIN <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="22AAAAA0000A1Z5"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="characters"
                                    maxLength={15}
                                    value={kyc.gstNumber}
                                    onChangeText={(t) => setKyc({ ...kyc, gstNumber: t.toUpperCase() })}
                                />
                            </View>

                            {selectedVertical?.requiresFssai && (
                                <>
                                    <View style={styles.divider} />
                                    <Text style={styles.sectionHeader}>Food Safety (FSSAI)</Text>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>FSSAI License Number <Text style={styles.required}>*</Text></Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="14-digit License Number"
                                            placeholderTextColor="#9CA3AF"
                                            keyboardType="number-pad"
                                            maxLength={14}
                                            value={kyc.fssaiNumber}
                                            onChangeText={(t) => setKyc({ ...kyc, fssaiNumber: t })}
                                        />
                                    </View>

                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Upload FSSAI License <Text style={styles.required}>*</Text></Text>
                                        <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('fssai')}>
                                            <Ionicons name={docFiles.fssai ? "checkmark-circle" : "cloud-upload-outline"} size={22} color={docFiles.fssai ? "#10B981" : "#6366F1"} />
                                            <Text style={[styles.uploadText, docFiles.fssai && { color: '#10B981' }]}>{docFiles.fssai ? "License Selected" : "Upload License"}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.divider} />
                                </>
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Upload MSME / Udyam Certificate (Optional)</Text>
                                <TouchableOpacity style={styles.uploadButton} onPress={() => pickDocument('msme')}>
                                    <Ionicons name={docFiles.msme ? "checkmark-circle" : "cloud-upload-outline"} size={22} color={docFiles.msme ? "#10B981" : "#6366F1"} />
                                    <Text style={[styles.uploadText, docFiles.msme && { color: '#10B981' }]}>{docFiles.msme ? "Certificate Selected" : "Upload Certificate"}</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>MSME Number (Optional)</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="UDYAM-XX-00-0000000"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="characters"
                                    maxLength={19}
                                    value={kyc.msmeNumber}
                                    onChangeText={(t) => setKyc({ ...kyc, msmeNumber: t.toUpperCase() })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Bank Account Number <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Enter account number"
                                    placeholderTextColor="#9CA3AF"
                                    keyboardType="number-pad"
                                    maxLength={18}
                                    value={kyc.bankAccount}
                                    onChangeText={(t) => setKyc({ ...kyc, bankAccount: t })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>IFSC Code <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="SBIN0001234"
                                    placeholderTextColor="#9CA3AF"
                                    autoCapitalize="characters"
                                    maxLength={11}
                                    value={kyc.ifsc}
                                    onChangeText={(t) => setKyc({ ...kyc, ifsc: t.toUpperCase() })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Beneficiary Name <Text style={styles.required}>*</Text></Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Name as per bank records"
                                    placeholderTextColor="#9CA3AF"
                                    value={kyc.beneficiaryName}
                                    onChangeText={(t) => setKyc({ ...kyc, beneficiaryName: t })}
                                />
                            </View>


                        </View>
                    </>
                )}

                {step === 6 && (
                    <View style={styles.card}>
                        <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>Partner Subscription</Text>
                            <Text style={{ fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Unlock generic analytics, premium support, and unlimited listings with lifetime access.</Text>

                            <View style={{
                                backgroundColor: '#FFFFFF',
                                borderRadius: 16,
                                padding: 24,
                                width: '100%',
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#E5E7EB',
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.05,
                                shadowRadius: 4,
                                elevation: 2
                            }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: Colors.primary, marginBottom: 12 }}>LIFETIME ACCESS</Text>

                                <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 24 }}>
                                    <Text style={{ fontSize: 20, color: '#9CA3AF', textDecorationLine: 'line-through', marginRight: 12 }}>
                                        {selectedVertical?.isPremium ? '₹4999' : '₹2499'}
                                    </Text>
                                    <Text style={{ fontSize: 40, fontWeight: '800', color: '#10B981' }}>
                                        {selectedVertical?.isPremium ? '₹2999' : '₹999'}
                                    </Text>
                                </View>

                                <View style={{ width: '100%', paddingHorizontal: 10 }}>
                                    {['Unlimited Listings', 'Premium Support', 'Store Analytics'].map((feat, i) => (
                                        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                            <Ionicons name="checkmark-circle" size={20} color="#10B981" style={{ marginRight: 10 }} />
                                            <Text style={{ fontSize: 16, color: '#374151' }}>{feat}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {paymentStatus === 'success' ? (
                                <View style={{ marginTop: 24, alignItems: 'center' }}>
                                    <Ionicons name="checkmark-circle" size={64} color="#10B981" />
                                    <Text style={{ fontSize: 18, fontWeight: '600', color: '#10B981', marginTop: 12 }}>Payment Successful!</Text>
                                    <Text style={{ color: '#6B7280', marginTop: 4 }}>Transaction ID: {paymentDetails?.paymentId}</Text>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={{
                                        backgroundColor: Colors.primary,
                                        width: '100%',
                                        paddingVertical: 16,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        marginTop: 32,
                                        flexDirection: 'row',
                                        justifyContent: 'center'
                                    }}
                                    onPress={handlePayment}
                                >
                                    <Ionicons name="lock-closed" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>Pay & Unlock</Text>
                                </TouchableOpacity>
                            )}

                            <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' }}>
                                <View style={{ height: 1, backgroundColor: '#E5E7EB', flex: 1 }} />
                                <Text style={{ marginHorizontal: 10, color: '#9CA3AF', fontSize: 12 }}>Secure Payment via Razorpay</Text>
                                <View style={{ height: 1, backgroundColor: '#E5E7EB', flex: 1 }} />
                            </View>
                        </View>
                    </View>
                )}

                {step === 7 && (
                    <>
                        <View style={[styles.card, styles.successCard]}>
                            <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                            <Text style={styles.successTitle}>Ready to Submit!</Text>
                            <Text style={styles.successText}>
                                Your application will be reviewed within 24-48 hours.
                            </Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.reviewTitle}>Complete Summary</Text>

                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>Identity & Store</Text>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Owner</Text><Text style={styles.reviewValue}>{identity.ownerName}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Phone</Text><Text style={styles.reviewValue}>{identity.phone || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Email</Text><Text style={styles.reviewValue}>{identity.email || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Store Name</Text><Text style={styles.reviewValue}>{store.storeName}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category</Text><Text style={styles.reviewValue}>{store.categoryName}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>City</Text><Text style={styles.reviewValue}>{store.city}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Address</Text><Text style={[styles.reviewValue, {flex: 2, textAlign: 'right'}]} numberOfLines={2}>{store.address || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Location Pin</Text><Text style={styles.reviewValue}>{store.latitude && store.longitude ? 'Captured' : 'Missing'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Has Branches</Text><Text style={styles.reviewValue}>{hasBranches ? 'Yes' : 'No'}</Text></View>
                            {hasBranches && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Branches Added</Text><Text style={styles.reviewValue}>{branches.length}</Text></View>}
                            
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>KYC & Financials</Text>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>PAN Number</Text><Text style={styles.reviewValue}>{kyc.panNumber || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhar Number</Text><Text style={styles.reviewValue}>{kyc.aadharNumber || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>GSTIN</Text><Text style={styles.reviewValue}>{kyc.gstNumber || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>MSME Number</Text><Text style={styles.reviewValue}>{kyc.msmeNumber || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>FSSAI Number</Text><Text style={styles.reviewValue}>{kyc.fssaiNumber || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Bank Account</Text><Text style={styles.reviewValue}>{kyc.bankAccount ? `XXXX${kyc.bankAccount.slice(-4)}` : '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>IFSC Code</Text><Text style={styles.reviewValue}>{kyc.ifsc || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Beneficiary Name</Text><Text style={styles.reviewValue}>{kyc.beneficiaryName || '-'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Turnover Range</Text><Text style={styles.reviewValue}>{kyc.turnoverRange || '-'}</Text></View>

                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>Document Verification</Text>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Store Photos</Text><Text style={{...styles.reviewValue, color: storePhotos.length > 0 ? '#10B981' : '#EF4444'}}>{storePhotos.length > 0 ? `${storePhotos.length} Uploaded` : 'Missing'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>PAN Document</Text><Text style={{...styles.reviewValue, color: docFiles.pan ? '#10B981' : '#EF4444'}}>{docFiles.pan ? 'Uploaded' : 'Missing'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Aadhar Documents</Text><Text style={{...styles.reviewValue, color: (docFiles.aadharFront && docFiles.aadharBack) ? '#10B981' : '#EF4444'}}>{docFiles.aadharFront && docFiles.aadharBack ? 'Front & Back Uploaded' : 'Missing'}</Text></View>
                            {kyc.gstNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>GST Certificate</Text><Text style={{...styles.reviewValue, color: docFiles.gst ? '#10B981' : '#EF4444'}}>{docFiles.gst ? 'Uploaded' : 'Missing'}</Text></View>}
                            {kyc.msmeNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>MSME Certificate</Text><Text style={{...styles.reviewValue, color: docFiles.msme ? '#10B981' : '#EF4444'}}>{docFiles.msme ? 'Uploaded' : 'Missing'}</Text></View>}
                            {kyc.fssaiNumber && <View style={styles.reviewRow}><Text style={styles.reviewLabel}>FSSAI Certificate</Text><Text style={{...styles.reviewValue, color: docFiles.fssai ? '#10B981' : '#EF4444'}}>{docFiles.fssai ? 'Uploaded' : 'Missing'}</Text></View>}

                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#111827', marginTop: 16, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E5E7EB', paddingBottom: 4 }}>Subscription & Payment</Text>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category Tier</Text><Text style={styles.reviewValue}>{selectedVertical?.isPremium ? 'Premium' : 'Standard'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Lifetime Access</Text><Text style={styles.reviewValue}>{selectedVertical?.isPremium ? '₹2999' : '₹999'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Payment Status</Text><Text style={{...styles.reviewValue, color: '#10B981'}}>{paymentStatus === 'success' ? 'Successful' : 'Simulated'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Transaction ID</Text><Text style={styles.reviewValue}>{paymentDetails?.paymentId || 'Verified'}</Text></View>
                        </View>
                    </>
                )}
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    stepContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    stepPill: { paddingHorizontal: 18, height: 36, borderRadius: 18, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
    stepPillText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.5 },
    stepNumber: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
    content: { flex: 1 },
    contentContainer: { flexGrow: 1, backgroundColor: '#F9FAFB' },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8, flex: 1 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 },
    required: { color: '#EF4444' },
    input: { height: 48, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, fontSize: 16, color: '#111827', backgroundColor: '#FFFFFF' },
    textArea: { height: 80, paddingTop: 12, textAlignVertical: 'top' },
    selectInput: { height: 48, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    selectText: { fontSize: 16, color: '#111827' },
    selectPlaceholder: { fontSize: 16, color: '#9CA3AF' },
    pickerContainer: { marginTop: 8, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#FFFFFF' },
    pickerItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    pickerItemText: { fontSize: 15, color: '#374151' },
    locationButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 48, borderWidth: 1, borderColor: Colors.primary + '30', borderRadius: 12, backgroundColor: Colors.primary + '08', marginBottom: 12 },
    locationButtonText: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginLeft: 8 },
    coordinatesText: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
    checkboxRow: { flexDirection: 'row', alignItems: 'flex-start' },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 },
    checkboxChecked: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    checkboxLabel: { fontSize: 16, fontWeight: '600', color: '#111827' },
    checkboxHint: { fontSize: 13, color: '#6B7280', marginTop: 4 },
    addButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.primary + '08' },
    addButtonText: { fontSize: 13, fontWeight: '600', color: Colors.primary, marginLeft: 4 },
    emptyState: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
    emptyCard: { backgroundColor: '#F9FAFB', borderRadius: 16, padding: 40, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    emptyCardTitle: { fontSize: 16, fontWeight: '600', color: '#6B7280', marginTop: 12 },
    branchCard: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 16, marginBottom: 12 },
    branchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    branchTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
    successCard: { alignItems: 'center', backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
    successTitle: { fontSize: 18, fontWeight: '700', color: '#065F46', marginTop: 12 },
    successText: { fontSize: 14, color: '#047857', textAlign: 'center', marginTop: 8 },
    reviewTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
    reviewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    reviewLabel: { fontSize: 14, color: '#6B7280' },
    reviewValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#fff', borderRadius: 16, padding: 20, maxHeight: 400 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center' },
    modalItem: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalItemText: { fontSize: 16, color: '#374151' },
    modalItemTextActive: { color: Colors.primary, fontWeight: '600' },
    modalCloseBtn: { marginTop: 16, padding: 12, backgroundColor: '#F3F4F6', borderRadius: 12, alignItems: 'center' },
    modalCloseText: { fontWeight: '600', color: '#374151' },
    divider: { height: 1, backgroundColor: '#E5E7EB', marginVertical: 20 },
    sectionHeader: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 16 },
    backButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
    backButtonText: { fontSize: 15, color: '#6B7280', marginLeft: 4 },
    stepCounter: { fontSize: 13, color: '#9CA3AF' },
    nextButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
    nextButtonText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF', marginRight: 4 },
    buttonDisabled: { opacity: 0.6 },
    uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderWidth: 1, borderColor: Colors.primary + '30', borderRadius: 8, backgroundColor: Colors.primary + '08', marginBottom: 12 },
    uploadText: { marginLeft: 8, color: Colors.primary, fontWeight: '600', fontSize: 13 },
    photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    photoWrapper: { width: 80, height: 80, position: 'relative' },
    photoBox: { width: '100%', height: '100%', backgroundColor: '#F3F4F6', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
    removePhoto: { position: 'absolute', top: -8, right: -8, backgroundColor: '#FFFFFF', borderRadius: 10 },
    addPhotoBox: { width: 80, height: 80, backgroundColor: Colors.primary + '08', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 2, borderColor: Colors.primary + '30' },
    addPhotoText: { fontSize: 10, color: Colors.primary, fontWeight: '600', marginTop: 4 },
    photoCounter: { fontSize: 12, color: '#9CA3AF', marginTop: 12, textAlign: 'center' },
    turnoverGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    turnoverButton: { flex: 1, minWidth: '45%', height: 44, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
    turnoverButtonActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },
    turnoverTextOption: { fontSize: 14, color: '#374151', fontWeight: '500' },
    turnoverTextActive: { color: Colors.primary, fontWeight: '700' },
    authLogoContainer: {
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 8,
    },
    authLogo: {
        width: 100,
        height: 100,
        marginBottom: 12,
    },
    authTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 4,
    },
    authSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
});
