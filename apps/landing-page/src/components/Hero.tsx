"use client";

import { motion } from "framer-motion";
import { Header } from "./Header";
import { CurvedCarousel } from "./CurvedCarousel";
import { ArrowRight, Sparkles } from "lucide-react";

export function Hero() {
    return (
        <div className="relative min-h-screen bg-vista-white overflow-hidden text-black-shadow selection:bg-location-yellow-40">
            <Header />

            <main className="pt-32 pb-16 flex flex-col items-center justify-center text-center px-4 sm:px-6 relative z-10">

                {/* Badge */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-location-yellow-40/50 text-location-yellow-120 text-sm font-semibold border border-location-yellow-40"
                >
                    <Sparkles size={14} />
                    <span>Over 10,000 Local Stores</span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tighter leading-[1.1] max-w-5xl mx-auto"
                >
                    Skip the Queue. <br className="hidden md:block" />
                    <span className="relative inline-block text-store-red">
                        Shop Local.
                        {/* Scribble decoration */}
                        <svg className="absolute -bottom-2 md:-bottom-4 left-0 w-full h-3 md:h-6 text-location-yellow -z-10 opacity-60" viewBox="0 0 100 20" preserveAspectRatio="none">
                            <path d="M0 10 Q 50 20 100 10" fill="transparent" stroke="currentColor" strokeWidth="4" />
                        </svg>
                    </span>
                </motion.h1>

                {/* Subheadline + Decorative Elements */}
                <div className="relative mt-8 max-w-2xl mx-auto">
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg md:text-xl text-black-shadow/70 leading-relaxed"
                    >
                        The ultimate convenience for your daily needs. Order from your favorite neighborhood stores and pick up curbside in minutes.
                    </motion.p>

                    {/* Hand-drawn Arrow Left */}
                    <div className="hidden md:block absolute -left-24 top-2 transform -rotate-12">
                        {/* Simple SVG Arrow */}
                        <svg width="60" height="60" viewBox="0 0 60 60" className="text-store-red-40">
                            <path d="M50 10 Q 10 30 10 50 M 10 50 L 20 40 M 10 50 L 25 55" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                    {/* Text for Arrow */}
                    <span className="hidden md:block absolute -left-40 -top-4 font-handwriting text-store-red-60 transform -rotate-12 font-script text-sm font-medium">Save time!</span>
                </div>

                {/* CTA Button */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-10 relative group"
                >
                    <button className="bg-store-red text-white px-8 py-4 rounded-full text-lg font-semibold shadow-lg shadow-store-red-40/50 hover:shadow-xl hover:scale-105 hover:bg-store-red-80 transition-all flex items-center gap-2">
                        Start Shopping
                        <ArrowRight size={20} />
                    </button>

                    {/* "It's free" Scribble */}
                    <div className="absolute -bottom-10 -left-12 rotate-[-15deg] hidden md:block">
                        <span className="text-black-shadow/60 font-medium text-sm">No extra fees</span>
                        <svg width="40" height="20" viewBox="0 0 40 20" className="text-location-yellow ml-2 -mt-1">
                            <path d="M10 0 Q 20 20 35 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </div>
                </motion.div>

                {/* Carousel */}
                <div className="mt-20 w-full">
                    <CurvedCarousel />
                </div>

            </main>
        </div>
    );
}
