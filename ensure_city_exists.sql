
-- Ensure at least one City exists to prevent foreign key errors in Store creation

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "City") THEN
        INSERT INTO "City" (id, name, active, "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), 'Hyderabad', true, NOW(), NOW());
        RAISE NOTICE 'Seeded Default City: Hyderabad';
    ELSE
        RAISE NOTICE 'City table already has data. Implementation verified.';
    END IF;
END $$;
