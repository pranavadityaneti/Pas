"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { Youtube, Instagram, Phone, Mail } from "lucide-react";

export function Footer() {
    return (
        <footer className="w-full bg-[#FAF9F6] flex flex-col items-center pt-0 pb-0 overflow-hidden relative">


            {/* Basic Links Footer */}
            <div className="w-full bg-[#FAF9F6] border-t border-black/[0.03] py-8 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-30">
                <div className="flex items-center gap-6">
                    <Image
                        src="/PAS_AppLauncherIcon-Mono_Red.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="grayscale opacity-50"
                    />
                    <p className="text-sm text-black-shadow/40 font-medium">© 2026 PAS Retail Networks PVT LTD</p>
                </div>

                {/* App Store Badges */}
                <div className="flex items-center gap-4">
                    <a href="#" className="hover:opacity-80 transition-opacity">
                        <img
                            src="/google-play-badge.png"
                            alt="Get it on Google Play"
                            className="h-8 w-auto"
                        />
                    </a>
                    <a href="#" className="hover:opacity-80 transition-opacity">
                        <img
                            src="/app-store-badge.png"
                            alt="Download on the App Store"
                            className="h-8 w-auto"
                        />
                    </a>
                </div>

                <div className="flex items-center gap-6">
                    <a href="tel:+917842287373" className="text-black-shadow/60 hover:text-store-red transition-colors font-medium mr-4">
                        <Phone size={20} className="md:hidden" />
                        <span className="hidden md:block">+91 78422 87373</span>
                    </a>
                    <a href="mailto:contact@pickatstore.in" className="text-black-shadow/60 hover:text-store-red transition-colors font-medium mr-6">
                        <Mail size={20} className="md:hidden" />
                        <span className="hidden md:block">contact@pickatstore.in</span>
                    </a>
                    <a href="/privacypolicy" className="text-sm font-bold text-black-shadow/60 hover:text-store-red transition-colors mr-4">Privacy Policy</a>
                    <a href="https://www.youtube.com/@pickatstore" target="_blank" rel="noopener noreferrer" className="text-black-shadow/60 hover:text-store-red transition-colors">
                        <Youtube size={20} />
                    </a>
                    <a href="https://www.instagram.com/pickatstore.in/" target="_blank" rel="noopener noreferrer" className="text-black-shadow/60 hover:text-store-red transition-colors">
                        <Instagram size={20} />
                    </a>
                </div>
            </div>
        </footer>
    );
}
