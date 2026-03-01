"use client";

import React, { useState } from "react";
import { useStoreContext } from "@/context/StoreContext";
import { MapPin, Search, ChevronRight } from "lucide-react";
import { HERO_IMAGES, STORE_CATEGORIES, STORES } from "@/lib/mock-data/data";
import { useRouter } from "next/navigation";
import { SearchView } from "@/components/search/SearchView";

export default function HomeFeed() {
    const router = useRouter();
    const { selectedLocation } = useStoreContext();
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            {/* Top Header - Sticky Location & Search */}
            <div className="sticky top-0 z-40 bg-white shadow-sm pb-4 pt-12 px-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 max-w-[75%]">
                        <MapPin className="w-5 h-5 text-[#B52725] shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">Delivering to</span>
                            <span className="text-sm font-semibold truncate">{selectedLocation}</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border border-gray-200">
                        <img src={"https://i.pravatar.cc/150?u=a042581f4e29026024d"} className="w-full h-full object-cover" alt="Profile" />
                    </div>
                </div>

                <div className="relative" onClick={() => setSearchOpen(true)}>
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        readOnly
                        className="w-full pl-10 pr-4 py-3.5 bg-gray-100/80 border-transparent rounded-xl text-sm focus:bg-white focus:border-[#B52725] focus:ring-2 focus:ring-[#B52725]/20 transition-all font-medium cursor-pointer"
                        placeholder="Search stores, restaurants or products..."
                    />
                </div>
            </div>

            <SearchView isOpen={searchOpen} onClose={() => setSearchOpen(false)} />

            <div className="p-4 space-y-8 pb-32">
                {/* Horizontal Category Carousel */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold tracking-tight">Explore Categories</h2>
                    </div>
                    <div className="flex overflow-x-auto gap-4 pb-2 -mx-4 px-4 no-scrollbar">
                        {STORE_CATEGORIES.map((cat, idx) => {
                            const Icon = cat.icon;
                            return (
                                <div key={idx} className="flex flex-col items-center gap-2 min-w-[72px]">
                                    <button
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 bg-white transition-transform active:scale-95"
                                    >
                                        <Icon className={`w-7 h-7 text-gray-700`} />
                                    </button>
                                    <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">
                                        {cat.name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* Hero Banner Grid */}
                <section>
                    <div className="grid grid-cols-1 gap-4">
                        <div className="relative h-48 w-full rounded-2xl overflow-hidden shadow-sm">
                            <img src={HERO_IMAGES[0]} alt="Promo" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                            <div className="absolute bottom-4 left-4 right-4">
                                <h3 className="text-white font-bold text-xl drop-shadow-md">Fresh Catch Daily</h3>
                                <p className="text-white/90 text-sm font-medium">Up to 30% off on Seafood</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Store Grid */}
                <section>
                    <div className="flex flex-col gap-5">
                        <h2 className="text-xl font-bold tracking-tight">Stores Near You</h2>
                        {STORES.slice(0, 10).map((store) => (
                            <div
                                key={store.id}
                                onClick={() => router.push(`/store/${store.id}`)}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <div className="relative h-40 w-full bg-gray-100">
                                    <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1.5">
                                        <span>★ {store.rating}</span>
                                    </div>
                                    <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
                                        <span className="bg-white/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-gray-800 uppercase tracking-wider">
                                            {store.distance}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col gap-1">
                                    <div className="flex justify-between items-start">
                                        <h3 className="font-bold text-gray-900 text-lg leading-tight">{store.name}</h3>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium line-clamp-1">{store.description}</p>
                                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" />
                                        {store.address}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
