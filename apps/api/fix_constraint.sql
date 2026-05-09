ALTER TABLE public."StoreProduct" DROP CONSTRAINT IF EXISTS fk_storeproduct_branch;
ALTER TABLE public."StoreProduct" ALTER COLUMN branch_id TYPE uuid USING branch_id::uuid;
ALTER TABLE public."StoreProduct" ADD CONSTRAINT fk_storeproduct_branch FOREIGN KEY (branch_id) REFERENCES public.merchant_branches(id) ON DELETE CASCADE;
