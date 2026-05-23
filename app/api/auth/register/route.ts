import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, signToken, setSessionCookie } from '@/lib/auth'
import { createCircleWallet } from '@/lib/circle'
import { z } from 'zod'

const schema = z.object({
  name:     z.string().min(1).max(100),
  email:    z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { name, email, password } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      )
    }

    const passwordHash = await hashPassword(password)
    const user = await db.user.create({
      data: { name, email, passwordHash },
    })

    // Provision Circle wallets on Arc Testnet + all CCTP source chains
    const { arcWallet, chainWallets, walletSetId } = await createCircleWallet(user.id)

    await db.wallet.create({
      data: {
        userId:         user.id,
        circleUserId:   user.id,
        circleWalletId: arcWallet.id,
        walletAddress:  arcWallet.address,
        walletSetId,
        chainWallets: {
          create: Object.entries(chainWallets).map(([chain, w]) => ({
            chain,
            circleWalletId: w.id,
          })),
        },
      },
    })

    const token = signToken({ userId: user.id, email: user.email })
    setSessionCookie(token)

    return NextResponse.json({ ok: true, name: user.name, email: user.email }, { status: 201 })
  } catch (err: unknown) {
    console.error('[register]', err)
    const message = err instanceof Error ? err.message : 'Registration failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
