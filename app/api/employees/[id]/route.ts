import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

import { normalizeUsername } from '@/lib/recipient-resolver'

const editSchema = z.object({
  name:           z.string().min(1).max(100).optional(),
  walletAddress:  z.string().min(1).max(100).optional(),
  salary:         z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0).optional(),
  role:           z.string().max(100).optional(),
  preferredChain: z.string().max(50).optional(),
  preferredToken: z.enum(['USDC', 'EURC']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee || employee.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body   = await req.json()
  const parsed = editSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const updateData = { ...parsed.data }

  if (updateData.walletAddress) {
    const raw = updateData.walletAddress.trim()
    if (raw.startsWith('@') || !raw.startsWith('0x')) {
      const username = normalizeUsername(raw)
      const targetUser = await db.user.findUnique({
        where:   { username },
        include: { wallet: true },
      })
      if (!targetUser || !targetUser.wallet) {
        return NextResponse.json({ error: `Architect Pay user "@${username}" not found or has no active wallet.` }, { status: 400 })
      }
      updateData.walletAddress  = targetUser.wallet.walletAddress
      updateData.preferredChain = 'ARC-TESTNET'
    } else {
      if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) {
        return NextResponse.json({ error: 'Invalid EVM wallet address' }, { status: 400 })
      }
      const internalWallet = await db.wallet.findFirst({
        where: { walletAddress: { equals: raw, mode: 'insensitive' } },
      })
      if (internalWallet) {
        updateData.preferredChain = 'ARC-TESTNET'
      }
    }
  }

  const updated = await db.employee.update({ where: { id }, data: updateData })
  return NextResponse.json({ employee: updated })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const employee = await db.employee.findUnique({ where: { id } })
  if (!employee || employee.userId !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.employee.update({ where: { id }, data: { active: false } })

  return NextResponse.json({ ok: true })
}
