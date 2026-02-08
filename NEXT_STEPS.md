# Next Steps - Test Pilot Build #2

## ✅ What's Been Done

1. **Notifications** - Full backend integration with Supabase
2. **Receipts** - PDF generation & sharing
3. **Order Filters** - Date range filtering
4. **Inventory** - Already has refresh on focus
5. **DB Fix Endpoint** - Ready to execute (SQL is clean, no comment errors)

---

## 🎯 YOUR ACTION ITEMS

### 1. Create Notification Table (2 min)

Run this in **Supabase SQL Editor**:

```sql
CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "merchantId" UUID REFERENCES merchants(id),
    type TEXT CHECK (type IN ('order', 'stock', 'payout', 'system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    metadata JSONB,
    "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_merchant ON notification("merchantId", "createdAt" DESC);

-- Enable RLS
ALTER TABLE notification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own notifications" ON notification
FOR SELECT TO authenticated
USING ("merchantId" = auth.uid());

CREATE POLICY "System can insert notifications" ON notification
FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Merchants can update own notifications" ON notification
FOR UPDATE TO authenticated
USING ("merchantId" = auth.uid());
```

---

### 2. Apply RLS & Store Status Fix (5 min)

**Option A - Via API Endpoint (Easiest):**

```bash
# 1. Start API (if not running)
cd /Users/apple/.gemini/antigravity/scratch/Pas/apps/api
npm run dev

# 2. In another terminal, run:
curl -X POST http://localhost:3000/debug/fix-db \
  -H "Content-Type: application/json" \
  -d '{"email": "YOUR_ACTUAL_MERCHANT_EMAIL@example.com"}'

# Expected response:
# {"success": true, "message": "DB Fixed - RLS Policies Updated & Store Activated"}
```

**Option B - Manual SQL (if endpoint fails):**

Copy the SQL from walkthrough.md (lines 51-75) and run in Supabase SQL Editor.

---

### 3. Test Everything (15 min)

```bash
# Start Merchant App
cd /Users/apple/.gemini/antigravity/scratch/Pas/apps/merchant-app
npm start
```

**Test Checklist:**
- [ ] **Inventory Sync:** Add product from catalog → Verify appears immediately
- [ ] **Store Status:** Dashboard shows green "Online" status
- [ ] **Notifications:** Tap bell → See full-screen page (empty if no notifications yet)
- [ ] **Receipts:** Complete order → Download → PDF generated
- [ ] **Receipts:** Complete order → Share → Share sheet opens  
- [ ] **Order History:** History tab → Filter by "This Week" → Orders filtered

---

### 4. Create Test Notification (Optional)

To test notifications, manually insert one:

```sql
INSERT INTO notification ("merchantId", type, title, message, read, "createdAt")
VALUES (
    (SELECT id FROM merchants WHERE email = 'YOUR_EMAIL@example.com'),
    'order',
    'New Order Received',
    'Order #TEST123 has been placed',
    false,
    NOW()
);
```

Then check the app - you should see it with an unread indicator!

---

### 5. Build TestFlight #2 (10 min)

```bash
cd /Users/apple/.gemini/antigravity/scratch/Pas/apps/merchant-app

# 1. Bump version
# Edit app.json: change "version": "1.0.1" → "1.0.2"

# 2. Build
eas build --platform ios --profile production

# 3. Submit
eas submit --platform ios
```

---

## 📋 Store Details Investigation

**When Ready:**
1. Create new merchant account via signup
2. Fill in ALL branch details (name, category, upload photos)
3. Run diagnostic SQL: `check_store_details.sql`
4. Report which fields are `NULL`

Then I can fix the signup flow.

---

## 🚀 Summary

**Ready to Deploy:**
- ✅ Notifications (with backend)
- ✅ Receipts
- ✅ Order Filters
- ✅ Store Status Fix (just need to run)

**Outstanding:**
- ⚠️ Notification table creation (SQL above)
- ⚠️ DB RLS fix execution (curl command above)
- ❓ Store details (needs investigation)

**Estimated Time:** 20-30 minutes to complete all actions and build!
