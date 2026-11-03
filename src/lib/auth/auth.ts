import NextAuth, { DefaultSession, CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { UserRole } from "@prisma/client"

// Custom error for email not verified
class EmailNotVerifiedError extends CredentialsSignin {
  code = "EMAIL_NOT_VERIFIED"
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
      organizationId?: string | null
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    organizationId?: string | null
  }
}

// `unstable_update` omogoča server actionom osvežitev JWT seje (nova
// vloga/povezana organizacija) brez ponovne prijave — uporablja onboarding
// #40: obstoječ račun, ki ustvari podjetje, dobi organizationId + role ADMIN
// v ISTI seji (dashboard takoj dostopen).
export const { handlers, signIn, signOut, auth, unstable_update } = NextAuth({
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email as string,
          },
        })

        if (!user || !user.password) {
          throw new Error("Invalid credentials")
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        // Block login if email is not verified
        if (!user.emailVerified) {
          throw new EmailNotVerifiedError()
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          image: user.image,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.organizationId = user.organizationId ?? null
      }
      // #40: server action (unstable_update) pošlje sveže vrednosti kot
      // user patch — prepiši token polja, da seja odraža novo stanje računa.
      if (trigger === "update" && session) {
        const patch = session.user as
          | { role?: UserRole; organizationId?: string | null }
          | undefined
        if (patch) {
          if (typeof patch.role !== "undefined") token.role = patch.role
          if (typeof patch.organizationId !== "undefined") {
            token.organizationId = patch.organizationId
          }
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.user.organizationId = (token.organizationId as string | null) ?? null
      }
      return session
    },
  },
})
