/**
 * useOtpPad — low-level OTP-pad UI primitive.
 *
 * 2026-06-04 (Phase 1.4.A): Shared between signup + login flows.
 * Extracts the 6-digit OTP input mechanics that were duplicated in:
 *   - app/(auth)/signup.tsx   (otpValues, otpRefs, handleOtpChange, handleOtpKeyPress)
 *   - app/(auth)/login.tsx    (same set, identical behavior)
 *
 * Behavior preserved exactly:
 *   - Auto-advance to the next box on character entry (up to length - 1)
 *   - Backspace on an empty box moves focus to the previous box
 *   - `reset()` returns to all-empty (used after a fresh OTP send)
 *
 * The hook is intentionally length-parametric (default 6) so it can be
 * reused for any digit-pad-style OTP UI.
 */

import { useState, useRef } from 'react';
import type { TextInput } from 'react-native';

export interface UseOtpPadResult {
    /** Current value of each box (length = `length`). */
    values: string[];
    /** Refs into the TextInput components, indexed by box position. */
    refs: React.MutableRefObject<(TextInput | null)[]>;
    /** Wire to each `TextInput`'s `onChangeText`. Receives the new char + box index. */
    onChange: (text: string, index: number) => void;
    /** Wire to each `TextInput`'s `onKeyPress`. Handles Backspace navigation. */
    onKeyPress: (e: any, index: number) => void;
    /** Reset all boxes to empty. */
    reset: () => void;
    /** Joined value across all boxes (e.g. "123456"). */
    getValue: () => string;
}

export function useOtpPad(length: number = 6): UseOtpPadResult {
    const [values, setValues] = useState<string[]>(() => Array(length).fill(''));
    const refs = useRef<(TextInput | null)[]>([]);

    const onChange = (text: string, index: number) => {
        const newValues = [...values];
        newValues[index] = text;
        setValues(newValues);
        if (text && index < length - 1) refs.current[index + 1]?.focus();
    };

    const onKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
            refs.current[index - 1]?.focus();
        }
    };

    const reset = () => setValues(Array(length).fill(''));
    const getValue = () => values.join('');

    return { values, refs, onChange, onKeyPress, reset, getValue };
}
