/**
 * Skeleton — componente de loading state para SecureVault AI.
 */
import React from 'react'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded bg-[#1e293b] ${className}`}
      aria-hidden="true"
    />
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-16 mt-1.5" />
        </div>
        <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
      </div>
      <Skeleton className="h-3 w-48 mt-2" />
    </div>
  )
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}

export function ActivityItemSkeleton() {
  return (
    <li className="p-4 border-b border-[#334155]/40">
      <div className="flex items-start gap-3">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
    </li>
  )
}
