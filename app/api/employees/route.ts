import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth-server'
import { db } from '@/lib/db'
import { normalizeUsername } from '@/lib/recipient-resolver'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const schema = z.object({
  name:           z.string().min(1).max(100),
  walletAddress:  z.string().min(1).max(100),
  salary:         z.string().regex(/^\d+(\.\d{1,6})?$/).refine((v) => parseFloat(v) > 0),
  role:           z.string().max(100).optional(),
  businessId:     z.string().optional(),
  preferredChain: z.string().max(50).optional(),
  preferredToken: z.enum(['USDC', 'EURC']).optional(),
  avatarUrl:      z.string().optional(),
})

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const businessId = req.nextUrl.searchParams.get('businessId') ?? undefined

  const employees = await db.employee.findMany({
    where:   { userId: user.id, active: true, ...(businessId ? { businessId } : {}) },
    orderBy: { createdAt: 'asc' },
  })

  // Augment with Architect Pay user information
  const addresses = employees.map((e) => e.walletAddress)
  const wallets = await db.wallet.findMany({
    where:   { walletAddress: { in: addresses } },
    include: { user: { select: { username: true, displayName: true, image: true } } },
  })
  const walletMap = new Map(wallets.map((w) => [w.walletAddress.toLowerCase(), w]))

  const augmented = employees.map((e) => {
    const w = walletMap.get(e.walletAddress.toLowerCase())
    return {
      ...e,
      isArchitectPayUser: !!w,
      username:           w?.user?.username ?? null,
      displayName:        w?.user?.displayName ?? null,
      preferredChain:     w ? 'ARC-TESTNET' : e.preferredChain,
    }
  })

  return NextResponse.json({ employees: augmented })
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
  }

  const rawAddress = parsed.data.walletAddress.trim()
  let finalAddress   = rawAddress
  let preferredChain = parsed.data.preferredChain ?? 'ARC-TESTNET'
  let avatarUrl      = parsed.data.avatarUrl

  // Handle username input (e.g. @username or username)
  if (rawAddress.startsWith('@') || !rawAddress.startsWith('0x')) {
    const username = normalizeUsername(rawAddress)
    const targetUser = await db.user.findUnique({
      where:   { username },
      include: { wallet: true },
    })
    if (!targetUser || !targetUser.wallet) {
      return NextResponse.json({ error: `Architect Pay user "@${username}" not found or has no active wallet.` }, { status: 400 })
    }
    finalAddress   = targetUser.wallet.walletAddress
    preferredChain = 'ARC-TESTNET'
    avatarUrl      = targetUser.image ?? avatarUrl
  } else {
    // Validate EVM address
    if (!/^0x[a-fA-F0-9]{40}$/.test(rawAddress)) {
      return NextResponse.json({ error: 'Invalid EVM wallet address' }, { status: 400 })
    }
    // If it belongs to a registered Architect Pay user, force Arc settlement
    const internalWallet = await db.wallet.findFirst({
      where: { walletAddress: { equals: rawAddress, mode: 'insensitive' } },
    })
    if (internalWallet) {
      preferredChain = 'ARC-TESTNET'
    }
  }

  const employee = await db.employee.create({
    data: {
      userId:         user.id,
      name:           parsed.data.name,
      walletAddress:  finalAddress,
      salary:         parsed.data.salary,
      role:           parsed.data.role,
      businessId:     parsed.data.businessId,
      preferredChain,
      preferredToken: parsed.data.preferredToken ?? 'USDC',
      avatarUrl,
    },
  })

  return NextResponse.json({ employee }, { status: 201 })
}
