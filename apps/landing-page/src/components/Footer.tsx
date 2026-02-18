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
                    <p className="text-sm text-black-shadow/40 font-medium">© 2026 PAS Retail Networks</p>
                </div>

                <div className="flex items-center gap-6">
                    <a href="/privacypolicy" className="text-sm font-bold text-black-shadow/60 hover:text-store-red transition-colors mr-4">Privacy Policy</a>
                    <a href="https://www.youtube.com/@pickatstore" target="_blank" rel="noopener noreferrer" className="text-black-shadow/60 hover:text-store-red transition-colors">
                        <Youtube size={20} />
                    </a>
                    <a href="https://www.instagram.com/pickatstore.in/" target="_blank" rel="noopener noreferrer" className="text-black-shadow/60 hover:text-store-red transition-colors">
                        <Instagram size={20} />
                    </a>
                    <a href="tel:+918888888888" className="text-black-shadow/60 hover:text-store-red transition-colors">
                        <Phone size={20} />
                    </a>
                    <a href="mailto:contact@pickatstore.in" className="text-black-shadow/60 hover:text-store-red transition-colors">
                        <Mail size={20} />
                    </a>
                </div>
            </div>
        </footer>
    );
}
