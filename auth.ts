import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import { createCircleWallet } from '@/lib/circle'

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'database' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) session.user.id = user.id
      return session
    },
    async signIn({ user }) {
      // Provision Circle wallet on first sign-in (runs once per user)
      if (!user.id) return true
      try {
        const existing = await db.wallet.findUnique({ where: { userId: user.id } })
        if (!existing) {
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
                  circleWalletId: (w as { id: string }).id,
                })),
              },
            },
          })
        }
      } catch (err) {
        console.error('[auth] wallet provisioning failed:', err)
        // Don't block sign-in — wallet can be retried
      }
      return true
    },
  },
})
