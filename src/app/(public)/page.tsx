import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SecureVault AI — Gestión Documental Segura e Inteligente',
  description:
    'Protege, clasifica y audita todos los documentos de tu organización con inteligencia artificial.',
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* ── Header ── */}
      <header className="border-b border-[#334155] px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-[#e2e8f0] font-semibold text-lg tracking-tight">SecureVault AI</span>
          </div>

          {/* Nav actions */}
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary text-sm px-4 py-2">
              Iniciar sesión
            </Link>
            <Link href="/register" className="btn-primary text-sm px-4 py-2">
              Registrarse
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex items-center justify-center px-6 py-20">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/25 rounded-full px-4 py-1.5 text-sm text-[#3b82f6]">
            <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-pulse" />
            Plataforma de gestión documental con IA
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-6xl font-bold text-[#e2e8f0] leading-tight tracking-tight">
            SecureVault{' '}
            <span className="text-gradient">AI</span>
          </h1>

          {/* Description */}
          <p className="text-lg md:text-xl text-[#94a3b8] max-w-2xl mx-auto leading-relaxed">
            Protege, clasifica y audita todos los documentos de tu organización con
            inteligencia artificial. Control de acceso granular y trazabilidad completa
            en tiempo real.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href="/register"
              className="btn-primary px-8 py-3 text-base font-semibold rounded-lg"
            >
              Comenzar gratis
            </Link>
            <Link
              href="/login"
              className="btn-secondary px-8 py-3 text-base font-medium rounded-lg"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </main>

      {/* ── Features ── */}
      <section className="border-t border-[#334155] px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: (
                <svg className="w-6 h-6 text-[#3b82f6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
              ),
              title: 'Clasificación con IA',
              desc: 'Clasifica automáticamente documentos como BAJO, MEDIO, ALTO o CRÍTICO según su contenido.',
            },
            {
              icon: (
                <svg className="w-6 h-6 text-[#10b981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              ),
              title: 'Control de acceso',
              desc: 'Permisos granulares por nivel de confidencialidad, rol y usuario. Solicitudes con aprobación.',
            },
            {
              icon: (
                <svg className="w-6 h-6 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              ),
              title: 'Auditoría completa',
              desc: 'Trazabilidad de cada acción: quién, cuándo, desde dónde y qué documento se accedió.',
            },
          ].map((f) => (
            <div key={f.title} className="card p-6 space-y-4">
              <div className="w-11 h-11 rounded-lg bg-[#0f172a] border border-[#334155] flex items-center justify-center">
                {f.icon}
              </div>
              <div>
                <h2 className="text-[#e2e8f0] font-semibold mb-1">{f.title}</h2>
                <p className="text-[#94a3b8] text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#334155] px-6 py-6 text-center text-sm text-[#475569]">
        © 2026 SecureVault AI — Todos los derechos reservados
      </footer>
    </div>
  )
}
