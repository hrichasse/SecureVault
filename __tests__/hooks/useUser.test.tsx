import { renderHook, act } from '@testing-library/react'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Mock de createClient
jest.mock('@/lib/supabase/client', () => {
  const mockUnsubscribe = jest.fn()
  const mockOnAuthStateChange = jest.fn().mockReturnValue({
    data: {
      subscription: {
        unsubscribe: mockUnsubscribe,
      },
    },
  })
  const mockGetUser = jest.fn().mockResolvedValue({
    data: { user: null },
  })

  return {
    createClient: jest.fn().mockImplementation(() => ({
      auth: {
        getUser: mockGetUser,
        onAuthStateChange: mockOnAuthStateChange,
      },
    })),
    // Guardar referencias para el testing
    _mockUnsubscribe: mockUnsubscribe,
    _mockOnAuthStateChange: mockOnAuthStateChange,
    _mockGetUser: mockGetUser,
  }
})

// Acceso rápido a los mocks
const mockClient = require('@/lib/supabase/client')

describe('useUser Hook', () => {
  const dummyUser = {
    id: 'user-123',
    email: 'test@securevault.com',
  } as unknown as User

  beforeEach(() => {
    jest.clearAllMocks()
    // Configuración por defecto: no autenticado
    mockClient._mockGetUser.mockResolvedValue({ data: { user: null } })
    mockClient._mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: jest.fn() } },
    })
  })

  it('should initialize with loading: true and user: null', async () => {
    let resolveGetUser: any
    const promise = new Promise((resolve) => {
      resolveGetUser = resolve
    })
    mockClient._mockGetUser.mockReturnValue(promise)

    const { result } = renderHook(() => useUser())

    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBeNull()
    expect(result.current.initialized).toBe(false)

    // Resolver la promesa
    await act(async () => {
      resolveGetUser({ data: { user: null } })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toBeNull()
    expect(result.current.initialized).toBe(true)
  })

  it('should fetch user from auth.getUser and set loading to false', async () => {
    mockClient._mockGetUser.mockResolvedValue({ data: { user: dummyUser } })

    const { result } = renderHook(() => useUser())

    // Esperar a que las promesas de la sesión inicial se resuelvan
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.user).toEqual(dummyUser)
    expect(result.current.initialized).toBe(true)
  })

  it('should subscribe to auth state changes and update user state', async () => {
    let authCallback: any = null
    mockClient._mockOnAuthStateChange.mockImplementation((callback: any) => {
      authCallback = callback
      return {
        data: { subscription: { unsubscribe: jest.fn() } },
      }
    })

    const { result } = renderHook(() => useUser())

    // Esperar a que se ejecute el effect inicial
    await act(async () => {
      await Promise.resolve()
    })

    expect(result.current.user).toBeNull()

    // Simular un evento de SIGNED_IN
    await act(async () => {
      authCallback('SIGNED_IN', { user: dummyUser })
    })

    expect(result.current.user).toEqual(dummyUser)
    expect(result.current.loading).toBe(false)

    // Simular un evento de SIGNED_OUT
    await act(async () => {
      authCallback('SIGNED_OUT', null)
    })

    expect(result.current.user).toBeNull()
  })

  it('should call unsubscribe when unmounted', async () => {
    const mockUnsubscribe = jest.fn()
    mockClient._mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    })

    const { unmount } = renderHook(() => useUser())

    // Esperar a que se registre la suscripción
    await act(async () => {
      await Promise.resolve()
    })

    unmount()

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
