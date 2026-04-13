import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in the browser (Client Components).
 *
 * Uses the public anon key — Row Level Security (RLS) should be configured
 * in Supabase to protect data access.
 *
 * @example
 * // In a Client Component:
 * 'use client'
 * import { createClient } from '@/lib/supabase/client'
 * const supabase = createClient()
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
