# PAS Platform — Complete Feature Inventory

**Generated:** May 20, 2026
**Scope:** Customer App (consumer-app), Merchant App (merchant-app), Admin Dashboard (admin-web)
**Method:** Exhaustive codebase walk by three parallel review agents
**Total features documented:** ~340

> **How to use this file:** Every table below is copy-pasteable Markdown. Paste sections into Notion, Confluence, Coda, Linear, or any other tool that renders Markdown tables. Use the table of contents to jump between apps.

---

## Table of Contents

### Customer App (Consumer)
1. [Authentication & Onboarding](#customer--authentication--onboarding)
2. [Browse & Discovery](#customer--browse--discovery)
3. [Cart, Ordering & Checkout](#customer--cart-ordering--checkout)
4. [Orders & Post-Purchase](#customer--orders--post-purchase)
5. [Profile, Addresses, Favorites](#customer--profile-addresses-favorites)
6. [Support & Misc](#customer--support--misc)
7. [Navigation & Shell](#customer--navigation--shell)
8. [Contexts & Data Hooks](#customer--contexts--data-hooks)
9. [Modals & Overlays](#customer--modals--overlays)
10. [Real-time & Background](#customer--real-time--background)

### Merchant App
11. [Authentication & Onboarding (7-step KYC signup)](#merchant--authentication--onboarding)
12. [Dashboard](#merchant--dashboard)
13. [Inventory Management](#merchant--inventory-management)
14. [Filter Modal](#merchant--filter-modal)
15. [Orders Management](#merchant--orders-management)
16. [Settings Hub](#merchant--settings-hub)
17. [Table Booking (Dining)](#merchant--table-booking-dining)
18. [Notifications](#merchant--notifications)
19. [Earnings & Payouts](#merchant--earnings--payouts)
20. [Branch & Store Context Switching](#merchant--branch--store-context-switching)
21. [Contexts & Hooks](#merchant--contexts--hooks)
22. [Components & Modals](#merchant--components--modals)

### Admin Dashboard (admin-web)
23. [Authentication & Access](#admin--authentication--access)
24. [Module: Merchants](#admin--module-merchants)
25. [Module: Orders](#admin--module-orders)
26. [Module: Customers](#admin--module-customers)
27. [Module: Catalog (Master Catalog)](#admin--module-catalog)
28. [Module: Store Products](#admin--module-store-products)
29. [Module: Verticals / Categories](#admin--module-verticals)
30. [Module: Cities](#admin--module-cities)
31. [Module: Coupons](#admin--module-coupons)
32. [Module: Staff / Users](#admin--module-staff)
33. [Module: Notifications / Push](#admin--module-notifications)
34. [Module: Reports / Analytics](#admin--module-reports)
35. [Module: Settings](#admin--module-settings)
36. [Cross-cutting Features](#admin--cross-cutting)
37. [Data Fetching Hooks](#admin--data-fetching-hooks)

---

# CUSTOMER APP (consumer-app)

## Customer — Authentication & Onboarding

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Onboarding slide 1 — Discover Local Stores | Explains local store discovery concept | `src/screens/OnboardingScreen.tsx` | Shown only on first launch; persisted via SecureStore `has_seen_onboarding` |
| Onboarding slide 2 — Fast Delivery & Pickup | Explains BOPIS model | `src/screens/OnboardingScreen.tsx` | Horizontally scrollable FlatList, pagingEnabled |
| Onboarding slide 3 — Seamless Dining | Explains table reservation/pre-order | `src/screens/OnboardingScreen.tsx` | Final slide shows "Get Started" CTA |
| Onboarding dot indicator | Shows current slide position | `src/screens/OnboardingScreen.tsx` | Active dot widens to 8 units |
| Onboarding next/skip | Advances slides or jumps to Main | `src/screens/OnboardingScreen.tsx` | "Get Started" sets SecureStore flag and replaces to Main |
| Auth choose screen | Entry point showing logo, brand tagline, auth options | `src/screens/AuthScreen.tsx` | Bottom-sheet modal with spring animation; background photo with dark overlay |
| Auth — Continue with Phone CTA | Triggers phone number entry mode | `src/screens/AuthScreen.tsx` | Haptic feedback; mode state machine: choose → phone-input → phone-otp |
| Auth — Continue as Guest | Bypasses auth and navigates to Main | `src/screens/AuthScreen.tsx` | Apple Guideline 5.1.1(v) compliance; uses goBack or replace |
| Auth — Phone number input | 10-digit Indian mobile number field with +91 prefix | `src/screens/AuthScreen.tsx` | Validates length before enabling "Send OTP"; auto-keyboard |
| Auth — WhatsApp OTP delivery indicator | Shows green WhatsApp icon indicating OTP channel | `src/screens/AuthScreen.tsx` | Visual hint only; actual delivery via Wati |
| Auth — Send OTP | POSTs `91{number}` to `/auth/send-otp` API, transitions to OTP screen | `src/screens/AuthScreen.tsx` | 30s network timeout via fetchWithTimeout; sets 60s resend timer |
| Auth — 6-digit OTP boxes | Auto-advancing individual digit inputs | `src/screens/AuthScreen.tsx` | Backspace auto-retreats focus; refs array for imperative focus control |
| Auth — Verify OTP | POSTs OTP to `/auth/verify-otp`; on success sets Supabase session via tokens | `src/screens/AuthScreen.tsx` | New users are flagged with `pending_profile_setup` in SecureStore BEFORE session |
| Auth — Resend OTP | Re-calls Send OTP after 60s cooldown | `src/screens/AuthScreen.tsx` | Disabled during countdown; timer displayed |
| Auth — Back button | Steps back through mode state machine | `src/screens/AuthScreen.tsx` | phone-otp → phone-input → choose |
| Auth — New user routing | Navigates new users to ProfileSetup, returning users to Main | `src/screens/AuthScreen.tsx` | Uses `data.isNewUser` from API response |
| ProfileSetup — Avatar picker | Launches device photo library; cropped 1:1, quality 0.5 | `src/screens/ProfileSetupScreen.tsx` | Uploads as `{userId}/profile.jpg` to `avatars` bucket with upsert; shows spinner overlay |
| ProfileSetup — Full Name field | Required; minimum 3 chars | `src/screens/ProfileSetupScreen.tsx` | `autoCapitalize="words"` |
| ProfileSetup — Email field | Optional; validated with regex | `src/screens/ProfileSetupScreen.tsx` | Stored as null if blank |
| ProfileSetup — Date of Birth field | Optional; DD-MM-YYYY format with auto-dash insertion | `src/screens/ProfileSetupScreen.tsx` | Calendar date validation (prevents Feb 30 etc.); stored as ISO YYYY-MM-DD |
| ProfileSetup — Complete Setup | Upserts profile to Supabase `profiles` table; marks `profile_completed=true` | `src/screens/ProfileSetupScreen.tsx` | SecureStore cleanup is fire-and-forget to avoid unmount hang |
| ProfileSetup — Skip for now | Clears pending_profile_setup flag and navigates to Main | `src/screens/ProfileSetupScreen.tsx` | Profile can be completed later from ProfileScreen |

## Customer — Browse & Discovery

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| HomeScreen — Pickup card | Full-height card navigating to Pickup (HomeFeed) tab | `src/screens/HomeScreen.tsx` | Gradient overlay; haptic on tap |
| HomeScreen — Dining card | Full-height card navigating to Dining tab | `src/screens/HomeScreen.tsx` | Same card pattern as Pickup |
| HomeScreen — Featured hero image | Static non-interactive banner from HERO_IMAGES data | `src/screens/HomeScreen.tsx` | "Featured" badge overlay; single image |
| HomeScreen — Universal search | Real-time Postgres RPC search across all verticals | `src/screens/HomeScreen.tsx` | Calls `useGlobalSearch` with `verticalFilter=null`; shows SearchResults component |
| HomeScreen — Search store card renderer | Store result card showing name, vertical, distance | `src/screens/HomeScreen.tsx` | Linear gradient overlay on image; taps navigate to Storefront |
| HomeFeedScreen — Spotlight banner carousel | Horizontal pageable banners from static PICKUP_SPOTLIGHTS data | `src/screens/HomeFeedScreen.tsx` | 85% screen width cards; snap-to-interval enabled |
| HomeFeedScreen — Shop by Category grid | 5-column icon grid of all vertical categories from DB | `src/screens/HomeFeedScreen.tsx` | Icons/colors from CategoryContext; taps navigate to CategoryDetail |
| HomeFeedScreen — Quick filter chips | Nearest / Restaurants / Groceries / Coffee & Bites | `src/screens/HomeFeedScreen.tsx` | Toggle active state; re-sorts/filters allVenues; active dot indicator on Filter button |
| HomeFeedScreen — Filter button (Store filter) | Opens StoreFilterModal for advanced store filtering | `src/screens/HomeFeedScreen.tsx` | Red dot indicator when non-default filters active |
| HomeFeedScreen — Nearby store cards | Full-width venue cards showing store image, name, distance badge, ETA, category | `src/screens/HomeFeedScreen.tsx` | Only shows stores within 10 km PostGIS radius; "Currently Offline" overlay for closed stores |
| HomeFeedScreen — Store distance badge | Top-right badge with metres or km | `src/screens/HomeFeedScreen.tsx` | Color-coded ETA: green <3 km, amber ≤5 km, red >5 km |
| HomeFeedScreen — OFFER tag | Red "OFFER" label on stores with discounted products | `src/screens/HomeFeedScreen.tsx` | Computed from `products.some(p => p.discount > 0)` |
| HomeFeedScreen — NEW badge | Shown when store has no rating | `src/screens/HomeFeedScreen.tsx` | Rating or "NEW" badge in info row |
| HomeFeedScreen — Location-denied state | MapPinOff illustration + prompt to enable GPS | `src/screens/HomeFeedScreen.tsx` | permissionDenied from LocationContext |
| HomeFeedScreen — Network error state | WifiOff illustration + Retry button | `src/screens/HomeFeedScreen.tsx` | Calls refreshLocation + refreshStores |
| HomeFeedScreen — Retail-scoped search | Filters global search results to vertical="retail" | `src/screens/HomeFeedScreen.tsx` | Uses `verticalFilter='retail'` |
| DiningScreen — Spotlight banners | 5 dining-specific banners (PNG/JPG assets) | `src/screens/DiningScreen.tsx` | Non-navigable image carousel |
| DiningScreen — Cuisine filter pills | All / North Indian / South Indian / Chinese / Street Food / Mughlai / Continental / Italian / Multi-Cuisine | `src/screens/DiningScreen.tsx` | Filters diningStores by cuisine tag |
| DiningScreen — Veg filter modal | All / Veg only / Non-veg only toggle modal | `src/screens/DiningScreen.tsx` | Separate modal overlay; filters restaurant list |
| DiningScreen — Restaurant cards | Shows image, name, rating/NEW, distance, cuisine, booking CTA | `src/screens/DiningScreen.tsx` | "Book a Table" button opens BookingModal |
| DiningScreen — Search (dining-scoped) | RPC search with `verticalFilter='dining'` | `src/screens/DiningScreen.tsx` | SearchResults component with dining store renderer |
| DiningScreen — Store filter modal | Advanced filter for dining stores | `src/screens/DiningScreen.tsx` | Opens StoreFilterModal |
| CategoryDetailScreen — Category hero banner | Full-width 320 px image from vertical's banner_url | `src/screens/CategoryDetailScreen.tsx` | Falls back to Unsplash placeholder |
| CategoryDetailScreen — Subcategory grid | 5-column live subcategory chips from DB | `src/screens/CategoryDetailScreen.tsx` | Tapping a sub filters stores to those carrying items in that subcategory |
| CategoryDetailScreen — Store search | Text search filtering stores by name | `src/screens/CategoryDetailScreen.tsx` | Inline live filtering |
| CategoryDetailScreen — Quick filter pills | Open Now / Nearest / Open Late | `src/screens/CategoryDetailScreen.tsx` | "Open Late" checks `closing_time >= 23:00` or `is_24_7` |
| CategoryDetailScreen — Filter button | Opens category-specific StoreFilterModal | `src/screens/CategoryDetailScreen.tsx` | Dynamic config via `getFilterConfig(categoryName)` |
| CategoryDetailScreen — Store count badge | "{N} stores found" indicator | `src/screens/CategoryDetailScreen.tsx` | Updates reactively with filters |
| StorefrontScreen — Hero image carousel | Horizontal pageable carousel (store photos + product images, up to 6) | `src/screens/StorefrontScreen.tsx` | Pagination dots; auto-deduplicates product images |
| StorefrontScreen — Restaurant info block | Name, address, star rating or "NEW" badge, distance, open/closed indicator | `src/screens/StorefrontScreen.tsx` | Open/closed uses live real-time subscription data |
| StorefrontScreen — Animated offline banner | Pulsing dark card when store is closed | `src/screens/StorefrontScreen.tsx` | Looping Animated.sequence opacity pulse |
| StorefrontScreen — In-store search | Filters products by name within the store | `src/screens/StorefrontScreen.tsx` | Available both inline and in sticky header |
| StorefrontScreen — Veg/Non-Veg toggle pill | 3-state toggle: All / Pure Veg / Non-Veg | `src/screens/StorefrontScreen.tsx` | Only shown for dining stores with both veg and non-veg items |
| StorefrontScreen — Bestsellers filter pill | Shows only products flagged as bestseller | `src/screens/StorefrontScreen.tsx` | Smart-hide: only shown if ≥1 bestseller product exists |
| StorefrontScreen — Offers filter pill | Shows only products with discount > 0 | `src/screens/StorefrontScreen.tsx` | Smart-hide: only shown if ≥1 offer exists |
| StorefrontScreen — Under ₹300 pill | Filters products ≤ ₹300 | `src/screens/StorefrontScreen.tsx` | Smart-hide: only shown if count < total |
| StorefrontScreen — Clear all filters | Resets all inline and modal filters to defaults | `src/screens/StorefrontScreen.tsx` | Shown only when any filter is active |
| StorefrontScreen — Product filter & sort modal | Price range slider, sort by (relevance / price low-high / price high-low / popularity) | `src/screens/StorefrontScreen.tsx` | Opens FilterSortModal; "Apply X items" preview count |
| StorefrontScreen — Sticky header | Appears when scrolled past info block; has back, search, filter, category tabs | `src/screens/StorefrontScreen.tsx` | Computed using `headerHeight` layout measurement |
| StorefrontScreen — Category underline tabs | Scrollable horizontal nav tabs jumping to product sections | `src/screens/StorefrontScreen.tsx` | Both inline and sticky; tracks active section on scroll |
| StorefrontScreen — Favorite toggle (heart) | Adds/removes store from favorites | `src/screens/StorefrontScreen.tsx` | Red fill when favorited; triggers auth modal if guest |
| StorefrontScreen — Highlight product scroll-to | Auto-scrolls to a specific product from search results | `src/screens/StorefrontScreen.tsx` | Red border highlight that clears after 2s |
| StorefrontScreen — Real-time store status | Supabase realtime subscription for is_active/operating_hours/prep_time changes | `src/screens/StorefrontScreen.tsx` | Channel scoped to specific branch ID |
| SpotlightDetailScreen | Detail view for spotlight/promotional content | `src/screens/SpotlightDetailScreen.tsx` | Navigated from HomeStackNavigator |

## Customer — Cart, Ordering & Checkout

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Add to cart | Adds product to cart with quantity 1 | `src/context/CartContext.tsx` | Validates dining/pickup mixing; shows Alert with option to clear cart |
| Increment quantity | Increments item quantity by 1 | `src/context/CartContext.tsx` | Capped by product stock if known; Alert on max stock hit |
| Decrement / remove | Decrements quantity; removes item when qty reaches 0 | `src/context/CartContext.tsx` | Stock check irrelevant on decrement |
| Clear cart | Removes all items from cart | `src/context/CartContext.tsx` | Also syncs deletion to Supabase `cart_items` |
| Dining/Pickup mixing guard | Prevents adding dining items to a pickup cart (and vice versa) | `src/context/CartContext.tsx` | Alert with "Clear Cart" destructive action |
| Stock cap enforcement | Blocks adding beyond available stock | `src/context/CartContext.tsx` | Triggered on both addItem and updateQuantity |
| Supabase cart persistence | Syncs cart to cloud on every item change | `src/context/CartContext.tsx` | Merge logic: higher quantity wins on guest→auth merge |
| Guest cart merge | On sign-in, merges local guest cart with cloud cart | `src/context/CartContext.tsx` | Triggered on SIGNED_IN and TOKEN_REFRESHED events |
| CartScreen — Store-grouped item list | Items grouped by store with store name header | `src/screens/CartScreen.tsx` | Shows "Dine-in items" or "Items to be picked up" subtitle |
| CartScreen — Item quantity stepper | Minus/Plus buttons per item | `src/screens/CartScreen.tsx` | Haptic feedback on every tap |
| CartScreen — UOM display | Shows unit of measure (e.g. "500g", "1 Pc") | `src/screens/CartScreen.tsx` | Optional field |
| CartScreen — Clear All button | Clears entire cart with confirmation alert | `src/screens/CartScreen.tsx` | Navigates to Main after clearing |
| CartScreen — Bill details | Shows Item Total, GST (5% for dining), coupon discount, Grand Total | `src/screens/CartScreen.tsx` | GST only applied when `isRestaurantOrder` is true |
| CartScreen — Coupon display | Shows applied coupon name and discount amount | `src/screens/CartScreen.tsx` | Coupon received as route param from OffersScreen; auto-removed if cart drops below minOrder |
| CartScreen — Coupon minimum order guard | Removes coupon if subtotal falls below minimum | `src/screens/CartScreen.tsx` | Haptic warning notification; Alert with explanation |
| CartScreen — Proceed to Pay | Routes to DiningCheckout or Checkout based on cart type | `src/screens/CartScreen.tsx` | Gates on auth; shows TransactionalAuthModal if no session |
| CartScreen — Auth sync watcher | Waits up to 8s for profile hydration after modal login before proceeding | `src/screens/CartScreen.tsx` | Shows "Synchronizing..." spinner; times out with alert |
| CheckoutScreen — Pickup time slot picker | Per-store time slot selection (Today/Tomorrow, hourly slots based on store hours + prep time) | `src/screens/CheckoutScreen.tsx` | Skips expired slots; modal selection |
| CheckoutScreen — Pickup mode (myself/other) | Toggle between picking up yourself or designating another person | `src/screens/CheckoutScreen.tsx` | "For other" mode shows name + phone fields; contact picker from device |
| CheckoutScreen — Contact picker | Imports contacts from device for pickup-by-other | `src/screens/CheckoutScreen.tsx` | expo-contacts; searchable list modal |
| CheckoutScreen — Special instructions | Free-text field for order notes | `src/screens/CheckoutScreen.tsx` | Passed to order request |
| CheckoutScreen — Coupon apply | Manual coupon code entry + apply button | `src/screens/CheckoutScreen.tsx` | Validates against AVAILABLE_COUPONS list; supports flat, percentage, bank, UPI types |
| CheckoutScreen — Order request flow | Creates order requests per store; enters "waiting" step | `src/screens/CheckoutScreen.tsx` | 2-minute timeout via useOrderRequests; real-time Supabase subscription |
| CheckoutScreen — Waiting screen | Shows pending/accepted/rejected states with countdown timer | `src/screens/CheckoutScreen.tsx` | Timer ticks every second; "all resolved" triggers move to results |
| CheckoutScreen — Results screen | Shows accepted/rejected stores with per-store OTP | `src/screens/CheckoutScreen.tsx` | Back navigation blocked (usePreventRemove); offers Cancel with API call |
| CheckoutScreen — Razorpay payment | Opens Razorpay WebView modal for payment | `src/screens/CheckoutScreen.tsx` | Session recovery after WebView evicts Supabase session |
| CheckoutScreen — Order confirmation | Shows OTP, order number, per-store confirmed status | `src/screens/CheckoutScreen.tsx` | GST displayed; error diagnostic red box for debugging |
| CheckoutScreen — Developer mode | Hidden debug mode showing raw order state | `src/screens/CheckoutScreen.tsx` | Toggled by triple-tap on specific element |
| CheckoutScreen — Cancel order | Sends CANCELLED status to API if leaving during waiting/results | `src/screens/CheckoutScreen.tsx` | executeCancelOrder() called before navigation dispatch |
| DiningCheckoutScreen — Guest count picker | 1–10 person selector with +/- stepper | `src/screens/DiningCheckoutScreen.tsx` | GUEST_OPTIONS array |
| DiningCheckoutScreen — Arrival date picker | Native DateTimePicker; OS-specific (iOS spinner, Android dialog) | `src/screens/DiningCheckoutScreen.tsx` | Platform guard for Android dismiss handling |
| DiningCheckoutScreen — Arrival time picker | Native time picker; validates against store operating hours | `src/screens/DiningCheckoutScreen.tsx` | Handles midnight-crossing ranges; 30 min global prep buffer |
| DiningCheckoutScreen — Coupon code | Manual coupon entry | `src/screens/DiningCheckoutScreen.tsx` | Same AVAILABLE_COUPONS as pickup |
| DiningCheckoutScreen — GST (5%) | Applied on dining subtotal | `src/screens/DiningCheckoutScreen.tsx` | Shown in bill summary |
| DiningCheckoutScreen — Order request + waiting | Same state machine as pickup (form → waiting → results → confirmed) | `src/screens/DiningCheckoutScreen.tsx` | Realtime subscription; back-navigation blocked in waiting/results |
| DiningCheckoutScreen — Razorpay payment | WebView-based payment | `src/screens/DiningCheckoutScreen.tsx` | refreshSession called before verifying to recover from WebView eviction |
| RazorpayCheckout — WebView payment modal | Loads Razorpay Checkout.js in a WebView; captures paymentId, orderId, signature | `src/components/RazorpayCheckout.tsx` | No native modules; Expo Go compatible; sanitizes HTML injection |
| OffersScreen — Coupon browser | Lists all available coupons with type (Flat/Percentage/Bank/UPI), color-coded | `src/screens/OffersScreen.tsx` | Searchable; coupon selected and passed back as route param to Cart |
| BookingModal — Branch selector | Dropdown for multi-branch merchants | `src/components/BookingModal.tsx` | Auto-selects if single branch |
| BookingModal — Guest count | Stepper 1–N | `src/components/BookingModal.tsx` | |
| BookingModal — Date selector (7-day strip) | Today through 7 days ahead | `src/components/BookingModal.tsx` | Day/date labels |
| BookingModal — Time slot picker | Live slots from `/bookings/availability` API | `src/components/BookingModal.tsx` | Real-time Supabase subscription on `table_bookings` for slot updates |
| BookingModal — Booking fee display | ₹25 per 2 guests, capped at ₹100 | `src/components/BookingModal.tsx` | Displayed before payment |
| BookingModal — Razorpay deposit payment | Collects booking deposit before confirming | `src/components/BookingModal.tsx` | TransactionalAuthModal gate if guest |
| BookingModal — Confirmed state | Shows booking OTP and booking ID | `src/components/BookingModal.tsx` | |
| FloatingCartBand — Global cart CTA | Persistent red pill showing item count + estimated total; taps navigate to Cart | `src/components/FloatingCartBand.tsx` | Hidden on Cart, Checkout, DiningCheckout, Auth, Onboarding, ProfileSetup screens |
| CartSummaryBar — Tab-level cart bar | Shows item count + "₹X plus taxes" + "View Cart" button | `src/components/CartSummaryBar.tsx` | Absolute positioned within individual tab screens; hidden when cart empty |

## Customer — Orders & Post-Purchase

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| YourOrdersScreen — Order list | Lists all user orders sorted by newest first | `src/screens/YourOrdersScreen.tsx` | Pull-to-refresh; joins `order_items` + `merchant_branches.merchant.gst_number` |
| YourOrdersScreen — Real-time order updates | Supabase realtime subscription on `orders` filtered by user_id | `src/screens/YourOrdersScreen.tsx` | Triggers re-fetch on UPDATE event |
| YourOrdersScreen — Order status badges | CONFIRMED (PENDING), PREPARING/RESERVED (ACCEPTED/READY), COMPLETED, CANCELLED | `src/screens/YourOrdersScreen.tsx` | Dining ACCEPTED shows "RESERVED" in blue; pickup shows "PREPARING" in yellow |
| YourOrdersScreen — Order detail alert | Alert popup showing items, total, OTP, arrival time, guest count, instructions | `src/screens/YourOrdersScreen.tsx` | Tap on order card |
| YourOrdersScreen — Invoice modal trigger | Opens InvoiceModal on order card tap | `src/screens/YourOrdersScreen.tsx` | Locked section per code comments |
| YourOrdersScreen — OTP display | OTP shown in order detail alert | `src/screens/YourOrdersScreen.tsx` | `order.otp_code` field |
| InvoiceModal — Tax invoice header | Invoice title, order number, status pill | `src/components/InvoiceModal.tsx` | Locked; hard-coded review approval |
| InvoiceModal — Seller block | Merchant name, branch address, city, phone, GSTIN | `src/components/InvoiceModal.tsx` | GSTIN from `branch.merchant.gst_number` join |
| InvoiceModal — Buyer block | Customer name (from profile), order date | `src/components/InvoiceModal.tsx` | |
| InvoiceModal — Items table (pickup) | Line items with quantity, price, line total | `src/components/InvoiceModal.tsx` | Not shown for dine-in |
| InvoiceModal — Booking deposit row (dining) | Shows full amount as booking deposit | `src/components/InvoiceModal.tsx` | Branch: `order_type === 'dine-in'` |
| InvoiceModal — GST line (pickup) | 5% GST on pickup subtotal | `src/components/InvoiceModal.tsx` | Not applied for dining orders |
| InvoiceModal — Grand total | Sum of subtotal + GST | `src/components/InvoiceModal.tsx` | |
| InvoiceModal — OTP PIN display | Shows order OTP | `src/components/InvoiceModal.tsx` | |
| InvoiceModal — Payment ref (masked) | Shows last 8 chars of Razorpay payment ID | `src/components/InvoiceModal.tsx` | Masked with bullets |
| InvoiceModal — Legal disclaimer | Terms text at bottom | `src/components/InvoiceModal.tsx` | |

## Customer — Profile, Addresses, Favorites

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| ProfileScreen — Avatar display | Shows profile photo from `avatars` bucket | `src/screens/ProfileScreen.tsx` | Tap opens image picker to update |
| ProfileScreen — Avatar upload | Uploads new photo to `avatars` Supabase bucket | `src/screens/ProfileScreen.tsx` | expo-image-picker; 1:1 crop; quality 0.5 |
| ProfileScreen — Edit name/DOB modal | In-app modal to update full_name and date_of_birth | `src/screens/ProfileScreen.tsx` | Syncs from profile on open; converts date format |
| ProfileScreen — Notification preferences | Toggle switches for push/email/WhatsApp per category (newsletter, promos, social, orders, important) | `src/screens/ProfileScreen.tsx` | In separate modal; enable_all master toggle |
| ProfileScreen — Security preferences | 2FA and biometric login toggles | `src/screens/ProfileScreen.tsx` | Uses expo-local-authentication; stored in `secPrefs` state |
| ProfileScreen — Your Orders link | Navigates to YourOrdersScreen | `src/screens/ProfileScreen.tsx` | |
| ProfileScreen — Favorites link | Navigates to FavoritesScreen | `src/screens/ProfileScreen.tsx` | |
| ProfileScreen — Payment Methods link | Navigates to PaymentMethodsScreen | `src/screens/ProfileScreen.tsx` | |
| ProfileScreen — Support link | Navigates to SupportScreen | `src/screens/ProfileScreen.tsx` | |
| ProfileScreen — Sign out | Calls supabase.auth.signOut + purgeAuthSession + clears AsyncStorage profile cache | `src/screens/ProfileScreen.tsx` | Confirmation alert before signing out |
| ProfileScreen — Pull-to-refresh | Refreshes profile data from AuthContext | `src/screens/ProfileScreen.tsx` | |
| LocationPickerScreen — Google Maps view | Interactive map showing pin at selected location | `src/screens/LocationPickerScreen.tsx` | PROVIDER_GOOGLE; shows user location dot |
| LocationPickerScreen — Search bar overlay | Google Places Autocomplete with debounce 500ms | `src/screens/LocationPickerScreen.tsx` | Min 3 chars to trigger; country restricted to India |
| LocationPickerScreen — Autocomplete results | Dropdown showing main_text + secondary_text for each prediction | `src/screens/LocationPickerScreen.tsx` | Calls Places Details API on tap to get coordinates |
| LocationPickerScreen — Use Current Location | Requests GPS permission; gets high-accuracy position; reverse geocodes | `src/screens/LocationPickerScreen.tsx` | Falls back to last known position first |
| LocationPickerScreen — Confirm Location button | Opens address form modal after place is confirmed | `src/screens/LocationPickerScreen.tsx` | Button label changes between "Use Current Location" and "Confirm Location" |
| LocationPickerScreen — Address type tags | Home / Work / Other with custom name input for Other | `src/screens/LocationPickerScreen.tsx` | Warns if Home/Work already saved for that type |
| LocationPickerScreen — Street address field | Required; editable | `src/screens/LocationPickerScreen.tsx` | |
| LocationPickerScreen — Apt/Floor/Landmark | Optional supplemental detail | `src/screens/LocationPickerScreen.tsx` | |
| LocationPickerScreen — City/Pincode/State | Auto-populated from geocoding; read-only | `src/screens/LocationPickerScreen.tsx` | From Google Places address_components |
| LocationPickerScreen — Save Address | Inserts or updates `consumer_addresses`; refreshes LocationContext | `src/screens/LocationPickerScreen.tsx` | Duplicate type guard for Home/Work |
| LocationPickerScreen — Saved address list | Lists all user's saved addresses with active indicator | `src/screens/LocationPickerScreen.tsx` | 15s Supabase timeout; active address shown with checkmark |
| LocationPickerScreen — Select address | Sets active location in LocationContext; navigates back | `src/screens/LocationPickerScreen.tsx` | |
| LocationPickerScreen — Edit address | Pre-populates form and map from saved address | `src/screens/LocationPickerScreen.tsx` | Parses stored address string back into fields |
| LocationPickerScreen — Delete address | Deletes from DB; refreshes context (GPS takeover if active address deleted) | `src/screens/LocationPickerScreen.tsx` | |
| LocationPickerScreen — Add New Address button | Opens blank address form | `src/screens/LocationPickerScreen.tsx` | Dashed border CTA |
| FavoritesScreen — Stores tab | Lists favorited stores as cards | `src/screens/FavoritesScreen.tsx` | Empty state: illustration + message |
| FavoritesScreen — Products tab | Lists favorited products as ProductCards with add-to-cart | `src/screens/FavoritesScreen.tsx` | Hydrates StoreProduct records from Supabase on mount |
| useFavorites — Toggle store favorite | Optimistic UI + Supabase `favorite_stores` upsert/delete | `src/hooks/useFavorites.ts` | Auth guard; rolls back on error |
| useProductFavorites — Toggle product favorite | Optimistic UI + Supabase `favorite_products` upsert/delete | `src/hooks/useProductFavorites.ts` | Auth guard; rolls back on error |
| PaymentMethodsScreen — Empty state | Shows "No payment methods added" with illustration | `src/screens/PaymentMethodsScreen.tsx` | Feature is stub; no real payment method management |

## Customer — Support & Misc

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| SupportScreen — FAQ accordion | 6 pre-defined customer FAQs with expand/collapse | `src/screens/SupportScreen.tsx` | One FAQ expanded at a time |
| SupportScreen — FAQ search | Filters FAQs by question or answer text | `src/screens/SupportScreen.tsx` | Case-insensitive; live filter; clear button |
| SupportScreen — Website link | Opens `https://www.pickatstore.io` in browser | `src/screens/SupportScreen.tsx` | Linking.openURL |
| SupportScreen — Email link | Opens mail client to `support@pickatstore.io` | `src/screens/SupportScreen.tsx` | Linking.openURL with mailto: scheme |
| SupportScreen — Terms of Service link | Opens `https://www.pickatstore.io/terms` | `src/screens/SupportScreen.tsx` | Linking.openURL |
| SwapScreen | Placeholder screen in navigation stack | `src/screens/SwapScreen.tsx` | Registered in RootNavigator |
| AddPaymentMethodScreen | Screen to add a new payment method (navigated from PaymentMethods) | `src/screens/AddPaymentMethodScreen.tsx` | Registered in RootNavigator |

## Customer — Navigation & Shell

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Bottom tab bar — Home | Brand logo icon; navigates to HomeScreen | `src/navigation/MainTabNavigator.tsx` | Logo icon from `assets/brand/logo_icon.png`; no label shown |
| Bottom tab bar — Pickup | Storefront icon; navigates to HomeFeedScreen | `src/navigation/MainTabNavigator.tsx` | Outline/filled state on focus |
| Bottom tab bar — Dining | Restaurant icon; navigates to DiningScreen | `src/navigation/MainTabNavigator.tsx` | Outline/filled state |
| Bottom tab bar — Cart | Cart icon; navigates to CartScreen | `src/navigation/MainTabNavigator.tsx` | No badge count shown at tab level |
| Bottom tab bar — styling | Rounded top corners, brand red active color, brand red top border line | `src/navigation/MainTabNavigator.tsx` | Safe area inset-aware height |
| GlobalHeader — Location display | Shows activeLocation.type + address; tap navigates to LocationPicker | `src/components/GlobalHeader.tsx` | "Finding Location..." during load; "Select Location" fallback |
| GlobalHeader — Profile avatar | Shows user avatar or generic User icon; tap navigates to Profile or Auth | `src/components/GlobalHeader.tsx` | |
| GlobalHeader — Search bar | Controlled text input with clear button (X) | `src/components/GlobalHeader.tsx` | Placeholder customizable per screen |
| GlobalHeader — Right content slot | Optional slot for screen-specific controls (e.g. Filter button in HomeFeed) | `src/components/GlobalHeader.tsx` | Rendered to the right of search bar |
| GlobalHeader — Bottom content slot | Optional slot for category filter chips row | `src/components/GlobalHeader.tsx` | Rendered below search bar |
| FloatingCartBand | Global brand-red cart band above tab bar; shows item count, estimated total, Proceed button | `src/components/FloatingCartBand.tsx` | Route-aware hide list; tracks navigation state changes |
| CartSummaryBar | Screen-level floating cart bar for tab screens | `src/components/CartSummaryBar.tsx` | Hidden when cart empty |
| RootNavigator — Onboarding gate | First-launch routing to OnboardingScreen | `src/navigation/RootNavigator.tsx` | SecureStore `has_seen_onboarding` flag |
| RootNavigator — Guest-first policy | Main feed always accessible; Auth is not a gate | `src/navigation/RootNavigator.tsx` | Apple Guideline 5.1.1(v) compliance |
| RootNavigator — ProfileSetup routing | Routes new authenticated users to ProfileSetup | `src/navigation/RootNavigator.tsx` | `pending_profile_setup` SecureStore flag |

## Customer — Contexts & Data Hooks

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| AuthContext — session | Holds active Supabase JWT session | `src/context/AuthContext.tsx` | Boot timeout 3s; auth listener with 500ms settle buffer on SIGNED_IN |
| AuthContext — user | Current authenticated Supabase user object | `src/context/AuthContext.tsx` | Null for guests |
| AuthContext — profile | User's profiles row (full_name, avatar_url, date_of_birth, email) | `src/context/AuthContext.tsx` | AsyncStorage cache with userId-keyed key; deduplication guard; auto-retry on error |
| AuthContext — isProfileLoading | Loading state for profile fetch | `src/context/AuthContext.tsx` | Used by CartScreen auth sync watcher |
| AuthContext — profileStatus | Explicit state machine: idle / loading / success / error | `src/context/AuthContext.tsx` | Auto-retries once after 3s on error |
| AuthContext — signOut | Signs out, clears profile cache | `src/context/AuthContext.tsx` | |
| AuthContext — refreshProfile | Manual profile re-fetch | `src/context/AuthContext.tsx` | Used by ProfileScreen pull-to-refresh |
| CartContext — items | Array of CartItem (id, name, price, image, quantity, storeId, storeName, isDining, isVeg, uom, stock) | `src/context/CartContext.tsx` | |
| CartContext — groupedItems | Items keyed by storeId | `src/context/CartContext.tsx` | Used by CartScreen to render store groups |
| CartContext — addItem | Adds or increments; validates dining/pickup mix; stock cap | `src/context/CartContext.tsx` | |
| CartContext — updateQuantity | Updates qty; removes when 0; stock cap | `src/context/CartContext.tsx` | |
| CartContext — clearCart | Clears all items + cloud sync | `src/context/CartContext.tsx` | |
| CartContext — getItemCount | Sum of all quantities | `src/context/CartContext.tsx` | Used by FloatingCartBand |
| CartContext — getTotal | Sum of price * quantity | `src/context/CartContext.tsx` | Pre-tax |
| CartContext — cloud sync | Continuous upsert to `cart_items` on every change; handles deletes | `src/context/CartContext.tsx` | isLoadingFromCloud flag prevents feedback loop |
| LocationContext — activeLocation | Currently active delivery location (type, address, lat, lng) | `src/context/LocationContext.tsx` | 4-priority resolution: persisted manual → nearest saved address → cached GPS → live reverse geocode |
| LocationContext — isLoadingLocation | Loading state for location resolution | `src/context/LocationContext.tsx` | 15s failsafe timer forces false |
| LocationContext — permissionDenied | True when GPS permission refused | `src/context/LocationContext.tsx` | Shown as error state in HomeFeed |
| LocationContext — selectLocation | Manually sets and persists a location | `src/context/LocationContext.tsx` | Persists to AsyncStorage; prevents auto-refresh from overwriting |
| LocationContext — refreshLocation | Re-runs smart location resolution | `src/context/LocationContext.tsx` | Rate-limited to 3s; bypassed on force |
| CategoryContext — verticals | List of all store verticals (id, name, color, icon, banner_url, theme_color) | `src/context/CategoryContext.tsx` | AsyncStorage cache; 8s Supabase timeout; stale-while-revalidate |
| CategoryContext — getVerticalName | Maps vertical ID to display name | `src/context/CategoryContext.tsx` | Returns "Other" as fallback |
| useGlobalSearch | Debounced 500ms Postgres RPC `search_nearby_inventory` within 10 km | `src/hooks/useGlobalSearch.ts` | Returns stores + matched products per store; abort ref prevents race conditions |
| useNearbyStores | PostGIS RPC `get_nearby_stores` within 10 km; returns IDs + distanceMap | `src/hooks/useNearbyStores.ts` | Waits for LocationContext to resolve; unique channelId per mount |
| useStores | Fetches all merchant branches from Supabase; exposes `stores` + `diningStores` | `src/hooks/useStores.ts` | |
| useProducts | Fetches products for a specific branch from Supabase | `src/hooks/useProducts.ts` | |
| useCategoryItems | Fetches StoreProduct inventory filtered by nearby store IDs + verticalId | `src/hooks/useCategoryItems.ts` | Used by CategoryDetailScreen |
| useSubCategories | Fetches subcategories for a given verticalId | `src/hooks/useSubCategories.ts` | Used by CategoryDetailScreen subcategory grid |
| useOrderRequests | Creates order requests per store; subscribes to real-time status updates; 2-min timeout | `src/hooks/useOrderRequests.ts` | Supabase channel subscription; expireRequest method |
| useFavorites | Manages favorite store IDs with optimistic UI; `toggleFavorite`; auth guard | `src/hooks/useFavorites.ts` | Rollback on Supabase error |
| useProductFavorites | Manages favorite product IDs with optimistic UI; `toggleProductFavorite`; auth guard | `src/hooks/useProductFavorites.ts` | Rollback on error |
| useSlotAvailability | Fetches time slot availability from `/bookings/availability` API; real-time subscription on `table_bookings` | `src/hooks/useSlotAvailability.ts` | Re-fetches on any booking insert/update/delete |

## Customer — Modals & Overlays

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| TransactionalAuthModal | Bottom-sheet phone OTP login triggered at checkout/favorites; same flow as AuthScreen but inside Modal | `src/components/TransactionalAuthModal.tsx` | Manual keyboard avoidance (KAV unreliable inside Modal); custom title/subtitle props |
| BookingModal | Table booking form: branch selector, guest count, 7-day date strip, live time slots, booking fee, Razorpay deposit | `src/components/BookingModal.tsx` | useSlotAvailability for real-time slots; TransactionalAuthModal gate for guests |
| InvoiceModal | Tax invoice bottom sheet for completed orders | `src/components/InvoiceModal.tsx` | Seller GSTIN, items table or deposit row, GST, masked payment ref, OTP |
| AddressModal | Part of LocationPickerScreen: street, apt, city/pincode/state (read-only), type tags | `src/screens/LocationPickerScreen.tsx` | Rendered as React Native Modal with slide animation |
| FilterSortModal | Product-level filter/sort for Storefront: sort by, veg filter, price range slider, bestsellers toggle, offers toggle | `src/components/FilterSortModal.tsx` | "Apply X items" live count preview; Reset button |
| StoreFilterModal | Store-level filter for HomeFeed/CategoryDetail: sort by, min rating chips, max distance chips, Open Now toggle, Pure Veg toggle, price range, brands multiselect | `src/components/StoreFilterModal.tsx` | Dynamic visibility of sections via props |
| SearchResults | Inline results component (not a modal): shows matched stores + allMatchedProducts grouped by store | `src/components/SearchResults.tsx` | Used by HomeScreen, HomeFeedScreen, DiningScreen; storeCardRenderer prop |
| RangeSlider | Custom dual-handle price range slider for Filter modals | `src/components/RangeSlider.tsx` | Used inside FilterSortModal and StoreFilterModal |
| RazorpayCheckout | WebView modal wrapping Razorpay Checkout.js | `src/components/RazorpayCheckout.tsx` | WebView key reset on each open; message bridge for success/error/dismiss |
| VegFilter modal (Dining) | 3-option modal for All / Veg only / Non-veg only within DiningScreen | `src/screens/DiningScreen.tsx` | Separate vegModalVisible state |
| Time picker modal (Checkout) | Per-store pickup time slot selection with Today/Tomorrow tabs | `src/screens/CheckoutScreen.tsx` | Shows store address; slot regenerated from store operating hours + prep time |
| Contacts picker modal (Checkout) | Lists device contacts searchable by name for "pickup by other" | `src/screens/CheckoutScreen.tsx` | expo-contacts permission request |

## Customer — Real-time & Background

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Storefront live status subscription | Supabase Postgres Changes on `merchant_branches` (UPDATE) scoped to branch ID | `src/screens/StorefrontScreen.tsx` | Updates isActive, operatingHours, prepTime in real time |
| YourOrders real-time update | Supabase Postgres Changes on `orders` (UPDATE) filtered by user_id | `src/screens/YourOrdersScreen.tsx` | Triggers fetchOrders() on any order state change |
| Order request real-time subscription | Supabase Postgres Changes on `order_requests` during checkout waiting step | `src/hooks/useOrderRequests.ts` | Drives PENDING→ACCEPTED/REJECTED transitions; 2-minute client-side expiry |
| Table booking slot real-time update | Supabase Postgres Changes on `table_bookings` for a given branch | `src/hooks/useSlotAvailability.ts` | Re-fetches availability whenever any booking changes |
| Cart cloud sync | Continuous upsert/delete sync of cart state to Supabase `cart_items` | `src/context/CartContext.tsx` | Triggered on every items state change; loop-prevention guard |
| Location GPS refresh | expo-location foreground permission + getCurrentPositionAsync (Balanced accuracy) | `src/context/LocationContext.tsx` | Falls back to last known position then reverse geocode |
| Location auto-snap to saved address | On each refresh, queries nearest saved address within 5 km | `src/context/LocationContext.tsx` | Requires logged-in user; Haversine distance calculation |
| Auth hydration bridge | Detects null→user transition (session restored from AsyncStorage) and force-refreshes location | `src/context/LocationContext.tsx` | Bypasses 3s rate limit |
| Auth state change listener | Supabase onAuthStateChange drives session/user/profile refresh app-wide | `src/context/AuthContext.tsx` | 500ms settle buffer on SIGNED_IN to avoid GoTrue lock race |
| Profile AsyncStorage cache | Profiles cached by `@profile_{userId}` key; served stale-while-revalidate | `src/context/AuthContext.tsx` | Cleared on sign-out |
| Category verticals cache | Verticals list cached in `pas_verticals_cache` AsyncStorage key | `src/context/CategoryContext.tsx` | Always background-refetches after serving from cache |
| Manual location persistence | Selected named location stored in `pas_last_active_location` AsyncStorage | `src/context/LocationContext.tsx` | Ignored if user has moved >5 km from it; cleared on logout |

---

# MERCHANT APP

## Merchant — Authentication & Onboarding

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Phone number input (login) | Accepts 10-digit Indian mobile number with +91 prefix | `app/(auth)/login.tsx` | Validates exactly 10 digits before enabling Send OTP |
| OTP send (login) | POST /auth/send-otp with `isLogin: true` flag | `app/(auth)/login.tsx` | 30s fetch timeout; sets 60s resend timer |
| 6-digit OTP entry (login) | Six individual TextInput cells with auto-advance and backspace navigation | `app/(auth)/login.tsx` | refs array for focus management |
| OTP verify & session mount (login) | POST /auth/verify-otp, calls setSessionFromTokens | `app/(auth)/login.tsx` | Session set before DB queries |
| Multi-role discovery | Queries merchants (owner), merchant_branches (manager phone), store_staff (user_id) and builds contextMap | `app/(auth)/login.tsx` | Aggregates across all three tables; owner gets all branches auto-added |
| Branch/context selection modal | Bottom sheet showing all merchants and their branches when user has >1 context | `app/(auth)/login.tsx` | Shows role label (Owner/Manager); stores active_context and active_branch_id in AsyncStorage |
| Single-context auto-login | If only one context found, skips modal and navigates directly | `app/(auth)/login.tsx` | 600ms delay before router.replace('/') |
| Apply as Partner button | Navigates to signup flow | `app/(auth)/login.tsx` | Shown only on phone-input step |
| Step 1 — Owner name field | Text input for owner full name | `app/(auth)/signup.tsx` | Required; validated before OTP send |
| Step 1 — Phone number field | 10-digit mobile with OTP verification inline | `app/(auth)/signup.tsx` | Validates 10 digits, starts 6–9; duplicate check against merchants table |
| Step 1 — Email field | Email address input | `app/(auth)/signup.tsx` | Regex validated; shown alongside phone |
| Step 1 — OTP inline send | Sends OTP with `isSignup: true`; mounts Supabase session | `app/(auth)/signup.tsx` | Checks merchants table for existing non-draft account and redirects to login |
| Step 1 — OTP inline verify | Six-cell OTP entry; sets otpVerified flag | `app/(auth)/signup.tsx` | Also triggers fetchRemoteMerchantState to check if subscription already paid |
| Draft persistence | Debounced 1-second AsyncStorage save of all form state | `app/(auth)/signup.tsx` | Restored on mount; wipe directive active (removeItem on every mount) |
| Step 2 — Store name | Text input for business name | `app/(auth)/signup.tsx` | Required |
| Step 2 — Category/vertical | Picker fetched from GET /verticals; isDining flag drives later steps | `app/(auth)/signup.tsx` | isPremium flag sets subscription price to ₹2999 vs ₹999 |
| Step 2 — City | Defaulted to Hyderabad | `app/(auth)/signup.tsx` | |
| Step 2 — Address | Full address text input | `app/(auth)/signup.tsx` | Required |
| Step 2 — GPS location capture | expo-location foreground permission + getCurrentPositionAsync | `app/(auth)/signup.tsx` | Writes lat/lng to store state |
| Step 2 — Map pin (MapView) | Google Maps view with draggable Marker to confirm coordinates | `app/(auth)/signup.tsx` | PROVIDER_GOOGLE |
| Step 2 — Cuisines (dining only) | Multi-select list of cuisine options | `app/(auth)/signup.tsx` | Shown only if selectedVertical.isDining |
| Step 2 — Veg-only toggle (dining) | Boolean flag for pure-veg restaurant | `app/(auth)/signup.tsx` | Dining vertical only |
| Step 2 — Restaurant type (dining) | Picker for restaurant type (Casual/Fine/Cafe etc.) | `app/(auth)/signup.tsx` | Dining vertical only |
| Step 3 — Store photos upload | ImagePicker multi-image picker; requires minimum 2 photos | `app/(auth)/signup.tsx` | Images base64-decoded and uploaded to Supabase storage |
| Step 4 — Branch toggle | Switch: does merchant have additional branches? | `app/(auth)/signup.tsx` | Controls whether branch list UI is shown |
| Step 4 — Add branch: name | Branch name text input | `app/(auth)/signup.tsx` | Per-branch |
| Step 4 — Add branch: address | Branch address text input | `app/(auth)/signup.tsx` | Per-branch |
| Step 4 — Add branch: manager name | Manager name text input | `app/(auth)/signup.tsx` | Per-branch |
| Step 4 — Add branch: phone | Manager phone text input | `app/(auth)/signup.tsx` | Per-branch |
| Step 4 — Add branch: cuisines (dining) | Multi-select cuisines for branch | `app/(auth)/signup.tsx` | Dining only |
| Step 4 — Add branch: isVeg (dining) | Veg toggle per branch | `app/(auth)/signup.tsx` | Dining only |
| Step 4 — Add branch: restaurantType (dining) | Restaurant type per branch | `app/(auth)/signup.tsx` | Dining only |
| Step 4 — Add branch: photos | Branch photo upload | `app/(auth)/signup.tsx` | Per-branch |
| Step 5 — PAN number | PAN text field with regex validation ABCDE1234F | `app/(auth)/signup.tsx` | Mandatory; image upload required |
| Step 5 — PAN card upload | Image picker for PAN card photo | `app/(auth)/signup.tsx` | Stored in docFiles.pan |
| Step 5 — Aadhaar number | 12-digit numeric field | `app/(auth)/signup.tsx` | Mandatory |
| Step 5 — Aadhaar front upload | Image picker for Aadhaar front | `app/(auth)/signup.tsx` | Stored in docFiles.aadharFront |
| Step 5 — Aadhaar back upload | Image picker for Aadhaar back | `app/(auth)/signup.tsx` | Stored in docFiles.aadharBack |
| Step 5 — GST number | GSTIN regex 22AAAAA0000A1Z5 | `app/(auth)/signup.tsx` | Mandatory for all; image upload required |
| Step 5 — GST certificate upload | Image picker for GST certificate | `app/(auth)/signup.tsx` | Stored in docFiles.gst |
| Step 5 — FSSAI number | 14-digit field; only shown if vertical.requiresFssai | `app/(auth)/signup.tsx` | Conditional on vertical |
| Step 5 — FSSAI license upload | Image picker for FSSAI document | `app/(auth)/signup.tsx` | Conditional on vertical |
| Step 5 — MSME number | Optional; validates UDYAM-XX-00-0000000 format if entered | `app/(auth)/signup.tsx` | Optional |
| Step 5 — MSME certificate upload | Optional image upload | `app/(auth)/signup.tsx` | Conditional on MSME number entered |
| Step 5 — Bank account number | 9–18 digit numeric field | `app/(auth)/signup.tsx` | Mandatory |
| Step 5 — IFSC code | IFSC regex SBIN0001234 | `app/(auth)/signup.tsx` | Mandatory |
| Step 5 — Beneficiary name | Text field for bank account holder name | `app/(auth)/signup.tsx` | Mandatory |
| Step 5 — Turnover range | Picker: <20L (default) | `app/(auth)/signup.tsx` | Stored in kyc.turnoverRange |
| Step 6 — Subscription payment | Razorpay Checkout; ₹999 standard / ₹2999 premium based on vertical | `app/(auth)/signup.tsx` | Dev mode simulates success; server-side order creation + signature verification |
| Step 6 — Payment guard | fetchRemoteMerchantState checks if subscription already paid; auto-advances if true | `app/(auth)/signup.tsx` | Prevents double-charging on app restart |
| Step 7 — Review & Submit | Displays summary of all steps; PATCH /auth/merchant/draft to finalize | `app/(auth)/signup.tsx` | Clears draft from AsyncStorage on success |
| Pending screen | Shows "Application Under Review" after signup; log out button | `app/(auth)/pending.tsx` | Contact support link via email |

## Merchant — Dashboard

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Store Online/Offline switch | Toggle store.active; shows confirmation alert; disabled during schedule-based offline | `app/(main)/dashboard.tsx` | Uses toggleStoreStatus from useStore |
| Switch label | Shows Online/Offline/Closed/Break text below the switch | `app/(main)/dashboard.tsx` | Reflects isClosedToday, isOutsideHours, isLunchBreak |
| Red offline banner | Full-width red bar: "Store Offline - Not accepting new orders" | `app/(main)/dashboard.tsx` | Shown when !store.active and not schedule-based |
| Amber schedule banner (Closed Today) | Amber bar with calendar icon: "Store Closed - Today is a non-working day" | `app/(main)/dashboard.tsx` | Re-evaluates every 30s; uses store.operating_hours.days |
| Amber schedule banner (Outside Hours) | Amber bar with time icon: "Outside Hours - Opens at HH:MM" | `app/(main)/dashboard.tsx` | Checks open/close with prep_time buffer |
| Amber schedule banner (Lunch Break) | Amber bar with restaurant icon: "Lunch Break - Store is temporarily offline" | `app/(main)/dashboard.tsx` | Checks lunchStart/lunchEnd range |
| Greyscale overlay | Dims entire content area to 0.6 opacity when store is offline | `app/(main)/dashboard.tsx` | CSS opacity applied to content wrapper |
| Time-based greeting | Good Morning / Good Afternoon / Good Evening with emoji | `app/(main)/dashboard.tsx` | Based on current hour |
| Store name display | Shows active branch/store name from context | `app/(main)/dashboard.tsx` | |
| Notification bell | Icon with red badge showing unread count (capped at 99+) | `app/(main)/dashboard.tsx` | Navigates to /notifications |
| Today's Orders stat card | Count of all non-cancelled orders today | `app/(main)/dashboard.tsx` | Real-time via useEarnings |
| Pending orders stat card | Count of active non-completed, non-cancelled orders | `app/(main)/dashboard.tsx` | Yellow icon |
| Completed orders stat card | Count of COMPLETED orders total | `app/(main)/dashboard.tsx` | Green icon |
| Revenue stat card | Today's completed revenue with K/L abbreviation formatting | `app/(main)/dashboard.tsx` | Purple icon |
| Estimated Payout card | Dark card showing today's earnings × 0.98 (2% platform fee) | `app/(main)/dashboard.tsx` | "Net Earnings" tag |
| Add Product quick action | Navigates to /catalog-picker | `app/(main)/dashboard.tsx` | |
| Manage Items quick action | Navigates to /inventory | `app/(main)/dashboard.tsx` | |
| All Orders quick action | Navigates to /orders | `app/(main)/dashboard.tsx` | |
| Loading skeleton | ActivityIndicator while storeLoading or !store | `app/(main)/dashboard.tsx` | Prevents offline banner flash on cold boot |

## Merchant — Inventory Management

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Inventory list | FlatList of InventoryCard components scoped to active branchId | `app/(main)/inventory.tsx` | Fetches on mount and on focus (useFocusEffect) |
| Total items badge | Header stat showing inventory.length | `app/(main)/inventory.tsx` | |
| Search bar | Text search on product name (client-side) | `app/(main)/inventory.tsx` | |
| All Items chip | Clears appliedFilters to show all active items | `app/(main)/inventory.tsx` | |
| Filters chip | Opens FilterModal | `app/(main)/inventory.tsx` | Shows dot indicator when filters active |
| Sort chip | Opens FilterModal at sort tab | `app/(main)/inventory.tsx` | |
| Out of Stock quick chip | Pickup only; toggles availability filter | `app/(main)/inventory.tsx` | Hidden for dining stores |
| Low Stock quick chip | Pickup only; toggles availability filter | `app/(main)/inventory.tsx` | Hidden for dining stores |
| Inactive quick chip (dining) | Dining only; toggles inactive availability filter | `app/(main)/inventory.tsx` | Hidden for pickup stores |
| Hero Picks quick chip | Filters to is_best_seller = true items | `app/(main)/inventory.tsx` | Available for both store types |
| Show Inactive chip | Reveals inactive items in list | `app/(main)/inventory.tsx` | Default hides inactive |
| Add Menu Item button (dining) | Opens AddMenuProductModal | `app/(main)/inventory.tsx` | Only for isDining stores |
| Add Products button (pickup) | Navigates to catalog-picker | `app/(main)/inventory.tsx` | Only for non-dining stores |
| Sort by price low→high | Client-side sort | `app/(main)/inventory.tsx` | Default sort |
| Sort by price high→low | Client-side sort | `app/(main)/inventory.tsx` | |
| Sort by name A→Z | Client-side sort via localeCompare | `app/(main)/inventory.tsx` | |
| Sort by newest | Placeholder; needs createdAt in hook | `app/(main)/inventory.tsx` | TODO noted in code |
| Category filter (pickup) | Filters by subcategory or CATEGORY_MAP name-string | `app/(main)/inventory.tsx` | Categories derived from current inventory via useMemo |
| Menu section filter (dining) | Filters by product.subcategory matching menu section | `app/(main)/inventory.tsx` | |
| Dietary tag filter (dining) | Filters by extra_data.dietaryTag | `app/(main)/inventory.tsx` | |
| Spice level filter (dining) | Filters by extra_data.spice_level | `app/(main)/inventory.tsx` | |
| Price range filter | Min/max numeric input; filters item.price | `app/(main)/inventory.tsx` | Default 0–10000 |
| Brand filter (pickup) | Filters by product.brand; cascades from selected categories | `app/(main)/inventory.tsx` | |
| Availability filter (pickup) | In Stock / Out of Stock / Low Stock (<5) | `app/(main)/inventory.tsx` | |
| Availability filter (dining) | Active / Inactive toggle-based | `app/(main)/inventory.tsx` | |
| Discounts filter (pickup) | Only shows items with price < MRP | `app/(main)/inventory.tsx` | |
| Lottie empty state | Animated illustration when inventory is empty | `app/(main)/inventory.tsx` | Loads from Lottiefiles CDN |
| Error/offline state | Cloud-offline icon with retry button | `app/(main)/inventory.tsx` | Only shown when fetch error AND inventory is empty |
| Add from global catalog | Fetches Product table (createdByStoreId.is.null OR matching branchId) | `app/(main)/catalog-picker.tsx` | Multi-select then bulk configure |
| Catalog search | Text search on product name | `app/(main)/catalog-picker.tsx` | |
| Catalog filters | FilterModal with isGlobalInventory=true; shows vertical UUID pills | `app/(main)/catalog-picker.tsx` | |
| Multi-select products | Tap to toggle selection; shows count in floating button | `app/(main)/catalog-picker.tsx` | |
| Bulk configure price/stock | ConfigureProductsModal opened after multi-select | `app/(main)/catalog-picker.tsx` | Smart variant presets by category (dairy 250ml/500ml/1L, fashion S/M/L, etc.) |
| Create custom product (pickup) | AddCustomProductModal: name, MRP, selling price, brand, SKU/EAN, stock, UOM, GST%, category, description, image | `src/components/AddCustomProductModal.tsx` | Change detection baseline; catalog suggestion if name matches global product |
| Create menu item (dining) | AddMenuProductModal: name, menu section, description, images, GST rate, selling price, discounted price, dietary tag, spice level, portion variants | `src/components/AddMenuProductModal.tsx` | |
| Portion variants (dining) | Presets: None, Half/Full, S/M/L, Regular/Jumbo, Single/Double, Custom | `src/components/AddMenuProductModal.tsx` | Custom allows arbitrary variant+price pairs |
| Dietary tag (dining) | veg / non-veg / egg / vegan with color dots | `src/components/AddMenuProductModal.tsx` | Stored in product.extra_data.dietaryTag |
| Spice level (dining) | none / mild / medium / spicy / extra-spicy | `src/components/AddMenuProductModal.tsx` | Stored in product.extra_data.spice_level |
| Edit inline price | TextInput in InventoryCard; validates price <= MRP | `src/components/InventoryCard.tsx` | onEndEditing triggers save |
| Edit inline stock | TextInput in InventoryCard | `src/components/InventoryCard.tsx` | |
| Toggle active status | Switch in InventoryCard calls onToggleStatus | `src/components/InventoryCard.tsx` | |
| Delete product | Via onDelete callback; soft-delete (is_deleted=true) | `src/components/InventoryCard.tsx` | |
| Edit product (modal) | Tap edit icon to open AddCustomProductModal or AddMenuProductModal with itemToEdit | `app/(main)/inventory.tsx` | |
| Discount % badge | Computed as ((MRP - price) / MRP) × 100; shown in InventoryCard | `src/components/InventoryCard.tsx` | Only shown when MRP > 0 |
| hasRealBranch guard | Blocks product save when StoreContext is using phantom-branch fallback | `src/components/AddCustomProductModal.tsx`, `AddMenuProductModal.tsx` | FK violation prevention |

## Merchant — Filter Modal

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Split-pane layout | Left sidebar (35%) + right content panel; 75% modal height | `src/components/FilterModal.tsx` | |
| Pickup sidebar tabs | Sort By / Price Range / Category / Brand / Availability / Discounts | `src/components/FilterModal.tsx` | |
| Dining sidebar tabs | Sort By / Menu Section / Dietary / Spice Level / Price Range / Availability | `src/components/FilterModal.tsx` | |
| Global catalog sidebar | Same as pickup but hides Availability and Discounts tabs | `src/components/FilterModal.tsx` | isGlobalInventory=true prop |
| Sort: Price Low→High | Radio option; default selection | `src/components/FilterModal.tsx` | |
| Sort: Price High→Low | Radio option | `src/components/FilterModal.tsx` | |
| Sort: Name A→Z | Radio option | `src/components/FilterModal.tsx` | |
| Sort: Newest First | Radio option | `src/components/FilterModal.tsx` | Placeholder; no createdAt sorting yet |
| Price range: Min input | Numeric TextInput for minimum price | `src/components/FilterModal.tsx` | Keyboard.dismiss on tab switch |
| Price range: Max input | Numeric TextInput for maximum price | `src/components/FilterModal.tsx` | Shows helper text with range |
| Category: per-store names | Checkboxes using name strings derived from current inventory | `src/components/FilterModal.tsx` | availableCategories prop |
| Category: global catalog verticals | UUID pill checkboxes from Vertical table | `src/components/FilterModal.tsx` | verticalPills prop; only when isGlobalInventory |
| Brand: cascaded filter | Brand list filtered by selected categories; handles InventoryItem and flat-product shapes | `src/components/FilterModal.tsx` | useMemo cascadedBrands |
| Availability (pickup): In Stock | Checkbox | `src/components/FilterModal.tsx` | stock > 0 |
| Availability (pickup): Out of Stock | Checkbox | `src/components/FilterModal.tsx` | stock === 0 |
| Availability (pickup): Low Stock | Checkbox | `src/components/FilterModal.tsx` | stock < 5 |
| Availability (dining): Active | Checkbox; filters item.active = true | `src/components/FilterModal.tsx` | |
| Availability (dining): Inactive | Checkbox; filters item.active = false | `src/components/FilterModal.tsx` | |
| Menu section: Starters | Checkbox | `src/components/FilterModal.tsx` | |
| Menu section: Main Course | Checkbox | `src/components/FilterModal.tsx` | |
| Menu section: Desserts | Checkbox | `src/components/FilterModal.tsx` | |
| Menu section: Beverages | Checkbox | `src/components/FilterModal.tsx` | |
| Menu section: Sides | Checkbox | `src/components/FilterModal.tsx` | |
| Menu section: Specials | Checkbox | `src/components/FilterModal.tsx` | |
| Dietary: Vegetarian | Green dot + checkbox | `src/components/FilterModal.tsx` | |
| Dietary: Non-Vegetarian | Red dot + checkbox | `src/components/FilterModal.tsx` | |
| Dietary: Both (shortcut) | Half-green half-red dot; selects veg + non-veg simultaneously | `src/components/FilterModal.tsx` | toggleBoth helper |
| Dietary: Egg/Eggetarian | Amber dot + checkbox | `src/components/FilterModal.tsx` | |
| Dietary: Vegan | Green dot + checkbox | `src/components/FilterModal.tsx` | |
| Spice: No Spice | Checkbox | `src/components/FilterModal.tsx` | |
| Spice: Mild | Checkbox | `src/components/FilterModal.tsx` | |
| Spice: Medium | Checkbox | `src/components/FilterModal.tsx` | |
| Spice: Spicy | Checkbox | `src/components/FilterModal.tsx` | |
| Spice: Extra Spicy | Checkbox | `src/components/FilterModal.tsx` | |
| Discount: High Discount Only | Checkbox; filters price < MRP | `src/components/FilterModal.tsx` | Pickup only tab |
| Reset all filters | Resets entire FilterState to defaults | `src/components/FilterModal.tsx` | |
| Apply button | Calls onApply with current state and closes modal | `src/components/FilterModal.tsx` | |
| Android keyboard | Handled by softwareKeyboardLayoutMode: "resize" in app.json | `src/components/FilterModal.tsx` | height: '75%' on container |

## Merchant — Orders Management

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Pending tab | Shows orders with status PENDING | `app/(main)/orders.tsx` | |
| Processing tab | Shows CONFIRMED + PREPARING orders | `app/(main)/orders.tsx` | |
| Ready tab | Shows READY orders | `app/(main)/orders.tsx` | |
| History tab | Shows COMPLETED, CANCELLED, REJECTED, RETURN_REQUESTED, RETURN_APPROVED, RETURN_REJECTED, REFUNDED | `app/(main)/orders.tsx` | |
| History sub-filters | All / Completed / Rejected / Cancelled / Refunded chips | `app/(main)/orders.tsx` | |
| Order search | Filters by displayId substring | `app/(main)/orders.tsx` | |
| Sort toggle (asc/desc) | Sorts by createdAt; default newest first | `app/(main)/orders.tsx` | parseUtc helper for UTC handling |
| Date range picker | DateTimePickerModal for custom start/end date; default 7-day rolling window | `app/(main)/orders.tsx` | isDefault flag signals live end date |
| Countdown timer (pending) | Per-order 2-minute countdown to auto-reject; turns red in last 30s | `app/(main)/orders.tsx` | Updates every 1s via setInterval |
| APPROVAL NEEDED strip | Yellow strip on PENDING cards | `app/(main)/orders.tsx` | Turns urgent red when <30s |
| PAID - START PACKING strip | Green strip on CONFIRMED/PREPARING paid orders | `app/(main)/orders.tsx` | |
| Pickup/Dine-in badge | Blue PICKUP or purple DINE-IN badge per order | `app/(main)/orders.tsx` | Based on order.orderType |
| Accept order | Moves PENDING → CONFIRMED; shows toast | `app/(main)/orders.tsx` | updateOrderStatus via useOrders |
| Reject order | Opens RejectionReasonModal; sets status to CANCELLED + reason | `app/(main)/orders.tsx` | Auto-refund triggered if order.isPaid |
| Rejection reasons | Pre-set: Out of Stock / Closing Soon / Too Many Orders / Price Mismatch / Other (free text) | `src/components/RejectionReasonModal.tsx` | |
| Mark Ready | Moves CONFIRMED/PREPARING → READY | `app/(main)/orders.tsx` | |
| OTP verification | Customer shows 4-digit PIN; merchant enters on numpad modal | `src/components/OTPVerificationModal.tsx` | Verifies via verifyOTP hook call |
| Order completion | After OTP verify: READY → COMPLETED; opens receipt modal | `app/(main)/orders.tsx` | |
| Receipt summary modal | Shows itemized receipt with subtotal, GST (per-item rate), total | `src/components/ReceiptSummaryModal.tsx` | GST fallback to 5% for dine-in items |
| Order breakup modal | Shows subtotal + tax + total breakdown | `src/components/OrderBreakupModal.tsx` | |
| Accordion expand | Tap order card to expand full item list with quantities and prices | `app/(main)/orders.tsx` | LayoutAnimation easeInEaseOut |
| Customer phone display | Shows masked or full phone in expanded card | `app/(main)/orders.tsx` | |
| Refund on cancellation | Calls refundOrder if isPaid and not an order_request | `app/(main)/orders.tsx` | Auto-triggered on rejection of paid orders |
| Real-time order updates | Supabase Realtime postgres_changes on orders table | `src/hooks/useOrders.ts` | Scoped to store_id; client-side branch filter |
| Return flow statuses | RETURN_REQUESTED → RETURN_APPROVED / RETURN_REJECTED → REFUNDED lifecycle shown in History | `app/(main)/orders.tsx` | |
| Toast notification | Animated 3-second status toast at bottom of screen | `app/(main)/orders.tsx` | Animated.sequence fade in/out |

## Merchant — Settings Hub

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Profile card | Shows user avatar initial, name, role (Admin/Staff) | `app/(main)/settings/index.tsx` | Fetches from User and Store tables |
| Edit profile button | Pencil icon navigates to /settings/profile | `app/(main)/settings/index.tsx` | |
| Current view store dropdown | Shows active merchant/branch name; tap to open store switcher | `app/(main)/settings/index.tsx` | Locked (no tap) when only one context |
| Store switcher bottom sheet | Lists all merchantContexts and branches; checkmark on active; tap to switch | `app/(main)/settings/index.tsx` | Calls switchBranch or switchContext + AsyncStorage update |
| Add New Branch shortcut | Shown in switcher for permitted users; navigates to /settings/branches | `app/(main)/settings/index.tsx` | Requires permissions.add_branch |
| Switching overlay | Full-screen ActivityIndicator spinner during context switch | `app/(main)/settings/index.tsx` | isSwitching flag from StoreContext |
| Log Out | Deregisters push token before supabase.auth.signOut | `app/(main)/settings/index.tsx` | |
| Delete Account | Opens modal with 5 reason choices; composes mailto to support@pickatstore.com; clears AsyncStorage; signs out | `app/(main)/settings/index.tsx` | Requires permissions.delete_account; email-based soft deletion |
| Permission-gated menu | Each menu item filtered via checkPermission; manager role hides staff_management, store_details, branch_management | `app/(main)/settings/index.tsx` | ROLE_PERMISSIONS.owner vs manager |
| Earnings & Reports link | Shows total revenue, today, weekly, pending count | `app/(main)/settings/earnings.tsx` | Via useEarnings |
| Returns & Refunds link | Manage return requests and approvals | `app/(main)/settings/returns.tsx` | |
| Store Timings link | Configure hours; toggling service modes | `app/(main)/settings/timings.tsx` | |
| Table Booking Slots link | Slot rule configuration (only if service_table_booking enabled) | `app/(main)/settings/slot-config.tsx` | Shows lock screen if feature disabled |
| Today's Bookings link | View and manage table reservations | `app/(main)/settings/bookings.tsx` | |
| Staff Management link | Add/remove/view staff members | `app/(main)/settings/staff.tsx` | |
| Store Details link | Edit name, address, photos, cuisine info | `app/(main)/settings/store-details.tsx` | |
| Branch Management link | Create, edit, activate branches | `app/(main)/settings/branches.tsx` | |
| Payouts & Bank Details link | Manage bank accounts, view earnings | `app/(main)/settings/payouts.tsx` | |
| Compliance & KYC link | View PAN, Aadhaar, GST info | `app/(main)/settings/compliance.tsx` | |
| Notification Sounds link | Configure alert tones and preferences | `app/(main)/settings/notifications.tsx` | |
| Help & Support link | FAQs and contact | `app/(main)/settings/support.tsx` | |
| About & Legal link | Terms, privacy, app version | `app/(main)/settings/legal.tsx` | |
| Store Timings: working days | 7-day toggle row (Mon–Sun) | `app/(main)/settings/timings.tsx` | |
| Store Timings: open time | DateTimePickerModal for opening time | `app/(main)/settings/timings.tsx` | |
| Store Timings: close time | DateTimePickerModal for closing time | `app/(main)/settings/timings.tsx` | |
| Store Timings: prep time | Numeric input for preparation buffer in minutes | `app/(main)/settings/timings.tsx` | Default 15 min; affects outside-hours calculation |
| Store Timings: lunch break toggle | Switch to enable lunch break window | `app/(main)/settings/timings.tsx` | |
| Store Timings: lunch start/end | DateTimePickerModal when hasLunchBreak | `app/(main)/settings/timings.tsx` | |
| Service mode: Pickup | Switch to enable pickup orders | `app/(main)/settings/timings.tsx` | |
| Service mode: Dine-in | Switch to enable dine-in orders | `app/(main)/settings/timings.tsx` | |
| Service mode: Table Booking | Switch to enable table booking feature | `app/(main)/settings/timings.tsx` | |
| Dirty-state detection | Save button disabled until changes detected | `app/(main)/settings/timings.tsx` | Compares current vs store state |
| Store Details: store name | Edit store name | `app/(main)/settings/store-details.tsx` | Realtime via useRealtimeTable |
| Store Details: address | Edit store address | `app/(main)/settings/store-details.tsx` | |
| Store Details: store photos | View/update store images from Supabase storage | `app/(main)/settings/store-details.tsx` | merchant-assets bucket |
| Store Details: cuisines (dining) | Edit cuisine list | `app/(main)/settings/store-details.tsx` | Dining only |
| Store Details: veg toggle (dining) | Edit is_veg flag | `app/(main)/settings/store-details.tsx` | Dining only |
| Store Details: restaurant type (dining) | Edit restaurant type | `app/(main)/settings/store-details.tsx` | Dining only |
| Staff: view list | Shows all store_staff for all merchant branches | `app/(main)/settings/staff.tsx` | Filtered to branchIds from merchant_branches |
| Staff: add manager | BottomModal form; provisionManager hook creates Supabase auth user + store_staff row | `app/(main)/settings/staff.tsx` | |
| Staff: branch assignment | Manager assigned to specific branch | `app/(main)/settings/staff.tsx` | |
| Staff: deactivate | Sets is_active=false on store_staff row | `app/(main)/settings/staff.tsx` | |
| Branches: list all branches | Realtime list of merchant_branches | `app/(main)/settings/branches.tsx` | |
| Branches: add branch | Google Places Autocomplete address, branch name, manager, phone, lat/lng | `app/(main)/settings/branches.tsx` | Dining branches get cuisines/isVeg/restaurantType fields |
| Branches: edit branch | Inline edit of all branch fields | `app/(main)/settings/branches.tsx` | |
| Branches: toggle active | is_active switch per branch | `app/(main)/settings/branches.tsx` | |
| Branches: upload photos (dining) | Branch photo upload for dining branches | `app/(main)/settings/branches.tsx` | |
| Payouts: bank accounts list | Shows primary account from signup columns + JSON array of additional accounts | `app/(main)/settings/payouts.tsx` | Masked to last 4 digits |
| Payouts: add bank account | BottomModal: bank name, account number (9–18 digits), IFSC, beneficiary name | `app/(main)/settings/payouts.tsx` | Regex-validated fields |
| Payouts: today's earnings summary | Shows stats.today via useEarnings | `app/(main)/settings/payouts.tsx` | |
| Notification settings: new order alert | Toggle for new order push notification | `app/(main)/settings/notifications.tsx` | Stored in User.notification_preferences |
| Notification settings: order cancelled alert | Toggle for cancellation notification | `app/(main)/settings/notifications.tsx` | |
| Notification settings: sound toggle | Enable/disable sound for alerts | `app/(main)/settings/notifications.tsx` | |
| Notification settings: vibration toggle | Enable/disable vibration; triggers haptic on enable | `app/(main)/settings/notifications.tsx` | |
| Notification settings: sound picker | Choose from Amber Alert / Service Bell / Loud Alarm / Emergency Siren | `app/(main)/settings/notifications.tsx` | Plays preview on selection; BottomModal |

## Merchant — Table Booking (Dining)

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Slot rule: select days | Toggle Mon–Sun day chips per rule | `app/(main)/settings/slot-config.tsx` | Days cannot overlap between rules |
| Slot rule: tables per slot | +/- stepper; 1–20 range | `app/(main)/settings/slot-config.tsx` | |
| Slot rule: slot gap | 30 / 45 / 60 minute options | `app/(main)/settings/slot-config.tsx` | |
| Multiple slot rules | Add separate rules for different day patterns (e.g. weekday vs weekend) | `app/(main)/settings/slot-config.tsx` | Min 1 rule enforced |
| Slot preview | Generates preview list of available slot times from operating hours, skipping lunch break | `app/(main)/settings/slot-config.tsx` | Reads store.operating_hours |
| Save slot config | PATCH store with slot_config array via updateStoreDetails | `app/(main)/settings/slot-config.tsx` | Locks screen if service_table_booking=false |
| Bookings: date selector | Date navigation buttons to view any day's bookings | `app/(main)/settings/bookings.tsx` | Defaults to today |
| Bookings: summary counts | total / confirmed / completed / cancelled / noShow stats bar | `app/(main)/settings/bookings.tsx` | API response summary object |
| Bookings: status colors | CONFIRMED=blue / COMPLETED=green / CANCELLED=red / NO_SHOW=amber | `app/(main)/settings/bookings.tsx` | |
| Bookings: mark arrived | Shows inline OTP input field (4 digits) to verify customer arrival | `app/(main)/settings/bookings.tsx` | Calls PATCH /bookings/:id/status with otp + COMPLETED |
| Bookings: mark no-show | Alert confirm then PATCH to NO_SHOW | `app/(main)/settings/bookings.tsx` | |
| Bookings: cancel booking | Alert warns about refund; PATCH to CANCELLED | `app/(main)/settings/bookings.tsx` | Auto-refunds booking fee to customer |
| Bookings: realtime updates | Supabase Realtime channel on table_bookings filtered by branch_id | `app/(main)/settings/bookings.tsx` | Refetches on any change event |
| Bookings: guest count | Shows guestsCount per booking | `app/(main)/settings/bookings.tsx` | |
| Bookings: booking fee | Shows bookingFee paid by customer | `app/(main)/settings/bookings.tsx` | |
| Bookings: customer info | customerName and customerPhone displayed | `app/(main)/settings/bookings.tsx` | |

## Merchant — Notifications

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Push token registration | Expo Notifications getExpoPushTokenAsync; registers Android channel "orders" with MAX importance | `src/hooks/usePushNotifications.ts` | Physical device only; skips on simulator |
| Android order notification channel | orders channel: MAX importance, vibration [0,250,250,250], default sound | `src/hooks/usePushNotifications.ts` | Android 8+ required |
| Token persistence | Stores token in AsyncStorage; deduplicates registration | `src/hooks/usePushNotifications.ts` | registrationAttempted ref prevents re-runs |
| Token server registration | POST push_token to API with user/store context | `src/hooks/usePushNotifications.ts` | |
| Token deregistration | deregisterPushToken called on logout and account delete | `app/(main)/settings/index.tsx` | Prevents orphan tokens |
| Foreground notification handler | shouldShowBanner, shouldPlaySound, shouldSetBadge all true | `src/hooks/usePushNotifications.ts` | |
| Notifications feed screen | Scrollable list of notifications with type icons | `app/(main)/notifications.tsx` | |
| Mark single read | markAsRead(id) on tap | `app/(main)/notifications.tsx` | |
| Mark all read | markAllAsRead button shown when any unread exists | `app/(main)/notifications.tsx` | |
| Unread count badge | Red circle on bell icon (dashboard header) | `app/(main)/dashboard.tsx` | From NotificationContext.unreadCount |
| Notification types | order (receipt icon) / stock (warning icon) / payout (wallet icon) / default (bell) | `app/(main)/notifications.tsx` | |
| Deep link routing | Notification link field; navigates to in-app route; guards wrong-branch notifications | `app/(main)/notifications.tsx` | Wrong branch shows Alert |
| NotificationCenter component | BottomModal with FlatList; pull-to-refresh; mark-on-tap | `src/components/NotificationCenter.tsx` | Uses NotificationContext |
| NotificationToast component | In-app toast for foreground notification display | `src/components/NotificationToast.tsx` | |
| Relative time format | "X min ago / X hours ago / X days ago" | `app/(main)/notifications.tsx` | parseUtc helper used |

## Merchant — Earnings & Payouts

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Today's revenue | Sum of COMPLETED order total_amount where created_at >= today midnight | `src/hooks/useEarnings.ts` | Branch-scoped |
| Today's order count | Count of all non-cancelled orders today | `src/hooks/useEarnings.ts` | |
| Weekly revenue | Sum of COMPLETED orders in last 7 days | `src/hooks/useEarnings.ts` | |
| Total revenue (all time) | Sum of all COMPLETED orders for branch | `src/hooks/useEarnings.ts` | |
| Completed order count | Count of all COMPLETED orders | `src/hooks/useEarnings.ts` | |
| Pending order count | Count of active non-completed non-cancelled orders | `src/hooks/useEarnings.ts` | |
| Estimated payout | today × 0.98 (2% platform fee simulation) | `src/hooks/useEarnings.ts` | Shown on dashboard payout card |
| Real-time earnings updates | Supabase Realtime on orders table; client-side branch filter on payload | `src/hooks/useEarnings.ts` | Channel keyed by merchantId-activeStoreId |
| Earnings screen: total revenue card | Large display of total all-time COMPLETED revenue + order count | `app/(main)/settings/earnings.tsx` | |
| Earnings screen: today stat | Today's revenue box | `app/(main)/settings/earnings.tsx` | |
| Earnings screen: weekly stat | This week's revenue box | `app/(main)/settings/earnings.tsx` | |
| Earnings screen: pending card | Shows pendingCount with link to orders screen | `app/(main)/settings/earnings.tsx` | |
| Payouts: primary bank account | Legacy signup columns: bank_account_number, ifsc_code, owner_name, bank_name, bank_beneficiary_name | `app/(main)/settings/payouts.tsx` | |
| Payouts: JSON bank accounts array | bank_accounts JSONB array for additional accounts | `app/(main)/settings/payouts.tsx` | Deduplicates against signup primary |
| Payouts: add new bank | BottomModal with validated bank name, account, IFSC, beneficiary fields | `app/(main)/settings/payouts.tsx` | NAME_REGEX, IFSC_REGEX, ACCOUNT_REGEX |

## Merchant — Branch & Store Context Switching

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| active_context AsyncStorage | Persists current merchant context (merchantId, role, branches array) | `app/(auth)/login.tsx`, `src/context/StoreContext.tsx` | Read on cold boot |
| active_branch_id AsyncStorage | Persists the specific branch within the active context | `app/(auth)/login.tsx`, `src/context/StoreContext.tsx` | Used to restore branch on restart |
| Login branch selection | Bottom sheet modal listing all contexts and branches on login | `app/(auth)/login.tsx` | Groups by merchant; shows role label |
| StoreContext.switchBranch | Updates activeStoreId in memory; triggers fetchStore | `src/context/StoreContext.tsx` | Same-merchant switch |
| StoreContext.switchContext | Updates activeContext + AsyncStorage + triggers full fetchStore | `src/context/StoreContext.tsx` | Cross-merchant switch |
| Settings store switcher | Bottom sheet within settings; same UI as login modal | `app/(main)/settings/index.tsx` | Shows checkmark on active branch |
| isSwitching overlay | Full-screen spinner blocks UI during context switch | `app/(main)/settings/index.tsx` | |
| Branch-scoped inventory | useInventory fetches StoreProduct by branchId | `src/hooks/useInventory.ts` | |
| Branch-scoped orders | useOrders scopes by store_id + branch_id | `src/hooks/useOrders.ts` | Main store accepts null or matching branch_id |
| Branch-scoped earnings | useEarnings applies same null/match branch logic | `src/hooks/useEarnings.ts` | |
| hasRealBranch flag | True only when merchant_branches has at least one real row | `src/context/StoreContext.tsx` | Prevents FK violation on product save |
| branchDataMap | Per-branch operating_hours, prep_time, service modes keyed by branchId | `src/context/StoreContext.tsx` | Reactive store derivation via useMemo |
| Multi-merchant manager | User can be manager on branches of different merchant IDs; contextMap aggregates all | `app/(auth)/login.tsx` | |

## Merchant — Contexts & Hooks

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| StoreContext | Provides store, merchantId, branches, activeStoreId, availableContexts, permissions, isSwitching, switchBranch, switchContext, toggleStoreStatus, refreshStore, updateStoreDetails, hasRealBranch | `src/context/StoreContext.tsx` | Uses AppState listener for heartbeat |
| UserContext | Provides user (id, email, phone, name, role, notification_preferences), session, loading, refreshUser | `src/context/UserContext.tsx` | Real-time subscription on User table for notification_preferences updates |
| NotificationContext | Wraps useNotifications; provides notifications, unreadCount, markAsRead, markAllAsRead, refetch | `src/context/NotificationContext.tsx` | Requires UserContext |
| useStore | Re-exports StoreContext values; also exposes branchId, activeRole, merchantId | `src/hooks/useStore.ts` | Alias hook used widely across screens |
| useEarnings | Fetches and subscribes to order stats; returns today/weekly/total revenue + counts + estimatedPayout | `src/hooks/useEarnings.ts` | Real-time via Supabase channel |
| useOrders | Fetches orders for date range; provides updateOrderStatus, verifyOTP, refundOrder; real-time subscription | `src/hooks/useOrders.ts` | fetchIdRef prevents stale responses |
| useInventory | Fetches StoreProduct with product join for active branchId; provides updateItem, deleteItem, toggleStatus | `src/hooks/useInventory.ts` | 50-item limit; ordered by updatedAt |
| useNotifications | Fetches store_notifications for user/store; marks read; subscribes to real-time | `src/hooks/useNotifications.ts` | |
| usePushNotifications | Registers Expo push token; returns expoPushToken, permissionStatus | `src/hooks/usePushNotifications.ts` | |
| useRealtimeTable | Generic hook: fetches and subscribes any Supabase table; returns data, loading, error, setData | `src/hooks/useRealtimeTable.ts` | Used by payouts, store-details, staff, branches |
| useStaff / useCreateManager | Provisions new manager: creates auth user + store_staff row | `src/hooks/useStaff.ts`, `src/services/staff.ts` | |
| useCatalog | Fetches global Product catalog | `src/hooks/useCatalog.ts` | |

## Merchant — Components & Modals

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| InventoryCard | Displays product image, name, category, brand, MRP vs selling price, discount %, stock level, active switch, edit/delete actions | `src/components/InventoryCard.tsx` | Resolves Supabase storage image paths |
| FilterModal | Two-pane filter/sort sheet; pickup vs dining sidebar sets; Apply/Reset footer | `src/components/FilterModal.tsx` | @lock file; Pass 3 approved May 19, 2026 |
| AddCustomProductModal | Full-screen bottom sheet for creating/editing non-dining products; all product fields | `src/components/AddCustomProductModal.tsx` | @lock file; catalog suggestion auto-fill |
| AddMenuProductModal | Full-screen bottom sheet for dining menu items; sections, dietary, spice, variants | `src/components/AddMenuProductModal.tsx` | Fetches existing variants on edit |
| ConfigureProductsModal | Bulk price/stock configuration for multi-selected catalog products; smart variant presets by category | `src/components/ConfigureProductsModal.tsx` | Loads existing StoreProduct data to pre-fill |
| OTPVerificationModal | 4-digit PIN numpad with CLR/backspace; verifies pickup OTP to complete order | `src/components/OTPVerificationModal.tsx` | Error state on wrong PIN |
| OrderBreakupModal | Bottom sheet showing order subtotal + GST + total | `src/components/OrderBreakupModal.tsx` | Per-item GST rate; 5% fallback |
| ReceiptSummaryModal | Full receipt display after order completion with all line items | `src/components/ReceiptSummaryModal.tsx` | Shown after OTP verify success |
| RejectionReasonModal | Bottom sheet with 5 preset reasons + "Other" free text input to reject an order | `src/components/RejectionReasonModal.tsx` | |
| NotificationCenter | BottomModal wrapping FlatList of notifications; pull-to-refresh; mark-on-tap; mark-all button | `src/components/NotificationCenter.tsx` | Type icons: ORDER=food, INVENTORY=alert-circle, SYSTEM=information |
| NotificationToast | In-app foreground push notification toast | `src/components/NotificationToast.tsx` | |
| BottomModal | Generic reusable bottom sheet modal wrapper | `src/components/BottomModal.tsx` | Used by payouts, staff, notifications, branches |

---

# ADMIN DASHBOARD (admin-web)

## Admin — Authentication & Access

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Email/password login | Authenticates admin via Supabase `signInWithPassword` | `src/components/Login.tsx` | Only SUPER_ADMIN role allowed; other roles are signed out immediately |
| SUPER_ADMIN role gate | After login fetches `User` table row; blocks access if `role !== 'SUPER_ADMIN'` | `src/context/AuthContext.tsx` | 8-second timeout on profile fetch; signs out if profile missing |
| Forgot password | Sends Supabase password reset email via `resetPasswordForEmail` | `src/components/Login.tsx` | Redirect URL is `{origin}/reset-password` |
| Force password change | Intercepts first-login admins who have `mustChangePassword: true` in user_metadata | `src/components/ForcePasswordChange.tsx` | Clears flag by calling `supabase.auth.updateUser` with `mustChangePassword: false` |
| Session restore on reload | `supabase.auth.getSession()` with 5-second fallback timeout; preserves session across page refreshes | `src/context/AuthContext.tsx` | If `getSession` hangs, forces `setLoading(false)` to prevent infinite spinner |
| Auth state change listener | Subscribes to `onAuthStateChange`; ignores `INITIAL_SESSION`/`SIGNED_IN` to prevent deadlock with `initAuth` | `src/context/AuthContext.tsx` | `SIGNED_IN` events ignored to avoid race condition |
| Profile network error screen | If profile fetch fails with connection error, shows retry screen without logging out | `src/App.tsx` | Distinguishes timeout from generic connection errors in the message |
| Logout | `supabase.auth.signOut()`, clears user/session state | `src/context/AuthContext.tsx` | Accessible from header dropdown |
| Create admin (from dashboard) | `supabase.auth.signUp` then inserts SUPER_ADMIN row into `User` table; sets `mustChangePassword: true` metadata | `src/context/AuthContext.tsx` + `src/components/modules/settings/AddAdminDialog.tsx` | Checks for existing email before creating |
| Loading spinner guard | Shows full-screen spinner while session is being restored | `src/App.tsx` | Prevents flash of login screen |

## Admin — Module: Merchants

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Merchant Network hub | Tab container with Directory and KYC Queue tabs | `src/components/modules/merchants/MerchantNetwork.tsx` | Route: `/merchants` |
| Merchant directory table | Lists all merchants: Store Name, Branch Name, Owner Name, Phone, City, Status toggle, Edit button | `src/components/modules/merchants/MerchantDirectory.tsx` | KYC-pending rows are highlighted orange; rejected rows are highlighted red |
| Search merchants | Full-text filter on store name, owner name, and phone number | `src/components/modules/merchants/MerchantDirectory.tsx` | Client-side filtering on already-fetched data |
| Filter by status | Dropdown checkbox filter: active / inactive | `src/components/modules/merchants/MerchantDirectory.tsx` | Multi-select; badge count shown on button |
| Filter by KYC state | Dropdown checkbox filter: approved / pending / rejected | `src/components/modules/merchants/MerchantDirectory.tsx` | Multi-select |
| Filter by city | Dynamically populated from fetched merchant city values | `src/components/modules/merchants/MerchantDirectory.tsx` | Scrollable list inside dropdown; multi-select |
| Filter low rating | Checkbox filter for merchants with rating < 3.5 | `src/components/modules/merchants/MerchantDirectory.tsx` | Single boolean toggle |
| Sort by column | Sortable columns: City, Orders 30d, Revenue 30d, Rating; toggle asc/desc | `src/components/modules/merchants/MerchantDirectory.tsx` | Clicking same column reverses direction |
| Activate/deactivate single merchant | Toggle switch in Status column; calls `updateMerchant` | `src/components/modules/merchants/MerchantDirectory.tsx` | Switch disabled when KYC pending |
| Edit merchant | Opens `EditMerchantDialog` to update merchant details | `src/components/modules/merchants/MerchantDirectory.tsx` + `EditMerchantDialog.tsx` | Edit button disabled when KYC pending |
| View merchant details | Click row opens `MerchantDetailsSheet` with Overview, Recent Orders, Product Inventory tabs | `src/components/modules/merchants/MerchantDetailsSheet.tsx` | Fetches stats via `get_merchant_stats` RPC |
| Merchant compliance panel | Shows PAN, Aadhaar, GSTIN, bank account (masked), turnover range, MSME, FSSAI, document links | `src/components/modules/merchants/MerchantDetailsSheet.tsx` | Document links open in new tab |
| Store photos gallery | Inline thumbnail strip for store photos with external link | `src/components/modules/merchants/MerchantDetailsSheet.tsx` | Only shown when `store_photos.length > 0` |
| Merchant performance stats | Orders (30d), avg order value, GMV (30d) cards | `src/components/modules/merchants/MerchantDetailsSheet.tsx` | Data from `getMerchantStats` via `get_merchant_stats` Supabase RPC |
| Per-merchant order history | Orders table: Order ID, customer, date, amount, status badge | `src/components/modules/merchants/MerchantDetailsSheet.tsx` | Fetched via direct Supabase query on `orders` table filtered by `store_id` |
| Per-merchant product inventory | Embedded `StoreProductTable` inside merchant sheet | `src/components/modules/merchants/MerchantDetailsSheet.tsx` | See Store Products section |
| Add merchant | Multi-step sheet: Store Info, Branches, KYC & Docs; uploads files to `merchant-docs` Supabase bucket | `src/components/modules/merchants/AddMerchantSheet.tsx` | Auto-detects browser geolocation on open; uses `LocationPicker` component |
| KYC queue list | Left column shows pending applications sorted by submission date | `src/components/modules/merchants/KYCQueue.tsx` | Auto-selects first pending item on load |
| KYC document viewer | Center panel renders PAN, Aadhaar front/back, GST cert, MSME cert, FSSAI cert, store photos | `src/components/modules/merchants/KYCQueue.tsx` | Tabs across document types; zoom controls 50%–200% |
| KYC checklist | 4-item checklist: Name Match, Valid Docs, Clear Photo, Address Match; all must be checked to approve | `src/components/modules/merchants/KYCQueue.tsx` | Approve button disabled until all 4 checked |
| KYC approve | Calls `POST /merchants/:id/kyc-decision` with `{decision: 'approve'}`; triggers server-side email | `src/components/modules/merchants/KYCQueue.tsx` + `src/hooks/useMerchants.ts` | Approval clears merchant from KYC queue |
| KYC reject | Calls same endpoint with `{decision: 'reject', rejectionReason}`; rejection reason required | `src/components/modules/merchants/KYCQueue.tsx` | Reject button disabled without reason text |
| Delete KYC application | Permanently deletes merchant via `delete_merchants_cascaded` RPC | `src/components/modules/merchants/KYCQueue.tsx` | Confirm dialog before deletion |
| Bulk select merchants | Checkbox per row + select-all header checkbox | `src/components/modules/merchants/MerchantDirectory.tsx` | Floating action bar appears when any selected |
| Bulk export | `POST /merchants/export-selected` returns `.xlsx` file | `src/components/modules/merchants/MerchantDirectory.tsx` | Also available from ExportMerchantsDialog for full export |
| Bulk delete | `delete_merchants_cascaded` RPC for multiple IDs | `src/components/modules/merchants/MerchantDirectory.tsx` | Confirm dialog; cascaded delete |
| Bulk activate/deactivate | Supabase `.update({ status }).in('id', selectedIds)` | `src/components/modules/merchants/MerchantDirectory.tsx` | No per-record confirmation |
| Export dialog | Configure export format, date range, fields selection | `src/components/modules/merchants/ExportMerchantsDialog.tsx` | Options: CSV, Excel, PDF |
| Merchant report dialog | Generate per-merchant report | `src/components/modules/merchants/MerchantReportDialog.tsx` | Shown via report icon in directory |
| Merchant inventory modal | Full modal view of merchant's store inventory | `src/components/modules/merchants/MerchantInventoryModal.tsx` | Separate from the inline sheet inventory tab |
| Add merchant branch | Add branches to a merchant record | `src/components/modules/merchants/AddMerchantSheet.tsx` (Step 2) | Branch has: name, location |
| KYC form | Step 3 in add-merchant: PAN, Aadhaar, bank, IFSC, turnover, document file uploads | `src/components/modules/merchants/onboarding/KYCForm.tsx` | |
| Onboarding stepper | Visual step progress indicator for add-merchant sheet | `src/components/modules/merchants/onboarding/OnboardingStepper.tsx` | 3 steps: Store Info, Branches, KYC & Docs |

## Admin — Module: Orders

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Global order manager | Fetches all orders from Supabase, realtime subscription via `postgres_changes` channel | `src/components/modules/orders/OrderManager.tsx` | Route: `/orders` |
| Order table columns | Order ID (truncated 8 chars), Time Placed (relative), Customer name/phone, Store Name, Status pill, Amount, SLA Timer | `src/components/modules/orders/OrderManager.tsx` | SLA timer shows "Overdue" in red when >15 min and status is processing |
| Filter by status | Tab buttons: All, Active (processing), Disputed, Cancelled | `src/components/modules/orders/OrderManager.tsx` | Client-side filter on fetched data |
| Order status pills | Colored badges: completed (green), processing (blue with spin icon), cancelled (red), disputed (orange) | `src/components/modules/orders/OrderManager.tsx` | Icon per status from lucide |
| View order details | Click row opens side sheet with Customer Info, Order Timeline, Delivery Status, action buttons | `src/components/modules/orders/OrderManager.tsx` | Disputed orders redirect to DisputeConsole instead |
| Force complete order | Sets order status to `completed` via `updateOrderStatus` | `src/components/modules/orders/OrderManager.tsx` | No confirmation dialog |
| Refund & cancel order | Sets order status to `cancelled` via `updateOrderStatus` | `src/components/modules/orders/OrderManager.tsx` | Button labeled "Refund & Cancel" but only updates status |
| Force cancel (context menu) | Three-dot dropdown per row with "Force Cancel" option | `src/components/modules/orders/OrderManager.tsx` | No actual implementation wired |
| Customer quicklink | Click customer name in order row opens `CustomerDetailsSheet` | `src/components/modules/orders/OrderManager.tsx` | Constructs partial customer object from order data |
| Store quicklink | Click store name in order row opens `MerchantDetailsSheet` | `src/components/modules/orders/OrderManager.tsx` | Constructs partial merchant object; loads full data on sheet open |
| Export CSV button | UI button present | `src/components/modules/orders/OrderManager.tsx` | Not yet wired to an export endpoint |
| Filter Date button | UI button present | `src/components/modules/orders/OrderManager.tsx` | Not yet wired |
| Realtime new order toast | `INSERT` event on `orders` table triggers `toast.info` "New Order Received!" | `src/hooks/useOrders.ts` | Supabase channel `public:orders` |
| Dispute Console | Full-screen split view showing user evidence (image + statement) and system data; resolve/flag/dismiss actions | `src/components/modules/orders/DisputeConsole.tsx` | Opened when clicking a disputed order |

## Admin — Module: Customers

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Customer list table | Columns: Customer Name (avatar + ID), Contact (phone), Location (city), Total LTV, Last Activity, Status badge | `src/components/modules/customers/CustomerDatabase.tsx` | Route: `/customers` |
| Search customers | Filter by name, phone, or ID | `src/components/modules/customers/CustomerDatabase.tsx` | Client-side filter |
| Filter by account status | Dropdown: active / blocked | `src/components/modules/customers/CustomerDatabase.tsx` | Multi-select |
| Filter by city | Dynamically populated from customer data | `src/components/modules/customers/CustomerDatabase.tsx` | Multi-select |
| View customer details | Click row opens `CustomerDetailsSheet` with Overview and Order History tabs | `src/components/modules/customers/CustomerDetailsSheet.tsx` | |
| Customer overview | Contact info (phone, placeholder email), location (city), shopping insights: total orders, avg order value, years active | `src/components/modules/customers/CustomerDetailsSheet.tsx` | LTV computed live from fetched orders |
| Customer order history | List of orders: store name, date, order ID (truncated), amount, status badge | `src/components/modules/customers/CustomerDetailsSheet.tsx` | Fetched via direct Supabase query on `orders` filtered by `user_id` |
| Block customer | UI calls `blockCustomer` which shows toast "needs backend implementation" | `src/hooks/useCustomers.ts` | Not yet implemented |
| Wallet credit grant | Shows success toast for ₹50 goodwill credit; not yet wired to backend | `src/components/modules/customers/CustomerDatabase.tsx` | Triggered from row action |
| Refresh customer list | Refetches from Supabase `User` table with role=CONSUMER + joined orders | `src/components/modules/customers/CustomerDatabase.tsx` | Button in toolbar |
| LTV calculation | Sum of all order amounts for the customer | `src/hooks/useCustomers.ts` | Computed client-side from joined orders array |

## Admin — Module: Catalog

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Catalog view toggle | Tabs: Global Catalog, Custom (store-created), Sync Queue | `src/components/modules/catalog/MasterCatalog.tsx` | Route: `/catalog` |
| Paginated product list | Server-side pagination (50 per page) via `GET /products` with cursor | `src/components/modules/catalog/MasterCatalog.tsx` | Pagination state tracked separately from filters |
| Product table columns | Product image, Name, Category, EAN/Barcode, Brand, MRP, GST Rate, HSN Code, Unit/UOM, Vertical | `src/components/modules/catalog/MasterCatalog.tsx` | Inline editable cells with optimistic update |
| Search products | `GET /products?search=` server-side search | `src/components/modules/catalog/MasterCatalog.tsx` | Resets to page 1 on query change |
| Filter by category | Multi-select server-side filter | `src/components/modules/catalog/MasterCatalog.tsx` | Uses `CATEGORIES` constant (11 verticals + 8 product categories) |
| Filter by GST rate | Multi-select (0%, 5%, 12%, 18%, 28%) | `src/components/modules/catalog/MasterCatalog.tsx` | Server-side |
| Filter by price range | Slider-based min/max price filter | `src/components/modules/catalog/MasterCatalog.tsx` | Range 0–10000; passed as `minPrice`/`maxPrice` params |
| Filter missing data | Filter products missing images, HSN, or other fields | `src/components/modules/catalog/MasterCatalog.tsx` | Server-side `missingData` param |
| Edit product | Opens edit modal with fields: Name, Category, Vertical, MRP, Brand, EAN | `src/components/modules/catalog/MasterCatalog.tsx` | `PATCH /products/:id` on save |
| Inline field update | Direct cell editing for individual fields with optimistic update + rollback on error | `src/components/modules/catalog/MasterCatalog.tsx` | `PATCH /products/:id` per change |
| Image gallery management | Per-product image gallery: upload new images, set primary, remove images | `src/components/modules/catalog/MasterCatalog.tsx` | `POST /products/upload-image` then `POST /products/:id/images`; first image auto-primary |
| Delete product | `DELETE /products/:id` | `src/components/modules/catalog/MasterCatalog.tsx` | No confirmation dialog |
| Bulk delete | `POST /products/bulk-delete` with selected IDs | `src/components/modules/catalog/MasterCatalog.tsx` | Confirm dialog |
| Bulk update category | `POST /products/bulk-update` with `{category}` | `src/components/modules/catalog/MasterCatalog.tsx` | Floating action bar |
| Bulk update GST rate | `POST /products/bulk-update` with `{gstRate}` | `src/components/modules/catalog/MasterCatalog.tsx` | Floating action bar |
| Bulk export selected | `POST /products/export-selected` returns `.xlsx` | `src/components/modules/catalog/MasterCatalog.tsx` | Floating action bar |
| Bulk CSV/Excel import | `POST /products/bulk` multipart/form-data; returns import report with skipped items | `src/components/modules/catalog/MasterCatalog.tsx` | File input hidden; triggered by toolbar button |
| Download template | Opens `GET /products/template` in new tab | `src/components/modules/catalog/MasterCatalog.tsx` | For bulk import format |
| Sync Queue tab | Shows products scraped from merchant apps pending admin approval | `src/components/modules/catalog/MasterCatalog.tsx` | Polled every 10s when on tab |
| Live Import (sync) | Triggers a scrape run via `LiveImportModal`; stores `activeSyncRunId` in localStorage; polls `GET /catalog/sync/status/:runId` every 5s | `src/components/modules/catalog/MasterCatalog.tsx` + `LiveImportModal.tsx` | Survives page refresh via localStorage |
| Approve sync items | `POST /catalog/sync/approve` with edited items; moves to global catalog | `src/components/modules/catalog/MasterCatalog.tsx` | Inline editing of sync items before approve |
| Reject sync items | `POST /catalog/sync/reject` permanently deletes from queue | `src/components/modules/catalog/MasterCatalog.tsx` | Confirm dialog |
| Product fields | Name, Category, Vertical, MRP, EAN/Barcode, Brand, UnitType, UnitValue, UOM, HSN Code, GST Rate, images | `src/components/modules/catalog/MasterCatalog.tsx` | Defined in `Product` interface |
| Vertical taxonomy | 11 verticals: Grocery & Kirana, Fruits & Vegetables, Restaurants & Cafes, Bakeries & Desserts, Meat & Seafood, Pharmacy & Wellness, Electronics & Accessories, Fashion & Apparel, Home & Lifestyle, Beauty & Personal Care, Pet Care & Supplies | `src/components/modules/catalog/MasterCatalog.tsx` | Hardcoded `VERTICALS` constant |

## Admin — Module: Store Products

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Store product table | Shows per-store inventory from `StoreProduct` table: Product (image + name + category + MRP), Stock, Price, Status toggle, Best Seller toggle | `src/components/modules/merchants/StoreProductTable.tsx` | Rendered inside `MerchantDetailsSheet` Product Inventory tab |
| Search store products | Client-side filter by product name or category | `src/components/modules/merchants/StoreProductTable.tsx` | Filters `filteredProducts` array |
| Edit stock inline | Number input for stock quantity with optimistic update | `src/components/modules/merchants/StoreProductTable.tsx` | Shows "Low Stock" warning badge when 1–9 units |
| Edit selling price inline | Number input; calculates and displays discount % vs MRP | `src/components/modules/merchants/StoreProductTable.tsx` | Optimistic update via Supabase `.update` on `StoreProduct` |
| Toggle product active | Switch to activate/deactivate product listing for the store | `src/components/modules/merchants/StoreProductTable.tsx` | Optimistic update |
| Toggle best seller | Star button to mark/unmark product as best seller | `src/components/modules/merchants/StoreProductTable.tsx` | Optimistic update |
| Out-of-stock indicator | Red border + red text on stock input when stock === 0 | `src/components/modules/merchants/StoreProductTable.tsx` | Visual only |
| Discount badge | Shows "N% OFF" badge when selling price < MRP | `src/components/modules/merchants/StoreProductTable.tsx` | Calculated as `((mrp - price) / mrp) * 100` |

## Admin — Module: Verticals

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Vertical taxonomy definition | 11 hardcoded verticals used across catalog, coupon, and notification targeting | `src/components/modules/catalog/MasterCatalog.tsx` | No dedicated vertical management screen; managed inline in catalog |
| Category assignment | Products assigned to category during add/edit from CATEGORIES list (verticals + product categories) | `src/components/modules/catalog/MasterCatalog.tsx` | Combined array of verticals and product categories |
| Vertical filter in catalog | Filter catalog products by vertical assignment | `src/components/modules/catalog/MasterCatalog.tsx` | Passed as `category` param to server |

## Admin — Module: Cities

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| City list | Fetches cities from `GET /cities` API; shows city cards with name, active badge, store count | `src/components/modules/geography/CityManager.tsx` | Route: `/geography` |
| Add city button | Button present in toolbar | `src/components/modules/geography/CityManager.tsx` | Not yet wired to a form/dialog |
| Search cities | Input to filter city list | `src/components/modules/geography/CityManager.tsx` | UI only; no filter logic wired |
| City selection | Click card to select city and see settings panel on map | `src/components/modules/geography/CityManager.tsx` | First city auto-selected on load |
| City active/inactive badge | Badge showing active status from `city.active` | `src/components/modules/geography/CityManager.tsx` | |
| Store count display | Shows number of stores in each city | `src/components/modules/geography/CityManager.tsx` | From `city.stores` field |
| Map view | Static map image as background with polygon SVG overlay simulating service zone | `src/components/modules/geography/CityManager.tsx` | Placeholder; not a real interactive map |
| Zone drawing toolbar | Pan tool and polygon draw tool buttons | `src/components/modules/geography/CityManager.tsx` | Visual only; no real drawing logic |
| Upload pincodes | Button to upload CSV of pincodes; triggers info toast | `src/components/modules/geography/CityManager.tsx` | Not yet implemented |
| City settings panel | Per-city panel: Discovery Radius toggle, Base Commission Rate input (%), Save button | `src/components/modules/geography/CityManager.tsx` | Commission defaults to 10%; not persisted yet |

## Admin — Module: Coupons

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Coupon list view | Lists all coupons from `coupons` Supabase table; ordered by `created_at` desc | `src/components/modules/marketing/CouponBuilder.tsx` | Dimmed/60% opacity when inactive |
| Coupon card fields displayed | Code, discount type + value + max cap, funding source badge, target audience badge, app-wide badge, usage count | `src/components/modules/marketing/CouponBuilder.tsx` | |
| Create coupon | Multi-field form with live mobile preview | `src/components/modules/marketing/CouponBuilder.tsx` | Route: `/marketing` |
| Promo code field | Max 10 alphanumeric chars; auto-uppercased | `src/components/modules/marketing/CouponBuilder.tsx` | Unique constraint enforced; 23505 error handled |
| Discount type | PERCENTAGE or FLAT (rupee amount) | `src/components/modules/marketing/CouponBuilder.tsx` | |
| Discount value | Numeric; percentage validated ≤ 100 | `src/components/modules/marketing/CouponBuilder.tsx` | |
| Max discount cap | Only shown when type is PERCENTAGE; caps rupee savings | `src/components/modules/marketing/CouponBuilder.tsx` | Default 100 |
| Funding source | PLATFORM (company bears cost) or MERCHANT (store bears cost) | `src/components/modules/marketing/CouponBuilder.tsx` | Labeled "Critical Finance Impact" |
| Target audience | ALL, NEW_USERS (first order only), INACTIVE_USERS (>30 days inactive) | `src/components/modules/marketing/CouponBuilder.tsx` | |
| Usage limit | Optional total redemption cap; blank = unlimited | `src/components/modules/marketing/CouponBuilder.tsx` | |
| Expiry date | Optional end date; blank = no expiry | `src/components/modules/marketing/CouponBuilder.tsx` | |
| Store ID | Null for admin-created (app-wide); can be set to a store ID | `src/lib/couponService.ts` | Admin always creates app-wide coupons |
| Usage counter | `used_count` field tracked on coupon | `src/lib/couponService.ts` | Displayed as "Used: X/Y" |
| Toggle coupon active | Power icon button toggles `is_active` | `src/components/modules/marketing/CouponBuilder.tsx` | Calls `toggleCouponStatus` service |
| Delete coupon | Trash icon with confirm dialog | `src/components/modules/marketing/CouponBuilder.tsx` | Permanent delete |
| Live mobile preview | Right panel shows iOS-style lock screen notification preview of the coupon card as form is filled | `src/components/modules/marketing/CouponBuilder.tsx` | Purely visual; updates live |

## Admin — Module: Staff

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Settings Hub | Two-tab container: Team & RBAC, App Control | `src/components/modules/settings/SettingsHub.tsx` | Route: `/settings` |
| Admin user list | Fetches SUPER_ADMIN users from `User` table; shows name, email, role badge, created date | `src/components/modules/settings/TeamManagement.tsx` | Only SUPER_ADMIN role exists in the system |
| Add admin | Dialog: email, password (temp), name; creates Supabase auth user + User row with SUPER_ADMIN role; sets `mustChangePassword: true` | `src/components/modules/settings/AddAdminDialog.tsx` | Duplicate email check before creation |
| Edit admin | Dialog to update admin name/email | `src/components/modules/settings/EditAdminDialog.tsx` | |
| Delete admin | Confirmation dialog before deletion | `src/components/modules/settings/DeleteAdminDialog.tsx` | |
| Role badge display | "Super Admin" yellow badge per row | `src/components/modules/settings/TeamManagement.tsx` | No other roles assignable from UI |

## Admin — Module: Notifications

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Engagement Hub | Container with Push Campaigns and Sponsored Ads tabs | `src/components/modules/engagement/EngagementHub.tsx` | Route: `/engagement` |
| Push campaign builder | Left panel form for composing push notifications | `src/components/modules/engagement/NotificationManager.tsx` | |
| Notification title field | Input for push notification title | `src/components/modules/engagement/NotificationManager.tsx` | |
| Notification body field | Textarea; 120 char recommended limit shown | `src/components/modules/engagement/NotificationManager.tsx` | Character counter |
| Deep link field | Optional deep link URL for tap action | `src/components/modules/engagement/NotificationManager.tsx` | e.g. `/store/ratnadeep-banjara` |
| Target audience | Dropdown: All Users (Broadcast), Users in Hyderabad, Users in Bangalore, Inactive >30 Days, Churn Risk (AI Segment) | `src/components/modules/engagement/NotificationManager.tsx` | |
| Send immediately | Radio option; button becomes "Send Blast" | `src/components/modules/engagement/NotificationManager.tsx` | Toast fires on send; not wired to real FCM endpoint |
| Schedule for later | Radio option; button becomes "Schedule Campaign" | `src/components/modules/engagement/NotificationManager.tsx` | Scheduling UI shown but no datetime picker yet |
| iOS lock screen preview | Right panel shows live preview of how notification appears on iOS lock screen | `src/components/modules/engagement/NotificationManager.tsx` | Updates as title/body typed |
| Sponsored ads manager | Table: merchant, ad position, start/end dates, status, impressions, cost | `src/components/modules/engagement/AdManager.tsx` | |
| Create ad campaign | Dialog: merchant name, ad position, start/end dates, budget | `src/components/modules/engagement/AdManager.tsx` | |
| Toggle ad status | Pause/resume ad campaigns | `src/components/modules/engagement/AdManager.tsx` | |
| Ad positions | "Home Page Top", "Search Result #1", "Category Banner" | `src/components/modules/engagement/AdManager.tsx` | Hardcoded options |

## Admin — Module: Reports

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Analytics Hub | Container with Reports, Global Config, Audit Logs tabs | `src/components/modules/analytics/AnalyticsHub.tsx` | Route: `/analytics` |
| Platform dashboard (home) | KPI cards: Total GMV, Total Orders, Active Consumers, Total Merchants | `src/components/Dashboard.tsx` | Fetched via `get_super_admin_stats` Supabase RPC; route `/` |
| Orders chart | Bar chart of daily/period order volumes | `src/components/OrdersChart.tsx` | Used on dashboard |
| Platform charts | Dual charts: orders over time + order status breakdown | `src/components/PlatformCharts.tsx` | Uses `dailyStats` and `statusBreakdown` from RPC |
| Top stores list | Ranked list of top-performing stores by revenue | `src/components/TopStoresList.tsx` | From `topStores` in RPC response |
| KPI cards | Animated stat cards with optional sparkline graph | `src/components/KPICard.tsx` | `showGraph` and `showPulse` props |
| User retention chart | Cohort-style bar chart (mock data) | `src/components/modules/analytics/AnalyticsDashboard.tsx` | 12 bars; placeholder data |
| Demand heatmap | Radial gradient overlay on gray background simulating geographic demand | `src/components/modules/analytics/AnalyticsDashboard.tsx` | Placeholder; not a real map |
| Top performing merchants table | Merchant name, 30-day revenue, growth % | `src/components/modules/analytics/AnalyticsDashboard.tsx` | Hardcoded sample data |
| Top selling products table | Product name, units sold, revenue | `src/components/modules/analytics/AnalyticsDashboard.tsx` | Hardcoded sample data |
| Download investor deck button | Button labeled "Download Investor Deck" | `src/components/modules/analytics/AnalyticsDashboard.tsx` | Not yet wired |
| Time range selector | "Last 30 Days" button | `src/components/modules/analytics/AnalyticsDashboard.tsx` | Not yet wired to a date picker |
| Audit log table | Columns: Timestamp, User, Action Details, IP Address, Severity badge (high/medium/low) | `src/components/modules/analytics/AuditLog.tsx` | Hardcoded sample data; export and filter buttons present but not wired |
| Live activity ticker | Real-time ticker of platform activity | `src/components/ActivityTicker.tsx` | Used on dashboard |
| Live map | Real-time delivery map overlay | `src/components/LiveMap.tsx` | On dashboard |

## Admin — Module: Settings

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| App version control | Set current version and minimum force-update version for Consumer App and Merchant App | `src/components/modules/settings/VersionControl.tsx` | Separate cards for consumer and merchant apps |
| Force update toggle | Switch to enable blocking users below min version | `src/components/modules/settings/VersionControl.tsx` | Consumer and merchant apps independently controlled |
| Maintenance mode | Global switch; triggers toast; intended to put all apps into maintenance screen and reject non-admin API requests | `src/components/modules/settings/VersionControl.tsx` | "Danger Zone" card; badge pulses red when active |
| Global platform variables | Order limits: Max COD Amount, Min Order Value; Fees: Platform Fee, Base Delivery Fare; Referral: referrer bonus, referee bonus; Logistics: Max Service Radius, Driver Assignment Timeout | `src/components/modules/analytics/GlobalConfig.tsx` | Confirm dialog requiring admin password before saving |
| Finance hub — Settlements | Table: Merchant, Billing cycle, Orders count, GMV, Commission, Net payout, Status (due/paid/on_hold) | `src/components/modules/finance/SettlementsManager.tsx` | Route: `/finance`; Tab: Settlements |
| Finance hub — Tax Invoices | Invoice repository listing | `src/components/modules/finance/InvoiceRepository.tsx` | Tab: Tax Invoices |
| Settlement status tabs | Filter settlements by: Due, Paid, On Hold | `src/components/modules/finance/SettlementsManager.tsx` | |

## Admin — Cross-cutting

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| Toast notifications | `sonner` library; used for success/error/loading/info throughout all modules | Multiple files; `src/components/ui/sonner.tsx` | `toast.loading` used with IDs to update in-place |
| Sidebar navigation | Collapsible icon rail with nav links: Dashboard, Master Catalog, Merchant Network, Orders, Customers | `src/components/Sidebar.tsx` | Uses `NavLink` for active state; collapse to icon-only mode |
| Sidebar rail | Hover-to-expand rail for collapsed sidebar | `src/components/Sidebar.tsx` | `collapsible="icon"` prop |
| Header global search | Input searches Orders, Users, or Stores; currently shows simulated info toast on Enter | `src/components/Header.tsx` | Placeholder hint: "Cmd+K" |
| Header notifications bell | Click shows "No new notifications" toast; red dot indicator always shown | `src/components/Header.tsx` | Purely simulated |
| Header admin profile dropdown | Shows admin name + email; Profile Settings (not wired) + Logout options | `src/components/Header.tsx` | Avatar initial from name or email |
| Breadcrumb | Static "Home > Dashboard" breadcrumb in header | `src/components/Header.tsx` | Not dynamic; does not update per route |
| Error boundary | Wraps app to catch React render errors | `src/components/ErrorBoundary.tsx` | |
| Secure image component | Fetches images from Supabase storage with signed URLs | `src/components/SecureImage.tsx` | Used in KYC document viewer; bucket: `merchant-docs` |
| Image with fallback | Shows placeholder on image load error | `src/components/figma/ImageWithFallback.tsx` | Used in merchant directory, customer list |
| Location picker UI | Map-based lat/lng picker for merchant address | `src/components/ui/location-picker.tsx` | Used in AddMerchantSheet |
| Date range picker | Reusable date range input | `src/components/ui/date-range-picker.tsx` | Available but used sparingly |
| Role-gated destructive actions | KYC approve requires all 4 checklist items; KYC reject requires rejection reason text; bulk delete uses confirm dialog | Multiple merchant screens | No formal RBAC middleware; only SUPER_ADMIN can reach the app at all |
| Floating bulk action bar | Appears at bottom center when rows selected; contains Export, Delete, Activate, Deactivate, Clear actions | `src/components/modules/merchants/MerchantDirectory.tsx`, `MasterCatalog.tsx` | `animate-in slide-in-from-bottom-4` CSS animation |
| `SecureImage` zoom viewer | Zoom in/out (50%–200%) for KYC document images | `src/components/modules/merchants/KYCQueue.tsx` | Zoom controls float above document |

## Admin — Data Fetching Hooks

| Feature | What it does | Where it lives | Notes / edge cases |
|---|---|---|---|
| `useMerchants` | Singleton global state for merchant list; functions: `fetchMerchants`, `createMerchant`, `updateMerchant`, `deleteMerchant`, `kycDecision`, `getMerchantStats`, `exportMerchants`, `addMerchantBranch`, `deleteMerchantBranch`, `bulkDeleteMerchants` | `src/hooks/useMerchants.ts` | Singleton pattern with `listeners[]` array; all hook instances share one `globalMerchants` array |
| `useOrders` | Fetches all orders; subscribes to Supabase realtime `postgres_changes` on `orders` table; function: `updateOrderStatus` | `src/hooks/useOrders.ts` | Realtime INSERT shows new-order toast; UPDATE/DELETE handled in-place |
| `useCustomers` | Fetches `User` table with role=CONSUMER joined with orders for LTV; functions: `fetchCustomers`, `blockCustomer` | `src/hooks/useCustomers.ts` | `blockCustomer` is a stub (shows error toast); city defaults to "Hyderabad" for all customers |
| `useAuth` | Provides `user`, `session`, `loading`, `profileError`, `isAuthenticated`, `mustChangePassword`; functions: `login`, `logout`, `createAdmin`, `clearPasswordChangeFlag` | `src/context/AuthContext.tsx` | React context; must be inside `AuthProvider` |
| Catalog data fetching | Inline `fetchProducts` and `fetchSyncQueue` inside `MasterCatalog`; uses `api` (Axios) to `GET /products` with server-side pagination + filters | `src/components/modules/catalog/MasterCatalog.tsx` | Not a reusable hook; embedded in component |
| City data fetching | Inline `fetchCities` inside `CityManager` via `api.get('/cities')` | `src/components/modules/geography/CityManager.tsx` | Not a reusable hook |
| Coupon service | Named functions: `fetchCoupons`, `createCoupon`, `updateCoupon`, `deleteCoupon`, `toggleCouponStatus` — all using Supabase client directly | `src/lib/couponService.ts` | Not a hook; plain async functions |
| `api` Axios instance | Centralized Axios instance for backend REST API calls | `src/lib/api.ts` | Used for catalog, merchants export, product bulk operations |
| `supabase` client | Supabase JS client for direct DB queries and auth | `src/lib/supabaseClient.ts` | Used everywhere alongside the REST API |
| Merchant stats (RPC) | `getMerchantStats(id)` calls `get_merchant_stats` Supabase RPC; returns `MerchantStats` with 11 fields including `top_categories`, `daily_orders` | `src/hooks/useMerchants.ts` | Falls back to zeroed object on error (dev environment) |
| Platform dashboard stats (RPC) | `get_super_admin_stats` RPC returns `totalGmv`, `totalOrders`, `activeCustomers`, `totalMerchants`, `dailyStats`, `statusBreakdown`, `topStores` | `src/components/Dashboard.tsx` | Single RPC call; no hook abstraction |
| Merchants with stats (RPC) | `get_merchants_with_stats` RPC returns merchants with joined `orders_30d`, `revenue_30d`, `is_online`, `last_active` | `src/hooks/useMerchants.ts` | Falls back to direct `merchants` + `merchant_branches` query on RPC failure |

---

# Summary statistics

| App | Feature rows | Sections |
|---|---|---|
| Customer App | ~125 | 10 |
| Merchant App | ~130 | 12 |
| Admin Dashboard | ~115 | 15 |
| **Total** | **~370** | **37** |

## How features are split across apps

- **Customer App:** consumer-facing flows — browse, cart, checkout, orders, profile, location, favorites.
- **Merchant App:** business operations — KYC signup, dashboard, inventory, orders, settings, payouts, table bookings.
- **Admin Dashboard:** platform operations — merchant onboarding/approval, global catalog, order monitoring, customer database, coupons, analytics, settings, marketing.

## How to extend this file

Drop new sections under the relevant app heading. Use the same table format (`| Feature | What it does | Where it lives | Notes / edge cases |`) so the table of contents stays scannable. Re-run the three audit agents quarterly to catch drift.
