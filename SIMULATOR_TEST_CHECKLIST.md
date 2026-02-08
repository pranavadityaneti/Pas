# Simulator Testing Checklist

## Pre-Test Setup ✅
- [x] Notification table created in Supabase
- [x] RLS policies applied
- [x] Store status updated to active
- [x] Test notification inserted

---

## Environment Setup

### 1. Start Backend API
```bash
cd /Users/apple/.gemini/antigravity/scratch/Pas/apps/api
npm run dev
# Wait for "Server running on port 3000"
```

### 2. Start Merchant App
```bash
cd /Users/apple/.gemini/antigravity/scratch/Pas/apps/merchant-app
npm start
# Press 'i' for iOS simulator
```

---

## Testing Scenarios

### ✅ Test 1: Login & Store Status
**Steps:**
1. Launch app on simulator
2. Login with your merchant credentials
3. Navigate to Dashboard

**Expected:**
- [ ] Dashboard loads successfully
- [ ] Store name displays correctly
- [ ] **Green "Online" badge** appears (not "Offline")
- [ ] Store address visible

**Screenshot:** Take screenshot if any issues

---

### ✅ Test 2: Notifications
**Steps:**
1. From Dashboard, tap **bell icon** (top right)
2. Verify full-screen notifications page opens
3. Check for test notification you inserted

**Expected:**
- [ ] Full-screen page (not modal)
- [ ] Back button works
- [ ] Test notification visible with **unread indicator**
- [ ] Tap notification → Marks as read (indicator disappears)
- [ ] "Mark all read" button appears when unread exist

**If empty:** Your test notification might be for different merchantId - verify SQL:
```sql
SELECT * FROM notification 
WHERE "merchantId" = (SELECT id FROM merchants WHERE email = 'your-email@example.com');
```

---

### ✅ Test 3: Inventory Sync
**Steps:**
1. Navigate to Inventory tab
2. Tap **"Add from Catalog" button**
3. Select any global product (e.g., "Amul Milk")
4. Set stock quantity and price
5. Tap Save
6. **Immediately check** inventory list

**Expected:**
- [ ] Product appears **immediately** in inventory list
- [ ] No need to pull-to-refresh
- [ ] Stock and price display correctly
- [ ] Product is **active** (toggle is ON)

**If fails:** RLS policies not applied correctly - check Supabase logs

---

### ✅ Test 4: Receipt Generation
**Steps:**
1. Navigate to Orders tab
2. Go to "Ready" tab
3. Tap any order
4. Tap "Enter OTP"
5. Enter correct OTP (check console logs for OTP)
6. On success modal:
   a. Tap **"Download"**
   b. Tap **"Share"**

**Expected:**
- [ ] Success modal displays
- [ ] Tap Download → Shows "Receipt saved to device!" alert
- [ ] Tap Share → Native share sheet opens with PDF
- [ ] PDF contains: Store name, Order items, Total

**Note:** PDF preview might not work on simulator - this is normal. Test on real device for full functionality.

---

### ✅ Test 5: Order History Filters
**Steps:**
1. Navigate to Orders → **History** tab
2. Verify filter buttons appear (All, Today, Week, Month)
3. Tap "This Week"
4. Check filtered results
5. Switch to "All"

**Expected:**
- [ ] Filter buttons **only appear on History tab** (not on Pending/Processing/Ready)
- [ ] Active filter has blue background
- [ ] Filtering works correctly
- [ ] Pull-to-refresh maintains filter selection

---

### ✅ Test 6: Store Details
**Steps:**
1. Navigate to Settings → Store Details
2. Check if all fields populated:
   - Store Name
   - Address
   - Category
   - Photos

**Expected:**
- [ ] All fields from signup appear
- [ ] If missing fields, note which ones for diagnostic

---

## Common Issues & Fixes

### Issue: "Offline" still shows
**Fix:** Check Supabase logs - Store might not have been created
```sql
SELECT * FROM "Store" WHERE "managerId" = (SELECT id FROM merchants WHERE email = 'your@email.com');
```

### Issue: Inventory products not appearing
**Fix:** Check RLS policies in Supabase
```sql
SELECT * FROM pg_policies WHERE tablename IN ('Product', 'StoreProduct');
```

### Issue: Notifications empty
**Fix:** Verify test notification merchantId matches your user:
```sql
SELECT n.*, m.email 
FROM notification n
JOIN merchants m ON n."merchantId" = m.id;
```

### Issue: PDF generation fails
**Fix:** Check if expo-print is installed:
```bash
cd apps/merchant-app
npm list expo-print expo-sharing
```

---

## Success Criteria

**Ready for TestFlight if:**
- [x] Store shows "Online" (green)
- [x] Notifications page is full-screen
- [x] Inventory products appear immediately after adding
- [x] Receipt downloads and shares
- [x] Order history filters work

**Report any failures before building!**
