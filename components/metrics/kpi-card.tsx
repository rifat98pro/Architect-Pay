'use client'

import React from 'react'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: string | number
  subtitle?: string
  badge?: string
  badgeColor?: 'teal' | 'navy' | 'gray' | 'purple'
  icon: LucideIcon
  tooltip?: string
  isAvailable?: boolean
}

export function KpiCard({
  title,
  value,
  subtitle,
  badge,
  badgeColor = 'teal',
  icon: Icon,
  tooltip,
  isAvailable = true,
}: KpiCardProps) {
  const badgeClasses = {
    teal: 'bg-[#2aabab]/10 text-[#2aabab] border-[#2aabab]/30',
    navy: 'bg-[#2d61bb]/10 text-[#6e93d4] border-[#2d61bb]/30',
    purple: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    gray: 'bg-white/5 text-gray-400 border-white/10',
  }[badgeColor]

  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-6 transition-all duration-200 hover:border-[#2aabab]/40 hover:shadow-[0_4px_24px_rgba(42,171,171,0.08)]"
      style={{
        background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Background glow element */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full blur-2xl"
        style={{ background: 'rgba(42, 171, 171, 0.07)' }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {title}
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-[#2aabab]">
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>

        <div className="mt-3 flex items-baseline gap-2">
          {isAvailable ? (
            <div className="text-3xl font-extrabold tracking-tight text-white md:text-4xl">
              {value}
            </div>
          ) : (
            <div className="text-xl font-medium text-gray-500">
              Not available
            </div>
          )}
          {badge && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${badgeClasses}`}
            >
              {badge}
            </span>
          )}
        </div>

        {subtitle && (
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            {subtitle}
          </p>
        )}

        {tooltip && (
          <div className="mt-3 border-t border-white/5 pt-2 text-[11px] text-gray-500">
            {tooltip}
          </div>
        )}
      </div>
    </div>
  )
}

