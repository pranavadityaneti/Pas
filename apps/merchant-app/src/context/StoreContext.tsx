// @lock (2026-06-27) — the draft-state surface (kycStatus + isDraft, consumed by
// the merchant entry routing payment gate in app/index.tsx) must not be edited
// without explicit chat-confirmed approval from Pranav. Other context logic is editable.
import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import { updateBranch, toBranchWritePayload } from '../services/branches';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Store {
    id: string;
    name: string;
    address: string | null;
    image: string | null;
    active: boolean;
    operating_hours?: any;
    prep_time_minutes?: number;
    isDining?: boolean;
    isPremium?: boolean;
    requiresFssai?: boolean;
    service_pickup?: boolean;
    service_dinein?: boolean;
    service_table_booking?: boolean;
    slot_config?: any;
}

export interface Branch {
    id: string;
    name: string;
    type: 'main' | 'branch';
    address: string | null;
    city: string | null;
    isActive: boolean;
    phone?: string | null;
    managerName?: string | null;
}

export interface ParentStoreContext {
    merchantId: string;
    merchantName: string;
    role: 'owner' | 'manager';
    branches: { branchId: string; branchName: string }[];
    // Admin-approval gate: true only when the merchant's Store is approved
    // (merchant.status === 'active' / Store.active = true). Drafts and
    // finalized-but-unapproved merchants are false → blocked from the main app.
    // NOTE: this is the APPROVAL flag, distinct from the merchant's online/offline
    // availability toggle (merchant_branches.is_active).
    isApproved: boolean;
    // 2026-06-26 strict payment gate: the merchant's kyc_status. 'draft' = signup
    // not yet paid/submitted → routed back to the payment step (not "pending").
    kycStatus?: string;
}

export const ROLE_PERMISSIONS = {
    owner: {
        earnings_reports: { view: true, edit: true, export: true },
        returns: { view: true, action: true },
        refunds: { view: true, action: true },
        store_timings: { view: true, edit: true },
        notifications: { view: true, configure: true },
        staff_management: true,
        store_details: true,
        branch_management: true,
        add_branch: true,
        delete_account: true,
    },
    manager: {
        earnings_reports: { view: true, edit: false, export: true },
        returns: { view: true, action: true },
        refunds: { view: true, action: true },
        store_timings: { view: true, edit: true },
        notifications: { view: true, configure: true },
        staff_management: false,
        store_details: false,
        branch_management: false,
        add_branch: false,
        delete_account: false,
    }
};

export const NO_PERMISSIONS = {
    earnings_reports: { view: false, edit: false, export: false },
    returns: { view: false, action: false },
    refunds: { view: false, action: false },
    store_timings: { view: false, edit: false },
    notifications: { view: false, configure: false },
    staff_management: false,
    store_details: false,
    branch_management: false,
    add_branch: false,
    delete_account: false,
};

export type RolePermissions = typeof ROLE_PERMISSIONS.owner;

interface StoreContextType {
    store: Store | null;
    merchantId: string | null;
    loading: boolean;
    branches: Branch[];
    activeStoreId: string | null; // Currently viewed branch
    activeBranchId: string | null; // Alias for activeStoreId (for clarity)
    availableContexts: ParentStoreContext[];
    activeContext: ParentStoreContext | null;
    permissions: RolePermissions;
    isSwitching: boolean;
    // Defense-in-depth (Layer 3, May 20, 2026): true when this merchant has at least
    // one real row in merchant_branches. False when the StoreContext is using the
    // legacy phantom-branch fallback (activeStoreId = merchant_id, NOT a real FK target).
    // Product-save flows MUST check this and refuse to write when false, otherwise
    // the StoreProduct.branch_id FK violates fk_storeproduct_branch.
    hasRealBranch: boolean;
    // True only when the active merchant is admin-approved (Store.active=true).
    // The main app is gated on this; not-approved merchants are routed to /(auth)/pending.
    isApproved: boolean;
    // 2026-06-26 strict payment gate: true when the merchant is still a 'draft'
    // (signup not yet paid/submitted) → routed to the payment step, not "pending".
    isDraft: boolean;
    switchBranch: (branchId: string) => void;
    switchContext: (context: ParentStoreContext) => Promise<void>;
    toggleStoreStatus: (newStatus: boolean) => Promise<{ success: boolean; error?: string }>;
    refreshStore: () => Promise<Store | null>;
    updateStoreDetails: (updates: Partial<Store>) => Promise<{ success: boolean; error?: string }>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const CACHE_KEY = 'cached_store_state';

export function StoreProvider({ children }: { children: React.ReactNode }) {
    // Raw store data from fetchStore — NOT the derived store object consumers see
    const [rawStoreData, setRawStoreData] = useState<{ id: string; image: string | null; vertical?: any } | null>(null);
    // Per-branch data keyed by branch ID — operating_hours, prep_time, service modes, etc.
    const [branchDataMap, setBranchDataMap] = useState<Record<string, any>>({});
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [hasRealBranch, setHasRealBranch] = useState<boolean>(false);
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
    const [availableContexts, setAvailableContexts] = useState<ParentStoreContext[]>([]);
    const [activeContext, setActiveContext] = useState<ParentStoreContext | null>(null);
    const [isSwitching, setIsSwitching] = useState(false);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

    const permissions = activeContext ? ROLE_PERMISSIONS[activeContext.role] : NO_PERMISSIONS;

    // Reactive store derivation — always reflects the current branch
    const store = useMemo<Store | null>(() => {
        if (!activeContext || !activeStoreId || !rawStoreData) return null;
        const activeBranch = branches.find(b => b.id === activeStoreId);
        const bd = branchDataMap[activeStoreId] || {};
        return {
            id: activeContext.merchantId,
            name: activeBranch?.name ?? activeContext.merchantName,
            address: activeBranch?.address ?? null,
            image: rawStoreData.image,
            active: activeBranch?.isActive ?? true,
            operating_hours: bd.operating_hours ?? null,
            prep_time_minutes: bd.prep_time_minutes ?? 15,
            service_pickup: bd.service_pickup ?? true,
            service_dinein: bd.service_dinein ?? true,
            service_table_booking: bd.service_table_booking ?? false,
            slot_config: bd.slot_config ?? [],
            isDining: rawStoreData.vertical?.isDining ?? false,
            isPremium: rawStoreData.vertical?.isPremium ?? false,
            requiresFssai: rawStoreData.vertical?.requiresFssai ?? false,
        };
    }, [activeContext, activeStoreId, branches, rawStoreData, branchDataMap]);

    const fetchStore = useCallback(async () => {
        try {
            setLoading(true);
            console.log('[fetchStore] Starting cold-boot fetch...');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                console.log('[fetchStore] No auth session found — redirecting to login');
                setLoading(false);
                return null;
            }
            console.log('[fetchStore] Auth session found. User ID:', user.id);

            const phone = user.phone || (user.email?.includes('@phone.pickatstore.app') ? user.email.split('@')[0] : '');
            const rawPhone = phone.replace(/\D/g, '').slice(-10);
            const phoneQuery = `phone.eq.${rawPhone},phone.eq.91${rawPhone},phone.eq.+91${rawPhone}`;

            // Step 1: Discover all relevant merchant IDs and branch IDs
            const { data: ownerData } = await supabase.from('merchants').select('id, store_name, status, address, kyc_status').or(phoneQuery);
            const { data: managerData } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id, is_active, address').or(phoneQuery);
            const { data: staffRoles } = await supabase.from('store_staff').select('store_id, role').eq('user_id', user.id);

            const contextMap = new Map<string, ParentStoreContext>();

            if (ownerData) {
                ownerData.forEach(o => {
                    contextMap.set(o.id, {
                        merchantId: o.id,
                        merchantName: o.store_name || 'Main Store',
                        role: 'owner',
                        branches: [{ branchId: o.id, branchName: o.store_name || 'Main Store' }],
                        // Approval gate: only 'active' merchants are admin-approved.
                        isApproved: (o as any).status === 'active',
                        kycStatus: (o as any).kyc_status ?? undefined,
                    });
                });
            }

            const addManagerBranch = (merchantId: string, branchId: string, branchName: string, role: string = 'manager') => {
                if (contextMap.has(merchantId)) {
                    const ctx = contextMap.get(merchantId)!;
                    if (role === 'owner') ctx.role = 'owner';
                    if (!ctx.branches.find(b => b.branchId === branchId)) {
                        ctx.branches.push({ branchId, branchName });
                    }
                } else {
                    contextMap.set(merchantId, {
                        merchantId,
                        merchantName: '',
                        role: role as 'owner' | 'manager',
                        branches: [{ branchId, branchName }],
                        // Managers/staff are provisioned only for already-operational stores,
                        // so they pass the approval gate. (Drafts have no staff.)
                        isApproved: true,
                    });
                }
            };

            if (managerData) {
                managerData.forEach(b => {
                    const staffRecord = staffRoles?.find(s => s.store_id === b.id);
                    addManagerBranch(b.merchant_id, b.id, b.branch_name, staffRecord?.role);
                });
            }

            if (staffRoles && staffRoles.length > 0) {
                const storeIds = staffRoles.map(s => s.store_id);
                const { data: branchCheck } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id').in('id', storeIds);
                if (branchCheck) {
                    branchCheck.forEach(b => {
                        const staffRecord = staffRoles.find(s => s.store_id === b.id);
                        addManagerBranch(b.merchant_id, b.id, b.branch_name, staffRecord?.role);
                    });
                }
                const { data: mainStoreCheck } = await supabase.from('merchants').select('id, store_name').in('id', storeIds);
                if (mainStoreCheck) {
                    mainStoreCheck.forEach(m => {
                        const staffRecord = staffRoles.find(s => s.store_id === m.id);
                        const role = staffRecord?.role || 'manager';

                        if (contextMap.has(m.id)) {
                             const ctx = contextMap.get(m.id)!;
                             if (role === 'owner') ctx.role = 'owner';
                             if (!ctx.branches.find(b => b.branchId === m.id)) {
                                 ctx.branches.push({ branchId: m.id, branchName: m.store_name || 'Main Store' });
                             }
                        } else {
                             contextMap.set(m.id, {
                                 merchantId: m.id,
                                 merchantName: m.store_name || 'Main Store',
                                 role: role as 'owner' | 'manager',
                                 branches: [{ branchId: m.id, branchName: m.store_name || 'Main Store' }],
                                 // Discovered via store_staff → an operational store (drafts have no staff).
                                 isApproved: true,
                             });
                        }
                    });
                }
            }

            // Fetch ALL branches for every merchant where the user is an owner
            // This includes merchants discovered via phone match AND via staffRoles
            const ownerMerchantIds = Array.from(contextMap.entries())
                .filter(([_, ctx]) => ctx.role === 'owner')
                .map(([id]) => id);
            if (ownerData) {
                ownerData.forEach(o => {
                    if (!ownerMerchantIds.includes(o.id)) ownerMerchantIds.push(o.id);
                });
            }
            if (ownerMerchantIds.length > 0) {
                 const { data: ownedBranches } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id').in('merchant_id', ownerMerchantIds);
                 if (ownedBranches) {
                     ownedBranches.forEach(b => {
                          const ctx = contextMap.get(b.merchant_id);
                          if (ctx && !ctx.branches.find(x => x.branchId === b.id)) {
                              ctx.branches.push({ branchId: b.id, branchName: b.branch_name });
                          }
                     });
                 }
            }

            const contextsWithoutName = Array.from(contextMap.values()).filter(c => !c.merchantName);
            if (contextsWithoutName.length > 0) {
                 const missingIds = contextsWithoutName.map(c => c.merchantId);
                 const { data: missingMerchants } = await supabase.from('merchants').select('id, store_name').in('id', missingIds);
                 if (missingMerchants) {
                     missingMerchants.forEach(m => {
                         const ctx = contextMap.get(m.id);
                         if (ctx) ctx.merchantName = m.store_name || 'Main Store';
                     });
                 }
            }

            const discoveredContexts = Array.from(contextMap.values());
            console.log('[fetchStore] Discovered contexts:', discoveredContexts.length, discoveredContexts.map(c => `${c.merchantName}(${c.role})`));

            const activeContextRaw = await AsyncStorage.getItem('active_context');
            const savedBranchIdRaw = await AsyncStorage.getItem('active_branch_id');
            console.log('[fetchStore] AsyncStorage active_context:', activeContextRaw ? 'found' : 'null');
            console.log('[fetchStore] AsyncStorage active_branch_id:', savedBranchIdRaw || 'null');

            let savedContext: ParentStoreContext | null = null;
            if (activeContextRaw) {
                try { savedContext = JSON.parse(activeContextRaw); } catch(e) { console.error(e); }
            }

            let finalContext = discoveredContexts.find(c => c.merchantId === savedContext?.merchantId) 
                            || discoveredContexts[0];

            if (!finalContext) {
                console.log('[fetchStore] No contexts discovered — aborting');
                setLoading(false);
                return null;
            }
            console.log('[fetchStore] Final context:', finalContext.merchantName, '/', finalContext.role);

            const { data: pData } = await supabase.from('merchants').select('*').eq('id', finalContext.merchantId).maybeSingle();
            if (!pData) {
                setLoading(false);
                return null;
            }

            let verticalData = null;
            if (pData.vertical_id) {
                const { data: v } = await supabase.from('Vertical').select('*').eq('id', pData.vertical_id).maybeSingle();
                verticalData = v;
            }

            const { data: bData, error: bError } = await supabase.from('merchant_branches').select('*').eq('merchant_id', finalContext.merchantId);
            const allBranches: Branch[] = [];
            // Set of real branch IDs from merchant_branches table
            const realBranchIds = new Set<string>();

            if (bData && bData.length > 0) {
                 bData.forEach(b => {
                     realBranchIds.add(b.id);
                     if (finalContext.role === 'owner' || finalContext.branches.find(cb => cb.branchId === b.id)) {
                         allBranches.push({ id: b.id, name: b.branch_name, type: 'main', isActive: b.is_active ?? true, address: b.address, city: b.city });
                     }
                 });
            } else {
                 allBranches.push({ id: finalContext.merchantId, name: finalContext.merchantName, type: 'main', isActive: pData.status === 'active' || pData.status === true || pData.status == null, address: pData.address, city: null });
            }

            // Clean up phantom branches: remove context branches that don't exist
            // in merchant_branches (e.g., merchantId added as branchId during discovery).
            // This prevents activeStoreId from pointing to a non-existent branch row.
            if (realBranchIds.size > 0) {
                finalContext.branches = finalContext.branches.filter(
                    b => realBranchIds.has(b.branchId)
                );
                // Ensure at least one branch remains (use first real branch)
                if (finalContext.branches.length === 0 && allBranches.length > 0) {
                    finalContext.branches.push({ branchId: allBranches[0].id, branchName: allBranches[0].name });
                }
            }

            // Resolve active branch: prefer saved branch, then first real branch
            let finalBranchId = allBranches[0]?.id || finalContext.merchantId;

            if (savedBranchIdRaw && allBranches.find(b => b.id === savedBranchIdRaw)) {
                finalBranchId = savedBranchIdRaw;
            }

            const activeBranchObj = allBranches.find(b => b.id === finalBranchId) || allBranches[0];
            finalBranchId = activeBranchObj.id;
            console.log('[fetchStore] Final branch ID:', finalBranchId, '(real branch:', realBranchIds.has(finalBranchId), ')');

            // Build per-branch data map from ALL fetched branches
            const newBranchDataMap: Record<string, any> = {};
            if (bData) {
                bData.forEach(b => {
                    newBranchDataMap[b.id] = {
                        operating_hours: b.operating_hours || null,
                        prep_time_minutes: b.prep_time_minutes ?? 15,
                        service_pickup: b.service_pickup ?? true,
                        service_dinein: b.service_dinein ?? true,
                        service_table_booking: b.service_table_booking ?? false,
                        slot_config: b.slot_config ?? [],
                    };
                });
            }

            const rawData = {
                id: pData.id,
                image: pData.logo_url || null,
                vertical: verticalData
            };

            setMerchantId(finalContext.merchantId);
            setRawStoreData(rawData);
            setBranchDataMap(newBranchDataMap);
            setBranches(allBranches);
            // Layer 3 defense: only flip true when at least one REAL merchant_branches row exists.
            // The phantom-branch fallback (id = merchant_id) does NOT count.
            setHasRealBranch(realBranchIds.size > 0);
            setActiveStoreId(finalBranchId);
            setAvailableContexts(discoveredContexts);
            setActiveContext(finalContext);
            
            await AsyncStorage.setItem('active_context', JSON.stringify(finalContext));
            await AsyncStorage.setItem('active_branch_id', finalBranchId);

            console.log('[fetchStore] Restore complete. Branch:', finalBranchId, 'Context:', finalContext.merchantName);

            // Return a store-shaped object for callers that check the return value
            return { id: pData.id, name: allBranches.find(b => b.id === finalBranchId)?.name || pData.store_name, address: pData.address, image: pData.logo_url, active: true } as Store;

        } catch (e) {
            console.error('[StoreContext] Error:', e);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const switchContext = useCallback(async (context: ParentStoreContext) => {
        setIsSwitching(true);
        try {
            await AsyncStorage.setItem('active_context', JSON.stringify(context));
            await fetchStore();
        } finally {
            setIsSwitching(false);
        }
    }, [fetchStore]);

    useEffect(() => {
        fetchStore();
    }, [fetchStore]);

    // Keep branch state in sync with DB across three channels:
    //  1. App foreground refetch — catches DB changes that happened while backgrounded
    //  2. Realtime UPDATE on merchant_branches — picks up changes from other devices,
    //     admin tools, or any external mutation
    //  3. 60s polling fallback — Android aggressively kills WebSockets in background,
    //     so realtime alone is unreliable (same pattern as useOrderRequests fix)
    useEffect(() => {
        if (!merchantId) return;

        // 1. AppState foreground refetch
        const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active') {
                fetchStore();
            }
        });

        // 2. Realtime UPDATE on merchant_branches
        const channel = supabase
            .channel(`merchant_branches_${merchantId}_${Date.now()}`)
            .on(
                'postgres_changes' as any,
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'merchant_branches',
                    filter: `merchant_id=eq.${merchantId}`,
                },
                () => {
                    fetchStore();
                }
            )
            .subscribe();

        // 3. 60s polling fallback
        heartbeatInterval.current = setInterval(() => {
            fetchStore();
        }, 60000);

        return () => {
            appStateSub.remove();
            supabase.removeChannel(channel);
            if (heartbeatInterval.current) {
                clearInterval(heartbeatInterval.current);
                heartbeatInterval.current = null;
            }
        };
    }, [merchantId, fetchStore]);

    const value: StoreContextType = {
        store, merchantId, loading, branches,
        activeStoreId, activeBranchId: activeStoreId,
        availableContexts, activeContext, permissions,
        isSwitching, hasRealBranch,
        isApproved: activeContext?.isApproved ?? false,
        isDraft: (activeContext?.kycStatus === 'draft'),
        switchBranch: (id) => {
            setActiveStoreId(id);
            AsyncStorage.setItem('active_branch_id', id).catch(console.error);
        },
        switchContext,
        toggleStoreStatus: async (newStatus: boolean) => {
            if (!activeStoreId) return { success: false, error: 'No active branch' };
            try {
                // Phase 8 (2026-06-11): online/offline toggle goes through the API
                // (services/branches.ts → PUT /merchant/branches/:id), not direct
                // supabase-js. updateBranch throws on 404/403/network error.
                await updateBranch(activeStoreId, { isActive: newStatus });
                // Update local branches state
                setBranches(prev => prev.map(b => b.id === activeStoreId ? { ...b, isActive: newStatus } : b));
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        },
        refreshStore: async () => fetchStore(),
        updateStoreDetails: async (updates) => {
            if (!activeStoreId) return { success: false, error: 'No active branch' };
            try {
                // Phase 8 (2026-06-11): store-detail writes (timings, prep time,
                // service modes, slot config) go through the API
                // (services/branches.ts → PUT /merchant/branches/:id), not direct
                // supabase-js. merchant_branches is the source of truth.
                // toBranchWritePayload maps the snake_case `updates` from callers
                // (timings.tsx, slot-config.tsx) to the camelCase API body.
                await updateBranch(activeStoreId, toBranchWritePayload(updates));

                // Optimistically update the branchDataMap so the UI reflects changes immediately
                setBranchDataMap(prev => ({
                    ...prev,
                    [activeStoreId]: { ...prev[activeStoreId], ...updates }
                }));

                await fetchStore();
                return { success: true };
            } catch (err: any) {
                return { success: false, error: err.message };
            }
        }
    };

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used within a StoreProvider');
    return context;
};
export const useStoreContext = useStore;