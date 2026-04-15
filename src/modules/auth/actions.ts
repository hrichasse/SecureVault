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
import { logEvent } from '@/modules/audit/audit.service'

// ── Schemas de validación ─────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
})

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  email: z.string().email('Ingresa un email válido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['ADMIN', 'ADMIN_COMPANY', 'NOTARY']),
  companyName: z.string().max(200).optional(),
  companyRut: z.string().max(30).optional(),
  companyAddress: z.string().max(300).optional(),
  companyBusinessLine: z.string().max(200).optional(),
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

  // Registrar login en auditoría
  const dbUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, companyId: true },
  })
  if (dbUser) {
    await logEvent({ action: 'LOGIN', userId: dbUser.id, companyId: dbUser.companyId })
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
    role: ((formData.get('role') as string) || 'ADMIN_COMPANY').trim(),
    companyName: (formData.get('companyName') as string)?.trim() || undefined,
    companyRut: (formData.get('companyRut') as string)?.trim() || undefined,
    companyAddress: (formData.get('companyAddress') as string)?.trim() || undefined,
    companyBusinessLine: (formData.get('companyBusinessLine') as string)?.trim() || undefined,
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  const {
    name,
    email,
    password,
    role,
    companyName,
    companyRut,
    companyAddress,
    companyBusinessLine,
  } = parsed.data

  if (role === 'ADMIN_COMPANY') {
    if (!companyName || !companyRut || !companyAddress || !companyBusinessLine) {
      return { error: 'Para Administrador de Empresa debes completar nombre, RUT, dirección y giro.' }
    }
  }
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
      let targetCompanyId = ''

      if (role === 'ADMIN_COMPANY') {
        const company = await tx.company.create({
          data: {
            name: companyName!,
            email,
            rut: companyRut,
            address: companyAddress,
            businessLine: companyBusinessLine,
            adminName: name,
          },
        })
        targetCompanyId = company.id
      } else {
        const secureVaultCompany = await tx.company.upsert({
          where: { email: 'admin@securevault.cl' },
          update: {
            name: 'Secure Vault',
          },
          create: {
            name: 'Secure Vault',
            email: 'admin@securevault.cl',
            rut: '76.000.000-0',
            address: 'Santiago, Chile',
            businessLine: 'Software y Ciberseguridad',
            adminName: 'Equipo Secure Vault',
            description: 'Empresa base del sistema SecureVault',
          },
        })
        targetCompanyId = secureVaultCompany.id
      }

      await tx.user.create({
        data: {
          supabaseId: authData.user!.id,
          email,
          name,
          role,
          companyId: targetCompanyId,
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

  // Registrar registro en auditoría
  const newUser = await prisma.user.findUnique({ where: { email }, select: { id: true, companyId: true } })
  if (newUser) {
    await logEvent({
      action: 'REGISTER',
      userId: newUser.id,
      companyId: newUser.companyId,
      metadata: {
        name,
        role,
        companyName: companyName ?? 'Secure Vault',
      },
    })
  }

  redirect('/dashboard')
}

// ── logoutAction ──────────────────────────────────────────────

export async function logoutAction(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const dbUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
      select: { id: true, companyId: true },
    })
    if (dbUser) {
      await logEvent({ action: 'LOGOUT', userId: dbUser.id, companyId: dbUser.companyId })
    }
  }

  await supabase.auth.signOut()
  redirect('/login')
}
