"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Home, Grid, Heart, User } from "lucide-react";
import { useStoreContext } from "@/context/StoreContext";
import { cn } from "@/lib/utils";

export function BottomNavBar() {
    const router = useRouter();
    const pathname = usePathname();
    const { activeTab, setActiveTab } = useStoreContext();

    const handleTabClick = (tab: string, path: string) => {
        setActiveTab(tab);
        router.push(path);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-3 pb-safe z-[50]">
            <div className="flex justify-between items-center max-w-md mx-auto">
                <button
                    onClick={() => handleTabClick("home", "/")}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors",
                        activeTab === "home" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <Home className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Home</span>
                </button>

                <button
                    onClick={() => handleTabClick("dining", "/dining")}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors",
                        activeTab === "dining" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <Grid className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Dining</span>
                </button>

                <button
                    onClick={() => handleTabClick("offers", "/offers")}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors",
                        activeTab === "offers" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <Heart className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Offers</span>
                </button>

                <button
                    onClick={() => handleTabClick("profile", "/profile")}
                    className={cn(
                        "flex flex-col items-center gap-1 transition-colors",
                        activeTab === "profile" ? "text-emerald-600" : "text-gray-400 hover:text-gray-600"
                    )}
                >
                    <User className="w-6 h-6" />
                    <span className="text-[10px] font-medium">Profile</span>
                </button>
            </div>
        </div>
    );
}
