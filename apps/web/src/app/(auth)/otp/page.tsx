"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

function OtpForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const phone = searchParams?.get("phone") || "your number";

    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [timer, setTimer] = useState(30);

    // Focus first input on mount
    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
        }
    }, []);

    // Timer countdown
    useEffect(() => {
        if (timer > 0) {
            const interval = setInterval(() => setTimer(t => t - 1), 1000);
            return () => clearInterval(interval);
        }
    }, [timer]);

    const handleChange = (index: number, value: string) => {
        if (isNaN(Number(value))) return;

        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Auto-advance
        if (value && index < 5 && inputRefs.current[index + 1]) {
            inputRefs.current[index + 1]?.focus();
        }

        // Auto-verify if fully filled
        if (index === 5 && value) {
            verifyOtp(newOtp.join(""));
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const verifyOtp = (code: string) => {
        // Simulation: Direct to signup details or home based on new vs returning
        // For this prototype, we'll route to the signup details to complete the flow
        router.push("/signup");
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
                <span className="font-bold ml-2 flex items-center gap-1"><ShieldCheck className="w-5 h-5 text-emerald-500" /> Verification</span>
            </div>

            <div className="flex-1 p-6 flex flex-col pt-10">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">Enter OTP</h1>
                <p className="text-gray-500 font-medium text-sm mt-3 leading-relaxed">
                    We've sent a 6-digit code to <span className="font-bold text-gray-900">+91 {phone}</span>. Please enter it below.
                </p>

                <div className="flex gap-2.5 mt-10 justify-center">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => { inputRefs.current[index] = el; }}
                            type="tel"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                            className="w-12 h-14 text-center text-xl font-bold rounded-xl border-2 border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#B52725] focus:ring-4 focus:ring-[#B52725]/10 outline-none transition-all shadow-sm"
                        />
                    ))}
                </div>

                <div className="mt-8 text-center text-sm font-bold">
                    {timer > 0 ? (
                        <span className="text-gray-400 flex items-center justify-center gap-1">
                            Resend code in <span className="text-gray-900 font-extrabold">{timer}s</span>
                        </span>
                    ) : (
                        <button
                            onClick={() => setTimer(30)}
                            className="text-[#B52725] hover:underline active:opacity-70 transition-opacity"
                        >
                            Resend OTP
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function OtpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center">Loading verification...</div>}>
            <OtpForm />
        </Suspense>
    );
}
