"use client";

import { motion, useScroll, useTransform, useMotionValue, useAnimationFrame } from "framer-motion";
import { useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const cards = [
    { id: 1, src: "/carousel/no-price-hikes.jpg", label: "No Price Hikes" },
    { id: 2, src: "/carousel/no-hidden-charges.jpg", label: "No Hidden Charges" },
    { id: 3, src: "/carousel/primedine-bookings.jpg", label: "PrimeDine Bookings" },
    { id: 4, src: "/carousel/takeaways-digitised.jpg", label: "Takeaways Digitised" },
    { id: 5, src: "/carousel/discoverability.jpg", label: "Discoverability" },
    { id: 6, src: "/carousel/no-delivery-fee.jpg", label: "No Delivery Fee" },
    { id: 7, src: "/carousel/all-in-one-platform.jpg", label: "All-in-One Platform" },
    { id: 8, src: "/carousel/instant-returns.jpg", label: "Instant Returns, Fastest Refund" },
];

// Duplicate cards for infinite loop effect
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

        // Reset buffer based on 8 card count
        if (newX <= -2400) {
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
                    <CarouselItem key={`${card.id}-${index}`} src={card.src} label={card.label} index={index} containerRef={containerRef} />
                ))}
            </motion.div>
        </div>
    );
}

function CarouselItem({ src, label, index, containerRef }: { src: string, label: string, index: number, containerRef: React.RefObject<HTMLDivElement | null> }) {
    const cardRef = useRef<HTMLDivElement>(null);
    const rotateY = useMotionValue(0);
    const zDepth = useMotionValue(0);

    useAnimationFrame(() => {
        if (!cardRef.current || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const cardRect = cardRef.current.getBoundingClientRect();

        const containerCenter = containerRect.left + containerRect.width / 2;
        const cardCenter = cardRect.left + cardRect.width / 2;
        const distanceFromCenter = cardCenter - containerCenter;

        const rotation = distanceFromCenter / -25;
        const clampedRotation = Math.max(-45, Math.min(45, rotation));

        rotateY.set(clampedRotation);
        zDepth.set(Math.abs(clampedRotation) * -2);
    });

    return (
        // whileHover uses Framer Motion's own pointer listeners — not React synthetic events
        // so it fires reliably on all continuously-animated cards
        <motion.div
            ref={cardRef}
            style={{ rotateY, z: zDepth }}
            className="relative shrink-0 w-[280px] h-[360px] md:w-[320px] md:h-[420px] rounded-3xl overflow-hidden bg-white cursor-pointer"
            whileHover="hovered"
            initial="normal"
        >
            <motion.div
                className="absolute inset-0"
                variants={{
                    normal: { filter: "grayscale(0) contrast(1)", scale: 1 },
                    hovered: { filter: "grayscale(0) contrast(1)", scale: 1.05 },
                }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                <Image
                    src={src}
                    alt={label}
                    fill
                    className="object-cover"
                />
            </motion.div>
        </motion.div>
    );
}
