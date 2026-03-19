"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Store, Shield, Calendar, Mail } from "lucide-react";

export default function MerchantAppTerms() {
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
                        <Store className="text-store-red" size={18} />
                        <span>Merchant App Terms</span>
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
                                <p className="text-black-shadow/60 font-medium">Pick At Store - Merchant Partner App</p>
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
                                Vendor Eligibility, Registration & Compliance
                            </h2>
                            <div className="space-y-4 text-black-shadow/80 leading-relaxed">
                                <p><strong>1.1</strong> Vendors must complete mandatory KYC, including PAN & Aadhaar, GST registration, and MSME details.</p>
                                <p><strong>1.2</strong> Home-grown vendors operating without registered storefronts may list products under designated sections, subject to platform approval.</p>
                                <p><strong>1.3</strong> Vendors are solely responsible for ensuring compliance with FSSAI regulations, legal metrology, labelling, and product safety laws.</p>
                                <p><strong>1.4</strong> All vendors must maintain valid GST registration as applicable under Indian tax laws. Vendors are solely responsible for tax compliance, invoicing, filings, and statutory reporting. PickAtStore shall not be liable for vendor tax non-compliance.</p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">2</span>
                                Listings, Pricing & Inventory Responsibility
                            </h2>
                            <div className="space-y-4 text-black-shadow/80 leading-relaxed">
                                <p><strong>2.1</strong> Vendors retain full control over product pricing and availability.</p>
                                <p><strong>2.2</strong> Vendors must ensure listings are accurate, lawful, and non-infringing.</p>
                                <p><strong>2.3</strong> PickAtStore does not guarantee minimum sales, customer footfall, or order volumes, unless explicitly stated under a separate written agreement.</p>
                                <p><strong>2.4</strong> Vendors are strictly prohibited from listing or selling illegal, counterfeit, expired, unsafe, restricted, or regulated products without valid licences. PickAtStore reserves the right to remove such listings and suspend account access without notice.</p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">3</span>
                                Order Acceptance, Fulfilment & Minimum Guarantees
                            </h2>
                            <div className="space-y-4 text-black-shadow/80 leading-relaxed">
                                <p><strong>3.1</strong> Vendors must accept or reject orders within the defined window.</p>
                                <p><strong>3.2</strong> Failure to accept orders repeatedly may impact store visibility.</p>
                                <p><strong>3.3</strong> Any minimum order or sales commitments shall be governed strictly by written campaign-specific agreements.</p>
                                <p><strong>3.4</strong> Vendors are responsible for maintaining safe and lawful pickup environments and for ensuring compliance with applicable local safety and operational regulations.</p>
                            </div>
                        </section>

                        <section className="bg-black/5 p-8 rounded-[2.5rem] border border-black/5">
                            <h2 className="text-xl font-bold mb-6 text-store-red tracking-tight uppercase text-sm font-black">Financial Terms</h2>
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">4</span>
                                        Payments, Commission & Settlement
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>4.1</strong> All customer payments are collected by PickAtStore via authorised payment gateways.</p>
                                        <p><strong>4.2</strong> PickAtStore shall deduct the agreed <strong>7% commission</strong> per successful transaction.</p>
                                        <p><strong>4.3</strong> Net settlement amounts shall be transferred to vendor accounts on a rolling settlement cycle.</p>
                                        <p><strong>4.4</strong> Vendors acknowledge that PickAtStore is not responsible for banking delays, gateway downtime, or regulatory interruptions.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-3">
                                        <span className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold">5</span>
                                        Refunds, Adjustments & Reconciliation
                                    </h3>
                                    <div className="space-y-3 text-black-shadow/80">
                                        <p><strong>5.1</strong> Refunds shall be processed only through the original payment method.</p>
                                        <p><strong>5.2</strong> Any refunded amount previously settled may be adjusted against future payouts.</p>
                                        <p><strong>5.3</strong> Vendors remain responsible for customer-facing resolution of disputes related to products or services.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">6</span>
                                Confidentiality & Non-Replication
                            </h2>
                            <div className="space-y-4 text-black-shadow/80 leading-relaxed">
                                <p><strong>6.1</strong> Vendors acknowledge that all platform workflows, dashboards, analytics, and operational frameworks constitute confidential proprietary information.</p>
                                <p><strong>6.2</strong> Vendors shall not replicate, disclose, or use PickAtStore’s campaign structures or business logic in association with competing platforms.</p>
                                <p><strong>6.3</strong> Any breach may result in termination, legal action, or damages.</p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">7</span>
                                Intellectual Property & Anti-Copy Protection
                            </h2>
                            <div className="space-y-4 text-black-shadow/80 leading-relaxed">
                                <p><strong>7.1</strong> All platform content, structures, and branding remain the exclusive intellectual property of PickAtStore.</p>
                                <p><strong>7.2</strong> Reverse engineering, imitation, or commercial exploitation of platform mechanics is strictly prohibited.</p>
                                <p><strong>7.3</strong> PickAtStore reserves the right to initiate legal proceedings and cease-and-desist actions against infringing parties.</p>
                            </div>
                        </section>

                        <section className="mb-10">
                            <h2 className="text-2xl font-bold mb-4 pb-2 border-b border-store-red-40/30 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">8</span>
                                Contact Partner Support
                            </h2>
                            <p className="text-black-shadow/70 mb-4">
                                For any merchant-related legal or operational queries:
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
