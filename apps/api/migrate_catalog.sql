ALTER TABLE public."StoreProduct" DROP COLUMN IF EXISTS branch_id CASCADE;
ALTER TABLE public."StoreProduct" ADD COLUMN branch_id TEXT;
ALTER TABLE public."StoreProduct" ADD CONSTRAINT fk_storeproduct_branch FOREIGN KEY (branch_id) REFERENCES public.merchant_branches(id) ON DELETE CASCADE;

-- Backfill data seamlessly using native Postgres JOINs to bridge the gap
UPDATE public."StoreProduct" sp
SET branch_id = mb.id
FROM public."Store" s
JOIN (
    -- Get the first branch id for each merchant to map inventory properly
    SELECT DISTINCT ON (merchant_id) id, merchant_id
    FROM public.merchant_branches
    ORDER BY merchant_id, created_at ASC
) mb ON mb.merchant_id = s.merchant_id
WHERE sp."storeId" = s.id 
AND sp.branch_id IS NULL;
