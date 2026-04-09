import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { NextAuthOptions } from "next-auth";

const allowedEmails = (process.env.ALLOWED_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      // If ALLOWED_EMAILS is set, restrict access to those emails only
      if (allowedEmails.length > 0) {
        return allowedEmails.includes((user.email ?? "").toLowerCase());
      }
      // Otherwise allow any Google account
      return true;
    },
    async session({ session }) {
      return session;
    },
  },
  pages: {
    signIn:  "/login",
    error:   "/login",
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
