import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env['SUPABASE_URL']
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY']
const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY']

function requireEnv(name: 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'SUPABASE_SERVICE_ROLE_KEY', value: string | undefined): string {
  if (value && value.trim().length > 0) {
    return value
  }

  throw new Error(
    `[api] Missing required env var: ${name}. Configure it in the root .env file before starting the backend.`,
  )
}

const requiredSupabaseUrl = requireEnv('SUPABASE_URL', supabaseUrl)
const requiredSupabaseAnonKey = requireEnv('SUPABASE_ANON_KEY', supabaseAnonKey)
const requiredSupabaseServiceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', supabaseServiceKey)

export const supabase = createClient(requiredSupabaseUrl, requiredSupabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})

export const supabaseAdmin = createClient(requiredSupabaseUrl, requiredSupabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
})
