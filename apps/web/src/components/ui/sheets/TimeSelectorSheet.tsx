"use client";

import React, { useState } from "react";
import { Drawer } from "vaul";
import { Check } from "lucide-react";

export interface TimeSelectorSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function TimeSelectorSheet({ open, onOpenChange }: TimeSelectorSheetProps) {
    const [selectedDay, setSelectedDay] = useState("Today");
    const [selectedTime, setSelectedTime] = useState("7:00 PM");

    const days = ["Today", "Tomorrow", "Wed, 12 Oct", "Thu, 13 Oct"];
    const times = [
        "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM",
        "8:00 PM", "8:30 PM", "9:00 PM", "9:30 PM"
    ];

    return (
        <Drawer.Root open={open} onOpenChange={onOpenChange}>
            <Drawer.Portal>
                <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]" />
                <Drawer.Content className="bg-white flex flex-col rounded-t-[32px] mt-24 h-[65vh] fixed bottom-0 left-0 right-0 z-[90] shadow-2xl focus:outline-none outline-none">
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 rounded-full" />

                    <div className="flex-1 overflow-y-auto pb-safe pt-8">
                        <div className="p-6 space-y-6">
                            <h2 className="text-xl font-bold tracking-tight text-gray-900">Select Date & Time</h2>

                            {/* Day Scroll */}
                            <div className="flex overflow-x-auto gap-3 pb-2 -mx-6 px-6 no-scrollbar">
                                {days.map(day => (
                                    <button
                                        key={day}
                                        onClick={() => setSelectedDay(day)}
                                        className={`whitespace-nowrap px-5 py-2.5 rounded-full font-bold text-sm transition-colors border ${selectedDay === day
                                            ? "bg-gray-900 text-white border-gray-900"
                                            : "bg-white text-gray-600 border-gray-200"
                                            }`}
                                    >
                                        {day}
                                    </button>
                                ))}
                            </div>

                            {/* Time Grid */}
                            <div className="grid grid-cols-4 gap-3 pt-4 border-t border-gray-100">
                                {times.map(time => {
                                    const isSelected = selectedTime === time;
                                    return (
                                        <button
                                            key={time}
                                            onClick={() => setSelectedTime(time)}
                                            className={`py-3 rounded-xl text-xs font-bold transition-all relative overflow-hidden ${isSelected
                                                ? "bg-[#B52725]/10 text-[#B52725] border-2 border-[#B52725] shadow-sm"
                                                : "bg-gray-50 text-gray-600 border-2 border-transparent"
                                                }`}
                                        >
                                            {isSelected && <span className="absolute top-0.5 right-0.5"><Check className="w-3 h-3" /></span>}
                                            {time}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="p-4 bg-white border-t border-gray-100 pb-safe">
                        <button
                            onClick={() => onOpenChange(false)}
                            className="w-full bg-gray-900 text-white py-4 rounded-xl font-bold text-[15px] shadow-lg active:scale-[0.98] transition-transform"
                        >
                            Save
                        </button>
                    </div>
                </Drawer.Content>
            </Drawer.Portal>
        </Drawer.Root>
    );
}
