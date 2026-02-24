"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

const competitors = [
    {
        logo: "/logos/swiggy-instamart.png",
        logoAlt: "Swiggy Instamart",
        logoBg: "bg-white",
        fees: [
            { label: "Delivery fee", value: "₹16 – ₹30" },
            { label: "Handling fee", value: "₹7 – ₹10" },
            { label: "Small cart fee", value: "₹15" },
        ],
        note: "Extra charges on every order, regardless of distance.",
    },
    {
        logo: "/logos/blinkit.png",
        logoAlt: "Blinkit",
        logoBg: "bg-[#F8D231]",
        fees: [
            { label: "Delivery fee", value: "₹12 – ₹30" },
            { label: "Handling fee", value: "₹9 – ₹21" },
            { label: "Small cart fee", value: "₹20" },
        ],
        note: "Fees vary by city and cart size.",
    },
    {
        logo: "/logos/zepto.png",
        logoAlt: "Zepto",
        logoBg: "bg-white",
        fees: [
            { label: "Delivery fee", value: "₹30" },
            { label: "Late night fee", value: "₹15" },
            { label: "Surge pricing", value: "Applicable" },
        ],
        note: "Free delivery only on orders above ₹99.",
    },
];

export function ComparisonSection() {
    return (
        <section className="bg-[#f8f8fa] py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">

                {/* Headline */}
                <motion.h2
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.55 }}
                    className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-center text-black-shadow mb-4"
                >
                    Others charge,{" "}
                    <span className="text-store-red">we&nbsp;don't.</span>
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.1 }}
                    className="text-center text-sm text-black-shadow/40 mb-16"
                >
                    Based on publicly available pricing. Fees vary by order value, location, and time.
                </motion.p>

                {/* Comparison layout */}
                <div className="flex flex-col lg:flex-row items-stretch gap-6 lg:gap-8">

                    {/* ── Left: Competitor cards ── */}
                    <motion.div
                        className="flex-1 w-full flex flex-col"
                        initial={{ opacity: 0, x: -32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <p className="text-center text-xs font-semibold text-black-shadow/40 uppercase tracking-widest mb-5">
                            Competitor Platforms
                        </p>
                        <div className="grid grid-cols-3 gap-4 flex-1">
                            {competitors.map((c, i) => (
                                <motion.div
                                    key={c.logoAlt}
                                    initial={{ opacity: 0, y: 20 }}
                                    whileInView={{ opacity: 1, y: 0 }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                                    className="bg-white rounded-2xl p-5 flex flex-col gap-4 shadow-sm border border-gray-100 h-full"
                                >
                                    {/* Logo */}
                                    <div className={`h-14 rounded-xl flex items-center justify-center p-2 ${c.logoBg} overflow-hidden`}>
                                        <Image
                                            src={c.logo}
                                            alt={c.logoAlt}
                                            width={120}
                                            height={48}
                                            className="object-contain max-h-10"
                                        />
                                    </div>

                                    <hr className="border-gray-100" />

                                    {/* Fee breakdown */}
                                    <div className="flex flex-col gap-2">
                                        {c.fees.map(f => (
                                            <div key={f.label} className="flex flex-col xs:flex-row xs:items-center justify-between gap-1">
                                                <span className="text-xs text-black-shadow/50 leading-snug break-words">{f.label}</span>
                                                <span className="text-xs font-semibold text-black-shadow whitespace-nowrap self-start xs:self-auto">{f.value}</span>
                                            </div>
                                        ))}
                                    </div>

                                    <hr className="border-gray-100" />
                                    <p className="text-xs text-black-shadow/40 leading-snug mt-auto">{c.note}</p>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>

                    {/* ── VS badge ── */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.6 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: 0.25, type: "spring", stiffness: 200 }}
                        className="flex-shrink-0 self-center w-12 h-12 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center text-sm font-bold text-black-shadow/50"
                    >
                        VS
                    </motion.div>

                    {/* ── Right: PickAtStore card ── */}
                    <motion.div
                        className="flex-1 w-full"
                        initial={{ opacity: 0, x: 32 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                    >
                        <p className="text-center text-xs font-semibold text-white/0 uppercase tracking-widest mb-5 select-none">
                            PickAtStore
                        </p>
                        <div className="bg-store-red rounded-2xl p-8 flex flex-col items-center gap-4 shadow-lg shadow-store-red/30 h-full min-h-[300px] justify-center">
                            <p className="text-xs font-bold text-white/60 tracking-[0.2em] uppercase">PickAtStore</p>
                            <motion.p
                                initial={{ opacity: 0, scale: 0.7 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: 0.35, type: "spring", stiffness: 150 }}
                                className="text-8xl font-black text-white leading-none tracking-tighter"
                            >
                                0%
                            </motion.p>
                            <p className="text-base font-semibold text-white/80 text-center">
                                Zero delivery fees.<br />Zero handling charges.
                            </p>
                            <p className="text-lg font-bold text-white text-center leading-snug max-w-[220px]">
                                You pay exactly what the store charges.
                            </p>
                        </div>
                    </motion.div>

                </div>
            </div>
        </section>
    );
}
