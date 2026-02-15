"use client";

import { motion } from "framer-motion";
import { useHero } from "./HeroContext";
import Image from "next/image";

export function MainCard() {
    const { state } = useHero();

    return (
        <motion.div
            layoutId="main-card-container"
            className="relative z-50 flex items-center justify-center"
            initial={{ scale: 0.6, opacity: 0, y: 1000, rotateX: 30 }}
            animate={{
                scale: state === "intro" ? 1 : state === "fan" ? 1 : (state === "spread" || state === "descend") ? 1.0 : 1, // Full size
                opacity: 1,
                // Spread: Diagonal Down (Bottom Right) - Extended
                y: (state === "descend" || state === "spread") ? 320 : 0,
                x: state === "spread" ? 500 : 0,
                rotateX: 0,
                rotate: state === "spread" ? 12 : 0,
                zIndex: 100 // Topmost
            }}
            transition={{
                type: "spring",
                stiffness: 50,
                damping: 18,
                mass: 1.2,
                delay: 0.2
            }}
        >
            <div className="relative w-[320px] h-[320px] rounded-[40px] overflow-hidden shadow-2xl border-[6px] border-white bg-white">
                <Image
                    src="https://images.unsplash.com/photo-1633511090164-b43840ea1607?q=80&w=800&auto=format&fit=crop"
                    alt="Main Card"
                    fill
                    className="object-cover"
                />
            </div>
        </motion.div>
    );
}
