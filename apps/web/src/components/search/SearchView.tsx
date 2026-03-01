"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowLeft, Clock, Navigation, X } from "lucide-react";
import { STORES, RESTAURANTS, STORE_CATEGORIES } from "@/lib/mock-data/data";

interface SearchViewProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SearchView({ isOpen, onClose }: SearchViewProps) {
    const router = useRouter();
    const [query, setQuery] = useState("");
    const [recentSearches, setRecentSearches] = useState(["Milk", "Bread", "Cafe Connect", "Pizza"]);

    // Disable background scrolling when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
            setQuery("");
        }
        return () => { document.body.style.overflow = ""; };
    }, [isOpen]);

    if (!isOpen) return null;

    // Very simple mock search logic
    const filteredStores = query.length > 1
        ? STORES.filter(s => s.name.toLowerCase().includes(query.toLowerCase()) || s.description?.toLowerCase().includes(query.toLowerCase()))
        : [];

    const filteredRestaurants = query.length > 1
        ? RESTAURANTS.filter(r => r.name.toLowerCase().includes(query.toLowerCase()) || r.cuisine?.toLowerCase().includes(query.toLowerCase()))
        : [];

    const handleResultClick = (id: number) => {
        onClose();
        router.push(`/store/${id}`);
    };

    return (
        <div className="fixed inset-0 bg-white z-[100] flex flex-col animate-in slide-in-from-bottom-2 duration-200">
            {/* Search Header */}
            <div className="flex items-center gap-3 px-4 py-4 pt-12 border-b border-gray-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] bg-white">
                <button
                    onClick={onClose}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-700" />
                </button>
                <div className="flex-1 relative">
                    <input
                        type="text"
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search for stores, items, food..."
                        className="w-full bg-gray-100 border-none rounded-xl py-2.5 pl-10 pr-10 text-[15px] focus:ring-2 focus:ring-[#B52725]/20 focus:bg-white transition-all outline-none font-medium placeholder:text-gray-400"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    {query && (
                        <button
                            onClick={() => setQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full bg-gray-200 hover:bg-gray-300"
                        >
                            <X className="w-3 h-3 text-gray-600" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto bg-gray-50/30">
                {!query ? (
                    <div className="p-4 space-y-8">
                        {/* Recent Searches */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-bold text-gray-900">Recent Searches</h3>
                                <button className="text-xs font-bold text-[#B52725] uppercase tracking-wider">Clear</button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {recentSearches.map(term => (
                                    <div
                                        key={term}
                                        onClick={() => setQuery(term)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-600 active:bg-gray-50 cursor-pointer shadow-sm"
                                    >
                                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                                        {term}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Trending Categories */}
                        <div>
                            <h3 className="text-sm font-bold text-gray-900 mb-3">Trending Categories</h3>
                            <div className="grid grid-cols-4 gap-3">
                                {STORE_CATEGORIES.slice(0, 8).map((cat: any) => {
                                    const Icon = cat.icon;
                                    return (
                                        <div
                                            key={cat.id || cat.name}
                                            className="flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform"
                                            onClick={() => setQuery(cat.name)}
                                        >
                                            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 p-2 flex items-center justify-center">
                                                <Icon className={`w-8 h-8 ${cat.color ? cat.color.split(' ')[1] : 'text-gray-600'}`} />
                                            </div>
                                            <span className="text-[10px] font-bold text-center leading-tight">{cat.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-4 space-y-6">
                        {filteredStores.length === 0 && filteredRestaurants.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center text-center">
                                <Search className="w-12 h-12 text-gray-200 mb-4" />
                                <h3 className="text-lg font-bold text-gray-900">No results found</h3>
                                <p className="text-sm text-gray-500 mt-1 max-w-[200px]">We couldn't find anything matching "{query}"</p>
                            </div>
                        ) : (
                            <>
                                {filteredStores.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Stores & Groceries</h3>
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                                            {filteredStores.map(store => (
                                                <div
                                                    key={store.id}
                                                    onClick={() => handleResultClick(store.id)}
                                                    className="flex items-center p-3 gap-4 active:bg-gray-50 cursor-pointer"
                                                >
                                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                                        <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-[15px]">{store.name}</h4>
                                                        <p className="text-xs text-gray-500 mt-0.5">{store.category} • {store.distance}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {filteredRestaurants.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 mt-4">Restaurants</h3>
                                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                                            {filteredRestaurants.map(restaurant => (
                                                <div
                                                    key={restaurant.id}
                                                    onClick={() => handleResultClick(restaurant.id)}
                                                    className="flex items-center p-3 gap-4 active:bg-[#B52725]/5 cursor-pointer"
                                                >
                                                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 shrink-0">
                                                        <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="font-bold text-[15px] text-[#B52725]">{restaurant.name}</h4>
                                                        <p className="text-xs text-gray-500 mt-0.5">{restaurant.cuisine} • {restaurant.distance}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
