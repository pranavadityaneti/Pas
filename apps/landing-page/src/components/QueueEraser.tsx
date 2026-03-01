"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { MoveHorizontal } from "lucide-react";

export function QueueEraser() {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;

        const { left, width } = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const position = ((clientX - left) / width) * 100;

        setSliderPosition(Math.min(100, Math.max(0, position)));
    };

    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center mb-12">
                <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
                    Skip the Line. <span className="text-orange-500">Every Time.</span>
                </h2>
                <p className="text-gray-500 text-lg max-w-2xl mx-auto">
                    Why wait in chaos? Slide to see how Pas transforms your shopping experience from stressful to seamless.
                </p>
            </div>

            <div className="relative max-w-5xl mx-auto h-[400px] md:h-[600px] rounded-3xl overflow-hidden shadow-2xl select-none touch-none"
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onTouchMove={handleMouseMove}
            >
                {/* RIGHT IMAGE (AFTER / HAPPY) - Visible by default, clipped by slider */}
                {/* We place "AFTER" at bottom and "BEFORE" on top clipped? Or vice versa. */}
                {/* Common pattern: Background is Image 2 (Right), Foreground is Image 1 (Left) clipped. */}

                {/* 2. THE PAS WAY (The "After" State - Underlying) */}
                <div className="absolute inset-0">
                    <Image
                        src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200&auto=format&fit=crop&q=80" // Drive/Happy
                        alt="Pas Experience"
                        fill
                        className="object-cover"
                    />
                    {/* Label */}
                    <div className="absolute top-8 right-8 bg-green-500/90 backdrop-blur text-white px-4 py-2 rounded-full font-bold shadow-lg">
                        The Pas Way
                    </div>
                </div>

                {/* 1. THE OLD WAY (The "Before" State - Overlay filtered) */}
                <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${sliderPosition}%` }}
                >
                    <div className="relative w-full h-full"> {/* Inner container to anchor image */}
                        {/* We need the image to stay fixed size even if container shrinks */}
                        <Image
                            src="https://images.unsplash.com/photo-1591085686350-798c0f232d6a?w=1200&auto=format&fit=crop&q=80" // Queue/Crowd
                            alt="Old Way"
                            fill
                            className="object-cover object-left" // Anchor left so it doesn't squish? Next.js Image object-cover handles this if parent is absolute.
                            // Wait, if parent div width changes, child fill image might ease?
                            // We need to counter-act the width clip.
                            // Actually, simpler: Set this image to be full width of PARENT container always.
                            sizes="100vw"
                        />
                        {/* Styles to make it look 'Bad' (Grayscale + Red tint) */}
                        <div className="absolute inset-0 bg-red-900/40 mix-blend-multiply grayscale contrast-125" />

                        {/* Reset image width to be full container width regardless of clipping parent */}
                        {/* This is the CSS trick: The Image needs to be sized to the GRANDPARENT, not the clipped parent */}
                        <style jsx>{`
                    img {
                        width: 100% !important; /* This might be risky with Next Image magic */
                    }
                 `}</style>
                        {/* Better way: Absolute positioning relative to screen? No. 
                     Just make sure the wrapper 'div' clips, but the Image inside is fixed width. 
                 */}
                    </div>
                    {/* Fix for clipping logic: 
                The clipping parent `width: ${sliderPosition}%` works. 
                Inside it, we need an element that is `width: 100vw` or fixed width of the container?
            */}
                </div>

                {/* Re-implementing Image Rendering for correct clipping */}
                <div
                    className="absolute inset-0"
                    style={{
                        clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
                    }}
                >
                    <Image
                        src="https://images.unsplash.com/photo-1591085686350-798c0f232d6a?w=1200&auto=format&fit=crop&q=80"
                        alt="Old Way"
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-red-900/40 mix-blend-overlay grayscale contrast-125" />
                    {/* Label */}
                    <div className="absolute top-8 left-8 bg-black/70 backdrop-blur text-white px-4 py-2 rounded-full font-bold shadow-lg">
                        The Old Way
                    </div>
                </div>

                {/* SLIDER HANDLE */}
                <div
                    className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize z-20"
                    style={{ left: `${sliderPosition}%` }}
                >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-xl border-4 border-orange-500">
                        <MoveHorizontal className="text-orange-500 w-6 h-6" />
                    </div>
                </div>

            </div>
        </section>
    );
}
