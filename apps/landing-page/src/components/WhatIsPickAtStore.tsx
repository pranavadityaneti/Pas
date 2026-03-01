"use client";

import { motion } from "framer-motion";
import { UtensilsCrossed, ShoppingBag, MapPin, PackageCheck } from "lucide-react";

const features = [
    {
        icon: UtensilsCrossed,
        iconBg: "bg-store-red/10",
        iconColor: "text-store-red",
        title: "Pre Dine-In Bookings",
        description:
            "Customers can order their food beforehand, select a time slot and food will be ready by the time they arrive at the restaurant.",
    },
    {
        icon: ShoppingBag,
        iconBg: "bg-location-yellow/30",
        iconColor: "text-location-yellow-120",
        title: "Easier In-Store Pickups",
        description:
            "No more running around searching for one item. Browse products beforehand and go pick at store — simple and fast.",
    },
    {
        icon: MapPin,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-600",
        title: "Discoverability",
        description:
            "Discover many stores in and around your neighbourhood — including hidden gems you might have missed earlier.",
    },
    {
        icon: PackageCheck,
        iconBg: "bg-violet-100",
        iconColor: "text-violet-600",
        title: "Takeaways Digitised",
        description:
            "No need to wait in long queues for checkouts. Place an order from home and simply collect it at the store.",
    },
];

const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 32 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function WhatIsPickAtStore() {
    return (
        <section className="bg-white py-24 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">

                {/* Top row: label + headline left, description right */}
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
                    <div className="max-w-xl">
                        {/* Label */}
                        <motion.p
                            initial={{ opacity: 0, y: 12 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4 }}
                            className="text-sm font-semibold text-store-red uppercase tracking-widest mb-3"
                        >
                            What is PickAtStore?
                        </motion.p>

                        {/* Headline */}
                        <motion.h2
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.05 }}
                            className="text-4xl md:text-5xl font-bold tracking-tight text-black-shadow leading-[1.1]"
                        >
                            India's first unified<br className="hidden md:block" /> retail BOPIS platform.
                        </motion.h2>
                    </div>

                    {/* Description */}
                    <motion.p
                        initial={{ opacity: 0, y: 16 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="max-w-md text-base text-black-shadow/60 leading-relaxed lg:text-right"
                    >
                        Buy Online, Pick up in Store — browse products from stores across all categories, place the order online, and pick the products at the store.
                    </motion.p>
                </div>

                {/* Feature cards */}
                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, margin: "-60px" }}
                >
                    {features.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <motion.div
                                key={feature.title}
                                variants={cardVariants}
                                className="group bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col gap-4"
                            >
                                {/* Icon blob */}
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${feature.iconBg}`}>
                                    <Icon className={`w-6 h-6 ${feature.iconColor}`} strokeWidth={1.8} />
                                </div>

                                {/* Title */}
                                <h3 className="text-base font-semibold text-black-shadow">
                                    {feature.title}
                                </h3>

                                {/* Description */}
                                <p className="text-sm text-black-shadow/60 leading-relaxed">
                                    {feature.description}
                                </p>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>
        </section>
    );
}
