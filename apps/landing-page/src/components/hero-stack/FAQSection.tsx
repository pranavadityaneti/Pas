"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
    {
        question: "How does PickAtStore work for buyers?",
        answer: "Simply browse products from your favorite local stores, place an order through the app, and pick it up curbside or get it delivered. No hidden markups, just local goodness."
    },
    {
        question: "How quickly can I start selling?",
        answer: "Once you sign up, you can list your products immediately. Our verification process typically takes less than 24 hours."
    },
    {
        question: "How do I sign up as a merchant?",
        answer: "Click on 'Start Selling' in the navigation bar. Onboarding takes less than 5 minutes—just upload your details and start listing products immediately."
    },
    {
        question: "What areas do you currently serve?",
        answer: "We are rapidly expanding across major cities. Enter your zipcode in the app to check if we are live in your neighborhood!"
    }
];

export function FAQSection() {
    return (
        <div className="w-full bg-[#FAF9F6] px-6 md:px-8 pb-20 md:pb-32 flex flex-col items-center">

            {/* Header */}
            <div className="text-center max-w-2xl mb-16">
                <span className="inline-block px-4 py-1.5 rounded-full bg-black/5 text-sm font-medium text-black/60 mb-6">
                    FAQ
                </span>
                <h2 className="text-5xl md:text-6xl font-medium tracking-tight text-[#1a1a1a] mb-6 font-[family-name:var(--font-dm-sans)]">
                    We’re here to answer all <br /> your questions.
                </h2>
                <p className="text-lg text-black/60 leading-relaxed">
                    If you’re new to PickAtStore or looking to open your own shop, this section will help you learn more about the platform.
                </p>
            </div>

            {/* Accordion List */}
            <div className="w-full max-w-3xl flex flex-col gap-4">
                {faqs.map((faq, i) => (
                    <FAQItem key={i} question={faq.question} answer={faq.answer} />
                ))}
            </div>

            {/* Bottom CTA */}

        </div>
    );
}

function FAQItem({ question, answer }: { question: string, answer: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            onClick={() => setIsOpen(!isOpen)}
            className="w-full bg-[#F3F2EF] hover:bg-[#EBEAE8] rounded-2xl cursor-pointer transition-colors overflow-hidden"
        >
            <div className="p-6 flex justify-between items-center">
                <h3 className="text-lg font-medium text-[#1a1a1a]">{question}</h3>
                <motion.div
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    className="w-8 h-8 flex items-center justify-center text-black/40"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                        <div className="px-6 pb-6 pt-0 text-black/60 leading-relaxed">
                            {answer}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
