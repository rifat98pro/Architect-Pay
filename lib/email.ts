import nodemailer from 'nodemailer'

export function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function sendVerificationEmail(to: string, code: string) {
  if (!process.env.SMTP_HOST) {
    // Dev fallback: log to console when SMTP is not configured
    console.log(`\n[EMAIL VERIFICATION] To: ${to} | Code: ${code}\n`)
    return
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from:    process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: 'Your Architect Pay verification code',
    text:    `Your verification code is: ${code}\n\nThis code expires in 10 minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:40px 24px;background:#0d1926;border-radius:16px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:28px;">
          <span style="font-size:20px;font-weight:700;color:#ffffff;">Architect</span>
          <span style="font-size:20px;font-weight:700;color:#2aabab;">Pay</span>
        </div>
        <p style="color:#cbd5e1;font-size:15px;margin-bottom:8px;">Your email verification code is:</p>
        <div style="font-size:40px;font-weight:800;letter-spacing:10px;color:#2aabab;background:#0a1520;border:1px solid rgba(42,171,171,0.25);border-radius:12px;text-align:center;padding:20px 16px;margin:20px 0;">
          ${code}
        </div>
        <p style="color:#64748b;font-size:13px;line-height:1.6;">
          This code expires in <strong style="color:#94a3b8;">10 minutes</strong>.<br/>
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })
}
