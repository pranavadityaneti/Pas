# Pick At Store (Pas) - Project Manifesto

## 1. Project Overview
**Pick At Store** is a massive hyperlocal commerce platform designed to bridge the gap between Consumers and their local neighborhood Merchants. It empowers consumers to find products in nearby stores, place orders instantly, and track them in real-time. For merchants and administrators, it provides a unified "Command Center" to manage catalogs, track inventory, and oversee the entire fulfillment network.

**Current Status**: **Phase 2 Complete (Advanced Admin Ecosystem)**.

### Core Philosophy
We rejected the "simple CRUD app" approach. This is a complex, **event-driven ecosystem** built on:
*   **Real-Time Data**: No refreshing pages. If an order happens, the screen updates.
*   **Deep Interconnectivity**: All data points (Orders, Customers, Merchants) are hyperlinked.
*   **Single Source of Truth**: A centralized Master Catalog that feeds thousands of merchant inventories.

---

## 2. Key Modules & Features (The "Big 4")

## 2. Key Modules & Features (The "Big 4")

### A. The Master Catalog (The "Product Brain")
The single source of truth for all product data. We moved away from the chaotic "marketplace" model where every seller uploads their own low-quality images. Instead, we use a **Centralized Master Catalog**.
*   **Why it matters**: Ensures every customer sees high-res images and accurate descriptions, regardless of which local shop they buy from.
*   **Deep Dive Features**:
    *   **Visual Excel Import**: A drag-and-drop importer that parses Excel files client-side, displays a data grid preview, identifies invalid rows (e.g., negative prices), and prevents "garbage data" from ever reaching the database.
    *   **Virtualised Infinite Scroll**: Built to handle 100,000+ SKUs without slowing down the browser. It renders only the DOM nodes currently visible on screen.
    *   **Multi-View Gallery**: Each product supports a primary image and unlimited secondary images (e.g., Back of Pack, Nutrition Info), managed via a custom "Image Strip" UI that uploads directly to Supabase Storage buckets.

### B. The Merchant Network (The "Supply Web")
This module manages the physical nodes of our network. It goes beyond a simple address book—it is a live **Performance Monitor**.
*   **Why it matters**: We need to know which stores are healthy, which are churning, and who is driving revenue *right now*.
*   **Deep Dive Features**:
    *   **The "Merchant Sheet"**: A slide-over dashboard that activates when you click any merchant. It is **Connected to the Core**, meaning it runs live SQL queries (via Postgres RPC `get_merchant_stats`) to calculate:
        *   **Real-time GMV**: Sum of all successful orders in the last 30 days.
        *   **Top Categories**: Aggregates `OrderItems` to show if a store sells more "Dairy" or "Snacks".
    *   **Inventory vs. Velocity**: The dashboard distinguishes between what a merchant *claims* to have (Inventory) and what they actually *sell* (Velocity), helping admins spot discrepancies.

### C. Order Command Center (The "Traffic Controller")
The mission-critical screen for Operations teams. It is designed for high-stress environments where speed is everything.
*   **Why it matters**: A delayed order is a lost customer. This screen reduces "Time to Action".
*   **Deep Dive Features**:
    *   **Deep Linking Ecosystem**: The defining feature of Phase 2. The Order Table is the bridge between modules.
        *   Clicking **"Customer Name"** opens the *Customer 360 Sheet* (Is he a VIP? Is this his first order?).
        *   Clicking **"Store Name"** opens the *Merchant Sheet* (Is this store reliable? Do they have a history of cancellations?).
    *   **Supabase Realtime Subscriptions**: The table listens to `INSERT` and `UPDATE` events on the `orders` table. No manual refreshing required—new orders flash onto the screen instantly.
    *   **SLA & Status Logic**: Colored pills and "Time Ago" badges visually warn operators if an order is stuck in "Processing" for too long (e.g., > 45 mins).

### D. Customer 360 (The "Intelligence Layer")
A CRM built directly into the transaction platform. It gives support agents "X-Ray Vision" on who they are talking to.
*   **Why it matters**: Treating a high-value customer like a stranger is a fatal error.
*   **Deep Dive Features**:
    *   **Dynamic LTV Calculation**: We don't just store a static "LTV" number. When you open a profile, the system aggregates their entire order history in real-time to compute their exact Lifetime Value.
    *   **Behavioral Insights**:
        *   **Avg. Order Value**: Does this user buy small snacks or monthly groceries?
        *   **Tenure**: How many years have they been with us?
    *   **Contextual History**: A scrollable list of their past orders (successes and failures) helps agents resolve disputes faster.

---

## 3. Technology Stack (The "Modern Web")

We use a high-performance stack optimized for speed and developer experience:

| Layer | Technology | Why we chose it? |
| :--- | :--- | :--- |
| **Frontend** | **React 18 + Vite** | Blazing fast builds and HMR. |
| **Styling** | **Tailwind CSS + Shadcn UI** | Beautiful, accessible, and consistent design system. |
| **Backend Logic** | **Node.js (Express)** | Proven scalability for API logic. |
| **Database** | **PostgreSQL** | Relational integrity (unlike NoSQL). |
| **ORM** | **Prisma** | Type-safe database queries. |
| **Real-Time** | **Supabase Realtime** | Live subscriptions for Orders/Chats. |
| **Analytics** | **Postgres RPC (PL/pgSQL)** | Raw SQL functions for heavy number-crunching. |

---

## 4. Setup Instructions (For New Developers)

Follow these steps to wake up the system locally.

### Prerequisites
*   Node.js (v18 or higher)
*   npm (v9 or higher)

### Step 1: Install Dependencies
Install all libraries for the frontend, backend, and shared packages.
```bash
npm install
```

### Step 2: Database Connection
Ensure your `.env` file in `apps/api` has the correct `DATABASE_URL` pointing to the Supabase Postgres instance.

### Step 3: Run Migrations & RPCs
Push the schema to the cloud and create the necessary SQL functions for analytics.
```bash
cd apps/api
npx prisma db push
npx ts-node run_stats_v2.ts  # Important: Creates the Analytics SQL Function
```

### Step 4: Launch the Servers
We run the API (Backend) and Admin Web (Frontend) concurrently.

**Terminal 1 (Backend):**
```bash
cd apps/api
npm run dev
# Connects to Database & Socket Server
```

**Terminal 2 (Frontend):**
```bash
cd apps/admin-web
npm run dev
# Launches Dashboard at http://localhost:3005
```

---

## 5. Development Workflow (Agentic)
This project is built using an "Agentic Pair Programming" model.
1.  **Cursor Driven**: The Human User directs the "Antigravity" Agent.
2.  **Verification**: Every feature is audited for "Mock Data" vs "Real Data".
3.  **Atomic Commits**: We build one module (e.g., Merchant Stats), perfect it, and then move to the next.
