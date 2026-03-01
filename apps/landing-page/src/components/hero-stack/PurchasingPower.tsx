"use client";

import { motion } from "framer-motion";

const categories = [
    { name: "GROCERIES", bg: "bg-[#FFCCBC]", icon: "🥦" }, // Light Red
    { name: "FRUITS & VEG", bg: "bg-[#B2EBF2]", icon: "🍎" }, // Light Cyan
    { name: "PHARMACY", bg: "bg-[#AED581]", icon: "💊" }, // Light Green
    { name: "ELECTRONICS", bg: "bg-[#DCE775]", icon: "⚡" }, // Lime
    { name: "FASHION", bg: "bg-[#F8BBD0]", icon: "👗" }, // Pink
    { name: "HOME DECOR", bg: "bg-[#FFAB91]", icon: "🏠" }, // Orange
    { name: "BOOKS", bg: "bg-[#80CBC4]", icon: "📚" }, // Teal
    { name: "BEAUTY", bg: "bg-[#C5CAE9]", icon: "💄" }, // Indigo
    { name: "PET SUPPLIES", bg: "bg-[#64B5F6]", icon: "🐾" }, // Blue
    { name: "TOYS", bg: "bg-[#E1BEE7]", icon: "🧸" }, // Purple
    { name: "SPORTS", bg: "bg-[#F48FB1]", icon: "⚽" }, // Pink
    { name: "STATIONERY", bg: "bg-[#FFCC80]", icon: "✏️" }, // Orange
    { name: "GIFTS", bg: "bg-[#E6EE9C]", icon: "🎁" }, // Lime
    { name: "LOCAL ART", bg: "bg-[#FFF59D]", icon: "🎨" }  // Yellow
];

export function PurchasingPower() {
    return (
        <div className="w-full bg-[#FAF9F6] py-20 md:py-32 px-6 md:px-4 flex flex-col items-center justify-center text-center">

            {/* Headline */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                viewport={{ once: true }}
                className="max-w-4xl mb-20"
            >
                <h2 className="text-4xl md:text-7xl text-[#1a1a1a] font-serif leading-[1.1] tracking-tight">
                    Use your <br />
                    <span className="italic font-light">purchasing power</span> <br />
                    for <span className="italic font-light">positive change.</span>
                </h2>

                <p className="mt-6 text-sm md:text-base text-black/40 font-medium tracking-widest lowercase">
                    from anything to everything
                </p>
            </motion.div>

            {/* Badges Grid */}
            <motion.div
                className="max-w-5xl flex flex-wrap justify-center gap-4"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={{
                    visible: { transition: { staggerChildren: 0.05 } }
                }}
            >
                {categories.map((cat, i) => (
                    <motion.div
                        key={i}
                        variants={{
                            hidden: { opacity: 0, scale: 0.8, y: 20 },
                            visible: { opacity: 1, scale: 1, y: 0 }
                        }}
                        transition={{ type: "spring", bounce: 0.4 }}
                        className={`${cat.bg} px-6 py-3 rounded-full flex items-center gap-3 shadow-sm hover:scale-105 transition-transform cursor-default select-none`}
                    >
                        <span className="text-black/70 text-lg leading-none">{cat.icon}</span>
                        <span className="text-xs font-bold tracking-widest text-black/80 uppercase">{cat.name}</span>
                    </motion.div>
                ))}
            </motion.div>

        </div>
    );
}
