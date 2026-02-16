"use client";

import Image from "next/image";
import { SwipeableCardStack } from "./SwipeableCardStack";
import { motion } from "framer-motion";

export function MobileHero() {
    return (
        <div className="flex bg-vista-white flex-col items-center justify-center pt-32 px-6 pb-20 text-center md:hidden h-auto min-h-screen">
            {/* Logo */}
            <div className="mb-12">
                <Image
                    src="/PAS_AppLauncherIcon-Mono_Red.png"
                    alt="Pick At Store Logo"
                    width={60}
                    height={60}
                    className="object-contain"
                    priority
                />
            </div>

            {/* Headline */}
            <h1 className="text-5xl font-normal tracking-tight text-black-shadow font-[family-name:var(--font-dm-sans)] mb-8 leading-[1.1]">
                Skip the <span className="text-store-red font-medium">Queue</span>. <br /> Shop <span className="text-location-yellow-120 font-medium">Local</span>.
            </h1>

            {/* Subtext */}
            <p className="text-lg text-black-shadow/70 leading-relaxed max-w-sm mx-auto mb-10">
                The ultimate convenience for your daily needs. Order from your favorite neighborhood stores and pick at store in minutes.
            </p>

            {/* CTAs */}
            <div className="flex flex-col w-full gap-4 mb-16">
                <button className="w-full py-4 bg-black text-white rounded-full font-semibold shadow-lg active:scale-95 transition-transform">
                    Join as a partner
                </button>
            </div>

            {/* Swipeable Card Stack */}
            <div className="w-full flex flex-col items-center mt-8 touch-none">
                <SwipeableCardStack />
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1, duration: 1 }}
                    className="flex items-center gap-2 mt-10"
                >
                    <p className="text-xs font-medium text-black-shadow/40 tracking-widest uppercase animate-pulse">
                        &larr; Swipe to explore &rarr;
                    </p>
                </motion.div>
            </div>
        </div>
    );
}
