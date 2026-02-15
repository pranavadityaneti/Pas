"use client";

import { motion, useScroll, useTransform, useMotionValue, useAnimationFrame } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const cards = [
    { id: 1, src: "https://images.unsplash.com/photo-1604719312566-b7cb33746955?w=500&auto=format&fit=crop&q=60" }, // Shopping bag
    { id: 2, src: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=500&auto=format&fit=crop&q=60" }, // Grocery store
    { id: 3, src: "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=500&auto=format&fit=crop&q=60" }, // Market
    { id: 4, src: "https://images.unsplash.com/photo-1601599967104-18c79870ea41?w=500&auto=format&fit=crop&q=60" }, // Coffee to go
    { id: 5, src: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60" }, // Fresh produce
    { id: 6, src: "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=500&auto=format&fit=crop&q=60" }, // Payment
    { id: 7, src: "https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?w=500&auto=format&fit=crop&q=60" }, // Storefront
    { id: 8, src: "https://images.unsplash.com/photo-1506617516198-48f39545cdeb?w=500&auto=format&fit=crop&q=60" }, // Happy customer
    { id: 9, src: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&auto=format&fit=crop&q=60" }, // Clothes
    { id: 10, src: "https://images.unsplash.com/photo-1534452203293-494d7ddbf7e0?w=500&auto=format&fit=crop&q=60" }, // Shopping
];

// Duplicate cards for infinite effect (tripled for smoothness)
const infiniteCards = [...cards, ...cards, ...cards];

export function CurvedCarousel() {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollX = useMotionValue(0);

    // Auto-scroll logic
    useAnimationFrame((time, delta) => {
        // Move faster: 1.0px per frame (was 0.5)
        const moveBy = 1.2 * (delta / 16);
        // Reset when we've scrolled past the first set width (approx)
        let newX = scrollX.get() - moveBy;

        // Reset buffer based on increased card count
        if (newX <= -3000) {
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
