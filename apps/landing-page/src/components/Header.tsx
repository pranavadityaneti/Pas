import Link from "next/link";
import { Menu } from "lucide-react";

export function Header() {
    return (
        <header className="fixed top-0 w-full z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-gray-100/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    {/* Logo */}
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center">
                        <Link href="/" className="flex items-center">
                            <img
                                src="/PAS_Logo-Horizontal.png"
                                alt="PickAtStore"
                                className="h-12 w-auto object-contain"
                            />
                        </Link>
                    </div>

                    {/* App Store Buttons + Get Started */}
                    <div className="flex items-center gap-2 md:gap-4">
                        <Link href="#" className="hover:opacity-80 transition-opacity">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                alt="Get it on Google Play"
                                className="h-8 md:h-10 w-auto"
                            />
                        </Link>
                        <Link href="#" className="hover:opacity-80 transition-opacity">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                                alt="Download on the App Store"
                                className="h-8 md:h-10 w-auto"
                            />
                        </Link>
                        <Link
                            href="https://forms.gle/RY23cJjXmtGES3Zx9"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hidden md:inline-flex items-center gap-2 bg-store-red text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-store-red-80 hover:scale-105 transition-all shadow-md whitespace-nowrap"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
}
