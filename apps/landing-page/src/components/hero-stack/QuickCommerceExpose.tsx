"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function QuickCommerceExpose() {
    const stats = [
        {
            title: "Hidden Cost",
            stat: "~20%",
            description: "Effective cost increase vs. local store due to fees & surge pricing.",
            bg: "bg-white",
            text: "text-black"
        },
        {
            title: "Drip Pricing",
            stat: "₹45+",
            description: "Platform fees, handling charges, and surge pricing added at checkout.",
            bg: "bg-white",
            text: "text-black"
        },
        {
            title: "Local Impact",
            stat: "Dark Stores",
            description: "Replacing vibrant local shops with closed-door warehouses.",
            bg: "bg-white",
            text: "text-black"
        },
        {
            title: "PickAtStore",
            stat: "0%",
            description: "Zero hidden markups. You pay exactly what the store charges.",
            bg: "bg-[#B52725]", // Brand Red
            text: "text-white"
        }
    ];

    return (
        <div className="w-full max-w-[1440px] mx-auto px-8 flex flex-col gap-16 items-center justify-center pt-20">
            {/* Top Section: Header & Narration */}
            <div className="w-full flex flex-col md:flex-row justify-between items-center md:items-end gap-12">

                {/* Left: Headline */}
                <motion.div
                    className="max-w-2xl flex flex-col items-center md:items-start text-center md:text-left"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-6xl md:text-8xl font-medium tracking-tight text-white font-[family-name:var(--font-dm-sans)] leading-[1] mb-6">
                        The <br /> <span className="text-[#B52725]">"Convenience"</span> <br /> Tax.
                    </h2>

                    <div className="flex items-center gap-4">
                        <div className="h-[1px] w-10 md:w-20 bg-white/20"></div>
                        <p className="text-white/40 uppercase tracking-widest text-sm font-medium">THE REALITY CHECK</p>
                        <div className="h-[1px] w-10 md:w-20 bg-white/20 md:hidden"></div>
                    </div>
                </motion.div>

                {/* Right: Narration & App Buttons */}
                {/* Removed max-w-md to allow full right justification if needed, but kept reasonable width logic */}
                <motion.div
                    className="flex flex-col gap-8 items-center md:items-end text-center md:text-right ml-0 md:ml-auto max-w-lg mt-8 md:mt-0"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    viewport={{ once: true }}
                >
                    <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-end w-full">
                        <Image
                            src="/app-store-badge.png"
                            alt="Download on the App Store"
                            width={180}
                            height={60}
                            className="w-auto h-[50px] object-contain"
                        />
                        <Image
                            src="/google-play-badge.png"
                            alt="Get it on Google Play"
                            width={180}
                            height={60}
                            className="w-auto h-[50px] object-contain"
                        />
                    </div>
                </motion.div>
            </div>

            {/* Bottom Section: Stats Grid (Horizontal) */}
            <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-6 place-items-center">
                {stats.map((item, i) => (
                    <motion.div
                        key={i}
                        className={`p-8 rounded-[1.5rem] ${item.bg} h-[280px] flex flex-col items-center text-center justify-center gap-6 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-500`}
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.2 + (i * 0.1) }}
                        viewport={{ once: true }}
                    >
                        {/* Header Row in Card */}
                        <div className="w-full relative z-10 flex flex-col items-center justify-center gap-4">
                            {/* Icon Inline and Centered */}
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${item.text === 'text-white' ? 'border-white/20' : 'border-black/5'}`}>
                                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={`transform transition-transform duration-500 group-hover:rotate-45 ${item.text === 'text-white' ? 'stroke-white' : 'stroke-black'}`}>
                                    <path d="M1 11L11 1M11 1H3M11 1V9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>

                            <h3 className={`text-xs font-bold tracking-widest uppercase opacity-70 ${item.text === 'text-white' ? 'text-white' : 'text-black'}`}>
                                {item.title}
                            </h3>
                        </div>

                        {/* Big Stat */}
                        <div className="relative z-10">
                            <h4 className={`text-5xl font-bold tracking-tighter ${item.text}`}>
                                {item.stat}
                            </h4>
                        </div>

                        {/* Description */}
                        <div className="relative z-10">
                            <p className={`text-sm leading-snug opacity-90 max-w-[200px] mx-auto ${item.text === 'text-white' ? 'text-white' : 'text-black'}`}>
                                {item.description}
                            </p>
                        </div>

                        {/* Decorative BG Number */}
                        <div className={`absolute -right-4 -bottom-10 text-[8rem] font-bold leading-none opacity-[0.07] select-none ${item.text === 'text-white' ? 'text-white' : 'text-black'}`}>
                            {i + 1}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
