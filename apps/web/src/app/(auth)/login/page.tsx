"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [phone, setPhone] = useState("");

    const handleContinue = (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length === 10) {
            // Send OTP simulation
            router.push(`/otp?phone=${phone}`);
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <div className="flex items-center px-4 py-4 pt-12 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10">
                <button
                    onClick={() => router.back()}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="w-6 h-6 text-gray-700" />
                </button>
                <span className="font-bold ml-2">Log In or Sign Up</span>
            </div>

            <div className="flex-1 p-6 flex flex-col pt-10">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Enter your mobile number</h1>
                <p className="text-gray-500 font-medium text-sm mt-2 leading-relaxed">
                    We'll send you an OTP to verify your identity. If you're new, we'll create an account for you.
                </p>

                <form onSubmit={handleContinue} className="mt-10 space-y-6">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-4 flex items-center gap-2 pointer-events-none text-gray-500 font-bold border-r border-gray-200 pr-3">
                            🇮🇳 +91
                        </div>
                        <input
                            type="tel"
                            required
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-gray-50/50 border-2 border-gray-200 rounded-xl py-4 pl-24 pr-4 font-bold text-lg tracking-widest text-gray-900 focus:outline-none focus:border-[#B52725] focus:bg-white transition-colors placeholder:font-medium placeholder:tracking-normal placeholder:text-gray-300"
                            placeholder="99999 99999"
                            autoFocus
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={phone.length !== 10}
                        className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2
                    ${phone.length === 10
                                ? 'bg-[#B52725] text-white shadow-[0_8px_25px_rgb(181,39,37,0.3)] hover:scale-[0.98]'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                `}
                    >
                        <Phone className="w-5 h-5" />
                        Continue
                    </button>
                </form>

                <div className="mt-auto pb-safe pt-8 text-center text-xs text-gray-400 font-medium leading-relaxed">
                    By continuing, you agree to our <span className="text-gray-600 underline underline-offset-2">Terms of Service</span> and <span className="text-gray-600 underline underline-offset-2">Privacy Policy</span>.
                </div>
            </div>
        </div>
    );
}
