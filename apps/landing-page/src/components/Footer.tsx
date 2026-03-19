"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Youtube, Instagram, Phone, Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-[#FAF9F6] flex flex-col items-center pt-0 pb-0 overflow-hidden relative">


            {/* Basic Links Footer */}
            <div className="w-full bg-[#FAF9F6] border-t border-black/[0.1] py-12 px-6 md:px-10 flex flex-col gap-10 relative z-30 max-w-7xl mx-auto">
                
                {/* Top Section: Logo & Badges */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                    <div className="flex flex-col items-center md:items-start gap-3 text-center md:text-left">
                        <Image
                            src="/PAS_Logo-Horizontal.png"
                            alt="Logo"
                            width={140}
                            height={46}
                            className="grayscale opacity-60 object-contain h-10 w-auto"
                        />
                        <p className="text-sm text-black-shadow/40 font-medium tracking-tight">
                            © 2026 PAS Retail Networks PVT LTD
                        </p>
                    </div>

                    <div className="flex items-center justify-center gap-4">
                        <a href="#" className="hover:opacity-80 transition-all hover:scale-105">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                alt="Get it on Google Play"
                                className="h-8 md:h-9 w-auto"
                            />
                        </a>
                        <a href="#" className="hover:opacity-80 transition-all hover:scale-105">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                                alt="Download on the App Store"
                                className="h-8 md:h-9 w-auto"
                            />
                        </a>
                    </div>
                </div>

                <hr className="border-black/[0.05] w-full" />

                {/* Bottom Section: Links & Support */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-8 md:gap-4">
                    
                    {/* Legal Links */}
                    <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-4">
                        <a href="/privacypolicy" className="text-sm font-bold text-black-shadow/60 hover:text-store-red transition-colors whitespace-nowrap">Privacy Policy</a>
                        <a href="/terms" className="text-sm font-bold text-black-shadow/60 hover:text-store-red transition-colors whitespace-nowrap">Terms & Conditions</a>
                    </div>

                    {/* Support & Socials */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 md:gap-8">
                        {/* Contact */}
                        <div className="flex items-center gap-4">
                            <a href="tel:+917842287373" className="flex items-center gap-2 text-black-shadow/60 hover:text-store-red transition-colors font-bold group">
                                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center group-hover:bg-store-red/10">
                                    <Phone size={16} className="text-black/40 group-hover:text-store-red" />
                                </div>
                                <span className="text-sm">+91 78422 87373</span>
                            </a>
                            <a href="mailto:support@pickatstore.io" className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-black/40 hover:text-store-red hover:bg-store-red/10 transition-all">
                                <Mail size={18} />
                            </a>
                        </div>

                        {/* Social Icons */}
                        <div className="flex items-center gap-5">
                            <a href="https://www.youtube.com/@pickatstore" target="_blank" rel="noopener noreferrer" className="text-black/40 hover:text-store-red transition-all hover:scale-110">
                                <Youtube size={22} />
                            </a>
                            <a href="https://www.instagram.com/pickatstore.in/" target="_blank" rel="noopener noreferrer" className="text-black/40 hover:text-store-red transition-all hover:scale-110">
                                <Instagram size={22} />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
