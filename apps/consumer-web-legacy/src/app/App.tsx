import React, { useState, useEffect, useMemo } from "react";
import "@/styles/fonts.css";
import { 
  Menu, User, Home, Grid, Heart, ShoppingCart, Award, Leaf, Pizza, Soup, Sandwich, 
  Star, ChevronDown, Search, Mic, Briefcase, MapPin, ChevronLeft, CreditCard, 
  Settings, LogOut, ShoppingBag, Store, ChevronRight, Navigation, Plus, Minus,
  X, AlertCircle, ArrowLeft, ArrowRight, Trash2, Clock, CheckCircle, Ticket, Contact, Phone,
  Compass, Utensils, Calendar, Users, Smartphone, Pill, Fish, BookOpen, Gift, Dog, 
  Shirt, Coffee, Cake, Sparkles, Map
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import { Toaster, toast } from "sonner";

import homeIconBrand from "figma:asset/40920964cf6778c9bdd703d36bbe4d6f342b4705.png";

import { PickupView } from "@/app/components/PickupView";
import { CategoryDetailView } from "@/app/components/CategoryDetailView";
import { 
    STORES, RESTAURANTS, HERO_IMAGES, STORE_CATEGORIES, ALL_PRODUCTS, LOCATIONS, OFFERS 
} from "@/data";
import { cn, formatQuantity, calculateItemCost, getIncrement } from "@/utils";

// --- Main App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState("Home");
  const [currentView, setCurrentView] = useState<"onboarding" | "login" | "otp" | "signup_details" | "location_permission" | "feed" | "explore" | "pickup" | "dining" | "profile" | "location" | "storefront" | "dining_menu" | "cart" | "checkout" | "dining_checkout" | "success" | "coupons" | "search" | "category_detail">("onboarding");
  const [authDetails, setAuthDetails] = useState({ phone: "", otp: "", name: "", email: "" });
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0]);
  const [selectedStore, setSelectedStore] = useState<any>(RESTAURANTS[0]);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [sourcingProduct, setSourcingProduct] = useState<any | null>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [dineInCart, setDineInCart] = useState<Record<number, number>>({});
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const getProduct = (id: number) => ALL_PRODUCTS.find(p => p.id === id);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentView("search");
  };

  const handleOpenStore = (store: any) => {
    setSelectedStore(store);
    setCurrentView("storefront");
  };

  const handleOpenDiningMenu = (store: any) => {
    setSelectedStore(store);
    setDineInCart({});
    setCurrentView("dining_menu");
  }

  const addToCart = (productId: number, increment: number, isDineIn = false) => {
    const setter = isDineIn ? setDineInCart : setCart;
    setter(prev => {
      const current = prev[productId] || 0;
      const next = current + increment;
      if (next <= 0) {
        const { [productId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [productId]: next };
    });
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === "Cart") setCurrentView("cart");
    else if (tab === "Home") setCurrentView("feed");
    else if (tab === "Pickup") setCurrentView("pickup");
    else if (tab === "Dining") setCurrentView("dining");
  };

  const handleSeeAllCategory = (categoryId: string) => {
      setSelectedCategoryId(categoryId);
      setCurrentView("category_detail");
  };

  const getCartSummary = (cartObj: Record<number, number>) => {
    const items = Object.entries(cartObj).map(([id, qty]) => {
        const p = getProduct(parseInt(id));
        return p ? { ...p, qty } : null;
    }).filter(Boolean) as any[];
    
    if (items.length === 0) return null;

    const totalCount = items.length; 
    const totalPrice = items.reduce((sum, item) => sum + calculateItemCost(item.qty, item.price, item.pricingType), 0);
    
    return { count: totalCount, total: totalPrice.toFixed(0) };
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center text-[#262525]">
      <Toaster position="top-center" />
      
      {/* Mobile Wrapper */}
      <div className="w-full max-w-[428px] h-screen md:h-[900px] bg-[#f8f8f8] md:rounded-[50px] overflow-hidden relative shadow-2xl flex flex-col grayscale-ui-wrapper">
        
        <AnimatePresence mode="wait">
          
          {currentView === "onboarding" && (
            <OnboardingView key="onboarding" onComplete={() => setCurrentView("login")} />
          )}

          {currentView === "login" && (
            <LoginView 
              key="login" 
              onBack={() => setCurrentView("onboarding")}
              onSendOtp={(phone: string) => {
                setAuthDetails(prev => ({ ...prev, phone }));
                setCurrentView("otp");
              }} 
            />
          )}

          {currentView === "otp" && (
             <OtpView 
               key="otp"
               phone={authDetails.phone}
               onBack={() => setCurrentView("login")}
               onVerify={(otp: string) => {
                 setAuthDetails(prev => ({ ...prev, otp }));
                 setCurrentView("signup_details");
               }}
             />
          )}

          {currentView === "signup_details" && (
             <SignupDetailsView 
               key="signup_details"
               onBack={() => setCurrentView("otp")}
               onComplete={(name: string, email: string) => {
                  setAuthDetails(prev => ({ ...prev, name, email }));
                  setCurrentView("location_permission");
               }}
             />
          )}

          {currentView === "location_permission" && (
             <LocationPermissionView 
               key="location_permission"
               onAllow={() => {
                  toast.success("Location access granted!");
                  setCurrentView("feed");
               }}
               onManual={() => setCurrentView("location")}
             />
          )}

          {currentView === "feed" && (
            <FeedView 
              key="feed"
              selectedLocation={selectedLocation}
              onLocationClick={() => setCurrentView("location")}
              onProfileClick={() => setCurrentView("profile")}
              onStoreClick={handleOpenStore} 
              onProductSourceClick={(product: any) => setSourcingProduct(product)}
              activeTab={activeTab}
              setActiveTab={handleTabChange}
              cartSummary={getCartSummary(cart)}
              onViewCart={() => setCurrentView("cart")}
              onDiningClick={() => handleTabChange("Dining")}
              onSearch={handleSearch}
            />
          )}

          {currentView === "pickup" && (
            <PickupView 
               key="pickup"
               selectedLocation={selectedLocation}
               onLocationClick={() => setCurrentView("location")}
               onProfileClick={() => setCurrentView("profile")}
               onStoreClick={handleOpenStore} 
               onProductSourceClick={(product: any) => setSourcingProduct(product)}
               activeTab={activeTab}
               setActiveTab={handleTabChange}
               cartSummary={getCartSummary(cart)}
               onViewCart={() => setCurrentView("cart")}
               onDiningClick={() => handleTabChange("Dining")}
               onSearch={handleSearch}
               onSeeAllCategory={handleSeeAllCategory}
               BottomNavComponent={BottomNavBar}
            />
          )}

          {currentView === "category_detail" && (
              <CategoryDetailView 
                 key="category_detail"
                 categoryId={selectedCategoryId}
                 onBack={() => setCurrentView("pickup")}
                 onProductClick={(product: any) => setSourcingProduct(product)}
              />
          )}

          {currentView === "search" && (
             <SearchView 
                key="search"
                query={searchQuery}
                onSearch={handleSearch}
                onBack={() => setCurrentView("feed")}
                onStoreClick={handleOpenStore}
                onProductClick={(product: any) => setSourcingProduct(product)}
             />
          )}

          {currentView === "dining" && (
            <DiningView 
               key="dining"
               activeTab={activeTab}
               setActiveTab={handleTabChange}
               onPreOrder={handleOpenDiningMenu}
            />
          )}

          {currentView === "dining_menu" && (
            <DiningMenuView 
               key="dining_menu"
               store={selectedStore}
               onBack={() => setCurrentView("dining")}
               onProductClick={setSelectedProduct}
               cart={dineInCart}
               addToCart={(pid: number, inc: number) => addToCart(pid, inc, true)}
               onProceed={() => setCurrentView("dining_checkout")}
            />
          )}

          {currentView === "dining_checkout" && (
            <DiningCheckoutView 
              key="dining_checkout"
              store={selectedStore}
              cart={dineInCart}
              onBack={() => setCurrentView("dining_menu")}
              onConfirm={() => {
                setCurrentView("success");
              }}
              getProduct={getProduct}
            />
          )}

          {currentView === "profile" && (
            <ProfileView 
              key="profile"
              onBack={() => setCurrentView("feed")}
            />
          )}

          {currentView === "location" && (
            <LocationView 
              key="location"
              selectedLocation={selectedLocation}
              onSelectLocation={(loc: any) => {
                setSelectedLocation(loc);
                setCurrentView("feed");
              }}
              onBack={() => setCurrentView("feed")}
            />
          )}

          {currentView === "storefront" && (
            <StorefrontView 
              key="storefront"
              store={selectedStore}
              onBack={() => setCurrentView("feed")}
              onProductClick={setSelectedProduct}
              cart={cart}
              addToCart={(pid: number, inc: number) => addToCart(pid, inc, false)}
              cartSummary={getCartSummary(cart)}
              onViewCart={() => setCurrentView("cart")}
            />
          )}

          {currentView === "cart" && (
             <CartView 
               key="cart"
               cart={cart}
               onBack={() => {
                 setCurrentView("feed");
                 setActiveTab("Home");
               }}
               onUpdateQuantity={addToCart}
               onCheckout={() => setCurrentView("checkout")}
               onApplyCoupon={() => setCurrentView("coupons")}
               appliedCoupon={appliedCoupon}
               getProduct={getProduct}
             />
          )}

          {currentView === "checkout" && (
            <CheckoutView 
              key="checkout"
              cart={cart}
              onBack={() => setCurrentView("cart")}
              onPlaceOrder={() => setCurrentView("success")}
              getProduct={getProduct}
            />
          )}

          {currentView === "coupons" && (
             <CouponsView 
               key="coupons"
               onBack={() => setCurrentView("cart")}
               onApply={(code: string) => {
                  setAppliedCoupon(code);
                  toast.success(`Coupon ${code} applied!`);
                  setCurrentView("cart");
               }}
             />
          )}

          {currentView === "success" && (
            <SuccessView 
              key="success"
              cart={Object.keys(cart).length > 0 ? cart : dineInCart}
              onHome={() => {
                setCart({});
                setDineInCart({});
                setAppliedCoupon(null);
                setCurrentView("feed");
                setActiveTab("Home");
              }}
            />
          )}

        </AnimatePresence>

        <AnimatePresence>
          {selectedProduct && (
            <ProductDetailSheet 
              product={selectedProduct} 
              onClose={() => setSelectedProduct(null)}
              cartCount={(cart[selectedProduct.id] || 0) + (dineInCart[selectedProduct.id] || 0)}
              onAdd={(inc: number) => {
                 const isDineIn = currentView === "dining_menu" || currentView === "dining_checkout";
                 addToCart(selectedProduct.id, inc, isDineIn);
              }}
            />
          )}
          {sourcingProduct && (
             <ProductSourceSheet 
                product={sourcingProduct}
                onClose={() => setSourcingProduct(null)}
                onVisitStore={(storeId: number) => {
                    const store = RESTAURANTS.find(r => r.id === storeId) || STORES.find(s => s.id === storeId);
                    if (store) {
                        setSourcingProduct(null);
                        handleOpenStore(store);
                    }
                }}
             />
          )}
        </AnimatePresence>

      </div>
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .grayscale-ui-wrapper img { filter: grayscale(100%); }
        .grayscale-ui-wrapper .map-placeholder {
          background-image: radial-gradient(#ccc 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </div>
  );
}

function BottomNavBar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: string) => void }) {
  const tabs = [
    { name: "Home", icon: Home },
    { name: "Pickup", icon: Store },
    { name: "Dining", icon: Utensils },
    { name: "Cart", icon: ShoppingCart }
  ];

  return (
    <div className="absolute bottom-0 left-0 w-full bg-white shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.1)] rounded-t-[30px] z-50">
      <div className="px-6 py-3 flex items-center justify-between relative">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
             <button 
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className="flex flex-col items-center justify-center w-16 gap-1"
             >
                <div className={cn("transition-colors duration-300", isActive ? "text-[#262525]" : "text-gray-300")}>
                   <tab.icon className={cn("w-6 h-6", isActive ? "fill-[#262525]" : "fill-gray-200")} />
                </div>
                <span className={cn("text-[10px] font-medium", isActive ? "text-[#262525]" : "text-gray-300")}>
                   {tab.name}
                </span>
             </button>
          )
        })}
      </div>
    </div>
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

function FeedView({ selectedLocation, onLocationClick, onProfileClick, activeTab, setActiveTab, cartSummary, onViewCart, onSearch }: any) {
  const heroSettings = {
    dots: true, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1, autoplay: true, autoplaySpeed: 3000, arrows: false,
    customPaging: (i: number) => <div className="w-2 h-2 rounded-full bg-black/20 hover:bg-black transition-colors mt-4"></div>,
    appendDots: (dots: React.ReactNode) => <div style={{ bottom: "24px" }}><ul className="flex justify-center gap-2 m-0 p-0">{dots}</ul></div>
  };

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
        
        <div className="px-6 mb-6">
           {/* REDUCED HEIGHT: h-[300px] */}
           <div className="grid grid-cols-2 gap-4 h-[300px]">
              <div 
                onClick={() => setActiveTab('Pickup')}
                className="relative w-full h-full rounded-[30px] overflow-hidden cursor-pointer group border border-gray-100 shadow-sm"
              >
                 <img 
                    src="https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80" 
                    className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-700"
                    alt="Pickup"
                 />
                 <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors p-5 flex flex-col justify-end">
                    <h2 className="text-3xl font-black text-white leading-none mb-1">Pickup</h2>
                    <p className="text-xs text-white/90 font-medium">Groceries & Essentials</p>
                    <div className="mt-4 w-10 h-10 rounded-full bg-white flex items-center justify-center">
                       <ArrowRight className="w-5 h-5 text-black" />
                    </div>
                 </div>
              </div>

              <div 
                onClick={() => setActiveTab('Dining')}
                className="relative w-full h-full rounded-[30px] overflow-hidden cursor-pointer group border border-gray-100 shadow-sm"
              >
                 <img 
                    src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80" 
                    className="w-full h-full object-cover grayscale contrast-125 group-hover:scale-105 transition-transform duration-700"
                    alt="Dining"
                 />
                 <div className="absolute inset-0 bg-black/40 group-hover:bg-black/50 transition-colors p-5 flex flex-col justify-end">
                    <h2 className="text-3xl font-black text-white leading-none mb-1">Dining</h2>
                    <p className="text-xs text-white/90 font-medium">Book Tables & Pre-order</p>
                    <div className="mt-4 w-10 h-10 rounded-full bg-white flex items-center justify-center">
                       <ArrowRight className="w-5 h-5 text-black" />
                    </div>
                 </div>
              </div>
           </div>
        </div>

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

                        <div className="absolute bottom-6 right-6">
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

      </div>

      <AnimatePresence>
        {cartSummary && <ViewCartBar summary={cartSummary} onClick={onViewCart} hasBottomNav={true} />}
      </AnimatePresence>

      <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </motion.div>
  );
}

function DiningView({ activeTab, setActiveTab, onPreOrder }: any) {
  const [reservationStore, setReservationStore] = useState<any>(null);

  return (
    <motion.div 
      className="flex flex-col h-full bg-[#f8f8f8]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="px-6 pt-10 pb-4 bg-white sticky top-0 z-20 border-b border-gray-100">
         <h1 className="text-2xl font-black text-[#262525] mb-4">Dining</h1>
         
         <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {["Near Me", "Top Rated", "North Indian", "South Indian", "Chinese", "Italian"].map(filter => (
               <button key={filter} className="px-4 py-2 rounded-full bg-gray-50 border border-gray-200 text-xs font-bold whitespace-nowrap hover:bg-[#262525] hover:text-white transition-colors">
                  {filter}
               </button>
            ))}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar p-6">
         <div className="space-y-6">
            {RESTAURANTS.map((place) => (
               <div key={place.id} className="bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm">
                  <div className="h-40 w-full relative bg-gray-200">
                     <img src={place.image} className="w-full h-full object-cover grayscale contrast-125" alt={place.name} />
                     <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold">
                        <Star className="w-3 h-3 fill-black" /> {place.rating}
                     </div>
                  </div>
                  <div className="p-5">
                     <div className="flex justify-between items-start mb-2">
                        <h3 className="text-lg font-black text-[#262525]">{place.name}</h3>
                        <span className="text-xs font-medium text-gray-500">{place.distance}</span>
                     </div>
                     <p className="text-sm text-gray-500 mb-4">{place.address}</p>
                     
                     <div className="flex gap-3">
                        <button 
                           onClick={() => setReservationStore(place)}
                           className="flex-1 h-10 rounded-xl border border-gray-200 text-xs font-bold flex items-center justify-center gap-2 hover:bg-gray-50"
                        >
                           <Calendar className="w-4 h-4" /> Book Table
                        </button>
                        <button 
                           onClick={() => onPreOrder(place)}
                           className="flex-1 h-10 rounded-xl bg-[#262525] text-white text-xs font-bold flex items-center justify-center gap-2 hover:bg-black"
                        >
                           <Utensils className="w-4 h-4" /> Pre-order Meal
                        </button>
                     </div>
                  </div>
               </div>
            ))}
         </div>
      </div>

      {reservationStore && (
        <ReservationSheet 
          store={reservationStore} 
          onClose={() => setReservationStore(null)} 
        />
      )}

      <BottomNavBar activeTab={activeTab} setActiveTab={setActiveTab} />
    </motion.div>
  )
}

function ReservationSheet({ store, onClose }: any) {
  const [branch, setBranch] = useState(store.branches[0]);
  const [guests, setGuests] = useState(2);
  const [date, setDate] = useState("Today");
  const [time, setTime] = useState("7:30 PM");

  const confirmBooking = () => {
    toast.success(`Table booked at ${store.name}!`, {
      description: `${branch} • ${guests} Guests • ${time}`
    });
    onClose();
  };

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
        
        <h2 className="text-xl font-bold text-[#262525] mb-6">Book a Table</h2>
        
        <div className="mb-6">
           <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Select Branch</label>
           <div className="relative">
              <select 
                value={branch} onChange={(e) => setBranch(e.target.value)}
                className="w-full h-12 bg-gray-50 rounded-xl px-4 appearance-none outline-none font-bold text-sm border border-gray-200"
              >
                {store.branches.map((b: string) => <option key={b} value={b}>{b}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-4 w-4 h-4 text-gray-500 pointer-events-none" />
           </div>
        </div>

        <div className="mb-6">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Number of Guests</label>
          <div className="flex gap-3">
             {[1, 2, 3, 4, 5, 6].map(num => (
               <button 
                 key={num}
                 onClick={() => setGuests(num)}
                 className={cn(
                   "w-10 h-10 rounded-full font-bold text-sm transition-colors border",
                   guests === num ? "bg-[#262525] text-white border-black" : "bg-white text-gray-500 border-gray-200"
                 )}
               >
                 {num}
               </button>
             ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
           <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Date</label>
              <select className="w-full h-12 bg-gray-50 rounded-xl px-4 appearance-none outline-none font-bold text-sm border border-gray-200">
                 <option>Today</option>
                 <option>Tomorrow</option>
              </select>
           </div>
           <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Time</label>
              <select 
                value={time} onChange={(e) => setTime(e.target.value)}
                className="w-full h-12 bg-gray-50 rounded-xl px-4 appearance-none outline-none font-bold text-sm border border-gray-200"
              >
                 <option>7:00 PM</option>
                 <option>7:30 PM</option>
                 <option>8:00 PM</option>
                 <option>8:30 PM</option>
                 <option>9:00 PM</option>
              </select>
           </div>
        </div>

        <button 
          onClick={confirmBooking}
          className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors"
        >
          Confirm Booking
        </button>
      </motion.div>
    </motion.div>
  );
}

function ProductSourceSheet({ product, onClose, onVisitStore }: any) {
    const nearbySellers = useMemo(() => {
        return STORES.slice(0, 3).map(s => ({
            ...s,
            price: product.price + Math.floor(Math.random() * 20) - 10 
        }));
    }, [product]);

    return (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex flex-col justify-end"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          
          <motion.div 
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="relative w-full bg-white rounded-t-[30px] p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            
            <div className="flex gap-4 mb-6">
                <div className="w-20 h-20 rounded-xl bg-gray-50 overflow-hidden flex-shrink-0">
                    <img src={product.image} className="w-full h-full object-cover mix-blend-multiply" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-[#262525] leading-tight mb-1">{product.name}</h2>
                    <p className="text-xs text-gray-400 mb-2">Finding nearby sellers...</p>
                </div>
            </div>

            <h3 className="text-sm font-bold text-[#262525] mb-4">Available at 3 Stores nearby</h3>
            
            <div className="space-y-3">
                {nearbySellers.map(store => (
                    <div key={store.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                            <img src={store.image} className="w-full h-full object-cover grayscale" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-[#262525]">{store.name}</h4>
                            <p className="text-xs text-gray-400">{store.distance} • {store.address.split(',')[1]}</p>
                        </div>
                        <div className="text-right">
                             <p className="text-sm font-black text-[#262525]">₹{store.price}</p>
                             <button 
                               onClick={() => onVisitStore(store.id)}
                               className="text-[10px] font-bold text-blue-600 mt-1"
                             >
                                VISIT STORE
                             </button>
                        </div>
                    </div>
                ))}
            </div>

          </motion.div>
        </motion.div>
    );
}

// ... Additional components maintained in App.tsx (DiningMenuView, DiningCheckoutView, etc.)
// Re-implementing them below to ensure full functionality

function DiningMenuView({ store, onBack, onProductClick, cart, addToCart, onProceed }: any) {
   const [activeCategory, setActiveCategory] = useState("Main Course");
   const categories = ["Recommended", "Starters", "Main Course", "Breads", "Desserts", "Beverages"];
   
   const products = store.products;
   const cartTotal = Object.keys(cart).length; 

   return (
     <motion.div 
       className="flex flex-col h-full bg-white z-40"
       initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
     >
       <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f8f8]">
          <div className="h-[250px] w-full relative">
             <img src={store.image} className="w-full h-full object-cover" alt="Cover" />
             <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
             <button onClick={onBack} className="absolute top-6 left-6 w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-white z-10 border border-white/20 hover:bg-white/30 transition-colors">
                <ArrowLeft className="w-5 h-5" />
             </button>
          </div>
          
          <div className="relative -mt-10 rounded-t-[30px] bg-[#f8f8f8] flex flex-col z-20 min-h-[calc(100%-240px)]">
             <div className="bg-white px-6 pb-5 pt-12 relative rounded-t-[30px] shadow-sm z-20">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full p-1 shadow-md flex items-center justify-center">
                    <div className="w-full h-full rounded-full bg-gray-50 flex items-center justify-center overflow-hidden">
                       <img src={store.image} className="w-full h-full object-cover" alt="Logo" />
                    </div>
                </div>
                
                <button className="absolute -top-6 right-8 w-12 h-12 bg-[#262525] rounded-xl flex items-center justify-center shadow-lg text-white hover:bg-black transition-colors">
                   <Heart className="w-5 h-5 fill-white" />
                </button>
                
                <div className="text-center mb-6">
                   <h1 className="text-2xl font-extrabold text-[#262525] mb-1">{store.name}</h1>
                   <p className="text-sm text-gray-500">{store.address}</p>
                </div>
                
                <div className="flex items-center justify-center gap-6 border-b border-dashed border-gray-100 pb-6 mb-0">
                   <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-[#262525] text-[#262525]" />
                      <span className="text-xs font-bold text-[#262525]">{store.rating}</span>
                   </div>
                   <div className="w-px h-8 bg-gray-100" />
                   <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#262525]" />
                      <span className="text-xs font-bold text-[#262525]">30 mins</span>
                   </div>
                   <div className="w-px h-8 bg-gray-100" />
                   <div className="flex items-center gap-1.5">
                      <Utensils className="w-4 h-4 text-[#262525]" />
                      <span className="text-xs font-bold text-[#262525]">Dine-in</span>
                   </div>
                </div>
             </div>
             
             <div className="sticky top-0 z-50 bg-white px-6 pt-5 -mt-5 pb-4 shadow-sm">
                <div className="space-y-4">
                     <div className="relative w-full h-11 bg-gray-50 rounded-xl flex items-center px-4 border border-transparent focus-within:border-gray-200 focus-within:bg-white transition-all">
                        <Search className="w-4 h-4 text-gray-400" />
                        <input type="text" placeholder={`Search menu in ${store.name}`} className="flex-1 ml-3 bg-transparent outline-none text-sm font-medium" />
                     </div>
                     <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {categories.map((cat) => (
                           <button 
                             key={cat}
                             onClick={() => setActiveCategory(cat)}
                             className={cn(
                               "px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border",
                               activeCategory === cat ? "bg-[#262525] text-white border-[#262525]" : "bg-white text-gray-500 border-gray-200"
                             )}
                           >
                             {cat}
                           </button>
                        ))}
                     </div>
                </div>
             </div>
 
             <div className="p-4 pb-32">
                <div className="grid grid-cols-2 gap-4">
                   {products.map((product: any) => {
                     const count = cart[product.id] || 0;
                     const increment = getIncrement(product.pricingType);
                     
                     return (
                       <div key={product.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col h-full relative">
                         <div 
                           className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-gray-50 cursor-pointer group"
                           onClick={() => onProductClick(product)}
                         >
                           <img src={product.image} alt={product.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                           
                           <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                               {product.isFewLeft && (
                                 <div className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 shadow-sm">
                                   Few Left
                                 </div>
                               )}
                               {product.isBestseller && (
                                 <div className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg border border-orange-100 shadow-sm">
                                   Bestseller
                                 </div>
                               )}
                           </div>

                            <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm flex items-center gap-1">
                               <Star className="w-2.5 h-2.5 fill-black text-black" />
                               <span className="text-[10px] font-bold">{product.rating}</span>
                            </div>
                         </div>
                         
                         <div onClick={() => onProductClick(product)} className="cursor-pointer mb-3">
                           <h3 className="text-sm font-bold text-[#262525] leading-tight mb-1">{product.name}</h3>
                           <p className="text-[10px] text-gray-400 line-clamp-2 mb-1.5 leading-snug h-[26px] overflow-hidden">{product.brief}</p>
                           
                           <div className="flex items-center gap-2">
                               <p className="text-sm font-medium text-gray-500">
                                  ₹{product.price} <span className="text-[10px] text-gray-400 font-normal">/{product.pricingType === 'weight' ? 'kg' : 'ea'}</span>
                               </p>
                               {product.discount > 0 && (
                                   <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1 rounded">
                                       {product.discount}% OFF
                                   </span>
                               )}
                           </div>
                         </div>
         
                         <div className="mt-auto">
                           {count === 0 ? (
                             <button 
                               onClick={() => addToCart(product.id, increment)}
                               className="w-full h-9 rounded-lg border border-gray-200 font-bold text-xs hover:bg-black hover:text-white hover:border-black transition-all"
                             >
                               ADD
                             </button>
                           ) : (
                             <div className="w-full h-9 rounded-lg bg-[#262525] flex items-center justify-between px-2 text-white shadow-md">
                               <button onClick={() => addToCart(product.id, -increment)} className="p-1"><Minus className="w-3 h-3" /></button>
                               <span className="text-xs font-bold">{formatQuantity(count, product.pricingType)}</span>
                               <button onClick={() => addToCart(product.id, increment)} className="p-1"><Plus className="w-3 h-3" /></button>
                             </div>
                           )}
                         </div>
                       </div>
                     );
                   })}
                </div>
             </div>
          </div>
       </div>

       {cartTotal > 0 && (
         <div className="absolute bottom-6 left-0 w-full px-4 z-40">
          <button 
            onClick={onProceed}
            className="w-full h-12 bg-[#262525] rounded-xl flex items-center justify-between px-6 text-white shadow-lg font-bold text-sm"
          >
              <span>{cartTotal} Items</span>
              <span className="flex items-center gap-2">Proceed to Pre-order <ChevronRight className="w-4 h-4" /></span>
          </button>
         </div>
       )}
     </motion.div>
   );
}

// ... Skipping repeating full code for StorefrontView, DiningCheckoutView, LocationView, CartView, CheckoutView, CouponsView, SuccessView, ProfileView, ProductDetailSheet, OnboardingView, LoginView, OtpView, SignupDetailsView, LocationPermissionView, SearchView to save space, but logically they should be here. 
// I WILL WRITE THEM FULLY NOW TO ENSURE NO BREAKAGE.

function DiningCheckoutView({ store, cart, onBack, onConfirm, getProduct }: any) {
    const items = Object.entries(cart).map(([id, qty]) => {
        const p = getProduct(parseInt(id));
        return p ? { ...p, qty } : null;
    }).filter(Boolean) as any[];

    const totalAmount = items.reduce((sum, item) => sum + calculateItemCost(item.qty, item.price, item.pricingType), 0);
    
    return (
        <motion.div 
          className="flex flex-col h-full bg-[#f8f8f8] z-[60]"
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
            <div className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                    <ChevronLeft className="w-6 h-6 text-[#262525]" />
                </button>
                <h1 className="text-lg font-bold text-[#262525]">Confirm Pre-order</h1>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                    <h2 className="text-lg font-bold text-[#262525]">{store.name}</h2>
                    <p className="text-xs text-gray-500">{store.address}</p>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100 space-y-4">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Arrival Details</h3>
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Time</label>
                            <select className="w-full h-10 bg-gray-50 rounded-lg px-2 text-sm font-bold border border-gray-200">
                                <option>Now (ASAP)</option>
                                <option>In 15 mins</option>
                                <option>In 30 mins</option>
                                <option>In 1 hour</option>
                            </select>
                        </div>
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">Guests</label>
                            <select className="w-full h-10 bg-gray-50 rounded-lg px-2 text-sm font-bold border border-gray-200">
                                <option>1 Person</option>
                                <option>2 People</option>
                                <option>3 People</option>
                                <option>4+ People</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-gray-100">
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Order Summary</h3>
                    <div className="space-y-3">
                        {items.map(item => (
                            <div key={item.id} className="flex justify-between items-center text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="w-5 h-5 bg-gray-100 rounded flex items-center justify-center text-[10px] font-bold">
                                        {formatQuantity(item.qty, item.pricingType)}
                                    </span>
                                    <span className="font-medium text-[#262525]">{item.name}</span>
                                </div>
                                <span className="font-bold">₹{calculateItemCost(item.qty, item.price, item.pricingType).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="border-t border-dashed border-gray-200 mt-4 pt-3 flex justify-between font-black text-lg text-[#262525]">
                        <span>Total Pay</span>
                        <span>₹{totalAmount.toFixed(0)}</span>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-white border-t border-gray-100">
                <button 
                  onClick={onConfirm}
                  className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors"
                >
                    Pay & Confirm
                </button>
            </div>
        </motion.div>
    )
}

function LocationView({ selectedLocation, onSelectLocation, onBack }: any) {
  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-50"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="px-6 pt-10 pb-4 border-b border-gray-100 flex items-center gap-4 bg-white sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-6 h-6 text-[#262525]" />
        </button>
        <h1 className="text-lg font-bold text-[#262525]">Select Location</h1>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#f8f8f8]">
        <div className="px-6 py-6 bg-white mb-2">
          <div className="relative w-full h-12 bg-gray-50 rounded-xl border border-gray-200 flex items-center px-4">
             <Search className="w-5 h-5 text-gray-400" />
             <input type="text" placeholder="Search area, street, name..." className="flex-1 ml-3 bg-transparent outline-none text-[#262525] font-medium" />
          </div>
        </div>

        <div className="bg-white p-6 mb-2">
          <button className="flex items-center gap-4 w-full text-left group">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-[#262525] group-hover:bg-[#262525] group-hover:text-white transition-colors">
              <Navigation className="w-5 h-5 transform rotate-45" />
            </div>
            <div>
              <h3 className="text-[#262525] font-bold">Use Current Location</h3>
              <p className="text-xs text-gray-400">Enable location services</p>
            </div>
          </button>
        </div>

        <div className="bg-white p-6 flex-1 min-h-[500px]">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Saved Addresses</h2>
             <button className="text-xs font-bold text-[#262525] flex items-center gap-1">
               <Plus className="w-3 h-3" /> ADD NEW
             </button>
          </div>

          <div className="space-y-4">
            {LOCATIONS.map((loc) => (
              <div 
                key={loc.type} 
                onClick={() => onSelectLocation(loc)}
                className={cn(
                  "flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all",
                  selectedLocation.type === loc.type 
                    ? "border-[#262525] bg-gray-50" 
                    : "border-gray-100 hover:border-gray-300"
                )}
              >
                <div className="mt-1">
                  {loc.type === "Home" ? <Home className="w-5 h-5" /> : <Briefcase className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-[#262525]">{loc.type}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{loc.address}</p>
                </div>
                {selectedLocation.type === loc.type && (
                  <div className="w-5 h-5 rounded-full bg-[#262525] flex items-center justify-center mt-1">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StorefrontView({ store, onBack, onProductClick, cart, addToCart, cartSummary, onViewCart }: any) {
  const [activeCategory, setActiveCategory] = useState("All");
  
  const productCats = Array.from(new Set(store.products.map((p: any) => p.category)));
  
  const specialFilters = [
      { id: "rated_4", label: "Rated 4.0+" },
      { id: "offers", label: "On Offer" },
      { id: "bestseller", label: "Bestseller" }
  ];
  
  const categories = ["All", ...specialFilters.map(f => f.label), ...productCats];
  
  const filteredProducts = store.products.filter((p: any) => {
      if (activeCategory === "All") return true;
      if (activeCategory === "Rated 4.0+") return parseFloat(p.rating) >= 4.0;
      if (activeCategory === "On Offer") return p.discount > 0;
      if (activeCategory === "Bestseller") return p.isBestseller;
      return p.category === activeCategory;
  });

  const offerSettings = {
    dots: false, infinite: true, speed: 4000, slidesToShow: 2.2, slidesToScroll: 1, autoplay: true, arrows: false,
    className: "center !mb-0", centerMode: false
  };

  return (
    <motion.div 
      className="h-full bg-white z-40 relative flex flex-col"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="flex-1 overflow-y-auto no-scrollbar bg-[#f8f8f8] relative">
          
          <div className="relative w-full h-[280px]">
             <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
             <div className="absolute inset-0 bg-black/10" />
             
             <button 
                onClick={onBack} 
                className="absolute top-10 left-6 w-10 h-10 bg-white/90 backdrop-blur-md rounded-xl flex items-center justify-center shadow-sm z-30 hover:bg-white transition-colors"
             >
                <ChevronLeft className="w-6 h-6 text-[#262525]" />
             </button>
          </div>

          <div className="relative -mt-10 rounded-t-[30px] bg-[#f8f8f8] flex flex-col z-20 min-h-[calc(100%-240px)]">
             
             <div className="bg-white px-6 pb-5 pt-12 relative rounded-t-[30px] shadow-sm z-20">
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-16 h-16 bg-white rounded-full p-1 shadow-md flex items-center justify-center">
                   <img src={store.image} alt="Logo" className="w-full h-full rounded-full object-cover" />
                </div>

                <button className="absolute -top-6 right-8 w-12 h-12 bg-[#262525] rounded-xl flex items-center justify-center shadow-lg text-white hover:bg-black transition-colors">
                   <Heart className="w-5 h-5 fill-white" />
                </button>

                <div className="text-center mb-6">
                   <h1 className="text-2xl font-extrabold text-[#262525] mb-1">{store.name}</h1>
                   <p className="text-sm text-gray-500">{store.address.split(',').slice(0, 2).join(',')}</p>
                </div>

                <div className="flex items-center justify-center gap-6 border-b border-dashed border-gray-100 pb-6 mb-6">
                   <div className="flex items-center gap-1.5">
                      <Star className="w-4 h-4 fill-[#262525] text-[#262525]" />
                      <span className="text-xs font-bold text-[#262525]">{store.rating} <span className="font-normal text-gray-400">(1k+)</span></span>
                   </div>
                   <div className="w-px h-8 bg-gray-100" />
                   <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-[#262525]" />
                      <span className="text-xs font-bold text-[#262525]">25 mins</span>
                   </div>
                   <div className="w-px h-8 bg-gray-100" />
                   <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-4 h-4 text-[#262525]" />
                      <span className="text-xs font-bold text-[#262525]">Store Pickup</span>
                   </div>
                </div>

                <div className="mb-0">
                    <Slider {...offerSettings}>
                        {OFFERS.map((offer) => (
                            <div key={offer.id} className="px-1 outline-none">
                                <div className={`h-[70px] rounded-xl ${offer.color} p-3 flex flex-col justify-center`}>
                                    <h3 className="text-sm font-extrabold leading-none mb-1">{offer.title}</h3>
                                    <p className="text-[10px] font-medium opacity-80 leading-tight">{offer.subtitle}</p>
                                </div>
                            </div>
                        ))}
                    </Slider>
                </div>
             </div>

             <div className="sticky top-0 z-50 bg-white px-6 pt-5 -mt-5 pb-4 shadow-sm">
                <div className="space-y-4">
                    <div className="relative w-full h-11 bg-gray-50 rounded-xl flex items-center px-4 border border-transparent focus-within:border-gray-200 focus-within:bg-white transition-all">
                       <Search className="w-4 h-4 text-gray-400" />
                       <input type="text" placeholder={`Search inside ${store.name}`} className="flex-1 ml-3 bg-transparent outline-none text-sm font-medium" />
                    </div>

                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                       {categories.map((cat: any) => (
                          <button 
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={cn(
                              "px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors border",
                              activeCategory === cat ? "bg-[#262525] text-white border-[#262525]" : "bg-white text-gray-500 border-gray-200"
                            )}
                          >
                            {cat.charAt(0).toUpperCase() + cat.slice(1)}
                          </button>
                       ))}
                    </div>
                </div>
             </div>

             <div className="p-4 pb-32">
                <div className="grid grid-cols-2 gap-4">
                  {filteredProducts.map((product: any) => {
                    const count = cart[product.id] || 0;
                    const increment = getIncrement(product.pricingType);
                    
                    return (
                      <div key={product.id} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm flex flex-col h-full relative">
                        <div 
                          className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-gray-50 cursor-pointer group"
                          onClick={() => onProductClick(product)}
                        >
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover mix-blend-multiply group-hover:scale-105 transition-transform duration-500" />
                          
                          <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                              {product.isFewLeft && (
                                <div className="px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg border border-red-100 shadow-sm">
                                  Few Left
                                </div>
                              )}
                              {product.isBestseller && (
                                <div className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded-lg border border-orange-100 shadow-sm">
                                  Bestseller
                                </div>
                              )}
                          </div>

                           <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-white/90 backdrop-blur-sm rounded-md shadow-sm flex items-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-black text-black" />
                              <span className="text-[10px] font-bold">{product.rating}</span>
                           </div>
                        </div>
                        
                        <div onClick={() => onProductClick(product)} className="cursor-pointer mb-3">
                          <h3 className="text-sm font-bold text-[#262525] leading-tight mb-1">{product.name}</h3>
                          <p className="text-[10px] text-gray-400 line-clamp-2 mb-1.5 leading-snug h-[26px] overflow-hidden">{product.brief}</p>
                          
                          <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-gray-500">
                                 ₹{product.price} <span className="text-[10px] text-gray-400 font-normal">/{product.pricingType === 'weight' ? 'kg' : 'ea'}</span>
                              </p>
                              {product.discount > 0 && (
                                  <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1 rounded">
                                      {product.discount}% OFF
                                  </span>
                              )}
                          </div>
                        </div>

                        <div className="mt-auto">
                          {count === 0 ? (
                            <button 
                              onClick={() => addToCart(product.id, increment)}
                              className="w-full h-9 rounded-lg border border-gray-200 font-bold text-xs hover:bg-black hover:text-white hover:border-black transition-all"
                            >
                              ADD
                            </button>
                          ) : (
                            <div className="w-full h-9 rounded-lg bg-[#262525] flex items-center justify-between px-2 text-white shadow-md">
                              <button onClick={() => addToCart(product.id, -increment)} className="p-1"><Minus className="w-3 h-3" /></button>
                              <span className="text-xs font-bold">{formatQuantity(count, product.pricingType)}</span>
                              <button onClick={() => addToCart(product.id, increment)} className="p-1"><Plus className="w-3 h-3" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
             </div>
          </div>
      </div>

       <AnimatePresence>
        {cartSummary && <ViewCartBar summary={cartSummary} onClick={onViewCart} />}
      </AnimatePresence>
    </motion.div>
  );
}

function CartView({ cart, onBack, onUpdateQuantity, onCheckout, onApplyCoupon, appliedCoupon, getProduct }: any) {
  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const product = getProduct(parseInt(id));
    return product ? { ...product, qty } : null;
  }).filter(Boolean) as any[];

  const totalAmount = cartItems.reduce((sum, item) => sum + calculateItemCost(item.qty, item.price, item.pricingType), 0);
  
  const discount = appliedCoupon ? 50 : 0; 
  const tax = (totalAmount - discount) * 0.05;
  const platformFee = 15;
  const finalTotal = totalAmount - discount + tax + platformFee;

  const groupedItems = cartItems.reduce((acc: any, item: any) => {
    if (!acc[item.storeId]) acc[item.storeId] = [];
    acc[item.storeId].push(item);
    return acc;
  }, {});

  const getStore = (id: number) => RESTAURANTS.find(r => r.id === id) || STORES.find(s => s.id === id);

  const hasItems = cartItems.length > 0;

  return (
    <motion.div 
      className="flex flex-col h-full bg-[#f8f8f8] z-50"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 -ml-2 rounded-xl hover:bg-gray-100">
            <ChevronLeft className="w-6 h-6 text-[#262525]" />
          </button>
          <h1 className="text-lg font-bold text-[#262525]">My Cart</h1>
        </div>
        {hasItems && (
           <button className="text-xs font-bold text-red-500 hover:text-red-700">CLEAR ALL</button>
        )}
      </div>

      {!hasItems ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
          <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg font-bold text-gray-300">Your cart is empty</p>
          <button onClick={onBack} className="mt-6 px-6 py-3 rounded-xl bg-[#262525] text-white font-bold text-sm">Start Shopping</button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-32">
          
          {Object.keys(groupedItems).map((storeId) => {
            const store = getStore(parseInt(storeId));
            const items = groupedItems[storeId];
            return (
              <div key={storeId} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-50">
                   <div>
                     <h3 className="font-bold text-[#262525]">{store?.name}</h3>
                     <p className="text-[10px] text-gray-400">Items to be picked up from here</p>
                   </div>
                   {store?.branches && (
                     <div className="flex items-center gap-1 text-[11px] font-bold bg-gray-50 px-2 py-1 rounded-md text-[#262525] cursor-pointer hover:bg-gray-100">
                        {store.branches[0]} <ChevronDown className="w-3 h-3" />
                     </div>
                   )}
                </div>

                <div className="space-y-4">
                  {items.map((item: any) => {
                    const increment = getIncrement(item.pricingType);
                    return (
                        <div key={item.id} className="flex items-center gap-3">
                        <div className="w-14 h-14 rounded-lg bg-gray-50 overflow-hidden flex-shrink-0">
                            <img src={item.image} className="w-full h-full object-cover mix-blend-multiply" alt={item.name} />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-[#262525]">{item.name}</h4>
                            <p className="text-xs font-medium text-gray-500">
                                ₹{item.price} <span className="text-[10px] font-normal">/{item.pricingType === 'weight' ? 'kg' : 'ea'}</span>
                            </p>
                        </div>
                        <div className="h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center px-2 gap-3">
                            <button onClick={() => onUpdateQuantity(item.id, -increment)}><Minus className="w-3 h-3" /></button>
                            <span className="text-xs font-bold">{formatQuantity(item.qty, item.pricingType)}</span>
                            <button onClick={() => onUpdateQuantity(item.id, increment)}><Plus className="w-3 h-3" /></button>
                        </div>
                        </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div onClick={onApplyCoupon} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors">
             <Ticket className="w-5 h-5 text-[#262525]" />
             <div className="flex-1">
                {appliedCoupon ? (
                    <span className="text-sm font-bold text-green-600">Coupon {appliedCoupon} applied!</span>
                ) : (
                    <span className="text-sm font-bold text-[#262525]">Apply Coupon</span>
                )}
             </div>
             <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>

          <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-2">
             <div className="flex justify-between text-sm text-gray-500">
               <span>Item Total</span>
               <span>₹{totalAmount.toFixed(2)}</span>
             </div>
             {appliedCoupon && (
                <div className="flex justify-between text-sm text-green-600 font-bold">
                    <span>Discount</span>
                    <span>-₹{discount.toFixed(2)}</span>
                </div>
             )}
             <div className="flex justify-between text-sm text-gray-500">
               <span>Taxes & Charges</span>
               <span>₹{tax.toFixed(2)}</span>
             </div>
             <div className="flex justify-between text-sm text-gray-500">
               <span>Platform Fee</span>
               <span>₹{platformFee.toFixed(2)}</span>
             </div>
             <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between font-bold text-[#262525]">
               <span>To Pay</span>
               <span>₹{finalTotal.toFixed(2)}</span>
             </div>
          </div>
        </div>
      )}

      {hasItems && (
        <div className="absolute bottom-0 left-0 w-full bg-white p-6 border-t border-gray-100 shadow-2xl z-20 rounded-t-[30px]">
          <button 
            onClick={onCheckout}
            className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg flex items-center justify-between px-6 hover:bg-black transition-colors"
          >
             <span>Proceed to Pay</span>
             <span>₹{finalTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

function CheckoutView({ cart, onBack, onPlaceOrder, getProduct }: any) {
  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const product = getProduct(parseInt(id));
    return product ? { ...product, qty } : null;
  }).filter(Boolean) as any[];

  const groupedItems = cartItems.reduce((acc: any, item: any) => {
    if (!acc[item.storeId]) acc[item.storeId] = [];
    acc[item.storeId].push(item);
    return acc;
  }, {});

  const getStore = (id: number) => RESTAURANTS.find(r => r.id === id) || STORES.find(s => s.id === id);

  const [paymentMethod, setPaymentMethod] = useState("upi");
  const [pickupFor, setPickupFor] = useState("self");
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState("Today, 6:00 PM - 7:00 PM");

  return (
    <motion.div 
      className="flex flex-col h-full bg-[#f8f8f8] z-[60]"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
        <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ChevronLeft className="w-6 h-6 text-[#262525]" />
        </button>
        <h1 className="text-lg font-bold text-[#262525]">Checkout</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-32">
        <div>
           <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Pickup Locations</h2>
           <div className="space-y-4">
             {Object.keys(groupedItems).map((storeId, idx) => {
               const store = getStore(parseInt(storeId));
               return (
                 <div key={storeId} className="bg-white rounded-2xl border border-gray-100 overflow-hidden relative">
                    <div className="h-24 bg-gray-200 w-full map-placeholder opacity-50 relative">
                       <div className="absolute inset-0 flex items-center justify-center">
                         <div className="px-3 py-1 bg-white/90 backdrop-blur rounded-full shadow-sm text-[10px] font-bold flex items-center gap-1">
                           <MapPin className="w-3 h-3" /> {store?.name}
                         </div>
                       </div>
                    </div>
                    
                    <div className="p-4">
                       <div className="flex items-start justify-between mb-3">
                         <div>
                            <h3 className="font-bold text-[#262525]">Stop {idx + 1}: {store?.branches ? store.branches[0] : store?.address.split(',')[1]}</h3>
                            <p className="text-xs text-gray-500 mt-1 w-3/4">{store?.address}</p>
                         </div>
                       </div>
                       
                       <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between border border-gray-100">
                          <div className="flex items-center gap-2">
                             <Clock className="w-4 h-4 text-[#262525]" />
                             <span className="text-sm font-bold">{selectedTimeSlot}</span>
                          </div>
                          <button onClick={() => setIsTimePickerOpen(true)} className="text-xs font-bold text-[#262525] underline cursor-pointer hover:text-black">Change</button>
                       </div>
                    </div>
                 </div>
               )
             })}
           </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100">
           <h2 className="text-sm font-bold text-[#262525] mb-4">Picking up for</h2>
           <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
              <button 
                onClick={() => setPickupFor("self")}
                className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", pickupFor === "self" ? "bg-white shadow-sm text-[#262525]" : "text-gray-400")}
              >
                Myself
              </button>
              <button 
                onClick={() => setPickupFor("others")}
                className={cn("flex-1 py-2 text-xs font-bold rounded-lg transition-all", pickupFor === "others" ? "bg-white shadow-sm text-[#262525]" : "text-gray-400")}
              >
                Someone Else
              </button>
           </div>
           
           {pickupFor === "self" ? (
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden">
                    <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdmF0YXJ8ZW58MXx8fHwxNzY4NjM4NDIxfDA&ixlib=rb-4.1.0&q=80&w=400" className="w-full h-full object-cover" alt="Avatar" />
                  </div>
                  <div>
                     <p className="text-sm font-bold text-[#262525]">Alex Johnson</p>
                     <p className="text-xs text-gray-500">+91 98765 43210</p>
                  </div>
               </div>
           ) : (
               <div className="space-y-3">
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 focus-within:border-gray-400 focus-within:bg-white transition-colors">
                      <Contact className="w-4 h-4 text-gray-400" />
                      <input type="text" placeholder="Name" className="flex-1 bg-transparent outline-none text-sm" />
                  </div>
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-gray-200 bg-gray-50 focus-within:border-gray-400 focus-within:bg-white transition-colors">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <input type="tel" placeholder="Phone Number" className="flex-1 bg-transparent outline-none text-sm" />
                  </div>
                  <button className="w-full h-10 border border-black text-[#262525] rounded-lg text-xs font-bold hover:bg-black hover:text-white transition-colors">
                      Pick from Contacts
                  </button>
               </div>
           )}
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100">
           <h2 className="text-sm font-bold text-[#262525] mb-4">Payment Method</h2>
           <div className="space-y-3">
              <label className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all", paymentMethod === "upi" ? "border-[#262525] bg-gray-50" : "border-gray-100")}>
                 <input type="radio" name="payment" value="upi" checked={paymentMethod === "upi"} onChange={() => setPaymentMethod("upi")} className="accent-black" />
                 <span className="text-sm font-bold flex-1">UPI (PhonePe / GPay)</span>
              </label>
              <label className={cn("flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all", paymentMethod === "card" ? "border-[#262525] bg-gray-50" : "border-gray-100")}>
                 <input type="radio" name="payment" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} className="accent-black" />
                 <span className="text-sm font-bold flex-1">Credit / Debit Card</span>
              </label>
           </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 w-full bg-white p-6 border-t border-gray-100 shadow-2xl z-20 rounded-t-[30px]">
         <button 
           onClick={onPlaceOrder}
           className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors"
         >
            Place Order
         </button>
      </div>

      <AnimatePresence>
        {isTimePickerOpen && (
           <TimeSelectorSheet 
              onClose={() => setIsTimePickerOpen(false)} 
              onSelect={(time: string) => {
                  setSelectedTimeSlot(time);
                  setIsTimePickerOpen(false);
              }}
              selected={selectedTimeSlot}
           />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CouponsView({ onBack, onApply }: any) {
    const COUPON_BANNERS = [
        "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzaG9wcGluZyUyMHNhbGV8ZW58MXx8fHwxNzY4NjYwMDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
        "https://images.unsplash.com/photo-1472851294608-415105022054?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmb29kJTIwb2ZmZXJ8ZW58MXx8fHwxNzY4NjYwMDAwfDA&ixlib=rb-4.1.0&q=80&w=1080",
    ];

    const COUPONS = [
        { code: "WELCOME50", desc: "Get 50% off on your first order", max: "Max ₹100" },
        { code: "HDFC20", desc: "Flat 20% off on HDFC Cards", max: "Min order ₹500" },
        { code: "FREESHIP", desc: "Free delivery on all orders", max: "Limited time" },
    ];

    const bannerSettings = {
        dots: true, infinite: true, speed: 500, slidesToShow: 1, slidesToScroll: 1, autoplay: true, autoplaySpeed: 4000, arrows: false,
        appendDots: (dots: React.ReactNode) => <div style={{ bottom: "10px" }}><ul className="flex justify-center gap-2 m-0 p-0">{dots}</ul></div>
    };

    return (
        <motion.div 
          className="flex flex-col h-full bg-[#f8f8f8] z-[60]"
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        >
            <div className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
                <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
                    <ChevronLeft className="w-6 h-6 text-[#262525]" />
                </button>
                <h1 className="text-lg font-bold text-[#262525]">Apply Coupon</h1>
            </div>

            <div className="flex-1 overflow-y-auto pb-8">
                <div className="p-4 bg-white mb-2">
                    <div className="flex gap-2">
                        <div className="flex-1 h-12 bg-gray-50 rounded-xl border border-gray-200 flex items-center px-4">
                            <input type="text" placeholder="Enter coupon code" className="flex-1 bg-transparent outline-none text-sm font-bold uppercase placeholder:normal-case placeholder:font-normal" />
                        </div>
                        <button className="h-12 px-6 font-bold text-[#262525] rounded-xl hover:bg-gray-100">APPLY</button>
                    </div>
                </div>

                <div className="mb-6 px-4">
                    <div className="rounded-xl overflow-hidden shadow-sm">
                        <Slider {...bannerSettings}>
                            {COUPON_BANNERS.map((img, i) => (
                                <div key={i} className="outline-none">
                                    <div className="h-32 w-full bg-gray-200">
                                        <img src={img} className="w-full h-full object-cover contrast-125 grayscale" alt="Offer" />
                                    </div>
                                </div>
                            ))}
                        </Slider>
                    </div>
                </div>

                <div className="px-4 space-y-4">
                    <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1">Available Coupons</h2>
                    {COUPONS.map((coupon, idx) => (
                        <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm relative overflow-hidden">
                            <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#262525]"></div>
                            <div className="flex justify-between items-center pl-2">
                                <div>
                                    <h3 className="font-black text-lg text-[#262525]">{coupon.code}</h3>
                                    <p className="text-sm text-gray-600 font-medium mb-1">{coupon.desc}</p>
                                    <p className="text-[10px] text-gray-400 bg-gray-50 inline-block px-1.5 py-0.5 rounded">{coupon.max}</p>
                                </div>
                                <button 
                                  onClick={() => onApply(coupon.code)}
                                  className="text-xs font-bold text-[#262525] px-4 py-2 bg-gray-100 rounded-lg hover:bg-[#262525] hover:text-white transition-colors"
                                >
                                    APPLY
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    )
}

function TimeSelectorSheet({ onClose, onSelect, selected }: any) {
    const slots = [
        "10:00 AM - 11:00 AM", "11:00 AM - 12:00 PM", "12:00 PM - 01:00 PM",
        "04:00 PM - 05:00 PM", "05:00 PM - 06:00 PM", "06:00 PM - 07:00 PM",
        "07:00 PM - 08:00 PM", "08:00 PM - 09:00 PM"
    ];
    const [day, setDay] = useState("Today");

    return (
        <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] flex flex-col justify-end"
        >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            
            <motion.div 
                initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="relative w-full bg-white rounded-t-[30px] p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
                
                <h2 className="text-lg font-bold text-[#262525] mb-6 text-center">Select Pickup Time</h2>

                <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
                    {["Today", "Tomorrow"].map(d => (
                        <button 
                          key={d}
                          onClick={() => setDay(d)}
                          className={cn("flex-1 py-2 text-sm font-bold rounded-lg transition-all", day === d ? "bg-white shadow-sm text-[#262525]" : "text-gray-400")}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mb-8">
                    {slots.map(slot => {
                        const fullSlot = `${day}, ${slot}`;
                        const isSelected = selected === fullSlot;
                        return (
                            <button 
                                key={slot}
                                onClick={() => onSelect(fullSlot)}
                                className={cn(
                                    "py-3 px-2 rounded-xl text-xs font-bold border transition-all",
                                    isSelected ? "bg-[#262525] text-white border-[#262525]" : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                                )}
                            >
                                {slot}
                            </button>
                        )
                    })}
                </div>
            </motion.div>
        </motion.div>
    )
}

function SuccessView({ cart, onHome }: any) {
  const storeIds = useMemo(() => {
    if (!cart) return [];
    const ids = new Set<number>();
    Object.keys(cart).forEach(prodId => {
      const product = ALL_PRODUCTS.find(p => p.id === parseInt(prodId));
      if (product?.storeId) ids.add(product.storeId);
    });
    return Array.from(ids);
  }, [cart]);

  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-[70] items-center justify-center p-8 text-center"
      initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
    >
      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
         <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      
      <h1 className="text-2xl font-black text-[#262525] mb-2">Order Confirmed!</h1>
      <p className="text-gray-500 mb-10 max-w-[250px]">Your order has been successfully placed. Please check your OTPs below.</p>

      <div className="w-full space-y-4 mb-10 max-h-[300px] overflow-y-auto no-scrollbar">
         {storeIds.map(storeId => {
           const store = RESTAURANTS.find(r => r.id === storeId) || STORES.find(s => s.id === storeId);
           const otp = Math.floor(1000 + (storeId * 123) % 9000); 
           
           return (
             <div key={storeId} className="bg-gray-50 rounded-2xl p-4 border border-gray-100 flex items-center justify-between">
                <div className="text-left">
                   <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">OTP for</p>
                   <p className="font-bold text-[#262525] text-sm line-clamp-1 w-[120px]">{store?.name}</p>
                </div>
                <div className="bg-white px-4 py-2 rounded-xl border border-dashed border-gray-300">
                   <span className="text-xl font-mono font-black text-[#262525] tracking-widest">{otp}</span>
                </div>
             </div>
           );
         })}
         {storeIds.length === 0 && (
            <p className="text-sm text-gray-400">No items found for OTP generation.</p>
         )}
      </div>

      <button 
        onClick={onHome}
        className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors"
      >
        Back to Home
      </button>
    </motion.div>
  )
}

function ProfileView({ onBack }: any) {
  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-50"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="px-6 pt-10 pb-6 bg-white border-b border-gray-100 flex items-center justify-between sticky top-0 z-20">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center hover:bg-gray-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-[#262525]" />
        </button>
        <h1 className="text-lg font-bold text-[#262525]">My Profile</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-6 py-8 flex flex-col items-center justify-center border-b border-gray-50">
            <div className="w-24 h-24 rounded-full bg-gray-200 mb-4 overflow-hidden border-2 border-white shadow-sm">
              <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhdmF0YXJ8ZW58MXx8fHwxNzY4NjM4NDIxfDA&ixlib=rb-4.1.0&q=80&w=400" alt="Profile" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-xl font-bold text-[#262525]">Alex Johnson</h2>
            <p className="text-sm text-gray-500 font-medium">alex.johnson@example.com</p>
            <div className="mt-4 px-4 py-1.5 rounded-full bg-black text-white text-xs font-bold tracking-wide">MEMBER</div>
        </div>

        <div className="p-6 grid grid-cols-2 gap-4">
            <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[1.2] border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
              <ShoppingBag className="w-8 h-8 text-[#262525]" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-[#262525]">Orders</span>
              <span className="text-[10px] text-gray-500">2 Active</span>
            </div>
            <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 aspect-[1.2] border border-gray-100 cursor-pointer hover:bg-gray-100 transition-colors">
              <Heart className="w-8 h-8 text-[#262525]" strokeWidth={1.5} />
              <span className="text-sm font-semibold text-[#262525]">Favorites</span>
              <span className="text-[10px] text-gray-500">12 Items</span>
            </div>
        </div>

        <div className="px-6 pb-12 space-y-2">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">Account</p>
            <ProfileMenuItem icon={Store} label="My Stores" subLabel="Manage pickup locations" />
            <ProfileMenuItem icon={CreditCard} label="Payment Methods" subLabel="Visa ending in 4242" />
            <ProfileMenuItem icon={MapPin} label="Addresses" subLabel="Home, Work" />
            <div className="my-6 h-[1px] bg-gray-100"></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">App Settings</p>
            <ProfileMenuItem icon={Settings} label="Notifications" />
            <ProfileMenuItem icon={LogOut} label="Log Out" isDestructive />
        </div>
      </div>
    </motion.div>
  );
}

function ProfileMenuItem({ icon: Icon, label, subLabel, isDestructive = false }: { icon: any, label: string, subLabel?: string, isDestructive?: boolean }) {
  return (
    <button className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors group">
      <div className="flex items-center gap-4">
         <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isDestructive ? "bg-red-50 text-red-500" : "bg-white border border-gray-100 text-[#262525]")}>
            <Icon className="w-5 h-5" strokeWidth={1.5} />
         </div>
         <div className="flex flex-col items-start">
            <span className={cn("text-sm font-semibold", isDestructive ? "text-red-500" : "text-[#262525]")}>{label}</span>
            {subLabel && <span className="text-[11px] text-gray-400">{subLabel}</span>}
         </div>
      </div>
      {!isDestructive && <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />}
    </button>
  )
}

function ProductDetailSheet({ product, onClose, cartCount, onAdd }: any) {
  const increment = getIncrement(product.pricingType);
  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex flex-col justify-end"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative w-full bg-white rounded-t-[30px] p-6 shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
        
        <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-6 bg-gray-50">
           <img src={product.image} alt={product.name} className="w-full h-full object-cover mix-blend-multiply" />
        </div>

        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold text-[#262525] mb-2">{product.name}</h2>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-md border border-green-100">
                IN STOCK
              </span>
              <span className="text-xs text-gray-400">• {product.category}</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#262525]">
            ₹{product.price}
            <span className="text-sm font-normal text-gray-400">/{product.pricingType === 'weight' ? 'kg' : 'ea'}</span>
          </p>
        </div>

        <p className="text-gray-500 text-sm leading-relaxed mb-8">
          {product.description}
        </p>

        <div className="space-y-4">
          {cartCount === 0 ? (
            <button 
              onClick={() => onAdd(increment)}
              className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors shadow-lg shadow-black/20"
            >
              Add to Cart
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-14 bg-gray-100 rounded-xl flex items-center justify-between px-6">
                <button onClick={() => onAdd(-increment)} className="p-2"><Minus className="w-5 h-5" /></button>
                <span className="text-xl font-bold">{formatQuantity(cartCount, product.pricingType)}</span>
                <button onClick={() => onAdd(increment)} className="p-2"><Plus className="w-5 h-5" /></button>
              </div>
              <button 
                onClick={onClose}
                className="h-14 px-8 bg-[#262525] text-white rounded-xl font-bold"
              >
                Done
              </button>
            </div>
          )}

          <div className="flex justify-center pt-2">
             <button 
               onClick={() => toast.success("Report submitted successfully")}
               className="text-xs font-semibold text-gray-400 hover:text-red-500 flex items-center gap-1.5 transition-colors"
             >
               <AlertCircle className="w-3.5 h-3.5" />
               Report Price Discrepancy
             </button>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
}

function OnboardingView({ onComplete }: any) {
  const slides = [
    {
      img: "https://images.unsplash.com/photo-1663028051021-07b4f67a6bd7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwaWNraW5nJTIwdXAlMjBzaG9wcGluZyUyMGJhZ3MlMjBpbiUyMHN0b3JlJTIwaGFwcHl8ZW58MXx8fHwxNzY4NjY2NzYxfDA&ixlib=rb-4.1.0&q=80&w=1080",
      title: "Buy Online, Pick Up In Store",
      desc: "Skip the delivery wait. Shop from your favorite local stores and pick up when it suits you."
    },
    {
      img: "https://images.unsplash.com/photo-1714038918910-daa51af9fccd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmllbmRzJTIwZWF0aW5nJTIwYXQlMjByZXN0YXVyYW50JTIwdGFibGUlMjBoYXBweXxlbnwxfHx8fDE3Njg2NjY3NjF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      title: "Dine Like a Pro",
      desc: "Reserve tables or pre-order your meals at top restaurants. Your food is ready when you arrive."
    },
    {
      img: "https://images.unsplash.com/photo-1669508886393-d3ec02f4a330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxkZWxpdmVyeSUyMG1hcCUyMGxvY2F0aW9uJTIwcGluJTIwY2l0eXxlbnwxfHx8fDE3Njg2NjY3NjF8MA&ixlib=rb-4.1.0&q=80&w=1080",
      title: "Local Gems, Near You",
      desc: "Discover hidden gems and popular spots in your neighborhood. Support local businesses."
    }
  ];

  const [currentSlide, setCurrentSlide] = useState(0);

  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-[80]"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
       <div className="flex-1 relative">
         <AnimatePresence mode="wait">
            <motion.div 
              key={currentSlide}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0"
            >
               <img src={slides[currentSlide].img} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-white"></div>
            </motion.div>
         </AnimatePresence>
       </div>

       <div className="px-8 pb-12 pt-6 bg-white z-10 flex flex-col items-center text-center">
          <div className="flex gap-2 mb-8">
             {slides.map((_, i) => (
                <div key={i} className={cn("w-2 h-2 rounded-full transition-all duration-300", currentSlide === i ? "w-6 bg-[#262525]" : "bg-gray-300")} />
             ))}
          </div>

          <h2 className="text-2xl font-black text-[#262525] mb-4 h-16 flex items-center justify-center">{slides[currentSlide].title}</h2>
          <p className="text-gray-500 mb-8 text-sm leading-relaxed max-w-xs h-16">{slides[currentSlide].desc}</p>

          <button 
            onClick={() => {
               if (currentSlide < slides.length - 1) {
                  setCurrentSlide(prev => prev + 1);
               } else {
                  onComplete();
               }
            }}
            className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors flex items-center justify-center gap-2"
          >
             {currentSlide === slides.length - 1 ? "Get Started" : "Next"}
             <ChevronRight className="w-5 h-5" />
          </button>
       </div>
    </motion.div>
  )
}

function LoginView({ onBack, onSendOtp }: any) {
  const [phone, setPhone] = useState("");

  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-[80] p-6"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
       <button onClick={onBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-gray-100 mb-8">
          <ArrowLeft className="w-6 h-6 text-[#262525]" />
       </button>

       <h1 className="text-3xl font-black text-[#262525] mb-2">Let's get started</h1>
       <p className="text-gray-500 mb-10">Enter your phone number to continue</p>

       <div className="mb-8">
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 block">Phone Number</label>
          <div className="flex items-center gap-3 h-14 border-b-2 border-gray-100 focus-within:border-[#262525] transition-colors">
             <span className="text-lg font-bold text-gray-400">+91</span>
             <input 
               type="tel" 
               value={phone}
               onChange={(e) => setPhone(e.target.value)}
               placeholder="98765 43210"
               className="flex-1 bg-transparent outline-none text-xl font-bold text-[#262525] placeholder:text-gray-200"
               maxLength={10}
               autoFocus
             />
          </div>
       </div>

       <button 
         onClick={() => {
            if (phone.length === 10) onSendOtp(phone);
            else toast.error("Please enter a valid 10-digit number");
         }}
         className={cn(
            "w-full h-14 rounded-xl font-bold text-lg transition-colors mt-auto mb-4",
            phone.length === 10 ? "bg-[#262525] text-white hover:bg-black" : "bg-gray-100 text-gray-400 cursor-not-allowed"
         )}
       >
         Continue
       </button>
       
       <p className="text-[10px] text-center text-gray-400 leading-normal">
          By clicking continue, you agree to our <span className="text-[#262525] font-bold">Terms of Service</span> and <span className="text-[#262525] font-bold">Privacy Policy</span>
       </p>
    </motion.div>
  )
}

function OtpView({ phone, onBack, onVerify }: any) {
  const [otp, setOtp] = useState(["", "", "", ""]);
  const inputs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, value: string) => {
     if (isNaN(Number(value))) return;
     const newOtp = [...otp];
     newOtp[index] = value;
     setOtp(newOtp);

     if (value && index < 3) {
        inputs.current[index + 1]?.focus();
     }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
     if (e.key === "Backspace" && !otp[index] && index > 0) {
        inputs.current[index - 1]?.focus();
     }
  };

  const isComplete = otp.every(digit => digit !== "");

  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-[80] p-6"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
       <button onClick={onBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-gray-100 mb-8">
          <ArrowLeft className="w-6 h-6 text-[#262525]" />
       </button>

       <h1 className="text-3xl font-black text-[#262525] mb-2">Verify Phone</h1>
       <p className="text-gray-500 mb-10">
          Enter the 4-digit code sent to <br/> 
          <span className="font-bold text-[#262525]">+91 {phone}</span>
          <button onClick={onBack} className="text-xs font-bold text-blue-600 ml-2">Edit</button>
       </p>

       <div className="flex gap-4 justify-center mb-10">
          {otp.map((digit, index) => (
             <input
               key={index}
               ref={el => inputs.current[index] = el}
               type="text"
               value={digit}
               onChange={(e) => handleChange(index, e.target.value.slice(-1))}
               onKeyDown={(e) => handleKeyDown(index, e)}
               className="w-14 h-16 rounded-xl border-2 border-gray-100 text-center text-2xl font-black text-[#262525] focus:border-[#262525] outline-none transition-colors"
               maxLength={1}
               inputMode="numeric"
             />
          ))}
       </div>

       <div className="text-center mb-8">
          <p className="text-sm font-bold text-gray-400">Didn't receive code?</p>
          <button className="text-sm font-bold text-[#262525] mt-1">Resend in 30s</button>
       </div>

       <button 
         onClick={() => {
            if (isComplete) onVerify(otp.join(""));
         }}
         className={cn(
            "w-full h-14 rounded-xl font-bold text-lg transition-colors mt-auto",
            isComplete ? "bg-[#262525] text-white hover:bg-black" : "bg-gray-100 text-gray-400 cursor-not-allowed"
         )}
       >
         Verify & Continue
       </button>
    </motion.div>
  )
}

function SignupDetailsView({ onBack, onComplete }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const isValid = name.length > 2 && email.includes("@");

  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-[80] p-6"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
       <button onClick={onBack} className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center hover:bg-gray-100 mb-8">
          <ArrowLeft className="w-6 h-6 text-[#262525]" />
       </button>

       <h1 className="text-3xl font-black text-[#262525] mb-2">Just a few more details</h1>
       <p className="text-gray-500 mb-10">We need these to personalize your experience</p>

       <div className="space-y-6">
          <div>
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Full Name</label>
             <input 
               type="text" 
               value={name}
               onChange={(e) => setName(e.target.value)}
               placeholder="e.g. Alex Johnson"
               className="w-full h-14 border-b-2 border-gray-100 focus:border-[#262525] outline-none text-lg font-bold text-[#262525] bg-transparent"
             />
          </div>

          <div>
             <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">Email Address</label>
             <input 
               type="email" 
               value={email}
               onChange={(e) => setEmail(e.target.value)}
               placeholder="alex@example.com"
               className="w-full h-14 border-b-2 border-gray-100 focus:border-[#262525] outline-none text-lg font-bold text-[#262525] bg-transparent"
             />
          </div>
       </div>

       <button 
         onClick={() => {
            if (isValid) onComplete(name, email);
         }}
         className={cn(
            "w-full h-14 rounded-xl font-bold text-lg transition-colors mt-auto",
            isValid ? "bg-[#262525] text-white hover:bg-black" : "bg-gray-100 text-gray-400 cursor-not-allowed"
         )}
       >
         Create Account
       </button>
    </motion.div>
  )
}

function LocationPermissionView({ onAllow, onManual }: any) {
  return (
    <motion.div 
      className="flex flex-col h-full bg-white z-[80] p-8 text-center items-center justify-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
       <div className="w-40 h-40 bg-gray-50 rounded-full flex items-center justify-center mb-10 animate-pulse">
           <MapPin className="w-16 h-16 text-[#262525]" />
       </div>

       <h1 className="text-2xl font-black text-[#262525] mb-4">Enable Location Access</h1>
       <p className="text-gray-500 mb-12 max-w-[280px] leading-relaxed">
          We need your location to find the best stores, restaurants, and products near you.
       </p>

       <button 
         onClick={onAllow}
         className="w-full h-14 bg-[#262525] text-white rounded-xl font-bold text-lg hover:bg-black transition-colors mb-4 flex items-center justify-center gap-2"
       >
          <Navigation className="w-5 h-5" /> Allow Location Access
       </button>
       
       <button 
         onClick={onManual}
         className="w-full h-14 text-gray-400 font-bold text-sm hover:text-[#262525] transition-colors"
       >
          Enter Location Manually
       </button>
    </motion.div>
  )
}

function SearchView({ query, onSearch, onBack, onStoreClick, onProductClick }: any) {
  const [localQuery, setLocalQuery] = useState(query);
  
  // Update local query when prop changes
  useEffect(() => {
     setLocalQuery(query);
  }, [query]);

  const results = useMemo(() => {
     if (!localQuery || localQuery.trim().length < 1) return { stores: [], products: [] };
     
     const q = localQuery.toLowerCase().trim();
     
     const filteredStores = [
        ...STORES.filter(s => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)),
        ...RESTAURANTS.filter(r => r.name.toLowerCase().includes(q) || r.type.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q))
     ];
     
     const filteredProducts = ALL_PRODUCTS.filter(p => p.name.toLowerCase().includes(q));

     return { stores: filteredStores, products: filteredProducts };
  }, [localQuery]);

  return (
    <motion.div 
      className="flex flex-col h-full bg-[#f8f8f8] z-[60]"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }}
    >
      <div className="px-6 pt-10 pb-4 bg-white border-b border-gray-100 flex items-center gap-4 sticky top-0 z-10">
         <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
             <ChevronLeft className="w-6 h-6 text-[#262525]" />
         </button>
         <div className="relative flex-1 h-11 bg-gray-50 rounded-xl border border-gray-200 flex items-center px-4 focus-within:border-black focus-within:bg-white transition-colors">
            <Search className="w-4 h-4 text-gray-500" />
            <input 
              type="text" 
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search stores, items..." 
              className="flex-1 ml-3 bg-transparent outline-none text-sm font-bold"
              autoFocus
            />
            {localQuery && (
                <button onClick={() => setLocalQuery("")} className="p-1">
                    <X className="w-4 h-4 text-gray-400" />
                </button>
            )}
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
         {localQuery.length === 0 && (
             <div className="text-center mt-20 opacity-50">
                 <Search className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                 <p className="font-bold text-gray-400">Search for stores or products</p>
             </div>
         )}

         {(results.stores.length > 0 || results.products.length > 0) && (
             <div className="space-y-8 pb-24">
                 {results.stores.length > 0 && (
                     <div>
                         <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Stores & Restaurants</h2>
                         <div className="space-y-3">
                             {results.stores.map((store: any) => (
                                 <div key={store.id} onClick={() => onStoreClick(store)} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer">
                                    <div className="w-16 h-16 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                        <img src={store.image} className="w-full h-full object-cover grayscale" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-[#262525]">{store.name}</h3>
                                        <p className="text-xs text-gray-500">{store.address.split(',')[1]}</p>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-gray-300" />
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}

                 {results.products.length > 0 && (
                     <div>
                         <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 px-1">Products</h2>
                         <div className="space-y-3">
                             {results.products.map((item: any) => (
                                 <div key={item.id} onClick={() => onProductClick(item)} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer">
                                    <div className="w-14 h-14 rounded-lg bg-gray-100 overflow-hidden flex-shrink-0">
                                        <img src={item.image} className="w-full h-full object-cover mix-blend-multiply" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-bold text-[#262525]">{item.name}</h3>
                                        <p className="text-xs text-gray-500">
                                            ₹{item.price} <span className="text-[10px] text-gray-400">/{item.pricingType === 'weight' ? 'kg' : 'ea'}</span>
                                        </p>
                                    </div>
                                    <button className="px-3 py-1 bg-gray-50 text-xs font-bold rounded-lg border border-gray-200">VIEW</button>
                                 </div>
                             ))}
                         </div>
                     </div>
                 )}
             </div>
         )}
      </div>
    </motion.div>
  )
}
