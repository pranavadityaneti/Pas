"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

// The shape of our Cart (productId -> quantity)
type CartState = Record<number, number>;

// The shape of our global application state
interface StoreContextType {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    cart: CartState;
    setCart: React.Dispatch<React.SetStateAction<CartState>>;
    addToCart: (productId: number, increment: number) => void;
    clearCart: () => void;
    selectedLocation: string;
    setSelectedLocation: (loc: string) => void;
    // Computed helpers
    getCartItemCount: () => number;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
    const [activeTab, setActiveTab] = useState("home");
    const [cart, setCart] = useState<CartState>({});
    const [selectedLocation, setSelectedLocation] = useState("Home • 12A, Palm Avenue");

    // Helper function ported from legacy App.tsx
    const addToCart = (productId: number, increment: number) => {
        setCart((prev) => {
            const newCart = { ...prev };
            const currentVal = newCart[productId] || 0;
            const newVal = currentVal + increment;
            if (newVal <= 0) {
                delete newCart[productId];
            } else {
                newCart[productId] = newVal;
            }
            return newCart;
        });
    };

    const clearCart = () => {
        setCart({});
    };

    const getCartItemCount = () => {
        return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    };

    return (
        <StoreContext.Provider
            value={{
                activeTab,
                setActiveTab,
                cart,
                setCart,
                addToCart,
                clearCart,
                selectedLocation,
                setSelectedLocation,
                getCartItemCount,
            }}
        >
            {children}
        </StoreContext.Provider>
    );
}

// Hook to use the store context
export function useStoreContext() {
    const context = useContext(StoreContext);
    if (context === undefined) {
        throw new Error("useStoreContext must be used within a StoreProvider");
    }
    return context;
}
