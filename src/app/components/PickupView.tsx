import React from "react";
import { 
  User, ChevronDown, Search, Mic, ArrowRight, Star, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

import homeIconBrand from "figma:asset/40920964cf6778c9bdd703d36bbe4d6f342b4705.png";
import { HERO_IMAGES, STORE_CATEGORIES, ALL_PRODUCTS } from "@/data";
import { cn } from "@/utils";

function BottomNavBar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  // Logic handled by parent or passed component
  return null; 
}

export function PickupView({ 
  selectedLocation, 
  onLocationClick, 
  onProfileClick, 
  onStoreClick, 
  onProductSourceClick, 
  activeTab, 
  setActiveTab, 
  cartSummary, 
  onViewCart, 
  onDiningClick, 
  onSearch,
  onSeeAllCategory,
  BottomNavComponent
}: any) {
  
  const heroSettings = {
    dots: true, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1, autoplay: true, autoplaySpeed: 3000, arrows: false,
    customPaging: (i: number) => <div className="w-2 h-2 rounded-full bg-black/20 hover:bg-black transition-colors mt-4"></div>,
    appendDots: (dots: React.ReactNode) => <div style={{ bottom: "24px" }}><ul className="flex justify-center gap-2 m-0 p-0">{dots}</ul></div>
  };

  const sections = [
    { id: 'grocery', title: 'Daily Essentials' },
    { id: 'bakery', title: 'Snacks & Munchies' },
    { id: 'pharmacy', title: 'Health & Wellness' },
    { id: 'beauty', title: 'Personal Care' }
  ];

  return (
    <motion.div 
      className="flex flex-col h-full bg-[#f8f8f8]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="px-6 pt-10 pb-4 bg-white z-20 sticky top-0 border-b border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div onClick={onLocationClick} className="cursor-pointer group">
            <div className="flex items-center gap-1">
              <img src={homeIconBrand} alt="Home" className="w-8 h-8 object-contain grayscale" />
              <span className="font-extrabold text-lg text-[#262525] group-hover:text-gray-600 transition-colors">{selectedLocation.type}</span>
              <ChevronDown className="w-4 h-4 text-[#262525]" />
            </div>
            <p className="text-[11px] font-medium text-gray-500 mt-0.5 truncate max-w-[200px] leading-tight pl-1 text-left">
              {selectedLocation.address}
            </p>
          </div>
          <button onClick={onProfileClick} className="w-9 h-9 rounded-xl bg-[#3d4149] flex items-center justify-center text-white shadow-sm hover:scale-105 transition-transform">
            <User className="w-5 h-5" />
          </button>
        </div>
        
        <div className="relative w-full h-11 bg-white rounded-xl border border-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex items-center px-4 hover:border-gray-300 transition-colors">
           <Search className="w-4 h-4 text-black" />
           <input 
             type="text" 
             placeholder="Search for 'Atta' or 'Biryani'" 
             className="flex-1 ml-3 bg-transparent outline-none text-gray-700 placeholder:text-gray-400 font-medium text-sm" 
             onKeyDown={(e) => {
                if (e.key === 'Enter') {
                   onSearch(e.currentTarget.value);
                }
             }}
           />
           <div className="w-[1px] h-5 bg-gray-200 mx-3"></div>
           <Mic className="w-4 h-4 text-black cursor-pointer" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
        <div className="h-4"></div>
        
        <div className="px-6 mb-8">
          <div className="relative w-full rounded-[30px] overflow-hidden shadow-sm bg-white border border-gray-100">
            <div className="h-[220px] w-full">
              <Slider {...heroSettings} className="hero-slider h-full">
                {HERO_IMAGES.map((img, idx) => (
                  <div key={idx} className="outline-none h-full">
                    <div className="h-[220px] w-full relative">
                        <img src={img} alt="Hero Banner" className="w-full h-full object-cover contrast-125 grayscale" />
                        
                        <div className="absolute top-6 left-6 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-xl border border-white/20">
                          <span className="text-[10px] font-bold text-white tracking-wider uppercase">Featured</span>
                        </div>

                        <div className="absolute bottom-10 right-6">
                           <button className="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-xl shadow-lg hover:bg-gray-100 transition-colors flex items-center gap-2">
                             Order Now <ChevronRight className="w-3 h-3" />
                           </button>
                        </div>
                    </div>
                  </div>
                ))}
              </Slider>
            </div>
          </div>
        </div>

        <div className="px-6 mb-8">
          <div className="grid grid-cols-5 gap-y-6 gap-x-2">
            {STORE_CATEGORIES.map((cat, i) => (
              <div 
                key={i} 
                onClick={() => onSeeAllCategory(cat.id)}
                className={cn(
                  "flex flex-col items-center gap-2 group cursor-pointer text-center",
                  i % 5 === 0 ? "justify-self-start" : 
                  i % 5 === 4 ? "justify-self-end" : 
                  "justify-self-center"
                )}
              >
                <div className={cn(
                  "w-14 h-14 rounded-[20px] flex items-center justify-center transition-all border border-gray-100 bg-white text-[#262525] shadow-sm group-hover:shadow-md group-hover:-translate-y-1"
                )}>
                  <cat.icon className="w-6 h-6" strokeWidth={1.5} />
                </div>
                <span className="text-[10px] font-semibold tracking-wide text-[#1c1b1f] leading-tight px-1">{cat.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category Sections */}
        {sections.map((section) => {
            const products = ALL_PRODUCTS
                .filter(p => p.category === section.id)
                .slice(0, 6);

            return (
                <div key={section.id} className="mb-8">
                    <div className="px-6 mb-4 flex justify-between items-end">
                        <h2 className="text-[20px] font-bold text-[#262525]">{section.title}</h2>
                        <span 
                            onClick={() => onSeeAllCategory(section.id)}
                            className="text-xs font-bold text-gray-400 cursor-pointer hover:text-black transition-colors"
                        >
                            See More
                        </span>
                    </div>
                    <div className="px-6">
                        <div className="grid grid-cols-3 gap-3">
                            {products.map((item) => (
                                <div 
                                    key={item.id} 
                                    onClick={() => onProductSourceClick(item)}
                                    className="flex flex-col gap-2 cursor-pointer group"
                                >
                                    <div className="aspect-[3/4] w-full rounded-[20px] bg-white border border-gray-100 overflow-hidden relative shadow-sm">
                                        <img 
                                            src={item.image} 
                                            className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105" 
                                            alt={item.name}
                                        />
                                        
                                        {/* Badges: Top-Left Inside Image (Pastel Style) */}
                                        <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                                           {item.isBestseller && (
                                               <div className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[8px] font-bold rounded-md shadow-sm">
                                                   Bestseller
                                               </div>
                                           )}
                                           {item.isFewLeft && (
                                               <div className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[8px] font-bold rounded-md shadow-sm">
                                                   Few Left
                                               </div>
                                           )}
                                        </div>

                                    </div>
                                    <div>
                                        <h3 className="text-[11px] font-bold text-[#262525] leading-tight line-clamp-2 h-[26px]">{item.name}</h3>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] font-bold">₹{item.price}</span>
                                            {item.discount > 0 && (
                                                <>
                                                    <span className="text-[9px] text-gray-400 line-through">₹{(item.price * (1 + item.discount/100)).toFixed(0)}</span>
                                                    <span className="text-[9px] font-bold text-green-600">{item.discount}% OFF</span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            );
        })}

        <div className="px-6 mb-8">
            <div 
              onClick={onDiningClick}
              className="w-full h-[180px] rounded-[30px] overflow-hidden relative cursor-pointer group"
            >
               <img 
                 src="https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80" 
                 className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-700" 
               />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-6 flex flex-col justify-end items-start text-white">
                  <h3 className="text-2xl font-black mb-1">Reserve a Table</h3>
                  <p className="text-sm font-medium opacity-90 mb-3">Skip the wait. Explore premium dining.</p>
                  <button className="px-4 py-2 bg-white text-black rounded-lg text-xs font-bold">Explore Dining</button>
               </div>
            </div>
        </div>
      </div>

      <AnimatePresence>
        {cartSummary && (
            <ViewCartBar summary={cartSummary} onClick={onViewCart} hasBottomNav={true} />
        )}
      </AnimatePresence>

      {BottomNavComponent && <BottomNavComponent activeTab={activeTab} setActiveTab={setActiveTab} />}
    </motion.div>
  )
}

function ViewCartBar({ summary, onClick, hasBottomNav = false, label = "View Cart" }: { summary: any, onClick: () => void, hasBottomNav?: boolean, label?: string }) {
  if (!summary) return null;
  return (
    <motion.div 
      initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }}
      className={cn(
        "absolute left-0 w-full px-4 z-40",
        hasBottomNav ? "bottom-[90px]" : "bottom-6"
      )}
    >
      <button 
        onClick={onClick}
        className="w-full h-12 bg-[#262525] rounded-xl flex items-center justify-between px-4 text-white shadow-lg shadow-black/20"
      >
        <div className="flex flex-col items-start text-xs">
           <span className="font-bold">{summary.count} Items</span>
           <span className="opacity-80">₹{summary.total}</span>
        </div>
        <div className="flex items-center gap-2 font-bold text-sm">
           {label} <ChevronRight className="w-4 h-4" />
        </div>
      </button>
    </motion.div>
  )
}
