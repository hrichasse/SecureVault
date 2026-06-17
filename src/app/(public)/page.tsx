'use client'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Shield, Sparkles, Lock, FileSearch, Building2, Zap, UtensilsCrossed, Star, Quote } from 'lucide-react'
import { motion } from 'framer-motion'

// ─── Animation Variants ──────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}

const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
    },
  },
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
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
]

const testimonials = [
  {
    company: 'Banco Security',
    icon: <Building2 className="w-5 h-5" />,
    name: 'Carlos Mendoza',
    role: 'Director de TI',
    initials: 'CM',
    quote:
      'SecureVault transformó la gestión de contratos confidenciales. La clasificación con IA es precisa y el control de acceso nos da la tranquilidad que necesitamos.',
  },
  {
    company: 'Panasonic',
    icon: <Zap className="w-5 h-5" />,
    name: 'Andrea Silva',
    role: 'Gerente de Cumplimiento',
    initials: 'AS',
    quote:
      'Redujimos el tiempo de auditoría en un 60%. La trazabilidad completa de cada acceso es exactamente lo que exigía nuestra normativa interna.',
  },
  {
    company: "Domino's Pizza",
    icon: <UtensilsCrossed className="w-5 h-5" />,
    name: 'Felipe Torres',
    role: 'CTO',
    initials: 'FT',
    quote:
      'Gestionar permisos de acceso a documentos operativos entre decenas de tiendas nunca fue tan simple. Implementación rápida y soporte excelente.',
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage({
  searchParams,
}: {
  searchParams: { code?: string; error?: string }
}) {
  // Fallback defensivo: si el proveedor vuelve a Site URL con ?code=,
  // reenviar al callback real para intercambiar sesión y continuar flujo.
  if (searchParams.code) {
    redirect(`/api/auth/callback?code=${encodeURIComponent(searchParams.code)}`)
  }

  if (searchParams.error) {
    redirect(`/login?error=${encodeURIComponent(searchParams.error)}`)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-border px-6 py-4 relative z-10">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-foreground font-semibold text-lg tracking-tight">SecureVault AI</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm px-4 py-2 rounded-lg border border-border text-foreground hover:bg-muted transition-colors font-medium"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/register"
              className="text-sm px-4 py-2 rounded-lg gradient-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Registrarse
            </Link>
          </div>
        </nav>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-center justify-center px-6 py-20 relative">
        {/* Background glow blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute top-1/2 -right-32 w-[400px] h-[400px] rounded-full bg-secondary/8 blur-[100px]" />
        </div>

        <motion.div
          className="max-w-3xl mx-auto text-center space-y-8 relative z-10"
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
            <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/25 rounded-full px-4 py-1.5 text-sm text-primary">
              <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              Plataforma de gestión documental con IA
            </div>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.55 }}
            className="text-5xl md:text-6xl font-bold text-foreground leading-tight tracking-tight"
          >
            SecureVault{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              AI
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.55 }}
            className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            Protege, clasifica y audita todos los documentos de tu organización con
            inteligencia artificial. Control de acceso granular y trazabilidad completa
            en tiempo real.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center pt-2"
          >
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/register"
                className="inline-block px-8 py-3 text-base font-semibold rounded-lg gradient-primary text-primary-foreground shadow-lg shadow-primary/25 hover:opacity-90 transition-opacity"
              >
                Comenzar gratis
              </Link>
            </motion.div>
            <Link
              href="/login"
              className="px-8 py-3 text-base font-medium rounded-lg border border-border text-foreground hover:bg-muted transition-colors"
            >
              Iniciar sesión
            </Link>
          </motion.div>
        </motion.div>
      </main>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-elevated transition-shadow space-y-4 cursor-default"
              >
                <div className="w-11 h-11 rounded-lg bg-background border border-border flex items-center justify-center">
                  {f.icon}
                </div>
                <div>
                  <h2 className="text-card-foreground font-semibold mb-1">{f.title}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────────────────────── */}
      <section className="border-t border-border px-6 py-16">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Clientes que confían en nosotros
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Empresas que confían en{' '}
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
                SecureVault AI
              </span>
            </h2>
          </motion.div>

          {/* Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.15 }}
          >
            {testimonials.map((t) => (
              <motion.div
                key={t.company}
                variants={fadeUp}
                transition={{ duration: 0.5 }}
                whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                className="bg-card rounded-xl border border-border p-6 shadow-card hover:shadow-elevated transition-shadow flex flex-col gap-4 cursor-default"
              >
                {/* Quote icon + stars */}
                <div className="flex items-start justify-between">
                  <Quote className="w-7 h-7 text-primary/40" />
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                </div>

                {/* Quote text */}
                <p className="text-muted-foreground text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Author + company */}
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground text-xs font-bold">{t.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-card-foreground font-semibold text-sm truncate">{t.name}</p>
                    <p className="text-muted-foreground text-xs truncate">{t.role}</p>
                  </div>
                  {/* Company badge */}
                  <div className="flex items-center gap-1.5 bg-muted/60 border border-border rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground flex-shrink-0">
                    {t.icon}
                    <span className="hidden sm:inline">{t.company}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-6 text-center text-sm text-muted-foreground">
        © 2026 SecureVault AI — Todos los derechos reservados
      </footer>
    </div>
  )
}
