-- Activate all stores to ensure the merchant app works
UPDATE "Store" SET active = true WHERE active = false;
