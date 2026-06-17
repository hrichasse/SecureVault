import { render, screen, waitFor, act, fireEvent } from '@testing-library/react'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'
import { requestPasswordResetAction } from '@/modules/auth/actions'

// Mock de next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => {
    return <div data-testid="next-link" data-href={href}>{children}</div>
  }
})

// Mock de la Server Action
jest.mock('@/modules/auth/actions', () => ({
  requestPasswordResetAction: jest.fn(),
}))

const mockRequestPasswordResetAction = requestPasswordResetAction as jest.MockedFunction<
  typeof requestPasswordResetAction
>

describe('ForgotPasswordForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render the form with initial inputs', () => {
    render(<ForgotPasswordForm />)

    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('usuario@empresa.com')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /enviar enlace de recuperación/i })).toBeInTheDocument()
    expect(screen.getByText(/volver a iniciar sesión/i)).toBeInTheDocument()
  })

  it('should show success screen when requestPasswordResetAction is successful', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({
      success: true,
      message: 'Correo de recuperación enviado.',
    })

    render(<ForgotPasswordForm />)

    const emailInput = screen.getByLabelText(/correo electrónico/i)
    const submitButton = screen.getByRole('button', { name: /enviar enlace de recuperación/i })

    // Escribir el email y hacer submit usando fireEvent para máxima robustez
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    fireEvent.click(submitButton)

    // Verificar que se llame con el FormData que tiene el email
    await waitFor(() => {
      expect(mockRequestPasswordResetAction).toHaveBeenCalledTimes(1)
    })
    
    // Obtener el argumento FormData que fue enviado
    const formDataSent = mockRequestPasswordResetAction.mock.calls[0][0]
    expect(formDataSent.get('email')).toBe('test@example.com')

    // Verificar que se muestre el mensaje de éxito
    expect(screen.getByText('¡Enlace enviado!')).toBeInTheDocument()
    expect(screen.getByText('Correo de recuperación enviado.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/correo electrónico/i)).not.toBeInTheDocument()

    // Verificar el link de redirección a /login
    const linkContainer = screen.getByTestId('next-link')
    expect(linkContainer).toHaveAttribute('data-href', '/login')
  })

  it('should show error alert when requestPasswordResetAction fails', async () => {
    mockRequestPasswordResetAction.mockResolvedValue({
      error: 'El correo electrónico no existe en el sistema.',
    })

    render(<ForgotPasswordForm />)

    const emailInput = screen.getByLabelText(/correo electrónico/i)
    const submitButton = screen.getByRole('button', { name: /enviar enlace de recuperación/i })

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(mockRequestPasswordResetAction).toHaveBeenCalledTimes(1)
    })

    // Verificar que se muestre la alerta de error
    const errorAlert = await screen.findByRole('alert')
    expect(errorAlert).toBeInTheDocument()
    expect(errorAlert).toHaveTextContent('El correo electrónico no existe en el sistema.')

    // Verificar que el formulario siga visible
    expect(screen.getByLabelText(/correo electrónico/i)).toBeInTheDocument()
  })

  it('should disable inputs and show loading indicator during submission', async () => {
    // Retornar una promesa que no se resuelva inmediatamente para simular la espera
    let resolveAction: any
    const promise = new Promise((resolve) => {
      resolveAction = resolve
    })
    mockRequestPasswordResetAction.mockReturnValue(promise as any)

    render(<ForgotPasswordForm />)

    const emailInput = screen.getByLabelText(/correo electrónico/i)
    const submitButton = screen.getByRole('button', { name: /enviar enlace de recuperación/i })

    fireEvent.change(emailInput, { target: { value: 'loading@example.com' } })
    fireEvent.click(submitButton)

    // Debe mostrar el estado de cargando
    expect(screen.getByText('Enviando enlace...')).toBeInTheDocument()
    expect(emailInput).toBeDisabled()
    expect(submitButton).toBeDisabled()

    // Resolver la promesa para limpiar el estado
    await act(async () => {
      resolveAction({ success: true })
    })
  })
})
