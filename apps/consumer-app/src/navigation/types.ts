export type RootStackParamList = {
    Main: undefined;
    Storefront: { storeId: string; highlightProductId?: string; orderMode?: 'pickup' | 'dining' };
    Checkout: {
        selectedCoupon?: { code: string; discount: number },
        specialInstructions?: string
    };
    DiningCheckout: {
        selectedCoupon?: { code: string; discount: number },
        specialInstructions?: string
    };
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
