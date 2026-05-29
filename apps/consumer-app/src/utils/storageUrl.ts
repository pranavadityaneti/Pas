const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const STORE_PHOTOS_BUCKET = 'merchant-docs';
const FALLBACK_STORE_IMAGE = 'https://images.unsplash.com/photo-1542838132-92c53300491?w=400';

export const getStoreImageUrl = (path: string | null | undefined): string => {
    if (!path) return FALLBACK_STORE_IMAGE;
    if (path.startsWith('http')) return path;
    return `${SUPABASE_URL}/storage/v1/object/public/${STORE_PHOTOS_BUCKET}/${path}`;
};

export const getStoreImageUrls = (paths: (string | null)[] | null | undefined): string[] => {
    if (!paths || paths.length === 0) return [];
    return paths.filter((p): p is string => !!p).map(getStoreImageUrl);
};
