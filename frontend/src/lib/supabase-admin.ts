import { createClient } from "@supabase/supabase-js";

// ⚠️ Ce client utilise la clé "service_role" qui bypass RLS.
// À utiliser UNIQUEMENT dans les API Routes côté serveur, jamais côté client.
export function createAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Type utilitaire pour les réponses Supabase
export type { SupabaseClient } from "@supabase/supabase-js";
