# Admin Dashboard Design System

> Single source of truth for drawers, dialogs, headers, and forms in `apps/admin-web`.
> Last updated 2026-06-04 during the cross-module UI alignment.

## TL;DR — if you're touching a drawer or dialog

1. Brand red `#B52725` is the ONLY brand color. No emerald/teal/indigo/fuchsia/cyan/pink accents.
2. No decorative gradients. Solid colors only. No `bg-gradient-to-*` anywhere except as explicitly allowed below.
3. No `rounded-2xl` / `rounded-3xl`. Cards use `rounded-lg`, buttons + inputs use `rounded-md`, hero icon blocks use `rounded-xl`.
4. Form focus rings + checked checkboxes use brand red — `focus:ring-[#B52725]`, `focus:border-[#B52725]`, `data-[state=checked]:bg-[#B52725]`.
5. Semantic status colors: **emerald = success / allowed / active**, **rose / red = blocked / cancelled**, **amber = pending / warn**, **gray = informational / inactive**, **violet = REFUNDED only**. Never use these as decorative accents.
6. Admin reads go through the API (`api.get('/admin/...')`), NOT `supabase.from(...)`. See `forlater.md` for the architectural rule.

## 1. Header pattern

Every drawer / dialog header follows this shape:

```tsx
<div className="flex items-start gap-4">
  {/* Solid brand-red icon block */}
  <div className="w-14 h-14 rounded-xl bg-[#B52725] flex items-center justify-center shadow-sm shrink-0">
    <SomeIcon className="w-7 h-7 text-white" />
  </div>
  <div className="flex-1 min-w-0">
    <h2 className="text-xl font-bold text-gray-900 truncate">{title}</h2>
    <div className="flex items-center gap-2 mt-1 flex-wrap">
      {/* Status badges, ID, secondary metadata */}
    </div>
  </div>
</div>
```

- Icon block: solid `bg-[#B52725]`, `rounded-xl`. **No gradient.** **No hover transform.** Subtle `shadow-sm`.
- Title: `text-xl font-bold text-gray-900`. Truncate on overflow.
- Secondary line: muted gray-500, smaller (text-sm).

## 2. Tabs

```tsx
<Tabs defaultValue="overview">
  <TabsList className="mb-6">
    <TabsTrigger value="overview" className="gap-1.5">
      <Clock className="w-4 h-4" />
      Overview
    </TabsTrigger>
    <TabsTrigger value="orders" className="gap-1.5">
      <Package className="w-4 h-4" />
      Orders ({count})
    </TabsTrigger>
  </TabsList>
  <TabsContent value="overview">...</TabsContent>
</Tabs>
```

- Use the default shadcn `TabsList`. Don't override its active-state colors.
- Active tab is shadcn's default underline + text-foreground. Do not paint it brand red.
- Icon + label + optional `(count)`.

## 3. Section cards

```tsx
<div className="bg-white border border-gray-100 rounded-lg p-5">
  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
    <SomeIcon className="w-4 h-4 text-[#B52725]" />
    Section Title
  </h3>
  {/* content */}
</div>
```

- `bg-white border border-gray-100 rounded-lg p-5` — that's it.
- No hover color shift. Use `hover:shadow-sm transition-shadow` if interactive.
- Section title uses a small brand-red icon for the "this is a section header" cue.
- **No** decorative orbs (`bg-emerald-100/30 ... blur-2xl`), no gradient backgrounds.

## 4. Form fields

```tsx
<div>
  <Label htmlFor="x" className="text-xs uppercase tracking-wide font-semibold text-gray-600">
    Field Name
  </Label>
  <Input
    id="x"
    value={...}
    onChange={...}
    className="mt-1 focus:ring-[#B52725] focus:border-[#B52725]"
  />
  <p className="text-[11px] text-gray-500 mt-1">Optional helper text</p>
</div>
```

- Focus ring: brand red. Not blue.
- Checkbox checked: `data-[state=checked]:bg-[#B52725] data-[state=checked]:border-[#B52725]`.
- Use standard shadcn `Input`, `Textarea`, `Select`.

## 5. Loading

```tsx
<div className="text-center py-8 text-gray-500">
  <div className="inline-flex items-center gap-2">
    <div className="w-4 h-4 border-2 border-[#B52725] border-t-transparent rounded-full animate-spin" />
    Loading {what}…
  </div>
</div>
```

- Brand red spinner. Always.
- Centered text with the spinner inline.
- Don't use ActivityIndicator or any colored alternative.

## 6. Empty states

```tsx
<div className="text-center py-10 text-sm text-gray-500">
  No {thing} yet.
</div>
```

- Centered, muted.
- Optional small icon in gray-300 above the text.
- **No** dashed boxes, no `rounded-2xl` containers, no large illustrations.

## 7. Status badges

Use semantic colors only. Map:

| State | Classes |
|---|---|
| Active / allowed / completed | `bg-emerald-50 text-emerald-700 border-emerald-200` |
| Pending / awaiting / preparing | `bg-amber-50 text-amber-700 border-amber-200` |
| Cancelled / blocked / suspended | `bg-rose-50 text-rose-700 border-rose-200` |
| Refunded (specific) | `bg-violet-50 text-violet-700 border-violet-200` |
| Neutral / informational | `bg-gray-100 text-gray-700 border-gray-200` |
| Brand emphasis (rare) | `bg-[#B52725]/10 text-[#B52725] border-[#B52725]/30` |

Brand red as a badge color is ONLY for emphasized brand chips (e.g. "Super Admin", "Default Address"). Never for cancelled / failed states.

## 8. Footer actions

```tsx
<div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
  <Button variant="outline" onClick={onCancel}>Cancel</Button>
  <Button onClick={onSave} className="bg-[#B52725] hover:bg-[#9a1f1d] text-white">
    Save
  </Button>
</div>
```

- Right-aligned.
- Cancel = `variant="outline"` (gray bordered).
- Primary = brand-red filled.
- Destructive = `variant="destructive"` (rose-700).
- No "Force" or "Approve" verbs in muted green or amber buttons — pick brand red for affirmative, destructive variant for irreversible.

## 9. Border radii (strict)

| Element | Radius |
|---|---|
| Buttons, inputs, badges | `rounded-md` (6px) |
| Section cards, list rows | `rounded-lg` (8px) |
| Hero icon block (header) | `rounded-xl` (12px) |
| ❌ `rounded-2xl` | Never |
| ❌ `rounded-3xl` | Never |

## 10. Colors — forbidden outside the semantic ladder

These classes should NEVER appear in admin-web unless they're part of the semantic ladder above:

- `emerald-*` for decoration (only for success status)
- `teal-*`, `cyan-*`, `sky-*` — never
- `indigo-*`, `violet-*` — only `violet-*` for REFUNDED status
- `fuchsia-*`, `pink-*` — never
- `blue-*` — never as decoration; standard semantic blue allowed for informational chips like CONFIRMED
- Any `bg-gradient-to-*` — never

If a designer or AI suggests a gradient or off-brand accent, push back. The dashboard has one brand color.

## 11. Architectural reminder: admin reads

For any new drawer / dialog that needs data:

- Use `api.get('/admin/...')` via `apps/admin-web/src/lib/api.ts`. The endpoint should exist on the API side gated by `requireRole(ANY_ADMIN_TIER)` (or stricter).
- Do NOT use `supabase.from(...)` for production data — RLS blocks admin reads at the JWT layer and schema-cache surprises will bite.
- See `forlater.md` for the architectural rule (added 2026-06-03).

## 12. When you touch a `// @lock` file

Stop. Read the lock comment. Ask the user. Even if your edit "doesn't touch the layout", the rule is: every edit to a locked file needs chat-confirmed permission. See `CLAUDE.md`.

---

## Migration log (for context)

| Date | Module | What changed |
|---|---|---|
| 2026-06-03 | Customers | CustomerDetailsSheet + CustomerDatabase rebuilt to this system |
| 2026-06-03 | Orders | OrderManager rebuilt to this system |
| 2026-06-04 | Merchants | MerchantDetailsSheet + AddMerchantSheet + EditMerchantDialog + ExportMerchantsDialog + MerchantReportDialog + MerchantInventoryModal aligned |
| 2026-06-04 | Engagement | AdManager aligned |
| 2026-06-04 | Catalog | LiveImportModal + MasterCatalog dialogs aligned |
| 2026-06-04 | Analytics | AnalyticsHub already aligned (2026-06-03) |
| 2026-06-04 | (this doc) | Pattern codified to prevent drift |
