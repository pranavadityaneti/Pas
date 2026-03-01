"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useStoreContext } from "@/context/StoreContext";
import { ShoppingCart } from "lucide-react";
import { ALL_PRODUCTS } from "@/lib/mock-data/data";
import { calculateItemCost } from "@/lib/utils";

export function ViewCartBar() {
    const router = useRouter();
    const { cart, getCartItemCount } = useStoreContext();

    const itemCount = getCartItemCount();
    if (itemCount === 0) return null;

    // Calculate total strictly from the mock data based on the cart state
    const total = Object.entries(cart).reduce((sum, [productId, quantity]) => {
        const product = ALL_PRODUCTS.find((p) => p.id === Number(productId));
        if (!product) return sum;
        return sum + calculateItemCost(quantity, product.price, product.pricingType || "unit");
    }, 0);

    return (
        <div className="fixed bottom-[80px] left-0 right-0 px-4 z-[40]">
            <div className="max-w-md mx-auto">
                <button
                    onClick={() => router.push("/cart")}
                    className="w-full bg-[#B52725] text-white rounded-xl p-4 flex items-center justify-between shadow-[0_8px_30px_rgb(181,39,37,0.3)] transform transition hover:scale-[1.02] active:scale-[0.98]"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <ShoppingCart className="w-5 h-5 text-white" />
                        </div>
                        <div className="text-left">
                            <div className="text-xs text-white/90 font-medium">
                                {itemCount} {itemCount === 1 ? "Item" : "Items"}
                            </div>
                            <div className="text-white font-bold leading-none py-1">₹{total}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 font-semibold">
                        <span>View Cart</span>
                        <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </div>
                </button>
            </div>
        </div>
    );
}
