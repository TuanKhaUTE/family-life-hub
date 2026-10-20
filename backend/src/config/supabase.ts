import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  secretKey: string
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = process.env.SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error('Supabase environment variables are not configured')
  }

  return { url, secretKey }
}

export function createSupabaseServerClient(
  config: SupabaseConfig = getSupabaseConfig(),
): SupabaseClient {
  return createClient(config.url, config.secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    db: {
      retry: false,
      timeout: 5_000,
    },
  })
}
