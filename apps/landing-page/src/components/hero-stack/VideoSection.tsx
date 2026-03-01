"use client";

import { motion } from "framer-motion";
import { AppScreenshotCarousel } from "@/components/AppScreenshotCarousel";

export function VideoSection() {
    return (
        <div className="w-full bg-[#FAF9F6] py-20 px-6 md:px-8 flex justify-center">
            <div className="w-full max-w-7xl flex flex-col gap-12">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-8">
                    <div className="max-w-2xl w-full">
                        <h2 className="text-4xl md:text-6xl font-medium tracking-tight text-black-shadow font-[family-name:var(--font-dm-sans)] text-center md:text-left">
                            See how it works.
                        </h2>
                    </div>

                    <div className="flex flex-col items-center md:items-end gap-4 max-w-md text-center md:text-right">
                        <div className="flex gap-4">
                            <a
                                href="https://forms.gle/RY23cJjXmtGES3Zx9"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-location-yellow text-black border border-location-yellow-120 px-6 py-3 rounded-full text-base font-semibold hover:bg-location-yellow-60 transition-all"
                            >
                                Get Started
                            </a>
                        </div>
                        <p className="text-sm text-black-shadow/60 leading-relaxed text-center md:text-right">
                            Discover how PickAtStore connects you with the best local merchants for a seamless shopping experience.
                        </p>
                    </div>
                </div>

                {/* Video Embed */}
                <motion.div
                    className="w-full max-w-5xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl bg-black aspect-video relative"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                >
                    <iframe
                        className="absolute inset-0 w-full h-full"
                        src="https://www.youtube.com/embed/wrxbzmcJhXo?rel=0"
                        title="PickAtStore Video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                    ></iframe>
                </motion.div>

                {/* App Screenshot Carousel */}
                <AppScreenshotCarousel />
            </div>
        </div>
    );
}
