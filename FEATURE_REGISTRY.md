# 📋 FEATURE REGISTRY — Pick At Store (PAS) Monorepo

> **Purpose**: A living manifest of every implemented screen, component, and feature.  
> Check this document **before modifying any file** to determine its lock status.  
> **Created**: February 27, 2026  
> **Last Updated**: February 27, 2026

---

## Legend

| Status | Meaning |
|--------|---------|
| 🔒 LOCKED | Approved & finalized. Do NOT modify layout/structure. Bug fixes only. |
| 🟡 IN PROGRESS | Under active development. Coordinate with user. |
| 🟢 OPEN | Safe to modify freely. |
| 📋 PLANNED | Not yet implemented. |

---

## 📱 Consumer App (`apps/consumer-app`)

### Screens

| Screen | File | Status | Locked Date | Notes |
|--------|------|--------|-------------|-------|
| Home Screen | `src/screens/HomeScreen.tsx` | 🔒 LOCKED | Feb 27, 2026 | 2-col Pickup/Dining cards + Featured card. Do NOT alter layout. |
| Pickup Discovery | `src/screens/HomeFeedScreen.tsx` | 🔒 LOCKED | Feb 27, 2026 | Hero slider, category grid, product carousels, cross-promo card. |
| Dining Discovery | `src/screens/DiningScreen.tsx` | 🔒 LOCKED | Feb 27, 2026 | Redesigned: Spotlights, 4 category carousels, All Restaurants list. |
| Auth / Login | `src/screens/AuthScreen.tsx` | 🔒 LOCKED | Mar 12, 2026 | Phone OTP authentication flow with network timeouts. |
| Profile | `src/screens/ProfileScreen.tsx` | 🔒 LOCKED | Mar 12, 2026 | User profile with avatar, details, address management. |
| Complete Profile | `src/screens/ProfileSetupScreen.tsx` | 🔒 LOCKED | Mar 12, 2026 | Post-signup profile completion (name, DOB, avatar). |
| Onboarding | `src/screens/OnboardingScreen.tsx` | 🔒 LOCKED | Feb 27, 2026 | First-launch onboarding slides. |
| Location Picker | `src/screens/LocationPickerScreen.tsx` | 🔒 LOCKED | Feb 27, 2026 | Interactive map + Google Places Autocomplete search. |
| Storefront | `src/screens/StorefrontScreen.tsx` | 🔒 LOCKED | Feb 27, 2026 | Hero carousel, restaurant info, category pills, 2-col product grid, cart integration. |
| Cart | `src/screens/CartScreen.tsx` | 🟢 OPEN | — | Placeholder. Needs full implementation. |

### Navigation

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Root Navigator | `src/navigation/RootNavigator.tsx` | 🔒 LOCKED (Mar 12, 2026) | Auth-aware stack navigator. Session-based routing. |
| Main Tab Navigator | `src/navigation/MainTabNavigator.tsx` | 🔒 LOCKED | Bottom tabs: Home, Pickup, Dining, Cart. Redline effect. |

### Context & State

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Location Context | `src/context/LocationContext.tsx` | 🔒 LOCKED | Haversine proximity detection + address management. |

### Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Cart Summary Bar | `src/components/CartSummaryBar.tsx` | 🔒 LOCKED | Floating cart bar at bottom of screens. |

### Library / Config

| File | Status | Notes |
|------|--------|-------|
| `src/lib/supabase.ts` | 🔒 LOCKED (Mar 12, 2026) | Supabase auth initialized via SecureStore instead of AsyncStorage. |
| `src/lib/data.ts` | 🔒 LOCKED | Mock data constants (stores, products, images). |

---

## 🏪 Merchant App (`apps/merchant-app`)

### Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Add Custom Product Modal | `src/components/AddCustomProductModal.tsx` | 🔒 LOCKED (Mar 16, 2026) | Hardened: Duplicate prevention, multi-image upload, smart edit detection. |
| Bottom Modal | `src/components/BottomModal.tsx` | 🔒 LOCKED | Reusable bottom sheet modal. |
| Configure Products Modal | `src/components/ConfigureProductsModal.tsx` | 🔒 LOCKED | Product configuration with variants. |
| Filter Modal | `src/components/FilterModal.tsx` | 🔒 LOCKED | Order/inventory filter. |
| Inventory Card | `src/components/InventoryCard.tsx` | 🔒 LOCKED | Single inventory item display. |
| Notification Center | `src/components/NotificationCenter.tsx` | 🔒 LOCKED | Push notification handling. |
| OTP Verification Modal | `src/components/OTPVerificationModal.tsx` | 🔒 LOCKED | Phone OTP verification. |
| Order Breakup Modal | `src/components/OrderBreakupModal.tsx` | 🔒 LOCKED | Order price breakdown view. |
| Receipt Summary Modal | `src/components/ReceiptSummaryModal.tsx` | 🔒 LOCKED | PDF receipt preview/download. |
| Rejection Reason Modal | `src/components/RejectionReasonModal.tsx` | 🔒 LOCKED | Reason capture for order rejection. |

### Context & State

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Notification Context | `src/context/NotificationContext.tsx` | 🔒 LOCKED | Notification state management. |
| Store Context | `src/context/StoreContext.tsx` | 🔒 LOCKED | Store/branch selection and data. |
| User Context | `src/context/UserContext.tsx` | 🔒 LOCKED | Auth and user state. |

### Hooks

| Hook | File | Status | Notes |
|------|------|--------|-------|
| useCatalog | `src/hooks/useCatalog.ts` | 🔒 LOCKED | Master catalog search. |
| useEarnings | `src/hooks/useEarnings.ts` | 🔒 LOCKED | Earnings data fetching. |
| useInventory | `src/hooks/useInventory.ts` | 🔒 LOCKED | Inventory CRUD operations. |
| useNotifications | `src/hooks/useNotifications.ts` | 🔒 LOCKED | Notification subscription. |
| useOrders | `src/hooks/useOrders.ts` | 🔒 LOCKED | Order management with real-time updates. |
| useRealtimeTable | `src/hooks/useRealtimeTable.ts` | 🔒 LOCKED | Generic Supabase realtime subscription. |
| useStore | `src/hooks/useStore.ts` | 🔒 LOCKED | Store data hook. |

### Library / Config

| File | Status | Notes |
|------|--------|-------|
| `src/lib/supabase.ts` | 🔒 LOCKED | Supabase client. |
| `src/lib/audio.ts` | 🔒 LOCKED | Notification sound management. |

---

## 🌐 Merchant Web (`apps/merchant-web`)

### Screens

| Screen | File | Status | Notes |
|--------|------|--------|-------|
| Login | `src/screens/Auth/LoginScreen.tsx` | 🔒 LOCKED | Merchant login page. |
| Signup Wizard | `src/screens/Auth/SignupWizard.tsx` | 🔒 LOCKED | 7-step merchant onboarding form. |
| Verify (OTP) | `src/screens/Auth/VerifyScreen.tsx` | 🔒 LOCKED | OTP verification screen. |
| Branch Select | `src/screens/Auth/BranchSelectScreen.tsx` | 🔒 LOCKED | Branch selection after login. |
| Pending Approval | `src/screens/Auth/PendingApproval.tsx` | 🔒 LOCKED | Post-signup pending approval UI. |
| Application Rejected | `src/screens/Auth/ApplicationRejected.tsx` | 🔒 LOCKED | Rejection notice screen. |
| Dashboard Home | `src/screens/Dashboard/HomeScreen.tsx` | 🔒 LOCKED | Merchant dashboard overview. |
| Inventory | `src/screens/Inventory/InventoryScreen.tsx` | 🔒 LOCKED | Product inventory management. |
| Orders | `src/screens/Orders/OrdersScreen.tsx` | 🔒 LOCKED | Order management with filters. |
| Settings | `src/screens/Settings/SettingsScreen.tsx` | 🔒 LOCKED | Settings hub. |
| Notification Settings | `src/screens/Settings/NotificationSettings.tsx` | 🔒 LOCKED | Notification preferences. |

---

## 🖥️ Admin Web (`apps/admin-web`)

### Core Components

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| App Shell | `src/App.tsx` | 🔒 LOCKED | Main app with routing. |
| Layout | `src/Layout.tsx` | 🔒 LOCKED | Sidebar + content layout. |
| Header | `src/components/Header.tsx` | 🔒 LOCKED | Top navigation header. |
| Sidebar | `src/components/Sidebar.tsx` | 🔒 LOCKED | Navigation sidebar with modules. |
| Login | `src/components/Login.tsx` | 🔒 LOCKED | Admin authentication. |
| Dashboard | `src/components/Dashboard.tsx` | 🔒 LOCKED | Dashboard entry. |
| KPI Card | `src/components/KPICard.tsx` | 🔒 LOCKED | Stats display card. |
| Orders Chart | `src/components/OrdersChart.tsx` | 🔒 LOCKED | Analytics chart. |
| Activity Ticker | `src/components/ActivityTicker.tsx` | 🔒 LOCKED | Live activity feed. |
| Action Queue | `src/components/ActionQueue.tsx` | 🔒 LOCKED | Pending actions list. |
| Live Map | `src/components/LiveMap.tsx` | 🔒 LOCKED | Real-time order map. |

### Admin Modules (11 module directories)
| Module | Path | Status |
|--------|------|--------|
| Analytics | `src/components/modules/analytics/` | 🔒 LOCKED |
| Catalog | `src/components/modules/catalog/` | 🔒 LOCKED |
| Consumers | `src/components/modules/consumers/` | 🔒 LOCKED |
| Customers | `src/components/modules/customers/` | 🔒 LOCKED |
| Engagement | `src/components/modules/engagement/` | 🔒 LOCKED |
| Finance | `src/components/modules/finance/` | 🔒 LOCKED |
| Geography | `src/components/modules/geography/` | 🔒 LOCKED |
| Marketing | `src/components/modules/marketing/` | 🔒 LOCKED |
| Merchants | `src/components/modules/merchants/` | 🔒 LOCKED |
| Orders | `src/components/modules/orders/` | 🔒 LOCKED |
| Settings | `src/components/modules/settings/` | 🔒 LOCKED |

---

## 🌐 Consumer Web Legacy (`apps/consumer-web-legacy`)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Main App | `src/app/App.tsx` | 🔒 LOCKED | Full single-page consumer web app. |
| Mock Data | `src/data.ts` | 🔒 LOCKED | Stores, products, restaurants data. |

---

## 🏠 Landing Page (`apps/landing-page`)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Home Page | `src/app/page.tsx` | 🔒 LOCKED | Main marketing landing page. |
| Layout | `src/app/layout.tsx` | 🔒 LOCKED | Root layout with SEO metadata. |
| Privacy Policy | `src/app/privacypolicy/` | 🔒 LOCKED | Static legal page. |
| Delete Account | `src/app/deleteaccount/` | 🔒 LOCKED | Account deletion info page. |

---

## ⚙️ API Server (`apps/api`)

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| Main Server | `src/index.ts` | 🔒 LOCKED | Express.js API with all routes. |
| Services | `src/services/` | 🔒 LOCKED | Business logic services. |
| SQL Schemas | `*.sql` (root) | 🔒 LOCKED | Database schema definitions. |

---

> **To unlock a file**: User must explicitly say "unlock [filename]" or approve a structural change.  
> **To lock a new file**: Add `// @lock` comment + update this registry.
