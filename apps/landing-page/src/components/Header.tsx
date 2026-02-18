import Link from "next/link";
import { Menu } from "lucide-react";

export function Header() {
    return (
        <header className="fixed top-0 w-full z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-gray-100/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <img
                            src="/Pas_Logo_App.png"
                            alt="PickAtStore Logo"
                            className="h-10 w-auto object-contain"
                        />
                        <span className="font-bold text-xl tracking-tight text-gray-900">PickAtStore</span>
                    </div>

                    {/* App Store Buttons */}
                    <div className="flex items-center gap-4">
                        <Link href="#" className="hover:opacity-80 transition-opacity">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/7/78/Google_Play_Store_badge_EN.svg"
                                alt="Get it on Google Play"
                                className="h-10 w-auto"
                            />
                        </Link>
                        <Link href="#" className="hover:opacity-80 transition-opacity">
                            <img
                                src="https://upload.wikimedia.org/wikipedia/commons/3/3c/Download_on_the_App_Store_Badge.svg"
                                alt="Download on the App Store"
                                className="h-10 w-auto"
                            />
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    );
}
