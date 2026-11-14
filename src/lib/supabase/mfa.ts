import type { SupabaseClient, User } from '@supabase/supabase-js'

/**
 * true si el usuario tiene un segundo factor (TOTP) verificado pero la sesión
 * sigue en AAL1: entró solo con contraseña y aún no pasó el reto de /verify-2fa.
 *
 * Esa sesión no debe dar acceso a nada protegido: ni al panel (lo redirige el
 * layout del dashboard) ni a las rutas /api/* (getAuthUser devuelve null).
 *
 * `user` debe venir de supabase.auth.getUser(), que valida el JWT en el servidor.
 */
export async function isSecondFactorPending(supabase: SupabaseClient, user: User): Promise<boolean> {
  const hasVerifiedFactor = (user.factors ?? []).some((f) => f.status === 'verified')
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  return aal?.currentLevel === 'aal1' && (aal?.nextLevel === 'aal2' || hasVerifiedFactor)
}
