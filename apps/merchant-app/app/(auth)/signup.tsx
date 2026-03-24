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
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import axios from 'axios';
import { supabase, setSessionFromTokens } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

let RazorpayCheckout: any = null;
if (Constants.appOwnership !== 'expo') {
    try {
        RazorpayCheckout = require('react-native-razorpay').default;
    } catch (e) {
        console.warn('Razorpay not loaded (likely in dev/sim):', e);
    }
}


const STEPS = ['Identity', 'Store', 'Photos', 'Branches', 'KYC', 'Subscription', 'Review'];

const STORE_CATEGORIES = [
    'Grocery & Kirana', 'Fruits & Vegetables', 'Restaurants & Cafes', 
    'Bakeries & Desserts', 'Meat & Seafood', 'Pharmacy & Wellness', 
    'Electronics & Accessories', 'Fashion & Apparel', 'Home & Lifestyle', 
    'Beauty & Personal Care', 'Pet Care & Supplies'
];

const FSSAI_CATEGORIES = [
    'Grocery & Kirana', 'Fruits & Vegetables', 'Restaurants & Cafes', 
    'Bakeries & Desserts', 'Meat & Seafood'
];

const PREMIUM_CATEGORIES = [
    'Restaurants & Cafes', 'Bakeries & Desserts'
];

interface Branch {
    name: string;
    address: string;
    manager_name: string;
    phone: string;
}

export default function SignupScreen() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);

    // Step 1: Identity
    const [identity, setIdentity] = useState({
        ownerName: '',
        phone: '',
        email: '',
    });

    // Inline OTP State
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const otpRefs = useRef<(TextInput | null)[]>([]);

    const getApiUrl = () => {
        if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
        return __DEV__ ? 'http://192.168.29.184:3000' : 'http://pas-api-prod.eba-njbp437w.ap-south-1.elasticbeanstalk.com';
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

    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const handleSendOtp = async () => {
        const cleaned = identity.phone.replace(/\s/g, '');
        if (cleaned.length !== 10) {
            Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
            return;
        }
        setLoading(true);
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}`, isSignup: true })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to send OTP');
            setOtpSent(true);
            setResendTimer(60);
            setOtpValues(['', '', '', '', '', '']);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to send OTP.');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otp = otpValues.join('');
        if (otp.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
            return;
        }
        const cleaned = identity.phone.replace(/\s/g, '');
        setLoading(true);
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: `91${cleaned}`, otp })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'OTP verification failed');
            // Mount their session to securely query the DB
            await setSessionFromTokens(data.session.access_token, data.session.refresh_token);
            
            // Check if merchant already exists to prevent duplicate signups
            const { data: existingMerchant } = await supabase
                .from('merchants')
                .select('status')
                .eq('id', data.user.id)
                .maybeSingle();

            if (existingMerchant) {
                Alert.alert('Already Registered', 'An application with this phone number already exists. Please login instead.');
                await supabase.auth.signOut();
                router.replace('/(auth)/login');
                return;
            }

            setOtpVerified(true);
            Alert.alert('Success', 'Phone number verified successfully!');
        } catch (error: any) {
            console.error('[Signup] Verify OTP Error:', error);
            Alert.alert('Verification Failed', error.message || 'Incorrect OTP or network error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (text: string, index: number) => {
        const newValues = [...otpValues];
        newValues[index] = text;
        setOtpValues(newValues);
        if (text && index < 5) otpRefs.current[index + 1]?.focus();
    };

    const handleOtpKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !otpValues[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    // Step 2: Store
    const [store, setStore] = useState({
        storeName: '',
        category: '',
        city: 'Hyderabad',
        address: '',
        latitude: 17.385,
        longitude: 78.4867,
    });
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);

    // Step 3: Branches
    const [hasBranches, setHasBranches] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);

    // Step 4: KYC
    const [kyc, setKyc] = useState({
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
    const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success'>('pending');
    const [paymentDetails, setPaymentDetails] = useState<any>(null);

    // Initial Draft Restoration
    useEffect(() => {
        const loadDraft = async () => {
            try {
                const draft = await AsyncStorage.getItem('@merchant_signup_draft');
                if (draft) {
                    const parsed = JSON.parse(draft);
                    if (parsed.step) setStep(parsed.step);
                    if (parsed.identity) setIdentity(parsed.identity);
                    if (parsed.store) setStore(parsed.store);
                    if (parsed.hasBranches !== undefined) setHasBranches(parsed.hasBranches);
                    if (parsed.branches) setBranches(parsed.branches);
                    if (parsed.kyc) setKyc(parsed.kyc);
                    if (parsed.docFiles) setDocFiles(parsed.docFiles);
                    if (parsed.storePhotos) setStorePhotos(parsed.storePhotos);
                    console.log('[Signup] Draft restored securely. Resuming from step:', parsed.step);
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
        if (step === 1) {
            if (!identity.ownerName || !identity.email || !identity.phone) {
                Alert.alert('Error', 'Please fill all required fields');
                return false;
            }
            if (!otpVerified) {
                Alert.alert('Verification Required', 'Please verify your phone number using the OTP before continuing.');
                return false;
            }
            // Phone Validation: 10 digits, starts with 6-9
            const phoneRegex = /^[6-9]\d{9}$/;
            if (!phoneRegex.test(identity.phone)) {
                Alert.alert('Invalid Phone', 'Please enter a valid 10-digit Indian mobile number.');
                return false;
            }
            // Email Validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(identity.email)) {
                Alert.alert('Invalid Email', 'Please enter a valid email address.');
                return false;
            }
        }
        if (step === 2) {
            if (!store.storeName || !store.category || !store.address) {
                Alert.alert('Error', 'Please enter store name, category and full address');
                return false;
            }
        }
        if (step === 3) {
            if (storePhotos.length < 2) {
                Alert.alert('Error', 'Please upload at least 2 store photos');
                return false;
            }
        }
        if (step === 5) {
            // PAN Validation
            const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
            if (!kyc.panNumber || !panRegex.test(kyc.panNumber)) {
                Alert.alert('Invalid PAN', 'Please enter a valid PAN number (e.g., ABCDE1234F).');
                return false;
            }
            if (!docFiles.pan) {
                Alert.alert('Error', 'Please upload a PAN card image.');
                return false;
            }

            // Aadhaar Validation
            const aadhaarRegex = /^\d{12}$/;
            if (!kyc.aadharNumber || !aadhaarRegex.test(kyc.aadharNumber)) {
                Alert.alert('Invalid Aadhaar', 'Aadhaar number must be exactly 12 digits.');
                return false;
            }
            if (!docFiles.aadharFront || !docFiles.aadharBack) {
                Alert.alert('Error', 'Please upload Aadhaar (Front & Back) images');
                return false;
            }

            // GSTIN Validation (Mandatory for Everyone)
            const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

            if (!kyc.gstNumber || !gstRegex.test(kyc.gstNumber)) {
                Alert.alert('Invalid GSTIN', 'Please enter a valid GSTIN format (e.g., 22AAAAA0000A1Z5).');
                return false;
            }
            if (!docFiles.gst) {
                Alert.alert('Error', 'Please upload your GST Certificate.');
                return false;
            }

            // FSSAI Validation
            if (FSSAI_CATEGORIES.includes(store.category)) {
                const fssaiRegex = /^\d{14}$/;
                if (!kyc.fssaiNumber || !fssaiRegex.test(kyc.fssaiNumber)) {
                    Alert.alert('Invalid FSSAI', 'FSSAI License Number must be exactly 14 digits.');
                    return false;
                }
                if (!docFiles.fssai) {
                    Alert.alert('Required', 'Please upload your FSSAI License.');
                    return false;
                }
            }

            // MSME Validation (Optional, but validated if entered)
            if (kyc.msmeNumber) {
                const msmeRegex = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;
                if (!msmeRegex.test(kyc.msmeNumber)) {
                    Alert.alert('Invalid MSME', 'MSME Number must match format UDYAM-XX-00-0000000.');
                    return false;
                }
            }

            // Banking Validation
            const bankAccountRegex = /^\d{9,18}$/;
            const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

            if (!kyc.bankAccount || !bankAccountRegex.test(kyc.bankAccount)) {
                Alert.alert('Invalid Account', 'Bank Account must be between 9 to 18 digits.');
                return false;
            }
            if (!kyc.ifsc || !ifscRegex.test(kyc.ifsc)) {
                Alert.alert('Invalid IFSC', 'IFSC Code must be valid (e.g., SBIN0001234).');
                return false;
            }
            if (!kyc.beneficiaryName) {
                Alert.alert('Required', 'Please enter Beneficiary Name.');
                return false;
            }
        }

        if (step === 6) {
            if (paymentStatus !== 'success') {
                Alert.alert('Payment Required', 'Please complete the subscription payment to proceed.');
                return false;
            }
        }
        return true;
    };

    const handlePayment = async () => {
        const isPremium = PREMIUM_CATEGORIES.includes(store.category);
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
                        store_category: store.category
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
                            console.log('Payment Simulated');
                            setPaymentStatus('success');
                            setPaymentDetails({
                                paymentId: 'pay_simulated_123',
                                orderId: 'order_simulated_123',
                                signature: 'sig_simulated_123'
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

            setPaymentStatus('success');
            setPaymentDetails({
                paymentId: data.razorpay_payment_id,
                orderId: data.razorpay_order_id,
                signature: data.razorpay_signature
            });
            Alert.alert('Success', 'Payment Successful! You can now proceed.');
        } catch (error: any) {
            console.error('Payment Error:', error);
            Alert.alert('Error', `Payment failed: ${error.description || error.reason || 'Unknown error'}`);
        }
    };

    const handleNext = () => {
        if (!validateStep()) return;
        if (step < 7) setStep(step + 1);
        else handleSubmit();
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
        else router.back();
    };

    const handleSubmit = async () => {
        try {
            console.log('[Signup] Starting submission. Testing Connectivity...');

            // TEST 1: Google (Axios)
            try {
                console.log('[Signup] Testing Axios Google...');
                const res = await axios.head('https://www.google.com');
                console.log('[Signup] Axios Google Reachable:', res.status);
            } catch (e: any) {
                console.error('[Signup] Axios Google Failed:', e.message);
            }

            // TEST 2: Supabase
            try {
                // We just log this for comparison, but focus on Google first
                console.log('[Signup] Testing Supabase URL...');
            } catch (e: any) {
                // ignore
            }

            setLoading(true);

            // 1. Get current Authenticated User (verified via OTP in Step 1)
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session?.user) {
                setLoading(false);
                throw new Error('Not authenticated. Please verify your phone number on Step 1 again.');
            }
            
            const userId = sessionData.session.user.id;
            console.log('[Signup] User verified:', userId);

            // 2. Upload Documents with Retry Mechanism (For Tier 3/4 Network Resilience)
            const uploadFile = async (uri: string, path: string, maxRetries = 3) => {
                if (!uri) return null;
                
                for (let attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });

                        const { error } = await supabase.storage
                            .from('merchant-docs')
                            .upload(path, decode(base64), {
                                contentType: 'image/jpeg',
                                upsert: true
                            });

                        if (error) throw error;

                        return path; // Return raw storage path for private buckets
                    } catch (error) {
                        console.error(`Upload Error (Attempt ${attempt}/${maxRetries}):`, error);
                        if (attempt === maxRetries) {
                            Alert.alert('Upload Failed', 'Network connection dropped or upload failed. Please check your internet and try again.');
                            throw new Error('Upload failed'); // Returns execution to outer catch, stopping submission
                        }
                        // Exponential backoff
                        await new Promise(resolve => setTimeout(resolve, attempt * 1500));
                    }
                }
                throw new Error('Upload failed');
            };

            const docUrls = {
                pan: docFiles.pan ? await uploadFile(docFiles.pan, `${userId}/pan.jpg`) : null,
                aadharFront: docFiles.aadharFront ? await uploadFile(docFiles.aadharFront, `${userId}/aadhar_front.jpg`) : null,
                aadharBack: docFiles.aadharBack ? await uploadFile(docFiles.aadharBack, `${userId}/aadhar_back.jpg`) : null,
                msme: docFiles.msme ? await uploadFile(docFiles.msme, `${userId}/msme.jpg`) : null,
                gst: docFiles.gst ? await uploadFile(docFiles.gst, `${userId}/gst.jpg`) : null,
                fssai: docFiles.fssai ? await uploadFile(docFiles.fssai, `${userId}/fssai.jpg`) : null,
            };



            const storePhotoUrls = await Promise.all(
                storePhotos.map((uri, idx) => uploadFile(uri, `${userId}/store_photo_${idx}.jpg`))
            );

            // 3. Insert Merchant Record via Secure Backend Endpoint
            const payload = {
                ownerName: identity.ownerName,
                email: identity.email.trim(),
                phone: identity.phone,
                storeName: store.storeName,
                category: store.category,
                city: store.city,
                address: store.address,
                latitude: store.latitude,
                longitude: store.longitude,
                hasBranches: hasBranches,
                status: 'inactive',
                kycStatus: 'pending',
                panNumber: kyc.panNumber,
                aadharNumber: kyc.aadharNumber,
                msmeNumber: kyc.msmeNumber,
                bankAccount: kyc.bankAccount,
                ifsc: kyc.ifsc,
                beneficiaryName: kyc.beneficiaryName,
                turnoverRange: kyc.turnoverRange,
                gstNumber: kyc.gstNumber,
                fssaiNumber: kyc.fssaiNumber,
                docUrls: docUrls,
                storePhotos: storePhotoUrls.filter(url => url !== null),
                branches: hasBranches ? branches : [],
                subscription: paymentStatus === 'success' && paymentDetails ? {
                    amount: PREMIUM_CATEGORIES.includes(store.category) ? 2999 : 999,
                    paymentId: paymentDetails.paymentId,
                    orderId: paymentDetails.orderId,
                    signature: paymentDetails.signature
                } : undefined
            };

            const apiUrl = getApiUrl();
            const response = await fetch(`${apiUrl}/auth/merchant/signup`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionData.session.access_token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) {
                console.error('[Signup] Server API Error:', data);
                if (data.details) {
                    // Combine Zod validation messages
                    const detailsStr = data.details.map((d: any) => d.message).join(', ');
                    throw new Error(`Validation Error: ${detailsStr}`);
                }
                throw new Error(data.error || 'Server rejected registration');
            }

            Alert.alert('Success!', 'Your application has been submitted.');
            await AsyncStorage.removeItem('@merchant_signup_draft'); // Clear cache correctly
            router.replace('/(auth)/pending');
        } catch (error: any) {
            console.error('[Signup] Submit Error:', error);
            Alert.alert('Error', error.message || 'Submission failed. Check logs.');
        } finally {
            setLoading(false);
        }
    };

    const addBranch = () => setBranches([...branches, { name: '', address: '', manager_name: '', phone: '' }]);
    const removeBranch = (i: number) => setBranches(branches.filter((_, idx) => idx !== i));
    const updateBranch = (i: number, field: keyof Branch, value: string) => {
        const updated = [...branches];
        updated[i][field] = value;
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
                                    editable={!otpVerified}
                                />
                                {otpVerified ? (
                                    <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                                ) : (
                                    <TouchableOpacity 
                                        onPress={handleSendOtp} 
                                        disabled={loading || identity.phone.length !== 10}
                                        style={{ backgroundColor: Colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, opacity: (loading || identity.phone.length !== 10) ? 0.5 : 1 }}
                                    >
                                        <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>{otpSent ? 'Resend' : 'Verify'}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {otpSent && !otpVerified && (
                            <View style={styles.inputGroup}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={styles.label}>Enter 6-digit OTP</Text>
                                    {resendTimer > 0 ? (
                                        <Text style={{ color: '#9CA3AF', fontSize: 12 }}>Resend in {resendTimer}s</Text>
                                    ) : null}
                                </View>
                                
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                    {otpValues.map((val, i) => (
                                        <TextInput
                                            key={i}
                                            ref={ref => { otpRefs.current[i] = ref; }}
                                            style={{ width: 44, height: 52, borderWidth: 1, borderColor: val ? Colors.primary : '#E5E7EB', borderRadius: 12, textAlign: 'center', fontSize: 20, fontWeight: 'bold', color: '#111827', backgroundColor: val ? '#FFFFFF' : '#F9FAFB' }}
                                            maxLength={1}
                                            keyboardType="number-pad"
                                            value={val}
                                            onChangeText={(text) => handleOtpChange(text, i)}
                                            onKeyPress={(e) => handleOtpKeyPress(e, i)}
                                        />
                                    ))}
                                </View>

                                <TouchableOpacity 
                                    style={[{ height: 52, backgroundColor: Colors.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 8 }, (loading || otpValues.join('').length !== 6) && { opacity: 0.6 }]}
                                    onPress={handleVerifyOtp}
                                    disabled={loading || otpValues.join('').length !== 6}
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
                                    <Text style={store.category ? styles.selectText : styles.selectPlaceholder}>
                                        {store.category || 'Select category'}
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
                                                <ScrollView style={{ maxHeight: 300 }}>
                                                    {STORE_CATEGORIES.map((cat) => (
                                                        <TouchableOpacity
                                                            key={cat}
                                                            style={styles.modalItem}
                                                            onPress={() => {
                                                                setStore({ ...store, category: cat });
                                                                setShowCategoryPicker(false);
                                                            }}
                                                        >
                                                            <Text style={[
                                                                styles.modalItemText,
                                                                store.category === cat && styles.modalItemTextActive
                                                            ]}>{cat}</Text>
                                                            {store.category === cat && <Ionicons name="checkmark" size={20} color={Colors.primary} />}
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
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

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Full Address</Text>
                                <TextInput
                                    style={[styles.input, styles.textArea]}
                                    placeholder="Shop No, Street, Landmark..."
                                    placeholderTextColor="#9CA3AF"
                                    multiline
                                    numberOfLines={3}
                                    value={store.address}
                                    onChangeText={(t) => setStore({ ...store, address: t })}
                                />
                            </View>
                        </View>
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
                                            <TextInput
                                                style={[styles.input, { marginTop: 8 }]}
                                                placeholder="Branch Address"
                                                placeholderTextColor="#9CA3AF"
                                                value={branch.address}
                                                onChangeText={(t) => updateBranch(i, 'address', t)}
                                            />
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

                            {FSSAI_CATEGORIES.includes(store.category) && (
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
                                        {PREMIUM_CATEGORIES.includes(store.category) ? '₹4999' : '₹2499'}
                                    </Text>
                                    <Text style={{ fontSize: 40, fontWeight: '800', color: '#10B981' }}>
                                        {PREMIUM_CATEGORIES.includes(store.category) ? '₹2999' : '₹999'}
                                    </Text>
                                </View>

                                <View style={{ width: '100%', paddingHorizontal: 10 }}>
                                    {['Zero Commission', 'Unlimited Listings', 'Premium Support', 'Store Analytics'].map((feat, i) => (
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
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category</Text><Text style={styles.reviewValue}>{store.category}</Text></View>
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
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Category Tier</Text><Text style={styles.reviewValue}>{PREMIUM_CATEGORIES.includes(store.category) ? 'Premium' : 'Standard'}</Text></View>
                            <View style={styles.reviewRow}><Text style={styles.reviewLabel}>Lifetime Access</Text><Text style={styles.reviewValue}>{PREMIUM_CATEGORIES.includes(store.category) ? '₹2999' : '₹999'}</Text></View>
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

                    <Text style={styles.stepCounter}>Step {step} of 6</Text>

                    <TouchableOpacity
                        style={[styles.nextButton, loading && styles.buttonDisabled]}
                        onPress={handleNext}
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
});
