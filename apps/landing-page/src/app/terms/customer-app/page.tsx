"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Smartphone, Shield, Calendar, Mail } from "lucide-react";

export default function CustomerAppTerms() {
    return (
        <div className="min-h-screen bg-vista-white text-black-shadow font-[family-name:var(--font-dm-sans)]">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-vista-white/80 backdrop-blur-md border-b border-store-red-40/20">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/terms" className="flex items-center gap-2 text-black-shadow/60 hover:text-black-shadow transition-colors text-sm font-bold">
                        <ArrowLeft size={18} />
                        <span>Back to All Terms</span>
                    </Link>
                    <div className="flex items-center gap-2 text-sm font-bold">
                        <Smartphone className="text-store-red" size={18} />
                        <span>Customer App Terms</span>
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
                                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Terms & Conditions</h1>
                                <p className="text-black-shadow/60 font-medium">Pick At Store - Customer App</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-black-shadow/40 mt-4 font-bold">
                            <Calendar size={16} />
                            <span>Effective Date: March 20, 2026</span>
                        </div>
                    </motion.div>

                    {/* Terms Content */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="space-y-10"
                    >
                        <section>
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">1</span>
                                General Introduction & Platform Scope
                            </h2>
                            <div className="space-y-4 text-black-shadow/80 leading-relaxed">
                                <p><strong>1.1</strong> PickAtStore is a digital commerce and discovery platform that enables customers to browse products, place orders online, and complete purchases through in-store pickup (BOPIS), pre-paid dine-in, and home-grown vendor listings, as applicable.</p>
                                <p><strong>1.2</strong> PickAtStore acts solely as a technology facilitator and discovery platform and does not own, manufacture, stock, store, sell, or deliver any products listed by vendors on the platform.</p>
                                <p><strong>1.3</strong> All transactions facilitated through the platform are subject to these Terms & Conditions, Vendor Policies, Privacy Policy, and applicable Indian laws, including the Information Technology Act, 2000, Consumer Protection (E-Commerce) Rules, 2020, and other relevant statutes.</p>
                                <p><strong>1.4</strong> By accessing or using the platform, users and vendors acknowledge that they have read, understood, and agreed to be bound by these terms.</p>
                                <p><strong>1.5</strong> By registering, placing orders, listing products, or otherwise using the PickAtStore platform, customers and vendors expressly consent to these Terms & Conditions, Privacy Policy, and associated policies. Electronic acceptance through checkboxes, OTP verification, or digital confirmations shall constitute valid and legally binding consent under applicable Indian laws.</p>
                            </div>
                        </section>

                        <section className="bg-black/5 p-8 rounded-[2.5rem] border border-black/5 mb-10">
                            <h2 className="text-xl font-bold mb-6 text-store-red tracking-tight uppercase text-sm font-black">Section A: Customer Terms & Conditions</h2>
                            
                            <div className="space-y-10">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">2</span>
                                        Eligibility, Account Use & Age-Based Access
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>2.1</strong> Users may register and use the platform irrespective of age; however, access to age-restricted products (A-rated / 18+) is strictly limited.</p>
                                        <p><strong>2.2</strong> The platform employs age-based product filtering, and users below 18 years shall be technically restricted from adding age-restricted products to cart or completing such purchases.</p>
                                        <p><strong>2.3</strong> Customers are responsible for ensuring that all account details, including contact information, are accurate and up to date.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">3</span>
                                        Product Listings & Availability
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>3.1</strong> Product availability displayed on the platform is indicative only and based on inputs provided by vendors.</p>
                                        <p><strong>3.2</strong> PickAtStore does not guarantee real-time stock availability, store online status, order acceptance by vendors, or fulfilment of any specific product.</p>
                                        <p><strong>3.3</strong> Vendors may toggle their availability online or offline at any time, and PickAtStore shall not be liable for orders not accepted due to vendor unavailability.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">4</span>
                                        Order Flow, Acceptance & Confirmation
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>4.1</strong> Customers may place orders only after selecting a store and, where applicable, a pickup or dine-in time slot from available options.</p>
                                        <p><strong>4.2</strong> Orders are sent to the vendor for acceptance before payment is enabled.</p>
                                        <p><strong>4.3</strong> Vendors are provided a two-minute acceptance window to confirm or reject an order, failing which the order is automatically cancelled.</p>
                                        <p><strong>4.4</strong> An order shall be deemed confirmed only after vendor acceptance and successful payment completion on the platform.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">5</span>
                                        Payments, Pickups & OTP Verification
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>5.1</strong> All payments are processed digitally through the platform’s authorised payment gateway.</p>
                                        <p><strong>5.2</strong> Customers must present the order ID and OTP at the store to complete pickup and confirm handover.</p>
                                        <p><strong>5.3</strong> PickAtStore does not permit cash payments for prepaid orders and shall not be responsible for disputes arising from off-platform payments.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">6</span>
                                        Cancellations, Refunds & Store Discretion
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>6.1</strong> For standard pickup orders, cancellations and refunds are subject to vendor approval and applicable vendor policies.</p>
                                        <p><strong>6.2</strong> If a product is found unsuitable at pickup, cancellation or replacement may be processed at the store’s discretion.</p>
                                        <p><strong>6.3</strong> PickAtStore does not independently approve refunds and shall not be liable for vendor refusal to cancel or refund.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">7</span>
                                        Dine-In Orders – Special Conditions
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>7.1</strong> Dine-in orders are prepaid and prepared fresh, and customers are required to arrive within the selected time slot.</p>
                                        <p><strong>7.2</strong> Conditions for Late Arrival/No-Show:</p>
                                        <ul className="list-disc pl-6 space-y-2">
                                            <li>Tables are held for 15 minutes beyond the scheduled time.</li>
                                            <li>Late arrivals (20–30 minutes) must be informed in advance.</li>
                                            <li>Delays exceeding 30 minutes may result in takeaway-only fulfilment if food is prepared.</li>
                                            <li>No-shows without prior intimation are non-refundable.</li>
                                            <li>Orders may be rescheduled up to 30 minutes before food preparation begins, subject to vendor approval.</li>
                                        </ul>
                                        <p><strong>7.3</strong> PickAtStore shall display a mandatory informational notice to customers before confirming dine-in orders to ensure informed consent.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">8</span>
                                        User Conduct & Liability Limitation
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>8.1</strong> Customers shall not misuse the platform, provide false information, abuse vendors, or attempt to bypass platform workflows.</p>
                                        <p><strong>8.2</strong> PickAtStore shall not be liable for product quality, vendor service delays, or any indirect losses.</p>
                                        <p><strong>8.3</strong> PickAtStore operates solely as a technology platform. Customers and vendors are responsible for their own safety and conduct during physical interactions at pickup or service locations.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">9</span>
                                Contact Support
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                For any questions regarding these terms, please contact our support team:
                            </p>
                            <div className="bg-white p-6 rounded-[2rem] border border-store-red-40/30 flex items-center gap-4">
                                <Mail className="text-store-red" size={24} />
                                <a href="mailto:support@pickatstore.io" className="text-store-red font-bold hover:underline text-lg">
                                    support@pickatstore.io
                                </a>
                            </div>
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
                            href="/terms"
                            className="inline-flex items-center gap-2 text-store-red hover:text-store-red-80 font-bold"
                        >
                            <ArrowLeft size={18} />
                            <span>Back to All Terms</span>
                        </Link>
                    </motion.div>
                </article>
            </main>
        </div>
    );
}
