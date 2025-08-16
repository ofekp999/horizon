import { createClient } from '@supabase/supabase-js';

// The Supabase URL and anon key are expected to be set in the environment. When
// developing locally, copy `.env.local.example` to `.env.local` and fill in your
// project details from the Supabase dashboard. These variables must be
// prefixed with `NEXT_PUBLIC_` so that Next.js can expose them to the
// browser.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);