"use client";

import { useState } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import Image from "next/image";

const CARDS = [
    {
        id: 1,
        color: "bg-white",
        img: "https://images.unsplash.com/photo-1633511090164-b43840ea1607?q=80&w=800&auto=format&fit=crop", // Abstract 3D
        title: "Your Store, Digital."
    },
    {
        id: 2,
        color: "bg-[#B52725]",
        img: null, // Solid color card with text
        customContent: (
            <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
                <div className="text-6xl mb-4">⚡️</div>
                <h3 className="text-3xl font-bold font-[family-name:var(--font-dm-sans)] mb-2">Skip the Line</h3>
                <p className="opacity-80">Order ahead and pick up in 2 minutes.</p>
            </div>
        )
    },
    {
        id: 3,
        color: "bg-[#FFCC05]",
        img: "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=800&auto=format&fit=crop", // Grocery/Market
        title: "Fresh & Local"
    },
    {
        id: 4,
        color: "bg-black",
        img: null,
        customContent: (
            <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
                <div className="text-6xl mb-4">🛍️</div>
                <h3 className="text-3xl font-bold font-[family-name:var(--font-dm-sans)] mb-2">Shop Everything</h3>
                <p className="opacity-80">From groceries to gadgets, all in one app.</p>
            </div>
        )
    }
];

export function SwipeableCardStack() {
    const [cards, setCards] = useState(CARDS);

    const removeCard = (id: number) => {
        setCards((pv) => {
            const newCards = [...pv];
            const removed = newCards.shift(); // Remove top
            if (removed) newCards.push(removed); // Rotate to bottom for infinite loop
            return newCards;
        });
    };

    return (
        <div className="relative w-[320px] h-[400px] flex items-center justify-center perspective-1000">
            <AnimatePresence>
                {cards.map((card, index) => {
                    // Only render the top 3 cards for performance & stacking look
                    if (index > 2) return null;

                    return (
                        <Card
                            key={card.id}
                            card={card}
                            index={index}
                            removeCard={removeCard}
                        />
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

function Card({ card, index, removeCard }: { card: any; index: number; removeCard: (id: number) => void }) {
    const x = useMotionValue(0);
    const rotate = useTransform(x, [-200, 200], [-15, 15]);
    const opacity = useTransform(x, [-200, -150, 0, 150, 200], [0, 1, 1, 1, 0]);

    // Top card is draggable
    const isFront = index === 0;

    const handleDragEnd = (_: any, info: any) => {
        if (info.offset.x > 100 || info.offset.x < -100) {
            removeCard(card.id);
        }
    };

    return (
        <motion.div
            style={{
                x: isFront ? x : 0,
                rotate: isFront ? rotate : 0,
                opacity: isFront ? opacity : 1,
                zIndex: CARDS.length - index,
                scale: 1 - index * 0.05, // Scale down cards behind
                y: index * 15, // Move cards down behind
            }}
            animate={{
                scale: 1 - index * 0.05,
                y: index * 15,
                opacity: index > 2 ? 0 : 1
            }}
            drag={isFront ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={handleDragEnd}
            whileTap={{ cursor: "grabbing" }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className={`absolute top-0 w-full h-full rounded-[40px] shadow-2xl border-[6px] border-white overflow-hidden touch-none cursor-grab active:cursor-grabbing ${card.color} flex flex-col`}
        >
            {card.img ? (
                <>
                    <Image
                        src={card.img}
                        alt="Card Visual"
                        fill
                        className="object-cover pointer-events-none"
                    />
                    {card.title && (
                        <div className="absolute bottom-0 w-full bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                            <h3 className="text-white text-2xl font-bold font-[family-name:var(--font-dm-sans)]">{card.title}</h3>
                        </div>
                    )}
                </>
            ) : (
                card.customContent
            )}
        </motion.div>
    );
}
