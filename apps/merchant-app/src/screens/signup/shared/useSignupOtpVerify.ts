/**
 * useSignupOtpVerify — signup-specific mid-layer OTP hook.
 *
 * 2026-06-04 (Phase 1.4.B): Composes the two low-level primitives
 *   - useOtpPad        (UI mechanics for the 6-digit pad)
 *   - useSendVerifyOtp (POST /auth/send-otp + verify-otp + 60s resend timer)
 * and layers on the SIGNUP-specific post-verify behavior:
 *
 *   1. Mount the Supabase session via setSessionFromTokens()
 *   2. Check if a non-draft merchant already exists for this user_id
 *      (the "Already Registered" guard)
 *   3. If a duplicate is found → Alert, signOut(), router.replace('/(auth)/login')
 *   4. If not → setVerified(true), Alert.alert('Success', ...), invoke the
 *      onVerified(data) callback so the caller (signup.tsx) can fire
 *      fetchRemoteMerchantState() with the fresh access token.
 *
 * Behavior preservation — extracted VERBATIM from the previous inline
 * handleSendOtp / handleVerifyOtp in app/(auth)/signup.tsx:
 *   - Phone validation: `phone.replace(/\s/g, '')` then length === 10
 *     → Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.')
 *   - OTP length validation: getValue().length === 6
 *     → Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.')
 *   - Send-OTP API body: { phone: `91${cleaned}`, isSignup: true } via useSendVerifyOtp
 *   - Send-OTP failure: Alert.alert('Error', err.message || 'Failed to send OTP.')
 *   - Send-OTP success: resets the pad to empty boxes (matches prior behavior)
 *   - Verify-OTP failure: Alert.alert('Verification Failed', ...)
 *   - Duplicate-merchant Alert title + body preserved verbatim
 *   - Success Alert: 'Success' / 'Phone number verified successfully!'
 *
 * The optional setLoading callback lets the caller keep its global `loading`
 * state in sync with OTP operations — preserves the prior behavior of the
 * outer `setLoading(true/false)` wrappers in signup.tsx (which gate the
 * bottom Next button across many side-effects, not just OTP).
 */

import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { supabase, setSessionFromTokens } from '../../../lib/supabase';
import { useOtpPad, type UseOtpPadResult } from '../../../hooks/useOtpPad';
import { useSendVerifyOtp } from '../../../hooks/useSendVerifyOtp';

export interface UseSignupOtpVerifyArgs {
    /** Raw 10-digit phone number from the identity input (no country code). */
    phone: string;
    /**
     * Called after a successful verify + duplicate-check pass-through.
     * Receives the full data payload from /auth/verify-otp so the caller can
     * use the fresh access token (e.g. for fetchRemoteMerchantState).
     */
    onVerified: (data: any) => void;
    /**
     * Optional — lets the caller mirror its global loading state to OTP
     * operations. The hook will call setLoading(true) at the start of
     * send/verify and setLoading(false) in the finally.
     */
    setLoading?: (loading: boolean) => void;
}

export interface UseSignupOtpVerifyResult {
    // ── OTP pad mechanics (passed-through from useOtpPad) ──────────
    values:     UseOtpPadResult['values'];
    refs:       UseOtpPadResult['refs'];
    onChange:   UseOtpPadResult['onChange'];
    onKeyPress: UseOtpPadResult['onKeyPress'];
    getValue:   UseOtpPadResult['getValue'];

    // ── Signup-specific state ──────────────────────────────────────
    sent:     boolean;
    verified: boolean;

    // ── Resend cooldown (from useSendVerifyOtp) ───────────────────
    resendTimer: number;

    // ── Actions ────────────────────────────────────────────────────
    send:   () => Promise<void>;
    verify: () => Promise<void>;
}

export function useSignupOtpVerify({
    phone,
    onVerified,
    setLoading,
}: UseSignupOtpVerifyArgs): UseSignupOtpVerifyResult {
    const pad = useOtpPad(6);
    const otp = useSendVerifyOtp('signup');
    const [sent, setSent] = useState(false);
    const [verified, setVerified] = useState(false);

    const send = async () => {
        const cleaned = phone.replace(/\s/g, '');
        if (cleaned.length !== 10) {
            Alert.alert('Invalid Number', 'Please enter a valid 10-digit phone number.');
            return;
        }
        setLoading?.(true);
        try {
            const result = await otp.sendOtp(`91${cleaned}`);
            if (!result.ok) {
                Alert.alert('Error', result.error || 'Failed to send OTP.');
                return;
            }
            setSent(true);
            pad.reset();
        } finally {
            setLoading?.(false);
        }
    };

    const verify = async () => {
        const value = pad.getValue();
        if (value.length !== 6) {
            Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP.');
            return;
        }
        const cleaned = phone.replace(/\s/g, '');
        setLoading?.(true);
        try {
            const result = await otp.verifyOtp(`91${cleaned}`, value);
            if (!result.ok) {
                console.error('[Signup] Verify OTP Error:', result.error);
                Alert.alert(
                    'Verification Failed',
                    result.error || 'Incorrect OTP or network error. Please try again.',
                );
                return;
            }

            const data = result.data;

            // Mount the Supabase session so subsequent queries are authenticated.
            await setSessionFromTokens(
                data.session.access_token,
                data.session.refresh_token,
            );

            // Duplicate-merchant guard: if a non-draft merchant record already
            // exists for this user_id, redirect to login instead of allowing
            // a second signup.
            const { data: existingMerchant } = await supabase
                .from('merchants')
                .select('status')
                .eq('id', data.user.id)
                .maybeSingle();

            if (existingMerchant && existingMerchant.status !== 'draft') {
                Alert.alert(
                    'Already Registered',
                    'An application with this phone number already exists. Please login instead.',
                );
                await supabase.auth.signOut();
                router.replace('/(auth)/login');
                return;
            }

            setVerified(true);
            Alert.alert('Success', 'Phone number verified successfully!');
            onVerified(data);
        } finally {
            setLoading?.(false);
        }
    };

    return {
        values:      pad.values,
        refs:        pad.refs,
        onChange:    pad.onChange,
        onKeyPress:  pad.onKeyPress,
        getValue:    pad.getValue,
        sent,
        verified,
        resendTimer: otp.resendTimer,
        send,
        verify,
    };
}
