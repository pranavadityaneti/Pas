const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Dropping existing get_nearby_stores...');
        await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.get_nearby_stores(double precision, double precision, double precision);`);
        
        console.log('Creating new get_nearby_stores...');
        await prisma.$executeRawUnsafe(`
CREATE OR REPLACE FUNCTION public.get_nearby_stores(user_lat double precision, user_lon double precision, radius_meters double precision)
 RETURNS TABLE(id uuid, distance_meters double precision)
 LANGUAGE sql
AS $function$
    SELECT
        mb.id::uuid as id,
        ST_Distance(
            ST_MakePoint(mb.longitude, mb.latitude)::geography,
            ST_MakePoint(user_lon, user_lat)::geography
        ) AS distance_meters
    FROM "public"."merchant_branches" mb
    -- Only return branches where both lat/lng exist and are active
    WHERE mb.latitude IS NOT NULL 
      AND mb.longitude IS NOT NULL
      AND mb.is_active = true
      -- Perform the spherical distance check
      AND ST_DWithin(
        ST_MakePoint(mb.longitude, mb.latitude)::geography,
        ST_MakePoint(user_lon, user_lat)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
$function$;
`);
        console.log('Successfully updated the get_nearby_stores function!');

    } catch(err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
