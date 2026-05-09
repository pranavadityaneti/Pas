CREATE OR REPLACE FUNCTION public.get_nearby_stores(user_lat double precision, user_lon double precision, radius_meters double precision)
 RETURNS TABLE(store_id uuid, distance_meters double precision)
 LANGUAGE sql
AS $function$
    SELECT
        id as store_id,
        ST_Distance(
            ST_MakePoint(longitude, latitude)::geography,
            ST_MakePoint(user_lon, user_lat)::geography
        ) AS distance_meters
    FROM "public"."Store"
    -- Only return stores where both lat/lng exist
    WHERE latitude IS NOT NULL 
      AND longitude IS NOT NULL
      -- Perform the spherical distance check
      AND ST_DWithin(
        ST_MakePoint(longitude, latitude)::geography,
        ST_MakePoint(user_lon, user_lat)::geography,
        radius_meters
    )
    ORDER BY distance_meters ASC;
$function$
