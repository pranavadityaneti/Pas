"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="w-full bg-vista-white flex flex-col items-center pt-0 pb-0 overflow-hidden relative">


            {/* Basic Links Footer */}
            <div className="w-full bg-white border-t border-black/[0.03] py-8 px-6 md:px-10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-30">
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

                <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-bold text-black-shadow/60">
                    <a href="/privacypolicy" className="hover:text-store-red transition-colors">Privacy Policy</a>
                    <a href="https://www.youtube.com/@pickatstore" target="_blank" rel="noopener noreferrer" className="hover:text-store-red transition-colors">YouTube</a>
                    <a href="https://www.instagram.com/pickatstore.in/" target="_blank" rel="noopener noreferrer" className="hover:text-store-red transition-colors">Instagram</a>
                </div>
            </div>
        </footer>
    );
}
