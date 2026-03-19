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
  { id: "cafe", name: "Restaurants & Cafes", sub: "Breakfast & Snacks", ionicon: "restaurant", color: "bg-orange-100 text-orange-700", iconColor: "#C2410C" },
  { id: "bakery", name: "Bakeries & Desserts", sub: "Cakes & Pastries", ionicon: "cafe", color: "bg-amber-100 text-amber-700", iconColor: "#B45309" },
  { id: "fastfood", name: "Fast Food & Quick Bites", sub: "Burgers & Pizza", ionicon: "fast-food", color: "bg-yellow-100 text-yellow-800", iconColor: "#A16207" },
  { id: "sweetshop", name: "Sweet Shops & Namkeen", sub: "Indian Sweets", ionicon: "ice-cream", color: "bg-rose-100 text-rose-700", iconColor: "#BE123C" },
  { id: "grocery", name: "Fresh Groceries & Supermarkets", sub: "Daily Needs", ionicon: "cart", color: "bg-green-100 text-green-700", iconColor: "#15803D" },
  { id: "meat", name: "Fresh Meat & Seafood", sub: "Raw Meat & Seafood", ionicon: "fish", color: "bg-red-100 text-red-700", iconColor: "#B91C1C" },
  { id: "pharmacy", name: "Pharmacy & Wellness", sub: "Medicines", ionicon: "medkit", color: "bg-teal-100 text-teal-700", iconColor: "#0F766E" },
  { id: "electronics", name: "Electronics & Accessories", sub: "Gadgets", ionicon: "phone-portrait", color: "bg-blue-100 text-blue-700", iconColor: "#1D4ED8" },
  { id: "books", name: "Books & Stationery", sub: "Stationery", ionicon: "book", color: "bg-indigo-100 text-indigo-700", iconColor: "#4338CA" },
  { id: "pet", name: "Pet Care & Supplies", sub: "Food & Toys", ionicon: "paw", color: "bg-orange-100 text-orange-700", iconColor: "#B45309" },
  { id: "beauty", name: "Beauty & Personal Care", sub: "Skincare", ionicon: "sparkles", color: "bg-pink-100 text-pink-700", iconColor: "#BE123C" },
  { id: "fashion", name: "Fashion & Apparel", sub: "Clothing", ionicon: "shirt", color: "bg-purple-100 text-purple-700", iconColor: "#7E22CE" },
  { id: "home", name: "Home & Lifestyle", sub: "Decor & Tools", ionicon: "home", color: "bg-cyan-100 text-cyan-700", iconColor: "#0E7490" },
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
        id: startId++,
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
    generateItems(["Butter Croissant", "Chocolate Croissant", "Blueberry Muffin", "Choco Lava Cake", "Pineapple Pastry", "Black Forest Slice", "Red Velvet Pastry"], "Fresh Pastries", "bakery", "unit", [80, 200], 7);
    generateItems(["Paneer Tikka Sandwich", "Chicken Sandwich", "Veg Puff", "Chicken Puff", "Garlic Bread", "Cheese Chilli Toast", "Veg Burger"], "Savouries", "bakery", "unit", [50, 150], 7);
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
  } else if (category === "snacks") {
    generateItems(["Lays Classic", "Lays Magic Masala", "Kurkure", "Bingo Mad Angles", "Haldiram Bhujia", "Moong Dal Snack", "Doritos"], "Chips & Namkeen", "food", "unit", [10, 50], 7);
    generateItems(["Dairy Milk Silk", "KitKat", "Snickers", "Ferrero Rocher", "Bounty", "5 Star", "Gems"], "Chocolates", "food", "unit", [20, 400], 7);
    generateItems(["Coca-Cola", "Sprite", "Thums Up", "Red Bull", "Tropicana Apple", "Maaza", "Bisleri Water"], "Cold Beverages", "food", "unit", [20, 110], 7);
    generateItems(["Maggi Masala", "Yippee Noodles", "Cup Noodles", "Oreo", "Good Day", "Bourbon"], "Quick Bites", "food", "unit", [10, 80], 6);
  } else if (category === "electronics") {
    generateItems(["Type-C Cable", "Lightning Cable", "Micro USB Cable", "Fast Charger", "Car Charger", "Multi-Pin Cable"], "Charging", "electronics", "unit", [150, 500], 6);
    generateItems(["boAt Earbuds", "JBL Earphones", "Sony Headphones", "Neckband", "AirPods Case", "Speaker"], "Audio", "electronics", "unit", [400, 3000], 6);
    generateItems(["iPhone 15 Case", "Samsung S24 Cover", "Screen Protector", "Pop Socket", "Mobile Stand", "Ring Light"], "Accessories", "electronics", "unit", [100, 600], 6);
    generateItems(["Power Bank 10000mAh", "SanDisk 64GB Pen Drive", "SD Card 128GB", "Wireless Mouse", "Mousepad", "Laptop Sleeve"], "Gadgets & Storage", "electronics", "unit", [400, 2000], 7);
  } else if (category === "books") {
    generateItems(["Sprial Notebook", "A4 Notebook", "Ruled Register", "Diary 2026", "Sketch Book", "Drawing Copy"], "Notebooks", "stationery", "unit", [50, 250], 6);
    generateItems(["Reynolds Pen Pack", "Cello Gripper Assorted", "Parker Pen", "Highlighters", "Whiteboard Markers", "Permanent Markers"], "Writing", "stationery", "unit", [30, 300], 6);
    generateItems(["A4 Printer Paper", "Sticky Notes", "Stapler", "Paper Clips", "Clear File Folder", "Scissors", "Glue Stick"], "Office Supplies", "stationery", "unit", [20, 200], 7);
    generateItems(["Acrylic Paints", "Watercolor Set", "Paint Brushes", "Canvas Board", "Crayons", "Color Pencils"], "Art & Craft", "stationery", "unit", [80, 500], 6);
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
    // Restaurant / Food categories
    generateItems(["Spring Rolls", "Chicken Tikka", "Paneer Chilli", "Momos"], "Starters", "food", "unit", [150, 250], 4);
    generateItems(["Butter Chicken", "Paneer Butter Masala", "Dal Makhani", "Mutton Rogan Josh"], "Main Course", "food", "unit", [250, 450], 4);
    generateItems(["Garlic Naan", "Tandoori Roti", "Lachha Paratha", "Rumali Roti"], "Breads", "food", "unit", [40, 100], 4);
    generateItems(["Veg Biryani", "Chicken Biryani", "Jeera Rice", "Pulao"], "Rice & Biryani", "food", "unit", [150, 350], 4);
    generateItems(["Gulab Jamun", "Rasmalai", "Ice Cream", "Brownie"], "Desserts", "food", "unit", [100, 200], 4);
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
    image: `https://images.unsplash.com/photo-${i % 2 === 0 ? '1517248135467-4c7edcad34c4' : '1552566626-52f8b828add9'}?auto=format&fit=crop&w=800&q=80`,
    rating: (3.5 + Math.random() * 1.5).toFixed(1),
    distance: `${(Math.random() * 5).toFixed(1)} km`,
    address: `${Math.floor(Math.random() * 100)}, ${area} Main Road, ${INDIAN_CITIES[i % INDIAN_CITIES.length]}`,
    branches: [`${area} (Main)`, `${AREAS[(i + 1) % AREAS.length]}`, `${AREAS[(i + 2) % AREAS.length]}`],
    prepTime: `${Math.floor(Math.random() * 25) + 20} mins`,
    isVeg: i % 4 === 0, // Roughly 25% are pure veg
    openingTime: ["08:00", "09:00", "09:30", "10:00"][i % 4],
    closingTime: ["20:00", "21:30", "22:00", "23:00"][i % 4],
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
    snacks: ["Midnight Munch", "Quick Grab", "Snack Point", "Crave Station", "Bite & Go"],
    electronics: ["Croma Express", "Reliance Digital Mini", "Gizmo Hub", "Tech World", "Mobile & More"],
    books: ["Sapna Book House", "Crossword Lite", "Pen & Paper", "Campus Store", "The Read Shop"],
    pet: ["Heads Up for Tails", "Pet Paradise", "Paw & Purr", "Furry Friends", "Doggo Hub"],
    beauty: ["Health & Glow", "Nykaa Store", "Beauty Plus", "Glow & Co", "The Cosmetic Shop"]
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
    id: 100 + i,
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
    products,
    avgPrice,
    isAllVeg,
  };
});

// Helper for finding alternative stores when a store rejects an order
export const findAlternativeStores = (rejectedStoreId: number, itemNames: string[]) => {
  // Find the original store 
  const isInternalRestaurant = rejectedStoreId < 100;
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
