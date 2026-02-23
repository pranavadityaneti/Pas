"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

const slides = [
    {
        src: "/screenshots/orders.png",
        alt: "Orders screen — View, manage, and fulfill orders faster",
    },
    {
        src: "/screenshots/store-timings.png",
        alt: "Store Timings — Set your hours, manage breaks, stay available when needed",
    },
    {
        src: "/screenshots/notifications.png",
        alt: "Notification Sounds — Never miss an order with smart, customisable alerts",
    },
    {
        src: "/screenshots/settings.png",
        alt: "Settings — Run your store your way with easy-to-use controls",
    },
    {
        src: "/screenshots/inventory.png",
        alt: "Inventory — Track stock, update prices, and manage products effortlessly",
    },
];

const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0, scale: 0.95 }),
    center: { x: 0, opacity: 1, scale: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0, scale: 0.95 }),
};

export function AppScreenshotCarousel() {
    const [[current, direction], setCurrent] = useState([0, 0]);

    const paginate = (newDir: number) => {
        setCurrent(([prev]) => [
            (prev + newDir + slides.length) % slides.length,
            newDir,
        ]);
    };

    const goTo = (idx: number) => {
        setCurrent(([prev]) => [idx, idx > prev ? 1 : -1]);
    };

    return (
        <div className="w-full bg-[#FAF9F6] pb-20 px-6 md:px-8 flex flex-col items-center gap-10">

            {/* Section label */}
            <div className="text-center">
                <p className="text-xs font-semibold text-store-red uppercase tracking-widest mb-2">Merchant App</p>
                <h3 className="text-2xl md:text-3xl font-bold text-black-shadow tracking-tight">
                    Everything you need, in your pocket.
                </h3>
            </div>

            {/* Carousel */}
            <div className="relative w-full max-w-sm flex items-center justify-center">

                {/* Prev */}
                <button
                    onClick={() => paginate(-1)}
                    className="absolute -left-4 md:-left-14 z-10 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all"
                    aria-label="Previous"
                >
                    <ChevronLeft className="w-5 h-5 text-black-shadow" />
                </button>

                {/* Slide */}
                <div className="w-full overflow-hidden rounded-3xl" style={{ aspectRatio: "9/16" }}>
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={current}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{ duration: 0.35, ease: "easeInOut" }}
                            drag="x"
                            dragConstraints={{ left: 0, right: 0 }}
                            dragElastic={0.15}
                            onDragEnd={(_, info) => {
                                if (info.offset.x < -60) paginate(1);
                                else if (info.offset.x > 60) paginate(-1);
                            }}
                            className="w-full h-full cursor-grab active:cursor-grabbing"
                        >
                            <Image
                                src={slides[current].src}
                                alt={slides[current].alt}
                                fill
                                className="object-cover select-none"
                                draggable={false}
                            />
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Next */}
                <button
                    onClick={() => paginate(1)}
                    className="absolute -right-4 md:-right-14 z-10 w-10 h-10 rounded-full bg-white border border-gray-200 shadow-md flex items-center justify-center hover:bg-gray-50 hover:scale-110 transition-all"
                    aria-label="Next"
                >
                    <ChevronRight className="w-5 h-5 text-black-shadow" />
                </button>
            </div>

            {/* Dots */}
            <div className="flex gap-2 items-center">
                {slides.map((_, i) => (
                    <button
                        key={i}
                        onClick={() => goTo(i)}
                        aria-label={`Go to slide ${i + 1}`}
                        className={`rounded-full transition-all duration-300 ${i === current
                                ? "bg-store-red w-6 h-2"
                                : "bg-gray-300 w-2 h-2 hover:bg-gray-400"
                            }`}
                    />
                ))}
            </div>
        </div>
    );
}
