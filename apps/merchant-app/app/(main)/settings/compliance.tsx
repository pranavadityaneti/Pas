import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import { useUser } from '../../../src/context/UserContext';
import { useRealtimeTable } from '../../../src/hooks/useRealtimeTable';

export default function ComplianceScreen() {
    const { user } = useUser();

    // Realtime Compliance Details
    const { data: merchants, loading: tableLoading } = useRealtimeTable({
        tableName: 'merchants',
        select: 'pan_number, aadhar_number, gst_number, turnover_range, pan_document_url, aadhar_front_url, aadhar_back_url, gst_certificate_url, fssai_number, fssai_certificate_url',
        filter: user?.id ? `id=eq.${user.id}` : undefined,
        enabled: !!user?.id
    });

    const kyc = React.useMemo(() => {
        if (merchants && merchants.length > 0) {
            const data = merchants[0];
            return {
                panNumber: data.pan_number || 'Not Provided',
                aadharNumber: data.aadhar_number || 'Not Provided',
                gstNumber: data.gst_number || 'Not Provided',
                fssaiNumber: data.fssai_number || 'Not Provided',
                turnoverRange: data.turnover_range || 'Not Specified',
                panDocUrl: data.pan_document_url,
                aadharFrontUrl: data.aadhar_front_url,
                aadharBackUrl: data.aadhar_back_url,
                gstCertificateUrl: data.gst_certificate_url,
                fssaiCertificateUrl: data.fssai_certificate_url
            };
        }
        return {
            panNumber: '',
            aadharNumber: '',
            gstNumber: '',
            fssaiNumber: '',
            turnoverRange: '',
            panDocUrl: '',
            aadharFrontUrl: '',
            aadharBackUrl: '',
            gstCertificateUrl: '',
            fssaiCertificateUrl: ''
        };
    }, [merchants]);

    const loading = tableLoading && !merchants.length;

    const InfoRow = ({ label, value, icon }: { label: string, value: string, icon: string }) => (
        <View style={styles.infoRow}>
            <View style={styles.iconBox}>
                <MaterialCommunityIcons name={icon as any} size={20} color="#6B7280" />
            </View>
            <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>{label}</Text>
                <Text style={styles.infoValue}>{value}</Text>
            </View>
        </View>
    );

    const [selectedDoc, setSelectedDoc] = useState<{ url: string, label: string } | null>(null);

    const DocCard = ({ label, url }: { label: string, url: string | null }) => (
        <TouchableOpacity
            style={styles.docCard}
            onPress={() => url ? setSelectedDoc({ url, label }) : null}
            activeOpacity={url ? 0.7 : 1}
        >
            <Text style={styles.docLabel}>{label}</Text>
            {url ? (
                <View style={styles.docImageContainer}>
                    <Image source={{ uri: url }} style={styles.docImage} resizeMode="cover" />
                    <View style={styles.zoomOverlay}>
                        <Ionicons name="scan-outline" size={20} color="#FFFFFF" />
                    </View>
                </View>
            ) : (
                <View style={styles.noDocBox}>
                    <Ionicons name="document-outline" size={32} color="#D1D5DB" />
                    <Text style={styles.noDocText}>Document not uploaded</Text>
                </View>
            )}
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="chevron-back" size={24} color="#000" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Compliance & KYC</Text>
                </View>
                <View style={styles.loader}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="chevron-back" size={24} color="#000" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Compliance & KYC</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Identity Details</Text>
                    <View style={styles.card}>
                        <InfoRow label="PAN Number" value={kyc.panNumber} icon="card-account-details-outline" />
                        <View style={styles.divider} />
                        <InfoRow label="Aadhaar Number" value={kyc.aadharNumber} icon="fingerprint" />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Business Compliance</Text>
                    <View style={styles.card}>
                        <InfoRow label="GST Number" value={kyc.gstNumber} icon="file-certificate-outline" />
                        <View style={styles.divider} />
                        <InfoRow label="Annual Turnover" value={kyc.turnoverRange} icon="chart-areaspline" />
                        <View style={styles.divider} />
                        <InfoRow label="FSSAI Number" value={kyc.fssaiNumber} icon="food-variant" />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Uploaded Documents</Text>
                    <View style={styles.docsGrid}>
                        <DocCard label="PAN Card" url={kyc.panDocUrl} />
                        <DocCard label="GST Certificate" url={kyc.gstCertificateUrl} />
                        <DocCard label="FSSAI License" url={kyc.fssaiCertificateUrl} />
                        <DocCard label="Aadhaar Front" url={kyc.aadharFrontUrl} />
                        <DocCard label="Aadhaar Back" url={kyc.aadharBackUrl} />
                    </View>
                </View>

                <View style={styles.footerNote}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                    <Text style={styles.footerNoteText}>Your details are encrypted and securely stored for compliance purposes.</Text>
                </View>
            </ScrollView>

            {/* Document Viewer Modal */}
            {selectedDoc && (
                <View style={styles.modalOverlay}>
                    <SafeAreaView style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <TouchableOpacity onPress={() => setSelectedDoc(null)} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{selectedDoc.label}</Text>
                            <View style={{ width: 40 }} />
                        </View>
                        <View style={styles.modalContent}>
                            <Image
                                source={{ uri: selectedDoc.url }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        </View>
                    </SafeAreaView>
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 20 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 12 },
    card: { backgroundColor: '#fff', borderRadius: 16, padding: 4, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    infoRow: { flexDirection: 'row', alignItems: 'center', padding: 12 },
    iconBox: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
    infoValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
    divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
    docsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    docCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, width: '48%', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    docLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
    docImageContainer: { height: 100, borderRadius: 8, overflow: 'hidden', backgroundColor: '#F3F4F6', position: 'relative' },
    docImage: { width: '100%', height: '100%' },
    zoomOverlay: { position: 'absolute', right: 8, bottom: 8, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 6 },
    noDocBox: { height: 100, borderRadius: 8, backgroundColor: '#F9FAFB', borderStyle: 'dashed', borderWidth: 1, borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center' },
    noDocText: { fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' },
    footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10, gap: 8 },
    footerNoteText: { fontSize: 11, color: '#6B7280', textAlign: 'center' },

    // Modal Styles
    modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000', zIndex: 1000 },
    modalContainer: { flex: 1 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    closeButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
    modalTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
    modalContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: '100%', height: '100%' }
});
