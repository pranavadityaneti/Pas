import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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

export interface AvailableRole {
    type: 'owner' | 'manager';
    id: string;
    name: string;
    storeId?: string;
    merchantId?: string;
}

interface StoreContextType {
    store: Store | null;
    merchantId: string | null;
    loading: boolean;
    branches: Branch[];
    activeStoreId: string | null;
    availableRoles: AvailableRole[];
    isSwitching: boolean;
    userRole: 'owner' | 'manager' | null;
    activeRole: AvailableRole | null;
    switchBranch: (id: string) => void;
    switchRole: (role: AvailableRole) => Promise<void>;
    toggleStoreStatus: (newStatus: boolean) => Promise<{ success: boolean; error?: string }>;
    refreshStore: () => Promise<Store | null>;
    updateStoreDetails: (updates: Partial<Store>) => Promise<{ success: boolean; error?: string }>;
    isCurrentStoreOwner: boolean;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);
const CACHE_KEY = 'cached_store_state';

export function StoreProvider({ children }: { children: React.ReactNode }) {
    const [store, setStore] = useState<Store | null>(null);
    const [merchantId, setMerchantId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
    const [availableRoles, setAvailableRoles] = useState<AvailableRole[]>([]);
    const [isSwitching, setIsSwitching] = useState(false);
    const [userRole, setUserRole] = useState<'owner' | 'manager' | null>(null);
    const [activeRole, setActiveRole] = useState<AvailableRole | null>(null);
    const heartbeatInterval = useRef<NodeJS.Timeout | null>(null);

    const fetchStore = useCallback(async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return null;
            }

            console.log('[StoreContext] Fetching identity for:', user.phone || user.email);

            const activeRoleRaw = await AsyncStorage.getItem('active_role');
            let currentActiveRole: AvailableRole | null = null;
            if (activeRoleRaw) {
                try { currentActiveRole = JSON.parse(activeRoleRaw); } catch(e) { console.error(e); }
            }

            // FETCH ALL AVAILABLE ROLES (fresh on each load)
            // Safe phone parsing: extract exactly the last 10 digits to avoid
            // mangling numbers that naturally start with "91" (e.g. 9100117027).
            const phone = user.phone || (user.email?.includes('@phone.pickatstore.app') ? user.email.split('@')[0] : '');
            const rawPhone = phone.replace(/\D/g, '').slice(-10); // Exactly 10 digits
            const phoneQuery = `phone.eq.${rawPhone},phone.eq.91${rawPhone},phone.eq.+91${rawPhone}`;

            console.log('\n--- ROLE DISCOVERY START ---');
            console.log('1. Raw Phone parsed as:', rawPhone);

            const discoveredRoles: AvailableRole[] = [];
            const seenIds = new Set<string>();

            // Step A: Owner lookup by phone/email
            const { data: ownerData, error: ownerError } = await supabase
                .from('merchants')
                .select('id, store_name, status, address')
                .or(phoneQuery);

            if (ownerError) console.error('Owner Query Error:', ownerError);

            if (ownerData) {
                ownerData.forEach((o: any) => {
                    discoveredRoles.push({ type: 'owner', id: o.id, name: o.store_name || 'Main Store', merchantId: o.id });
                    seenIds.add(`owner-${o.id}`);
                });
            }

            console.log('2. Owner Query Result:', JSON.stringify(ownerData));

            // Step B: Manager lookup by phone (explicit manager assignments)
            const { data: managerData } = await supabase
                .from('merchant_branches')
                .select('id, branch_name, merchant_id, is_active, address')
                .or(phoneQuery);

            if (managerData) {
                managerData.forEach((b: any) => {
                    discoveredRoles.push({ type: 'manager', id: b.id, name: b.branch_name, merchantId: b.merchant_id });
                    seenIds.add(`manager-${b.id}`);
                });
            }

            console.log('3. Manager Query Result:', JSON.stringify(managerData));

            // Step C: Owner's branch impersonation — fetch ALL branches belonging
            // to any store the user owns, so they appear in the Store Switcher.
            // Dedup against branches already found in Step B.
            if (ownerData && ownerData.length > 0) {
                const ownerIds = ownerData.map((o: any) => o.id);
                const { data: ownedBranches } = await supabase
                    .from('merchant_branches')
                    .select('id, branch_name, merchant_id, is_active, address')
                    .in('merchant_id', ownerIds);

                if (ownedBranches) {
                    ownedBranches.forEach((b: any) => {
                        if (!seenIds.has(`manager-${b.id}`)) {
                            discoveredRoles.push({ type: 'manager', id: b.id, name: b.branch_name, merchantId: b.merchant_id });
                            seenIds.add(`manager-${b.id}`);
                        }
                    });
                }
            }

            // Step D: store_staff lookup (RBAC Keymaker assignments)
            const { data: staffRoles } = await supabase
                .from('store_staff')
                .select('store_id, role')
                .eq('user_id', user.id);

            if (staffRoles) {
                for (const sr of staffRoles) {
                    const roleKey = `${sr.role}-${sr.store_id}`;
                    if (!seenIds.has(roleKey)) {
                        discoveredRoles.push({
                            type: sr.role as 'owner' | 'manager',
                            id: sr.store_id,
                            name: '', // Will be resolved during store fetch
                            storeId: sr.store_id,
                        });
                        seenIds.add(roleKey);
                    }
                }
            }

            console.log('4. store_staff Query Result:', JSON.stringify(staffRoles));
            console.log('5. Final discoveredRoles Array:', JSON.stringify(discoveredRoles));
            console.log('--- ROLE DISCOVERY END ---\n');

            let finalMerchantId: string | null = null;
            let staffBranchData: any = null;
            let resolvedUserRole: 'owner' | 'manager' | null = null;

            // 1. IDENTITY DISCOVERY
            if (currentActiveRole?.type === 'manager') {
                const { data: bData } = await supabase.from('merchant_branches').select('*').eq('id', currentActiveRole.id).maybeSingle();
                if (bData) {
                    staffBranchData = bData;
                    finalMerchantId = bData.merchant_id;
                    resolvedUserRole = 'manager';
                }
            } else if (currentActiveRole?.type === 'owner') {
                finalMerchantId = currentActiveRole.id;
                resolvedUserRole = 'owner';
                // Always fetch the physical branch mapping, even for owners
                const { data: bData } = await supabase.from('merchant_branches').select('*').eq('id', currentActiveRole.id).maybeSingle();
                if (bData) {
                    staffBranchData = bData;
                }
            } else {
                // Fallback: use first discovered role
                if (discoveredRoles.length > 0) {
                    const firstRole = discoveredRoles[0];
                    currentActiveRole = firstRole; // Set the local pointer
                    if (firstRole.type === 'owner') {
                        finalMerchantId = firstRole.id;
                        resolvedUserRole = 'owner';
                    } else {
                        const { data: bData } = await supabase.from('merchant_branches').select('*').eq('id', firstRole.id).maybeSingle();
                        if (bData) {
                            staffBranchData = bData;
                            finalMerchantId = bData.merchant_id;
                            resolvedUserRole = 'manager';
                        }
                    }
                    // Auto-set active role if not set
                    await AsyncStorage.setItem('active_role', JSON.stringify(firstRole));
                }
            }

            if (!finalMerchantId) {
                setLoading(false);
                return null;
            }

            // 2. FETCH STORE DATA (Must use 'merchants' table)
            const { data: pData } = await supabase.from('merchants').select('*').eq('id', finalMerchantId).maybeSingle();
            if (!pData) {
                setLoading(false);
                return null;
            }

           // 3. ROLE-AWARE DATA PHASE
            // If we have branch data, we use the branch name for the UI Header
            const storeObject: Store = {
                id: pData.id,
                name: staffBranchData ? staffBranchData.branch_name : (pData.store_name || 'Main Store'),
                address: staffBranchData ? staffBranchData.address : pData.address,
                image: pData.logo_url || null,
                active: staffBranchData ? (staffBranchData.is_active ?? true) : (pData.status === 'active' || pData.status === true ? true : (pData.status == null ? true : false)),
                operating_hours: staffBranchData?.operating_hours || pData.operating_hours,
                prep_time_minutes: staffBranchData?.prep_time_minutes || 15
            };

            // 4. RESOLVE BRANCHES
            const allBranches: Branch[] = [];
            if (staffBranchData) {
                allBranches.push({
                    id: staffBranchData.id,
                    name: staffBranchData.branch_name,
                    type: 'branch',
                    isActive: staffBranchData.is_active ?? true,
                    address: staffBranchData.address,
                    city: staffBranchData.city,
                });
                setActiveStoreId(staffBranchData.id);
            } else {
                const { data: bData } = await supabase.from('merchant_branches').select('*').eq('merchant_id', finalMerchantId);
                allBranches.push({ id: finalMerchantId, name: storeObject.name, type: 'main', isActive: storeObject.active, address: storeObject.address, city: null });
                if (bData) {
                    bData.forEach((b: any) => {
                        allBranches.push({ id: b.id, name: b.branch_name, type: 'branch', isActive: b.is_active ?? true, address: b.address, city: b.city });
                    });
                }
                setActiveStoreId(prev => prev || finalMerchantId);
            }

            // 5. COMMIT STATE
            setMerchantId(finalMerchantId);
            setStore(storeObject);
            setBranches(allBranches);
            setUserRole(resolvedUserRole);
            setActiveRole(currentActiveRole);

            // Deduplicate: If user is an 'owner' of a merchant, filter out the redundant 'manager' role for the Main Store (where branch_id === merchant_id).
            const ownerIds = new Set(discoveredRoles.filter(r => r.type === 'owner').map(r => r.id));
            const deduplicatedRoles = discoveredRoles.filter(r => {
                if (r.type === 'manager' && ownerIds.has(r.id)) {
                    return false; // Skip the redundant manager role for the Main Store
                }
                return true;
            });

            // Always expose all discovered roles so users can switch between owner/manager contexts
            setAvailableRoles(deduplicatedRoles);

            await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(storeObject));
            
            console.log('[StoreContext] Success: Logged into', storeObject.name, '| Role:', resolvedUserRole);
            return storeObject;

        } catch (e) {
            console.error('[StoreContext] Error:', e);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const switchRole = useCallback(async (role: AvailableRole) => {
        // HARD LOCK: Only block if they have no other options
        if (userRole === 'manager' && availableRoles.length <= 1) {
            console.warn('[StoreContext] Manager attempted role switch with only one role — blocked.');
            return;
        }
        // Strict validation: Ensure the role exists in our discovered set by matching ID AND Type
        const validatedRole = availableRoles.find(r => r.id === role.id && r.type === role.type);
        
        if (!validatedRole && role.type !== 'owner') { 
            // Fallback for edge cases (e.g. freshly created branches not yet in availableRoles)
            console.warn('[StoreContext] Role validation failed, but attempting switch for new ID:', role.id);
        }

        const targetRole = validatedRole || role;
        
        console.log('[StoreContext] Switching to role:', targetRole.name, `(${targetRole.type})`);
        setIsSwitching(true);
        try {
            await AsyncStorage.setItem('active_role', JSON.stringify(targetRole));
            await fetchStore();
        } catch (err) {
            console.error('[StoreContext] Switch role failed:', err);
        } finally {
            setIsSwitching(false);
        }
    }, [fetchStore, userRole]);

    useEffect(() => {
        fetchStore();
    }, [fetchStore]);

    const value: StoreContextType = {
        store, merchantId, loading, branches, activeStoreId,
        availableRoles, isSwitching, userRole, activeRole,
        isCurrentStoreOwner: userRole === 'owner',
        switchBranch: (id) => {
            // HARD LOCK: Only block if they have no other options
            if (userRole === 'manager' && availableRoles.length <= 1) {
                console.warn('[StoreContext] Manager attempted branch switch with only one branch — blocked.');
                return;
            }
            setActiveStoreId(id);
            AsyncStorage.setItem('active_branch_id', id).catch(console.error);
        },
        switchRole,
        toggleStoreStatus: async (newStatus: boolean) => {
            if (!activeRole?.id) return { success: false, error: 'No active role found.' };
            try {
                const { error } = await supabase
                    .from('merchant_branches')
                    .update({ is_active: newStatus })
                    .eq('id', activeRole.id);
                
                if (error) throw error;
                
                if (store) {
                    setStore(prev => prev ? { ...prev, active: newStatus } : prev);
                }
                return { success: true };
            } catch (err: any) {
                console.error('[StoreContext] Failed to toggle store status:', err);
                return { success: false, error: err.message || 'Unknown error' };
            }
        },
        refreshStore: async () => fetchStore(),
        updateStoreDetails: async (updates) => {
            if (!activeRole?.id) return { success: false, error: 'No active role found.' };
            try {
                const { error } = await supabase
                    .from('merchant_branches')
                    .update(updates)
                    .eq('id', activeRole.id);
                if (error) throw error;
                
                if (store) {
                    setStore(prev => prev ? { ...prev, ...updates } : prev);
                }
                return { success: true };
            } catch (err: any) {
                console.error('[StoreContext] Failed to update branch details:', err);
                return { success: false, error: err.message || 'Unknown error' };
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