"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useStoreContext } from "@/context/StoreContext";
import { ArrowLeft, MapPin, CreditCard, Wallet, Banknote, ShieldCheck } from "lucide-react";
import { LOCATIONS, ALL_PRODUCTS } from "@/lib/mock-data/data";
import { calculateItemCost } from "@/lib/utils";

export default function CheckoutPage() {
    const router = useRouter();
    const { cart, selectedLocation } = useStoreContext();
    const [paymentMethod, setPaymentMethod] = useState("upi");

    // Calculate total strictly from state
    let subtotal = 0;
    Object.entries(cart).forEach(([productId, qty]) => {
        const product = ALL_PRODUCTS.find((p) => p.id === Number(productId));
        if (product) {
            subtotal += calculateItemCost(qty, product.price, product.pricingType || "unit");
        }
    });

    const deliveryFee = 40;
    const taxes = subtotal * 0.05;
    const total = subtotal + deliveryFee + taxes;

    if (Object.keys(cart).length === 0) {
        router.push('/');
        return null;
    }

    const handlePlaceOrder = () => {
        // In a real app we'd call an API here.
        router.push("/success");
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col pb-[100px]">
            <div className="bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
                <div className="flex items-center px-4 py-4 pt-12">
                    <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-bold ml-2">Checkout</h1>
                </div>
            </div>

            <div className="p-4 space-y-6">
                {/* Delivery Address Box */}
                <section>
                    <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Delivery Address</h2>
                    <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-start gap-3">
                        <div className="bg-gray-50 p-2.5 rounded-full mt-1 border border-gray-100">
                            <MapPin className="w-5 h-5 text-gray-600" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-gray-900">{selectedLocation}</h3>
                                <span className="bg-gray-100 text-gray-600 text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-widest">Default</span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                                {LOCATIONS.find(l => l.type === selectedLocation)?.address || "103, Vimala Ramam Apts, Lakshmi Nagar, Chennai - 600041"}
                            </p>
                            <button className="text-[#B52725] text-sm font-bold tracking-wide mt-3 hover:underline">Change Address</button>
                        </div>
                    </div>
                </section>

                {/* Payment Methods */}
                <section>
                    <h2 className="text-[13px] font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">Payment Method</h2>
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">

                        {/* UPI */}
                        <label className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${paymentMethod === 'upi' ? 'bg-[#B52725]/5' : 'active:bg-gray-50'}`}>
                            <input
                                type="radio"
                                name="payment"
                                value="upi"
                                checked={paymentMethod === 'upi'}
                                onChange={() => setPaymentMethod('upi')}
                                className="w-5 h-5 text-[#B52725] focus:ring-[#B52725] border-gray-300"
                            />
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm"><Wallet className="w-5 h-5 text-emerald-600" /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-[15px]">UPI</h3>
                                <p className="text-xs text-gray-500 font-medium">Google Pay, PhonePe, Paytm</p>
                            </div>
                        </label>

                        {/* Cards */}
                        <label className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${paymentMethod === 'card' ? 'bg-[#B52725]/5' : 'active:bg-gray-50'}`}>
                            <input
                                type="radio"
                                name="payment"
                                value="card"
                                checked={paymentMethod === 'card'}
                                onChange={() => setPaymentMethod('card')}
                                className="w-5 h-5 text-[#B52725] focus:ring-[#B52725] border-gray-300"
                            />
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm"><CreditCard className="w-5 h-5 text-blue-600" /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-[15px]">Credit / Debit Card</h3>
                                <p className="text-xs text-gray-500 font-medium">Visa, Mastercard, RuPay</p>
                            </div>
                        </label>

                        {/* Cash */}
                        <label className={`flex items-center gap-4 p-4 cursor-pointer transition-colors ${paymentMethod === 'cod' ? 'bg-[#B52725]/5' : 'active:bg-gray-50'}`}>
                            <input
                                type="radio"
                                name="payment"
                                value="cod"
                                checked={paymentMethod === 'cod'}
                                onChange={() => setPaymentMethod('cod')}
                                className="w-5 h-5 text-[#B52725] focus:ring-[#B52725] border-gray-300"
                            />
                            <div className="bg-white p-2 rounded border border-gray-100 shadow-sm"><Banknote className="w-5 h-5 text-gray-600" /></div>
                            <div className="flex-1">
                                <h3 className="font-bold text-gray-900 text-[15px]">Cash on Delivery</h3>
                                <p className="text-xs text-gray-500 font-medium">Pay safely at your doorstep</p>
                            </div>
                        </label>

                    </div>
                </section>

                {/* Amount to Pay Summary */}
                <div className="bg-gray-100 rounded-xl p-4 flex justify-between items-center border border-gray-200 shadow-inner">
                    <span className="font-bold text-gray-600">Total Payable</span>
                    <span className="font-extrabold text-2xl text-gray-900 tracking-tight">₹{total.toFixed(2)}</span>
                </div>
            </div>

            <div className="fixed bottom-0 left-0 right-0 p-4 pb-safe z-50 bg-white border-t border-gray-100 shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                <div className="max-w-md mx-auto">
                    <button
                        onClick={handlePlaceOrder}
                        className="w-full bg-[#B52725] text-white py-4 rounded-xl flex justify-center items-center gap-2 font-bold text-lg shadow-[0_8px_25px_rgb(181,39,37,0.3)] transform transition active:scale-[0.98] uppercase tracking-wide"
                    >
                        <ShieldCheck className="w-5 h-5" />
                        Place Order
                    </button>
                    <p className="text-center text-[10px] text-gray-400 mt-3 font-medium uppercase tracking-widest flex items-center justify-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Safe and Secure Payments
                    </p>
                </div>
            </div>
        </div>
    );
}
