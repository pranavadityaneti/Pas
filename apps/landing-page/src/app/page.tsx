import { Hero } from "@/components/Hero";
import { BentoGrid } from "@/components/hero-stack/BentoGrid";
import { PurchasingPower } from "@/components/hero-stack/PurchasingPower";
import { VideoSection } from "@/components/hero-stack/VideoSection";
import { FAQSection } from "@/components/hero-stack/FAQSection";
import { Footer } from "@/components/Footer";
import { HeroProvider } from "@/components/hero-stack/HeroContext";

export default function V1LandingPage() {
    return (
        <HeroProvider>
            <div className="bg-vista-white min-h-screen">
                <Hero />
                <div className="relative z-20 bg-[#f8f8fa]">
                    <BentoGrid />
                </div>
                <PurchasingPower />
                <FAQSection />
                <VideoSection />
                <Footer />
            </div>
        </HeroProvider>
    );
}
