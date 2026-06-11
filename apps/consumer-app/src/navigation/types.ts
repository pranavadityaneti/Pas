export type RootStackParamList = {
    Main: undefined;
    Storefront: { storeId: string; highlightProductId?: string; orderMode?: 'pickup' | 'dining' };
    // Phase 4 audit re-fix (2026-06-09 evening): selectedCoupon dropped from
    // Checkout + DiningCheckout — CartContext.appliedCoupon is the single source
    // of truth (set by OffersScreen / CouponsScreen via setAppliedCoupon).
    Checkout: { specialInstructions?: string } | undefined;
    DiningCheckout: { specialInstructions?: string } | undefined;
    LocationPicker: undefined;
    Onboarding: undefined;
    Auth: undefined;
    Profile: undefined;
    ProfileSetup: undefined;
    Offers: { subtotal: number };
    SpotlightDetail: { spotlightId: string };
    CategoryDetail: { categoryId: string; categoryName: string };
    YourOrders: undefined;
    Notifications: undefined;
    Cart: undefined;
    Favorites: undefined;
    PaymentMethods: undefined;
    Support: undefined;
    AddPaymentMethod: undefined;

    SwapScreen: undefined;
    Coupons: {
        subtotal: number;
        storeId: string;
        appliedCouponId?: string;
        returnTo: 'Checkout' | 'DiningCheckout';
    };
};
