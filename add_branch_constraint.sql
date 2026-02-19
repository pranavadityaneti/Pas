
-- 1. Remove duplicates, keeping the latest one
DELETE FROM "merchant_branches" a USING "merchant_branches" b
WHERE a.id < b.id
AND a.merchant_id = b.merchant_id
AND a.branch_name = b.branch_name;

-- 2. Add unique constraint
ALTER TABLE "merchant_branches" 
ADD CONSTRAINT "merchant_branches_merchant_id_branch_name_key" 
UNIQUE ("merchant_id", "branch_name");
