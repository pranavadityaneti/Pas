# Coupon UI Components

_Started 2026-05-29 09:28 UTC_

---

## User

To add coupon's page to a customer facing app, I want to create a UI for coupon that can be shown in admin dashboard while creating a coupons, and the customer in the customer app for the user to interact with and use the coupon. 

Use the attached reference

## Assistant

_[tool: view_image]_

Let me look at the reference image you attached.

_[tool: list_files]_

Let me check what's already in the project.

_[tool: questions_v2]_

Great reference — that's a classic ticket-style coupon (orange tab + cream body, perforated edge, dashed dividers). Before I build, I want to nail down a few things so this lands right. You're asking for **two surfaces**: an **admin coupon builder** and a **customer-facing coupon** they can redeem. Let me ask about context and scope.

## User

Questions answered:
- design_context: No existing system — match the look of the reference coupon
- visual_direction: Same ticket shape, but use my brand colors (tell me below)
- coupon_types: Fixed amount off ($50.00), Percentage off (20%), Buy one get one (BOGO)
- admin_scope: Live coupon preview as you type, Discount type & value fields, Validity dates, Redeem code (auto-generate + manual), Usage limits / per-customer caps, Logo upload, Min. order / eligibility rules
- customer_states: Available / claimable (Apply button)
- platform: Both
- deliverable: Interactive prototype — both surfaces clickable & wired together
- variations: Coupon card visual style, Admin builder layout
- tweaks: Accent color, Discount type & value, Show/hide logo, Coupon shape / perforation style, Corner radius & density
- brand_colors: Brand red is canonical #b42926

## Assistant

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

_[tool: copy_starter_component]_

Got it — here's my read on the brief:

- **No existing system**; match the reference ticket but swap orange → your brand red **#b42926**, keep the cream body.
- **One interactive prototype** wiring two surfaces: an **Admin builder** (live preview, type/value, dates, auto/manual code, usage caps, min-order rules, logo upload) and a **Customer** view (web + mobile, claimable with Apply + copy-code).
- Discount types: **Fixed $**, **% off**, **BOGO**.
- Variations for **card visual style** and **admin builder layout**, plus **Tweaks** for accent color, type/value, logo, shape/perforation, radius/density.

Let me set up the scaffolding.

_[tool: read_file]_

Let me read the starters so I use their APIs correctly.

_[tool: update_todos]_

This is a meaty interactive build. Let me lay out a plan and start constructing the system.

_[tool: write_file]_

Starting with the heart of the system — the `CouponCard`. This is the shared component the admin previews and the customer interacts with.

_[tool: write_file]_

Now the admin builder — form with live preview, two layouts.

_[tool: str_replace_edit]_

Let me fix a typo in the admin CSS.

_[tool: write_file]_

Now the customer-facing view — web wallet + mobile, with claim/apply/copy interactions.

_[tool: write_file]_

Now the app shell that wires it together, plus the Tweaks panel.Now the HTML host that ties it all together.

_[tool: write_file]_

Let me check it loads cleanly.

_[tool: show_html]_

_[tool: show_html]_

_[tool: get_webview_logs]_

No errors. Let me screenshot the admin builder, then the customer surfaces.

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

Excellent — that's a strong match to the reference. The "Valid through" pill is wrapping awkwardly at the narrower preview width. Let me check the customer surfaces before fixing.

_[tool: view_image]_

_[tool: str_replace_edit]_

Customer web looks great. The only nag is the "Valid through" pill wrapping to three lines and spilling its box. Let me fix that with a compact date + no-wrap, then check mobile.Now let me check mobile and the other card styles/shapes via the tweaks.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

Mobile reads well. Let me reload to confirm the pill fix and spot-check the alternate card styles/shapes (notched masking is the riskiest). I'll temporarily flip the defaults.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

Bold + notched works (nice side notches, cream-on-red). The mobile card is just too narrow — the code and pill clip. Let me widen the mobile coupon, then check modern + plain on web.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

All three card styles and shapes render correctly. The pill fix is clean. Let me revert defaults to the classic ticket and do a final pass.

_[tool: update_todos]_

Let me confirm the Tweaks panel opens and BOGO renders. I'll reload, open tweaks, and switch to admin to see BOGO via the panel.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

Tweaks panel is fully wired. Let me confirm BOGO renders via the admin form (normal click).

_[tool: view_image]_

_[tool: show_html]_

BOGO renders correctly ("Buy 1, get 1 free", form switches to Buy/Get fields). That last capture looked like it caught a mid-reflow as the panel closed — let me take one clean baseline shot to be sure the preview isn't clipping.

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: show_to_user]_

The redeem code looks clipped at the preview's right edge. Let me measure the real DOM to see whether it's an actual overflow or just a capture artifact.

_[tool: eval_js_user_view]_

_[tool: str_replace_edit]_

Confirmed — it's a real overflow: at this viewport the split-preview card (460px) is slightly wider than its column, so the code clips. Let me tighten the card's internal gaps and size the preview to fit its column.

_[tool: str_replace_edit]_

Now let me verify the fix with a real measurement.

_[tool: show_to_user]_

_[tool: eval_js_user_view]_

_[tool: snip]_

_[tool: done]_

Fits cleanly now (24px margin). Let me clear resolved iteration noise and hand off.

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

Done — here's what I built, all in one interactive prototype (**Coupons.html**):

**Two surfaces, one shared coupon**
- **Admin builder** — live preview that updates as you type: discount type (Fixed $ / % off / BOGO), value, tab label, brand, description, validity dates, redeem code (manual + auto-generate + auto-unique toggle), usage/per-customer limits, min order, eligibility, and logo upload. Publish/Save-draft give toast feedback.
- **Customer app** — toggle **Web** (a "Your coupon is ready" rewards page with more-offers rail) and **Mobile** (iPhone frame, Rewards screen). Both have the **Apply coupon** flow that reveals + copies the code.

**The coupon card** matches your reference (vertical COUPON tab, dotted dividers, perforated edge, redeem code) but in your brand red `#b42926` on cream.

**Variations + Tweaks** (toggle Tweaks in the toolbar): accent color, discount type/value, **3 card styles** (Classic / Modern / Bold), **3 shapes** (Ticket / Notched / Plain), corner radius, density, show-logo, and **admin layout** (Split / Stacked).

A couple of notes:
- On **mobile**, the wide ticket shape renders small by nature — the readable code lives in the Apply action bar below it. If you'd rather have a taller, mobile-native coupon layout, I can add that as a shape variant.
- Logo uploads preview live but aren't persisted across reloads (kept out of the saved settings to avoid bloat).

Want me to add more customer states (expired / already-used / locked) or a coupons **list/management** view for the admin side?

## User

- The amount has to be in rupees. 
- When No Redeem code is added, remove the text "Redeem Code"
- In validity, add another option to show, until cancelled.

## Assistant

_[tool: str_replace_edit]_

Good, clear changes. Let me make them — rupees everywhere, hide the code label when empty, and an "until cancelled" validity option.Now the pill text (until cancelled) and conditional code block in the card:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the admin builder — rupee prefixes and the "until cancelled" validity toggle:

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the customer view — terms line for "until cancelled", and the apply flow when there's no code:

_[tool: str_replace_edit]_

Let me verify the changes render correctly — check rupees, the no-code state, and until-cancelled.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: str_replace_edit]_

Rupees and the "until cancelled" toggle work. But the bottom row (pill + code) is overlapping again at the narrower preview width — the no-wrap pill is bleeding into the code. Let me make that row wrap gracefully instead of colliding.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: view_image]_

_[tool: save_screenshot]_

The bottom row now wraps cleanly — code drops to its own right-aligned line, no collision. Let me verify the no-code and until-cancelled states by editing the form programmatically.

_[tool: view_image]_

_[tool: show_to_user]_

Both states work — code label disappears, "Valid until cancelled" shows and the date field greys out. Let me confirm the card width and pill aren't actually clipping (capture can be misleading) with a real measurement.

_[tool: eval_js_user_view]_

_[tool: eval_js_user_view]_

_[tool: eval_js_user_view]_

_[tool: eval_js_user_view]_

_[tool: snip]_

_[tool: done]_

All verified in the real DOM: card stays 430px wide (the screenshot narrowness was just a capture artifact), the pill isn't clipped, and "REDEEM CODE" is gone when there's no code. All three changes are working.All three changes are in:

1. **Rupees** — the coupon value, minimum order, the admin amount field (₹ prefix), and the customer terms line now use ₹ with Indian number grouping (lakh/crore style).
2. **No code → no label** — clearing the redeem code hides both the "REDEEM CODE" label and the code on the coupon. The customer apply flow adapts too ("Applied — discount added automatically, no code needed").
3. **Until cancelled** — a "No end date — valid until cancelled" toggle in the Validity section. When on, the end-date field greys out, the coupon pill reads "Valid until cancelled," and the customer terms show "No expiry."

The bottom row of the coupon also now wraps gracefully (code drops to its own right-aligned line) so nothing collides at narrower widths.

Want me to default the demo amount to a more typical rupee value (e.g. ₹500 off ₹2,000), or wire "auto-generate" so each customer in the customer view gets a unique code?

