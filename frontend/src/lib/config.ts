// Matches the env var naming specified for the Vercel deployment.
export const API_BASE_URL: string = `${import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"}/api`;

// Kept for potential direct Supabase Storage reads of public media later
// (e.g. signed URLs for private files); NOT used for auth or database
// access — Django owns both. Only the public anon-equivalent values ever
// belong here, never a service/secret key.
export const SUPABASE_URL: string | undefined = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY: string | undefined = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
