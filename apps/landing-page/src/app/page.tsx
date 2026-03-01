import { Hero } from "@/components/Hero";
import { WhatIsPickAtStore } from "@/components/WhatIsPickAtStore";
import { BentoGrid } from "@/components/hero-stack/BentoGrid";
import { PurchasingPower } from "@/components/hero-stack/PurchasingPower";
import { VideoSection } from "@/components/hero-stack/VideoSection";
import { FAQSection } from "@/components/hero-stack/FAQSection";
import { ComparisonSection } from "@/components/ComparisonSection";
import { Footer } from "@/components/Footer";
import { HeroProvider } from "@/components/hero-stack/HeroContext";

export default function V1LandingPage() {
    return (
        <HeroProvider>
            <div className="bg-vista-white min-h-screen">
                <Hero />
                <WhatIsPickAtStore />
                <div className="relative z-20 bg-[#f8f8fa]">
                    <BentoGrid />
                </div>
                <PurchasingPower />
                <ComparisonSection />
                <FAQSection />
                <VideoSection />
                <Footer />
            </div>
        </HeroProvider>
    );
}
