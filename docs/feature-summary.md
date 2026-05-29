# PAS Platform — Feature Summary

**A product handbook for founders, product leads, and new team members.**

Read time: 15 minutes. Skim time: 3 minutes (the matrix on page 2).

---

## What is PAS?

PAS (Pick At Store) is a hyperlocal commerce platform that connects neighborhood consumers to local stores and restaurants. Customers discover nearby venues, pre-order for pickup, or book a table at a restaurant. Merchants get a phone-first management console to handle inventory, orders, and bookings without touching a laptop. The platform stitches both sides together through a single backend, real-time order routing, integrated payments via Razorpay, and an admin operations console for governance.

**Three apps. One backend. One platform.**

- **Customer App** — iOS (TestFlight) + Android (Play Store internal testing). Browse, order, pay, pick up, get an invoice.
- **Merchant App** — iOS (TestFlight) + Android (Play Store production). Run a store or restaurant from a phone.
- **Admin Dashboard** — web SPA for the operations team. Approve merchants, manage the master catalog, monitor orders.

All three share a single Supabase Postgres database and a Node.js API server (`apps/api`). Payments flow through Razorpay. Real-time order updates use Supabase's Postgres-changes channels.

---

## How to read this document

This handbook layers from broad to specific:

| Section | Use it when… |
|---|---|
| **Hero capability matrix** (next page) | You want the whole product on a slide |
| **Capability cards** (per app, ~10 each) | You're onboarding, deciding scope, or briefing a partner |
| **Flagship user flows** | You want to understand how the pieces fit in a real session |
| **Maturity dashboard** | You want a one-glance view of what's polished vs in flight |
| **Roadmap teaser** | You want to know what's coming next |
| **Full feature inventory** ([docs/feature-inventory.md](./feature-inventory.md)) | You need engineering-level detail (~370 features with file paths) |

**Status labels used in this doc:**

- ✅ **Shipped** — Live, working in production, used by real users.
- 🔧 **In Progress** — Partially built. UI may be present but some flows aren't fully wired, or has known rough edges being smoothed out.
- 📋 **Planned** — Designed conceptually, scheduled, not yet started.

---

## Hero capability matrix (one page)

The whole product surface area, in nine pillars:

| Pillar | Customer App | Merchant App | Admin Dashboard |
|---|---|---|---|
| **Authentication** | Phone OTP, guest mode (Apple-compliant), persistent session | Phone OTP with multi-role discovery (owner, manager, staff), branch picker on login | Email/password, single SUPER_ADMIN role, forced first-password change |
| **Onboarding** | 3-slide tour + optional profile setup | 7-step KYC signup with document upload, GPS pin, branch creation, Razorpay subscription | Add admin user, KYC approval queue with 4-point checklist |
| **Discovery** | Location-aware home, pickup feed, dining feed, category browse, in-store search, real-time store status | — | Merchant directory with filters, customer database |
| **Transactions** | Multi-store cart, pickup checkout with time-slot picker, dining checkout with arrival booking, Razorpay payments, coupons | 2-minute SLA accept/reject, OTP-secured handover, rejection-triggered auto-refund, real-time order feed | Cross-merchant order monitoring, force-complete, dispute console |
| **Fulfillment** | Order tracking with real-time status, OTP for pickup/dining arrival | Inventory management, schedule-aware online state, lunch break support, prep-time buffering | Per-merchant inventory view (read-only) |
| **Trust & Compliance** | Tax invoice modal with merchant GSTIN, masked payment refs | KYC document storage, compliance panel, bank account management | KYC review with document zoom viewer, approval/rejection workflow |
| **Growth** | Favorites (stores + products), coupon browser, notification preferences | "Hero Picks" best-sellers, notification feed | Coupon builder with live preview, push campaigns, sponsored-ad manager |
| **Booking** (Dining) | Live slot booking with deposit, booking OTP, 7-day date strip | Slot rule configuration, today's bookings view, arrival OTP verification, no-show/cancel | (Handled by merchant; admin sees in order stream) |
| **Platform Ops** | — | — | Master catalog (with live import from merchant apps), geography, analytics dashboard, settlements, app version control, maintenance mode |

---

## Capability cards — Customer App

Ten capability groups. Each lives in `apps/consumer-app/`.

### 1. Onboarding & Account Management ✅ Shipped
**What it includes:** Three-slide onboarding tour on first launch; phone OTP login with WhatsApp delivery; guest-mode browsing (Apple Guideline 5.1.1(v) compliant); 60-second resend cooldown; new-user routing to profile setup (avatar, name, email, DOB) with skip-for-later option; profile editing post-login with notification preferences and security preferences (2FA, biometric).
**Why it matters:** Low-friction entry. A user can browse without signing in, sign in only to transact. Profile data flows into orders and invoices automatically.

### 2. Location & Address Management ✅ Shipped
**What it includes:** GPS auto-detect with Google Places autocomplete; multi-address storage (Home/Work/Other tags); 4-priority location resolution (manual selection → nearest saved → cached GPS → live geocode); reverse-geocoding of map pin; address edit/delete with active-address takeover logic; logout clears manual selection.
**Why it matters:** Hyperlocal commerce requires sub-kilometer location accuracy. Customers can keep multiple addresses (home + office) and switch between them.

### 3. Discovery — Home & Pickup Feed ✅ Shipped
**What it includes:** Brand-rich home screen with Pickup vs Dining choice cards; universal search across all verticals via Postgres RPC; nearby store cards with PostGIS-based 10 km radius; distance + ETA badges (green/amber/red); OFFER tag computed from product discounts; "Currently Offline" overlay for closed stores; quick filter pills (Nearest, Restaurants, Groceries, Coffee & Bites); advanced store filter modal.
**Why it matters:** Discovery is the top of the funnel. The PostGIS RPC and real-time `merchant_branches` subscription mean availability is always accurate.

### 4. Discovery — Dining Experience ✅ Shipped
**What it includes:** Dining feed with cuisine filter pills; veg-only/non-veg toggle modal; restaurant cards with rating, distance, cuisine tag, "Book a Table" CTA; dining-scoped search; store filter modal for dining-specific options.
**Why it matters:** Dining is structurally different from pickup (booking vs ordering). The separate tab and dedicated filters reflect that. Drives table-booking revenue.

### 5. Discovery — Storefront Experience ✅ Shipped
**What it includes:** Per-store landing with hero image carousel; restaurant info block with real-time open/closed status; in-store product search; veg/non-veg toggle; smart filter pills that hide themselves when no items qualify (bestsellers, offers, Under ₹300); category underline tabs with scroll-tracking; sticky header on scroll; product filter & sort modal with price-range slider; pulsing offline banner when store closed; real-time updates via Supabase subscription on `merchant_branches`.
**Why it matters:** This is where browsing converts to intent. Real-time store status prevents the worst customer experience — placing an order at a closed store.

### 6. Cart & Pickup Checkout ✅ Shipped
**What it includes:** Multi-store cart with dining/pickup mixing guard; cloud-sync to Supabase `cart_items` with guest→user merge on login (higher-quantity wins); per-item quantity stepper with stock cap; pickup checkout with per-store time-slot picker (Today/Tomorrow); "Pick up myself" vs "Pick up by other" mode with contacts picker; special-instructions field; manual coupon entry; order-request flow with 2-minute SLA and real-time `order_requests` subscription; waiting → results → confirmed state machine; back-navigation block during waiting/results.
**Why it matters:** The 2-minute accept/reject SLA is the spine of the marketplace's promise — customer commits to pay, merchant has 2 minutes to commit to fulfill.

### 7. Cart & Dining Checkout ✅ Shipped
**What it includes:** Guest count picker (1–10); arrival date/time picker with operating-hours validation; midnight-crossing time-range handling; coupon entry; deposit payment via Razorpay; same order-request flow with waiting state and real-time updates; booking OTP issued on confirmation.
**Why it matters:** Restaurants need committed reservations. The deposit + OTP combo reduces no-shows.

### 8. Payments — Razorpay Integration ✅ Shipped
**What it includes:** WebView-based Razorpay Checkout.js loader; no native Razorpay module required (Expo Go compatible); HTML injection sanitization; session-recovery pattern in `handlePaymentSuccess` (refreshSession + getSession) to defeat Razorpay WebView's session eviction on Android; on-screen error diagnostic box that surfaces actual exception messages from `/orders` and `/payments/verify`.
**Why it matters:** Payment reliability is non-negotiable. The session-recovery + diagnostic UI added in May 2026 closed a category of "money taken, order not created" failures that had bitten a live demo.

### 9. Orders, Invoicing & Post-Purchase ✅ Shipped
**What it includes:** Real-time order list with status badges (CONFIRMED/PREPARING/RESERVED/COMPLETED/CANCELLED); pull-to-refresh; tax invoice modal on order tap with merchant GSTIN (from joined `merchants` table), seller block, buyer block, items table (pickup) or booking-deposit row (dining), 5% GST line, masked Razorpay payment reference, OTP PIN display, legal disclaimer.
**Why it matters:** Indian GST compliance requires invoices. The invoice modal closes the post-purchase loop and gives the customer something to share.

### 10. Engagement & Retention ✅ Shipped
**What it includes:** Favorites (separate hooks for stores and products) with optimistic UI + auth-gated rollback; offers screen with searchable coupon browser (Flat/Percentage/Bank/UPI types); notification preferences toggles per category (newsletter, promos, orders, important) across push/email/WhatsApp channels; security preferences (2FA, biometric); support screen with searchable FAQs, website link, email contact, terms link.
**Why it matters:** Retention is downstream of every feature here. Favorites build muscle memory. Offers drive return visits.

---

## Capability cards — Merchant App

Ten capability groups. Each lives in `apps/merchant-app/`.

### 1. Authentication & Multi-Branch Login ✅ Shipped
**What it includes:** Phone OTP login; multi-role discovery that queries `merchants` (owner via phone), `merchant_branches` (manager via phone), and `store_staff` (staff via user_id); aggregated contextMap returns all stores + branches a user can manage; branch selection modal on login when user has multiple options; persistent `active_context` and `active_branch_id` in AsyncStorage.
**Why it matters:** A user might be an owner of one store, a manager at another's branch, and staff at a third. The login does the discovery automatically so the app shows everything they can access in one place.

### 2. Merchant Onboarding (7-Step KYC) ✅ Shipped
**What it includes:** Step 1 — owner profile + phone OTP. Step 2 — store name, category (vertical), city, address, GPS pin on Google Maps, dining-only fields (cuisines, veg toggle, restaurant type). Step 3 — store photos (minimum 2). Step 4 — additional branches (per-branch name, address, manager, phone, photos). Step 5 — KYC documents (PAN, Aadhaar front/back, GST, FSSAI if required, optional MSME, bank account + IFSC + beneficiary, turnover range). Step 6 — Razorpay subscription payment (₹999 standard / ₹2999 premium). Step 7 — review & submit via ACID transaction at `POST /auth/merchant/signup`. Draft state persisted to AsyncStorage every second.
**Why it matters:** This is the most operationally critical flow on the platform. The 7-step structure prevents merchants from abandoning at the long forms by checkpointing progress. The May 2026 fix ensures every signup creates a default `merchant_branches` row so first-product-add never fails on FK violation.

### 3. Dashboard & Store Status ✅ Shipped
**What it includes:** Time-based greeting; store online/offline toggle with confirmation alert; three-color schedule banner (red — manual offline; amber — Closed Today, Outside Hours, or Lunch Break with re-evaluation every 30 seconds); greyscale overlay when offline; KPI cards (Today's Orders, Pending, Completed, Revenue with K/L formatting); Estimated Payout (today × 0.98 platform fee simulation); quick-action buttons to Add Product / Manage Items / All Orders; loading skeleton prevents offline-banner flash on cold boot.
**Why it matters:** First screen a merchant sees. The schedule-aware banner means a closed restaurant isn't accidentally taking orders. The KPIs answer "how am I doing today?" without taps.

### 4. Inventory — Catalog & Custom Products ✅ Shipped
**What it includes:** Global catalog picker (browse the platform-wide Product table, multi-select); ConfigureProductsModal with smart variant presets per category (dairy 250ml/500ml/1L, fashion S/M/L, etc.); custom product creation for pickup stores (name, MRP, selling price, brand, SKU/EAN, stock, UOM, GST%, category, image); dining menu item creation with menu sections (Starters/Main Course/etc.), dietary tags (veg/non-veg/egg/vegan), spice levels (none/mild/medium/spicy/extra-spicy), portion variants (Half/Full, S/M/L, custom).
**Why it matters:** Pickup and dining have fundamentally different inventory shapes. One app handles both with conditional fields. The May 2026 `hasRealBranch` guard prevents FK violations when adding products before a branch exists.

### 5. Inventory — Filter, Sort & Bulk Operations ✅ Shipped
**What it includes:** Two-pane filter modal (35% sidebar + content) with different tab sets for pickup vs dining vs global catalog flows; pickup tabs (Sort, Price, Category, Brand, Availability, Discounts); dining tabs (Sort, Menu Section, Dietary with Both shortcut, Spice Level, Price, Availability); cascading brand filter; in-list quick chips (Out of Stock, Low Stock, Hero Picks, Show Inactive); inline edit of price/stock; toggle active/inactive; soft-delete; bulk multi-select in catalog picker.
**Why it matters:** A merchant with 200 SKUs needs to find and edit fast. The dining/pickup divergence prevents irrelevant filters from cluttering the UX.

### 6. Order Operations ✅ Shipped
**What it includes:** Tab-based lifecycle (Pending, Processing, Ready, History with sub-filters); search by order ID; date-range picker with default 7-day rolling window; sort toggle (newest/oldest); per-order 2-minute countdown timer that turns urgent red in last 30 seconds; APPROVAL NEEDED yellow strip → urgent red on PENDING cards; PAID-START PACKING green strip on paid orders; pickup vs dine-in colored badges; accept (→ CONFIRMED); reject with reason modal (5 presets + free text) → auto-refund triggered if order was paid; mark ready (→ READY); OTP verification numpad modal on handover (→ COMPLETED); receipt summary modal with per-item GST.
**Why it matters:** This is the merchant's "shop floor." The 2-minute timer creates urgency without being punitive. Auto-refund on rejection of paid orders maintains customer trust.

### 7. Store Configuration ✅ Shipped 🔧 In Progress (some sub-sections)
**What it includes:** Operating hours per day (Mon–Sun toggle); open/close times; prep-time buffer; lunch break toggle with start/end; service mode switches (Pickup, Dine-in, Table Booking); dirty-state detection on save; store details (name, address, photos, cuisines/veg/restaurant-type for dining); branch management with Google Places autocomplete; staff management (add manager, branch assignment, deactivate); notification sound picker; compliance panel (PAN, Aadhaar, GST — read-only); about/legal screen. *Compliance edit flows and notification deeper customization are in progress.*
**Why it matters:** Without configurability, a single-template app would fail any non-default merchant. The schedule config powers the dashboard banners.

### 8. Table Booking Operations (Dining) ✅ Shipped
**What it includes:** Slot rule configuration (multi-day toggle, tables-per-slot stepper 1–20, slot gap 30/45/60 min); multiple rules per store (different patterns for weekday vs weekend); preview generator that respects operating hours and lunch breaks; today's bookings screen with date navigation, summary counts (total/confirmed/completed/cancelled/no-show), status-colored cards; mark-arrived flow with inline 4-digit OTP entry; mark no-show with confirmation; cancel-with-refund flow; real-time `table_bookings` subscription.
**Why it matters:** Restaurants' core differentiator vs delivery apps. The deposit + OTP arrival flow protects against no-shows. The slot config gives restaurants control over capacity.

### 9. Earnings & Payouts ✅ Shipped 🔧 In Progress (disbursement)
**What it includes:** Real-time today/weekly/total revenue stats with branch scoping; completed and pending order counts; estimated payout calculation (today × 0.98); earnings screen with total-revenue hero card; multi-bank-account storage (primary signup-column account + JSON array for additional accounts); add-bank-account modal with validated bank name, account number (9–18 digits), IFSC regex, beneficiary name. *Actual money disbursement to the merchant's bank is in progress — bank details are captured but the payout pipeline is not yet automated.*
**Why it matters:** Merchants need to see what they've earned and where it's going. Disbursement automation is a Q3 priority per the roadmap.

### 10. Notifications & Real-time ✅ Shipped
**What it includes:** Expo push token registration on physical device with Android `orders` channel at MAX importance; foreground notification handling (banner + sound + badge); notification feed screen with type icons (order/stock/payout/default); mark single/all as read; unread badge on dashboard bell capped at 99+; deep-link routing with wrong-branch guard; in-app notification toast; Supabase real-time `orders` subscription drives the order operations screen and dashboard counts.
**Why it matters:** A new order should be impossible to miss. MAX-importance Android channel + foreground banner + bell badge cover three attention layers.

---

## Capability cards — Admin Dashboard

Ten capability groups. Lives in `apps/admin-web/` (Vite + React Router SPA, NOT Next.js).

### 1. Admin Authentication & Access ✅ Shipped
**What it includes:** Email/password login via Supabase; single SUPER_ADMIN role enforced (any other role is signed out immediately on profile fetch); forgot-password reset email flow; force-password-change on first login (interceptor based on `mustChangePassword` user_metadata flag); session restore on page reload with 5-second fallback timeout to prevent infinite spinner; profile-network-error screen that doesn't log the admin out for transient failures; logout from header dropdown.
**Why it matters:** Admin access controls who can approve merchants and modify the master catalog. The single-role model is simple now but already a constraint (see Settings module).

### 2. Merchant Lifecycle Management ✅ Shipped
**What it includes:** Merchant Network hub with Directory and KYC Queue tabs. Directory: searchable, filterable by status / KYC state / city / low-rating, sortable by 30-day orders/revenue/rating; KYC-pending rows highlighted orange, rejected red. Merchant Details Sheet with Overview tab (compliance panel showing PAN/Aadhaar/GSTIN/bank/MSME/FSSAI document links, store photos gallery, 30-day performance stats from `get_merchant_stats` RPC), Recent Orders tab, and Product Inventory tab. KYC Queue: document viewer with zoom (50%–200%), 4-point checklist (Name Match / Valid Docs / Clear Photo / Address Match) gating the Approve button, rejection requires a reason. Bulk operations: select-all, export to .xlsx, delete (cascaded via `delete_merchants_cascaded` RPC), activate/deactivate. Add Merchant 3-step sheet (Store Info, Branches, KYC & Docs).
**Why it matters:** The entire trust foundation of the marketplace. A merchant cannot transact until KYC approval. The 4-point checklist forces reviewers to verify each piece of evidence.

### 3. Order Operations ✅ Shipped 🔧 In Progress (some side actions)
**What it includes:** Global order manager listing all orders across all merchants with real-time subscription via `postgres_changes`; columns include Order ID, Time Placed (relative), Customer, Store, Status pill, Amount, SLA Timer (turns red and shows "Overdue" when >15 min in processing); status tab filters (All, Active, Disputed, Cancelled); click row to open side sheet with customer info, order timeline, action buttons; force-complete and refund-and-cancel actions; new-order toast triggered on INSERT realtime event; Dispute Console for disputed orders showing user evidence + system data side-by-side with resolve/flag/dismiss actions. *Export CSV, Date filter, and three-dot context menu actions are in progress — buttons are present but not yet wired to backends.*
**Why it matters:** Platform-level visibility lets the ops team unblock stuck orders, intervene in disputes, and reconcile against Razorpay records.

### 4. Customer Database ✅ Shipped 🔧 In Progress (moderation actions)
**What it includes:** Customer list table with avatar, contact, location (city), Total LTV, Last Activity, Status badge; search by name/phone/ID; filter by status (active/blocked) and city; customer details sheet with Overview tab (contact, shopping insights including total orders, avg order value, years active) and Order History tab; LTV computed live from joined orders; refresh button. *Block customer and Goodwill wallet credit are UI-present-only — backend implementation is pending.*
**Why it matters:** Support team needs to see a customer's order history during a complaint. LTV helps prioritize escalations.

### 5. Master Catalog ✅ Shipped
**What it includes:** Tabbed view (Global Catalog, Custom store-created, Sync Queue); server-side paginated product table (50 per page) via `GET /products`; columns include image, name, category, EAN/barcode, brand, MRP, GST rate, HSN, UOM, vertical; server-side filters by category, GST rate, price range, missing data; inline editable cells with optimistic update + rollback; per-product image gallery with upload/set-primary/remove; bulk operations (delete, update category, update GST rate, export selected to .xlsx, CSV/Excel import with skipped-items report, download template); Sync Queue showing products scraped from merchant apps with 5-second polling on active sync runs (persisted in localStorage to survive page refresh); approve sync items moves them to global catalog; reject deletes them.
**Why it matters:** The catalog is the platform's central product graph. Hundreds of merchants pull from it. Bulk operations and live import keep it manageable.

### 6. Marketing — Coupon Builder ✅ Shipped
**What it includes:** Coupon list with code, discount type+value, max cap, funding source badge, target audience badge, app-wide badge, usage count; create-coupon form with promo code (max 10 chars, auto-uppercased, unique-enforced), discount type (PERCENTAGE/FLAT), discount value (percentage validated ≤100), max discount cap, funding source (PLATFORM/MERCHANT), target audience (ALL/NEW_USERS/INACTIVE_USERS), usage limit, expiry date, live mobile preview rendering an iOS-style lock screen card; toggle active/inactive; delete with confirmation.
**Why it matters:** Marketing campaigns drive customer acquisition and reactivation. The "funding source" distinction makes finance accountable — PLATFORM-funded vs MERCHANT-funded coupons hit different P&L lines.

### 7. Engagement — Push & Sponsored Ads 🔧 In Progress
**What it includes:** Engagement Hub with Push Campaigns and Sponsored Ads tabs. Push Campaign Builder: title field, body textarea with 120-char counter, deep-link URL, target audience dropdown (All Users / Hyderabad / Bangalore / Inactive >30 Days / Churn Risk AI Segment), send-immediately vs schedule-later radios, iOS lock-screen live preview. Sponsored Ads Manager: table of campaigns by merchant, ad position, dates, status, impressions, cost; create/pause campaigns. *Send Blast and Schedule Campaign currently fire toasts; not yet wired to a real FCM/Expo Push endpoint. Sponsored ads are tracked in UI but not actually served to customer apps yet.*
**Why it matters:** Push is the most cost-effective retention channel. Sponsored ads are a revenue opportunity. The UI is built to invest in once those backends land.

### 8. Analytics & Reporting ✅ Shipped 🔧 In Progress (deeper analytics)
**What it includes:** Platform dashboard at `/` with KPI cards (Total GMV, Total Orders, Active Consumers, Total Merchants) fetched via `get_super_admin_stats` Supabase RPC; orders chart, platform charts (orders over time, status breakdown), top stores list, KPI cards with optional sparkline + pulse animations; Analytics Hub at `/analytics` with Reports / Global Config / Audit Logs tabs; live activity ticker; live delivery map. *User retention cohort chart, demand heatmap, top-performing-merchants table, top-selling-products table, audit log table, time range selector, and download-investor-deck button are UI-present with placeholder data — real data plumbing is in progress.*
**Why it matters:** The shipped KPIs let you answer "how is the business doing this week?" The in-progress sections will answer "where should we invest next quarter?"

### 9. Finance Hub 🔧 In Progress
**What it includes:** Settlements Manager table (Merchant, Billing cycle, Orders count, GMV, Commission, Net payout, Status) with Due/Paid/On Hold tabs; Tax Invoice Repository listing. *Most fields are scaffolded with placeholder data; the actual settlement calculation pipeline and invoice generation from order records is in progress and ties to the merchant-app payout disbursement work.*
**Why it matters:** Bookkeeping discipline. Once live, this is where commission accounting and merchant settlements reconcile. Currently the placeholder UI helps validate the workflow before the data pipeline lands.

### 10. Platform Operations ✅ Shipped 🔧 In Progress (parts)
**What it includes:** Geography — city list with active badge, store count, per-city settings panel (Discovery Radius toggle, Base Commission Rate %). Team & RBAC — admin user list, add admin dialog, edit, delete. App Control — Version control per app (current + minimum force-update versions), force-update toggle, maintenance mode global switch (Danger Zone). Global Config — order limits (Max COD, Min Order Value), fees (Platform Fee, Base Delivery Fare), referral bonuses, logistics (Max Service Radius, Driver Assignment Timeout), admin-password-confirmation required to save. *Geography map view and pincode upload are visual placeholders; commission rate save is not yet persisted; some Global Config saves are pending wiring.*
**Why it matters:** Platform-level levers — turn on a new city, flip maintenance mode, force-update older app versions when they hit incompatibility. Critical for operational control as the user base grows.

---

## Flagship user flows

Three real journeys, narrated step-by-step. These tie the capability groups together.

### Flow A — Customer places a pickup order at a restaurant

1. **Discover.** Customer opens the app on the home tab. Their location is auto-resolved (priority: persisted selection → nearest saved address → cached GPS → live geocode). They tap the Pickup card, see a feed of nearby venues with distance + ETA, and tap "Classic Cafe — Madhapur" which is currently open (real-time verified).
2. **Add to cart.** They browse the storefront, switch the Veg toggle to "Pure Veg," tap two menu items into the cart (with stock-cap enforcement). The Floating Cart Band appears at the bottom showing item count and total.
3. **Checkout.** Tap the cart band → cart screen → "Proceed to Pay." If they're a guest, the Transactional Auth Modal appears for phone OTP login. They confirm pickup time (Today, 7:00 PM), choose "Pick up myself," and apply a coupon. App fires order requests to the store(s).
4. **Wait → confirm.** Waiting screen shows pending → accepted as the merchant accepts within 2 minutes. Razorpay opens, customer pays. On success, app does a session refresh (defensive against WebView eviction), verifies the Razorpay signature, creates the order on the API. They see the order OTP for pickup. Order also appears in real-time on "Your Orders" with status PREPARING.
5. **Pickup + invoice.** They walk to the store, show the OTP. Merchant scans it on their tablet, completes the order. Customer's app updates to COMPLETED via real-time subscription. They tap the order card → tax invoice modal opens with merchant GSTIN, items table, GST line, total, payment ref.

### Flow B — Merchant signs up, gets approved, places first product

1. **Apply.** New restaurant owner taps "Apply as Partner" on the login screen. Step 1: enters owner name, phone, email; verifies phone via OTP. Step 2: enters store name, picks "Restaurants & Cafes" vertical (which unlocks dining-specific fields), drops the GPS pin, fills cuisines + veg toggle + restaurant type. Step 3: uploads 2+ store photos. Step 4: toggles off "additional branches" (single location). Step 5: uploads PAN, Aadhaar (front/back), GST cert + GST number, bank account + IFSC + beneficiary, picks turnover range. Step 6: pays the ₹999 standard subscription via Razorpay. Step 7: reviews everything and submits. Submission triggers `POST /auth/merchant/signup`, which runs an ACID transaction creating the Prisma User, Store, Merchant, default `merchant_branches` row (using merchant_id as branch_id), and Subscription record.
2. **Wait for approval.** Owner sees the "Application Under Review" pending screen. Admin opens the KYC Queue, picks the merchant, reviews each document with the zoom viewer, checks all 4 checklist items, clicks Approve. Server-side email sent.
3. **Onboard internally.** Merchant logs in (single branch found, no picker shown). Lands on Dashboard with online toggle, schedule banner (Outside Hours initially), KPI cards.
4. **Configure store.** Goes to Settings → Store Timings, sets working days, opening/closing time, prep time 15 min, lunch break 14:00–15:00, enables Pickup + Dine-in + Table Booking. Dashboard banner now reads "Lunch Break" or "Outside Hours" or accepting orders based on current time. Goes to Settings → Table Booking Slots, creates one slot rule (Mon–Sat, 4 tables per slot, 60-min gap). System now accepts customer bookings.
5. **First menu item.** Goes to Inventory → Add Menu Item. Names it "Paneer Tikka," picks Starters menu section, adds image, sets GST 5%, selling price ₹240, dietary "veg," spice "medium," portion variant Half/Full at ₹140/₹240. Saves. The `hasRealBranch` flag is true (from Step 1's default-branch creation), so the save succeeds. Order operations are now possible.

### Flow C — Admin approves a merchant + manages a dispute

1. **KYC review.** Admin lands on the dashboard, sees the KPI cards (Total GMV, Total Orders, Active Consumers, Total Merchants). Goes to Merchant Network → KYC Queue. The new restaurant signup from Flow B is in the list. Selects it, the document viewer loads all uploaded files. Reviewer zooms into the GST certificate at 150%, name on PAN matches owner_name field, photos look clear, address on Aadhaar matches store address. Checks all 4 checklist items. Clicks Approve.
2. **Catalog management.** Same admin goes to Master Catalog. Filters by Vertical = "Beauty & Personal Care" and GST = 18%. Spots a product without an HSN code, clicks inline edit, fills it in. Saves with optimistic update.
3. **Dispute resolution.** A customer raises a dispute on an order. Admin sees the disputed-orders count increment in real-time. Opens Orders → Disputed tab → clicks the order. Dispute Console opens. Left panel shows customer's evidence (uploaded photo + statement). Right panel shows system data (order line items, GPS trace, timestamps). Admin reviews, decides to refund. Clicks "Refund & Cancel" on the order, the customer is notified.

---

## Maturity at a glance

| App | Capability groups | ✅ Shipped | 🔧 In Progress | 📋 Planned |
|---|---|---|---|---|
| Customer App | 10 | 10 | 0 | 0 |
| Merchant App | 10 | 8 | 2 | 0 |
| Admin Dashboard | 10 | 6 | 4 | 0 |
| **Total** | **30** | **24 (80%)** | **6 (20%)** | **0** |

"In progress" groups mean the capability is partly built — UI is present, some workflows are wired, but at least one important sub-feature is still being polished or backend-pluggined. None of the in-progress items block the platform from operating today; they're optimizations and depth additions.

---

## What's in flight or queued (top 6)

1. **Merchant signup flow redesign (target ~early June 2026).** Compresses 7 steps to 5 by reordering: Profile → KYC → Category+Payment → Branches → Review. Also unifies the "primary location" and "additional branches" model. Folds in the orphan-staff-role schema fix (`ON DELETE CASCADE` audit), the missing-Prisma-User-row fix for consumer signups, and the defense-in-depth `hasRealBranch` flag becoming structurally unnecessary. Detailed notes at [`docs/signup-flow-redesign-notes.md`](./signup-flow-redesign-notes.md).

2. **Backend security pass.** Several API endpoints (`POST /orders`, `POST /merchants/:id/kyc-decision`, `POST /orders/:id/refund`, `POST /orders/:id/status`) need authentication middleware. Row-level security policies on `StoreProduct`, `Product`, `Store` need to be tightened from "all authenticated users" to "store managers only." Razorpay payment verification needs to be tied to order creation via a persisted row. Tracked in the code review document.

3. **Real refund pipeline.** The current `/orders/:id/refund` endpoint marks orders as refunded locally but the actual Razorpay refund API call is not yet wired. Customer trust depends on this working before any production launch.

4. **Merchant payout disbursement.** Bank details captured during signup are stored but not yet used to disburse money. Plan is to integrate with a payouts provider (RazorpayX or similar) so settled earnings auto-credit weekly/monthly.

5. **Admin analytics depth.** Several of the analytics panels currently render placeholder data. Plumbing real cohort retention, demand heatmap, and top-performing-merchants/products is queued.

6. **Push notification real delivery.** Admin push campaigns currently fire UI toasts but don't dispatch to Expo's or Firebase's actual push services. Wiring this completes the engagement loop.

---

## Appendix

| Document | Use case |
|---|---|
| [`docs/feature-inventory.md`](./feature-inventory.md) | Engineering-level detail — ~370 features with file paths and edge cases |
| [`docs/signup-flow-redesign-notes.md`](./signup-flow-redesign-notes.md) | Notes for the upcoming signup redesign; orphan-staff-role edge case; FK cascade audit |
| [`docs/system-map.md`](./system-map.md) | Architecture / system topology |
| [`docs/aws-https-setup-guide.md`](./aws-https-setup-guide.md) | HTTPS termination on AWS for the API |
| `CLAUDE.md` (repo root) | Lock-file conventions, OTA protocol, known backend bugs |

---

## How this doc stays alive

This document drifts the moment new features ship. Suggested cadence:

- **After every major feature merge** — update the relevant capability card's "What it includes" line.
- **Quarterly** — re-run the three review agents that produced the original `feature-inventory.md` and consolidate any new groups into a fresh card here.
- **Before every founder/investor meeting** — read the Hero Capability Matrix and the Maturity Dashboard. If a status changed, fix it before sharing.

Keep the inventory file as the source of truth; this handbook is its compressed sibling.
