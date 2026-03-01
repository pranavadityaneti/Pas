"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useStoreContext } from "@/context/StoreContext";
import { ALL_PRODUCTS, STORES, RESTAURANTS } from "@/lib/mock-data/data";
import { ArrowLeft, Clock, MapPin, Receipt, Ticket, Minus, Plus } from "lucide-react";
import { formatQuantity, calculateItemCost, getIncrement } from "@/lib/utils";

export default function CartPage() {
    const router = useRouter();
    const { cart, addToCart } = useStoreContext();
    const [appliedCoupon, setAppliedCoupon] = useState<any>(null);

    // Group items by store for rendering
    const itemsByStore: Record<number, any[]> = {};
    let subtotal = 0;

    Object.entries(cart).forEach(([productId, qty]) => {
        const product = ALL_PRODUCTS.find((p) => p.id === Number(productId));
        if (product) {
            if (!itemsByStore[product.storeId]) {
                itemsByStore[product.storeId] = [];
            }
            itemsByStore[product.storeId].push({ ...product, qty });
            subtotal += calculateItemCost(qty, product.price, product.pricingType || "unit");
        }
    });

    const getStore = (id: number) => {
        return STORES.find(s => s.id === id) || RESTAURANTS.find(r => r.id === id);
    };

    const hasItems = Object.keys(cart).length > 0;

    const deliveryFee = hasItems ? 40 : 0;
    const taxes = subtotal * 0.05;
    const discountAmount = appliedCoupon ? (appliedCoupon.title.includes('%') ? subtotal * 0.1 : 50) : 0;
    const total = subtotal + deliveryFee + taxes - discountAmount;

    if (!hasItems) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 px-4">
                <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                    <Receipt className="w-10 h-10 text-gray-400" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
                <p className="text-gray-500 text-center mb-8 max-w-[250px]">
                    Looks like you haven't added anything to your cart yet.
                </p>
                <button
                    onClick={() => router.push("/")}
                    className="bg-[#B52725] text-white px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-red-500/20 active:scale-95 transition-transform"
                >
                    Start Shopping
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-[120px]">
            {/* Header */}
            <div className="bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
                <div className="flex items-center px-4 py-4 pt-12">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-bold ml-2">Review Cart</h1>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Delivery Info */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex gap-4 shadow-sm">
                    <div className="bg-emerald-100 p-2.5 rounded-full h-fit border border-emerald-200">
                        <Clock className="w-5 h-5 text-emerald-700" />
                    </div>
                    <div>
                        <h3 className="font-bold text-emerald-900 leading-tight">Delivery in 15-20 mins</h3>
                        <p className="text-emerald-700/80 text-sm font-medium mt-0.5">Shipment will be bundled perfectly.</p>
                    </div>
                </div>

                {/* Cart Items Box */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {Object.entries(itemsByStore).map(([storeId, items]) => {
                        const store = getStore(Number(storeId));
                        return (
                            <div key={storeId} className="border-b border-gray-100 last:border-0">
                                <div className="p-4 bg-gray-50/50 flex items-center gap-3 border-b border-gray-100">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-gray-200">
                                        <img src={store?.image} className="w-full h-full object-cover" alt="Store" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-[15px]">{store?.name}</h4>
                                        <p className="text-xs text-gray-500 font-medium">{store?.address}</p>
                                    </div>
                                </div>

                                <div className="divide-y divide-gray-50">
                                    {items.map((item) => {
                                        const inc = getIncrement(item.pricingType);
                                        return (
                                            <div key={item.id} className="p-4 flex gap-4 items-center bg-white transition-colors active:bg-gray-50">
                                                <div className="w-16 h-16 bg-gray-50 rounded-xl overflow-hidden shrink-0 border border-gray-100 p-1 shadow-sm">
                                                    <img src={item.image} className="w-full h-full object-contain" alt={item.name} />
                                                </div>
                                                <div className="flex-1">
                                                    <h5 className="font-semibold text-[15px] text-gray-900 line-clamp-1">{item.name}</h5>
                                                    <p className="text-[#B52725] font-bold text-sm mt-0.5 tracking-wide">
                                                        ₹{item.price} <span className="text-gray-400 font-medium text-xs">/ {item.uom}</span>
                                                    </p>
                                                </div>
                                                <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl shadow-sm px-1 h-9">
                                                    <button onClick={() => addToCart(item.id, -inc)} className="w-8 h-full flex items-center justify-center text-[#B52725] active:scale-95 focus:outline-none">
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-[13px] font-bold text-gray-900 min-w-[2.5rem] text-center bg-gray-50 py-1 rounded">
                                                        {formatQuantity(item.qty, item.pricingType).replace('g', '').replace('kg', '')}
                                                    </span>
                                                    <button onClick={() => addToCart(item.id, inc)} className="w-8 h-full flex items-center justify-center text-[#B52725] active:scale-95 focus:outline-none">
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bill Details */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-gray-400" /> Bill Summary
                    </h3>
                    <div className="space-y-3 pt-1 border-t border-dashed border-gray-200">
                        <div className="flex justify-between text-sm font-medium text-gray-600">
                            <span>Item Total</span>
                            <span className="text-gray-900 font-bold tracking-wide">₹{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-gray-600">
                            <span>Delivery Partner Fee</span>
                            <span className="text-gray-900 font-bold tracking-wide">₹{deliveryFee.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-medium text-gray-600">
                            <span>Taxes & Charges (5%)</span>
                            <span className="text-gray-900 font-bold tracking-wide">₹{taxes.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-gray-100 flex justify-between items-center bg-gray-50/50 p-3 rounded-xl -mx-2 mb-2">
                        <span className="font-extrabold text-gray-900 text-lg uppercase tracking-wider">Grand Total</span>
                        <span className="font-extrabold text-2xl text-[#B52725] tracking-tight">₹{total.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            {/* Floating Checkout Button Wrapper (Pushed above bottom nav if present) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe z-50 bg-white border-t border-gray-100 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="max-w-md mx-auto">
                    <button
                        onClick={() => router.push("/checkout")}
                        className="w-full bg-[#B52725] text-white py-4 rounded-xl flex items-center justify-between px-6 shadow-[0_8px_25px_rgb(181,39,37,0.3)] transform transition active:scale-[0.98]"
                    >
                        <div className="flex flex-col text-left">
                            <span className="text-white/80 text-[11px] font-bold uppercase tracking-widest">To Pay</span>
                            <span className="font-bold text-xl leading-none mt-1 shadow-sm">₹{total.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-2 font-bold text-[15px] uppercase tracking-wide">
                            Checkout
                            <ArrowLeft className="w-5 h-5 rotate-180" />
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
