// Raw CSV row (csv-parse with columns:true yields string fields).
export interface BlinkitRow {
  product_id: string;
  name: string;
  mrp: string;
  price: string;
  brand: string;
  images: string;     // JSON array string of URLs
  deeplink: string;
  quantity: string;
  category: string;
  subcategory: string;
  data_dump: string;  // JSON string (siblings, rating, etc.)
}

// Result of resolving a (category, subcategory) pair against CategoryMapping.
export interface CategoryResolution {
  vertical_id: string;
  category_id: string;
  requiresFssai: boolean;
}

// The payload we upsert into Product (Prisma field names).
export interface ProductUpsert {
  name: string;
  mrp: number;
  brand: string | null;
  image: string | null;
  uom: string | null;
  unitType: string | null;
  unitValue: number | null;
  subcategory: string | null;
  source: 'blinkit';
  sourceProductId: string;
  vertical_id: string;
  category_id: string;
  isVeg: boolean | null;
  productUrl: string | null;
  avgRating: number | null;
  numberOfRatings: number | null;
  extraData: Record<string, unknown>;
}
