# 🛡️ PROJECT GUIDELINES — Pick At Store (PAS) Monorepo

> **Purpose**: This document defines the rules that ALL development agents (AI or human) must follow  
> to prevent accidental overwrites, regressions, and loss of implemented work.  
> **Created**: February 27, 2026  
> **Last Updated**: February 27, 2026

---

## ⚠️ CRITICAL RULES

### Rule 1: Never Overwrite Locked Files
Any file marked with the `// @lock` comment at the top, or listed as 🔒 LOCKED in `FEATURE_REGISTRY.md`, **must not have its core layout, structure, or styling altered** without explicit user approval.

**Allowed on locked files:**
- Bug fixes (e.g., adding a null check, fixing a navigation error)
- Additive enhancements (e.g., adding a new prop, wiring up an event handler)
- Import additions for new features

**Forbidden on locked files:**
- Changing the component's JSX layout/structure
- Replacing or removing existing UI elements
- Changing styling classes or inline styles
- Refactoring the file's architecture

### Rule 2: Check the Feature Registry Before Every Edit
Before modifying **any** existing file, consult `FEATURE_REGISTRY.md` to determine its lock status:
- 🔒 **LOCKED** — Do NOT modify layout/structure. Bug fixes only.
- 🟡 **IN PROGRESS** — Active development. Coordinate with the user.
- 🟢 **OPEN** — Safe to modify freely.
- 📋 **PLANNED** — Not yet implemented. Safe to create.

### Rule 3: Prefer Additive Changes Over Rewrites
When implementing a new feature:
1. **Create new files** for new screens, components, or modules.
2. **Add imports and routes** to existing navigators/routers (additive).
3. **Never replace** an existing screen's content with a new feature's content.

### Rule 4: One Screen = One File = One Responsibility
Each screen file owns its own layout. Do NOT merge multiple screens into one file or render a different screen's content inside another screen's file.

### Rule 5: Preserve the Home Screen
The Home Screen (`HomeScreen.tsx`) is a critical entry point. It must always display:
- 2-column Pickup & Dining cards
- Featured hero card
- Sticky header with location and profile icon

Any changes to the Home Screen require **explicit approval**.

### Rule 6: Always Add `@lock` to Newly Completed Work
When a screen or component is completed and approved by the user, immediately:
1. Add `// @lock — Do NOT overwrite. Approved layout as of [DATE].` to the top of the file.
2. Update `FEATURE_REGISTRY.md` to mark the file as 🔒 LOCKED.

### Rule 7: Test Before and After
Before modifying any file:
1. Note the current working state of the app.
2. After changes, verify the app still renders correctly.
3. If an existing screen breaks, **revert immediately**.

---

## 📂 Project Structure Reference

```
Pas/
├── apps/
│   ├── consumer-app/      # React Native (Expo) — Customer-facing mobile app
│   ├── merchant-app/       # React Native (Expo) — Merchant-facing mobile app
│   ├── merchant-web/       # Capacitor + React — Merchant web/hybrid app
│   ├── admin-web/          # React — Super admin dashboard
│   ├── consumer-web-legacy/ # React — Consumer web app (legacy)
│   ├── landing-page/       # Next.js — Public marketing site
│   └── api/                # Express.js — Backend API server
├── packages/               # Shared packages
├── PROJECT_GUIDELINES.md   # ← THIS FILE (development rules)
└── FEATURE_REGISTRY.md     # ← Feature manifest with lock statuses
```

---

## 🔄 Workflow for Making Changes

```
1. User requests a change
         │
         ▼
2. Check FEATURE_REGISTRY.md
   ├── 🔒 LOCKED? → Only bug fixes. Ask user before layout changes.
   ├── 🟡 IN PROGRESS? → Coordinate with user.
   └── 🟢 OPEN / 📋 PLANNED? → Proceed freely.
         │
         ▼
3. Check for // @lock comment in target file
   ├── Present? → Treat as LOCKED.
   └── Absent? → Proceed, but verify registry.
         │
         ▼
4. Implement changes (prefer additive)
         │
         ▼
5. After approval, add @lock + update registry
```

---

**This document is the source of truth. Follow it strictly.**
