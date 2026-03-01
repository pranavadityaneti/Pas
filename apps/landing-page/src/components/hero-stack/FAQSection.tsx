"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

const customerFaqs = [
    {
        question: "1. What is PickAtStore?",
        answer: "PickAtStore is a unified retail BOPIS marketplace that allows you to browse products across different categories, order online, and pick up in store."
    },
    {
        question: "2. How is PickAtStore different from other online marketplaces like Swiggy, Zomato, or Amazon?",
        answer: "PickAtStore is only an aggregator that connects every customer to every store in the city. Customers can place their orders online, but have to visit the stores personally to collect their order."
    },
    {
        question: "3. Is PickAtStore available in my area?",
        answer: "Since we are just starting off, we only have stores from limited regions across Hyderabad. However, you can order from any store of the app irrespective of where you are ordering from and we will expand to your region soon!"
    },
    {
        question: "4. Can I order from multiple stores in one order?",
        answer: "Yes, however each store will have its individual order ID, invoice, and OTP."
    },
    {
        question: "5. Are app prices the same as in-store prices?",
        answer: "Pricing is very transparent on PickAtStore. Vendors have full control over product pricing. Cost can be the same as in-store or lesser if they choose to give discounts."
    },
    {
        question: "6. What if I want to return or exchange my purchase?",
        answer: "Return eligibility depends on the individual store’s policy. This will be shown before checkout. Customers can return or exchange their products instantly at the store. You can initiate return or exchange on the app after discussing valid concerns with the vendor. If the vendor approves, the process will be completed on the spot."
    },
    {
        question: "7. Who do I contact if there is an issue with my order?",
        answer: "You can contact customer support through the app or website help section."
    }
];

const merchantFaqs = [
    {
        question: "1. Who can sell on PickAtStore?",
        answer: "Retail stores, local brands, homegrown businesses, and independent sellers (subject to compliance requirements)."
    },
    {
        question: "2. Is GST registration mandatory?",
        answer: "GST requirement depends on Indian tax law applicability for your business category and turnover. If GST is applicable to you legally, you must provide it."
    },
    {
        question: "3. Do I need a physical store location?",
        answer: "Not mandatory — home-based brands may be eligible as long as they provide a pick up location."
    },
    {
        question: "4. How do I manage orders?",
        answer: "Through the merchant app “PickAtPartner” where you can accept, pack, and dispatch orders."
    },
    {
        question: "5. Can I set my own prices?",
        answer: "Yes, stores have full control over pricing."
    },
    {
        question: "6. When do I receive payments?",
        answer: "Settlements happen as per the vendor payment cycle (e.g., T+X days)."
    },
    {
        question: "7. How do I get more visibility on the platform?",
        answer: "Through ratings, order performance, and platform campaigns."
    }
];

export function FAQSection() {
    const [mode, setMode] = useState<"customer" | "merchant">("customer");

    return (
        <div className="w-full bg-[#FAF9F6] px-6 md:px-8 pb-20 md:pb-32 flex flex-col items-center">

            {/* Header */}
            <div className="text-center max-w-2xl mb-12">
                <span className="inline-block px-4 py-1.5 rounded-full bg-black/5 text-sm font-medium text-black/60 mb-6">
                    FAQ
                </span>
                <h2 className="text-4xl md:text-5xl font-medium tracking-tight text-[#1a1a1a] mb-6 font-[family-name:var(--font-dm-sans)]">
                    We’re here to answer all <br /> your questions.
                </h2>

                {/* Toggle */}
                <div className="flex items-center justify-center mt-8">
                    <div className="bg-white p-1 rounded-full border border-black/5 shadow-sm inline-flex">
                        <button
                            onClick={() => setMode("customer")}
                            className={cn(
                                "px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                                mode === "customer"
                                    ? "bg-location-yellow text-black shadow-md"
                                    : "text-black/60 hover:text-black hover:bg-black/5"
                            )}
                        >
                            For Customers
                        </button>
                        <button
                            onClick={() => setMode("merchant")}
                            className={cn(
                                "px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300",
                                mode === "merchant"
                                    ? "bg-location-yellow text-black shadow-md"
                                    : "text-black/60 hover:text-black hover:bg-black/5"
                            )}
                        >
                            For Merchants
                        </button>
                    </div>
                </div>
            </div>

            {/* Accordion List */}
            <div className="w-full max-w-3xl flex flex-col gap-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="flex flex-col gap-4 w-full"
                    >
                        {(mode === "customer" ? customerFaqs : merchantFaqs).map((faq, i) => (
                            <FAQItem key={`${mode}-${i}`} question={faq.question} answer={faq.answer} />
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            onClick={() => setIsOpen(!isOpen)}
            className="w-full bg-white hover:bg-white/60 border border-black/5 rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
        >
            <div className="p-6 flex justify-between items-center gap-4">
                <h3 className="text-lg font-medium text-[#1a1a1a] text-left">{question}</h3>
                <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    className="w-8 h-8 flex items-center justify-center text-black/40 shrink-0 bg-black/5 rounded-full"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M12 5V19M5 12H19" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </motion.div>
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                    >
                        <div className="px-6 pb-6 pt-0 text-black/60 leading-relaxed text-left">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
