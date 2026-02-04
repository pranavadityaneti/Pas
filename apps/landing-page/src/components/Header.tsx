import Link from "next/link";
import { Menu } from "lucide-react";

export function Header() {
    return (
        <header className="fixed top-0 w-full z-50 bg-[#FDFBF7]/80 backdrop-blur-md border-b border-gray-100/50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-20">
                    {/* Logo */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                        <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center transform -rotate-6">
                            <span className="text-white font-bold text-lg">P</span>
                        </div>
                        <span className="font-bold text-xl tracking-tight text-gray-900">PasLayout</span>
                    </div>

                    {/* Desktop Nav */}
                    <nav className="hidden md:flex space-x-8">
                        {["Brands", "Creators", "Pricing", "Use Cases", "Contact"].map((item) => (
                            <Link
                                key={item}
                                href="#"
                                className="text-sm font-medium text-gray-600 hover:text-black transition-colors"
                            >
                                {item}
                            </Link>
                        ))}
                    </nav>

                    {/* Auth Buttons */}
                    <div className="hidden md:flex items-center space-x-4">
                        <Link
                            href="#"
                            className="text-sm font-medium text-gray-900 hover:text-black"
                        >
                            Log in
                        </Link>
                        <Link
                            href="#"
                            className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black transition-all hover:scale-105"
                        >
                            Sign up
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button className="text-gray-900 p-2">
                            <Menu size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}
