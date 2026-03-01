"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Sparkles, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");

    const handleComplete = (e: React.FormEvent) => {
        e.preventDefault();
        if (name.length > 2) {
            router.push("/");
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-white">
            {/* Header */}
            <div className="flex items-center px-4 py-4 pt-12 border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-10 justify-between">
                <span className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5 text-orange-400" /> Almost Done</span>
                <button
                    onClick={() => router.push("/")}
                    className="text-xs font-bold text-gray-400 uppercase tracking-widest px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors"
                >
                    Skip
                </button>
            </div>

            <div className="flex-1 p-6 flex flex-col pt-10">
                <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tell us about yourself</h1>
                <p className="text-gray-500 font-medium text-sm mt-3 leading-relaxed">
                    We use these details to personalize your experience and send you order updates.
                </p>

                <form onSubmit={handleComplete} className="mt-10 space-y-6">

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Full Name</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                                <User className="w-5 h-5" />
                            </div>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-gray-50/50 border-2 border-gray-200 rounded-xl py-4 pl-12 pr-4 font-bold text-gray-900 focus:outline-none focus:border-[#B52725] focus:bg-white transition-colors placeholder:font-medium placeholder:text-gray-400"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email Address <span className="text-gray-400 font-medium normal-case">(Optional)</span></label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400">
                                <Mail className="w-5 h-5" />
                            </div>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-gray-50/50 border-2 border-gray-200 rounded-xl py-4 pl-12 pr-4 font-bold text-gray-900 focus:outline-none focus:border-[#B52725] focus:bg-white transition-colors placeholder:font-medium placeholder:text-gray-400"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={name.length < 3}
                        className={`w-full py-4 rounded-xl font-bold text-[15px] transition-all flex items-center justify-center gap-2 mt-8
                    ${name.length >= 3
                                ? 'bg-[#B52725] text-white shadow-[0_8px_25px_rgb(181,39,37,0.3)] hover:scale-[0.98]'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            }
                `}
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        Complete Profile
                    </button>
                </form>
            </div>
        </div>
    );
}
