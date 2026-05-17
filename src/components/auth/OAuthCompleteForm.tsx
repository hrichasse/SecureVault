'use client'

import { useState } from 'react'
import { completeOAuthRegistrationAction } from '@/modules/auth/actions'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function OAuthCompleteForm() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'ADMIN_COMPANY' | 'NOTARY'>('ADMIN_COMPANY')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const role = (formData.get('role') as string) || 'ADMIN_COMPANY'

    if (role === 'ADMIN_COMPANY') {
      const companyName = (formData.get('companyName') as string || '').trim()
      const companyRut = (formData.get('companyRut') as string || '').trim()
      const companyAddress = (formData.get('companyAddress') as string || '').trim()
      const companyBusinessLine = (formData.get('companyBusinessLine') as string || '').trim()

      if (!companyName || !companyRut || !companyAddress || !companyBusinessLine) {
        setError('Para Administrador de Empresa debes completar todos los datos de empresa.')
        setLoading(false)
        return
      }
    }

    const result = await completeOAuthRegistrationAction(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && (
        <div role="alert" className="flex items-start gap-2.5 bg-destructive/10 border border-destructive/30 text-destructive text-sm px-4 py-3 rounded-lg">
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="reg-role">Tipo de cuenta</Label>
        <select
          id="reg-role"
          name="role"
          className="input"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as 'ADMIN_COMPANY' | 'NOTARY')}
          disabled={loading}
        >
          <option value="ADMIN_COMPANY">Administrador de Empresa</option>
          <option value="NOTARY">Notario / Certificador</option>
        </select>
      </div>

      {selectedRole === 'ADMIN_COMPANY' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="reg-company">Nombre de la empresa</Label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input id="reg-company" name="companyName" type="text" autoComplete="organization" required minLength={2} placeholder="Acme Corp" className="pl-10" disabled={loading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-company-rut">RUT empresa</Label>
            <Input id="reg-company-rut" name="companyRut" type="text" required placeholder="12.345.678-9" className="input" disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-company-address">Dirección</Label>
            <Input id="reg-company-address" name="companyAddress" type="text" required placeholder="Av. Providencia 1234" className="input" disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reg-company-business">Giro</Label>
            <Input id="reg-company-business" name="companyBusinessLine" type="text" required placeholder="Logística y transporte" className="input" disabled={loading} />
          </div>
        </>
      )}

      <div className="flex items-start gap-2.5">
        <input
          id="reg-terms"
          type="checkbox"
          required
          className="mt-0.5 h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary cursor-pointer"
          disabled={loading}
        />
        <label htmlFor="reg-terms" className="text-sm text-muted-foreground cursor-pointer leading-relaxed">
          Acepto los{' '}<a href="#" className="text-primary hover:underline">términos de servicio</a>{' '}y la{' '}<a href="#" className="text-primary hover:underline">política de privacidad</a>
        </label>
      </div>

      <Button id="btn-oauth-submit" type="submit" disabled={loading} className="w-full h-11 gradient-primary text-primary-foreground font-semibold">
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Finalizando...
          </span>
        ) : 'Finalizar registro'}
      </Button>
    </form>
  )
}
