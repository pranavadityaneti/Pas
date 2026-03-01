"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStoreContext } from "@/context/StoreContext";
import {
    User, MapPin, Package, Heart, Bell,
    Settings, HelpCircle, LogOut, ChevronRight,
    Wallet, ShieldCheck, Ticket
} from "lucide-react";

export default function ProfilePage() {
    const router = useRouter();
    const { setActiveTab } = useStoreContext();

    useEffect(() => {
        setActiveTab('profile');
    }, [setActiveTab]);

    return (
        <div className="flex flex-col min-h-screen bg-[#FDF9F9] pb-[100px]">

            {/* Header Profile Section */}
            <div className="bg-[#B52725] px-4 pt-16 pb-8 text-white rounded-b-[40px] shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20"></div>
                <div className="absolute bottom-0 left-0 w-40 h-40 bg-black/5 rounded-full blur-2xl -ml-10 -mb-10"></div>

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-full border-2 border-white/40 flex items-center justify-center shadow-lg overflow-hidden">
                            <img src={"https://i.pravatar.cc/150?u=a042581f4e29026024d"} alt="User" className="w-full h-full object-cover" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight">John Doe</h1>
                            <p className="text-white/80 text-sm font-medium mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Chennai, India
                            </p>
                        </div>
                    </div>
                    <button className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors backdrop-blur-md">
                        <Settings className="w-6 h-6" />
                    </button>
                </div>

                <div className="relative z-10 mt-8 grid grid-cols-3 gap-3">
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10 shadow-sm flex flex-col items-center justify-center gap-1">
                        <Wallet className="w-5 h-5 text-white/90" />
                        <span className="text-xs font-bold text-white/90 mt-1 uppercase tracking-wider">Pas Money</span>
                        <span className="text-lg font-extrabold">₹450</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10 shadow-sm flex flex-col items-center justify-center gap-1">
                        <Package className="w-5 h-5 text-white/90" />
                        <span className="text-xs font-bold text-white/90 mt-1 uppercase tracking-wider">Orders</span>
                        <span className="text-lg font-extrabold">12</span>
                    </div>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 text-center border border-white/10 shadow-sm flex flex-col items-center justify-center gap-1">
                        <Ticket className="w-5 h-5 text-white/90" />
                        <span className="text-xs font-bold text-white/90 mt-1 uppercase tracking-wider">Coupons</span>
                        <span className="text-lg font-extrabold">3</span>
                    </div>
                </div>
            </div>

            <div className="p-4 space-y-4 -mt-4 relative z-20">

                {/* Main Actions */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <MenuItem icon={<Package className="w-5 h-5 text-blue-500" />} title="My Orders" subtitle="Past orders & invoices" isFirst />
                    <MenuItem icon={<Heart className="w-5 h-5 text-red-500" />} title="Favorites" subtitle="Stores & restaurants you love" />
                    <MenuItem icon={<MapPin className="w-5 h-5 text-emerald-500" />} title="Saved Addresses" subtitle="Manage delivery locations" />
                    <MenuItem icon={<Wallet className="w-5 h-5 text-purple-500" />} title="Payment Methods" subtitle="Cards, UPI & Wallets" />
                </div>

                {/* Preferences */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                    <MenuItem icon={<Bell className="w-5 h-5 text-orange-500" />} title="Notifications" subtitle="Alerts & promos" isFirst />
                    <MenuItem icon={<ShieldCheck className="w-5 h-5 text-teal-500" />} title="Privacy & Security" subtitle="Account protection" />
                    <MenuItem icon={<HelpCircle className="w-5 h-5 text-gray-500" />} title="Help & Support" subtitle="FAQs & customer service" />
                </div>

                {/* Log Out */}
                <button className="w-full bg-white rounded-2xl p-4 flex items-center justify-center gap-2 text-red-500 font-bold shadow-sm border border-red-100 active:scale-95 transition-all mt-6">
                    <LogOut className="w-5 h-5" />
                    Log Out
                </button>

                <p className="text-center text-xs font-bold text-gray-400 mt-8 uppercase tracking-widest">
                    App Version 1.0.0
                </p>

            </div>
        </div>
    );
}

// Reusable menu item component
function MenuItem({ icon, title, subtitle, isFirst = false, onClick }: any) {
    return (
        <div
            onClick={onClick}
            className={`flex items-center gap-4 p-4 bg-white active:bg-gray-50 transition-colors cursor-pointer ${!isFirst ? 'border-t border-gray-100' : ''}`}
        >
            <div className="bg-gray-50 p-2.5 rounded-full border border-gray-100 shadow-sm">
                {icon}
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-gray-900 text-[15px]">{title}</h3>
                <p className="text-xs text-gray-500 font-medium">{subtitle}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300" />
        </div>
    );
}
