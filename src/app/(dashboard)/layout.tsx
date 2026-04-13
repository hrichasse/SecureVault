import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/Sidebar'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { name: true, email: true },
  })

  return (
    <div className="min-h-screen bg-[#0f172a]">
      <Sidebar user={{ name: dbUser?.name || 'Usuario', email: dbUser?.email || '' }} />
      {/* Main content offset by sidebar width */}
      <main
        className="min-h-screen overflow-y-auto"
        style={{ marginLeft: '240px' }}
      >
        {children}
      </main>
    </div>
  )
}
