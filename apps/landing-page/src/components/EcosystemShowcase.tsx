"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Store, ShieldCheck, ArrowRight, Smartphone, Globe, BarChart } from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
    {
        id: "consumer",
        title: "Consumer App",
        tagline: "Shop while you drive",
        description: "The ultimate convenience. Browse nearby inventory, order ahead, and pick up curbside without ever leaving your car.",
        icon: <Smartphone className="w-12 h-12 text-white" />,
        color: "bg-blue-500",
        gradient: "from-blue-500 to-indigo-600",
        image: "https://images.unsplash.com/photo-1512428559087-560fa0db79b2?w=800&auto=format&fit=crop&q=80"
    },
    {
        id: "merchant",
        title: "Merchant App",
        tagline: "Real-time Control",
        description: "Manage your store from anywhere. Track inventory, process orders, and view earnings in real-time.",
        icon: <Store className="w-12 h-12 text-white" />,
        color: "bg-orange-500",
        gradient: "from-orange-500 to-red-600",
        image: "https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?w=800&auto=format&fit=crop&q=80"
    },
    {
        id: "admin",
        title: "Admin Portal",
        tagline: "Complete Oversight",
        description: "The command center for your entire ecosystem. Manage users, analytics, and global settings with ease.",
        icon: <ShieldCheck className="w-12 h-12 text-white" />,
        color: "bg-purple-500",
        gradient: "from-purple-500 to-pink-600",
        image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop&q=80"
    }
];

export function EcosystemShowcase() {
    const [activeId, setActiveId] = useState<string>("consumer");

    return (
        <section className="py-32 bg-gray-50 overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-gray-900">
                        The <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600">Complete Ecosystem</span>
                    </h2>
                    <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                        Designed to work seamlessly together. From the customer's phone to the merchant's dashboard.
                    </p>
                </div>

                <div className="relative h-[600px] flex items-center justify-center perspective-1000">
                    {/* The 3D Cards Container */}
                    <div className="flex items-center justify-center gap-4 md:gap-12 w-full">
                        {features.map((feature) => {
                            const isActive = activeId === feature.id;
                            return (
                                <motion.div
                                    key={feature.id}
                                    layoutId={`card-${feature.id}`}
                                    onClick={() => setActiveId(feature.id)}
                                    className={cn(
                                        "relative cursor-pointer rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                        isActive ? "w-[400px] h-[550px] z-10 brightness-100" : "w-[260px] h-[400px] z-0 brightness-[0.7] blur-[1px] opacity-70 hover:brightness-90 hover:opacity-100 hover:blur-0"
                                    )}
                                    animate={{
                                        scale: isActive ? 1 : 0.9,
                                        rotateY: isActive ? 0 : (feature.id === 'consumer' ? 15 : -15), // Slight inward rotation for sides
                                    }}
                                >
                                    {/* Background Image */}
                                    <div className="absolute inset-0">
                                        <img src={feature.image} alt={feature.title} className="w-full h-full object-cover" />
                                        <div className={cn("absolute inset-0 opacity-80 mix-blend-multiply bg-gradient-to-b", feature.gradient)} />
                                        <div className="absolute inset-0 bg-black/20" />
                                    </div>

                                    {/* Content Layer */}
                                    <div className="absolute inset-0 p-8 flex flex-col justify-between text-white">
                                        <div>
                                            <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg mb-6 backdrop-blur-md bg-white/20 border border-white/30")}>
                                                {feature.icon}
                                            </div>
                                            <h3 className="text-3xl font-bold mb-2">{feature.title}</h3>
                                            <p className="text-white/80 font-medium text-lg">{feature.tagline}</p>
                                        </div>

                                        <AnimatePresence mode="wait">
                                            {isActive && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    transition={{ delay: 0.1 }}
                                                >
                                                    <p className="text-white/90 leading-relaxed mb-6">
                                                        {feature.description}
                                                    </p>
                                                    <button className="group flex items-center gap-2 text-white font-semibold backdrop-blur-md bg-white/20 px-6 py-3 rounded-full hover:bg-white/30 transition-all">
                                                        Learn more
                                                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>

                    {/* Background Decorations to match 'Portal' vibe */}
                    <div className="absolute inset-0 -z-10 flex items-center justify-center pointer-events-none">
                        <div className="w-[800px] h-[400px] bg-gradient-to-r from-orange-200/30 to-blue-200/30 blur-3xl rounded-full opacity-50 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                </div>
            </div>
        </section>
    );
}
