# ERRORS.md — approaches that took >2 attempts

> Per CLAUDE.md rule #3: when something takes more than 2 attempts, log what didn't work, what worked, and what to remember. **Check this file before trying similar approaches.**

---

## EB (Elastic Beanstalk) API deploys
- **What didn't work:** relying on EB's default `npm install` on a **t3.micro** (1 GB) — `npm install` + `prisma generate` thrashed memory, took ~45 min, blew the 600s command timeout → "Failed to deploy" → version mismatch → outage.
- **What worked:** bumped the instance to **t3.small (2 GB)** + raised `aws:elasticbeanstalk:command Timeout` to 3600 (via `.ebextensions/03-instance.config` + a one-off `aws elasticbeanstalk update-environment`). Deploys now ~30–40s.
- **Remember:** EB ships the **working-tree `dist/`** (`.ebignore` has `!dist/`), and does **not** rebuild — so `npm run build` locally before `eb deploy`. Verify Layer markers are in `dist/index.js` after build. The deployed "version label" can be stale metadata; trust `/health` + `eb health` over the label.

## Editing `.numbers` files (numbers-parser)
- **What didn't work:** `sheet = doc.add_sheet(...)` then `sheet.tables[0]` → `add_sheet` returns **None**.
- **What worked:** call `doc.add_sheet(name, "Table 1", num_rows, num_cols)`, then grab `sheet = doc.sheets[-1]`; `table.write(r, c, val)` auto-extends past the default 12×8.
- **Remember:** `"User".email` is **NOT NULL + UNIQUE** — backfills must use a guaranteed-unique synthetic email; the `role` column needs `'CONSUMER'::"Role"` cast in raw SQL. Always **back up the .numbers file** before editing (it's a binary bundle). Install numbers-parser in a venv (`/tmp/numbers_env`) — works on Python 3.14.

## Edit tool — exact-match failures
- **What didn't work:** `old_string` that omitted a trailing inline comment (e.g. `retryable: !isStock,   // ...`) → "String to replace not found."
- **What worked:** re-read the exact lines (Read tool) and copy the literal text including trailing comments/whitespace before editing.
- **Remember:** after a prior Edit changes a block, re-read before the next Edit on the same region.
