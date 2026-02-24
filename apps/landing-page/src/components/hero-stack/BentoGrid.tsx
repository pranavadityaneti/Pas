"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useHero } from "./HeroContext";
import Image from "next/image";
import { MousePointer2 } from "lucide-react";

const customerContent = [
    { id: "c1", title: "Smart Checkout", desc: "Consolidate your neighborhood orders into one fluid experience.", color: "bg-white", text: "text-black-shadow" },
    { id: "c2", title: "Live Tracking", desc: "Real-time updates as your order is prepared for pick-up.", color: "bg-white", text: "text-black-shadow" },
    { id: "c3", title: "Skip the Queue", desc: "Your order is packed and ready when you arrive.", color: "bg-white", text: "text-black-shadow" },
    { id: "c4", title: "Search Locally", desc: "Find exactly which nearby store has what you need.", color: "bg-white", text: "text-black-shadow" },
    { id: "c5", title: "Pickup at Store", desc: "Order Online, pick up at store securely.", color: "bg-white", text: "text-black-shadow" },
    { id: "c6", title: "5000+ Retail Stores", desc: "From fashion to electronics, shop it all in one place.", color: "bg-white", text: "text-black-shadow" },
];

const merchantContent = [
    { id: "m1", title: "Inventory Manager", desc: "Real-time stock tracking and alerts.", color: "bg-white", text: "text-black-shadow" },
    { id: "m2", title: "Sales Analytics", desc: "Deep insights into performance.", color: "bg-white", text: "text-black-shadow" },
    { id: "m3", title: "Staff Controls", desc: "Manage roles and permissions easily.", color: "bg-white", text: "text-black-shadow" },
    { id: "m4", title: "Order Momentum", desc: "Track consecutive days of high-volume sales.", color: "bg-white", text: "text-black-shadow" },
    { id: "m5", title: "Fast Payouts", desc: "Receive earnings in T+2 days.", color: "bg-white", text: "text-black-shadow" },
    { id: "m6", title: "Verified Vendors", desc: "Join an elite network of 5000+ top retailers.", color: "bg-white", text: "text-black-shadow" },
];

export function BentoGrid() {
    const { state, appMode, setAppMode } = useHero();
    const content = appMode === "customer" ? customerContent : merchantContent;

    return (
        <div className="w-full min-h-screen flex items-center justify-center p-8 bg-[#f8f8fa]">
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-6 w-full h-full max-w-7xl md:max-h-[850px]">
                {/* Row 1 */}
                <BentoCard item={content[0]} className="col-span-1 md:col-span-2 md:row-span-1 h-[300px] md:h-auto">
                    <MockupMultiStore appMode={appMode} />
                </BentoCard>
                <BentoCard item={content[1]} className="col-span-1 md:col-span-2 md:row-span-1 h-[300px] md:h-auto">
                    {appMode === "customer" ? <MockupTracking appMode={appMode} /> : <MockupAnalytics appMode={appMode} />}
                </BentoCard>

                {/* Row 2: CENTERED Switch */}
                <BentoCard item={content[2]} className="col-span-1 md:col-span-1 md:row-span-1 h-[300px] md:h-auto">
                    {appMode === "customer" ? <MockupQueue appMode={appMode} /> : <MockupStaff appMode={appMode} />}
                </BentoCard>

                <motion.div
                    onClick={() => setAppMode(appMode === "customer" ? "merchant" : "customer")}
                    className="col-span-1 md:col-span-2 md:row-span-1 bg-[#B52725] rounded-[3rem] p-10 flex flex-col items-center justify-center text-white cursor-pointer group hover:scale-[1.01] active:scale-[0.99] transition-all duration-500 shadow-2xl relative overflow-hidden h-[300px] md:h-auto order-first md:order-none"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none" />
                    <div className="relative z-10 flex flex-col items-center gap-6">
                        <div className="text-[0.65rem] font-bold tracking-[0.4em] uppercase opacity-70">Switch Mode</div>
                        <div className="text-4xl font-normal text-center tracking-tight font-[family-name:var(--font-dm-sans)]">
                            {appMode === "customer" ? "For Customers" : "For Merchants"}
                        </div>
                        <div className="px-6 py-2.5 rounded-full bg-white text-[#B52725] text-sm font-bold shadow-lg group-hover:bg-white/90 transition-all">
                            Explore {appMode === "customer" ? "Merchant" : "Customer"} Tools
                        </div>
                        <motion.div
                            className="mt-6 text-white/40"
                            animate={{ scale: [1, 1.1, 1], y: [0, 2, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                            <MousePointer2 size={24} className="fill-white/20 rotate-12" />
                        </motion.div>
                    </div>
                </motion.div>

                <BentoCard item={content[3]} className="col-span-1 md:col-span-1 md:row-span-1 h-[300px] md:h-auto">
                    {appMode === "customer" ? <MockupSearch appMode={appMode} /> : <MockupStreak appMode={appMode} />}
                </BentoCard>

                {/* Row 3 */}
                <BentoCard item={content[4]} className="col-span-1 md:col-span-2 md:row-span-1 h-[300px] md:h-auto">
                    {appMode === "customer" ? <MockupCurbside appMode={appMode} /> : <MockupFastPayouts />}
                </BentoCard>
                <BentoCard item={content[5]} className="col-span-1 md:col-span-2 md:row-span-1 h-[300px] md:h-auto">
                    <MockupRetailStores appMode={appMode} />
                </BentoCard>
            </div>
        </div>
    );
}

function BentoCard({ item, className, children }: { item: any; className?: string; children?: React.ReactNode }) {
    return (
        <motion.div
            layout
            className={`rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden border border-black/[0.03] hover:border-black/[0.08] bg-white transition-all duration-500 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] ${className}`}
        >
            <div className="flex-1 relative mb-6">
                {children}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="relative z-10"
                >
                    <h3 className="text-2xl font-bold tracking-tight font-[family-name:var(--font-dm-sans)] text-black-shadow mb-1">{item.title}</h3>
                    <p className="text-sm font-medium text-black-shadow/50 leading-relaxed">{item.desc}</p>
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}

/* --- Visual Mockup Components --- */

function MockupMultiStore({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";

    if (!isCustomer) return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative w-full max-w-[320px] h-32 bg-gray-50/50 rounded-2xl border border-black/[0.03] p-4 flex gap-4 overflow-hidden">
                <div className="w-24 h-full bg-white rounded-xl shadow-sm border border-black/[0.02] flex items-center justify-center">
                    <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m7.5 4.27 9 5.15" />
                            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                            <path d="m3.3 7 8.7 5 8.7-5" />
                            <path d="M12 22V12" />
                        </svg>
                    </div>
                </div>
                <div className="flex-1 flex flex-col justify-center gap-2">
                    <div className="w-2/3 h-2.5 bg-black/10 rounded-full" />
                    <div className="w-full h-2 bg-black/5 rounded-full" />
                    <div className="mt-2 w-16 h-5 rounded-md bg-emerald-500 flex items-center justify-center text-[0.6rem] font-bold text-white uppercase tracking-wider">
                        Inventory
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative w-full max-w-[360px] h-36 flex items-center justify-center">
                {/* Store Cards flying into bag */}
                <motion.div
                    animate={{ x: [0, 40, 0], y: [0, -10, 0], rotate: [-10, -5, -10] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-4 top-4 w-20 h-24 bg-white rounded-xl shadow-lg border border-black/[0.03] p-3 flex flex-col gap-2 z-10"
                >
                    <div className="w-6 h-6 rounded bg-blue-500/10" />
                    <div className="w-full h-1.5 bg-black/5 rounded" />
                    <div className="w-2/3 h-1.5 bg-black/5 rounded" />
                </motion.div>

                <motion.div
                    animate={{ x: [0, -40, 0], y: [0, 10, 0], rotate: [10, 5, 10] }}
                    transition={{ duration: 4, delay: 1, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute right-4 bottom-4 w-20 h-24 bg-white rounded-xl shadow-lg border border-black/[0.03] p-3 flex flex-col gap-2 z-10"
                >
                    <div className="w-6 h-6 rounded bg-amber-500/10" />
                    <div className="w-full h-1.5 bg-black/5 rounded" />
                    <div className="w-2/3 h-1.5 bg-black/5 rounded" />
                </motion.div>

                {/* Central Multi-Store Bag */}
                <div className="relative w-28 h-32 bg-white rounded-[2rem] shadow-2xl border-2 border-[#B52725]/10 flex flex-col items-center justify-center p-4 z-20">
                    <div className="w-12 h-12 bg-[#B52725]/5 rounded-full flex items-center justify-center mb-2">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B52725" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
                        </svg>
                    </div>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <div className="w-2 h-2 rounded-full bg-[#B52725]" />
                    </div>
                </div>
            </div>
        </div>
    );
}

function MockupAnalytics({ appMode }: { appMode: string }) {
    return (
        <div className="absolute inset-0 flex flex-col p-5 overflow-hidden">
            {/* Background Dot Mesh */}
            <div className="absolute inset-x-0 bottom-0 top-10 opacity-[0.04] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle, black 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

            {/* Top Row: Label + Growth + Dropdown */}
            <div className="relative z-10 flex justify-between items-start">
                <div className="text-base font-bold text-black-shadow tracking-tight">Total orders</div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#B52725]/10 text-[#B52725] text-[0.65rem] font-black">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4">
                            <path d="M12 19V5M5 12l7-7 7 7" />
                        </svg>
                        56.4%
                    </div>
                    <div className="flex items-center gap-1 text-[0.65rem] font-black text-black-shadow/20">
                        Past 30 days
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="m6 9 6 6 6-6" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Mid: Stats */}
            <div className="relative z-10 mt-3">
                <div className="text-5xl font-black text-black-shadow tracking-tighter leading-none mb-1">1,054</div>
                <div className="flex items-center gap-1 text-[0.75rem] font-black">
                    <span className="text-[#B52725]">+330</span>
                    <span className="text-black-shadow/20">today</span>
                </div>
            </div>

            {/* Bottom Section: The Graph (Absolute so it spans the width and stays low) */}
            <div className="absolute bottom-0 left-0 right-0 h-1/2 -z-10 pointer-events-none">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                    <defs>
                        <linearGradient id="brand-grad-final" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#B52725" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="#B52725" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {/* Fill Area */}
                    <motion.path
                        d="M 0 40 Q 20 38, 40 32 T 70 15 T 100 5 L 100 40 Z"
                        fill="url(#brand-grad-final)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 1 }}
                    />
                    {/* The Line */}
                    <motion.path
                        d="M 0 40 Q 20 38, 40 32 T 70 15 T 100 5"
                        stroke="#B52725"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        fill="none"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 2, ease: "easeInOut" }}
                    />
                    {/* Indicator Line */}
                    <motion.line
                        x1="70" y1="15" x2="70" y2="40"
                        stroke="#B52725" strokeWidth="1" strokeDasharray="4 4"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.3 }}
                        transition={{ delay: 1.5 }}
                    />
                    {/* Focal point */}
                    <motion.circle
                        cx="70" cy="15" r="3" fill="#B52725"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1.8 }}
                    />
                </svg>

                {/* Tooltip Widget */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 2 }}
                    className="absolute left-[72%] top-[10%] bg-white rounded-xl shadow-2xl border border-black/[0.04] p-3 flex flex-col gap-0.5 z-20 min-w-[100px]"
                >
                    <div className="text-[0.75rem] font-black text-black-shadow">20 total</div>
                    <div className="text-[0.65rem] font-bold text-black-shadow/40">04 Apr, 2025</div>
                </motion.div>
            </div>
        </div>
    );
}


function MockupTracking({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";

    return (
        <div className="absolute inset-0 flex items-center justify-center p-6 overflow-hidden">
            <div className="relative w-full h-[180px] bg-gray-50/50 rounded-[2rem] border border-black/[0.03] flex shadow-inner overflow-hidden">
                {/* Left: Milestone Timeline */}
                <div className="w-1/3 h-full border-r border-black/[0.03] p-4 flex flex-col justify-between relative z-10 bg-white/40 backdrop-blur-sm">
                    <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                        <div className="flex flex-col">
                            <div className="text-[0.5rem] font-bold text-black-shadow uppercase tracking-wider opacity-40">Status</div>
                            <div className="text-[0.6rem] font-bold text-blue-500 truncate">Approved</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full border-2 border-blue-500 bg-white mt-1" />
                        <div className="flex flex-col">
                            <div className="text-[0.5rem] font-bold text-black-shadow uppercase tracking-wider opacity-40">Status</div>
                            <div className="text-[0.6rem] font-bold text-black-shadow truncate">Processing</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500/20 mt-1" />
                        <div className="flex flex-col">
                            <div className="text-[0.5rem] font-bold text-black-shadow uppercase tracking-wider opacity-40">Status</div>
                            <div className="text-[0.6rem] font-bold text-black-shadow/40 truncate">Ready</div>
                        </div>
                    </div>

                    {/* Dashed line connector */}
                    <div className="absolute left-[20px] top-[24px] bottom-[24px] w-[1px] border-l border-dashed border-blue-500/30" />
                </div>

                {/* Right: Map Path Visualization */}
                <div className="flex-1 h-full relative p-4 bg-white/20">
                    {/* Animated Path */}
                    <svg className="absolute inset-0 w-full h-full p-4" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <motion.path
                            d="M 10 90 C 10 50, 40 50, 40 10 L 90 10"
                            stroke="#3b82f6"
                            strokeWidth="8"
                            strokeLinecap="round"
                            fill="none"
                            initial={{ pathLength: 0, opacity: 0.2 }}
                            animate={{ pathLength: 1, opacity: 0.2 }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                        />
                        <motion.path
                            d="M 10 90 C 10 50, 40 50, 40 10 L 90 10"
                            stroke="#3b82f6"
                            strokeWidth="8"
                            strokeLinecap="round"
                            fill="none"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 0.6 }}
                            transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                        />
                    </svg>

                    {/* Navigation Pointer (Arrow) */}
                    <motion.div
                        className="absolute z-20"
                        animate={{
                            left: ["15%", "45%"],
                            top: ["85%", "40%"],
                            rotate: [-45, 0]
                        }}
                        transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
                    >
                        <div className="relative">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-blue-600 drop-shadow-lg">
                                <path d="M12 2L4.5 20.29L5.21 21L12 18L18.79 21L19.5 20.29L12 2Z" fill="currentColor" />
                            </svg>
                            <div className="absolute inset-0 bg-blue-400 blur-md opacity-40 -z-10 animate-pulse" />
                        </div>
                    </motion.div>

                    {/* Floating Label */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="absolute right-4 top-4 bg-white rounded-lg shadow-sm border border-black/[0.03] px-2 py-1 flex items-center gap-2"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-[#B52725] animate-pulse" />
                        <span className="text-[0.5rem] font-bold text-black-shadow">LIVE</span>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

function MockupRetailStores({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";
    const brands = [
        { id: 2, name: "NIKE", color: "bg-black text-white" },
        { id: 7, name: "SONY", color: "bg-[#1f1f1f] text-white" },
        { id: 9, name: "KODAK", color: "bg-[#ffb800] text-red-600" },
        { id: 14, name: "Leica", color: "bg-[#e20613] text-white" },
        { id: 16, name: "Panasonic", color: "bg-[#00429d] text-white text-[8px]" },
    ];

    return (
        <div className="absolute inset-x-0 -top-4 bottom-0 flex items-center justify-center p-8 overflow-hidden">
            <div className="grid grid-cols-6 grid-rows-3 gap-4 w-full max-w-[500px]">
                {Array.from({ length: 18 }).map((_, i) => {
                    const brand = brands.find(b => b.id === i);
                    return (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.01 }}
                            className={`aspect-square rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-black/[0.02] flex items-center justify-center p-2 text-[9px] font-black tracking-tighter transition-all duration-500 overflow-hidden
                                ${brand ? brand.color : 'bg-white/40'}
                            `}
                        >
                            {brand && <span className="text-center leading-none">{brand.name}</span>}
                        </motion.div>
                    );
                })}
            </div>

            {/* Soft fade to bottom */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-white/50 to-transparent pointer-events-none z-10" />
        </div>
    );
}

function MockupWallet({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 gap-4">
            <div className={`w-full h-28 ${isCustomer ? 'bg-black' : 'bg-[#B52725]'} rounded-2xl shadow-xl p-4 flex flex-col justify-between overflow-hidden relative`}>
                <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-white/5 rounded-full" />
                <div className="flex justify-between items-start">
                    <div className="text-[0.4rem] font-bold text-white/40 uppercase tracking-[0.2em]">{isCustomer ? 'Balance' : 'Payouts'}</div>
                    <div className="w-8 h-5 bg-white/10 rounded-md" />
                </div>
                <div className="text-xl font-bold text-white tracking-tight">{isCustomer ? '$1,240.50' : '$8,502.20'}</div>
            </div>
        </div>
    );
}

function MockupStreak({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";

    return (
        <div className="relative flex flex-col items-start pt-4">
            {/* Middle: Big Stat */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-7xl font-black tracking-tighter text-[#B52725] leading-none">
                    {isCustomer ? "14" : "92"}
                </span>
                <div className="flex flex-col">
                    <span className="text-[0.8rem] font-black text-black-shadow leading-tight">DAYS</span>
                    <span className="text-[0.8rem] font-bold text-black-shadow opacity-40 leading-tight">IN A ROW</span>
                </div>
            </div>

            {/* Bottom: Dot Matrix (Tightly packed and moved up) */}
            <div className="grid grid-cols-7 gap-1.5 w-fit">
                {Array.from({ length: 14 }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className={`w-2.5 h-2.5 rounded-full
                            ${i < (isCustomer ? 14 : 12) ? 'bg-[#B52725]' : 'bg-black/[0.04]'}
                        `}
                    />
                ))}
            </div>
        </div>
    );
}

function MockupInbox({ appMode }: { appMode: string }) {
    return null; // Deprecated
}

function MockupQueue({ appMode }: { appMode: string }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden">
            <div className="relative w-full h-32 bg-white rounded-2xl border border-black/[0.03] shadow-lg flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20" />

                {/* Lane Dividers */}
                <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full border-r border-dashed border-black/5 bg-gray-50/50" />
                    <div className="w-1/2 h-full bg-[#B52725]/[0.02]" />
                </div>

                {/* Left Lane: Slow Queue */}
                <div className="absolute left-[15%] top-0 bottom-0 flex flex-col items-center justify-center gap-2 opacity-40">
                    <div className="text-[0.5rem] font-bold uppercase tracking-widest text-black-shadow/60 mb-1">Queue</div>
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="w-8 h-2 bg-gray-300 rounded-full" />
                    ))}
                    <div className="w-8 h-2 bg-gray-300 rounded-full opacity-50" />
                </div>

                {/* Right Lane: Fast Track */}
                <div className="absolute right-[15%] top-0 bottom-0 flex flex-col items-center justify-center">
                    <div className="text-[0.5rem] font-bold uppercase tracking-widest text-[#B52725] mb-2 flex items-center gap-1">
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                        </svg>
                        Fast Track
                    </div>

                    <motion.div
                        animate={{ y: [40, -40] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        className="relative z-10"
                    >
                        <div className="w-8 h-12 bg-[#B52725] rounded-lg shadow-lg flex items-center justify-center">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 6L9 17l-5-5" />
                            </svg>
                        </div>
                        {/* Speed lines */}
                        <div className="absolute top-full left-0 right-0 flex justify-center gap-1 mt-1">
                            <div className="w-0.5 h-4 bg-[#B52725]/20 rounded-full" />
                            <div className="w-0.5 h-6 bg-[#B52725]/40 rounded-full" />
                            <div className="w-0.5 h-4 bg-[#B52725]/20 rounded-full" />
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}

function MockupSearch({ appMode }: { appMode: string }) {
    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 overflow-hidden">
            {/* Map Background */}
            <div className="absolute inset-0 opacity-20 filter grayscale contrast-125">
                <svg width="100%" height="100%">
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1" />
                    </pattern>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
            </div>

            <div className="relative w-full max-w-[280px] bg-white rounded-xl shadow-xl border border-black/[0.04] p-3 flex flex-col gap-3 z-10">
                {/* Search Bar */}
                <div className="w-full h-8 bg-gray-50 rounded-lg border border-black/[0.03] flex items-center px-3 gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-400">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <div className="text-[10px] text-gray-400 font-medium">Headphones near me...</div>
                </div>

                {/* Results */}
                <div className="flex flex-col gap-2">
                    {[1, 2].map((i) => (
                        <div key={i} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-50 transition-colors">
                            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center">
                                <div className="w-4 h-4 rounded-full bg-gray-300" />
                            </div>
                            <div className="flex flex-col">
                                <div className="w-20 h-2 bg-gray-800 rounded-full mb-1" />
                                <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
                            </div>
                            <div className="ml-auto text-[10px] font-bold text-[#B52725]">0.8 km</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Location Pin */}
            <motion.div
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="absolute top-1/2 right-4 w-8 h-8 bg-[#B52725] rounded-full flex items-center justify-center text-white shadow-lg z-20"
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
            </motion.div>
        </div>
    );
}

function MockupFastPayouts() {
    return (
        <div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden">
            <div className="w-full bg-gray-50/80 rounded-2xl p-3 flex flex-col gap-2">
                {/* Header row */}
                <div className="flex justify-between items-center">
                    <div className="text-[0.55rem] font-bold text-black-shadow/40 uppercase tracking-widest">Settlement</div>
                    <div className="text-[0.55rem] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">T+2 Days</div>
                </div>
                {/* Amount */}
                <div className="text-2xl font-black text-black-shadow tracking-tight">₹8,502</div>
                {/* Timeline */}
                <div className="flex items-center gap-1">
                    {["Order", "T+1", "Bank"].map((step, i) => (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center gap-0.5">
                                <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[0.45rem] font-bold ${i < 2 ? 'bg-[#B52725] text-white' : 'bg-gray-200 text-black-shadow/30'
                                    }`}>
                                    {i < 2 ? '✓' : ''}
                                </div>
                                <div className="text-[0.45rem] text-black-shadow/40 font-bold whitespace-nowrap">{step}</div>
                            </div>
                            {i < 2 && <div className={`flex-1 h-0.5 mb-3 ${i === 0 ? 'bg-[#B52725]' : 'bg-gray-200'}`} />}
                        </React.Fragment>
                    ))}
                </div>
                {/* Bank row */}
                <div className="flex items-center gap-2 bg-white rounded-xl p-2 border border-black/[0.04] shadow-sm">
                    <div className="w-6 h-6 bg-[#B52725]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#B52725" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[0.5rem] font-bold text-black-shadow/40 uppercase tracking-wider">Credited to</div>
                        <div className="text-[0.65rem] font-bold text-black-shadow">HDFC ·· 4821</div>
                    </div>
                    <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"
                    />
                </div>
            </div>
        </div>
    );
}

function MockupStaff({ appMode }: { appMode: string }) {
    const staff = [
        { initials: "RS", name: "Rahul S.", role: "Manager", color: "bg-blue-500", active: true },
        { initials: "PM", name: "Priya M.", role: "Cashier", color: "bg-purple-500", active: true },
        { initials: "AK", name: "Arjun K.", role: "Inventory", color: "bg-amber-500", active: false },
    ];
    return (
        <div className="absolute inset-0 flex flex-col justify-center px-3 gap-1.5 overflow-hidden">
            {staff.map((s, i) => (
                <motion.div
                    key={s.name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-2 bg-gray-50/80 rounded-xl p-2 border border-black/[0.03]"
                >
                    <div className={`w-7 h-7 ${s.color} rounded-full flex items-center justify-center text-white text-[0.55rem] font-bold flex-shrink-0`}>
                        {s.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[0.65rem] font-bold text-black-shadow truncate">{s.name}</div>
                        <div className="text-[0.5rem] text-black-shadow/40 font-medium">{s.role}</div>
                    </div>
                    {/* Toggle */}
                    <div className={`w-8 h-[18px] rounded-full flex items-center px-0.5 transition-colors flex-shrink-0 ${s.active ? 'bg-[#B52725] justify-end' : 'bg-gray-200 justify-start'
                        }`}>
                        <div className="w-3.5 h-3.5 bg-white rounded-full shadow-sm" />
                    </div>
                </motion.div>
            ))}
        </div>
    );
}

function MockupCurbside({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";

    return (
        <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="relative w-full max-w-[400px] h-32 flex flex-col justify-center">
                {/* Visualizing a car in a designated slot */}
                <div className="w-full h-12 bg-gray-100/50 rounded-xl border border-dashed border-black/10 flex items-center justify-around px-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="w-16 h-8 rounded bg-black/5" />
                    ))}
                </div>

                <motion.div
                    initial={{ x: -100, opacity: 0 }}
                    animate={{ x: 106, opacity: 1 }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                    className="absolute left-0 top-[34px] w-20 h-10 bg-[#B52725] rounded-lg shadow-xl flex items-center justify-center text-white"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                        <circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" />
                    </svg>

                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.2, 1] }}
                        transition={{ delay: 2.5, duration: 0.5 }}
                        className="absolute -top-6 -right-2 w-6 h-6 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-[10px]"
                    >
                        ✓
                    </motion.div>
                </motion.div>

                <div className="mt-8 flex items-center justify-center gap-2">
                    <div className="text-[0.6rem] font-bold uppercase tracking-widest text-[#B52725]">Ready for Pickup</div>
                    <div className="w-1.5 h-1.5 rounded-full bg-[#B52725] animate-pulse" />
                </div>
            </div>
        </div>
    );
}

function MockupPhone({ appMode }: { appMode: string }) {
    const isCustomer = appMode === "customer";
    return (
        <div className="absolute inset-0 flex items-end justify-center px-10">
            <div className="w-full h-32 bg-gray-900 rounded-t-[2.5rem] border-x-[6px] border-t-[6px] border-black p-4 relative overflow-hidden">
                <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />
                <div className="grid grid-cols-2 gap-3">
                    <div className="h-20 bg-white/5 rounded-xl border border-white/10 p-2">
                        <div className="w-2/3 h-1.5 bg-white/20 rounded-full mb-1" />
                        <div className="w-full h-1 bg-white/5 rounded-full" />
                    </div>
                    <div className="h-20 bg-white/5 rounded-xl border border-white/10 p-2">
                        <div className="w-2/3 h-1.5 bg-white/20 rounded-full mb-1" />
                        <div className="w-full h-1 bg-white/5 rounded-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}
