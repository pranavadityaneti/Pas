"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStoreContext } from "@/context/StoreContext";
import { MapPin, Search, Calendar, ChevronRight } from "lucide-react";
import { RESTAURANTS, HERO_IMAGES } from "@/lib/mock-data/data";

export default function DiningPage() {
    const router = useRouter();
    const { selectedLocation, setActiveTab } = useStoreContext();

    // Ensure global nav knows we are on dining tab
    useEffect(() => {
        setActiveTab('dining');
    }, [setActiveTab]);

    return (
        <div className="flex flex-col min-h-screen bg-gray-50/50">
            {/* Top Header - Sticky Location & Search */}
            <div className="sticky top-0 z-40 bg-white shadow-sm pb-4 pt-12 px-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 max-w-[75%]">
                        <MapPin className="w-5 h-5 text-[#B52725] shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 font-medium tracking-wide uppercase">Dining Around</span>
                            <span className="text-sm font-semibold truncate">{selectedLocation}</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center shrink-0 cursor-pointer overflow-hidden border border-gray-200">
                        <img src={"https://i.pravatar.cc/150?u=a042581f4e29026024d"} className="w-full h-full object-cover" alt="Profile" />
                    </div>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        readOnly
                        className="w-full pl-10 pr-4 py-3.5 bg-gray-100/80 border-transparent rounded-xl text-sm focus:bg-white focus:border-[#B52725] focus:ring-2 focus:ring-[#B52725]/20 transition-all font-medium"
                        placeholder="Search for restaurants, cuisines..."
                    />
                </div>
            </div>

            <div className="p-4 space-y-8 pb-32">
                {/* Horizontal Dining Categories */}
                <section>
                    <div className="flex flex-wrap gap-x-3 gap-y-4">
                        {["Fine Dining", "Cafes", "Pubs & Bars", "Buffet", "Outdoor Seating"].map((cat, idx) => {
                            return (
                                <button
                                    key={idx}
                                    className="flex-1 min-w-[30%] bg-white rounded-xl shadow-sm border border-gray-100 py-3 px-2 flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform"
                                >
                                    <span className="text-[12px] font-bold text-gray-800 text-center leading-tight whitespace-nowrap">
                                        {cat}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Hero Banner Grid */}
                <section>
                    <div className="relative h-48 w-full rounded-2xl overflow-hidden shadow-sm">
                        <img src={HERO_IMAGES[2]} alt="Dining Promo" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                            <div className="flex items-center gap-1.5 mb-1 bg-white/20 backdrop-blur-md w-fit px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest text-orange-200">
                                <Calendar className="w-3 h-3" /> Early Access
                            </div>
                            <h3 className="font-extrabold text-2xl drop-shadow-md">Gourmet Evenings</h3>
                            <p className="text-white/90 text-sm font-medium mt-1">Book tables and skip the queue</p>
                        </div>
                    </div>
                </section>

                {/* Restaurant Grid */}
                <section>
                    <div className="flex flex-col gap-5">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold tracking-tight">Top Rated Spots</h2>
                        </div>
                        {RESTAURANTS.slice(0, 10).map((restaurant) => (
                            <div
                                key={restaurant.id}
                                onClick={() => router.push(`/store/${restaurant.id}`)}
                                className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 flex flex-col active:scale-[0.98] transition-all cursor-pointer"
                            >
                                <div className="relative h-44 w-full bg-gray-100">
                                    <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                                    <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1.5">
                                        <span>★ {restaurant.rating}</span>
                                    </div>
                                    <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
                                        <span className="bg-orange-500 text-white px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider w-fit shadow-md">
                                            Pre-Order
                                        </span>
                                        <span className="bg-white/90 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-gray-800 uppercase tracking-wider shadow-sm flex items-center gap-1 w-fit">
                                            <MapPin className="w-3 h-3" /> {restaurant.distance} • {restaurant.type}
                                        </span>
                                    </div>
                                </div>
                                <div className="p-4 flex flex-col gap-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-[17px] leading-tight flex items-center gap-2">
                                                {restaurant.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 font-medium mt-0.5">{restaurant.cuisine}</p>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-3 border-t border-gray-100 flex justify-between items-center text-sm font-bold text-[#B52725]">
                                        <span>Book a Table</span>
                                        <ChevronRight className="w-4 h-4 bg-red-50 text-red-600 rounded-full" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
