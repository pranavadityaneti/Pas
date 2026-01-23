import { 
  ShoppingBag, Shirt, Smartphone, Pill, Cake, Fish, BookOpen, Gift, Dog, Sparkles
} from "lucide-react";

// --- Image Pools ---
export const IMAGE_POOLS: Record<string, string[]> = {
  food: [
    "https://images.unsplash.com/photo-1589778655375-3e622a9fc91c?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1585937421612-70a008356f36?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1505253758473-96b7015fcd40?auto=format&fit=crop&w=800&q=80", 
  ],
  grocery: [
    "https://images.unsplash.com/photo-1734076459124-308d638c5d92?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1604719312566-b7cb96634836?auto=format&fit=crop&w=800&q=80", 
  ],
  fashion: [
    "https://images.unsplash.com/photo-1760287364328-e30221615f2e?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=800&q=80", 
  ],
  electronics: [
    "https://images.unsplash.com/photo-1740803292814-13d2e35924c3?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80", 
  ],
  pharmacy: [
    "https://images.unsplash.com/photo-1742797357718-b339de52c89b?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?auto=format&fit=crop&w=800&q=80", 
  ],
  bakery: [
    "https://images.unsplash.com/photo-1645597454210-c97f9701257a?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=800&q=80", 
  ],
  meat: [
    "https://images.unsplash.com/photo-1648644719068-3d960312be2e?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=800&q=80", 
  ],
  stationery: [
    "https://images.unsplash.com/photo-1591203930900-5cb0eec7cc30?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80", 
  ],
  home: [
    "https://images.unsplash.com/photo-1669964173893-8495e760f154?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80", 
  ],
  pet: [
    "https://images.unsplash.com/photo-1565946802444-b5ac048a1e04?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80", 
  ],
  beauty: [
    "https://images.unsplash.com/photo-1596462502278-27bfdd403348?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1571781926291-280553131573?auto=format&fit=crop&w=800&q=80", 
  ],
  restaurant_cover: [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=800&q=80", 
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=800&q=80", 
  ]
};

export const getImage = (category: string, seed: number) => {
  const pool = IMAGE_POOLS[category] || IMAGE_POOLS['food'];
  return pool[seed % pool.length];
};

export const INDIAN_CITIES = ["Chennai", "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Pune"];
export const AREAS = ["Indiranagar", "Koramangala", "Jayanagar", "Whitefield", "HSR Layout", "Anna Nagar", "T. Nagar", "Velachery", "Bandra", "Andheri", "Connaught Place"];

export const SUB_CATEGORIES: Record<string, string[]> = {
  grocery: ["Daily Essentials", "Fruits & Vegetables", "Dairy & Eggs", "Rice, Flours & Dals", "Snacks & Munchies", "Beverages", "Household Care"],
  fashion: ["Men's Clothing", "Women's Clothing", "Kids' Fashion", "Footwear", "Watches & Accessories", "Winter Wear"],
  electronics: ["Mobiles & Tablets", "Laptops & Computers", "Audio & Headphones", "Cameras", "Smart Wearables", "Mobile Accessories", "Home Appliances"],
  pharmacy: ["Medicines", "Vitamins & Supplements", "First Aid", "Healthcare Devices", "Personal Hygiene", "Ayurvedic"],
  bakery: ["Breads & Buns", "Cakes & Pastries", "Cookies & Biscuits", "Desserts", "Savouries", "Party Supplies"],
  meat: ["Chicken", "Mutton", "Fish & Seafood", "Eggs", "Marinades", "Frozen Meat"],
  stationery: ["Notebooks & Diaries", "Pens & Writing", "Art Supplies", "Office Supplies", "Calculators", "Files & Folders"],
  home: ["Bedding", "Home Decor", "Kitchen & Dining", "Storage & Organizers", "Lighting", "Bath Essentials"],
  pet: ["Dog Food", "Cat Food", "Pet Toys", "Grooming & Hygiene", "Pet Accessories", "Treats"],
  beauty: ["Skincare", "Makeup", "Haircare", "Bath & Body", "Fragrances", "Men's Grooming"]
};

export const STORE_CATEGORIES = [
  { id: "grocery", name: "Grocery", sub: "Daily Needs", icon: ShoppingBag, color: "bg-green-100 text-green-700" },
  { id: "fashion", name: "Fashion", sub: "Lifestyle", icon: Shirt, color: "bg-purple-100 text-purple-700" },
  { id: "electronics", name: "Mobiles", sub: "Electronics", icon: Smartphone, color: "bg-blue-100 text-blue-700" },
  { id: "pharmacy", name: "Pharmacy", sub: "Wellness", icon: Pill, color: "bg-teal-100 text-teal-700" },
  { id: "bakery", name: "Bakery", sub: "Sweets", icon: Cake, color: "bg-orange-100 text-orange-700" },
  { id: "meat", name: "Meat", sub: "Fresh", icon: Fish, color: "bg-red-100 text-red-700" },
  { id: "stationery", name: "Books", sub: "Stationery", icon: BookOpen, color: "bg-yellow-100 text-yellow-700" },
  { id: "home", name: "Home", sub: "Decor", icon: Gift, color: "bg-pink-100 text-pink-700" },
  { id: "pet", name: "Pet Care", sub: "Supplies", icon: Dog, color: "bg-amber-100 text-amber-700" },
  { id: "beauty", name: "Beauty", sub: "Personal", icon: Sparkles, color: "bg-rose-100 text-rose-700" },
];

export const generateProducts = (category: string, count: number, startId: number) => {
  const products = [];
  
  const packagedFood = ["Maggi Noodles", "Lays Chips", "Good Day Biscuits", "Kissan Jam", "Kelloggs Cornflakes", "Cadbury Dairy Milk", "Haldiram Bhujia", "Britannia Rusk"];
  const beverages = ["Coca-Cola", "Tropicana Juice", "Bisleri Water", "Red Bull", "Amul Kool", "Maaza", "Sprite", "Thums Up"];
  const packagedDairy = ["Amul Butter", "Amul Taaza Milk", "Yakult", "Modern Bread", "Amul Cheese Slices", "Milky Mist Paneer", "Nestle Curd"];
  const personalCare = ["Dove Soap", "Colgate Toothpaste", "Dettol Handwash", "Nivea Cream", "Pantene Shampoo", "Gillette Foam", "Himalaya Face Wash"];
  const household = ["Vim Bar", "Duracell AA", "Surf Excel", "Harpic", "Odonil", "Scotch Brite"];
  const electronics = ["iPhone 15", "Samsung S24", "boAt Airdopes", "JBL Speaker", "OnePlus Nord", "Dell Laptop", "Logitech Mouse", "USB Cable", "Power Bank", "Smart Watch"];
  
  const freshVeg = ["Onions", "Tomatoes", "Potatoes", "Ladies Finger", "Green Chilies", "Carrots", "Cauliflower", "Spinach", "Capsicum"];
  const freshFruit = ["Apples", "Grapes", "Watermelon", "Pomegranate", "Bananas", "Mangoes", "Papaya", "Oranges"];
  const staples = ["Sona Masoori Rice", "Toor Dal", "Sugar", "Raw Peanuts", "Chana Dal", "Moong Dal", "Wheat Flour (Loose)"];
  const meat = ["Chicken Curry Cut", "Mutton", "Rohu Fish", "Chicken Breast", "Prawns"];
  const looseSweets = ["Mixed Mithai", "Motichoor Ladoo", "Fresh Paneer Block", "Kaju Katli", "Milk Cake", "Jalebi"];

  let baseList: string[] = [];
  let pricingType = 'unit'; 
  let imgCategory = 'food';

  if (category === "grocery") {
      const r = Math.random();
      if (r < 0.4) { baseList = [...packagedFood, ...beverages, ...packagedDairy, ...household]; pricingType = 'unit'; imgCategory = 'grocery'; }
      else if (r < 0.6) { baseList = freshVeg; pricingType = 'weight'; imgCategory = 'grocery'; }
      else if (r < 0.8) { baseList = freshFruit; pricingType = 'weight'; imgCategory = 'grocery'; }
      else { baseList = staples; pricingType = 'weight'; imgCategory = 'grocery'; }
  }
  else if (category === "meat") { baseList = meat; pricingType = 'weight'; imgCategory = 'meat'; }
  else if (category === "bakery") { 
      if (Math.random() > 0.5) { baseList = ["Black Forest Cake", "Red Velvet Cake", "Croissant", "Pineapple Pastry"]; pricingType = 'unit'; imgCategory = 'bakery'; }
      else { baseList = looseSweets; pricingType = 'weight'; imgCategory = 'food'; } 
  }
  else if (category === "electronics") { baseList = electronics; pricingType = 'unit'; imgCategory = 'electronics'; }
  else if (category === "fashion") { baseList = ["Cotton Shirt", "Denim Jeans", "Kurta", "Saree", "T-Shirt", "Sneakers"]; pricingType = 'unit'; imgCategory = 'fashion'; }
  else if (category === "pharmacy") { baseList = ["Dolo 650", "Crocin", "Vicks VapoRub", "Digene", "Vitamin C", "Thermometer", "Mask N95", "Sanitizer", "Band Aid"]; pricingType = 'unit'; imgCategory = 'pharmacy'; }
  else if (category === "stationery") { baseList = ["Notebook", "Pen Pack", "Pencils", "A4 Paper", "Calculator", "Files"]; pricingType = 'unit'; imgCategory = 'stationery'; }
  else if (category === "home") { baseList = ["Bed Sheet", "Cushion Cover", "Vase", "Wall Clock", "Curtains"]; pricingType = 'unit'; imgCategory = 'home'; }
  else if (category === "pet") { baseList = ["Pedigree Dog Food", "Whiskas Cat Food", "Dog Chew", "Pet Shampoo"]; pricingType = 'unit'; imgCategory = 'pet'; }
  else if (category === "beauty") { baseList = ["Lipstick", "Eyeliner", "Foundation", "Perfume", "Nail Polish"]; pricingType = 'unit'; imgCategory = 'beauty'; }
  else {
      baseList = ["Butter Chicken", "Paneer Tikka", "Biryani", "Naan", "Dosa"];
      pricingType = 'unit';
      imgCategory = 'food';
  }

  for (let i = 0; i < count; i++) {
    if (category === "grocery") {
        const r = Math.random();
        if (r < 0.4) { baseList = [...packagedFood, ...beverages, ...packagedDairy, ...household]; pricingType = 'unit'; }
        else if (r < 0.6) { baseList = freshVeg; pricingType = 'weight'; }
        else if (r < 0.8) { baseList = freshFruit; pricingType = 'weight'; }
        else { baseList = staples; pricingType = 'weight'; }
    }

    const baseName = baseList[Math.floor(Math.random() * baseList.length)];
    const price = pricingType === 'weight' 
        ? Math.floor(Math.random() * 200) + 40 
        : Math.floor(Math.random() * 500) + 20;

    const finalPrice = category === 'meat' ? price * 3 : price;
    const hasDiscount = Math.random() > 0.6;
    const discountPct = hasDiscount ? Math.floor(Math.random() * 30) + 10 : 0;
    const rating = (3.5 + Math.random() * 1.5).toFixed(1);

    products.push({
      id: startId + i,
      name: `${baseName}`,
      price: finalPrice,
      category: category,
      pricingType: pricingType, 
      uom: pricingType === 'weight' ? 'per kg' : 'each',
      image: getImage(imgCategory, startId + i),
      description: pricingType === 'weight' 
        ? `Fresh ${baseName.toLowerCase()}. Price shown is per kg.` 
        : `Authentic ${baseName.toLowerCase()} sourced locally.`,
      isFewLeft: Math.random() > 0.8,
      rating: rating,
      discount: discountPct,
      brief: "A perfect choice for your daily needs.",
      isBestseller: Math.random() > 0.85
    });
  }
  return products;
};

export const OFFERS = [
    { id: 1, title: "10% OFF", subtitle: "Axis Bank Cards", color: "bg-[#e0e7ff] text-indigo-700" },
    { id: 2, title: "Flat ₹50", subtitle: "On orders above ₹299", color: "bg-[#dcfce7] text-green-700" },
    { id: 3, title: "Free Delivery", subtitle: "For new users", color: "bg-[#fef9c3] text-yellow-700" },
    { id: 4, title: "20% Cashback", subtitle: "Using Paytm UPI", color: "bg-[#fae8ff] text-purple-700" }
];

export const RESTAURANTS = Array.from({ length: 25 }, (_, i) => {
  const types = ["Fine Dining", "Cafe", "Dhaba", "Bistro", "Sweet Shop"];
  const cuisines = ["North Indian", "South Indian", "Chinese", "Street Food", "Mughlai"];
  const names = ["Spice Route", "Curry House", "Tandoor Tales", "Chai Point", "Dosa Plaza", "Punjabi Rasoi", "Urban Tadka", "Saffron Grill", "Olive Bistro", "Mainland China", "Empire", "Paradise Biryani", "Saravana Bhavan", "Cream Centre", "Haldiram's", "Bikanervala", "Chaayos", "Cafe Coffee Day", "Barbeque Nation", "Wow! Momo"];
  
  const name = `${names[i % names.length]} ${i + 1}`;
  const area = AREAS[i % AREAS.length];
  
  return {
    id: i + 1,
    name: name,
    type: types[i % types.length],
    cuisine: cuisines[i % cuisines.length],
    description: `Best ${cuisines[i % cuisines.length]} food in ${area}`,
    image: getImage('restaurant_cover', i),
    rating: (3.5 + Math.random() * 1.5).toFixed(1),
    distance: `${(Math.random() * 5).toFixed(1)} km`,
    address: `${Math.floor(Math.random() * 100)}, ${area} Main Road, ${INDIAN_CITIES[i % INDIAN_CITIES.length]}`,
    branches: [`${area} (Main)`, `${AREAS[(i + 1) % AREAS.length]}`, `${AREAS[(i + 2) % AREAS.length]}`],
    products: generateProducts("food", 40, 1000 + (i * 100))
  };
});

export const STORES = Array.from({ length: 50 }, (_, i) => {
  const cat = STORE_CATEGORIES[i % STORE_CATEGORIES.length];
  const names = ["Ratnadeep", "More Supermarket", "Reliance Digital", "Apollo Pharmacy", "Titan Eye", "FabIndia", "Vijaya Optics", "Sapna Book House", "Croma", "Lenskart", "Natures Basket", "Health & Glow"];
  const area = AREAS[i % AREAS.length];

  return {
    id: 100 + i,
    name: `${names[i % names.length]} - ${area}`,
    category: cat.id,
    description: `Your trusted ${cat.name} store in ${area}`,
    image: getImage(cat.id, i), 
    rating: (3.8 + Math.random() * 1.2).toFixed(1),
    distance: `${(Math.random() * 8).toFixed(1)} km`,
    address: `Shop No. ${i + 1}, ${area} Market, ${INDIAN_CITIES[i % INDIAN_CITIES.length]}`,
    branches: [`${area}`],
    products: generateProducts(cat.id, 50, 5000 + (i * 100))
  };
});

export const ALL_PRODUCTS = [
    ...RESTAURANTS.flatMap(r => r.products.map(p => ({ ...p, storeId: r.id }))),
    ...STORES.flatMap(s => s.products.map(p => ({ ...p, storeId: s.id })))
];

export const LOCATIONS = [
  { type: "Home", address: "103, Vimala Ramam Apts, Lakshmi Nagar, Chennai - 600041" },
  { type: "Work", address: "Tech Park, Phase 2, OMR, Bangalore - 560100" }
];

export const HERO_IMAGES = [
  "https://images.unsplash.com/photo-1562178101-02e243762ffa?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmcmVzaCUyMG9yZ2FuaWMlMjBncm9jZXJ5JTIwZm9vZCUyMGJhbm5lcnxlbnwxfHx8fDE3Njg2NTExODh8MA&ixlib=rb-4.1.0&q=80&w=1080",
  "https://images.unsplash.com/photo-1748268263747-225c52414f81?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBzaG9wcGluZyUyMG1hbGwlMjByZXRhaWwlMjBiYW5uZXJ8ZW58MXx8fHwxNzY4NjUxMTg4fDA&ixlib=rb-4.1.0&q=80&w=1080",
  "https://images.unsplash.com/photo-1578960281840-cb36759fb109?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmaW5lJTIwZGluaW5nJTIwcmVzdGF1cmFudCUyMGZvb2QlMjBiYW5uZXJ8ZW58MXx8fHwxNzY4NjUxMTg4fDA&ixlib=rb-4.1.0&q=80&w=1080"
];
