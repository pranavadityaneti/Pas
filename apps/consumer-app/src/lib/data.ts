// Mock Data: Stores, products, categories, restaurants, hero images.
// Note: STORE_CATEGORIES uses Ionicons name strings (rendered via @expo/vector-icons in HomeFeedScreen)

// --- Image Pools (Transparent PNGs) ---
export const IMAGE_POOLS: Record<string, any[]> = {
  food: [
    require('../../assets/mock_products/apple.png'),
    require('../../assets/mock_products/banana.png'),
    require('../../assets/mock_products/bread.png'),
    require('../../assets/mock_products/carrot.png'),
  ],
  grocery: [
    require('../../assets/mock_products/apple.png'),
    require('../../assets/mock_products/banana.png'),
    require('../../assets/mock_products/carrot.png'),
  ],
  fashion: [
    require('../../assets/mock_products/apple.png'), // Plaeholders
  ],
  electronics: [
    require('../../assets/mock_products/apple.png'),
  ],
  pharmacy: [
    require('../../assets/mock_products/apple.png'),
  ],
  bakery: [
    require('../../assets/mock_products/bread.png'),
  ],
  meat: [
    require('../../assets/mock_products/apple.png'),
  ],
  stationery: [
    require('../../assets/mock_products/apple.png'),
  ],
  home: [
    require('../../assets/mock_products/apple.png'),
  ],
  pet: [
    require('../../assets/mock_products/apple.png'),
  ],
  beauty: [
    require('../../assets/mock_products/apple.png'),
  ],
  restaurant_cover: [
    require('../../assets/mock_products/apple.png'),
  ]
};

export const getImage = (category: string, seed: number) => {
  const pool = IMAGE_POOLS[category] || IMAGE_POOLS['food'];
  return pool[seed % pool.length];
};

export const INDIAN_CITIES = ["Chennai", "Bangalore", "Mumbai", "Delhi", "Hyderabad", "Pune"];
export const AREAS = ["Indiranagar", "Koramangala", "Jayanagar", "Whitefield", "HSR Layout", "Anna Nagar", "T. Nagar", "Velachery", "Bandra", "Andheri", "Connaught Place"];

export const SUB_CATEGORIES: Record<string, string[]> = {
  'Grocery & Kirana': ["Daily Essentials", "Dairy & Eggs", "Rice, Flours & Dals", "Snacks & Munchies", "Beverages", "Household Care"],
  'Fruits & Vegetables': ["Fresh Fruits", "Fresh Vegetables", "Organic Produce", "Exotic Fruits"],
  'Fashion & Apparel': ["Men's Clothing", "Women's Clothing", "Kids' Fashion", "Footwear", "Watches & Accessories"],
  'Electronics & Accessories': ["Mobiles & Tablets", "Laptops & Computers", "Audio & Headphones", "Smart Wearables", "Accessories"],
  'Pharmacy & Wellness': ["Medicines", "Vitamins & Supplements", "First Aid", "Healthcare Devices", "Personal Hygiene"],
  'Bakeries & Desserts': ["Breads & Buns", "Cakes & Pastries", "Cookies & Biscuits", "Desserts", "Savouries"],
  'Meat & Seafood': ["Chicken", "Mutton", "Fish & Seafood", "Eggs", "Frozen Meat"],
  'Home & Lifestyle': ["Bedding", "Home Decor", "Kitchen & Dining", "Storage & Organizers", "Cleaning"],
  'Pet Care & Supplies': ["Dog Food", "Cat Food", "Pet Toys", "Grooming & Hygiene"],
  'Beauty & Personal Care': ["Skincare", "Makeup", "Haircare", "Bath & Body", "Fragrances"]
};

export const STORE_CATEGORIES = [
  { id: '1', name: 'Grocery & Kirana', subLabel: 'Daily Essentials', icon: 'basket', color: 'bg-green-100', text: 'text-green-600' },
  { id: '3', name: 'Fruits & Vegetables', subLabel: 'Fresh & Organic', icon: 'leaf', color: 'bg-orange-100', text: 'text-orange-600' },
  { id: '2', name: 'Restaurants & Cafes', subLabel: 'Order Hot Food', icon: 'restaurant', color: 'bg-red-100', text: 'text-red-600' },
  { id: '4', name: 'Bakeries & Desserts', subLabel: 'Cakes & Treats', icon: 'ice-cream', color: 'bg-pink-100', text: 'text-pink-600' },
  { id: '5', name: 'Meat & Seafood', subLabel: 'Fresh & Frozen', icon: 'fish', color: 'bg-blue-100', text: 'text-blue-600' },
  { id: '6', name: 'Pharmacy & Wellness', subLabel: 'Meds & Hygiene', icon: 'medical', color: 'bg-teal-100', text: 'text-teal-600' },
  { id: '7', name: 'Electronics & Accessories', subLabel: 'Tech & Gadgets', icon: 'watch', color: 'bg-indigo-100', text: 'text-indigo-600' },
  { id: '8', name: 'Fashion & Apparel', subLabel: 'Trendy Styles', icon: 'shirt', color: 'bg-purple-100', text: 'text-purple-600' },
  { id: '9', name: 'Home & Lifestyle', subLabel: 'Decor & Living', icon: 'home', color: 'bg-yellow-100', text: 'text-yellow-600' },
  { id: '10', name: 'Beauty & Personal Care', subLabel: 'Skin & Beauty', icon: 'color-palette', color: 'bg-rose-100', text: 'text-rose-600' },
  { id: '11', name: 'Pet Care & Supplies', subLabel: 'Furry Friend Needs', icon: 'paw', color: 'bg-stone-100', text: 'text-stone-600' },
];

export const PICKUP_SPOTLIGHTS = [
  {
    id: "1",
    title: 'Free Delivery',
    subtitle: 'On your first 3 orders',
    badge: 'New User',
    badgeColor: '#B52725',
    image: 'https://images.unsplash.com/photo-1562178101-02e243762ffa?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: "2",
    title: 'Premium Groceries',
    subtitle: 'Fresh from local farms',
    badge: 'Fresh',
    badgeColor: '#15803D',
    image: 'https://images.unsplash.com/photo-1748268263747-225c52414f81?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: "3",
    title: 'Instant Pharmacy',
    subtitle: 'Medicines in 30 mins',
    badge: 'Health',
    badgeColor: '#0F766E',
    image: 'https://images.unsplash.com/photo-1578960281840-cb36759fb109?auto=format&fit=crop&w=800&q=80',
  },
];

export const generateProducts = (category: string, startId: number) => {
  const products: any[] = [];

  const generateItems = (baseList: string[], subCat: string, imgCat: string, pricingType: string, priceRange: [number, number], count: number) => {
    for (let i = 0; i < count; i++) {
      const baseName = baseList[i % baseList.length];
      const price = Math.floor(Math.random() * (priceRange[1] - priceRange[0])) + priceRange[0];
      const hasDiscount = Math.random() > 0.6;
      const discountPct = hasDiscount ? Math.floor(Math.random() * 30) + 10 : 0;
      const rating = (3.5 + Math.random() * 1.5).toFixed(1);
      products.push({
        id: String(startId++),
        name: `${baseName}`,
        price: price,
        category: category,
        pricingType: pricingType,
        uom: pricingType === 'weight' ? '1000gm' : '1 Pc',
        image: getImage(imgCat, startId),
        description: pricingType === 'weight' ? `Fresh ${baseName.toLowerCase()}. Price shown is per kg.` : `Authentic ${baseName.toLowerCase()} sourced locally.`,
        isFewLeft: Math.random() > 0.8,
        rating: rating,
        discount: discountPct,
        brief: "A perfect pickup choice.",
        isBestseller: Math.random() > 0.85,
        subCategory: subCat,
        isVeg: (['Butter Chicken', 'Biryani', 'Chicken Curry Cut', 'Mutton', 'Fish'].some(n => baseName.includes(n))) ? false : true
      });
    }
  }

  if (category === "cafe") {
    generateItems(["Cappuccino", "Americano", "Espresso", "Mocha", "Cold Coffee", "Iced Latte", "Frappe"], "Coffee & Beverages", "bakery", "unit", [100, 250], 8);
    generateItems(["Paneer Tikka Sandwich", "Chicken Sandwich", "Veg Puff", "Chicken Puff", "Garlic Bread", "Cheese Chilli Toast", "Veg Burger"], "Savouries", "bakery", "unit", [50, 150], 7);
  } else if (category === "bakery") {
    generateItems(["Butter Croissant", "Chocolate Croissant", "Blueberry Muffin", "Choco Lava Cake", "Pineapple Pastry", "Black Forest Slice", "Red Velvet Pastry"], "Fresh Pastries", "bakery", "unit", [80, 200], 7);
    generateItems(["White Bread", "Brown Bread", "Multigrain Bread", "Burger Buns", "Pav (6 pcs)"], "Breads", "bakery", "unit", [40, 80], 5);
  } else if (category === "grocery") {
    generateItems(["Tomatoes", "Onions", "Potatoes", "Carrots", "Spinach", "Cauliflower", "Green Chilies"], "Fresh Veggies", "grocery", "weight", [40, 100], 7);
    generateItems(["Apples", "Bananas", "Grapes", "Watermelon", "Oranges", "Papaya"], "Fruits", "grocery", "weight", [60, 200], 6);
    generateItems(["Amul Full Cream Milk", "Amul Butter", "Farm Eggs (6 pcs)", "Milky Mist Paneer", "Nestle Curd", "Yakult (5 pcs)"], "Dairy & Eggs", "grocery", "unit", [40, 150], 6);
    generateItems(["Sona Masoori Rice", "Toor Dal", "Sugar", "Chana Dal", "Wheat Flour", "Refined Oil"], "Daily Staples", "grocery", "weight", [50, 300], 6);
  } else if (category === "pharmacy") {
    generateItems(["Crocin Advance", "Dolo 650", "Paracetamol", "Vicks VapoRub", "Saridon", "Digene", "Eno"], "OTC Medicines", "pharmacy", "unit", [20, 100], 7);
    generateItems(["Band-Aid (Box of 100)", "Dettol Antiseptic", "Cotton Roll", "Savlon Cream", "Crepe Bandage", "Hydrogen Peroxide"], "First Aid", "pharmacy", "unit", [30, 200], 6);
    generateItems(["Sanitary Pads", "Hand Sanitizer", "Mouthwash", "Toothbrush", "Shampoo Bottle", "Body Wash"], "Personal Care", "pharmacy", "unit", [50, 300], 6);
    generateItems(["Vitamin C", "Multivitamin Tablets", "Calcium Supp", "Fish Oil", "Protein Powder", "Ashwagandha"], "Supplements", "pharmacy", "unit", [150, 1000], 6);
  } else if (category === "meat") {
    generateItems(["Chicken Curry Cut", "Chicken Breast", "Chicken Keema", "Chicken Lollipop", "Chicken Wings", "Whole Chicken"], "Chicken", "meat", "weight", [200, 400], 7);
    generateItems(["Mutton Curry Cut", "Mutton Keema", "Mutton Chops", "Mutton Biryani Cut", "Mutton Liver"], "Mutton", "meat", "weight", [600, 1000], 6);
    generateItems(["Rohu Fish", "Catla Fish", "Prawns", "Seer Fish", "Crab", "Pomfret"], "Fish & Seafood", "meat", "weight", [300, 800], 6);
    generateItems(["Chicken Tikka Marinade", "Malai Tikka Paste", "Mutton Seekh Kebab", "Fish Fry Mix", "Galouti Kebab", "Peri Peri Marinade"], "Marinades", "meat", "unit", [150, 300], 6);
  } else if (category === "electronics") {
    generateItems(["Type-C Cable", "Lightning Cable", "Micro USB Cable", "Fast Charger", "Car Charger", "Multi-Pin Cable"], "Charging", "electronics", "unit", [150, 500], 6);
    generateItems(["boAt Earbuds", "JBL Earphones", "Sony Headphones", "Neckband", "AirPods Case", "Speaker"], "Audio", "electronics", "unit", [400, 3000], 6);
    generateItems(["iPhone 15 Case", "Samsung S24 Cover", "Screen Protector", "Pop Socket", "Mobile Stand", "Ring Light"], "Accessories", "electronics", "unit", [100, 600], 6);
    generateItems(["Power Bank 10000mAh", "SanDisk 64GB Pen Drive", "SD Card 128GB", "Wireless Mouse", "Mousepad", "Laptop Sleeve"], "Gadgets & Storage", "electronics", "unit", [400, 2000], 7);
  } else if (category === "fashion") {
    generateItems(["Men's T-Shirt", "Slim Fit Jeans", "Floral Summer Dress", "Cotton Kurta", "Formal Blazer", "Sneakers", "Leather Belt"], "Fashion & Style", "fashion", "unit", [500, 2500], 7);
  } else if (category === "home") {
    generateItems(["Cotton Bedding Set", "Ceramic Flower Vase", "Non-Stick Frying Pan", "Storage Organizers", "LED Table Lamp", "Bath Towel Set"], "Home & Decor", "home", "unit", [300, 1500], 6);
  } else if (category === "pet") {
    generateItems(["Pedigree Adult", "Pedigree Puppy", "Drools Chicken & Egg", "Royal Canin Mini", "Chappi", "Purepet"], "Dog Food", "pet", "unit", [200, 1500], 6);
    generateItems(["Whiskas Adult", "Whiskas Kitten", "Me-O Cat Food", "Drools Cat Filets", "Sheba pouches", "Royal Canin Kitten"], "Cat Food", "pet", "unit", [100, 1200], 6);
    generateItems(["Chew Bone", "Rope Toy", "Squeaky Rubber Ball", "Cat Teaser Wand", "Scratching Post", "Frisbee"], "Toys", "pet", "unit", [150, 600], 6);
    generateItems(["Dog Shampoo", "Tick & Flea Spray", "Pet Wipes", "Brush/Comb", "Cat Litter", "Nail Clipper", "Pet Deodorant"], "Grooming & Hygiene", "pet", "unit", [200, 800], 7);
  } else if (category === "beauty") {
    generateItems(["Face Wash", "Moisturizer", "Sunscreen SPF 50", "Face Serum", "Sheet Mask", "Toner", "Scrub"], "Skincare", "beauty", "unit", [150, 800], 7);
    generateItems(["Shampoo", "Conditioner", "Hair Oil", "Hair Gel", "Hair Spray", "Hair Mask"], "Haircare", "beauty", "unit", [150, 600], 6);
    generateItems(["Lipstick", "Kajal", "Mascara", "Foundation", "Compact Powder", "Eyeliner", "Nail Polish"], "Makeup", "beauty", "unit", [200, 1200], 7);
    generateItems(["Deodorant", "Body Wash", "Body Lotion", "Shaving Cream", "Razors", "Talcum Powder"], "Bath & Body", "beauty", "unit", [100, 500], 6);
  } else {
    // Fallback for Restaurants / Food
    generateItems(["Spring Rolls", "Chicken Tikka", "Paneer Chilli", "Momos"], "Starters", "food", "unit", [150, 250], 4);
    generateItems(["Butter Chicken", "Paneer Butter Masala", "Dal Makhani", "Mutton Rogan Josh"], "Main Course", "food", "unit", [250, 450], 4);
    generateItems(["Garlic Naan", "Tandoori Roti", "Lachha Paratha", "Rumali Roti"], "Breads", "food", "unit", [40, 100], 4);
    generateItems(["Veg Biryani", "Chicken Biryani", "Jeera Rice", "Pulao"], "Rice & Biryani", "food", "unit", [150, 350], 4);
  }

  return products;
};

export const OFFERS = [
  { id: "1", title: "10% OFF", subtitle: "Axis Bank Cards", color: "bg-[#e0e7ff] text-indigo-700" },
  { id: "2", title: "Flat ₹50", subtitle: "On orders above ₹299", color: "bg-[#dcfce7] text-green-700" },
  { id: "3", title: "Free Delivery", subtitle: "For new users", color: "bg-[#fef9c3] text-yellow-700" },
  { id: "4", title: "20% Cashback", subtitle: "Using Paytm UPI", color: "bg-[#fae8ff] text-purple-700" }
];

export const RESTAURANTS = Array.from({ length: 25 }, (_, i) => {
  const types = ["Fine Dining", "Cafe", "Dhaba", "Bistro", "Sweet Shop"];
  const cuisines = ["North Indian", "South Indian", "Chinese", "Street Food", "Mughlai"];
  const names = ["Spice Route", "Curry House", "Tandoor Tales", "Chai Point", "Dosa Plaza", "Punjabi Rasoi", "Urban Tadka", "Saffron Grill", "Olive Bistro", "Mainland China", "Empire", "Paradise Biryani", "Saravana Bhavan", "Cream Centre", "Haldiram's", "Bikanervala", "Chaayos", "Cafe Coffee Day", "Barbeque Nation", "Wow! Momo"];

  const name = `${names[i % names.length]} ${i + 1}`;
  const area = AREAS[i % AREAS.length];

  return {
    id: String(i + 1),
    name: name,
    type: types[i % types.length],
    cuisine: cuisines[i % cuisines.length],
    description: `Best ${cuisines[i % cuisines.length]} food in ${area}`,
    image: `https://images.unsplash.com/photo-${i % 2 === 0 ? '1517248135467-4c7edcad34c4' : '1552566626-52f8b828add9'}?auto=format&fit=crop&w=800&q=80`,
    rating: (3.5 + Math.random() * 1.5).toFixed(1),
    distance: `${(Math.random() * 5).toFixed(1)} km`,
    address: `${Math.floor(Math.random() * 100)}, ${area} Main Road, ${INDIAN_CITIES[i % INDIAN_CITIES.length]}`,
    branches: [`${area} (Main)`, `${AREAS[(i + 1) % AREAS.length]}`, `${AREAS[(i + 2) % AREAS.length]}`],
    prepTime: `${Math.floor(Math.random() * 25) + 20} mins`,
    isVeg: i % 4 === 0, // Roughly 25% are pure veg
    openingTime: ["08:00", "09:00", "09:30", "10:00"][i % 4],
    closingTime: ["20:00", "21:30", "22:00", "23:00"][i % 4],
    vertical_id: '4e8633b4-81e0-4ecd-b182-2efdad903987', // Restaurants & Cafes
    products: generateProducts("food", 1000 + (i * 100))
  };
});

export const STORES = Array.from({ length: 45 }, (_, i) => {
  const cat = STORE_CATEGORIES[i % STORE_CATEGORIES.length];
  const names = {
    cafe: ["Daily Brew", "The Oven", "Bean & Leaf", "Crust 'n Muffin", "Sunrise Cafe"],
    grocery: ["Green Leaf Mart", "Fresh Choice", "Daily Needs", "Family Supermarket", "Nature's Basket"],
    pharmacy: ["City Health", "Apollo Plus", "MediCare", "LifeSpan Pharmacy", "True Tabs"],
    meat: ["Tender Cuts", "Licious Hub", "Meat & More", "Ocean Catch", "Butcher's Block"],
    bakery: ["The French Loaf", "Cake Walk", "Bakers Den", "Sweet Obsession", "Just Bake"],
    electronics: ["Croma Express", "Reliance Digital Mini", "Gizmo Hub", "Tech World", "Mobile & More"],
    fashion: ["Trendz Fashion", "The Style Studio", "Wardrobe Essentials", "Urban Wear", "Apparel Hub"],
    home: ["Home & Beyond", "Lifestyle Decor", "Kitchen Comforts", "Nested Home", "Modern Living"],
    pet: ["Heads Up for Tails", "Pet Paradise", "Paw & Purr", "Furry Friends", "Doggo Hub"],
    beauty: ["Health & Glow", "Nykaa Luxe", "Beauty Plus", "Glow & Co", "The Cosmetic Shop"]
  };
  const storeNames = names[cat.id as keyof typeof names] || ["Generic Store"];
  const area = AREAS[i % AREAS.length];
  const products = generateProducts(cat.id, 5000 + (i * 100));

  // Computed fields for advanced filtering
  const avgPrice = products.length > 0
    ? Math.round(products.reduce((sum, p) => sum + p.price, 0) / products.length)
    : 0;
  const isAllVeg = products.length > 0 && products.every(p => p.isVeg === true);

  return {
    id: String(100 + i),
    name: `${storeNames[(i) % storeNames.length]} - ${area}`,
    category: cat.id,
    description: `Your trusted ${cat.name} store in ${area}`,
    image: `https://images.unsplash.com/photo-${(i + 1) % 2 === 0 ? '1562178101-02e243762ffa' : '1534723452802-4ae0566af9f5'}?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080`,
    rating: (3.8 + Math.random() * 1.2).toFixed(1),
    distance: `${(Math.random() * 8 + 0.5).toFixed(1)} km`,
    address: `Shop No. ${i + 1}, ${area} Market, ${INDIAN_CITIES[i % INDIAN_CITIES.length]}`,
    branches: [`${area}`],
    openingTime: ["07:30", "08:00", "09:00", "09:30"][i % 4],
    closingTime: ["21:00", "22:00", "22:30", "23:00"][i % 4],
    vertical_id: (() => {
      const mapping: Record<string, string> = {
        '1': 'c307b78e-b924-47a1-a5a7-4405777fa50c', // Grocery
        '3': '0c90698a-2c46-4615-afd2-cc2e64206e25', // Fruits
        '2': '4e8633b4-81e0-4ecd-b182-2efdad903987', // Restaurants
        '4': '5dc2aefb-7aa9-4e7f-a712-845c60f0fe1b', // Bakeries
        '5': '835a8009-f598-433b-a6e9-f508e53bf960', // Meat
        '6': '1c4ebf02-778e-44be-a50a-3442233202ba', // Pharmacy
        '7': '62a1dab9-a278-4b6b-83f8-1b2bb7ef5edb', // Electronics
        '8': '587a4b75-8bbf-4bee-8f7c-e2618f598d39', // Fashion
        '9': '221cb690-b7f5-499a-a92a-e86c48e44d48', // Home
        '10': '9a1f48a0-d9b8-4fe6-a685-2a14946085d6', // Beauty
        '11': 'cb1883b2-ca64-45bb-b836-b6bebe6b2988', // Pet
      };
      return mapping[cat.id] || 'other';
    })(),
    products,
    avgPrice,
    isAllVeg,
  };
});

// Helper for finding alternative stores when a store rejects an order
export const findAlternativeStores = (rejectedStoreId: string, itemNames: string[]) => {
  // Find the original store 
  const storeNum = Number(rejectedStoreId);
  const isInternalRestaurant = !isNaN(storeNum) && storeNum < 100;
  const originalStore = isInternalRestaurant
    ? RESTAURANTS.find(r => r.id === rejectedStoreId)
    : STORES.find(s => s.id === rejectedStoreId);

  if (!originalStore) return [];

  // Look in the same collection
  const sameCollection = isInternalRestaurant ? RESTAURANTS : STORES;

  // Find stores of the same type/category (with simple string fallback)
  const categoryStr = (originalStore as any).category || (originalStore as any).cuisine || "";

  const alternatives = sameCollection
    .filter(s => s.id !== rejectedStoreId &&
      ((s as any).category === categoryStr || (s as any).cuisine === categoryStr))
    .map(store => {
      // Find matching items in this store's product list
      const matchedItems = store.products.filter(p => itemNames.includes(p.name));
      const matchPercentage = itemNames.length > 0 ? (matchedItems.length / itemNames.length) : 0;

        return {
          storeId: store.id,
          storeName: store.name,
          distance: store.distance,
          image: store.image,
          isDining: isInternalRestaurant,
          matchedItems: matchedItems,
          matchPercentage: matchPercentage
        };
    })
    // Only return stores that have at least 1 matching item, sorted by best match then closest distance
    .filter(alt => alt.matchedItems.length > 0)
    .sort((a, b) => {
      if (b.matchPercentage !== a.matchPercentage) {
        return b.matchPercentage - a.matchPercentage; // Nearest 100% match first
      }
      return parseFloat(a.distance) - parseFloat(b.distance); // Then closest distance
    });

  return alternatives.slice(0, 3); // Max 3 alternatives
};

export const ALL_PRODUCTS = [
  ...RESTAURANTS.flatMap(r => r.products.map(p => ({ ...p, storeId: r.id, storeName: r.name, distance: r.distance }))),
  ...STORES.flatMap(s => s.products.map(p => ({ ...p, storeId: s.id, storeName: s.name, distance: s.distance })))
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
