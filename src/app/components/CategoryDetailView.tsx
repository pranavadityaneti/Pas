import React, { useState } from "react";
import { 
  ArrowLeft, Search, Mic, SlidersHorizontal, ArrowUpDown, X, Check, Star 
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ALL_PRODUCTS, STORE_CATEGORIES, SUB_CATEGORIES } from "@/data";
import { cn } from "@/utils";

export function CategoryDetailView({ categoryId, onBack, onProductClick }: any) {
  const [showFilter, setShowFilter] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [priceRange, setPriceRange] = useState([0, 1000]);
  const [sortBy, setSortBy] = useState("Popularity");
  
  // New Quick Filters
  const [showOnOffer, setShowOnOffer] = useState(false);
  const [showBestSellers, setShowBestSellers] = useState(false);

  const categoryName = STORE_CATEGORIES.find(c => c.id === categoryId)?.name || "Products";
  
  // Filter products
  let products = ALL_PRODUCTS.filter(p => p.category === categoryId);

  // Apply Quick Filters
  if (showOnOffer) {
      products = products.filter(p => p.discount > 0);
  }
  if (showBestSellers) {
      products = products.filter(p => p.isBestseller);
  }

  return (
    <motion.div 
      className="flex flex-col h-full bg-[#f8f8f8]"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      {/* Sticky Header */}
      <div className="bg-white z-20 sticky top-0 border-b border-gray-100">
         <div className="px-6 pt-10 pb-2 flex items-center gap-3">
            <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center -ml-2 transition-colors">
               <ArrowLeft className="w-5 h-5 text-[#262525]" />
            </button>
            <h1 className="text-xl font-bold text-[#262525]">{categoryName}</h1>
         </div>

         <div className="px-6 pb-4 space-y-3">
             <div className="relative w-full h-11 bg-gray-50 rounded-xl border border-gray-200 flex items-center px-4">
               <Search className="w-4 h-4 text-gray-500" />
               <input 
                 type="text" 
                 placeholder={`Search in ${categoryName}`}
                 className="flex-1 ml-3 bg-transparent outline-none text-gray-700 placeholder:text-gray-400 font-medium text-sm" 
               />
               <Mic className="w-4 h-4 text-gray-500 cursor-pointer" />
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
               <button 
                 onClick={() => setShowFilter(true)}
                 className="h-9 px-4 rounded-lg border border-gray-200 flex items-center justify-center gap-2 text-xs font-bold text-[#262525] hover:bg-gray-50 transition-colors whitespace-nowrap bg-white"
               >
                  <SlidersHorizontal className="w-3.5 h-3.5" /> Filter
               </button>
               <button 
                 onClick={() => setShowSort(true)}
                 className="h-9 px-4 rounded-lg border border-gray-200 flex items-center justify-center gap-2 text-xs font-bold text-[#262525] hover:bg-gray-50 transition-colors whitespace-nowrap bg-white"
               >
                  <ArrowUpDown className="w-3.5 h-3.5" /> Sort By
               </button>
               
               {/* Toggle Chips */}
               <button 
                 onClick={() => setShowOnOffer(!showOnOffer)}
                 className={cn(
                    "h-9 px-4 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-colors whitespace-nowrap",
                    showOnOffer ? "bg-[#262525] text-white border-[#262525]" : "bg-white border-gray-200 text-[#262525]"
                 )}
               >
                  On Offer
               </button>
               <button 
                 onClick={() => setShowBestSellers(!showBestSellers)}
                 className={cn(
                    "h-9 px-4 rounded-lg border flex items-center justify-center gap-2 text-xs font-bold transition-colors whitespace-nowrap",
                    showBestSellers ? "bg-[#262525] text-white border-[#262525]" : "bg-white border-gray-200 text-[#262525]"
                 )}
               >
                  Best Sellers
               </button>
            </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
         <div className="grid grid-cols-2 gap-4 pb-20">
            {products.map((item) => (
                <div 
                   key={item.id} 
                   onClick={() => onProductClick(item)}
                   className="bg-white rounded-[20px] p-3 shadow-sm border border-gray-100 cursor-pointer group flex flex-col h-full relative"
                >
                    <div className="aspect-square w-full rounded-[15px] bg-gray-50 mb-3 overflow-hidden relative">
                       <img src={item.image} className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105" />
                       
                       {/* Badges: Top-Left Inside Image (Pastel Style) */}
                       <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                           {item.isBestseller && (
                               <div className="px-1.5 py-0.5 bg-orange-100 text-orange-800 text-[9px] font-bold rounded-md shadow-sm">
                                   Bestseller
                               </div>
                           )}
                           {item.isFewLeft && (
                               <div className="px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold rounded-md shadow-sm">
                                   Few Left
                               </div>
                           )}
                       </div>

                       <div className="absolute top-2 right-2 bg-white px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-black" /> {item.rating}
                       </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col">
                        <h3 className="text-xs font-bold text-[#262525] leading-tight line-clamp-2 mb-1 h-8">{item.name}</h3>
                        <p className="text-[10px] text-gray-400 mb-2 line-clamp-2 h-[30px] leading-snug">{item.description}</p>
                        
                        <div className="mt-auto flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="text-sm font-black text-[#262525]">₹{item.price}</span>
                                {item.discount > 0 && (
                                    <>
                                        <span className="text-[9px] text-gray-400 line-through decoration-gray-300">₹{(item.price * (1 + item.discount/100)).toFixed(0)}</span>
                                        <span className="text-[9px] font-bold text-green-600 mt-0.5">{item.discount}% OFF</span>
                                    </>
                                )}
                            </div>
                            <button className="w-8 h-8 rounded-full bg-[#f0f0f0] flex items-center justify-center hover:bg-black hover:text-white transition-colors">
                                <span className="text-xl font-medium leading-none mb-0.5">+</span>
                            </button>
                        </div>
                    </div>
                </div>
            ))}
         </div>
      </div>

      <AnimatePresence>
        {showFilter && (
            <FilterSheet 
                onClose={() => setShowFilter(false)} 
                priceRange={priceRange} 
                setPriceRange={setPriceRange} 
                categoryId={categoryId}
            />
        )}
        {showSort && <SortSheet onClose={() => setShowSort(false)} sortBy={sortBy} setSortBy={setSortBy} />}
      </AnimatePresence>
    </motion.div>
  );
}

function FilterSheet({ onClose, priceRange, setPriceRange, categoryId }: any) {
  const subCategories = SUB_CATEGORIES[categoryId] || [];

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full bg-white rounded-t-[30px] p-6 shadow-2xl h-[80vh] flex flex-col"
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6 flex-shrink-0" />
        
        <div className="flex items-center justify-between mb-6 flex-shrink-0">
           <h2 className="text-xl font-bold text-[#262525]">Filters</h2>
           <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X className="w-4 h-4" />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 pb-8">
           {/* Sub Categories (Dynamic) */}
           {subCategories.length > 0 && (
               <div>
                  <h3 className="text-sm font-bold text-gray-900 mb-4">Sub Categories</h3>
                  <div className="flex flex-wrap gap-2">
                     {subCategories.map(sub => (
                        <label key={sub} className="cursor-pointer">
                            <input type="checkbox" className="peer hidden" />
                            <span className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-100 text-xs font-bold text-gray-500 peer-checked:bg-[#262525] peer-checked:text-white peer-checked:border-black transition-all inline-block">
                                {sub}
                            </span>
                        </label>
                     ))}
                  </div>
               </div>
           )}

           {/* Price Range */}
           <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Price Range</h3>
              <div className="px-2">
                 <input 
                   type="range" min="0" max="1000" step="50" 
                   className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                 />
                 <div className="flex justify-between mt-2 text-xs font-bold text-gray-500">
                    <span>₹0</span>
                    <span>₹1000+</span>
                 </div>
              </div>
           </div>

           {/* Brand */}
           <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Brand</h3>
              <div className="space-y-3">
                 {["Nestle", "Britannia", "Amul", "Cadbury", "Haldiram's"].map(brand => (
                    <label key={brand} className="flex items-center gap-3 cursor-pointer">
                       <div className="w-5 h-5 rounded border border-gray-300 flex items-center justify-center checkbox-checked:bg-black checkbox-checked:border-black">
                          <input type="checkbox" className="appearance-none" />
                          <Check className="w-3 h-3 text-transparent check-icon pointer-events-none" />
                       </div>
                       <span className="text-sm font-medium text-gray-700">{brand}</span>
                    </label>
                 ))}
              </div>
           </div>

           {/* Rating */}
           <div>
              <h3 className="text-sm font-bold text-gray-900 mb-4">Customer Rating</h3>
              <div className="flex gap-3">
                 {[4, 3, 2].map(r => (
                    <button key={r} className="px-4 py-2 rounded-xl border border-gray-200 flex items-center gap-1 text-xs font-bold hover:bg-black hover:text-white transition-colors">
                       {r}+ <Star className="w-3 h-3 fill-current" />
                    </button>
                 ))}
              </div>
           </div>
        </div>

        <div className="pt-4 mt-4 border-t border-gray-100 flex gap-4 flex-shrink-0 bg-white">
           <button onClick={onClose} className="flex-1 h-12 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-50 transition-colors">Clear All</button>
           <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-[#262525] text-white font-bold text-sm shadow-lg hover:bg-black transition-colors">Apply Filters</button>
        </div>
      </motion.div>
      <style>{`
        input[type="checkbox"]:checked + .check-icon { color: white; }
        input[type="checkbox"]:checked { background-color: #262525; border-color: #262525; }
      `}</style>
    </motion.div>
  )
}

function SortSheet({ onClose, sortBy, setSortBy }: any) {
   const options = ["Popularity", "Price: Low to High", "Price: High to Low", "Newest First", "Discount"];

   return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full bg-white rounded-t-[30px] p-6 shadow-2xl"
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
        <h2 className="text-xl font-bold text-[#262525] mb-6">Sort By</h2>
        
        <div className="space-y-1 mb-6">
           {options.map(opt => (
              <button 
                key={opt}
                onClick={() => { setSortBy(opt); onClose(); }}
                className={cn(
                   "w-full h-12 flex items-center justify-between px-2 text-sm font-medium transition-colors rounded-xl hover:bg-gray-50",
                   sortBy === opt ? "text-[#262525] font-bold" : "text-gray-500"
                )}
              >
                 {opt}
                 {sortBy === opt && <Check className="w-4 h-4 text-[#262525]" />}
              </button>
           ))}
        </div>
      </motion.div>
    </motion.div>
   )
}
