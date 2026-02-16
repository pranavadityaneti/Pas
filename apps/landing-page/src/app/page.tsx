"use client";

import { MainCard } from "@/components/hero-stack/MainCard";
import { FanStack } from "@/components/hero-stack/FanStack";
import { HeroProvider, useHero } from "@/components/hero-stack/HeroContext";
import { BentoGrid } from "@/components/hero-stack/BentoGrid";
import { QuickCommerceExpose } from "@/components/hero-stack/QuickCommerceExpose";
import { PurchasingPower } from "@/components/hero-stack/PurchasingPower";
import { FAQSection } from "@/components/hero-stack/FAQSection";
import { LottieSection } from "@/components/hero-stack/LottieSection";
import { Footer } from "@/components/Footer";
import { motion, useScroll, useMotionValueEvent, useTransform } from "framer-motion";
import Image from "next/image";
import { useEffect } from "react";

function HeroController() {
  const { state, setState } = useHero();

  const { scrollY } = useScroll();

  useEffect(() => {
    // Sync state with current scroll position on mount
    const current = scrollY.get();
    if (current >= 3000) setState("footer");
    else if (current >= 2000) setState("expose");
    else if (current >= 1000) setState("bento");
    else if (current >= 600) setState("spread");
    else if (current >= 300) setState("descend");
    else if (current >= 100) setState("stack");
    else {
      // Only play intro if we're at the top
      const startSequence = async () => {
        await new Promise(r => setTimeout(r, 1000));
        // Re-check scroll before fanning (user might have scrolled during the wait)
        if (scrollY.get() < 100) setState("fan");
      };
      startSequence();
    }
  }, [setState, scrollY]); // Dependencies remain constant (size 2)

  useMotionValueEvent(scrollY, "change", (latest) => {
    // Map scroll properties to states
    if (latest < 100) {
      if (state !== "fan" && state !== "intro") setState("fan");
    } else if (latest >= 100 && latest < 300) {
      if (state !== "stack") setState("stack");
    } else if (latest >= 300 && latest < 600) {
      if (state !== "descend") setState("descend");
    } else if (latest >= 600 && latest < 1000) {
      if (state !== "spread") setState("spread");
    } else if (latest >= 1000 && latest < 2000) {
      if (state !== "bento") setState("bento");
    } else if (latest >= 2000 && latest < 3000) {
      if (state !== "expose") setState("expose");
    } else if (latest >= 3000) {
      if (state !== "footer") setState("footer");
    }
  });

  return (
    // Wrapper for the whole page
    <div className="relative bg-vista-white">

      {/* --- SECTION 1: HERO (Sticky) --- */}
      {/* Height: 250vh ensures we have scroll space to play the animations */}
      <div className="h-[250vh] relative z-10">
        <div className="sticky top-0 h-screen overflow-hidden flex flex-col items-center">
          {/* Hero Nav & Content, reused from before but now inside sticky container */}
          <Nav />

          <motion.div
            className="absolute top-0 inset-x-0 h-screen flex flex-col items-center justify-center"
            style={{ opacity: useTransform(scrollY, [0, 200], [1, 0]) }}
          >
            {/* Heading */}
            <div className="text-center mt-[-400px]">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl md:text-7xl font-normal tracking-tight text-black-shadow font-[family-name:var(--font-dm-sans)]"
              >
                Skip the <span className="text-store-red font-medium">Queue</span>. Shop <span className="text-location-yellow-120 font-medium">Local</span>.
              </motion.h1>
            </div>

            {/* CTAs */}
            <motion.div
              className="absolute bottom-24 flex flex-col items-center gap-8 px-4 pointer-events-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{
                opacity: 1,
                y: (state === "fan" || state === "stack") ? 0 : 20,
              }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-lg md:text-xl text-black-shadow/70 max-w-2xl text-center leading-relaxed">
                The ultimate convenience for your daily needs. Order from your favorite neighborhood stores and pick up curbside in minutes.
              </p>

              <div className="flex gap-4">
                <button className="px-8 py-3 bg-black text-white rounded-full font-semibold hover:bg-black/90 transition-colors shadow-lg">
                  Join for $9.99/m
                </button>
                <button className="px-8 py-3 bg-gray-100 text-black border border-gray-200 rounded-full font-semibold hover:bg-gray-200 transition-colors">
                  Read more
                </button>
              </div>
            </motion.div>
          </motion.div>

          {/* Cards (Main & Fan) */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-500">
            {/* Hide cards when Bento Grid fully covers them (approx 1500px) */}
            <motion.div
              className="relative w-full max-w-7xl h-[600px] flex items-center justify-center perspective-1000"
              style={{ opacity: useTransform(scrollY, [1400, 1600], [1, 0]) }}
            >
              <MainCard />
              <FanStack />
            </motion.div>
          </div>

          {/* Showcase Text ("Showcase, Sell...") - Appears during scroll */}
          <motion.div
            className="absolute inset-0 flex flex-col items-start justify-center p-20 z-30 pointer-events-none"
            animate={{
              y: (state === "descend" || state === "spread" || state === "bento") ? 0 : "100vh",
              opacity: (state === "descend" || state === "spread" || state === "bento") ? 1 : 0
            }}
            transition={{ duration: 0.8 }}
          >
            <div className="max-w-xl">
              <p className="text-store-red font-bold tracking-widest uppercase mb-4 text-sm">E-COMMERCE</p>
              <h2 className="text-6xl font-normal tracking-tight mb-6 font-[family-name:var(--font-dm-sans)] text-black-shadow">
                Showcase, Sell, <br /> & acquire arts.
              </h2>
              <p className="text-lg text-black-shadow/60 leading-relaxed mb-8">
                Dynamic community where artists and buyers seamlessly merge. ArtFusion brings together creators to share creativity.
              </p>
            </div>
          </motion.div>
        </div>
      </div>

      {/* --- SECTION 2: BENTO (Scrolls over) --- */}
      {/* Reduced negative margin to -50vh so it arrives LATER, giving Showcase time to breathe */}
      <div className="relative z-20 bg-[#f8f8fa] min-h-screen flex items-center py-20 -mt-[50vh]">
        <BentoGrid />
      </div>

      {/* --- SECTION 3: QUICK COMMERCE EXPOSE --- */}
      <div className="relative z-30 bg-[#111] min-h-screen flex flex-col items-center justify-center py-20">
        <QuickCommerceExpose />
      </div>

      {/* --- SECTION 4: PURCHASING POWER --- */}
      <PurchasingPower />

      {/* --- SECTION 5: FAQ --- */}
      <FAQSection />

      {/* --- SECTION 5.5: LOTTIE ANIMATION --- */}
      <LottieSection />

      {/* --- SECTION 6: FOOTER --- */}
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="absolute top-0 w-full p-8 flex justify-between items-center z-50 pointer-events-auto">
      <div className="flex items-center">
        <Image
          src="/PAS_AppLauncherIcon-Mono_Red.png"
          alt="Pick At Store Logo"
          width={50}
          height={50}
          className="object-contain"
          priority
        />
      </div>
      <div className="hidden md:flex items-center gap-8 font-medium text-black-shadow/80 ml-auto mr-8">
        <a href="#" className="hover:text-store-red transition-colors">Start Selling</a>
        <a href="#" className="hover:text-store-red transition-colors">Pricing</a>
        <a href="#" className="hover:text-store-red transition-colors">Support</a>
      </div>
      <button className="px-5 py-2.5 bg-black text-white rounded-full text-sm font-semibold hover:bg-black/80 transition-colors">
        Get Started
      </button>
    </nav>
  )
}

export default function Home() {
  return (
    <HeroProvider>
      <HeroController />
    </HeroProvider>
  );
}
