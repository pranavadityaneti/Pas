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
import { SignupProvider, useSignupContext } from '../../src/screens/signup/shared/SignupContext';
import { styles } from '../../src/screens/signup/shared/signupStyles';
import { StepIdentity } from '../../src/screens/signup/steps/StepIdentity';
import { StepPhotos } from '../../src/screens/signup/steps/StepPhotos';
import { StepReview } from '../../src/screens/signup/steps/StepReview';

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

    // 2026-06-04 (Phase 1.6.B): showCategoryPicker is purely local UI state
    // (Step 2 category-picker modal open/closed). Stays in this component
    // because no other step reads it. Phase 1.7 will move it into the Step 2
    // component when the screen is split.
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

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

                {step === 3 && <StepPhotos />}

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
