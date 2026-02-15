"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="w-full bg-vista-white flex flex-col items-center pt-32 pb-0 overflow-hidden relative">
            {/* Text Section (Fly.io Style) */}
            <div className="max-w-3xl px-8 mb-20 relative z-10">
                <div className="text-[1.8rem] md:text-[2.2rem] text-black-shadow leading-[1.3] font-medium tracking-tight">
                    <span className="font-bold">Here's what we bring to the table:</span> the most powerful hyper-local engine
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1 bg-white border border-black/[0.05] rounded-md shadow-sm align-middle -mt-1">
                        🏪
                    </span>
                    for modern commerce. <span className="font-bold text-store-red">Pas Stores</span> are digital storefronts
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1 bg-white border border-black/[0.05] rounded-md shadow-sm align-middle -mt-1">
                        🌐
                    </span>
                    running on our unified retail platform, that update in real-time
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 mx-1 bg-white border border-black/[0.05] rounded-md shadow-sm align-middle -mt-1">
                        ⏳
                    </span>
                    and manage fulfillments exactly how you need them to — from a single pickup to a city-wide franchise.
                    <br /><br />
                    <span className="font-bold">What you bring is: almost everything else.</span>
                </div>
            </div>

            {/* Illustration Section */}
            <div className="w-full h-[400px] relative pointer-events-none select-none">
                {/* Hills/Clouds behind */}
                <div className="absolute inset-x-0 bottom-0 h-full flex items-end justify-center pointer-events-none opacity-40">
                    <svg width="1200" height="300" viewBox="0 0 1200 300" fill="none" className="w-[120%] h-auto -mb-10">
                        <path d="M0 300 C 200 200 400 300 600 250 C 800 200 1000 300 1200 250 L 1200 300 L 0 300 Z" fill="#f0edf0" />
                        <path d="M-200 300 C 100 250 300 350 500 280 C 700 210 900 320 1100 270 L 1100 300 L -200 300 Z" fill="#e8e5e8" />
                    </svg>
                </div>

                {/* Main Illustration Elements */}
                <div className="absolute inset-x-0 bottom-0 h-full flex items-end justify-between px-[5%]">

                    {/* Left Side: Lighthouse & Houses */}
                    <div className="relative h-64 w-64 flex items-end">
                        {/* Lighthouse */}
                        <motion.div
                            className="absolute left-0 bottom-0 w-16 h-48 bg-gray-100 rounded-t-full flex flex-col items-center"
                            style={{ clipPath: 'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)' }}
                        >
                            <div className="w-full h-8 bg-black/20 mt-4 border-y border-black/10" />
                            <div className="w-full h-8 bg-black/20 mt-8 border-y border-black/10" />
                            <div className="w-10 h-10 bg-yellow-100 rounded-full mt-auto mb-20 flex items-center justify-center overflow-hidden">
                                <motion.div
                                    className="w-20 h-2 bg-yellow-400 rotate-45 blur-md"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                />
                            </div>
                        </motion.div>

                        {/* Small Houses */}
                        <div className="ml-16 mb-4 flex gap-2">
                            <div className="w-10 h-12 bg-store-red rounded-t-md relative">
                                <div className="absolute top-[-8px] left-[-2px] right-[-2px] h-4 bg-orange-900" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
                                <div className="absolute left-3 bottom-0 w-3 h-4 bg-black/20" />
                            </div>
                            <div className="w-12 h-16 bg-blue-100 rounded-t-lg relative">
                                <div className="absolute top-[-10px] left-[-2px] right-[-2px] h-5 bg-blue-900" style={{ clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)' }} />
                                <div className="absolute left-4 bottom-2 w-4 h-4 bg-black/10 grid grid-cols-2 gap-1 p-0.5">
                                    <div className="bg-white/50" />
                                    <div className="bg-white/50" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Bridge & Windmills */}
                    <div className="relative flex-1 h-full flex flex-col items-center justify-end overflow-visible">
                        {/* Windmills */}
                        <div className="flex gap-20 absolute top-20">
                            {[0.5, 0.8, 0.6].map((scale, i) => (
                                <div key={i} className="flex flex-col items-center" style={{ transform: `scale(${scale})` }}>
                                    <div className="relative w-2 h-32 bg-gray-200 rounded-full">
                                        <motion.div
                                            className="absolute -top-6 -left-12 w-24 h-24 flex items-center justify-center"
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 4 + i, repeat: Infinity, ease: "linear" }}
                                        >
                                            <div className="w-1 h-24 bg-gray-300 rounded-full absolute" />
                                            <div className="w-24 h-1 bg-gray-300 rounded-full absolute" />
                                            <div className="w-4 h-4 bg-gray-100 rounded-full z-10 shadow-sm border border-gray-200" />
                                        </motion.div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bridge */}
                        <div className="w-full h-20 relative flex items-center justify-center mb-[-10px]">
                            {/* Bridge Structure */}
                            <div className="absolute bottom-0 w-full h-1 bg-gray-300" />
                            <div className="absolute bottom-0 w-full h-12 flex justify-around">
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="w-1 h-12 bg-gray-200" style={{ clipPath: 'ellipse(100% 100% at 50% 0%)' }} />
                                ))}
                            </div>

                            {/* Animated Cars */}
                            <motion.div
                                className="flex gap-12 absolute bottom-2"
                                animate={{ x: [-1000, 1000] }}
                                transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                            >
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className={`w-8 h-4 rounded-t-md relative ${i % 2 === 0 ? 'bg-store-red' : 'bg-black'}`}>
                                        <div className="absolute bottom-[-1px] left-1 w-1.5 h-1.5 rounded-full bg-gray-800" />
                                        <div className="absolute bottom-[-1px] right-1 w-1.5 h-1.5 rounded-full bg-gray-800" />
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    </div>

                    {/* Right Side: Monorail & Modern Buildings */}
                    <div className="relative h-64 w-64 flex items-end justify-end">
                        {/* Modern Building */}
                        <div className="w-20 h-48 bg-white/60 backdrop-blur-sm border-x border-t border-black/[0.05] rounded-t-3xl flex flex-col gap-2 p-4 mr-8">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="flex gap-1 justify-between">
                                    <div className="flex-1 h-3 bg-blue-100/50 rounded-sm" />
                                    <div className="flex-1 h-3 bg-blue-100/50 rounded-sm" />
                                </div>
                            ))}
                        </div>

                        {/* Monorail track */}
                        <div className="absolute right-[-10%] bottom-32 w-48 h-1 bg-gray-200 rotate-[-15deg]">
                            <motion.div
                                className="w-16 h-3 bg-gray-900 rounded-full absolute -top-1"
                                animate={{ left: ["-50%", "150%"] }}
                                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                            >
                                <div className="absolute inset-0 flex justify-around items-center px-1">
                                    <div className="w-3 h-1 bg-white/20 rounded-full" />
                                    <div className="w-3 h-1 bg-white/20 rounded-full" />
                                </div>
                            </motion.div>
                        </div>
                    </div>

                </div>

                {/* Final Foreground Grass/Coast line */}
                <div className="absolute inset-x-0 bottom-0 h-10 bg-vista-white border-t border-black/[0.03] z-20" />
            </div>

            {/* Basic Links Footer */}
            <div className="w-full bg-white border-t border-black/[0.03] py-8 px-10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-30">
                <div className="flex items-center gap-6">
                    <Image
                        src="/PAS_AppLauncherIcon-Mono_Red.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="grayscale opacity-50"
                    />
                    <p className="text-sm text-black-shadow/40 font-medium">© 2026 Pick At Store Corp.</p>
                </div>

                <div className="flex gap-8 text-sm font-bold text-black-shadow/60">
                    <a href="#" className="hover:text-store-red transition-colors">Privacy</a>
                    <a href="#" className="hover:text-store-red transition-colors">Terms</a>
                    <a href="#" className="hover:text-store-red transition-colors">Twitter</a>
                    <a href="#" className="hover:text-store-red transition-colors">Instagram</a>
                </div>
            </div>
        </footer>
    );
}
