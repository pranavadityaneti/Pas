import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { Colors } from '../../constants/Colors';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter email and password');
            return;
        }

        setLoading(true);
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password,
            });

            if (error) throw error;

            if (data.user) {
                const { data: merchant, error: merchantError } = await supabase
                    .from('merchants')
                    .select('status')
                    .eq('id', data.user.id)
                    .maybeSingle();

                if (merchantError || !merchant) {
                    console.error('Login Fetch Error:', merchantError);
                    console.log('Looking for merchant with ID:', data.user.id);
                    Alert.alert('Error', `Details: ${merchantError?.message || 'No record found for this User ID'}\nUser ID: ${data.user.id}`);
                    await supabase.auth.signOut();
                    return;
                }

                if (merchant.status === 'rejected') {
                    Alert.alert('Account Rejected', 'Your application was rejected. Please contact support.');
                    await supabase.auth.signOut();
                    return;
                }

                if (merchant.status === 'active') {
                    router.replace('/(main)/dashboard');
                } else {
                    router.replace('/(auth)/pending');
                }
            }
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.logoContainer}>
                        <View style={styles.logoBox}>
                            <Ionicons name="storefront" size={32} color={Colors.primary} />
                        </View>
                        <Text style={styles.title}>Merchant Portal</Text>
                        <Text style={styles.subtitle}>Manage your store, orders, and inventory</Text>
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="store@example.com"
                                placeholderTextColor="#9CA3AF"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="••••••••"
                                    placeholderTextColor="#9CA3AF"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() => setShowPassword(!showPassword)}
                                >
                                    <Ionicons
                                        name={showPassword ? 'eye-off' : 'eye'}
                                        size={20}
                                        color="#9CA3AF"
                                    />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleLogin}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color="#FFFFFF" />
                            ) : (
                                <Text style={styles.buttonText}>Access Dashboard</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>New to Pick At Store?</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <TouchableOpacity
                            style={styles.signupButton}
                            onPress={() => router.push('/(auth)/signup')}
                        >
                            <Text style={styles.signupButtonText}>Apply as Merchant Partner</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.footer}>Protected by Pick At Store Secure Gateway</Text>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 32,
    },
    logoBox: {
        width: 64,
        height: 64,
        backgroundColor: Colors.primary + '11',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    formContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
        backgroundColor: '#FFFFFF',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
    },
    passwordInput: {
        flex: 1,
        height: 48,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#111827',
    },
    eyeButton: {
        padding: 12,
    },
    button: {
        height: 52,
        backgroundColor: Colors.primary,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E5E7EB',
    },
    dividerText: {
        paddingHorizontal: 16,
        color: '#6B7280',
        fontSize: 14,
    },
    signupButton: {
        height: 48,
        borderWidth: 1,
        borderColor: Colors.primary + '30',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: Colors.primary + '08',
    },
    signupButtonText: {
        color: Colors.primary,
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 12,
        marginTop: 24,
    },
});
