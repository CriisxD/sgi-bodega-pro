import { createClient } from '@supabase/supabase-js';

// Client specifically created with the Service Role Key.
// WARNING: NEVER USE THIS ON THE CLIENT SIDE OR EXPOSE IT TO THE BROWSER.
// THIS CLIENT BYPASSES ROW LEVEL SECURITY (RLS) ENTIRELY.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
