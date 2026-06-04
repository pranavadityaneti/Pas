/**
 * SignupContext — master state holder for the merchant signup flow.
 *
 * 2026-06-04 (Phase 1.6.A): Lifts all cross-step useState calls + the 3
 * coordinating side-effects out of app/(auth)/signup.tsx so that — in Phase
 * 1.7 — each step can become an independent component reading/writing via
 * `useSignupContext()` instead of being passed dozens of props.
 *
 * What this Provider owns:
 *   1. Navigation: step + setStep
 *   2. UI flags: loading + setLoading, isRestoring (read-only to consumers)
 *   3. Step 1 — identity (ownerName, phone, email)
 *   4. Step 2 — store (storeName, categoryId, address, lat/lng, ...) + the
 *      verticals list (fetched on mount) + selectedVertical derivation
 *   5. Step 3 — storePhotos
 *   6. Step 4 — hasBranches, branches
 *   7. Step 5 — kyc + docFiles
 *   8. Step 6 — paymentStatus, paymentDetails
 *
 *   + fetchRemoteMerchantState() helper (exposed via context — invoked by
 *     the OTP-verify success callback in signup.tsx to check whether the
 *     phone has a pre-existing paid subscription and bypass Step 6)
 *
 *   + 3 coordinating effects (mount-time vertical fetch, mount-time draft
 *     restoration from AsyncStorage + post-restore guard, debounced 1s
 *     draft persistence)
 *
 * What stays in signup.tsx:
 *   - All UI handlers (validateStep, handleNext, handlePayment,
 *     syncDraftState, pickDocument, pickStorePhoto, requestLocation)
 *   - All hook calls (useSignupOtpVerify, useImageUpload)
 *   - All JSX
 *   - styles
 *   - getApiUrl + fetchWithTimeout (still needed by syncDraftState; this
 *     file inlines its own copy for fetchVerticals + fetchRemoteMerchantState)
 *
 * Behavior preservation: every useState initial value, every effect's
 * dependency array, every conditional in fetchRemoteMerchantState, and the
 * exact AsyncStorage key '@merchant_signup_draft' are reproduced verbatim
 * from signup.tsx as of commit 862bb4f9 (Phase 1.5.C).
 */

import React, {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import type { Vertical, IdentityState, StoreState, KycState, Branch, Store } from './types';
import uuid from 'react-native-uuid';

/* ─────────────────────────── Local helpers ──────────────────────────── */

const getApiUrl = (): string => {
    return process.env.EXPO_PUBLIC_API_URL as string;
};

/**
 * 2026-06-04 (Phase 2.C.1): Factory for a fresh empty Store entry. Used by:
 *   - Provider mount (seeds `stores` with one editable card per spec)
 *   - "Save & Add Another Store" in StepStores
 * `uuid.v4()` returns a string-typed UUID — wrapped via `String()` to satisfy
 * the typedef (the lib's `.v4()` return is `string | number[]`).
 */
export function createEmptyStore(): Store {
    return {
        id: String(uuid.v4()),
        name: '',
        address: '',
        latitude: null,
        longitude: null,
        city: '',
        managerName: '',
        managerPhone: '',
        photos: [],
        cuisines: [],
        isVeg: false,
        restaurantType: '',
    };
}

/**
 * 15-second AbortController wrapper around fetch. Duplicated here from
 * signup.tsx (which still uses its own copy for syncDraftState). Defer
 * DRY-ing this until a 3rd caller emerges.
 */
async function fetchWithTimeout(
    resource: string,
    options: any = {},
): Promise<Response> {
    const { timeout = 15000, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...fetchOptions,
            signal: controller.signal as any,
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new Error('Network timeout.');
        throw error;
    }
}

/* ──────────────────────────── Context value ─────────────────────────── */

export interface SignupContextValue {
    // ── navigation ────────────────────────────────────────────────────
    step: number;
    setStep: React.Dispatch<React.SetStateAction<number>>;

    // ── ui flags ──────────────────────────────────────────────────────
    loading: boolean;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>;
    isRestoring: boolean;

    // ── step 1: identity ──────────────────────────────────────────────
    identity: IdentityState;
    setIdentity: React.Dispatch<React.SetStateAction<IdentityState>>;

    // ── step 2: store + verticals + derived selectedVertical ──────────
    store: StoreState;
    setStore: React.Dispatch<React.SetStateAction<StoreState>>;
    verticals: Vertical[];
    verticalsLoading: boolean;
    verticalsError: string;
    selectedVertical: Vertical | undefined;

    // ── step 3: photos ────────────────────────────────────────────────
    storePhotos: string[];
    setStorePhotos: React.Dispatch<React.SetStateAction<string[]>>;

    // ── step 4: branches (LEGACY — to be removed in Phase 2.G) ────────
    hasBranches: boolean;
    setHasBranches: React.Dispatch<React.SetStateAction<boolean>>;
    branches: Branch[];
    setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;

    // ── step 3 (v2): consolidated stores list ─────────────────────────
    /**
     * 2026-06-04 (Phase 2.C.1): v2 Stores replaces v1's main store + photos
     * + branches trio. Seeded with one empty Store on Provider mount so the
     * Step 3 UI opens with one editable card (spec requirement). N stores
     * supported via "Save & Add Another Store"; no is_primary flag.
     */
    stores: Store[];
    setStores: React.Dispatch<React.SetStateAction<Store[]>>;

    // ── step 5: kyc + docFiles ────────────────────────────────────────
    kyc: KycState;
    setKyc: React.Dispatch<React.SetStateAction<KycState>>;
    docFiles: { [key: string]: string | null };
    setDocFiles: React.Dispatch<React.SetStateAction<{ [key: string]: string | null }>>;

    // ── step 6: payment ───────────────────────────────────────────────
    paymentStatus: 'idle' | 'success' | 'failed';
    setPaymentStatus: React.Dispatch<React.SetStateAction<'idle' | 'success' | 'failed'>>;
    paymentDetails: any;
    setPaymentDetails: React.Dispatch<React.SetStateAction<any>>;

    // ── helpers ───────────────────────────────────────────────────────
    /**
     * Re-fetches the verticals list. Mostly invoked by the Provider's mount
     * effect, but ALSO exposed via context because Step 2's category-picker
     * modal has a "Retry" button that calls it on verticalsError.
     */
    fetchVerticals: () => Promise<void>;
    /**
     * Pre-existing-subscription guard. Called by:
     *   - the draft-restoration effect inside this Provider (post-restore)
     *   - the OTP-verify onVerified callback in signup.tsx (with the fresh
     *     access token)
     * On a successful match it sets paymentStatus='success', stashes
     * paymentDetails, and bumps Step 6 → Step 7 if the user was sitting
     * on the subscription step.
     */
    fetchRemoteMerchantState: (token?: string) => Promise<void>;
}

const SignupContext = createContext<SignupContextValue | undefined>(undefined);

/* ──────────────────────────── Provider ─────────────────────────────── */

export interface SignupProviderProps {
    children: ReactNode;
}

export function SignupProvider({ children }: SignupProviderProps) {
    // ── state ─────────────────────────────────────────────────────────
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);

    const [identity, setIdentity] = useState<IdentityState>({
        ownerName: '',
        designation: '',
        phone: '',
        email: '',
    });

    const [store, setStore] = useState<StoreState>({
        storeName: '',
        categoryId: '',
        categoryName: '',
        city: 'Hyderabad',
        address: '',
        latitude: 17.385,
        longitude: 78.4867,
        cuisines: [] as string[],
        isVeg: false,
        restaurantType: '',
    });

    const [verticals, setVerticals] = useState<Vertical[]>([]);
    const [verticalsLoading, setVerticalsLoading] = useState(false);
    const [verticalsError, setVerticalsError] = useState('');

    const [storePhotos, setStorePhotos] = useState<string[]>([]);

    const [hasBranches, setHasBranches] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);

    // 2026-06-04 (Phase 2.C.1): v2 consolidated stores. Lazy-initialized with
    // one empty Store so Step 3 opens with a single editable card. Subsequent
    // stores added via the StepStores "Save & Add Another Store" button.
    const [stores, setStores] = useState<Store[]>(() => [createEmptyStore()]);

    const [kyc, setKyc] = useState<KycState>({
        panNumber: '',
        aadharNumber: '',
        msmeNumber: '',
        bankAccount: '',
        ifsc: '',
        // 2026-06-04 (Phase 2.B): no default. Was '<20L' previously, which
        // silently biased every merchant into the lowest band. Spec mandates
        // explicit selection before Step → 6 navigation.
        turnoverRange: null,
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

    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'success' | 'failed'>('idle');
    const [paymentDetails, setPaymentDetails] = useState<any>(null);

    // ── derived ───────────────────────────────────────────────────────
    const selectedVertical = useMemo(
        () => verticals.find(v => v.id === store.categoryId),
        [verticals, store.categoryId],
    );

    // ── fetchVerticals (private to this Provider) ─────────────────────
    const fetchVerticals = async () => {
        setVerticalsLoading(true);
        setVerticalsError('');
        try {
            const response = await fetchWithTimeout(`${getApiUrl()}/verticals`, { method: 'GET' });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to fetch verticals');
            setVerticals(Array.isArray(data) ? data : data.verticals || []);
        } catch (err: any) {
            setVerticalsError(err.message || 'Error fetching verticals');
        } finally {
            setVerticalsLoading(false);
        }
    };

    // ── fetchRemoteMerchantState (exposed via context) ────────────────
    const fetchRemoteMerchantState = async (token?: string) => {
        try {
            let activeToken = token;
            if (!activeToken) {
                const { data: sessionData } = await supabase.auth.getSession();
                activeToken = sessionData?.session?.access_token;
            }
            if (!activeToken) return;

            const response = await fetchWithTimeout(`${getApiUrl()}/auth/merchant/draft`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${activeToken}` },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.subscription && data.subscription.status === 'success') {
                    console.log('[Guard] Found existing successful subscription. Bypassing Step 6.');
                    setPaymentStatus('success');
                    setPaymentDetails({
                        paymentId: data.subscription.transactionId,
                        orderId: data.subscription.orderId,
                        amount: data.subscription.amount,
                    });
                    // If they are on the subscription step, move them forward
                    if (step === 6) setStep(7);
                }
            }
        } catch (err) {
            console.warn('[Guard] Pre-flight check failed:', err);
        }
    };

    // ── mount effects ─────────────────────────────────────────────────

    // Vertical list fetch on mount (was: signup.tsx useEffect line ~144)
    useEffect(() => {
        fetchVerticals();
    }, []);

    // Draft restoration on mount (was: signup.tsx useEffect line ~216)
    useEffect(() => {
        const loadDraft = async () => {
            try {
                const draft = await AsyncStorage.getItem('@merchant_signup_draft');
                if (draft) {
                    const parsed = JSON.parse(draft);
                    if (parsed.step) setStep(parsed.step);
                    if (parsed.identity) setIdentity(parsed.identity);
                    if (parsed.store) {
                        setStore({
                            ...parsed.store,
                            categoryId: parsed.store.categoryId || '',
                            categoryName: parsed.store.categoryName || parsed.store.category || '',
                            cuisines: parsed.store.cuisines || [],
                            isVeg: parsed.store.isVeg ?? false,
                            restaurantType: parsed.store.restaurantType || '',
                        });
                    }
                    if (parsed.hasBranches !== undefined) setHasBranches(parsed.hasBranches);
                    if (parsed.branches) setBranches(parsed.branches);
                    // 2026-06-04 (Phase 2.C.1): v2 stores list. If a prior session
                    // saved a non-empty stores array, restore it. Falls back to the
                    // one-empty-store seed already set by useState's lazy initializer.
                    if (Array.isArray(parsed.stores) && parsed.stores.length > 0) {
                        setStores(parsed.stores);
                    }
                    if (parsed.kyc) setKyc(parsed.kyc);
                    if (parsed.docFiles) setDocFiles(parsed.docFiles);
                    if (parsed.storePhotos) setStorePhotos(parsed.storePhotos);
                    console.log('[Signup] Draft restored securely. Resuming from step:', parsed.step);

                    // After restoring local draft, check remote for subscription guard
                    fetchRemoteMerchantState();
                }
            } catch (e) {
                console.error('[Signup] Failed to restore draft state', e);
            } finally {
                setIsRestoring(false);
            }
        };
        loadDraft();
    }, []);

    // Debounced (1s) draft persistence to AsyncStorage — gated on !isRestoring
    // (was: signup.tsx useEffect line ~254)
    useEffect(() => {
        if (isRestoring) return; // Do not overwrite draft with empty initial states during mount
        const timer = setTimeout(() => {
            const snapshot = { step, identity, store, hasBranches, branches, stores, kyc, docFiles, storePhotos };
            AsyncStorage.setItem('@merchant_signup_draft', JSON.stringify(snapshot)).catch(e => {
                console.error('[Signup] Failed to synchronize draft with disk:', e);
            });
        }, 1000); // 1-second debounce per QA instructions
        return () => clearTimeout(timer);
    }, [step, identity, store, hasBranches, branches, stores, kyc, docFiles, storePhotos, isRestoring]);

    // ── exposed value ─────────────────────────────────────────────────
    const value: SignupContextValue = {
        step, setStep,
        loading, setLoading,
        isRestoring,
        identity, setIdentity,
        store, setStore,
        verticals, verticalsLoading, verticalsError,
        selectedVertical,
        storePhotos, setStorePhotos,
        hasBranches, setHasBranches,
        branches, setBranches,
        stores, setStores,
        kyc, setKyc,
        docFiles, setDocFiles,
        paymentStatus, setPaymentStatus,
        paymentDetails, setPaymentDetails,
        fetchVerticals,
        fetchRemoteMerchantState,
    };

    return <SignupContext.Provider value={value}>{children}</SignupContext.Provider>;
}

/* ──────────────────────────── Consumer hook ─────────────────────────── */

/**
 * Returns the SignupContext value. Throws if used outside a SignupProvider —
 * this surfaces wiring bugs at the first call instead of as a confusing
 * "Cannot read properties of undefined" deeper in the consumer.
 */
export function useSignupContext(): SignupContextValue {
    const ctx = useContext(SignupContext);
    if (!ctx) {
        throw new Error('useSignupContext must be used inside a <SignupProvider>');
    }
    return ctx;
}
