/**
 * SecureVault AI — Prisma Seed
 *
 * Crea datos demo para desarrollo local:
 * - 1 empresa
 * - 3 usuarios (ADMIN, REVIEWER, USER)
 *
 * Ejecutar: npm run db:seed
 *
 * IMPORTANTE: Los supabaseId en seed son cuid() temporales.
 * En producción deben corresponder a IDs reales de auth.users en Supabase.
 */

import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed de SecureVault AI...')

  // ── Empresa Demo ──────────────────────────────────────────
  const company = await prisma.company.upsert({
    where: { email: 'admin@demo.com' },
    update: {},
    create: {
      name: 'Empresa Demo SA',
      email: 'admin@demo.com',
      description: 'Empresa de demostración para desarrollo y pruebas de SecureVault AI.',
    },
  })
  console.log(`✅ Empresa creada: ${company.name} (${company.id})`)

  // ── Usuarios Demo ─────────────────────────────────────────
  const usersData: {
    supabaseId: string
    email: string
    name: string
    role: UserRole
  }[] = [
    {
      supabaseId: 'seed-admin-' + company.id.slice(0, 8),
      email: 'admin@demo.com',
      name: 'Admin Demo',
      role: 'ADMIN',
    },
    {
      supabaseId: 'seed-reviewer-' + company.id.slice(0, 8),
      email: 'reviewer@demo.com',
      name: 'Revisor Demo',
      role: 'REVIEWER',
    },
    {
      supabaseId: 'seed-user-' + company.id.slice(0, 8),
      email: 'user@demo.com',
      name: 'Usuario Demo',
      role: 'USER',
    },
  ]

  for (const userData of usersData) {
    const user = await prisma.user.upsert({
      where: { email: userData.email },
      update: {},
      create: {
        ...userData,
        companyId: company.id,
      },
    })
    console.log(`✅ Usuario creado: ${user.name} — ${user.role} (${user.id})`)
  }

  console.log('\n🎉 Seed completado exitosamente.')
  console.log('   Empresa: Empresa Demo SA')
  console.log('   Usuarios: admin@demo.com | reviewer@demo.com | user@demo.com')
}

main()
  .catch((error) => {
    console.error('❌ Error en seed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
