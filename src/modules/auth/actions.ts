'use server'

/**
 * Server Actions de autenticación para SecureVault AI.
 *
 * Estas acciones se ejecutan en el servidor y tienen acceso
 * directo a las cookies de sesión de Supabase.
 *
 * Se usan desde los Client Components (LoginForm, RegisterForm)
 * y desde el botón de logout en el sidebar.
 */

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

// ── Schemas de validación ─────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  companyName: z
    .string()
    .min(2, 'El nombre de empresa debe tener al menos 2 caracteres')
    .max(200),
})

// ── loginAction ───────────────────────────────────────────────

export async function loginAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const raw = {
    email: (formData.get('email') as string)?.trim().toLowerCase(),
    password: formData.get('password') as string,
  }

  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Mensaje genérico — no revelar si es email o password
    return { error: 'Credenciales incorrectas. Por favor intenta de nuevo.' }
  }

  redirect('/dashboard')
}

// ── registerAction ────────────────────────────────────────────

export async function registerAction(
  formData: FormData
): Promise<{ error: string } | void> {
  const raw = {
    name: (formData.get('name') as string)?.trim(),
    email: (formData.get('email') as string)?.trim().toLowerCase(),
    password: formData.get('password') as string,
    companyName: (formData.get('companyName') as string)?.trim(),
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const { name, email, password, companyName } = parsed.data
  const supabase = await createClient()

  // 1. Crear usuario en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }, // metadata del usuario en auth.users
    },
  })

  if (authError) {
    if (
      authError.message.toLowerCase().includes('already registered') ||
      authError.message.toLowerCase().includes('already exists')
    ) {
      return {
        error: 'Este email ya está registrado. Intenta iniciar sesión.',
      }
    }
    console.error('[registerAction] Supabase Auth error:', authError.message)
    return { error: 'Error al crear la cuenta. Por favor intenta de nuevo.' }
  }

  if (!authData.user) {
    return { error: 'Error al crear la cuenta. Por favor intenta de nuevo.' }
  }

  // 2. Crear registros en Prisma (transacción)
  try {
    await prisma.$transaction(async (tx) => {
      // Crear empresa
      const company = await tx.company.create({
        data: {
          name: companyName,
          email: email,
        },
      })

      // Crear usuario vinculado a la empresa con rol ADMIN
      await tx.user.create({
        data: {
          supabaseId: authData.user!.id,
          email,
          name,
          role: 'ADMIN',
          companyId: company.id,
        },
      })
    })
  } catch (dbError: unknown) {
    console.error('[registerAction] DB error:', dbError)
    // La empresa ya existe con ese email (seed o registro previo)
    const pgError = dbError as { code?: string }
    if (pgError?.code === 'P2002') {
      return {
        error: 'Ya existe una empresa registrada con este email.',
      }
    }
    return {
      error: 'Error al configurar tu cuenta. Por favor contacta soporte.',
    }
  }

  redirect('/dashboard')
}

// ── logoutAction ──────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
