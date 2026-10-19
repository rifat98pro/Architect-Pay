import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(db),
  providers: [
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Always show the account chooser. Without this Google silently reuses
      // whichever account the browser is already signed into, so someone trying to
      // register a second Gmail is signed straight back into the first one with no
      // indication it happened.
      authorization: { params: { prompt: 'select_account' } },

      // Link Google to an existing email/password account with the same address.
      // NextAuth calls this dangerous because for a provider that does not verify
      // email ownership it is an account-takeover vector. Google does verify it,
      // and anyone controlling that mailbox could already take the account over
      // through password reset — so this adds no new exposure, and without it a
      // user who registered with a password is simply locked out of the Google
      // button with an OAuthAccountNotLinked code and no explanation.
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      credentials: {
        identifier: { label: 'Email or Username', type: 'text'     },
        password:   { label: 'Password',          type: 'password' },
      },
      async authorize(credentials) {
        const identifier = (credentials?.identifier as string | undefined)?.trim()
        const password   = credentials?.password as string | undefined
        if (!identifier || !password) return null

        // Look up by email if it contains '@', otherwise by username
        const user = identifier.includes('@')
          ? await db.user.findUnique({ where: { email: identifier } })
          : await db.user.findUnique({ where: { username: identifier } })

        if (!user?.passwordHash) return null
        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null
        return { id: user.id, email: user.email, name: user.displayName ?? user.name, image: user.image }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
    error:  '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string
        const u = await db.user.findUnique({ where: { id: token.id as string }, select: { displayName: true, image: true, username: true } })
        if (u?.displayName) session.user.name  = u.displayName
        if (u?.image)       session.user.image = u.image
        ;(session.user as any).username = u?.username ?? null
      }
      return session
    },
    async signIn() {
      return true
    },
  },
})
