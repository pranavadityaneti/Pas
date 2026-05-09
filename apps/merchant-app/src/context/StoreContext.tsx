import React, { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Store {
    id: string;
    name: string;
    address: string | null;
    image: string | null;
    active: boolean;
    operating_hours?: any;
    prep_time_minutes?: number;
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
    const [rawStoreData, setRawStoreData] = useState<{ id: string; image: string | null; operating_hours?: any; prep_time_minutes?: number } | null>(null);
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<Branch[]>([]);
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
        return {
            id: activeContext.merchantId,
            name: activeBranch?.name ?? activeContext.merchantName,
            address: activeBranch?.address ?? null,
            image: rawStoreData.image,
            active: activeBranch?.isActive ?? true,
            operating_hours: rawStoreData.operating_hours,
            prep_time_minutes: rawStoreData.prep_time_minutes,
        };
    }, [activeContext, activeStoreId, branches, rawStoreData]);

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
            const { data: ownerData } = await supabase.from('merchants').select('id, store_name, status, address').or(phoneQuery);
            const { data: managerData } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id, is_active, address').or(phoneQuery);
            const { data: staffRoles } = await supabase.from('store_staff').select('store_id, role').eq('user_id', user.id);

            const contextMap = new Map<string, ParentStoreContext>();

            if (ownerData) {
                ownerData.forEach(o => {
                    contextMap.set(o.id, {
                        merchantId: o.id,
                        merchantName: o.store_name || 'Main Store',
                        role: 'owner',
                        branches: [{ branchId: o.id, branchName: o.store_name || 'Main Store' }]
                    });
                });
            }

            const addManagerBranch = (merchantId: string, branchId: string, branchName: string) => {
                if (contextMap.has(merchantId)) {
                    const ctx = contextMap.get(merchantId)!;
                    if (!ctx.branches.find(b => b.branchId === branchId)) {
                        ctx.branches.push({ branchId, branchName });
                    }
                } else {
                    contextMap.set(merchantId, {
                        merchantId,
                        merchantName: '',
                        role: 'manager',
                        branches: [{ branchId, branchName }]
                    });
                }
            };

            if (managerData) {
                managerData.forEach(b => addManagerBranch(b.merchant_id, b.id, b.branch_name));
            }

            if (staffRoles && staffRoles.length > 0) {
                const storeIds = staffRoles.map(s => s.store_id);
                const { data: branchCheck } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id').in('id', storeIds);
                if (branchCheck) {
                    branchCheck.forEach(b => addManagerBranch(b.merchant_id, b.id, b.branch_name));
                }
                const { data: mainStoreCheck } = await supabase.from('merchants').select('id, store_name').in('id', storeIds);
                if (mainStoreCheck) {
                    mainStoreCheck.forEach(m => {
                        if (contextMap.has(m.id)) {
                             const ctx = contextMap.get(m.id)!;
                             if (!ctx.branches.find(b => b.branchId === m.id)) {
                                 ctx.branches.push({ branchId: m.id, branchName: m.store_name || 'Main Store' });
                             }
                        } else {
                             contextMap.set(m.id, {
                                 merchantId: m.id,
                                 merchantName: m.store_name || 'Main Store',
                                 role: 'manager',
                                 branches: [{ branchId: m.id, branchName: m.store_name || 'Main Store' }]
                             });
                        }
                    });
                }
            }

            if (ownerData && ownerData.length > 0) {
                 const ownerIds = ownerData.map(o => o.id);
                 const { data: ownedBranches } = await supabase.from('merchant_branches').select('id, branch_name, merchant_id').in('merchant_id', ownerIds);
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

            const defaultBranch = finalContext.branches.find(b => b.branchId === finalContext.merchantId) ?? finalContext.branches[0];
            let finalBranchId = defaultBranch?.branchId || finalContext.merchantId;

            if (savedBranchIdRaw && finalContext.branches.find(b => b.branchId === savedBranchIdRaw)) {
                finalBranchId = savedBranchIdRaw;
            }
            console.log('[fetchStore] Final branch ID:', finalBranchId);

            const { data: bData } = await supabase.from('merchant_branches').select('*').eq('merchant_id', finalContext.merchantId);
            const allBranches: Branch[] = [];
            allBranches.push({ id: finalContext.merchantId, name: finalContext.merchantName, type: 'main', isActive: pData.status === 'active' || pData.status === true || pData.status == null, address: pData.address, city: null });
            if (bData) {
                 bData.forEach(b => {
                     if (finalContext.role === 'owner' || finalContext.branches.find(cb => cb.branchId === b.id)) {
                         allBranches.push({ id: b.id, name: b.branch_name, type: 'branch', isActive: b.is_active ?? true, address: b.address, city: b.city });
                     }
                 });
            }

            const activeBranchObj = allBranches.find(b => b.id === finalBranchId) || allBranches[0];

            // Store raw data — the reactive useMemo derives the consumer-facing `store` object
            const rawData = {
                id: pData.id,
                image: pData.logo_url || null,
                operating_hours: pData.operating_hours || null,
                prep_time_minutes: pData.prep_time_minutes ?? undefined,
            };

            setMerchantId(finalContext.merchantId);
            setRawStoreData(rawData);
            setBranches(allBranches);
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

    const value: StoreContextType = {
        store, merchantId, loading, branches,
        activeStoreId, activeBranchId: activeStoreId,
        availableContexts, activeContext, permissions,
        isSwitching,
        switchBranch: (id) => {
            setActiveStoreId(id);
            AsyncStorage.setItem('active_branch_id', id).catch(console.error);
        },
        switchContext,
        toggleStoreStatus: async () => ({ success: true }),
        refreshStore: async () => fetchStore(),
        updateStoreDetails: async () => ({ success: true })
    };

    return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => {
    const context = useContext(StoreContext);
    if (!context) throw new Error('useStore must be used within a StoreProvider');
    return context;
};
export const useStoreContext = useStore;