export type RootStackParamList = {
    Main: undefined;
    Storefront: { storeId: number };
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
    SpotlightDetail: { spotlightId: number };
    CategoryDetail: { categoryId: string; categoryName: string };
    YourOrders: undefined;
    Cart: undefined;
    Favorites: undefined;
};

