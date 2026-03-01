"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Trash2, AlertTriangle, Clock, Shield, Mail, CheckCircle } from "lucide-react";

export default function DeleteAccountPage() {
    return (
        <div className="min-h-screen bg-vista-white text-black-shadow">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-vista-white/80 backdrop-blur-md border-b border-store-red-40/20">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-black-shadow/60 hover:text-black-shadow transition-colors">
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-2">
                        <Trash2 className="text-store-red" size={20} />
                        <span className="font-semibold">Account Deletion</span>
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
                                <Trash2 className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="text-3xl md:text-4xl font-bold">Delete Your Account</h1>
                                <p className="text-black-shadow/60">Pick At Store - Merchant App</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Warning Box */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-location-yellow/20 border border-location-yellow rounded-xl p-6 mb-10"
                    >
                        <div className="flex items-start gap-4">
                            <AlertTriangle className="text-location-yellow-120 flex-shrink-0 mt-1" size={24} />
                            <div>
                                <h3 className="font-semibold text-black-shadow mb-2">Before You Delete</h3>
                                <p className="text-black-shadow/70 text-sm">
                                    Deleting your account is permanent and cannot be undone. Please ensure you have:
                                </p>
                                <ul className="mt-2 space-y-1 text-sm text-black-shadow/70">
                                    <li>• Completed all pending orders</li>
                                    <li>• Withdrawn any remaining balance</li>
                                    <li>• Downloaded any data you wish to keep</li>
                                </ul>
                            </div>
                        </div>
                    </motion.div>

                    {/* How to Delete */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-10"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">1</span>
                            How to Request Account Deletion
                        </h2>

                        <div className="space-y-4">
                            <div className="bg-white p-5 rounded-xl border border-store-red-40/30">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <span className="text-store-red">Option A:</span> In-App Deletion
                                </h4>
                                <ol className="text-black-shadow/70 text-sm space-y-2 ml-4 list-decimal">
                                    <li>Open the Pick At Store Merchant App</li>
                                    <li>Go to <strong>Settings</strong> → <strong>Account</strong></li>
                                    <li>Tap <strong>"Delete Account"</strong></li>
                                    <li>Confirm your decision by entering your password</li>
                                    <li>Your account will be scheduled for deletion</li>
                                </ol>
                            </div>

                            <div className="bg-white p-5 rounded-xl border border-store-red-40/30">
                                <h4 className="font-semibold mb-2 flex items-center gap-2">
                                    <span className="text-store-red">Option B:</span> Email Request
                                </h4>
                                <p className="text-black-shadow/70 text-sm mb-3">
                                    Send an email to our support team with the following information:
                                </p>
                                <ul className="text-black-shadow/70 text-sm space-y-1 ml-4 list-disc">
                                    <li>Subject line: "Account Deletion Request"</li>
                                    <li>Your registered email address</li>
                                    <li>Your store name</li>
                                    <li>Reason for deletion (optional)</li>
                                </ul>
                                <a
                                    href="mailto:support@pickatstore.io?subject=Account%20Deletion%20Request"
                                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-black-shadow text-white rounded-lg text-sm font-medium hover:bg-black-shadow/90 transition-colors"
                                >
                                    <Mail size={16} />
                                    Email: support@pickatstore.io
                                </a>
                            </div>
                        </div>
                    </motion.section>

                    {/* What Gets Deleted */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mb-10"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">2</span>
                            What Data Gets Deleted
                        </h2>

                        <div className="bg-white rounded-xl border border-store-red-40/30 overflow-hidden">
                            <div className="p-5 border-b border-store-red-40/20">
                                <h4 className="font-semibold text-green-700 flex items-center gap-2 mb-3">
                                    <CheckCircle size={18} />
                                    Permanently Deleted
                                </h4>
                                <ul className="text-black-shadow/70 text-sm space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></span>
                                        <span><strong>Personal Information:</strong> Name, email, phone number</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></span>
                                        <span><strong>Store Data:</strong> Store name, address, settings, inventory</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></span>
                                        <span><strong>KYC Documents:</strong> ID cards, permits, verification photos</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-2 flex-shrink-0"></span>
                                        <span><strong>Login Credentials:</strong> Password, authentication tokens</span>
                                    </li>
                                </ul>
                            </div>

                            <div className="p-5 bg-location-yellow/10">
                                <h4 className="font-semibold text-location-yellow-120 flex items-center gap-2 mb-3">
                                    <Clock size={18} />
                                    Retained for Legal Compliance
                                </h4>
                                <p className="text-black-shadow/70 text-sm mb-3">
                                    The following data is retained for <strong>7 years</strong> as required by Indian tax and commerce regulations:
                                </p>
                                <ul className="text-black-shadow/70 text-sm space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-location-yellow-120 mt-2 flex-shrink-0"></span>
                                        <span><strong>Transaction Records:</strong> Order history, payment records, invoices</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-location-yellow-120 mt-2 flex-shrink-0"></span>
                                        <span><strong>Tax Information:</strong> GST details, PAN (anonymized)</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </motion.section>

                    {/* Processing Time */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mb-10"
                    >
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-store-red text-white flex items-center justify-center text-sm font-bold">3</span>
                            Processing Timeline
                        </h2>

                        <div className="flex items-center gap-4 flex-wrap">
                            <div className="bg-white p-4 rounded-xl border border-store-red-40/30 flex-1 min-w-[200px]">
                                <div className="text-3xl font-bold text-store-red mb-1">24-48 hrs</div>
                                <p className="text-sm text-black-shadow/60">Request confirmation</p>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-store-red-40/30 flex-1 min-w-[200px]">
                                <div className="text-3xl font-bold text-store-red mb-1">30 days</div>
                                <p className="text-sm text-black-shadow/60">Complete data deletion</p>
                            </div>
                        </div>
                        <p className="text-black-shadow/50 text-sm mt-4">
                            You will receive a confirmation email once your account has been successfully deleted.
                        </p>
                    </motion.section>

                    {/* Contact Section */}
                    <motion.section
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white p-6 rounded-xl border border-store-red-40/30"
                    >
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Shield className="text-store-red" size={20} />
                            Need Help?
                        </h2>
                        <p className="text-black-shadow/70 text-sm mb-4">
                            If you have questions about account deletion or need assistance, contact our support team:
                        </p>
                        <div className="flex flex-wrap gap-3">
                            <a
                                href="mailto:support@pickatstore.io"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-store-red text-white rounded-lg text-sm font-medium hover:bg-store-red-80 transition-colors"
                            >
                                <Mail size={16} />
                                support@pickatstore.io
                            </a>
                            <Link
                                href="/privacypolicy/merchant-app"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-black-shadow rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                            >
                                <Shield size={16} />
                                View Privacy Policy
                            </Link>
                        </div>
                    </motion.section>

                    {/* Back Link */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        className="mt-12 pt-8 border-t border-store-red-40/30"
                    >
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-store-red hover:text-store-red-80 font-medium"
                        >
                            <ArrowLeft size={18} />
                            Back to Home
                        </Link>
                    </motion.div>
                </article>
            </main>
        </div>
    );
}
