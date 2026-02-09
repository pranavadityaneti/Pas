"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Shield, Store, Mail, Globe } from "lucide-react";

export default function MerchantAppPrivacyPolicy() {
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-gray-900">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-gray-200/50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/privacypolicy" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium">All Policies</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Store className="text-orange-500" size={20} />
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
                            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                                <Shield className="text-orange-600" size={24} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold">Privacy Policy</h1>
                                <p className="text-gray-500">Pick At Store - Merchant App</p>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mt-4 px-4 py-2 bg-gray-100 rounded-lg inline-block">
                            Last Updated: February 2, 2026
                        </p>
                    </motion.div>

                    {/* Policy Content */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="prose prose-gray max-w-none"
                    >
                        <p className="text-lg text-gray-700 leading-relaxed mb-8">
                            This Privacy Policy describes how Pick At Store ("we", "us", or "our") collects, uses, and shares
                            information when you use our Merchant App. By using the app, you agree to the collection and use
                            of information in accordance with this policy.
                        </p>

                        {/* Section 1 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">1</span>
                                Information Collection and Use
                            </h2>
                            <p className="text-gray-700 mb-4">To provide and improve our Service, we collect several types of information:</p>
                            <ul className="space-y-4">
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Personal Identification Information:</strong>
                                    <span className="text-gray-600"> During account setup and KYC verification, we may collect your full name, email address, phone number, and official business details.</span>
                                </li>
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">KYC Documents (Sensitive Data):</strong>
                                    <span className="text-gray-600"> To verify your merchant status, we require access to your Camera and Photo Library to capture and upload government-issued ID cards, tax registration documents, and store permits.</span>
                                </li>
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Location Data:</strong>
                                    <span className="text-gray-600"> With your permission, we collect precise location data to help you set your store's physical address accurately on our map, making it discoverable to customers.</span>
                                </li>
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Inventory & Store Data:</strong>
                                    <span className="text-gray-600"> Product names, descriptions, pricing, and stock levels are stored to facilitate your shop's operations and sync with our customer platform.</span>
                                </li>
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Device Information:</strong>
                                    <span className="text-gray-600"> We may collect technical data such as device model, OS version, and unique device identifiers for troubleshooting and security.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 2 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">2</span>
                                How We Use Your Information
                            </h2>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></span>
                                    <span className="text-gray-700">To verify your identity and prevent fraud (KYC).</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></span>
                                    <span className="text-gray-700">To enable store discovery for customers via location services.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></span>
                                    <span className="text-gray-700">To manage and synchronize your inventory levels in real-time.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <span className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0"></span>
                                    <span className="text-gray-700">To provide customer support and send important service notifications.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 3 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">3</span>
                                Data Sharing and Third Parties
                            </h2>
                            <p className="text-gray-700 mb-4">We do not sell your personal information. We share data only with:</p>
                            <ul className="space-y-4">
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Service Providers:</strong>
                                    <span className="text-gray-600"> Trusted partners like Supabase (database/storage) and Expo (app infrastructure) to operate our platform securely.</span>
                                </li>
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Compliance with Law:</strong>
                                    <span className="text-gray-600"> We may disclose information if required by law or in response to valid requests by public authorities.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 4 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">4</span>
                                Data Retention and Deletion
                            </h2>
                            <ul className="space-y-4">
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Retention:</strong>
                                    <span className="text-gray-600"> We retain KYC documents for as long as necessary to comply with regional merchant regulations. Inventory data is kept as long as your account is active.</span>
                                </li>
                                <li className="bg-white p-4 rounded-xl border border-gray-200">
                                    <strong className="text-gray-900">Account Deletion:</strong>
                                    <span className="text-gray-600"> You can request account deletion at any time via the app settings. Upon deletion, we will remove your personal data from our active databases, subject to legal retention requirements.</span>
                                </li>
                            </ul>
                        </section>

                        {/* Section 5 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">5</span>
                                Children's Privacy
                            </h2>
                            <p className="text-gray-700">
                                Our Service is not intended for anyone under the age of 18 (or 13 depending on region).
                                We do not knowingly collect personal information from children.
                            </p>
                        </section>

                        {/* Section 6 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">6</span>
                                Security
                            </h2>
                            <p className="text-gray-700">
                                We use industry-standard encryption and security protocols (SSL/TLS) to protect your data.
                                However, remember that no method of electronic storage is 100% secure.
                            </p>
                        </section>

                        {/* Section 7 */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">7</span>
                                Your Rights (GDPR/Global Compliance)
                            </h2>
                            <p className="text-gray-700">
                                Depending on your location, you have the right to access, correct, or delete your personal data.
                                You may also object to certain data processing activities.
                            </p>
                        </section>

                        {/* Section 8 - Contact */}
                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-bold">8</span>
                                Contact Us
                            </h2>
                            <p className="text-gray-700 mb-4">For privacy concerns or data deletion requests, please contact:</p>
                            <div className="bg-white p-6 rounded-xl border border-gray-200 space-y-3">
                                <div className="flex items-center gap-3">
                                    <Mail className="text-orange-500" size={20} />
                                    <a href="mailto:support@pickatstore.io" className="text-orange-600 hover:underline font-medium">
                                        support@pickatstore.io
                                    </a>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Globe className="text-orange-500" size={20} />
                                    <a href="https://www.pickatstore.io" target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline font-medium">
                                        www.pickatstore.io
                                    </a>
                                </div>
                            </div>
                        </section>
                    </motion.div>

                    {/* Back to Policies */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mt-12 pt-8 border-t border-gray-200"
                    >
                        <Link
                            href="/privacypolicy"
                            className="inline-flex items-center gap-2 text-orange-600 hover:text-orange-700 font-medium"
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
