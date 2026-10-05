import Link from 'next/link'
import Image from 'next/image'

export const metadata = { title: 'Privacy Policy – Architect Pay' }

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-500">Effective date: October 5, 2026</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Information We Collect</h2>
            <p className="mb-2">When you use Architect Pay, we collect the following information:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong className="text-gray-300">Account data:</strong> Name, email address, username, and hashed password when you register.</li>
              <li><strong className="text-gray-300">Wallet data:</strong> Your Circle wallet address and wallet ID, generated on account creation.</li>
              <li><strong className="text-gray-300">Transaction data:</strong> Payment amounts, recipient addresses, token types, chain routes, and timestamps.</li>
              <li><strong className="text-gray-300">Payroll data:</strong> Employee names, wallet addresses, salaries, and payroll run history.</li>
              <li><strong className="text-gray-300">Usage data:</strong> Pages visited, actions taken, and error logs to improve the Service.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. How We Use Your Information</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To provision and operate your Circle wallet and process on-chain transactions.</li>
              <li>To send transactional emails including OTP verification codes and password reset links.</li>
              <li>To maintain your payment and payroll history within the app.</li>
              <li>To detect and prevent fraud, abuse, and unauthorized access.</li>
              <li>To communicate important updates about the Service, including mainnet launch.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Third-Party Services</h2>
            <p className="mb-2">We work with the following third-party providers:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><strong className="text-gray-300">Circle:</strong> Wallet infrastructure and CCTP cross-chain transfers. Circle processes wallet creation and all on-chain operations.</li>
              <li><strong className="text-gray-300">Neon (PostgreSQL):</strong> Database hosting for your account, payment, and payroll data.</li>
              <li><strong className="text-gray-300">Resend:</strong> Transactional email delivery for verification codes and password resets.</li>
              <li><strong className="text-gray-300">Google:</strong> Optional OAuth sign-in via Google. If used, Google may share your name, email, and profile picture with us.</li>
              <li><strong className="text-gray-300">Vercel:</strong> Hosting and serverless infrastructure for the application.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Blockchain Data</h2>
            <p>On-chain transactions (payments, payroll, swaps) are recorded permanently on public blockchains. Your wallet address and transaction amounts are publicly visible on block explorers. We cannot delete or modify on-chain data.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Data Retention</h2>
            <p>We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data from our database within 30 days, except where retention is required by law. On-chain data is permanent and cannot be removed.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Security</h2>
            <p>Passwords are stored as bcrypt hashes and never in plain text. API keys and entity secrets are stored as environment variables and never exposed to the client. We use HTTPS for all data in transit. Despite our efforts, no system is 100% secure — please use a strong, unique password.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Your Rights</h2>
            <p className="mb-2">Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and personal data.</li>
              <li>Object to certain processing of your data.</li>
            </ul>
            <p className="mt-2">To exercise these rights, contact us via Discord or email below.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Children&apos;s Privacy</h2>
            <p>The Service is not directed to individuals under the age of 18. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data, please contact us immediately.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or a notice on the platform. Continued use of the Service after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">10. Contact</h2>
            <p>Questions or concerns about your privacy? Reach us on our <a href="https://discord.gg/e3uZqjpRCp" target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline">Discord server</a> or at <a href="mailto:team@mail.architectpay.website" className="text-brand-400 hover:underline">team@mail.architectpay.website</a>.</p>
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
