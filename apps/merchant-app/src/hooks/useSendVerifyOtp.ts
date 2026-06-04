/**
 * useSendVerifyOtp — low-level OTP send + verify API wrapper.
 *
 * 2026-06-04 (Phase 1.4.A): Shared between signup + login flows.
 * Extracts the Wati-OTP send + verify API call patterns that were duplicated in:
 *   - app/(auth)/signup.tsx   (handleSendOtp + handleVerifyOtp)
 *   - app/(auth)/login.tsx    (same shape with `isLogin` flag)
 *
 * Behavior preserved exactly:
 *   - 15-second AbortController timeout per request (matches `fetchWithTimeout` in
 *     both files)
 *   - Body shape: `{ phone, isSignup: true }` or `{ phone, isLogin: true }` per the
 *     `purpose` argument
 *   - Send-success starts a 60-second resend countdown
 *   - Verify-success returns `{ ok: true, data }` where data contains
 *     `session.access_token`, `session.refresh_token`, `user`, `isNewUser`, etc.
 *     — exactly what `/auth/verify-otp` returns today
 *   - Failures return `{ ok: false, error }` rather than throwing
 *
 * Mid-layer hooks (`useSignupOtpVerify`, `useLoginOtpVerify`) wrap this and add
 * their own post-verify business logic (duplicate-check, role discovery, etc).
 */

import { useState, useEffect } from 'react';

export type OtpPurpose = 'signup' | 'login';

export interface SendOtpResult {
    ok: boolean;
    error?: string;
}

export type VerifyOtpResult =
    | { ok: true; data: any }
    | { ok: false; error: string };

export interface UseSendVerifyOtpResult {
    /** Send an OTP to the given fully-formed phone (e.g. "919876543210"). */
    sendOtp: (phone: string) => Promise<SendOtpResult>;
    /** Verify a 6-digit OTP for the given phone. */
    verifyOtp: (phone: string, otp: string) => Promise<VerifyOtpResult>;
    /** Seconds remaining on the 60s resend cooldown (0 = can resend). */
    resendTimer: number;
    /** True while a send or verify request is in flight. */
    loading: boolean;
}

const getApiUrl = (): string => {
    return process.env.EXPO_PUBLIC_API_URL as string;
};

/** Same 15-second AbortController pattern used in signup.tsx + login.tsx. */
async function fetchWithTimeout(resource: string, options: any = {}): Promise<Response> {
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
}

export function useSendVerifyOtp(purpose: OtpPurpose): UseSendVerifyOtpResult {
    const [resendTimer, setResendTimer] = useState(0);
    const [loading, setLoading] = useState(false);

    // 60-second resend cooldown tick — identical to the existing useEffect blocks
    // in signup.tsx + login.tsx.
    useEffect(() => {
        if (resendTimer > 0) {
            const timer = setTimeout(() => setResendTimer(prev => prev - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [resendTimer]);

    const sendOtp = async (phone: string): Promise<SendOtpResult> => {
        setLoading(true);
        try {
            const body = purpose === 'signup'
                ? { phone, isSignup: true }
                : { phone, isLogin: true };
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) {
                return { ok: false, error: data.error || 'Failed to send OTP' };
            }
            setResendTimer(60);
            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message || 'Failed to send OTP.' };
        } finally {
            setLoading(false);
        }
    };

    const verifyOtp = async (phone: string, otp: string): Promise<VerifyOtpResult> => {
        setLoading(true);
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otp }),
            });
            const data = await response.json();
            if (!response.ok) {
                return { ok: false, error: data.error || 'OTP verification failed' };
            }
            return { ok: true, data };
        } catch (err: any) {
            return { ok: false, error: err.message || 'Network error' };
        } finally {
            setLoading(false);
        }
    };

    return { sendOtp, verifyOtp, resendTimer, loading };
}
