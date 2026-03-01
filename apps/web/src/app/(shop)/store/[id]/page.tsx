"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { STORES, RESTAURANTS, ALL_PRODUCTS, SUB_CATEGORIES } from "@/lib/mock-data/data";
import { ArrowLeft, Search, Star, MapPin } from "lucide-react";
import { useStoreContext } from "@/context/StoreContext";
import { formatQuantity, getIncrement, calculateItemCost } from "@/lib/utils";
import { ProductDetailSheet } from "@/components/ui/sheets/ProductDetailSheet";
import { ReservationSheet } from "@/components/ui/sheets/ReservationSheet";

export default function StorefrontPage() {
    const router = useRouter();
    const params = useParams();
    const storeId = Number(params?.id);

    const { cart, addToCart } = useStoreContext();
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [reservationOpen, setReservationOpen] = useState(false);

    // Find store and its products
    const storeObj = STORES.find((s) => s.id === storeId) || RESTAURANTS.find((r) => r.id === storeId);
    const rawProducts = ALL_PRODUCTS.filter((p: any) => p.storeId === storeId);

    if (!storeObj) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-screen text-center">
                <h2 className="text-xl font-bold mb-4">Store not found</h2>
                <button onClick={() => router.back()} className="text-emerald-600 font-medium p-4 border border-emerald-200 bg-emerald-50 rounded-lg">
                    Go Back
                </button>
            </div>
        );
    }

    // Type checking for unified handling
    const isRestaurant = 'type' in storeObj;
    const storeCategory = isRestaurant ? "food" : (storeObj as any).category;
    const storeTypeLabel = isRestaurant ? (storeObj as any).type : (storeObj as any).category;

    // Categorize products based on mock metadata
    const categories = SUB_CATEGORIES[storeCategory] || ["All Items"];

    const handleProductClick = (product: any) => {
        setSelectedProduct(product);
        setSheetOpen(true);
    };

    return (
        <div className="flex flex-col min-h-screen bg-gray-50 pb-20">
            <ProductDetailSheet
                product={selectedProduct}
                open={sheetOpen}
                onOpenChange={setSheetOpen}
            />

            <ReservationSheet
                restaurant={isRestaurant ? storeObj as any : null}
                open={reservationOpen}
                onOpenChange={setReservationOpen}
            />

            {/* Header Image & Info */}
            <div className="relative h-64 bg-gray-200">
                <img src={storeObj.image} alt={storeObj.name} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
                <button
                    onClick={() => router.back()}
                    className="absolute top-12 left-4 w-10 h-10 bg-white/20 backdrop-blur-md flex items-center justify-center rounded-full text-white z-10 hover:bg-white/30 transition-colors"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="absolute bottom-6 left-6 right-6 flex flex-col gap-2">
                    <div className="flex justify-between items-end">
                        <h1 className="text-3xl font-bold text-white tracking-tight drop-shadow-md">{storeObj.name}</h1>
                        <div className="bg-[#B52725] text-white px-2 py-1 rounded shadow-lg font-bold text-sm tracking-wide">
                            ★ {storeObj.rating}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-white/90 font-medium">
                        <span className="flex items-center gap-1 bg-black/20 px-2 py-0.5 rounded-full"><MapPin className="w-3 h-3" /> {storeObj.distance}</span>
                        <span className="capitalize bg-black/20 px-2 py-0.5 rounded-full">{storeTypeLabel}</span>
                    </div>

                    {/* Book Table Button if Restaurant */}
                    {isRestaurant && (
                        <button
                            onClick={() => setReservationOpen(true)}
                            className="w-full mt-2 bg-white/20 hover:bg-white/30 backdrop-blur-md border border-white/40 text-white font-bold py-3 rounded-xl shadow-sm tracking-wide transition-colors active:scale-[0.98]"
                        >
                            Book a Table
                        </button>
                    )}
                </div>
            </div>

            {/* Internal Navigation / Search */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm flex items-center px-4 py-3 pb-safe gap-3">
                <div className="relative flex-1">
                    <input
                        type="text"
                        readOnly
                        placeholder="Search in store..."
                        className="w-full bg-gray-100/80 rounded-xl px-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#B52725]/20 focus:bg-white transition-all font-medium border-transparent"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                </div>
            </div>

            {/* Menu Categories List */}
            <div className="p-4 space-y-10 mt-2">
                {categories.map((category) => {
                    // Simulate items belonging to categories randomly vs perfectly mapped for demo
                    const categoryProducts = rawProducts.slice(0, Math.max(3, Math.floor(Math.random() * rawProducts.length)));

                    if (categoryProducts.length === 0) return null;

                    return (
                        <div key={category} className="space-y-4">
                            <h2 className="text-xl font-bold tracking-tight text-gray-900 border-l-4 border-[#B52725] pl-3">
                                {category}
                            </h2>

                            <div className="grid grid-cols-1 divide-y divide-gray-100/60 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                {categoryProducts.map((product: any) => {
                                    const qty = cart[product.id] || 0;
                                    const inc = getIncrement(product.pricingType);

                                    return (
                                        <div
                                            key={product.id}
                                            onClick={() => handleProductClick(product)}
                                            className="p-4 flex gap-4 bg-white active:bg-gray-50 transition-colors"
                                        >
                                            <div className="flex flex-col items-center justify-between min-w-[100px] shrink-0 gap-3">
                                                <div className="w-24 h-24 bg-gray-50 rounded-xl overflow-hidden shadow-sm border border-gray-100">
                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                </div>

                                                <div onClick={(e) => { e.stopPropagation(); }} className="w-24 relative z-10">
                                                    {qty > 0 ? (
                                                        <div className="flex items-center justify-between bg-white border-2 border-[#B52725] rounded-xl px-1 h-9 shadow-sm">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); addToCart(product.id, -inc); }}
                                                                className="w-7 h-full flex items-center justify-center text-[#B52725] active:scale-95"
                                                            >
                                                                -
                                                            </button>
                                                            <span className="text-xs font-bold text-[#B52725] min-w-[2rem] text-center bg-[#B52725]/5 rounded py-0.5">
                                                                {formatQuantity(qty, product.pricingType).replace('g', '').replace('kg', '')}
                                                            </span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); addToCart(product.id, inc); }}
                                                                className="w-7 h-full flex items-center justify-center text-[#B52725] active:scale-95"
                                                            >
                                                                +
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); addToCart(product.id, inc); }}
                                                            className="w-full h-9 bg-white text-[#B52725] border-2 border-gray-100 font-bold rounded-xl shadow-sm text-sm active:bg-gray-50 uppercase tracking-widest relative overflow-hidden group"
                                                        >
                                                            <span className="absolute inset-0 bg-[#B52725]/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
                                                            ADD
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex-1 flex flex-col justify-center">
                                                <div className="flex items-start justify-between">
                                                    <h3 className="font-bold text-[15px] text-gray-900 leading-tight">{product.name}</h3>
                                                </div>
                                                <p className="text-[#B52725] font-bold mt-1 tracking-wide">₹{product.price} <span className="text-gray-400 font-medium text-xs">/ {product.uom}</span></p>
                                                <p className="text-xs font-medium text-gray-500 mt-2 line-clamp-2 leading-relaxed max-w-[90%]">
                                                    {product.description}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
