# Pick At Store (Pas) - Project Manifesto

## 1. Project Overview
**Pick At Store** is a hyperlocal commerce platform connecting Consumers with local Merchants. The system enables consumers to browse city-specific store inventories, place orders, and track them, while providing merchants and admins with powerful tools to manage catalogs, inventory, and order fulfillment.

**Current Status**: **Phase 1 Complete** (Infrastructure Ready).
**Development Methodology**: "Agentic-Co-Founder" Model (User + Technical Co-founder + Google Antigravity).

### Recent Progress (Phase 1)
- [x] **Monorepo Init**: Workspace configured with `apps/api` and `packages/shared`.
- [x] **API Backbone**: Node.js/Express server is live with Socket.io.
- [x] **Database**: Connected to Supabase PostgreSQL (Transaction Mode).
- [x] **Schema**: Defined `City`, `Store`, `Product`, `User`, `Order`.
- [x] **Seeding**: Initial data (Chennai City, Admin User, Test Store) populated.

---

## 2. Architecture: "The Full-Stack Monorepo"
We have rejected the "Web Wrapper" and "Serverless-Only" approaches in favor of a robust, industry-standard architecture that supports true native performance and real-time operations.

### Structure
The project lives in a **Monorepo** to ensure code reuse (Shared Types) and consistent tooling.

| Component | Technology | Path | Description |
| :--- | :--- | :--- | :--- |
| **Backend API** | Node.js + Express + TypeScript | `apps/api` | The Central Brain. REST API + Socket.io Server. |
| **Database** | PostgreSQL + Prisma ORM | - | Source of Truth. No SQLite/In-Memory. |
| **Consumer App** | React Native (Expo) | `apps/consumer-mobile` | **Native Binary**. Browsing, Cart, Checkout. |
| **Merchant App** | React Native (Expo) | `apps/merchant-mobile` | **Native Binary**. Real-time Order Alerts, Fulfillment. |
| **Admin Dashboard** | React (Vite) | `apps/admin-web` | Super-Admin web panel. Master Catalog, User Mgmt. |
| **Merchant Panel** | React (Vite) | `apps/merchant-web` | Store Manager web panel. Analytics, Inventory. |
| **Shared** | TypeScript | `packages/shared` | Zod Schemas, TS Interfaces, Constants. |

---

## 3. Workflow Strategy: "Figma-to-Git"
To guarantee pixel-perfect fidelity to the Client-Approved Designs, we serve a strict workflow:

1.  **Design Approval**: Client approves UI in Figma.
2.  **Code Export**: Design team exports/converts Figma screens to React/React Native code.
3.  **Git Push**: This code is pushed to specific GitHub repositories (e.g., `simulated-consumer-ui`).
4.  **Integration**: Antigravity (AI) clones these repos and refactors the "dumb" UI components into the Main Monorepo, connecting them to the Logic/API.

> **Constraint**: We DO NOT build UI from scratch. We refactor imported UI.

---

## 4. Technical Specifications & Constraints

### A. Database (PostgreSQL)
*   **Hosting**: Cloud (Supabase/Neon) preferred over Local Docker for ease of maintenance.
*   **Critical Schema Entities**:
    *   **City / ServiceArea**: Mandatory for the "Hyperlocal" discovery model. Stores must belong to a City.
    *   **Store**: Linked to City.
    *   **Products**: Gloabl Master Catalog vs Store-Specific Inventory.
    *   **Orders**: Transactional data.

### B. Real-Time Layer (Socket.io)
*   **Why**: Merchants cannot hit "Refresh". Orders must "ring" instantly.
*   **Implementation**: `apps/api` hosts the Socket server. Merchant App listens on `store_{id}` channel.

### C. Authentication & Security
*   **Strategy**: Custom JWT Middleware in Express.
*   **Roles**: `SUPER_ADMIN`, `MERCHANT`, `CONSUMER`.
*   **Authorization**: Middleware must strictly enforce role access (e.g., Consumers cannot hit `/admin/*` endpoints).

### D. File Storage
*   **Strategy**: Object Storage (S3-compatible).
*   **Constraint**: No local file storage. Images must be uploaded to the cloud and URLs stored in the DB.

---

## 5. Development Phases

#### Phase 1: The Backbone (Completed)
*   [x] Setup Monorepo Workspace.
*   [x] Initialize PostgreSQL + Prisma.
*   [x] Implement Express API with Auth & Socket.io.
*   **Deliverable**: Healthy API returning JSON data (verified).

#### Phase 2: The "God" View (Admin) - **NEXT**
*   **Pending**: User to provide SRS and Admin UI Git Link.
*   Integrate Admin UI (from Git).
*   Connect to API for Master Catalog Management.
*   **Deliverable**: Admin can create Products and Stores.

#### Phase 3: The Consumer Experience
*   Integrate Consumer UI (from Git).
*   Implement "Stores Near Me" (City logic) and Checkout.
*   **Deliverable**: Consumer can place an order.

#### Phase 4: The Loop Closer (Merchant)
*   Integrate Merchant UI (from Git).
*   Connect Real-time Sockets.
*   **Deliverable**: Merchant gets "Ping" when Consumer buys.

---

## 6. How to Run (Local Dev)
1.  **Install Dependencies**:
    ```bash
    npm install
    ```
2.  **Setup Database**:
    Ensure `apps/api/.env` has the correct `DATABASE_URL` (Supabase Transaction Mode).
    ```bash
    cd apps/api && npx prisma db push
    ```
3.  **Seed Data**:
    ```bash
    cd apps/api && npx prisma db seed
    ```
4.  **Start API**:
    ```bash
    cd apps/api && npm run dev
    ```
    API will run at `http://localhost:3000`.

---
*Generated by Antigravity based on Technical Co-founder Review + User Requirements.*