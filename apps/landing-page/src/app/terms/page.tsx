"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Store, Smartphone, ArrowRight, Shield, FileText, ArrowLeft, Lock } from "lucide-react";

const termsCards = [
    {
        id: "customer-app",
        title: "Customer App",
        description: "Terms and conditions for customers using the PickAtStore mobile application.",
        icon: Smartphone,
        status: "available",
        href: "/terms/customer-app",
    },
    {
        id: "merchant-app",
        title: "Merchant App",
        description: "Terms and conditions for PickAtStore merchant partners using our platform.",
        icon: Store,
        status: "available",
        href: "/terms/merchant-app",
    },
];

export default function TermsHubPage() {
    return (
        <div className="min-h-screen bg-vista-white text-black-shadow font-[family-name:var(--font-dm-sans)]">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-vista-white/80 backdrop-blur-md border-b border-store-red-40/20">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-black-shadow/60 hover:text-black-shadow transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <FileText className="text-store-red" size={20} />
                        <span className="font-semibold">Terms & Conditions</span>
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
                            <span>Legal & Compliance</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl font-bold mb-6">Terms & Conditions Hub</h1>
                        <p className="text-lg text-black-shadow/60 max-w-2xl mx-auto">
                            Please select the relevant application to view its specific terms and conditions. These documents govern your use of our services.
                        </p>
                    </motion.div>

                    {/* Policy Cards */}
                    <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                        {termsCards.map((card, index) => (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 * index }}
                            >
                                <Link
                                    href={card.href}
                                    className="block p-8 bg-white rounded-3xl border border-store-red-40/30 hover:border-store-red hover:shadow-xl transition-all group h-full"
                                >
                                    <div className="w-14 h-14 rounded-2xl bg-store-red/10 flex items-center justify-center mb-6 group-hover:bg-store-red group-hover:text-white transition-colors">
                                        <card.icon className="text-store-red group-hover:text-white transition-colors" size={28} />
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">{card.title}</h3>
                                    <p className="text-black-shadow/60 text-base mb-6 leading-relaxed">{card.description}</p>
                                    <div className="flex items-center gap-2 text-store-red font-bold">
                                        <span>Read Terms</span>
                                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </Link>
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
                        <div className="inline-flex items-center gap-3 px-6 py-4 bg-white rounded-2xl border border-store-red-40/30 shadow-sm">
                            <Shield className="text-store-red" size={20} />
                            <p className="text-sm text-black-shadow/60">
                                Need clarification on our terms?{" "}
                                <a href="mailto:support@pickatstore.io" className="text-store-red font-bold hover:underline">
                                    Contact Support
                                </a>
                            </p>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
