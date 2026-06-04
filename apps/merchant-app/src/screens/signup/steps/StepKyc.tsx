/**
 * StepKyc — Step 5 of merchant signup (KYC + banking + document uploads).
 *
 * 2026-06-04 (Phase 1.7.E): Extracted verbatim from signup.tsx. The
 * pickDocument(type) handler moves into this component since it's only
 * used by Step 5. kyc / setKyc / docFiles / setDocFiles / selectedVertical
 * come from useSignupContext.
 *
 * Conditional renders preserved:
 *   - FSSAI section (license number + upload) shown only when
 *     selectedVertical?.requiresFssai is true (food/restaurant verticals).
 *   - MSME / Udyam fields always shown but optional (no required asterisk).
 *
 * Per the spec, GST is now mandatory for ALL merchants regardless of
 * vertical — preserved here verbatim (no conditional gate on GST fields).
 */

import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../../../constants/Colors';
import { useSignupContext } from '../shared/SignupContext';
import { styles } from '../shared/signupStyles';

export function StepKyc() {
    const { kyc, setKyc, docFiles, setDocFiles, selectedVertical } = useSignupContext();

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

    return (
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
    );
}
