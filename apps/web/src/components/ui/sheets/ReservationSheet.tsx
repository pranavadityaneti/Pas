"use client";

import React, { useState } from "react";
import { Drawer } from "vaul";
import { MapPin, Users, Calendar, Clock, UtensilsCrossed, ChevronRight } from "lucide-react";
import { TimeSelectorSheet } from "./TimeSelectorSheet";

interface Restaurant {
    id: number;
    name: string;
    type: string;
    cuisine: string;
    description: string;
    image: string;
    rating: string;
    distance: string;
    address: string;
}

interface ReservationSheetProps {
    restaurant: Restaurant | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ReservationSheet({ restaurant, open, onOpenChange }: ReservationSheetProps) {
    const [timeSelectorOpen, setTimeSelectorOpen] = useState(false);

    if (!restaurant) return null;

    return (
        <>
            <Drawer.Root open={open} onOpenChange={onOpenChange}>
                <Drawer.Portal>
                    <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]" />
                    <Drawer.Content className="bg-white flex flex-col rounded-t-[32px] mt-24 h-[90vh] fixed bottom-0 left-0 right-0 z-[70] shadow-2xl focus:outline-none outline-none">
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 rounded-full" />

                        <div className="relative w-full h-56 bg-gray-200 flex-shrink-0 mt-8">
                            <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                            <div className="absolute bottom-4 left-4 right-4 text-white">
                                <h2 className="text-2xl font-bold tracking-tight drop-shadow-md">{restaurant.name}</h2>
                                <p className="text-sm text-white/90 font-medium mt-1">{restaurant.cuisine} • {restaurant.type}</p>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto pb-safe">
                            <div className="p-5 space-y-6">

                                {/* Details Box */}
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex gap-4 shadow-inner">
                                    <div className="bg-white p-2 rounded-xl h-fit border border-gray-100 shadow-sm">
                                        <MapPin className="w-5 h-5 text-[#B52725]" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 text-sm">{restaurant.distance} Away</h4>
                                        <p className="text-xs text-gray-500 font-medium mt-0.5 leading-relaxed">{restaurant.address}</p>
                                    </div>
                                </div>

                                {/* Pre-order menu tease */}
                                <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex justify-between items-center shadow-sm">
                                    <div className="flex gap-3 items-center">
                                        <div className="bg-orange-100 p-2 rounded-full">
                                            <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-orange-900 text-sm">Order Ahead</h4>
                                            <p className="text-xs text-orange-700/80 mt-0.5">Skip the wait. Pre-order your food.</p>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-5 h-5 text-orange-400" />
                                </div>

                                <div className="space-y-4 pt-2">
                                    <h3 className="font-bold text-lg text-gray-900">Reserve a Table</h3>
                                    <p className="text-sm text-gray-500 font-medium pb-2 border-b border-gray-100">
                                        Dining slots are filling up fast for {restaurant.name}. Guarantee your spot today.
                                    </p>

                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center justify-center gap-2 active:bg-gray-50 transition-colors cursor-pointer">
                                            <Users className="w-6 h-6 text-gray-400" />
                                            <span className="font-bold text-gray-800 text-sm">2 Guests</span>
                                        </div>
                                        <div
                                            onClick={() => setTimeSelectorOpen(true)}
                                            className="bg-white border border-[#B52725] rounded-xl p-4 flex flex-col items-center justify-center gap-2 bg-red-50/30 cursor-pointer shadow-sm"
                                        >
                                            <Calendar className="w-6 h-6 text-[#B52725]" />
                                            <span className="font-bold text-[#B52725] text-sm">Today, 7:00 PM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-white border-t border-gray-100 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                            <div className="max-w-md mx-auto">
                                <button
                                    className="w-full bg-[#B52725] text-white py-4 rounded-xl font-bold text-[15px] shadow-[0_8px_30px_rgb(181,39,37,0.25)] flex items-center justify-center gap-2 transform transition active:scale-[0.98]"
                                >
                                    Confirm Reservation
                                </button>
                            </div>
                        </div>
                    </Drawer.Content>
                </Drawer.Portal>
            </Drawer.Root>

            {/* Nested Sheet for Time Selection */}
            <TimeSelectorSheet
                open={timeSelectorOpen}
                onOpenChange={setTimeSelectorOpen}
            />
        </>
    );
}
