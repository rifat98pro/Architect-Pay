'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import {
  DailyActivityPoint,
  AssetDistributionItem,
  NetworkActivityItem,
  ProductActivityItem,
} from '@/lib/metrics'
import { ArrowUpRight, ShieldCheck, Layers, PieChart, BarChart3 } from 'lucide-react'

// Chain icon mapping
const CHAIN_ICONS: Record<string, string> = {
  'ARC-TESTNET': '/chains/arc.svg',
  'BASE-SEPOLIA': '/chains/base.svg',
  'ARB-SEPOLIA': '/chains/arb.svg',
  'MATIC-AMOY': '/chains/pol.svg',
  'AVAX-FUJI': '/chains/avax.svg',
  'OP-SEPOLIA': '/chains/op.svg',
  'ETH-SEPOLIA': '/chains/eth.svg',
}

interface VolumeActivityChartProps {
  data: DailyActivityPoint[]
}

export function VolumeActivityChart({ data }: VolumeActivityChartProps) {
  const [metric, setMetric] = useState<'volume' | 'transactions'>('volume')
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const points = data.length > 0 ? data : [{ date: 'Today', volumeUsd: 0, txCount: 0 }]
  const values = points.map((p) => (metric === 'volume' ? p.volumeUsd : p.txCount))
  const maxVal = Math.max(...values, metric === 'volume' ? 100 : 5)
  const minVal = 0

  // SVG coordinates calculation
  const width = 800
  const height = 260
  const padX = 50
  const padY = 30
  const chartW = width - padX * 2
  const chartH = height - padY * 2

  const coords = points.map((p, idx) => {
    const val = metric === 'volume' ? p.volumeUsd : p.txCount
    const x = padX + (points.length > 1 ? (idx / (points.length - 1)) * chartW : chartW / 2)
    const y = height - padY - ((val - minVal) / (maxVal - minVal || 1)) * chartH
    return { x, y, val, point: p }
  })

  const pathD = coords.reduce(
    (acc, curr, idx) => (idx === 0 ? `M ${curr.x} ${curr.y}` : `${acc} L ${curr.x} ${curr.y}`),
    '',
  )

  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${height - padY} L ${coords[0].x} ${height - padY} Z`
    : ''

  const hovered = hoveredIdx !== null ? coords[hoveredIdx] : null

  return (
    <div
      className="relative rounded-2xl border p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#2aabab]" />
            Activity Over Time
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Daily verified activity aggregated from completed on-chain operations
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1 text-xs">
          <button
            onClick={() => setMetric('volume')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              metric === 'volume'
                ? 'bg-[#2aabab] text-black font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Volume (USD)
          </button>
          <button
            onClick={() => setMetric('transactions')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
              metric === 'transactions'
                ? 'bg-[#2aabab] text-black font-semibold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Transaction Count
          </button>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative mt-4 w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2aabab" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#2aabab" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#2aabab" />
              <stop offset="100%" stopColor="#6e93d4" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
            const y = height - padY - pct * chartH
            const labelVal = minVal + pct * (maxVal - minVal)
            return (
              <g key={idx}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="rgba(255,255,255,0.06)"
                  strokeDasharray="4 4"
                />
                <text
                  x={padX - 8}
                  y={y + 3}
                  textAnchor="end"
                  fill="rgba(255,255,255,0.3)"
                  fontSize="10"
                >
                  {metric === 'volume' ? `$${Math.round(labelVal)}` : Math.round(labelVal)}
                </text>
              </g>
            )
          })}

          {/* Area fill */}
          {areaD && <path d={areaD} fill="url(#areaGradient)" />}

          {/* Line stroke */}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Points */}
          {coords.map((c, idx) => (
            <circle
              key={idx}
              cx={c.x}
              cy={c.y}
              r={hoveredIdx === idx ? 6 : 3.5}
              fill={hoveredIdx === idx ? '#fff' : '#2aabab'}
              stroke="#0b1e47"
              strokeWidth={2}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            />
          ))}
        </svg>

        {/* Hover info tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute z-20 rounded-xl border border-white/20 bg-[#060e28]/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md"
            style={{
              left: `${(hovered.x / width) * 100}%`,
              top: `${(hovered.y / height) * 100}%`,
              transform: 'translate(-50%, -120%)',
            }}
          >
            <div className="font-semibold text-white">{hovered.point.date}</div>
            <div className="text-[#2aabab] font-medium mt-0.5">
              {metric === 'volume'
                ? `$${hovered.point.volumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                : `${hovered.point.txCount} transaction${hovered.point.txCount === 1 ? '' : 's'}`}
            </div>
            <div className="text-[10px] text-gray-400">
              {metric === 'volume'
                ? `${hovered.point.txCount} txs recorded`
                : `$${hovered.point.volumeUsd.toFixed(2)} volume`}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-gray-400">
        <span>Timeline spans verified production activity</span>
        <span>Grouped into daily privacy-preserving buckets</span>
      </div>
    </div>
  )
}

interface AssetDistributionProps {
  distribution: AssetDistributionItem[]
}

export function AssetDistributionChart({ distribution }: AssetDistributionProps) {
  const usdc = distribution.find((d) => d.asset === 'USDC') || {
    asset: 'USDC' as const,
    volumeUsd: 0,
    txCount: 0,
    percentage: 100,
  }
  const eurc = distribution.find((d) => d.asset === 'EURC') || {
    asset: 'EURC' as const,
    volumeUsd: 0,
    txCount: 0,
    percentage: 0,
  }

  return (
    <div
      className="rounded-2xl border p-6 flex flex-col justify-between"
      style={{
        background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PieChart className="h-4 w-4 text-[#2aabab]" />
            Asset Distribution
          </h3>
          <span className="text-xs text-gray-400">Stablecoins</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Settlement breakdown between native USDC and EURC
        </p>

        {/* Progress bar */}
        <div className="mt-5 h-3.5 w-full overflow-hidden rounded-full bg-white/5 flex p-0.5 border border-white/10">
          <div
            className="h-full rounded-full bg-[#2775CA] transition-all duration-500"
            style={{ width: `${Math.max(usdc.percentage, 5)}%` }}
            title={`USDC: ${usdc.percentage}%`}
          />
          <div
            className="h-full rounded-full bg-[#0052FF] transition-all duration-500 ml-1"
            style={{ width: `${eurc.percentage}%` }}
            title={`EURC: ${eurc.percentage}%`}
          />
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-3">
              <div className="relative h-7 w-7 rounded-full overflow-hidden bg-[#2775CA]/20 flex items-center justify-center p-1">
                <Image src="/usdc.webp" alt="USDC" width={24} height={24} className="rounded-full" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">USDC</div>
                <div className="text-xs text-gray-400">Circle USD Coin</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">
                ${usdc.volumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-[#2aabab]">{usdc.percentage}% ({usdc.txCount} txs)</div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3.5">
            <div className="flex items-center gap-3">
              <div className="relative h-7 w-7 rounded-full overflow-hidden bg-blue-500/20 flex items-center justify-center p-1">
                <Image src="/eurc.png" alt="EURC" width={24} height={24} className="rounded-full" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">EURC</div>
                <div className="text-xs text-gray-400">Circle Euro Coin</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-white">
                ${eurc.volumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-blue-400">{eurc.percentage}% ({eurc.txCount} txs)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-gray-400 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-[#2aabab]" />
        <span>Strict 6-decimal verification across all tokens</span>
      </div>
    </div>
  )
}

interface NetworkActivityProps {
  activity: NetworkActivityItem[]
}

export function NetworkActivityChart({ activity }: NetworkActivityProps) {
  // Ensure Arc is always presented first if present, followed by others
  const sorted = [...activity].sort((a, b) => {
    if (a.chainKey === 'ARC-TESTNET') return -1
    if (b.chainKey === 'ARC-TESTNET') return 1
    return b.volumeUsd - a.volumeUsd
  })

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#2aabab]" />
            Supported Network Ecosystem
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Verified activity across Arc Mainnet hub and connected CCTP networks
          </p>
        </div>
        <span className="rounded-full border border-teal-500/20 bg-teal-500/10 px-2.5 py-1 text-[11px] font-semibold text-[#2aabab]">
          Hub: Arc
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((item) => {
          const icon = CHAIN_ICONS[item.chainKey] || '/chains/arc.svg'
          return (
            <div
              key={item.chainKey}
              className="rounded-xl border border-white/5 bg-white/[0.02] p-3.5 transition-colors hover:border-white/10"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 p-1">
                    <Image
                      src={icon}
                      alt={item.chainName}
                      width={20}
                      height={20}
                      className="rounded"
                    />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-white">
                      {item.chainName}
                    </span>
                    {item.chainKey === 'ARC-TESTNET' && (
                      <span className="ml-1.5 text-[10px] text-[#2aabab] font-medium">
                        (Hub)
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-white">
                    ${item.volumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {item.txCount} tx{item.txCount === 1 ? '' : 's'}
                  </div>
                </div>
              </div>

              {/* Volume bar */}
              <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-[#2aabab]"
                  style={{ width: `${Math.max(item.percentage, 4)}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 border-t border-white/5 pt-3 text-[11px] text-gray-400">
        Note: Only networks with verified application transactions are credited. Unrelated external transfers on these chains are never attributed to Architect Pay.
      </div>
    </div>
  )
}

interface ProductActivityProps {
  activity: ProductActivityItem[]
}

export function ProductActivityChart({ activity }: ProductActivityProps) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="border-b border-white/5 pb-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <ArrowUpRight className="h-4 w-4 text-[#2aabab]" />
          Product Activity Composition
        </h3>
        <p className="text-xs text-gray-400 mt-0.5">
          Explicit segmentation between customer payments, business payroll, swaps, and sweeps
        </p>
      </div>

      <div className="mt-4 space-y-3">
        {activity.map((item) => (
          <div
            key={item.category}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3.5"
          >
            <div className="flex-1">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-sm font-semibold text-white">{item.label}</span>
                <span className="text-xs text-gray-400 sm:ml-2">
                  {item.txCount} transaction{item.txCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#2aabab] to-[#4a79c8]"
                  style={{ width: `${Math.max(item.percentage, 3)}%` }}
                />
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-sm font-bold text-white">
                ${item.volumeUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-gray-400">{item.percentage}% of overall activity</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

