import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback, Platform, DimensionValue, KeyboardAvoidingView, ScrollView } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface BottomModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    height?: DimensionValue;
}



export default function BottomModal({ visible, onClose, title, children, height }: BottomModalProps) {
    const insets = useSafeAreaInsets();

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <TouchableWithoutFeedback onPress={onClose}>
                    <View style={styles.backdrop} />
                </TouchableWithoutFeedback>

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1, justifyContent: 'flex-end' }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                >
                    <View style={styles.modalContent}>
                        <View style={styles.handle} />

                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView
                            style={{ maxHeight: '80%' }}
                            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 20) }]}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {children}
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24 }, // Removed static paddingBottom
    handle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 10 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#000' },
    closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
    content: { paddingHorizontal: 20 }
});
