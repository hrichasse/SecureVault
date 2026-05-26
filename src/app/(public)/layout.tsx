import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SecureVault AI — Gestión Documental Segura e Inteligente',
  description:
    'Protege, clasifica y audita todos los documentos de tu organización con inteligencia artificial.',
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
