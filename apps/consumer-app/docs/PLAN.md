# Consumer Native App: Implementation Plan

This comprehensive plan documents the architecture and implementation status of the Consumer Native App, serving as the source of truth for the project's technical roadmap.

## 1. Authentication & Entry Flow
*   **Module**: `AuthScreen.tsx`, `OnboardingScreen.tsx`
*   **Infrastructure**: Supabase Auth (Email/Password)
*   **Key Features**:
    *   [x] Brand-focused Login/Signup UI with horizontal logo.
    *   [x] "Continue As Guest" browsing mode (bypasses session requirement).
    *   [x] Integrated Password Reset/Recovery via Supabase.
    *   [x] Post-Signup "Complete Profile" flow for mandatory data capture.

## 2. Location & Map Discovery
*   **Module**: `LocationPickerScreen.tsx`, `LocationContext.tsx`
*   **Infrastructure**: Google Maps SDK, Google Places/Geocoding API
*   **Key Features**:
    *   [x] Automatic GPS Detection and map snapping.
    *   [x] Persistent Address Book with smart tag validation (Home/Work/Other).
    *   [x] Address-based delivery zone verification logic.
    *   [x] Cross-platform API key management via `app.json`.

## 3. Navigation Architecture
*   **Module**: `RootNavigator.tsx`, `MainTabNavigator.tsx`
*   **Pattern**: Stack + Tab Hybrid
*   **Key Features**:
    *   [x] 4-Tab Premium Layout: Home, Pickup, Dining, Cart.
    *   [x] Brand-First Identity: Tab bar features the brand logo as the Home trigger.
    *   [x] Filled State Aesthetics: Tab icons switch to brand-red filled versions when active.
    *   [x] Profile Access: Integrated into the Home Feed header for personalized context.

## 4. Profile & Account Management
*   **Module**: `ProfileScreen.tsx`
*   **Infrastructure**: Supabase `profiles` table + Storage `avatars` bucket
*   **Key Features**:
    *   [x] Real-time Avatar Sync (Update profile -> reflect on Home instantly).
    *   [x] Security Hub: Password management and session controls.
    *   [x] Notification Preferences: Granular category toggles with "Enable All" logic.
    *   [x] Activity Management: Consolidated Orders, Saved Addresses, and Payments.

## 5. UI/UX & Design Systems
*   **Framework**: Tailwind CSS (NativeWind)
*   **Brand Tokens**:
    *   **Main Red**: `#B52725`
    *   **Standard Typography**: Removal of all black/extrabold weights for a premium feel.
    *   **Feedback**: Expo Haptics integrated for success/error notifications.

## 6. Current Phase & Next Trajectory
*   **Status**: Finalizing Phase 7 (Account & Identity)
*   **Immediate Next Steps (Phase 8+)**:
    *   [ ] **Dynamic Storefronts**: Connecting Home category links to live restaurant feeds.
    *   [ ] **Shopping Engine**: Item detail modals, cart quantity logic, and price calculations.
    *   [ ] **Checkout Pipeline**: Finalizing the purchase flow with saved payment methods.
