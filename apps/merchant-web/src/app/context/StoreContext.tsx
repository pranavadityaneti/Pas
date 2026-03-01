import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo } from 'react';

// --- Types ---

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  stockStatus: 'in-stock' | 'low-stock' | 'out-of-stock';
  stockCount?: number;
  unit?: 'piece' | 'weight';
  weightAmount?: number;
  weightUnit?: 'g' | 'kg';
  stockWeightUnit?: 'g' | 'kg';
  desc?: string;
  img?: string;
}

export interface Order {
  id: string;
  storeId: string; // Added to link order to store
  status: 'pending' | 'processing' | 'ready' | 'completed' | 'rejected';
  customer: {
    name: string;
    phone: string;
    address?: string;
  };
  items: OrderItem[];
  pricing: {
    subtotal: number;
    gst: number;
    platformFee: number;
    total: number;
  };
  time?: number; // Seconds remaining for auto-reject (for pending orders)
  customerOtp?: string;
  placedAt?: string;
  completedAt?: string;
  customerNote?: string;
  rejectionReason?: string;
  paymentMethod?: string;
}

export type StoreData = {
  id: string;
  name: string;
  type: string;
  location: string;
  isOnline: boolean;
  // Metrics will now be derived from live orders, but we keep this structure for legacy or cached values if needed,
  // or we can just ignore it and use the derived ones in the UI.
  metrics: {
    sales: string;
    orders: string;
    pending: string;
    processing: string;
    delivered: string;
    cancelled: string;
    earnings: string;
  };
  recentActivity: Array<{
    id: string;
    items: number;
    total: number;
    status: string;
    time: string;
  }>;
};

// --- Mock Data ---

const INITIAL_STORES: StoreData[] = [
  {
    id: '1',
    name: 'Ratnadeep Supermarket',
    type: 'Grocery',
    location: 'Gachibowli Branch',
    isOnline: true,
    metrics: { // These will be overwritten by dynamic calculation
      sales: '₹0',
      orders: '0',
      pending: '0',
      processing: '0',
      delivered: '0',
      cancelled: '0',
      earnings: '₹0'
    },
    recentActivity: []
  },
  {
    id: '2',
    name: 'Rahul\'s Fruit Shop',
    type: 'Fresh Produce',
    location: 'Kondapur Main Rd',
    isOnline: false,
    metrics: {
      sales: '₹0',
      orders: '0',
      pending: '0',
      processing: '0',
      delivered: '0',
      cancelled: '0',
      earnings: '₹0'
    },
    recentActivity: []
  },
  {
    id: '3',
    name: 'Apollo Pharmacy',
    type: 'Medical',
    location: 'Hitech City',
    isOnline: true,
    metrics: {
      sales: '₹0',
      orders: '0',
      pending: '0',
      processing: '0',
      delivered: '0',
      cancelled: '0',
      earnings: '₹0'
    },
    recentActivity: []
  }
];

const INITIAL_ORDERS: Order[] = [
  // Store 1 Orders
  { 
    id: 'RD-4022', 
    storeId: '1',
    status: 'pending', 
    customer: { name: 'Rahul M.', phone: '+91 98480 12345', address: 'Block A, Skyline Apts' },
    items: [
      { name: 'Amul Butter', quantity: 2, price: 100, stockStatus: 'in-stock', stockCount: 50, unit: 'piece', img: 'https://images.unsplash.com/photo-1589985270826-4b7bb135bc9d?w=100' },
      { name: 'Maggi Noodles', quantity: 3, price: 42, stockStatus: 'low-stock', stockCount: 2, unit: 'piece', img: 'https://images.unsplash.com/photo-1612929633738-8fe44f7ec841?w=100' },
      { name: 'Tata Tea Gold', quantity: 1, price: 180, stockStatus: 'in-stock', stockCount: 25, unit: 'piece', img: 'https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?w=100' }
    ],
    pricing: { subtotal: 400, gst: 20, platformFee: 5, total: 425 },
    time: 118,
    customerOtp: '1234',
    placedAt: '10:30 AM',
    customerNote: 'Please verify expiry dates.'
  },
  { 
    id: 'RD-4027', 
    storeId: '1',
    status: 'processing', 
    customer: { name: 'Sneha R.', phone: '+91 90123 45678', address: 'Plot 45, Green Valley' },
    items: [
      { name: 'Lays Chips', quantity: 4, price: 80, stockStatus: 'in-stock', stockCount: 60, unit: 'piece', img: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=100' },
      { name: 'Pepsi 2L', quantity: 2, price: 180, stockStatus: 'in-stock', stockCount: 30, unit: 'piece', img: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=100' }
    ],
    pricing: { subtotal: 260, gst: 13, platformFee: 5, total: 278 },
    customerOtp: '5678',
    placedAt: '10:45 AM'
  },
  { 
    id: 'RD-4028', 
    storeId: '1',
    status: 'ready', 
    customer: { name: 'Karthik N.', phone: '+91 88774 56789', address: 'Flat 302, Sai Residency' },
    items: [
      { name: 'Parle-G Biscuits', quantity: 5, price: 50, stockStatus: 'in-stock', stockCount: 100, unit: 'piece', img: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=100' }
    ],
    pricing: { subtotal: 50, gst: 2, platformFee: 5, total: 57 },
    customerOtp: '9012',
    placedAt: '11:00 AM'
  },
  { 
    id: 'RD-1023', 
    storeId: '1',
    status: 'completed', 
    customer: { name: 'Aditya Kumar', phone: '+91 98765 43210', address: 'Flat 402, Sunshine Apts' },
    items: [
        { name: 'Fresh Farm Milk', quantity: 2, price: 64, stockStatus: 'in-stock', stockCount: 20, unit: 'piece', img: 'https://images.unsplash.com/photo-1635436322965-48ff696e7392?w=100' }
    ],
    pricing: { subtotal: 64, gst: 3, platformFee: 5, total: 72 },
    completedAt: '10:30 AM',
    placedAt: '10:15 AM',
    paymentMethod: 'UPI'
  },
  { 
    id: 'RD-1020', 
    storeId: '1',
    status: 'completed', 
    customer: { name: 'Vikram Singh', phone: '+91 99887 76655', address: 'Villa 12, Golden Palms' },
    items: [
        { name: 'Aashirvaad Atta', quantity: 1, price: 350, stockStatus: 'in-stock', stockCount: 40, unit: 'weight', weightAmount: 5, weightUnit: 'kg', stockWeightUnit: 'kg', img: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=100' }
    ],
    pricing: { subtotal: 350, gst: 0, platformFee: 10, total: 360 },
    completedAt: '09:45 AM',
    placedAt: '09:30 AM',
    paymentMethod: 'Card'
  },
  { 
    id: 'RD-1015', 
    storeId: '1',
    status: 'rejected', 
    customer: { name: 'Meena Reddy', phone: '+91 97654 32109', address: 'H.No 5-66, Main Road' },
    items: [
        { name: 'Exotic Dragon Fruit', quantity: 2, price: 300, stockStatus: 'out-of-stock', stockCount: 0, unit: 'piece', img: 'https://images.unsplash.com/photo-1527773289255-a50d276b009e?w=100' }
    ],
    pricing: { subtotal: 300, gst: 0, platformFee: 10, total: 310 },
    completedAt: '09:00 AM',
    placedAt: '08:45 AM',
    rejectionReason: 'Item out of stock'
  }
];

// --- Context ---

interface StoreContextType {
  currentStore: StoreData;
  stores: StoreData[];
  setCurrentStoreId: (id: string) => void;
  toggleStoreStatus: () => void;
  addStore: (newStore: StoreData) => void;
  
  // Order Management
  orders: Order[]; // All orders for the current store
  updateOrderStatus: (orderId: string, newStatus: Order['status'], reason?: string) => void;
  addOrder: (order: Order) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [currentStoreId, setCurrentStoreId] = useState<string>('1');
  const [stores, setStores] = useState<StoreData[]>(INITIAL_STORES);
  const [allOrders, setAllOrders] = useState<Order[]>(INITIAL_ORDERS);

  // Derived: Current Store Object
  const currentStoreBase = stores.find(s => s.id === currentStoreId) || stores[0];

  // Derived: Orders for Current Store
  const currentStoreOrders = useMemo(() => {
    return allOrders.filter(o => o.storeId === currentStoreId);
  }, [allOrders, currentStoreId]);

  // Derived: Metrics for Current Store
  const currentStoreMetrics = useMemo(() => {
    const orders = currentStoreOrders;
    
    const salesTotal = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + o.pricing.total, 0);
    
    const earningsTotal = orders
        .filter(o => o.status === 'completed')
        .reduce((sum, o) => sum + (o.pricing.total - o.pricing.platformFee), 0);

    return {
        sales: `₹${salesTotal.toLocaleString()}`,
        orders: orders.length.toString(),
        pending: orders.filter(o => o.status === 'pending').length.toString(),
        processing: orders.filter(o => o.status === 'processing').length.toString(),
        delivered: orders.filter(o => o.status === 'completed').length.toString(),
        cancelled: orders.filter(o => o.status === 'rejected').length.toString(),
        earnings: `₹${earningsTotal.toLocaleString()}`
    };
  }, [currentStoreOrders]);

  // Derived: Recent Activity for Current Store
  const currentStoreRecentActivity = useMemo(() => {
    return currentStoreOrders
        .sort((a, b) => {
            // Simple sort by ID or placedAt if available, roughly simulating "recent"
            // For now, reverse order of array to show newest first if appended
            return -1; 
        })
        .slice(0, 5) // Last 5 orders
        .map(o => ({
            id: o.id,
            items: o.items.length,
            total: o.pricing.total,
            status: o.status === 'completed' ? 'Delivered' : o.status.charAt(0).toUpperCase() + o.status.slice(1),
            time: o.placedAt || 'Just now'
        }));
  }, [currentStoreOrders]);

  // Combined Store Data (Base + Dynamic Metrics)
  const currentStore = {
    ...currentStoreBase,
    metrics: currentStoreMetrics,
    recentActivity: currentStoreRecentActivity
  };

  const toggleStoreStatus = () => {
    setStores(prevStores => 
      prevStores.map(store => 
        store.id === currentStoreId 
          ? { ...store, isOnline: !store.isOnline }
          : store
      )
    );
  };

  const addStore = (newStore: StoreData) => {
    setStores(prev => [...prev, newStore]);
    setCurrentStoreId(newStore.id);
  };

  const updateOrderStatus = (orderId: string, newStatus: Order['status'], reason?: string) => {
    setAllOrders(prev => prev.map(o => {
        if (o.id === orderId) {
            const now = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            return {
                ...o,
                status: newStatus,
                completedAt: (newStatus === 'completed' || newStatus === 'rejected') ? now : o.completedAt,
                rejectionReason: reason
            };
        }
        return o;
    }));
  };

  const addOrder = (order: Order) => {
      setAllOrders(prev => [order, ...prev]);
  };

  // Safe check to ensure currentStore exists
  if (!currentStoreBase) {
    return <div>Loading Store Data...</div>;
  }

  const value = {
    currentStore,
    stores,
    setCurrentStoreId,
    toggleStoreStatus,
    addStore,
    orders: currentStoreOrders,
    updateOrderStatus,
    addOrder
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
}
