"use client";

import React from "react";
import { Drawer } from "vaul";
import { useStoreContext } from "@/context/StoreContext";
import { Minus, Plus, Info } from "lucide-react";
import { formatQuantity, getIncrement, calculateItemCost } from "@/lib/utils";

interface Product {
    id: number;
    name: string;
    price: number;
    category: string;
    pricingType: string;
    image: string;
    description: string;
    isFewLeft: boolean;
    rating: string;
    brief: string;
    uom: string;
}

interface ProductDetailSheetProps {
    product: Product | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProductDetailSheet({ product, open, onOpenChange }: ProductDetailSheetProps) {
    const { cart, addToCart } = useStoreContext();

    if (!product) return null;

    const cartQuantity = cart[product.id] || 0;
    const inc = getIncrement(product.pricingType);

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" />
                <Drawer.Content className="bg-white flex flex-col rounded-t-[32px] mt-24 h-[85vh] fixed bottom-0 left-0 right-0 z-[70] shadow-2xl focus:outline-none outline-none">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 rounded-full" />

                    {/* Product Image */}
                    <div className="relative w-full h-64 bg-gray-50 flex-shrink-0 mt-8">
                        <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-contain p-4"
                        />
                        {product.isFewLeft && (
                            <div className="absolute top-4 left-4 bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold shadow-sm">
                                Only a few left!
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pb-safe">
                        <div className="p-6 space-y-6">
                            {/* Header Info */}
                            <div className="flex justify-between items-start gap-4">
                                <div>
                                    <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                        {product.name}
                                    </h2>
                                    <p className="text-sm text-gray-500 font-medium mt-1 uppercase tracking-wide">
                                        {product.uom}
                                    </p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <div className="text-2xl font-bold text-[#B52725]">₹{product.price}</div>
                                </div>
                            </div>

                            <p className="text-gray-600 leading-relaxed text-[15px]">
                                {product.description}
                            </p>

                            {/* Nutrition/Stats Box */}
                            <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100 flex gap-4 mt-6">
                                <div className="bg-white p-2 rounded-xl h-fit border border-blue-50">
                                    <Info className="w-5 h-5 text-blue-500" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-blue-900 text-sm">Product Insights</h4>
                                    <p className="text-xs text-blue-700/80 mt-1 leading-relaxed">
                                        Sourced directly from verified local merchants. Rated {product.rating}★ by neighborhood shoppers.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sticky Bottom Actions */}
                    <div className="p-4 bg-white border-t border-gray-100 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                        <div className="max-w-md mx-auto">
                            {cartQuantity === 0 ? (
                                <button
                                    onClick={() => {
                                        addToCart(product.id, inc);
                                        onOpenChange(false);
                                    }}
                                    className="w-full bg-[#B52725] text-white py-4 rounded-xl font-bold text-[15px] shadow-[0_8px_30px_rgb(181,39,37,0.25)] flex items-center justify-center gap-2 transform transition active:scale-[0.98]"
                                >
                                    <Plus className="w-5 h-5" /> Add to Cart
                                </button>
                            ) : (
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-2 py-2 flex-1 shadow-inner">
                                        <button
                                            onClick={() => addToCart(product.id, -inc)}
                                            className="w-12 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-600 active:scale-95 transition-transform"
                                        >
                                            <Minus className="w-5 h-5" />
                                        </button>
                                        <span className="font-bold text-gray-800 text-[15px] min-w-[3rem] text-center">
                                            {formatQuantity(cartQuantity, product.pricingType)}
                                        </span>
                                        <button
                                            onClick={() => addToCart(product.id, inc)}
                                            className="w-12 h-10 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#B52725] active:scale-95 transition-transform"
                                        >
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => onOpenChange(false)}
                                        className="bg-gray-900 text-white rounded-xl py-4 px-6 font-bold shadow-md active:scale-[0.98] transition-all whitespace-nowrap text-[15px]"
                                    >
                                        Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
