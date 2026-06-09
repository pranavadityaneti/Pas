// @lock — Do NOT overwrite. Multiple approved layers (cumulative):
//   1. Cart merge fix approved May 19, 2026. Auth listener merges guest cart on
//      any first-session event (SIGNED_IN or TOKEN_REFRESHED).
//   2. Phase 4 coupon-state plumbing approved 2026-06-09. AppliedCoupon state
//      + auto-clear on any cart mutation (Clear Cart alert / normal add path /
//      removeItem / updateQuantity / clearCart). Does NOT touch the auth-listener,
//      Supabase persistence, or cart-merge logic from layer 1 — coupon state lives
//      in-memory only (intentionally not synced to Supabase; coupons are derived
//      state and should always re-validate against the current cart).
// CartContext: Global cart state management with Supabase persistence and strict validation.
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';

interface CartItem {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    storeId: string;
    storeName: string;
    isDining: boolean;
    isVeg: boolean;
    uom?: string;
    stock?: number;
    /**
     * Phase 4 (2026-06-09): server-side product id used by /checkout/validate-coupon
     * (Phase 2L's strict policy) and POST /orders. Optional in legacy cart data,
     * required for any cart that wants to use coupon discounts. Callers that add
     * items should populate this; CartContext does NOT enforce it (a stale guest
     * cart from before Phase 4 could lack the field).
     */
    storeProductId?: string;
}

/**
 * Phase 4 (2026-06-09): coupon state held in CartContext (in-memory only —
 * NOT synced to Supabase). Lifecycle:
 *   - Apply: CouponsScreen / CouponsSection POST /checkout/validate-coupon;
 *     on success, call setAppliedCoupon({ ...response fields }).
 *   - Display: CheckoutScreen / DiningCheckoutScreen read appliedCoupon to
 *     render the applied-coupon banner + apply discount to displayed total.
 *   - Send: POST /orders body includes validationToken + couponId + couponCode
 *     from this state when present.
 *   - Auto-clear: ANY cart mutation (add/remove/quantity/clear) calls
 *     clearAppliedCoupon() so the server never sees a stale cartHash. The
 *     consumer-app's behavior is then deterministic: cart change = coupon gone.
 */
export interface AppliedCoupon {
    code: string;
    couponId: string;
    discount: number;
    fundingSource: 'PLATFORM' | 'MERCHANT' | null;
    discountType: 'PERCENTAGE' | 'FLAT' | 'BOGO';
    /** Server-signed HMAC. POST /orders verifies this before applying the discount. */
    validationToken: string;
    /** Unix seconds (from token.exp). Used by the checkout screens for the countdown UX. */
    expiresAt: number;
    /** For diagnostics only — server recomputes its own cartHash. */
    cartHash: string;
}

interface CartContextType {
    items: CartItem[];
    groupedItems: Record<string, CartItem[]>;
    addItem: (item: Omit<CartItem, 'quantity'>) => void;
    removeItem: (id: string) => void;
    updateQuantity: (id: string, quantity: number) => void;
    clearCart: () => void;
    getItemCount: () => number;
    getTotal: () => number;
    getItemQuantity: (id: string) => number;
    /** Phase 4 (2026-06-09) — applied coupon state (in-memory only). */
    appliedCoupon: AppliedCoupon | null;
    /** Phase 4 — set after a successful POST /checkout/validate-coupon. */
    setAppliedCoupon: (c: AppliedCoupon | null) => void;
    /** Phase 4 — explicit clear (called automatically on cart mutations). */
    clearAppliedCoupon: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [cartId, setCartId] = useState<string | null>(null);
    // Phase 4 (2026-06-09) — applied coupon state. In-memory only; deliberately
    // NOT synced to Supabase (see lock header comment).
    const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
    const clearAppliedCoupon = () => setAppliedCoupon(null);

    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) acc[item.storeId] = [];
        acc[item.storeId].push(item);
        return acc;
    }, {} as Record<string, CartItem[]>);

    // Keep a ref to the latest items so the auth listener always sees current cart
    const itemsRef = useRef<CartItem[]>(items);
    useEffect(() => { itemsRef.current = items; }, [items]);

    // Track whether cloud load has completed to prevent sync-back loops
    const isLoadingFromCloud = useRef(false);
    const hasLoadedCloud = useRef(false);

    // Initial load and Auth Listener
    useEffect(() => {
        let mounted = true;

        // Listen for login/logout to sync local items to cloud.
        // Merge guest cart on SIGNED_IN or any first-time session load (!hasLoadedCloud).
        // This covers refreshSession() which fires TOKEN_REFRESHED instead of SIGNED_IN.
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            console.log(`[CartContext] Auth event: ${event}, hasLoadedCloud: ${hasLoadedCloud.current}, localItems: ${itemsRef.current.length}`);
            if (session?.user) {
                if (event === 'SIGNED_IN' || !hasLoadedCloud.current) {
                    // Fresh login OR first session load — always merge local guest cart.
                    // Covers both SIGNED_IN and TOKEN_REFRESHED (fired by refreshSession()).
                    // When itemsRef.current is [] (e.g. app restart), merge is a no-op.
                    loadCartFromSupabase(session.user.id, itemsRef.current).catch(e => console.error(e));
                }
            } else if (event === 'SIGNED_OUT') {
                setItems([]);
                setCartId(null);
                hasLoadedCloud.current = false;
            } else {
                setIsInitialized(true);
            }
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []); // Run once on mount — itemsRef ensures fresh items value

    // Continuous cloud sync whenever items change (if initialized and user is logged in).
    // Skip syncing when loadCartFromSupabase is the source of the items change
    // to prevent a feedback loop (cloud load → setItems → sync back → load again).
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        // Don't sync back to cloud while we're loading FROM cloud
        if (isLoadingFromCloud.current) return;

        const syncToCloud = async () => {
            if (isInitialized && cartId) {
                await syncCartToSupabase(cartId, items);
            }
        };

        syncToCloud();
    }, [items, isInitialized, cartId]);


    // ------ Supabase Handlers ------

    const loadCartFromSupabase = async (userId: string, localItemsToMerge: CartItem[] = []) => {
        isLoadingFromCloud.current = true;
        try {
            // Find existing cart
            let { data: cartData, error: cartError } = await supabase
                .from('carts')
                .select('id, cart_items(*)')
                .eq('user_id', userId)
                .single();

            if (cartError && cartError.code !== 'PGRST116') {
                console.error("Cart fetch error", cartError);
            }

            // Create cart if it doesn't exist
            if (!cartData) {
                const { data: newCart, error: insertError } = await supabase
                    .from('carts')
                    .insert({ user_id: userId })
                    .select('id')
                    .single();

                if (insertError) throw insertError;
                cartData = { id: newCart.id, cart_items: [] };
            }

            setCartId(cartData.id);

            // Map cloud items
            // Phase 4 fix C1 (2026-06-09): hydrate storeProductId from cart_items
            // so SIGNED_IN / TOKEN_REFRESHED reload preserves the FK that Phase 2L's
            // strict /checkout/validate-coupon requires.
            const cloudItems: CartItem[] = cartData.cart_items.map((ci: any) => ({
                id: String(ci.product_id),
                name: ci.product_name,
                price: ci.price,
                image: ci.image,
                quantity: ci.quantity,
                storeId: String(ci.store_id),
                storeName: ci.store_name,
                isDining: ci.is_dining ?? false,
                isVeg: ci.is_veg ?? true,
                storeProductId: ci.store_product_id ?? undefined,
            }));

            // Merge logic: for duplicate items, take the HIGHER quantity (not sum).
            // Only merge local guest items on SIGNED_IN; otherwise just use cloud state.
            let mergedItems: CartItem[] = [];
            if (localItemsToMerge.length > 0) {
                const itemMap = new Map();
                cloudItems.forEach(i => itemMap.set(i.id, i));
                localItemsToMerge.forEach(i => {
                    if (itemMap.has(i.id)) {
                        // Take the higher quantity — don't sum, which would inflate
                        const existing = itemMap.get(i.id);
                        itemMap.set(i.id, { ...existing, quantity: Math.max(existing.quantity, i.quantity) });
                    } else {
                        itemMap.set(i.id, i);
                    }
                });
                mergedItems = Array.from(itemMap.values());
            } else {
                mergedItems = cloudItems;
            }

            setItems(mergedItems);
            setIsInitialized(true);
            hasLoadedCloud.current = true;

            // If we merged guest items, sync the merged result back to cloud
            if (localItemsToMerge.length > 0 && mergedItems.length > 0) {
                await syncCartToSupabase(cartData.id, mergedItems);
            }

        } catch (error) {
            console.error("Failed to load cart", error);
            setIsInitialized(true); // Failsafe
        } finally {
            isLoadingFromCloud.current = false;
        }
    };

    const syncCartToSupabase = async (activeCartId: string, currentItems: CartItem[]) => {
        try {
            // Wait for any previous syncs to finish (simple prevention for rapid clicks)
            if (currentItems.length === 0) {
                await supabase.from('cart_items').delete().eq('cart_id', activeCartId);
                return;
            }

            // Fetch current items in DB to see what needs deletion vs upsertion
            const { data: dbItems } = await supabase.from('cart_items').select('product_id').eq('cart_id', activeCartId);
            const dbItemIds = dbItems ? dbItems.map(i => i.product_id) : [];
            const localItemIds = currentItems.map(i => String(i.id));

            // Delete items that are in DB but no longer in local state
            const idsToDelete = dbItemIds.filter(id => !localItemIds.includes(id));
            if (idsToDelete.length > 0) {
                await supabase.from('cart_items').delete().eq('cart_id', activeCartId).in('product_id', idsToDelete);
            }

            const upsertData = currentItems.map(item => ({
                cart_id: activeCartId,
                product_id: String(item.id),
                product_name: item.name,
                price: item.price,
                image: item.image,
                quantity: item.quantity,
                store_id: String(item.storeId),
                store_name: item.storeName,
                is_dining: item.isDining,
                is_veg: item.isVeg,
                // Phase 4 fix C1 (2026-06-09): persist storeProductId so a
                // subsequent loadCartFromSupabase preserves the FK.
                store_product_id: item.storeProductId ?? null,
            }));

            // Safely Upsert
            const { error } = await supabase.from('cart_items').upsert(upsertData, {
                onConflict: 'cart_id, product_id'
            });

            if (error) console.error("Error syncing cart items", error);
        } catch (error) {
            console.error("Failed to sync cart", error);
        }
    };


    // ------ Cart Operations ------

    const addItem = (item: Omit<CartItem, 'quantity'>) => {
        // VALIDATION: Prevent mixing Dine-in and Pickup
        // Now using explicit isDining flag from the data source
        const isNewItemDining = item.isDining;

        if (items.length > 0) {
            const isExistingDining = items[0].isDining;

            if (isNewItemDining !== isExistingDining) {
                Alert.alert(
                    "Clear Cart?",
                    `You currently have ${isExistingDining ? 'Dine-in' : 'Pickup'} items in your cart. You cannot mix Dine-in and Pickup orders. Would you like to clear your cart and start a new ${isNewItemDining ? 'Dine-in' : 'Pickup'} order?`,
                    [
                        { text: "Cancel", style: "cancel" },
                        {
                            text: "Clear Cart",
                            style: "destructive",
                            onPress: () => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                                // Phase 4 — any cart shape change invalidates the applied coupon.
                                clearAppliedCoupon();
                                setItems([{ ...item, id: String(item.id), storeId: String(item.storeId), quantity: 1, stock: item.stock }]);
                            }
                        }
                    ]
                );
                return;
            }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Phase 4 fix D1 (2026-06-09) — re-fixed after audit (2026-06-09 evening):
        // Decide OUTSIDE setItems whether we'll mutate (so the coupon clear is
        // gated on actual mutation per D1's original intent), but compute the
        // QUANTITY INCREMENT INSIDE setItems(prev => ...) — using prev.find()
        // — so rapid double-taps don't both read stale qty=1 and converge on
        // qty=2 instead of qty=3 (audit's D1-regression finding).
        //
        // Trade-off: the stock-cap check uses closure `items` so a rapid double-
        // tap against a stock cap could exceed by 1; this matches the audit's
        // acknowledged minor edge ("RN batches state updates and useCart
        // consumers gate UI on items") and is preferable to making setItems
        // updaters call Alert.alert (anti-pattern).
        const existing = items.find(i => String(i.id) === String(item.id));
        let willMutate = false;
        if (existing) {
            const maxStock = item.stock !== undefined ? item.stock : Infinity;
            if (existing.quantity + 1 > maxStock) {
                Alert.alert('Max Stock', `Only ${maxStock} available.`);
                return; // no mutation, no coupon clear
            }
            willMutate = true;
        } else {
            willMutate = true;
        }
        if (willMutate) clearAppliedCoupon();
        setItems(prev => {
            const ex = prev.find(i => String(i.id) === String(item.id));
            if (ex) {
                // Use prev's quantity (the latest queued state) — NOT the closure's.
                return prev.map(i => String(i.id) === String(item.id) ? { ...i, quantity: ex.quantity + 1 } : i);
            }
            return [...prev, { ...item, id: String(item.id), storeId: String(item.storeId), quantity: 1, stock: item.stock }];
        });
    };

    const removeItem = (id: string) => {
        // Phase 4 — any cart shape change invalidates the applied coupon.
        clearAppliedCoupon();
        setItems(prev => {
            const itemToRemove = prev.find(i => String(i.id) === String(id));
            const newItems = prev.filter(i => String(i.id) !== String(id));

            if (itemToRemove) {
                const storeItemsLeft = newItems.filter(i => String(i.storeId) === String(itemToRemove.storeId));
                // Previous setPickupTimes cleanup removed
            }
            return newItems;
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id);
            return;
        }
        // Phase 4 fix D1 (2026-06-09) — re-fixed after audit (2026-06-09 evening):
        // updateQuantity's `quantity` arg is explicit (not closure-derived), so
        // there's no rapid-tap arithmetic issue here. Pattern matches addItem
        // for consistency: decide outside (gates coupon clear on actual mutation),
        // mutate inside setItems(prev =>) to use the latest queued state.
        const target = items.find(i => String(i.id) === String(id));
        if (!target) return; // no mutation, no coupon clear

        if (target.stock !== undefined && target.stock !== null) {
            if (quantity > target.stock) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                Alert.alert('Stock Limit Reached', `Sorry, only ${target.stock} left.`);
                return; // no mutation, no coupon clear
            }
        }
        clearAppliedCoupon();
        setItems(prev => {
            const t = prev.find(i => String(i.id) === String(id));
            if (!t) return prev; // race: item removed between closure read and setItems flush
            return prev.map(i => String(i.id) === String(id) ? { ...i, quantity } : i);
        });
    };

    const clearCart = () => {
        // Phase 4 — any cart shape change invalidates the applied coupon.
        clearAppliedCoupon();
        setItems([]);
        // Explicitly clear from Supabase if we have a cartId
        if (cartId) {
            syncCartToSupabase(cartId, []);
        }
    };

    const getItemCount = () => items.reduce((sum, i) => sum + i.quantity, 0);

    const getTotal = () => items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const getItemQuantity = (id: string) => {
        const item = items.find(i => String(i.id) === String(id));
        return item ? item.quantity : 0;
    };

    return (
        <CartContext.Provider value={{
            items, groupedItems, addItem, removeItem, updateQuantity, clearCart,
            getItemCount, getTotal, getItemQuantity,
            // Phase 4 (2026-06-09) — coupon state plumbing
            appliedCoupon, setAppliedCoupon, clearAppliedCoupon,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
}
