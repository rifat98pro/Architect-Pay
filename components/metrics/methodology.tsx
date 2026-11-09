'use client'

import React from 'react'
import { ShieldCheck, Database, Layers, CheckCircle, AlertCircle, Lock } from 'lucide-react'

export function MethodologySection() {
  return (
    <div
      className="rounded-2xl border p-6 md:p-8"
      style={{
        background: 'linear-gradient(135deg, rgba(11, 30, 71, 0.6) 0%, rgba(6, 14, 40, 0.8) 100%)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <div className="flex items-center gap-2.5 text-[#2aabab]">
        <ShieldCheck className="h-5 w-5" />
        <h3 className="text-lg font-bold text-white">
          Methodology, Verification & Data Privacy
        </h3>
      </div>
      <p className="mt-1 text-sm text-gray-400">
        Transparent reporting standards and verification criteria powering the Architect Pay metrics.
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {/* Source of Truth */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Database className="h-4 w-4 text-[#2aabab]" />
            Application Database Accounting
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            All account counts, transaction states, and batch records originate directly from the Architect Pay PostgreSQL application database. Metrics strictly require a completed state (<code className="text-[#2aabab]">status: &apos;COMPLETED&apos;</code>). Pending, failed, cancelled, or reverted operations are permanently excluded from all totals.
          </p>
        </div>

        {/* On-Chain Verification */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Layers className="h-4 w-4 text-[#4a79c8]" />
            Independent On-Chain Verification
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            Transaction hashes (<code className="text-[#2aabab]">txHash</code>, <code className="text-[#2aabab]">burnTxHash</code>, <code className="text-[#2aabab]">mintTxHash</code>) are queried via standard JSON-RPC endpoints on Arc Mainnet, Base, Arbitrum, Polygon, Avalanche, and Optimism. Verification confirms receipt status (<code className="text-[#2aabab]">0x1 success</code>), target token contracts, and 6-decimal precision.
          </p>
        </div>

        {/* Volume Calculation & Deduplication */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <CheckCircle className="h-4 w-4 text-emerald-400" />
            Volume Calculation & Deduplication
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            Payment volume includes customer-initiated direct payments and completed employee payroll disbursements. Swaps and balance consolidations (sweeps) are tracked and displayed separately so pure payment adoption is never conflated with liquidity routing. Hashes are deduplicated to ensure zero multi-hop double counting.
          </p>
        </div>

        {/* Privacy Safeguards */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Lock className="h-4 w-4 text-amber-400" />
            Strict Data Privacy & Anonymization
          </div>
          <p className="mt-2 text-xs leading-relaxed text-gray-400">
            This dashboard and its public API endpoint (<code className="text-[#2aabab]">/api/public-metrics</code>) exclusively publish high-level aggregated numbers. No user names, email addresses, wallet addresses, user IDs, employee payroll records, or transaction histories are exposed under any circumstance.
          </p>
        </div>
      </div>

      {/* Internal vs External Testing Note */}
      <div className="mt-6 rounded-xl border border-white/5 bg-white/[0.01] p-4 text-xs text-gray-400">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-white">Internal Testing vs. External Adoption: </span>
            Architect Pay has undergone internal team testing. In adherence to transparency guidelines, internal transfers (between registered Architect Pay account wallets) are classified and presented distinctly from external payouts to third-party recipients and business payroll runs.
          </div>
        </div>
      </div>
    </div>
  )
}

