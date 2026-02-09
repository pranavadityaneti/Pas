"use client";

import { motion } from "framer-motion";
import { Clock, Store, Smartphone, Globe, ArrowRight, Shield } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-100 flex items-center justify-center px-6 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-200 rounded-full blur-3xl opacity-40" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-300 rounded-full blur-3xl opacity-30" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Logo/Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="inline-flex items-center gap-3 px-5 py-3 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-orange-100">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center">
              <Store className="text-white" size={22} />
            </div>
            <span className="text-xl font-bold text-gray-900">PickAtStore</span>
          </div>
        </motion.div>

        {/* Coming Soon Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-orange-100 rounded-full text-orange-700 text-sm font-semibold mb-6"
        >
          <Clock size={16} className="animate-pulse" />
          <span>Coming Soon</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6"
        >
          The Future of
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
            Local Shopping
          </span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-lg md:text-xl text-gray-600 mb-10 max-w-xl mx-auto"
        >
          Skip the queues. Pick up in-store. Experience seamless shopping with local merchants.
        </motion.p>

        {/* Features Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mb-12"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
            <Smartphone className="text-orange-500" size={18} />
            <span className="text-sm text-gray-700">Customer App</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
            <Store className="text-orange-500" size={18} />
            <span className="text-sm text-gray-700">Merchant Platform</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-gray-200">
            <Globe className="text-orange-500" size={18} />
            <span className="text-sm text-gray-700">Store Discovery</span>
          </div>
        </motion.div>

        {/* Contact/Link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-4"
        >
          <Link
            href="/privacypolicy"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition-colors"
          >
            <Shield size={18} />
            Privacy Policy
            <ArrowRight size={16} />
          </Link>

          <p className="text-sm text-gray-500 mt-6">
            Questions? Reach us at{" "}
            <a href="mailto:support@pickatstore.io" className="text-orange-600 hover:underline">
              support@pickatstore.io
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
