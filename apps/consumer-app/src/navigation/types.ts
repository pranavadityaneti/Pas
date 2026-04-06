export type RootStackParamList = {
    Main: undefined;
    Storefront: { storeId: string };
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
    Cart: undefined;
    Favorites: undefined;
    PaymentMethods: undefined;
    Support: undefined;
    AddPaymentMethod: undefined;
    ConfirmPreOrder: {
        selectedCoupon?: { code: string; discount: number },
        specialInstructions?: string
    };
    SwapScreen: undefined;
};
