const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media`;

/** Public URL for the `media` bucket (logos, covers, vehicle photos). */
export const mediaUrl = (path: string | null | undefined) => (path ? `${BASE}/${path}` : null);
