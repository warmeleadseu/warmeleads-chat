import { createClient, SupabaseClient } from '@supabase/supabase-js';

// SINGLETON: Browser client (only ONE instance)
let browserClient: SupabaseClient | null = null;

// Supabase client voor server-side operations
export const createServerClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Supabase client voor client-side operations (browser)
// IMPORTANT: Returns the SAME instance every time (singleton)
export const createBrowserClient = () => {
  // Return existing client if already created
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase public environment variables');
  }

  // Create new client with proper password reset settings
  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true, // CRITICAL: This enables hash detection
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  return browserClient;
};

