CREATE INDEX store_geo_index ON "Store" USING GIST (ST_MakePoint(longitude, latitude)::geography);
