/**
 * Supabase Admin Client (Service Role)
 *
 * Usar ÚNICAMENTE en el servidor (API routes, Server Actions).
 * NUNCA exponer al cliente — tiene permisos de superadmin.
 *
 * Usado para:
 * - Supabase Storage (subida de archivos sin restricciones de RLS)
 * - Operaciones admin de Auth (crear/eliminar usuarios)
 */

import { createClient } from '@supabase/supabase-js'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
