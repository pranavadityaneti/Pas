"use client";

import { motion } from "framer-motion";

export function QuickCommerceExpose() {
    const stats = [
        {
            title: "Inflated MRP",
            stat: "+18%",
            description: "Average price markup on groceries vs. your local store shelf.",
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
            <div className="w-full flex flex-col md:flex-row justify-between items-end gap-12">

                {/* Left: Headline */}
                <motion.div
                    className="max-w-2xl"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    viewport={{ once: true }}
                >
                    <h2 className="text-6xl md:text-8xl font-medium tracking-tight text-white font-[family-name:var(--font-dm-sans)] leading-[1] mb-6">
                        The <br /> <span className="text-[#B52725]">"Convenience"</span> <br /> Tax.
                    </h2>

                    <div className="flex items-center gap-4">
                        <div className="h-[1px] w-20 bg-white/20"></div>
                        <p className="text-white/40 uppercase tracking-widest text-sm font-medium">THE REALITY CHECK</p>
                    </div>
                </motion.div>

                {/* Right: Narration & App Buttons */}
                {/* Removed max-w-md to allow full right justification if needed, but kept reasonable width logic */}
                <motion.div
                    className="flex flex-col gap-8 items-end text-right ml-auto max-w-lg"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                    viewport={{ once: true }}
                >
                    <div className="flex gap-4 justify-end">
                        {/* App Store Button */}
                        <button className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl transition-all group">
                            <svg className="w-8 h-8 fill-white" viewBox="0 0 24 24">
                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.61-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.18 2.83M13 3.5c.68-.83 1.14-2.08.98-3.32-1.09.05-2.4.74-3.17 1.62-.63.72-1.19 1.88-1.04 3.23 1.16.09 2.38-.71 3.23-1.53z" />
                            </svg>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/60 uppercase font-medium tracking-wide">Available on</span>
                                <span className="text-sm font-semibold text-white leading-none">App Store</span>
                            </div>
                        </button>

                        {/* Play Store Button */}
                        <button className="flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl transition-all group">
                            <svg className="w-7 h-7" viewBox="0 0 24 24">
                                <path fill="#EA4335" d="M11.53 12.33L1.92 2.48C1.59 2.83 1.4 3.32 1.4 3.9v16.19c0 .59.19 1.07.52 1.42l9.61-9.18z" />
                                <path fill="#FBBC04" d="M15.42 8.35L11.53 12.33 16.2 17.1l.03.01 4.7-2.67c1.34-.76 1.34-2.01 0-2.77l-5.51-3.32z" />
                                <path fill="#34A853" d="M16.23 17.11l-4.7-4.78-9.61 9.18c.36.38.89.56 1.44.25l12.87-4.65z" />
                                <path fill="#4285F4" d="M16.23 6.89l-12.87-4.65c-.56-.34-1.08-.14-1.44.25l9.61 9.18 4.7-4.78z" />
                            </svg>
                            <div className="flex flex-col items-start">
                                <span className="text-[10px] text-white/60 uppercase font-medium tracking-wide">Available on</span>
                                <span className="text-sm font-semibold text-white leading-none">Google Play</span>
                            </div>
                        </button>
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
