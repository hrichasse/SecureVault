/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

const verifyOtp = jest.fn()
jest.mock('@/lib/supabase/route-client', () => ({
  createRouteHandlerClient: () => ({
    supabase: { auth: { verifyOtp: (args: unknown) => verifyOtp(args) } },
    applyCookies: <T>(res: T) => res,
  }),
}))

import { GET } from '@/app/api/auth/confirm/route'
import { getAppOrigin, safeNextPath } from '@/lib/app-origin'

const call = (query: string, host = 'localhost:3000') =>
  GET(new NextRequest(`http://${host}/api/auth/confirm?${query}`, { headers: { host } }))

beforeEach(() => verifyOtp.mockReset())

describe('GET /api/auth/confirm (enlace del correo)', () => {
  it('verifica el token de recuperación y lleva a /reset-password', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const res = await call('token_hash=abc&type=recovery&next=/reset-password')
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' })
    expect(res.headers.get('location')).toBe('http://localhost:3000/reset-password')
  })

  it('sin next, una recuperación va igual a /reset-password', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const res = await call('token_hash=abc&type=recovery')
    expect(res.headers.get('location')).toBe('http://localhost:3000/reset-password')
  })

  it('enlace vencido → login con mensaje', async () => {
    verifyOtp.mockResolvedValue({ error: { message: 'Token has expired or is invalid' } })
    const res = await call('token_hash=viejo&type=recovery')
    expect(res.headers.get('location')).toContain('/login?error=invalid_reset_link')
  })

  it('rechaza tipos desconocidos sin llamar a Supabase', async () => {
    const res = await call('token_hash=abc&type=otra-cosa')
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toContain('/login?error=invalid_link')
  })

  it('no permite redirigir a otro dominio (//evil.com)', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const res = await call('token_hash=abc&type=recovery&next=//evil.com')
    expect(res.headers.get('location')).toBe('http://localhost:3000/reset-password')
  })

  it('en Azure redirige al dominio público aunque el Host sea el contenedor interno', async () => {
    verifyOtp.mockResolvedValue({ error: null })
    const res = await call('token_hash=abc&type=recovery', 'a1b2c3:8080')
    expect(res.headers.get('location')).toBe('https://securevault-ai.azurewebsites.net/reset-password')
  })
})

describe('app-origin', () => {
  it('getAppOrigin usa http solo en local', () => {
    expect(getAppOrigin('localhost:3000')).toBe('http://localhost:3000')
    expect(getAppOrigin('10.0.0.5:8080')).toBe('https://securevault-ai.azurewebsites.net')
    expect(getAppOrigin(null)).toBe('https://securevault-ai.azurewebsites.net')
  })

  it('safeNextPath solo acepta rutas internas', () => {
    expect(safeNextPath('/dashboard', '/x')).toBe('/dashboard')
    expect(safeNextPath('//evil.com', '/x')).toBe('/x')
    expect(safeNextPath('https://evil.com', '/x')).toBe('/x')
    expect(safeNextPath('/\\evil.com', '/x')).toBe('/x')
    expect(safeNextPath(null, '/x')).toBe('/x')
  })
})
