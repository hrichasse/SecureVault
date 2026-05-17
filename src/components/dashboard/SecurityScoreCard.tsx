'use client'

import { ShieldAlert, ShieldCheck, Shield, AlertCircle, CheckCircle2, MinusCircle } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export interface SecurityFactor {
  id: string
  label: string
  points: number
  type: 'positive' | 'negative' | 'neutral'
}

export interface SecurityScoreData {
  score: number
  factors: SecurityFactor[]
  lastCalculated: string
}

export function SecurityScoreCard() {
  const [data, setData] = useState<SecurityScoreData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchScore() {
      try {
        const res = await fetch('/api/security-score')
        const json = await res.json()
        if (json.data) {
          setData(json.data)
        }
      } catch (e) {
        console.error('Error fetching security score', e)
      } finally {
        setLoading(false)
      }
    }
    fetchScore()
  }, [])

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-5 shadow-card animate-pulse h-[350px]">
        <div className="h-6 w-1/3 bg-muted rounded mb-6"></div>
        <div className="flex justify-center mb-6">
          <div className="h-32 w-32 rounded-full bg-muted"></div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
        </div>
      </div>
    )
  }

  const score = data?.score ?? 0
  const factors = data?.factors ?? []

  // Determinar color y mensaje según el score
  let statusColor = 'text-[#10b981]' // Green
  let strokeColor = '#10b981'
  let Icon = ShieldCheck
  let statusText = 'Nivel Óptimo'

  if (score < 60) {
    statusColor = 'text-[#ef4444]' // Red
    strokeColor = '#ef4444'
    Icon = ShieldAlert
    statusText = 'Nivel Crítico'
  } else if (score < 85) {
    statusColor = 'text-[#eab308]' // Yellow
    strokeColor = '#eab308'
    Icon = Shield
    statusText = 'Nivel Aceptable'
  }

  // Cálculos para el SVG (Círculo parcial)
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card flex flex-col h-full relative overflow-hidden">
      {/* Background glow based on status */}
      <div 
        className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-10 pointer-events-none"
        style={{ backgroundColor: strokeColor }}
      />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div>
          <h3 className="font-semibold text-card-foreground text-base">Security Score</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Postura de seguridad global</p>
        </div>
        <Icon className={`w-5 h-5 ${statusColor}`} />
      </div>

      <div className="flex flex-col items-center mb-6 relative z-10">
        {/* Score Gauge */}
        <div className="relative flex items-center justify-center w-36 h-36">
          {/* Background Circle */}
          <svg className="absolute inset-0 w-full h-full transform -rotate-90">
            <circle
              className="text-muted/20"
              strokeWidth="10"
              stroke="currentColor"
              fill="transparent"
              r={radius}
              cx="72"
              cy="72"
            />
            {/* Progress Circle */}
            <motion.circle
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="transition-all duration-1000 ease-in-out"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeLinecap="round"
              stroke={strokeColor}
              fill="transparent"
              r={radius}
              cx="72"
              cy="72"
            />
          </svg>
          
          <div className="flex flex-col items-center justify-center absolute inset-0">
            <motion.span 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-4xl font-bold tracking-tight text-foreground"
            >
              {score}
            </motion.span>
            <span className={`text-xs font-medium mt-1 ${statusColor}`}>{statusText}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-3 relative z-10">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Factores de impacto</h4>
        <div className="space-y-2.5 overflow-y-auto pr-2 max-h-[140px] custom-scrollbar">
          {factors.map((factor) => (
            <div key={factor.id} className="flex items-start gap-2">
              <div className="mt-0.5">
                {factor.type === 'positive' && <CheckCircle2 className="w-3.5 h-3.5 text-[#10b981]" />}
                {factor.type === 'negative' && <AlertCircle className="w-3.5 h-3.5 text-[#ef4444]" />}
                {factor.type === 'neutral' && <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              <div className="flex-1 text-sm">
                <span className="text-card-foreground text-xs">{factor.label}</span>
              </div>
              <div className="text-xs font-mono font-medium">
                {factor.points > 0 ? (
                  <span className="text-[#10b981]">+{factor.points}</span>
                ) : factor.points < 0 ? (
                  <span className="text-[#ef4444]">{factor.points}</span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
