export type RootStackParamList = {
    Main: undefined;
    Storefront: { storeId: number };
    ConfirmPreOrder: { selectedCoupon?: { code: string; discount: number } };
    LocationPicker: undefined;
    Onboarding: undefined;
    Auth: undefined;
    Profile: undefined;
    CompleteProfile: undefined;
    Offers: { subtotal: number };
};
