"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStoreContext } from "@/context/StoreContext";
import { CheckCircle2, ChevronRight, Package, MapPin, Receipt, ArrowLeft } from "lucide-react";
import { ALL_PRODUCTS } from "@/lib/mock-data/data";
import { calculateItemCost } from "@/lib/utils";

export default function SuccessPage() {
    const router = useRouter();
    const { cart, selectedLocation, clearCart } = useStoreContext();
    const [orderDetails, setOrderDetails] = useState<{ total: number, itemsCount: number } | null>(null);

    // We capture the order details on mount before clearing the cart
    useEffect(() => {
        let subtotal = 0;
        let count = 0;
        Object.entries(cart).forEach(([productId, qty]) => {
            const product = ALL_PRODUCTS.find((p) => p.id === Number(productId));
            if (product) {
                subtotal += calculateItemCost(qty, product.price, product.pricingType || "unit");
                count += 1;
            }
        });

        const deliveryFee = 40;
        const taxes = subtotal * 0.05;
        const finalTotal = subtotal + deliveryFee + taxes;

        setOrderDetails({
            total: finalTotal,
            itemsCount: count
        });

        // We simulate order placed successfully by clearing the global cart
        setTimeout(() => {
            clearCart();
        }, 500);

    }, []); // Run once on mount

    if (!orderDetails) return null;

    return (
        <div className="min-h-screen bg-[#FDF9F9] flex flex-col pb-[120px]">
            {/* Header */}
            <div className="flex items-center px-4 py-4 pt-12 border-b border-gray-100 bg-white">
                <h1 className="text-lg font-bold ml-2">Order Status</h1>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center mt-8">
                <div className="relative">
                    <div className="absolute inset-0 bg-green-100 rounded-full animate-ping opacity-50"></div>
                    <div className="bg-green-500 rounded-full p-4 relative z-10 shadow-lg shadow-green-500/30">
                        <CheckCircle2 className="w-16 h-16 text-white" />
                    </div>
                </div>

                <h1 className="text-3xl font-extrabold text-gray-900 mt-8 tracking-tight">Order Placed!</h1>
                <p className="text-gray-500 mt-2 font-medium">
                    Your order #ORD-{Math.floor(100000 + Math.random() * 900000)} is confirmed and will be processed shortly.
                </p>

                {/* Order Summary Card */}
                <div className="w-full max-w-sm mt-10 bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-left space-y-6">
                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                        <div className="bg-gray-50 p-3 rounded-full border border-gray-100">
                            <Package className="w-6 h-6 text-[#B52725]" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Items</p>
                            <p className="font-bold text-gray-900">{orderDetails.itemsCount} {orderDetails.itemsCount === 1 ? 'Item' : 'Items'}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                        <div className="bg-gray-50 p-3 rounded-full border border-gray-100">
                            <Receipt className="w-6 h-6 text-[#B52725]" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total Paid</p>
                            <p className="font-extrabold text-xl text-gray-900">₹{orderDetails.total.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 pt-2">
                        <div className="bg-gray-50 p-3 rounded-full border border-gray-100 mt-1">
                            <MapPin className="w-6 h-6 text-[#B52725]" />
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Delivering To</p>
                            <p className="font-bold text-gray-900 text-sm leading-snug">{selectedLocation}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe bg-white border-t border-gray-100">
                <button
                    onClick={() => router.push("/")}
                    className="w-full bg-[#B52725] text-white py-4 rounded-xl font-bold text-lg shadow-[0_8px_30px_rgb(181,39,37,0.25)] active:scale-[0.98] transition-transform"
                >
                    Back to Home
                </button>
            </div>
        </div>
    );
}
