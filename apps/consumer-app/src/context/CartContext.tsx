// @lock — Do NOT overwrite. Approved config as of May 1, 2026.
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
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);
    const [isInitialized, setIsInitialized] = useState(false);
    const [cartId, setCartId] = useState<string | null>(null);

    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) acc[item.storeId] = [];
        acc[item.storeId].push(item);
        return acc;
    }, {} as Record<string, CartItem[]>);

    // Initial load and Auth Listener
    useEffect(() => {
        let mounted = true;

        // Listen for login/logout to sync local items to cloud
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;
            if (session?.user) {
                // If we had local items, merge them up to the cloud.
                // Fire and forget without awaiting to avoid GoTrue deadlock!
                loadCartFromSupabase(session.user.id, items).catch(e => console.error(e));
            } else if (event === 'SIGNED_OUT') {
                setItems([]);
                setCartId(null);
            } else {
                setIsInitialized(true);
            }
        });

        return () => {
            mounted = false;
            authListener.subscription.unsubscribe();
        };
    }, []); // Run once on mount

    // Continuous cloud sync whenever items change (if initialized and user is logged in)
    // We use a ref to prevent infinite loops from the initial load
    const isFirstRender = useRef(true);
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const syncToCloud = async () => {
            if (isInitialized) {
                if (cartId) {
                    await syncCartToSupabase(cartId, items);
                } else {
                    // User might be logged in but we don't have a cartId yet due to race condition
                    // Let's check auth and ensure a cart exists
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.user) {
                        await loadCartFromSupabase(session.user.id, items);
                    }
                }
            }
        };

        syncToCloud();
    }, [items, isInitialized, cartId]);


    // ------ Supabase Handlers ------

    const loadCartFromSupabase = async (userId: string, localItemsToMerge: CartItem[] = []) => {
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

            // Merge logic
            let mergedItems: CartItem[] = [];
            const cloudItems: CartItem[] = cartData.cart_items.map((ci: any) => ({
                id: String(ci.product_id),
                name: ci.product_name,
                price: ci.price,
                image: ci.image,
                quantity: ci.quantity,
                storeId: String(ci.store_id),
                storeName: ci.store_name,
                isDining: ci.is_dining ?? false,
                isVeg: ci.is_veg ?? true
            }));

            if (localItemsToMerge.length > 0) {
                // Combine cloud and local, local overriding quantities for simplicity
                const itemMap = new Map();
                cloudItems.forEach(i => itemMap.set(i.id, i));
                localItemsToMerge.forEach(i => {
                    if (itemMap.has(i.id)) {
                        itemMap.set(i.id, { ...itemMap.get(i.id), quantity: itemMap.get(i.id).quantity + i.quantity });
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

            // If we did a merge, the next useEffect trigger will natively push it back to the cloud.

        } catch (error) {
            console.error("Failed to load cart", error);
            setIsInitialized(true); // Failsafe
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
                is_veg: item.isVeg
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
                                setItems([{ ...item, id: String(item.id), storeId: String(item.storeId), quantity: 1, stock: item.stock }]);
                            }
                        }
                    ]
                );
                return;
            }
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setItems(prev => {
            const existing = prev.find(i => String(i.id) === String(item.id));
            if (existing) {
                // Apply optional stock cap if known
                const maxStock = item.stock !== undefined ? item.stock : Infinity;
                const nextQty = existing.quantity + 1;
                if (nextQty > maxStock) {
                    Alert.alert('Max Stock', `Only ${maxStock} available.`);
                    return prev;
                }
                return prev.map(i => String(i.id) === String(item.id) ? { ...i, quantity: nextQty } : i);
            }
            return [...prev, { ...item, id: String(item.id), storeId: String(item.storeId), quantity: 1, stock: item.stock }];
        });
    };

    const removeItem = (id: string) => {
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
        setItems(prev => {
            const target = prev.find(i => String(i.id) === String(id));
            if (!target) return prev;

            // Cap by stock if available
            if (target.stock !== undefined && target.stock !== null) {
                if (quantity > target.stock) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    Alert.alert('Stock Limit Reached', `Sorry, only ${target.stock} left.`);
                    // Explicitly return previous state without changing anything
                    return prev;
                }
            }

            return prev.map(i => String(i.id) === String(id) ? { ...i, quantity } : i);
        });
    };

    const clearCart = () => {
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
        <CartContext.Provider value={{ items, groupedItems, addItem, removeItem, updateQuantity, clearCart, getItemCount, getTotal, getItemQuantity }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
}
