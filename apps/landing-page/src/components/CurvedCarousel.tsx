"use client";

import { motion, useScroll, useTransform, useMotionValue, useAnimationFrame } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const cards = [
    { id: 1, src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=60" },
    { id: 2, src: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=500&auto=format&fit=crop&q=60" },
    { id: 3, src: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=500&auto=format&fit=crop&q=60" },
    { id: 4, src: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=500&auto=format&fit=crop&q=60" },
    { id: 5, src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=60" },
    { id: 6, src: "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=500&auto=format&fit=crop&q=60" },
    { id: 7, src: "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=500&auto=format&fit=crop&q=60" },
];

// Duplicate cards for infinite effect
const infiniteCards = [...cards, ...cards, ...cards];

export function CurvedCarousel() {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollX = useMotionValue(0);

    // Auto-scroll logic
    useAnimationFrame((time, delta) => {
        // Move 0.5px per frame for smooth 60fps
        const moveBy = 0.5 * (delta / 16);
        // Reset when we've scrolled past the first set width (approx)
        // For now simple infinite scrolling
        let newX = scrollX.get() - moveBy;

        // A rough reset mechanism - in a real app create a windowing system or seamless loop
        // forcing a large enough reset buffer
        if (newX <= -2000) {
            newX = 0;
        }
        scrollX.set(newX);
    });

    return (
        <div
            ref={containerRef}
            className="relative w-full overflow-hidden py-20 perspective-1000"
            style={{ perspective: "1000px" }}
        >
            <motion.div
                className="flex gap-8 pl-[50vw]" // Start from center-ish
                style={{ x: scrollX, transformStyle: "preserve-3d" }}
            >
                {infiniteCards.map((card, index) => (
                    <CarouselItem key={`${card.id}-${index}`} src={card.src} index={index} containerRef={containerRef} />
                ))}
            </motion.div>
        </div>
    );
}

function CarouselItem({ src, index, containerRef }: { src: string, index: number, containerRef: React.RefObject<HTMLDivElement | null> }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const [rotateY, setRotateY] = useState(0);

    useAnimationFrame(() => {
        if (!cardRef.current || !containerRef.current) return;

        // Calculate position relative to the viewport center
        const containerRect = containerRef.current.getBoundingClientRect();
        const cardRect = cardRef.current.getBoundingClientRect();

        // Center logic
        const containerCenter = containerRect.left + containerRect.width / 2;
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distanceFromCenter = cardCenter - containerCenter;

        // Calculate rotation: Cards to the left rotate Positive, Right rotate Negative (to face inward)
        // Adjust sensitivity divisor (e.g., / 20) to change "curvature" amount
        const rotation = distanceFromCenter / -25;

        // Clamp rotation to avoid extreme angles off-screen
        const clampedRotation = Math.max(-45, Math.min(45, rotation));

        setRotateY(clampedRotation);
    });

    return (
        <motion.div
            ref={cardRef}
            style={{
                rotateY,
                z: Math.abs(rotateY) * -2, // Push back edges slightly for depth
            }}
            className="relative group shrink-0 w-[280px] h-[360px] md:w-[320px] md:h-[420px] rounded-3xl overflow-hidden transition-transform duration-300 ease-out hover:scale-105 hover:z-10 bg-white"
        >
            {/* Image in Grayscale */}
            <div className="absolute inset-0 grayscale contrast-125 group-hover:grayscale-0 transition-all duration-500">
                <Image
                    src={src}
                    alt="Creator"
                    fill
                    className="object-cover"
                />
            </div>

            {/* Red Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-red-500/80 via-transparent to-transparent opacity-60 mix-blend-multiply pointer-events-none" />
        </motion.div>
    );
}
