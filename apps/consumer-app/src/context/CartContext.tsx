// CartContext: Global cart state management with add/remove/clear operations.
import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as Haptics from 'expo-haptics';

interface CartItem {
    id: number;
    name: string;
    price: number;
    image: string;
    quantity: number;
    storeId: number;
    storeName: string;
}

interface CartContextType {
    items: CartItem[];
    addItem: (item: Omit<CartItem, 'quantity'>) => void;
    removeItem: (id: number) => void;
    updateQuantity: (id: number, quantity: number) => void;
    clearCart: () => void;
    getItemCount: () => number;
    getTotal: () => number;
    getItemQuantity: (id: number) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    const addItem = (item: Omit<CartItem, 'quantity'>) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setItems(prev => {
            const existing = prev.find(i => i.id === item.id);
            if (existing) {
                return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

    const removeItem = (id: number) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const updateQuantity = (id: number, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id);
            return;
        }
        setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    };

    const clearCart = () => setItems([]);

    const getItemCount = () => items.reduce((sum, i) => sum + i.quantity, 0);

    const getTotal = () => items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

    const getItemQuantity = (id: number) => {
        const item = items.find(i => i.id === id);
        return item ? item.quantity : 0;
    };

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, getItemCount, getTotal, getItemQuantity }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) throw new Error('useCart must be used within a CartProvider');
    return context;
}
