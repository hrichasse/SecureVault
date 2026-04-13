import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Página no encontrada',
}

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-vault-dark">
      <div className="text-center space-y-6 px-4">
        <div className="text-8xl font-bold text-gradient">404</div>
        <h1 className="text-2xl font-semibold text-white">
          Página no encontrada
        </h1>
        <p className="text-slate-400 max-w-sm mx-auto">
          El recurso que buscas no existe o no tienes permisos para acceder a él.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/" className="btn-primary">
            Volver al inicio
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Ir al dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
