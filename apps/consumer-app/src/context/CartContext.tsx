// CartContext: Global cart state management with Supabase persistence and strict validation.
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { supabase } from '../lib/supabase';
import { RESTAURANTS } from '../lib/data';

interface CartItem {
    id: string;
    name: string;
    price: number;
    image: string;
    quantity: number;
    storeId: string;
    storeName: string;
    isDining: boolean;
    uom?: string;
}

interface CartContextType {
    items: CartItem[];
    pickupTimes: Record<string, string>;
    setPickupTime: (storeId: string, time: string) => void;
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
    const [pickupTimes, setPickupTimes] = useState<Record<string, string>>({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [cartId, setCartId] = useState<string | null>(null);

    const setPickupTime = (storeId: string, time: string) => {
        setPickupTimes(prev => ({ ...prev, [storeId]: time }));
    };

    const groupedItems = items.reduce((acc, item) => {
        if (!acc[item.storeId]) acc[item.storeId] = [];
        acc[item.storeId].push(item);
        return acc;
    }, {} as Record<string, CartItem[]>);

    // Initial load and Auth Listener
    useEffect(() => {
        let mounted = true;

        // Listen for login/logout to sync local items to cloud
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (!mounted) return;
            if (session?.user) {
                // If we had local items, merge them up to the cloud.
                await loadCartFromSupabase(session.user.id, items);
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
                // Derive isDining for legacy persistence or items without it since DB schema is locked
                isDining: RESTAURANTS.some(r => String(r.id) === String(ci.store_id))
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
                store_name: item.storeName
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
                                setPickupTimes({});
                                setItems([{ ...item, id: String(item.id), storeId: String(item.storeId), quantity: 1 }]);
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
                return prev.map(i => String(i.id) === String(item.id) ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, id: String(item.id), storeId: String(item.storeId), quantity: 1 }];
        });
    };

    const removeItem = (id: string) => {
        setItems(prev => {
            const itemToRemove = prev.find(i => String(i.id) === String(id));
            const newItems = prev.filter(i => String(i.id) !== String(id));
            
            if (itemToRemove) {
                const storeItemsLeft = newItems.filter(i => String(i.storeId) === String(itemToRemove.storeId));
                if (storeItemsLeft.length === 0) {
                    setPickupTimes(times => {
                        const newTimes = { ...times };
                        delete newTimes[itemToRemove.storeId];
                        return newTimes;
                    });
                }
            }
            return newItems;
        });
    };

    const updateQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id);
            return;
        }
        setItems(prev => prev.map(i => String(i.id) === String(id) ? { ...i, quantity } : i));
    };

    const clearCart = () => {
        setItems([]);
        setPickupTimes({});
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
        <CartContext.Provider value={{ items, pickupTimes, setPickupTime, groupedItems, addItem, removeItem, updateQuantity, clearCart, getItemCount, getTotal, getItemQuantity }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
}
