import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, Alert } from 'react-native';

/**
 * "Chat with us" — opens a WhatsApp chat to the PAS support number (Wati-backed).
 * The greeting → FAQ → human-handoff automation lives in the Wati dashboard, NOT here.
 *
 * Setup: set EXPO_PUBLIC_WATI_NUMBER to the business number in international format,
 * digits only (e.g. "919876543210"). Until it's set, the button shows a graceful
 * email fallback instead of opening a broken link.
 *
 * Self-contained on purpose — drop it into the Help/Support screen (lock-override) or
 * the new OrderDetail screen (WS2) without editing a locked file.
 */
const WATI_NUMBER = process.env.EXPO_PUBLIC_WATI_NUMBER || '';
const SUPPORT_EMAIL = 'support@pickatstore.io';

export default function ChatWithUsButton({ prefill = 'Hi, I need help with my order.' }: { prefill?: string }) {
  const openChat = async () => {
    if (!WATI_NUMBER) {
      Alert.alert('Support', `Chat support is being set up. Please email ${SUPPORT_EMAIL} for now.`);
      return;
    }
    const url = `https://wa.me/${WATI_NUMBER}?text=${encodeURIComponent(prefill)}`;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('WhatsApp unavailable', `Please install WhatsApp or email ${SUPPORT_EMAIL}.`);
    } catch {
      Alert.alert('Could not open WhatsApp', `Please email ${SUPPORT_EMAIL}.`);
    }
  };

  return (
    <TouchableOpacity style={styles.btn} onPress={openChat} activeOpacity={0.85} accessibilityLabel="Chat with us on WhatsApp">
      <Text style={styles.txt}>💬  Chat with us on WhatsApp</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#25D366', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14,
  },
  txt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
