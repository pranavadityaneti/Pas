"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export function Footer() {
    return (
        <footer className="w-full bg-vista-white flex flex-col items-center pt-0 pb-0 overflow-hidden relative">


            {/* Basic Links Footer */}
            <div className="w-full bg-white border-t border-black/[0.03] py-8 px-10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-30">
                <div className="flex items-center gap-6">
                    <Image
                        src="/PAS_AppLauncherIcon-Mono_Red.png"
                        alt="Logo"
                        width={32}
                        height={32}
                        className="grayscale opacity-50"
                    />
                    <p className="text-sm text-black-shadow/40 font-medium">© 2026 Pick At Store Corp.</p>
                </div>

                <div className="flex gap-8 text-sm font-bold text-black-shadow/60">
                    <a href="#" className="hover:text-store-red transition-colors">Privacy</a>
                    <a href="#" className="hover:text-store-red transition-colors">Terms</a>
                    <a href="#" className="hover:text-store-red transition-colors">Twitter</a>
                    <a href="#" className="hover:text-store-red transition-colors">Instagram</a>
                </div>
            </div>
        </footer>
    );
}
