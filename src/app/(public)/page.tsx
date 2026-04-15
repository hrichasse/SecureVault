import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Sparkles, Lock, FileSearch } from 'lucide-react'

export const metadata: Metadata = {
  title: 'SecureVault AI — Gestión Documental Segura e Inteligente',
  description:
    'Protege, clasifica y audita todos los documentos de tu organización con inteligencia artificial.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-foreground font-semibold text-lg tracking-tight">SecureVault AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium">
              Iniciar sesión
            </Link>
            <Link href="/register" className="text-sm px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium">
              Registrarse
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-full px-4 py-1.5 text-sm text-primary">
            <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            Plataforma de gestión documental con IA
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight">
            SecureVault{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">AI</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Protege, clasifica y audita todos los documentos de tu organización con
            inteligencia artificial. Control de acceso granular y trazabilidad completa
            en tiempo real.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/register"
              className="px-8 py-3 text-base font-semibold rounded-lg gradient-primary text-primary-foreground"
            >
              Comenzar gratis
            </Link>
            <Link
              href="/login"
              className="px-8 py-3 text-base font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Sparkles className="w-6 h-6 text-primary" />,
              title: 'Clasificación con IA',
              desc: 'Clasifica automáticamente documentos como BAJO, MEDIO, ALTO o CRÍTICO según su contenido.',
            },
            {
              icon: <Lock className="w-6 h-6 text-success" />,
              title: 'Control de acceso',
              desc: 'Permisos granulares por nivel de confidencialidad, rol y usuario. Solicitudes con aprobación.',
            },
            {
              icon: <FileSearch className="w-6 h-6 text-warning" />,
              title: 'Auditoría completa',
              desc: 'Trazabilidad de cada acción: quién, cuándo, desde dónde y qué documento se accedió.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-card rounded-xl border border-border p-6 shadow-card space-y-4 hover:shadow-elevated transition-shadow">
              <div className="w-11 h-11 rounded-lg bg-background border border-border flex items-center justify-center">
                {f.icon}
              </div>
              <div>
                <h2 className="text-card-foreground font-semibold mb-1">{f.title}</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        © 2026 SecureVault AI — Todos los derechos reservados
      </footer>
    </div>
  )
}
