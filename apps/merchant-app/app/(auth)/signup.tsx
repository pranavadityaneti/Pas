import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Modal,
    TouchableWithoutFeedback,
    Image,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker } from 'react-native-maps';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import axios from 'axios';
import uuid from 'react-native-uuid';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';
import Constants from 'expo-constants';

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
    'Grocery & Kirana',
    'Supermarket',
    'Restaurant & Cafe',
    'Bakery & Sweets',
    'Pharmacy',
    'Electronics',
    'Fashion & Apparel',
    'Home & Lifestyle',
    'Beauty & Personal Care',
    'Other',
];

const FSSAI_CATEGORIES = [
    'Grocery & Kirana',
    'Supermarket',
    'Restaurant & Cafe',
    'Bakery & Sweets',
];

interface Branch {
    name: string;
    address: string;
}

export default function SignupScreen() {
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Identity
    const [identity, setIdentity] = useState({
        ownerName: '',
        phone: '',
        email: '',
        password: '',
    });

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
            if (!identity.ownerName || !identity.email || !identity.password || !identity.phone) {
                Alert.alert('Error', 'Please fill all required fields');
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
            // Password Length
            if (identity.password.length < 6) {
                Alert.alert('Error', 'Password must be at least 6 characters');
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
                if (!kyc.fssaiNumber) {
                    Alert.alert('Required', 'FSSAI License Number is required for your category.');
                    return false;
                }
                if (!docFiles.fssai) {
                    Alert.alert('Required', 'Please upload your FSSAI License.');
                    return false;
                }
            }

            // Banking Validation
            if (!kyc.bankAccount || !kyc.ifsc || !kyc.beneficiaryName) {
                Alert.alert('Required', 'Please enter all bank details (Account No, IFSC, Beneficiary Name).');
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
        const options = {
            description: 'Lifetime Partner Subscription',
            image: 'https://pickatstore.com/logo.png', // Replace with real logo URL
            currency: 'INR',
            key: 'rzp_test_RnWZnS9NxCVC6V',
            amount: 99900, // 999 * 100 paise
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
            console.log('Payment Success:', data);
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
            let authUser = null;
            let finalAuthError = null;

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: identity.email.trim(),
                password: identity.password,
                options: {
                    data: {
                        name: identity.ownerName,
                        role: 'MERCHANT'
                    },
                    // Ensure auto-sign in if email confirmation is disabled
                    emailRedirectTo: undefined
                }
            });

            if (authError) {
                // Check if user already exists
                const isUserExistsError =
                    authError.message.includes('User already registered') ||
                    authError.message.includes('User_email_key') ||
                    authError.message.includes('duplicate key') ||
                    authError.message.includes('unique constraint') ||
                    (authError as any).status === 422 ||
                    (authError as any).status === 409;

                if (isUserExistsError) {
                    console.log('[Signup] User exists. Attempting Login...');
                    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                        email: identity.email.trim(),
                        password: identity.password,
                    });

                    if (loginError) {
                        console.error('[Signup] Login Failed after User Exists:', loginError);
                        if (loginError.message.includes('Invalid login credentials')) {
                            throw new Error('Account exists but password does not match. Please use a different email or reset password.');
                        }
                        throw new Error('User account in inconsistent state. Please use a different email.');
                    }
                    authUser = loginData.user;
                } else {
                    console.error('[Signup] Auth Error:', authError);
                    throw authError;
                }
            } else {
                authUser = authData.user;
            }

            if (!authUser) throw new Error('Failed to create or retrieve user');

            const userId = authUser.id;
            console.log('[Signup] User verified:', userId);

            // 2. Upload Documents
            const uploadFile = async (uri: string, path: string) => {
                if (!uri) return null;
                try {
                    // Use fetch + blob for Expo/React Native
                    const response = await fetch(uri);
                    const blob = await response.blob();

                    const { data, error } = await supabase.storage
                        .from('merchant-docs') // Ensure bucket name is correct
                        .upload(path, blob, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });

                    if (error) {
                        console.error('Upload Error:', error);
                        throw error;
                    }

                    // Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from('merchant-docs')
                        .getPublicUrl(path);

                    return publicUrl;
                } catch (error) {
                    console.error('File upload failed:', error);
                    return null;
                }
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

            // 3. Insert Merchant Record
            const { error: dbError } = await supabase.from('merchants').upsert({
                id: userId,
                owner_name: identity.ownerName,
                email: identity.email.trim(),
                phone: identity.phone,
                store_name: store.storeName,
                category: store.category,
                city: store.city,
                address: store.address,
                latitude: store.latitude,
                longitude: store.longitude,
                has_branches: hasBranches,
                status: 'active', // 'pending' violates check constraint
                kyc_status: 'pending',
                pan_number: kyc.panNumber,
                aadhar_number: kyc.aadharNumber,
                msme_number: kyc.msmeNumber,
                bank_account_number: kyc.bankAccount,
                ifsc_code: kyc.ifsc,
                bank_beneficiary_name: kyc.beneficiaryName,
                turnover_range: kyc.turnoverRange,
                pan_document_url: docUrls.pan,
                aadhar_front_url: docUrls.aadharFront,
                aadhar_back_url: docUrls.aadharBack,
                msme_certificate_url: docUrls.msme,
                gst_certificate_url: docUrls.gst,
                gst_number: kyc.gstNumber,
                fssai_number: kyc.fssaiNumber,
                fssai_certificate_url: docUrls.fssai,
                store_photos: storePhotoUrls.filter(url => url !== null),
            });

            if (dbError) {
                console.error('[Signup] DB Insert Error:', dbError);
                throw dbError;
            }

            // 4. Insert Subscription Record
            if (paymentStatus === 'success' && paymentDetails) {
                const { error: subError } = await supabase.from('subscriptions').insert({
                    id: uuid.v4(),
                    merchant_id: userId,
                    amount: 999.00,
                    currency: 'INR',
                    status: 'success',
                    provider: 'razorpay',
                    transaction_id: paymentDetails.paymentId
                });
                if (subError) console.error('[Signup] Subscription Insert Error (Non-blocking):', subError);
            }

            if (hasBranches && branches.length > 0) {
                const branchRecords = branches.map(b => ({
                    id: uuid.v4(),
                    merchant_id: userId,
                    branch_name: b.name,
                    address: b.address,
                }));
                // Use upsert or delete-then-insert if branch IDs are not preserved
                const { error: branchError } = await supabase.from('merchant_branches').insert(branchRecords);
                if (branchError) {
                    console.error('[Signup] Branch Insert Error:', branchError);
                    Alert.alert('Warning', 'Merchant created but failed to save branches. Please add them in Settings.');
                }
            }


            Alert.alert('Success!', 'Your application has been submitted.');
            router.replace('/(auth)/pending');
        } catch (error: any) {
            console.error('[Signup] Submit Error:', error);
            Alert.alert('Error', error.message || 'Submission failed. Check logs.');
        } finally {
            setLoading(false);
        }
    };

    const addBranch = () => setBranches([...branches, { name: '', address: '' }]);
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
                    <View key={i} style={styles.stepItem}>
                        <View
                            style={[
                                styles.stepCircle,
                                isActive && styles.stepCircleActive,
                                isCompleted && styles.stepCircleCompleted,
                            ]}
                        >
                            {isCompleted ? (
                                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                            ) : (
                                <Text style={[styles.stepNumber, isActive && styles.stepNumberActive]}>
                                    {stepNum}
                                </Text>
                            )}
                        </View>
                        <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{label}</Text>
                    </View>
                );
            })}
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {renderStepIndicator()}
            </View>

            <KeyboardAwareScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                enableOnAndroid={true}
                extraScrollHeight={100}
                enableAutomaticScroll={true}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
            >
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
                            <Text style={styles.label}>Phone <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+91 98765 43210"
                                placeholderTextColor="#9CA3AF"
                                keyboardType="phone-pad"
                                value={identity.phone}
                                onChangeText={(t) => setIdentity({ ...identity, phone: t })}
                            />
                        </View>

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

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Password <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor="#9CA3AF"
                                secureTextEntry
                                value={identity.password}
                                onChangeText={(t) => setIdentity({ ...identity, password: t })}
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
                                    keyboardType="numeric"
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
                                    value={kyc.gstNumber}
                                    onChangeText={(t) => setKyc({ ...kyc, gstNumber: t.toUpperCase() })}
                                />
                            </View>

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
                                    keyboardType="numeric"
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
                                            keyboardType="numeric"
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
                                </>
                            )}
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
                                    <Text style={{ fontSize: 20, color: '#9CA3AF', textDecorationLine: 'line-through', marginRight: 12 }}>₹2499</Text>
                                    <Text style={{ fontSize: 40, fontWeight: '800', color: '#10B981' }}>₹999</Text>
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
                            <Text style={styles.reviewTitle}>Summary</Text>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Owner</Text>
                                <Text style={styles.reviewValue}>{identity.ownerName}</Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Store</Text>
                                <Text style={styles.reviewValue}>{store.storeName}</Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Category</Text>
                                <Text style={styles.reviewValue}>{store.category}</Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>City</Text>
                                <Text style={styles.reviewValue}>{store.city}</Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Email</Text>
                                <Text style={styles.reviewValue}>{identity.email}</Text>
                            </View>
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>PAN</Text>
                                <Text style={styles.reviewValue}>{kyc.panNumber || '-'}</Text>
                            </View>
                            {kyc.gstNumber && (
                                <View style={styles.reviewRow}>
                                    <Text style={styles.reviewLabel}>GSTIN</Text>
                                    <Text style={styles.reviewValue}>{kyc.gstNumber}</Text>
                                </View>
                            )}
                            <View style={styles.reviewRow}>
                                <Text style={styles.reviewLabel}>Store Photos</Text>
                                <Text style={styles.reviewValue}>{storePhotos.length} uploaded</Text>
                            </View>
                        </View>
                    </>
                )}
            </KeyboardAwareScrollView>

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

        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    stepContainer: { flexDirection: 'row', justifyContent: 'space-between' },
    stepItem: { alignItems: 'center', flex: 1 },
    stepCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center' },
    stepCircleActive: { backgroundColor: Colors.primary },
    stepCircleCompleted: { backgroundColor: '#10B981' },
    stepNumber: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
    stepNumberActive: { color: '#FFFFFF' },
    stepLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 4 },
    stepLabelActive: { color: Colors.primary, fontWeight: '600' },
    content: { flex: 1 },
    contentContainer: { padding: 16, paddingBottom: 32 },
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
