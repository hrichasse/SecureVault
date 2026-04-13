import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getCertifications } from '@/modules/certifications/certification.service'

export const metadata: Metadata = { title: 'Certificaciones Digitales' }

export default async function CertificationsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const dbUser = await prisma.user.findUnique({
    where: { supabaseId: authUser.id },
    select: { id: true, companyId: true },
  })
  if (!dbUser) redirect('/login')

  const certifications = await getCertifications(dbUser.companyId)

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="page-title text-2xl flex items-center gap-3">
          <svg className="w-8 h-8 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Certificaciones Digitales
        </h1>
        <p className="page-subtitle">Pruebas criptográficas de existencia (Proof of Existence) de tus documentos</p>
      </div>

      <div className="card overflow-hidden">
        {certifications.length === 0 ? (
          <div className="p-12 text-center text-[#64748b]">
            No hay certificaciones generadas. Puedes certificar un documento desde su vista de detalle.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#334155] bg-[#0f172a]/50">
                  <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Documento</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Certificado Por</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider">Fecha / Hora</th>
                  <th className="px-5 py-4 text-xs font-semibold text-[#64748b] uppercase tracking-wider text-right">URL de Verificación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334155]/60">
                {certifications.map((cert) => (
                  <tr key={cert.id} className="hover:bg-[#334155]/20 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                        <span className="text-sm font-medium text-[#e2e8f0]">{cert.document.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-[#e2e8f0]">{cert.certifiedBy.name}</span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="text-sm text-[#94a3b8]">
                        {new Date(cert.createdAt).toLocaleString('es-ES')}
                      </span>
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <a
                        href={`/verify/${cert.verificationCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#10b981] hover:text-[#059669] hover:underline"
                      >
                        Abrir Verificador
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                        </svg>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
