/**
 * useImageUpload — shared Supabase Storage upload primitive.
 *
 * 2026-06-04 (Phase 1.5.A): Extracts the file→storage upload pattern that was
 * duplicated across signup.tsx (inline `uploadFile`, ~24 lines) and
 * settings/branches.tsx (inline `uploadBranchPhotos`, ~20 lines). Today both
 * callers share the same skip-already-uploaded guard and the same return shape
 * but DIFFER on:
 *   - Bucket (signup → 'merchant-docs', branches → 'merchant-assets')
 *   - Mechanism (signup uses base64 + FileSystem; branches used fetch+blob)
 *   - Retry policy (signup retries 3× with backoff; branches had none)
 *
 * Per the Phase 1.5 decision (Pranav 2026-06-04):
 *   Q1 = base64 + FileSystem (more reliable on Android than fetch(file://))
 *   Q2 = branches inherits signup's 3-attempt retry — free reliability win
 *   Q3 = bucket parameterized per call site (no migration of existing files)
 *
 * Behavior preserved verbatim from signup.tsx:467-491:
 *   - Skip-already-uploaded: returns `uri` unchanged if it already looks like
 *     a Supabase path or URL (any non-file://, non-content:// prefix).
 *   - Retry: 3 attempts with delay `attempt * 1500ms` (so 1.5s, 3.0s gaps).
 *   - On fatal failure: throws Error with the underlying message.
 *   - On success: returns the new `path` (caller stores this to the DB).
 *   - On empty input: returns null.
 *
 * Hook returns a stable function — does NOT use React state or effects. Safe
 * to call inside async event handlers without dependency-array concerns.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';

export interface UseImageUploadOptions {
    /** Supabase Storage bucket name (e.g. 'merchant-docs', 'merchant-assets'). */
    bucket: string;
    /** MIME type sent with the upload. Default: 'image/jpeg'. */
    contentType?: string;
    /** Number of upload attempts before throwing. Default: 3. */
    maxRetries?: number;
}

export interface UseImageUploadResult {
    /**
     * Upload one file to the configured bucket at the given path.
     *  - Returns the new `path` on successful upload.
     *  - Returns the original `uri` unchanged if it isn't a local file URI
     *    (i.e. it's already a Supabase-hosted path/URL).
     *  - Returns null if `uri` is empty/falsy.
     *  - Throws on fatal upload failure (after exhausting retries).
     */
    uploadFile: (uri: string, path: string) => Promise<string | null>;
}

export function useImageUpload({
    bucket,
    contentType = 'image/jpeg',
    maxRetries = 3,
}: UseImageUploadOptions): UseImageUploadResult {
    const uploadFile = async (uri: string, path: string): Promise<string | null> => {
        if (!uri) return null;

        // Skip-already-uploaded: if it's not a local file URI, assume it's
        // already in storage and pass it through unchanged.
        if (
            uri.includes('supabase.co') ||
            (!uri.startsWith('file://') && !uri.startsWith('content://'))
        ) {
            return uri;
        }

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
                const { error } = await supabase.storage
                    .from(bucket)
                    .upload(path, decode(base64), { contentType, upsert: true });
                if (error) {
                    console.error('[useImageUpload error]:', error);
                    throw new Error(error.message || 'Supabase upload error');
                }
                return path;
            } catch (error: any) {
                console.error(
                    `[useImageUpload attempt ${attempt}/${maxRetries} failed]:`,
                    error.message || error,
                );
                if (attempt === maxRetries) throw new Error(error.message || 'Upload failed');
                await new Promise(resolve => setTimeout(resolve, attempt * 1500));
            }
        }

        throw new Error('Upload failed');
    };

    return { uploadFile };
}
