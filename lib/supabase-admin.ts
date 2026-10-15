import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getCloudflareContext } from '@opennextjs/cloudflare'

function cloudVar(name: string): string | undefined {
  try {
    const { env } = getCloudflareContext()
    const value = (env as unknown as Record<string, unknown>)[name]
    return typeof value === 'string' ? value : undefined
  } catch {
    return undefined // local Next.js development uses process.env
  }
}

export function getSupabaseAdmin() {
  const url = cloudVar('SUPABASE_URL') || cloudVar('NEXT_PUBLIC_SUPABASE_URL') || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = cloudVar('SUPABASE_SECRET_KEY') || cloudVar('SUPABASE_SERVICE_ROLE_KEY') || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
