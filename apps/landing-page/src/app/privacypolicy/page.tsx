"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Store, Smartphone, Globe, ArrowRight, Shield, FileText, ArrowLeft, Lock } from "lucide-react";

const policyCards = [
    {
        id: "merchant-app",
        title: "Merchant App",
        description: "Privacy policy for PickAtStore merchant partners using our mobile application.",
        icon: Store,
        status: "available",
        href: "/privacypolicy/merchant-app",
    },
    {
        id: "customer-app",
        title: "Customer App",
        description: "Privacy policy for customers using the PickAtStore mobile application.",
        icon: Smartphone,
        status: "coming-soon",
        href: "/privacypolicy/customer-app",
    },
    {
        id: "website",
        title: "Website",
        description: "Privacy policy for visitors and users of the PickAtStore website.",
        icon: Globe,
        status: "coming-soon",
        href: "/privacypolicy/website",
    },
];

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-vista-white text-black-shadow">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-vista-white/80 backdrop-blur-md border-b border-store-red-40/20">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-black-shadow/60 hover:text-black-shadow transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Shield className="text-store-red" size={20} />
                        <span className="font-semibold">Privacy Center</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-28 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-16"
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-location-yellow rounded-full text-black-shadow text-sm font-semibold mb-6">
                            <Lock size={16} />
                            <span>Your Privacy Matters</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-6">Privacy Policy Hub</h1>
                        <p className="text-lg text-black-shadow/60 max-w-2xl mx-auto">
                            Select a product below to view its specific privacy policy. We believe in transparency and protecting your data.
                        </p>
                    </motion.div>

                    {/* Policy Cards */}
                    <div className="grid md:grid-cols-3 gap-6">
                        {policyCards.map((card, index) => (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                            >
                                {card.status === "available" ? (
                                    <Link
                                        href={card.href}
                                        className="block p-6 bg-white rounded-2xl border border-store-red-40/30 hover:border-store-red hover:shadow-lg transition-all group h-full"
                                    >
                                        <div className="w-12 h-12 rounded-xl bg-store-red/10 flex items-center justify-center mb-4 group-hover:bg-store-red group-hover:text-white transition-colors">
                                            <card.icon className="text-store-red group-hover:text-white transition-colors" size={24} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2">{card.title}</h3>
                                        <p className="text-black-shadow/60 text-sm mb-4">{card.description}</p>
                                        <div className="flex items-center gap-2 text-store-red font-medium">
                                            <span>View Policy</span>
                                            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="block p-6 bg-white/50 rounded-2xl border border-gray-200 h-full opacity-70">
                                        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-4">
                                            <card.icon className="text-gray-400" size={24} />
                                        </div>
                                        <h3 className="text-xl font-bold mb-2 text-gray-500">{card.title}</h3>
                                        <p className="text-gray-400 text-sm mb-4">{card.description}</p>
                                        <div className="flex items-center gap-2 text-gray-400 font-medium">
                                            <span>Coming Soon</span>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ))}
                    </div>

                    {/* Footer Note */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-16 text-center"
                    >
                        <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-xl border border-store-red-40/30">
                            <FileText className="text-store-red" size={20} />
                            <p className="text-sm text-black-shadow/60">
                                Questions about our privacy practices?{" "}
                                <a href="mailto:support@pickatstore.io" className="text-store-red font-medium hover:underline">
                                    Contact us
                                </a>
                            </p>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
