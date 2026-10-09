'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import ChainLogo from './chain-logo'
import { useTheme } from '@/context/theme-context'

interface Option { value: string; label: string }

interface Props {
  value: string
  onChange: (v: string) => void
  options: Option[]
  light?: boolean
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
}

export default function ChainSelect({ value, onChange, options, light: lightProp, className = '', size = 'md', disabled = false }: Props) {
  const { theme } = useTheme()
  const light = lightProp ?? (theme === 'light')
  const [open, setOpen]   = useState(false)
  const [pos, setPos]     = useState({ top: 0, left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)
  const selected = options.find((o) => o.value === value) ?? options[0]

  function openDropdown() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const py   = size === 'sm' ? 'py-1.5' : 'py-2.5'
  const px   = size === 'sm' ? 'px-2'   : 'px-3'
  const text = size === 'sm' ? 'text-xs' : 'text-sm'
  const logo = size === 'sm' ? 14 : 18

  const bg          = light ? '#f3f4f6'              : '#0d1f33'
  const border      = light ? 'rgba(0,0,0,0.12)'     : 'rgba(255,255,255,0.1)'
  const color       = light ? '#0b1e47'              : '#ffffff'
  const hoverBg     = light ? 'rgba(0,0,0,0.04)'     : 'rgba(255,255,255,0.06)'
  const dropBg      = light ? '#ffffff'              : '#0d1f33'
  const dropBorder  = light ? 'rgba(0,0,0,0.1)'      : 'rgba(255,255,255,0.08)'
  const chevronColor = light ? '#637d96'             : '#45607a'

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => disabled ? undefined : open ? setOpen(false) : openDropdown()}
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-lg border ${px} ${py} ${text} outline-none transition focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{ background: bg, borderColor: border, color }}
      >
        <ChainLogo chain={selected.value} size={logo} />
        <span className="flex-1 text-left font-medium">{selected.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: chevronColor }} />
      </button>

      {open && (
        <div
          ref={dropRef}
          data-chain-dropdown
          className="py-1 shadow-xl"
          style={{
            position:    'fixed',
            top:         pos.top,
            left:        pos.left,
            width:       pos.width,
            background:  dropBg,
            borderColor: dropBorder,
            border:      `1px solid ${dropBorder}`,
            borderRadius: '12px',
            zIndex:      9999,
          }}
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`flex w-full items-center gap-2 px-3 py-2 ${text} transition`}
              style={{
                color,
                background: opt.value === value
                  ? (light ? 'rgba(42,171,171,0.1)' : 'rgba(42,171,171,0.12)')
                  : 'transparent',
              }}
              onMouseEnter={(e) => { if (opt.value !== value) e.currentTarget.style.background = hoverBg }}
              onMouseLeave={(e) => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}
            >
              <ChainLogo chain={opt.value} size={logo} />
              <span className="font-medium">{opt.label}</span>
              {opt.value === value && <span className="ml-auto text-brand-400 text-[10px] font-semibold">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
