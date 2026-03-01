# PickAtStore Merchant App - Master TODO List

This document tracks upcoming features, structural migrations, and feature scaling tasks that must be addressed to move the application away from hardcoded initial logic.

## 1. Catalog & Inventory Management
- [ ] **Dynamic Variant Ratios:** The `ConfigureProductsModal.tsx` currently uses hardcoded mock ratios (e.g. 0.3 for 250ml, 1.0 for 1L) to calculate the default pricing for product variants. This needs to be migrated to a backend-driven API or dynamic Admin calculation based on the true baseline MRP fetched from the master product catalog.
- [ ] **Variant Sku System:** Implement a true SKU tracking system for sub-variants instead of just loose text labels.

## 2. Profile & Authentication
- [ ] **Real SMS/OTP Gateway:** The `profile.tsx` is currently set up to directly save new phone numbers immediately. Before launch, integrate a real SMS gateway (e.g., Twilio / MSG91) and restore the OTP verification modal to ensure users actually own the new phone numbers they input.

## 3. Order Processing
- [ ] **Push Notifications Integration:** Connect Expo Push Tokens to the backend so the real-time order generation triggers native iOS/Android push notifications, instead of just relying on the Supabase Realtime open websocket subscription.
- [ ] **Print Receipt Integration:** Implement the physical Bluetooth thermal printing integration inside `app/(main)/orders.tsx`.
