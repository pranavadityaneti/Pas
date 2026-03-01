"use client";

import { motion } from "framer-motion";
import { useHero } from "./HeroContext";
import Image from "next/image";

// 7 Cards Total = 1 Main + 6 Background
// Abstract 3D Gradient / "Nano Banana" style
const cards = [
    // Left Side
    { id: 1, src: "/local_pharmacy_wellness_1771315842799.png", rotate: -22, x: -380, y: 15, zIndex: 30 },
    { id: 2, src: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=800&auto=format&fit=crop", rotate: -15, x: -250, y: 5, zIndex: 35 },
    { id: 3, src: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop", rotate: -8, x: -120, y: -5, zIndex: 40 },

    // Right Side
    { id: 4, src: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=800&auto=format&fit=crop", rotate: 8, x: 120, y: -5, zIndex: 40 },
    { id: 5, src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=800&auto=format&fit=crop", rotate: 15, x: 250, y: 5, zIndex: 35 },
    { id: 6, src: "/urban_shopping_street_1771315862827.png", rotate: 22, x: 380, y: 15, zIndex: 30 },
];

export function FanStack() {
    const { state } = useHero();

    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {cards.map((card, index) => (
                <motion.div
                    key={card.id}
                    className="absolute w-[220px] h-[300px] md:w-[280px] md:h-[380px] rounded-[30px] md:rounded-[40px] overflow-hidden shadow-xl border-[6px] border-white bg-white"
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
                        y: state === "fan" ? card.y + 40 : (state === "descend" || state === "spread") ? (state === "spread" ? -80 + (index * 60) : 380) : 0,

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
