"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Store, Smartphone, Globe, ArrowRight, Shield, ArrowLeft } from "lucide-react";

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
        description: "Privacy policy for customers using the PickAtStore shopping experience.",
        icon: Smartphone,
        status: "coming-soon",
        href: "/privacypolicy/customer-app",
    },
    {
        id: "website",
        title: "Website",
        description: "Privacy policy for visitors browsing our main website and web services.",
        icon: Globe,
        status: "coming-soon",
        href: "/privacypolicy/website",
    },
];

export default function PrivacyPolicyPage() {
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-gray-900">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-gray-200/50">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Shield className="text-orange-500" size={24} />
                        <span className="font-bold text-lg">Privacy Center</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    {/* Hero Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center mb-16"
                    >
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                            Privacy Policies
                        </h1>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                            We value your privacy and are committed to protecting your personal information.
                            Select a policy below to learn more about how we handle your data.
                        </p>
                    </motion.div>

                    {/* Policy Cards */}
                    <div className="grid md:grid-cols-3 gap-6">
                        {policyCards.map((card, index) => (
                            <motion.div
                                key={card.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                {card.status === "available" ? (
                                    <Link
                                        href={card.href}
                                        className="block h-full p-6 bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-orange-300 transition-all group"
                                    >
                                        <div className="flex flex-col h-full">
                                            <div className="w-14 h-14 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:bg-orange-200 transition-colors">
                                                <card.icon className="text-orange-600" size={28} />
                                            </div>
                                            <h3 className="text-xl font-semibold mb-2">{card.title}</h3>
                                            <p className="text-gray-600 text-sm flex-grow">{card.description}</p>
                                            <div className="mt-4 flex items-center gap-2 text-orange-600 font-medium text-sm group-hover:gap-3 transition-all">
                                                Read Policy
                                                <ArrowRight size={16} />
                                            </div>
                                        </div>
                                    </Link>
                                ) : (
                                    <div className="block h-full p-6 bg-gray-50 rounded-2xl border border-gray-200 opacity-70">
                                        <div className="flex flex-col h-full">
                                            <div className="w-14 h-14 rounded-xl bg-gray-200 flex items-center justify-center mb-4">
                                                <card.icon className="text-gray-400" size={28} />
                                            </div>
                                            <h3 className="text-xl font-semibold mb-2 text-gray-500">{card.title}</h3>
                                            <p className="text-gray-400 text-sm flex-grow">{card.description}</p>
                                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-gray-200 rounded-full text-gray-500 text-xs font-medium w-fit">
                                                Coming Soon
                                            </div>
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
                        transition={{ delay: 0.4 }}
                        className="mt-16 text-center text-gray-500 text-sm"
                    >
                        <p>
                            For any privacy-related inquiries, please contact us at{" "}
                            <a href="mailto:support@pickatstore.io" className="text-orange-600 hover:underline">
                                support@pickatstore.io
                            </a>
                        </p>
                    </motion.div>
                </div>
            </main>
        </div>
    );
}
