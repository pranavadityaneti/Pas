"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Store, Shield, Calendar, Mail, AlertCircle } from "lucide-react";

export default function MerchantAppPrivacyPolicy() {
    return (
        <div className="min-h-screen bg-vista-white text-black-shadow">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-vista-white/80 backdrop-blur-md border-b border-store-red-40/20">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/privacypolicy" className="flex items-center gap-2 text-black-shadow/60 hover:text-black-shadow transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to All Policies</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Store className="text-store-red" size={20} />
                        <span className="font-semibold">Merchant App</span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-28 pb-20 px-6">
                <article className="max-w-3xl mx-auto">
                    {/* Title Section */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-store-red flex items-center justify-center">
                                <Shield className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
                                <p className="text-black-shadow/60">Pick At Store - Merchant App</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-black-shadow/50 mt-4">
                            <Calendar size={16} />
                            <span>Last Updated: February 2, 2026</span>
                        </div>
                    </motion.div>

                    {/* Policy Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="prose prose-gray max-w-none"
                    >
                        <p className="text-lg text-black-shadow/70 mb-8">
                            This Privacy Policy describes how Pick At Store ("we", "us", or "our") collects, uses, and shares information about you when you use our Merchant App.
                        </p>

                        {/* Section 1 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">1</span>
                                Information Collection and Use
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                We collect information necessary to provide our services to merchant partners. This includes:
                            </p>
                            <ul className="space-y-3 text-black-shadow/70">
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Personal Identification Information:</strong> Name, email address, phone number, and business address for account creation and communication.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>KYC Documents:</strong> National ID cards, business permits, and related documentation required for regulatory compliance and account verification.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Business Information:</strong> Store name, product inventory, pricing data, and operational hours.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Transaction Data:</strong> Order history, payment records, and sales analytics.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Device Information:</strong> Device type, operating system, and app version for technical support and optimization.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 2 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">2</span>
                                Data Storage and Security
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                Your data is stored securely using industry-standard practices:
                            </p>
                            <ul className="space-y-3 text-black-shadow/70">
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>All data is encrypted in transit and at rest using AES-256 encryption.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>We use Supabase as our backend service provider, which maintains SOC 2 Type II compliance.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>KYC documents are stored in secure, access-controlled storage with limited personnel access.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Regular security audits and penetration testing are conducted.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 3 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">3</span>
                                Third-Party Services
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                We integrate with the following third-party services to provide our platform:
                            </p>
                            <ul className="space-y-3 text-black-shadow/70">
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Supabase:</strong> Database and authentication services.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Expo:</strong> App infrastructure and push notification services.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span><strong>Payment Processors:</strong> Secure payment processing partners for financial transactions.</span>
                                </li>
                            </ul>
                            <p className="text-black-shadow/70 mt-4">
                                Each third-party service maintains their own privacy policy and data handling practices.
                            </p>
                        </section>

                        {/* Section 4 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">4</span>
                                Data Retention and Deletion
                            </h2>
                            <ul className="space-y-3 text-black-shadow/70">
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Account data is retained for the duration of your active merchant partnership.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Upon account deletion request, personal data is removed within 30 days.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Transaction records may be retained for up to 7 years for legal and tax compliance.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>You may request data deletion by contacting us or using the in-app account deletion feature.</span>
                                </li>
                            </ul>
                            <div className="mt-4 p-4 bg-location-yellow/20 rounded-xl border border-location-yellow/30">
                                <Link href="/deleteaccount" className="text-store-red font-medium hover:underline flex items-center gap-2">
                                    <AlertCircle size={16} />
                                    Learn how to delete your account →
                                </Link>
                            </div>
                        </section>

                        {/* Section 5 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">5</span>
                                Your Rights
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                As a merchant partner, you have the right to:
                            </p>
                            <ul className="space-y-3 text-black-shadow/70">
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Access your personal data stored in our systems.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Request correction of inaccurate information.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Request deletion of your account and associated data.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Export your data in a portable format.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-store-red mt-2 flex-shrink-0"></span>
                                    <span>Opt out of marketing communications.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 6 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">6</span>
                                Contact Information
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                For any privacy-related questions or requests, please contact us:
                            </p>
                            <div className="bg-white p-6 rounded-xl border border-store-red-40/30">
                                <div className="flex items-center gap-3 mb-3">
                                    <Mail className="text-store-red" size={20} />
                                    <a href="mailto:support@pickatstore.io" className="text-store-red font-medium hover:underline">
                                        support@pickatstore.io
                                    </a>
                                </div>
                                <p className="text-black-shadow/60 text-sm">
                                    Website: <a href="https://www.pickatstore.io" className="text-store-red hover:underline">www.pickatstore.io</a>
                                </p>
                            </div>
                        </section>

                        {/* Section 7 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm">7</span>
                                Policy Updates
                            </h2>
                            <p className="text-black-shadow/70">
                                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. Continued use of the app after any modifications constitutes acceptance of the updated policy.
                            </p>
                        </section>
                    </motion.div>

                    {/* Back Link */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className="mt-12 pt-8 border-t border-store-red-40/30"
                    >
                        <Link
                            href="/privacypolicy"
                            className="inline-flex items-center gap-2 text-store-red hover:text-store-red-80 font-medium"
                        >
                            <ArrowLeft size={18} />
                            Back to All Policies
                        </Link>
                    </motion.div>
                </article>
            </main>
        </div>
    );
}
