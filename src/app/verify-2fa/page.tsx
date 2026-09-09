import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VerifyTwoFactorClient } from './VerifyTwoFactorClient'

/**
 * Pantalla de verificación del segundo factor (paso posterior al login).
 *
 * Solo aplica a usuarios con 2FA activo cuya sesión está en AAL1 (solo password).
 * - Sin sesión → login
 * - Sin 2FA o ya verificado (AAL2) → dashboard
 */
export default async function VerifyTwoFactorPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Si no tiene un factor verificado o ya alcanzó AAL2, no corresponde estar aquí.
  const hasVerifiedFactor = (user.factors ?? []).some((f) => f.status === 'verified')
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (!hasVerifiedFactor || aal?.currentLevel === 'aal2') {
    redirect('/dashboard')
  }

  return <VerifyTwoFactorClient />
}
