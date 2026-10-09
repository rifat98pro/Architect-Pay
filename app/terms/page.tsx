import Link from 'next/link'
import Image from 'next/image'

export const metadata = { title: 'Terms of Service – Architect Pay' }

export default function TermsPage() {
  return (
    <div className="min-h-screen" style={{ background: '#000', color: '#e2eaf4' }}>

      <header className="border-b border-white/5 px-6 py-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="Architect Pay" width={28} height={28} className="rounded-lg object-contain" />
            <span className="font-bold">
              <span style={{ color: '#c5d3ed' }}>Architect</span>
              <span style={{ color: '#2aabab' }}> Pay</span>
            </span>
          </Link>
          <Link href="/" className="text-xs text-gray-500 hover:text-white transition">← Back to home</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
          <p className="mt-2 text-sm text-gray-500">Effective date: October 5, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Acceptance of Terms</h2>
            <p>By accessing or using Architect Pay (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all users, including individuals and businesses.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. Description of Service</h2>
            <p>Architect Pay is a non-custodial blockchain payment infrastructure that allows users to send stablecoins (USDC and EURC) across multiple EVM-compatible networks, run payroll for employees, and manage on-chain treasury. The Service is currently operating on testnet only. All tokens used are test tokens with no real monetary value until mainnet launch.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Eligibility</h2>
            <p>You must be at least 18 years old and have the legal capacity to enter into a binding agreement. By using the Service, you represent and warrant that you meet these requirements and that your use complies with all applicable laws in your jurisdiction.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Wallets and Transactions</h2>
            <p className="mb-2">Architect Pay uses Circle Developer-Controlled Wallets. By using the Service:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>You acknowledge that blockchain transactions are irreversible once confirmed on-chain.</li>
              <li>You are solely responsible for ensuring recipient wallet addresses are correct before sending.</li>
              <li>Cross-chain transfers via Circle CCTP may take 2–10 minutes to settle and cannot be cancelled after initiation.</li>
              <li>Architect Pay charges a 0.01% platform fee on cross-chain payments, cross-chain swaps, and payroll runs.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Prohibited Uses</h2>
            <p className="mb-2">You agree not to use the Service for:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Any unlawful activity including money laundering, fraud, or sanctions evasion.</li>
              <li>Sending funds to sanctioned individuals, entities, or jurisdictions.</li>
              <li>Attempting to exploit, hack, or disrupt the Service or its underlying infrastructure.</li>
              <li>Creating multiple accounts to circumvent restrictions or abuse the platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Testnet Disclaimer</h2>
            <p>During the testnet phase, all USDC and EURC balances are test tokens with no real monetary value. Architect Pay makes no guarantee of uptime, data persistence, or continuity during the testnet phase. Testnet data may be reset at any time.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Architect Pay and its team shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of funds, loss of data, or business interruption, arising from your use of or inability to use the Service.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Modifications</h2>
            <p>We reserve the right to update these Terms at any time. Material changes will be communicated via email or a notice on the platform. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Contact</h2>
            <p>Questions about these Terms? Reach us on our <a href="https://discord.gg/e3uZqjpRCp" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Discord server</a> or at <a href="mailto:team@mail.architectpay.website" className="text-brand-400 hover:underline">team@mail.architectpay.website</a>.</p>
          </section>

        </div>
      </main>

      <footer className="border-t px-6 py-6 text-center text-xs text-gray-600" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-center gap-4">
          <Link href="/terms"   className="hover:text-white transition">Terms of Service</Link>
          <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
          <Link href="/"        className="hover:text-white transition">Home</Link>
        </div>
        <p className="mt-3">© 2026 Architect Pay. All rights reserved.</p>
      </footer>
    </div>
  )
}
