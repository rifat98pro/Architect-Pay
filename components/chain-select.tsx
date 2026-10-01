'use client'

import { useState, useRef, useEffect } from 'react'
import ChainLogo from '@/components/chain-logo'
import { ChevronDown, Layers } from 'lucide-react'

export interface ChainOption {
  id:        string
  label:     string
  sublabel?: string
  disabled?: boolean
}

interface Props {
  value:     string
  onChange:  (v: string) => void
  options:   ChainOption[]
  disabled?: boolean
}

function ChainIcon({ id, size = 20 }: { id: string; size?: number }) {
  if (id === 'ALL_CHAINS') return <Layers className="shrink-0 text-brand-400" style={{ width: size, height: size }} />
  return <ChainLogo chain={id} size={size} />
}

export default function ChainSelect({ value, onChange, options, disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const selected = options.find(o => o.id === value)

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-gray-700 bg-gray-800 py-2.5 pl-3 pr-8 text-sm text-white outline-none focus:border-brand-500/50 disabled:opacity-50 text-left"
      >
        {selected && <ChainIcon id={selected.id} size={20} />}
        <span className="flex-1 truncate">{selected?.label ?? value}</span>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[220px] rounded-xl border border-gray-700 bg-gray-900 shadow-xl overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={opt.disabled}
              onClick={() => { if (!opt.disabled) { onChange(opt.id); setOpen(false) } }}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition ${
                opt.disabled
                  ? 'cursor-not-allowed opacity-40'
                  : opt.id === value
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-300 hover:bg-gray-800'
              }`}
            >
              <ChainIcon id={opt.id} size={20} />
              <div className="min-w-0 flex-1 text-left">
                <div className="truncate leading-tight">{opt.label}</div>
                {opt.sublabel && <div className="text-xs text-gray-500 leading-tight">{opt.sublabel}</div>}
              </div>
              {opt.id === value && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
