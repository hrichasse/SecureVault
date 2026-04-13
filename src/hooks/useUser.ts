'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface UseUserReturn {
  /** Usuario de Supabase Auth (o null si no hay sesión) */
  user: User | null
  /** true mientras se verifica la sesión inicial */
  loading: boolean
  /** true si la sesión fue verificada (independientemente del resultado) */
  initialized: boolean
}

/**
 * Hook para leer el usuario de la sesión de Supabase en el lado cliente.
 *
 * Se suscribe a cambios de autenticación (login, logout, token refresh)
 * para mantener el estado sincronizado automáticamente.
 *
 * @example
 * const { user, loading } = useUser()
 * if (loading) return <Spinner />
 * if (!user) return <p>No autenticado</p>
 * return <p>Hola, {user.email}</p>
 */
export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Obtener sesión inicial
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
      setInitialized(true)
    })

    // Suscribirse a cambios de auth (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
      setInitialized(true)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return { user, loading, initialized }
}
