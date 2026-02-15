"use client";

import { motion } from "framer-motion";
import { useHero } from "./HeroContext";
import Image from "next/image";

// 7 Cards Total = 1 Main + 6 Background
// Abstract 3D Gradient / "Nano Banana" style
const cards = [
    // Left Side
    { id: 1, src: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=800&auto=format&fit=crop", rotate: -25, x: -380, y: 60, zIndex: 30 }, // Blue/Purple abstract
    { id: 2, src: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop", rotate: -15, x: -240, y: 20, zIndex: 35 }, // Replaced broken link (Gradient fluid)
    { id: 3, src: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?q=80&w=800&auto=format&fit=crop", rotate: -6, x: -110, y: -5, zIndex: 40 }, // Soft sphere

    // Right Side
    { id: 4, src: "https://images.unsplash.com/photo-1620121692029-d088224ddc74?q=80&w=800&auto=format&fit=crop", rotate: 8, x: 130, y: 0, zIndex: 40 }, // Iridescent
    { id: 5, src: "https://images.unsplash.com/photo-1614850523060-8da1d56ae167?q=80&w=800&auto=format&fit=crop", rotate: 18, x: 260, y: 30, zIndex: 35 }, // Neon fluid
    { id: 6, src: "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=800&auto=format&fit=crop", rotate: 28, x: 400, y: 80, zIndex: 30 }, // Holographic
];

export function FanStack() {
    const { state } = useHero();

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {cards.map((card, index) => (
                <motion.div
                    key={card.id}
                    className="absolute w-[320px] h-[320px] rounded-[40px] overflow-hidden shadow-xl border-[6px] border-white bg-white"
                    initial={{
                        scale: 0.6,
                        opacity: 0,
                        x: 0,
                        y: 0,
                        rotate: 0,
                    }}
                    style={{ zIndex: state === "spread" ? 10 + index : card.zIndex }} // Stacking order
                    animate={{
                        scale: state === "intro" ? 0.6 : state === "fan" ? 1 : (state === "descend" || state === "spread") ? 1.0 : 0.95, // Full size
                        opacity: state === "intro" ? 0 : 1,

                        // X Position: Broader spread
                        x: state === "fan" ? card.x : state === "spread" ? -40 + (index * 85) : 0,

                        // Y Position: Steeper/Longer Diagonal Down
                        // Starts higher (-80) and goes down deeper spacing
                        y: state === "fan" ? card.y : (state === "descend" || state === "spread") ? (state === "spread" ? -80 + (index * 60) : 320) : 0,

                        // Rotation: Gentle fan
                        rotate: state === "fan" ? card.rotate : state === "spread" ? -5 + (index * 3) : 0,
                    }}
                    transition={{
                        type: "spring",
                        stiffness: 60,
                        damping: 15,
                        delay: state === "intro" ? 0 : 0.05 + (index * 0.03),
                    }}
                >
                    <Image
                        src={card.src}
                        alt="Showcase"
                        fill
                        className="object-cover"
                    />
                </motion.div>
            ))}
        </div>
    );
}
