"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Store, Utensils, MapPin } from "lucide-react";

export default function OnboardingPage() {
    const router = useRouter();
    const [activeSlide, setActiveSlide] = useState(0);

    const slides = [
        {
            icon: <Store className="w-16 h-16 text-[#B52725] mb-6 animate-bounce" />,
            title: "Your City's Best\nStores, Delivered.",
            subtitle: "Get groceries, electronics, fashion, and more from your favorite local merchants in minutes."
        },
        {
            icon: <Utensils className="w-16 h-16 text-orange-500 mb-6 animate-[wiggle_1s_ease-in-out_infinite]" />,
            title: "Skip the Line.\nPre-order Food.",
            subtitle: "Reserve tables at top restaurants or pre-order your meals for dine-in and pickup."
        },
        {
            icon: <MapPin className="w-16 h-16 text-emerald-500 mb-6 animate-pulse" />,
            title: "Real-time Magic\nat your Fingertips.",
            subtitle: "Live inventory, live tracking, and instant updates directly from the store shelves to you."
        }
    ];

    return (
        <div className="flex flex-col min-h-screen bg-white">
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center mt-12 relative overflow-hidden">

                {/* Background Decorative Blobs */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-70"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-50 rounded-full blur-2xl -ml-10 -mb-10 opacity-70"></div>

                <div className="transition-all duration-500 ease-in-out z-10 flex flex-col items-center">
                    {slides[activeSlide].icon}
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-[1.1] whitespace-pre-line">
                        {slides[activeSlide].title}
                    </h1>
                    <p className="text-[15px] text-gray-500 font-medium mt-4 max-w-xs leading-relaxed">
                        {slides[activeSlide].subtitle}
                    </p>
                </div>

                {/* Pagination Dots */}
                <div className="flex gap-2 mt-12 z-10">
                    {slides.map((_, idx) => (
                        <div
                            key={idx}
                            onClick={() => setActiveSlide(idx)}
                            className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${activeSlide === idx ? 'w-8 bg-[#B52725]' : 'w-2 bg-gray-200'
                                }`}
                        />
                    ))}
                </div>
            </div>

            <div className="p-6 pb-safe space-y-4 bg-white z-20">
                <button
                    onClick={() => router.push("/login")}
                    className="w-full bg-[#B52725] text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-[0_8px_30px_rgb(181,39,37,0.25)] active:scale-[0.98] transition-transform"
                >
                    Get Started <ChevronRight className="w-5 h-5" />
                </button>
                <button
                    onClick={() => router.push("/")}
                    className="w-full bg-white text-gray-900 py-4 rounded-xl font-bold text-lg border-2 border-gray-100 flex items-center justify-center gap-2 active:bg-gray-50 transition-colors"
                >
                    Explore as Guest
                </button>
            </div>
        </div>
    );
}
