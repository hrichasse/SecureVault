import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'SecureVault AI — Gestión Documental Segura',
    template: '%s | SecureVault AI',
  },
  description:
    'Plataforma empresarial de gestión documental con clasificación inteligente, control de acceso granular y trazabilidad completa.',
  keywords: ['gestión documental', 'seguridad', 'IA', 'clasificación', 'auditoría', 'cumplimiento'],
  authors: [{ name: 'SecureVault AI' }],
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-[#0f172a] text-[#e2e8f0] antialiased">
        {children}
      </body>
    </html>
  )
}
