import { createClient } from "@supabase/supabase-js";

export const supabaseUrl =
    import.meta.env.VITE_SUPABASE_URL ||
    "https://your-project-ref.supabase.co";

const supabaseKey =
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    "your-supabase-publishable-key";

export const supabase = createClient(supabaseUrl, supabaseKey);
