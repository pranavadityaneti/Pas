const { Client } = require('pg');

const SQL = `
CREATE OR REPLACE FUNCTION search_nearby_inventory(
    search_term text,
    user_lat double precision,
    user_lon double precision,
    radius_meters int DEFAULT 10000,
    vertical_filter text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_agg(store_row) INTO result
    FROM (
        SELECT
            mb.id AS branch_id,
            mb.branch_name,
            mb.address,
            mb.latitude,
            mb.longitude,
            mb.is_active,
            mb.operating_hours,
            mb.prep_time_minutes,
            mb.merchant_id,
            m.store_photos,
            v.name AS vertical_name,
            ST_Distance(
                ST_MakePoint(mb.longitude, mb.latitude)::geography,
                ST_MakePoint(user_lon, user_lat)::geography
            ) AS distance_meters,
            -- Aggregate matched products into a JSON array
            COALESCE(
                (
                    SELECT json_agg(json_build_object(
                        'product_id', p.id,
                        'product_name', p.name,
                        'brand', p.brand,
                        'image', p.image,
                        'mrp', p.mrp,
                        'price', sp.price,
                        'stock', sp.stock,
                        'subcategory', p.subcategory,
                        'uom', p.uom,
                        'unit_price', p.unit_price
                    ))
                    FROM "StoreProduct" sp
                    JOIN "Product" p ON sp."productId" = p.id
                    WHERE sp.branch_id = mb.id
                      AND sp.active = true
                      AND COALESCE(sp.is_deleted, false) = false
                      AND (
                          p.name ILIKE '%' || search_term || '%'
                          OR p.brand ILIKE '%' || search_term || '%'
                          OR p.subcategory ILIKE '%' || search_term || '%'
                      )
                ),
                '[]'::json
            ) AS matched_products,
            -- Flag: did this store match on branch name / vertical?
            (
                mb.branch_name ILIKE '%' || search_term || '%'
                OR v.name ILIKE '%' || search_term || '%'
                OR m.store_name ILIKE '%' || search_term || '%'
            ) AS store_name_match
        FROM merchant_branches mb
        JOIN merchants m ON mb.merchant_id = m.id
        LEFT JOIN "Vertical" v ON m.vertical_id = v.id
        WHERE mb.latitude IS NOT NULL
          AND mb.longitude IS NOT NULL
          AND mb.is_active = true
          -- PostGIS radius filter
          AND ST_DWithin(
              ST_MakePoint(mb.longitude, mb.latitude)::geography,
              ST_MakePoint(user_lon, user_lat)::geography,
              radius_meters
          )
          -- Optional vertical filter (dining vs retail)
          AND (
              vertical_filter IS NULL
              OR (vertical_filter = 'dining' AND v.name IN ('Restaurants & Cafes', 'Bakeries & Desserts'))
              OR (vertical_filter = 'retail' AND v.name NOT IN ('Restaurants & Cafes', 'Bakeries & Desserts'))
          )
          -- Main search filter: match store name OR has matching products
          AND (
              mb.branch_name ILIKE '%' || search_term || '%'
              OR v.name ILIKE '%' || search_term || '%'
              OR m.store_name ILIKE '%' || search_term || '%'
              OR EXISTS (
                  SELECT 1 FROM "StoreProduct" sp2
                  JOIN "Product" p2 ON sp2."productId" = p2.id
                  WHERE sp2.branch_id = mb.id
                    AND sp2.active = true
                    AND COALESCE(sp2.is_deleted, false) = false
                    AND (
                        p2.name ILIKE '%' || search_term || '%'
                        OR p2.brand ILIKE '%' || search_term || '%'
                        OR p2.subcategory ILIKE '%' || search_term || '%'
                    )
              )
          )
        ORDER BY distance_meters ASC
    ) AS store_row;

    -- Return empty array instead of null
    IF result IS NULL THEN
        result := '[]'::json;
    END IF;

    RETURN result;
END;
$$;
`;

async function main() {
    const client = new Client({ connectionString: "postgresql://postgres.llhxkonraqaxtradyycj:PAS%40cusmerad26@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" });
    try {
        await client.connect();
        console.log("Connected. Deploying search_nearby_inventory RPC...");
        await client.query(SQL);
        console.log("✅ Function created successfully.");

        // Verify it exists
        const verify = await client.query(`SELECT routine_name FROM information_schema.routines WHERE routine_name = 'search_nearby_inventory';`);
        console.log("Verification:", JSON.stringify(verify.rows));

        // Test it with the user's coordinates
        const test = await client.query(`SELECT search_nearby_inventory('milk', 16.816, 81.812, 10000, NULL);`);
        console.log("\nTEST (milk, 10km from Vadapalli):", JSON.stringify(JSON.parse(test.rows[0].search_nearby_inventory), null, 2));

        const test2 = await client.query(`SELECT search_nearby_inventory('Freshly', 16.816, 81.812, 10000, NULL);`);
        console.log("\nTEST (Freshly, store name match):", JSON.stringify(JSON.parse(test2.rows[0].search_nearby_inventory), null, 2));

    } catch (error) {
        console.error("❌ Error:", error.message);
    } finally {
        await client.end();
    }
}
main();
