import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function test() {
  try {
    await prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          name: "Test Banco",
          email: "hert666uc@gmail.com",
          rut: "97053000-2",
          address: "Av Apoquindo 3100",
          businessLine: "Banco",
          adminName: "Test User",
        },
      })
      console.log("Company created:", company.id)
      
      const sub = await tx.subscription.create({
        data: {
          companyId: company.id,
          plan: 'FREE',
          status: 'ACTIVE',
          maxUsers: 5,
          maxDocuments: 100,
        },
      })
      console.log("Sub created")

      await tx.user.create({
        data: {
          supabaseId: "dummy-supabase-id-test",
          email: "hert666uc@gmail.com",
          name: "Test User",
          role: "ADMIN_COMPANY",
          companyId: company.id,
        },
      })
      console.log("User created")
      // Rollback to keep clean
      throw new Error("ROLLBACK")
    })
  } catch (e) {
    console.error("Caught error:", e)
  }
}
test()
