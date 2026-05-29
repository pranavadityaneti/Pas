# Admin Dashboard — Feature Gap Analysis & Roadmap

**Date:** May 29, 2026
**Audience:** Founders, product & ops leadership
**Purpose:** Where the Admin Dashboard is today, what we're building next, why each matters, and what we recommend adding.

---

## 1. Executive summary

The Admin Dashboard (`admin-web`) today is an **operations console**: the ops team logs in (now via WhatsApp OTP, allowlist-gated), approves merchants, manages the master catalog, and monitors orders. It is functional but **governance- and growth-light** — it lacks the analytics, money-operations, marketing levers, and granular access control that a scaling marketplace needs.

This document frames the next phase as **eight committed workstreams** plus **a set of recommended additions** that close the remaining gaps. Read together, they turn the dashboard from a "merchant-approval + catalog tool" into the **single control plane** for the entire PAS business — revenue, supply (merchants + catalog), demand (customers + marketing), and support.

**The eight committed workstreams**

| # | Workstream | One-line outcome |
|---|---|---|
| 1 | Wati + Razorpay integration | Run support and money operations from the console |
| 2 | RBAC overhaul | Least-privilege roles + audit trail for a growing team |
| 3 | Dynamic super-analytics | Real-time GMV/orders/funnel visibility & drill-down |
| 4 | Inventory management dashboard | Govern the master catalog at scale |
| 5 | 2-lakh product upload (in progress) | Pre-loaded catalog so merchants onboard fast |
| 6 | Coupon management | Promotions & growth levers |
| 7 | Marketing management | Campaigns across push/WhatsApp/email |
| 8 | Banner management | Merchandise the customer app without app releases |

---

## 2. Current state (baseline)

What the dashboard does **today**:

- **Auth:** WhatsApp OTP login (primary) + email/password fallback, gated to an allowlist of authorized admins (durable `isAdmin` flag + `admin_allowlist`). Login screen just redesigned (frosted brand UI).
- **Merchant operations:** approve merchants, view merchant/branch records.
- **Master catalog:** manage Products / StoreProducts (the shared catalog merchants attach items from).
- **Order monitoring:** visibility into orders across the platform.

What it **lacks** (the gaps this roadmap closes): analytics, payments/refunds/payout visibility, support tooling, granular roles + audit, coupon/marketing/banner control, and a scalable catalog console.

---

## 3. Committed workstreams (detail)

### 3.1 Wati + Razorpay integration

**Context.** Wati (WhatsApp) already powers OTP login and transactional status messages; Razorpay already processes merchant subscriptions and customer order payments. Neither is **surfaced in the admin console** today.

**Gap.** The ops team can't see or act on money or support conversations from one place — refunds, stranded payments, payout reconciliation, and customer/merchant WhatsApp queries all happen outside the dashboard.

**What we build.**
- **Razorpay operations:** a transaction ledger (subscriptions + order payments), refund initiation (Razorpay refund API), payout/settlement reconciliation per merchant, failed/stranded-payment recovery, and subscription status per merchant.
- **Wati support console:** an inbox/ticket queue fed by customer & merchant WhatsApp messages, template management, broadcast/status messaging, and escalation routing.

**Value.** Faster dispute and refund resolution, full revenue visibility, and support handled in-console instead of across tools.

**Dependencies.** Razorpay API keys + webhooks; Wati API + templates; the `subscription`/payments tables already exist.

---

### 3.2 RBAC overhaul

**Context.** Access today is binary — you're an allowlisted admin or you're not (single super-admin concept). The merchant app already has role-based permissions (owner vs branch manager via a permission matrix).

**Gap.** No granular admin roles for a growing ops team (a support agent shouldn't issue refunds; a catalog editor shouldn't manage admins), and **no audit trail** of who did what.

**What we build.**
- **Admin roles:** Super Admin, Operations, Finance, Catalog/Content, Support, Read-only — each mapped to a granular permission matrix per module.
- **In-app admin management:** add/remove admins and assign roles by phone (extends the current allowlist).
- **Audit log:** every privileged action (approvals, refunds, catalog edits, role changes) recorded with actor, timestamp, and target.
- **Merchant-side cleanup:** finalize owner vs branch-manager permission boundaries already in the app.

**Value.** Least-privilege security, accountability/compliance, and safe delegation as the team scales.

**Dependencies.** Pairs tightly with the audit log; should land before broad team access is granted.

---

### 3.3 Dynamic super-analytics dashboard

**Context.** Current admin metrics are limited/static.

**Gap.** No real-time, drill-down view of business health — founders and ops fly blind between exports.

**What we build.** A real-time analytics surface:
- **Revenue & orders:** GMV, order volume, AOV, take-rate/commission, payment success rate.
- **Supply:** active/approved merchants, new merchant signups, catalog size, category/vertical performance.
- **Demand & funnel:** active customers, new signups, browse → cart → order → pickup conversion, retention/cohorts.
- **Geo:** city/zone performance and heatmaps.
- **Live ops:** orders in flight, SLA/prep-time breaches, stranded requests.
- **Controls:** configurable date ranges, filters, drill-downs, and exports. "Dynamic" = real-time (Supabase realtime + scheduled rollups), not a static snapshot.

**Value.** Data-driven decisions, investor-grade metrics, and proactive ops monitoring.

**Dependencies.** Aggregation/rollup jobs; may need read replicas or materialized views at scale.

---

### 3.4 Comprehensive inventory management dashboard

**Context.** A master catalog exists; merchants attach items from it. Admin catalog tooling is thin.

**Gap.** No scalable console to govern a large master catalog — taxonomy, bulk operations, moderation, and the attributes that drive discovery and merchant gating.

**What we build.**
- **Master catalog CRUD** with search, dedupe, and bulk import/export.
- **Taxonomy management:** categories, subcategories, verticals, brands, dietary tags — and the `isDining` / service-mode attributes that drive the customer-app gating and merchant UI.
- **Image management** and product approval/moderation.
- **Attribute/variant management** and MRP/pricing governance.
- **Vertical mapping** so products surface correctly per store type.

**Value.** A clean, scalable catalog that powers discovery and lets merchants attach products in seconds instead of creating them from scratch — directly reducing onboarding friction.

**Dependencies.** Underpins the 2-lakh upload (below) and the merchant product-add flow.

---

### 3.5 2-lakh (200,000) product upload — **in progress**

**Status.** Bulk ingestion of ~**2 lakh SKUs** into the master catalog is **underway**. The current step is **image compression/optimization** (the pipeline bottleneck): data ingestion → image compression → storage/CDN → catalog load → QA.

**Gap it closes.** A pre-populated catalog so merchants don't build listings by hand — the single biggest lever on onboarding speed and catalog quality.

**Remaining work.** Finish image compression → load into the catalog → QA/dedupe → expose via the inventory dashboard (3.4).

**Value.** Rich, ready catalog at launch scale; faster merchant activation; consistent product data across stores.

---

### 3.6 Coupon management

**Gap.** No way to create or govern promotions.

**What we build.** A coupon engine + admin UI:
- **Types:** flat, percentage, free-pickup/delivery, first-order, category/store-specific, minimum-cart.
- **Controls:** usage limits (global + per-user), validity windows, stacking rules, budget caps, enable/disable.
- **Targeting:** city, vertical, merchant, customer segment.
- **Analytics:** redemption, spend, and ROI per coupon.
- **Integration:** customer-app checkout + Razorpay.

**Value.** Acquisition, retention, and merchant co-marketing levers — with spend control.

---

### 3.7 Marketing management

**Gap.** No campaign tooling; outreach is manual.

**What we build.** A campaign console:
- **Channels:** push notifications, WhatsApp (via Wati), email.
- **Audiences:** segmentation across customers & merchants (by city, vertical, behavior, recency).
- **Execution:** scheduling, templates, A/B testing, performance tracking.
- **Campaigns:** ties into the "Local Stores & Their Stories" social movement (Meta Graph integration) and promotes coupons/banners.

**Value.** Engagement, re-activation, and merchant acquisition at scale — measurable.

**Dependencies.** Overlaps with coupons (3.6) and banners (3.8); shares Wati + push infrastructure.

---

### 3.8 Banner management (customer-app banners from admin)

**Gap.** Home/discovery banners in the customer app are not admin-controllable; changing them needs an app release.

**What we build.** A server-driven banner CMS:
- Upload creatives; set **ordering**, **scheduling**, and **targeting** (city/vertical/segment).
- **Deep-links** to a store, category, or coupon.
- Enable/disable instantly — **no app release** required.

**Value.** Real merchandising control, instant promotion of campaigns/coupons, and a path to monetization (sponsored placements).

**Dependencies.** A banners table + a customer-app endpoint that reads it (server-driven config).

---

## 4. Recommended additions (gaps to consider)

These weren't in the brief but are natural, high-value companions. Grouped by theme:

**Governance & trust**
- **Audit log & activity trail** — already noted under RBAC; calling it out as a first-class feature (compliance + accountability).
- **Feature flags / config management** — toggle features (e.g., the dining gating, reschedule, table-booking) per environment **without a deploy**.
- **System health & job monitoring** — API/cron status, failed background jobs (e.g., the order-request expiry job), notification delivery, and live app/version visibility.

**Supply (merchants + catalog)**
- **Merchant lifecycle & KYC review queue** — approval/rejection **with reasons**, document viewer, re-verification, suspension/reactivation, and a clear `draft → pending → active` pipeline. *(Directly related to the access-gating work we just shipped — unpaid/draft stores are now blocked, and this gives ops the queue to move them forward.)*
- **Catalog taxonomy & vertical management** — surfaced under 3.4; flagging that vertical/`isDining` config drives both merchant UI and customer discovery.
- **Reviews & ratings moderation.**

**Demand (customers)**
- **Customer/user management & support console** — user lookup, order history, refunds, flag/ban, issue handling (feeds from the Wati queue).
- **Onboarding funnel analytics** — signup drop-off by step, for both merchants and customers (newly relevant after the signup draft-resume fixes).

**Money & operations**
- **Order, refund & dispute resolution queue** — stranded payments, WhatsApp-escalated complaints, refunds, return/exchange approvals in one workflow.
- **Payout & settlement / commission management** — merchant payouts, configurable take-rate/commission, settlement statements, Razorpay reconciliation.
- **Serviceability / geo configuration** — manage cities, zones, and the discovery radius (the nearby-stores search), and launch new areas. *(Related to the store-visibility work.)*
- **Reporting & financial exports** — GST, settlement, and sales reports, downloadable.

**Risk**
- **Fraud / risk signals** — duplicate accounts, suspicious order patterns, velocity checks.

---

## 5. Suggested phasing

A pragmatic sequence (governance first, then visibility, then growth):

| Phase | Focus | Items |
|---|---|---|
| **P1 — Foundation** | Control & trust | RBAC overhaul + Audit log; System health/monitoring; Merchant KYC/lifecycle queue |
| **P2 — Money & catalog** | Operate the business | Razorpay ops + refunds/payouts; Inventory dashboard + finish 2-lakh upload; Order/dispute queue |
| **P3 — Visibility** | See everything | Dynamic analytics; onboarding funnel; reporting/exports |
| **P4 — Growth** | Drive demand | Coupons; Marketing campaigns; Banner CMS; Wati support console |

(Sequence is a recommendation, not a constraint — coupons/banners can pull forward if a campaign demands it.)

---

## 6. Dependencies & risks

- **Razorpay & Wati API access** (keys, webhooks, templates) gate workstreams 1, 6, 7.
- **RBAC + audit should precede broad team access** — don't hand out logins to a console that can issue refunds without roles in place.
- **2-lakh upload** is bottlenecked on image compression; downstream (inventory dashboard, merchant attach flow) depends on it completing + QA.
- **Analytics at scale** may need materialized views / rollup jobs to avoid loading the primary DB.
- **Banner & feature-flag systems** must be **server-driven** so changes don't require app-store releases.

---

*Prepared for the founders' review. Each workstream can expand into its own spec + implementation plan.*
