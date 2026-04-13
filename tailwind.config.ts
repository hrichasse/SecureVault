import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // SecureVault Design System
        background: '#0f172a',
        surface: '#1e293b',
        border: '#334155',
        'text-primary': '#e2e8f0',
        'text-muted': '#94a3b8',
        accent: '#3b82f6',
        'accent-hover': '#2563eb',
        success: '#10b981',
        danger: '#ef4444',
        warning: '#f59e0b',
        // Slate palette (Tailwind built-in used throughout)
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      width: {
        sidebar: '240px',
      },
      minWidth: {
        sidebar: '240px',
      },
    },
  },
  plugins: [],
}

export default config
