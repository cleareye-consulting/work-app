import { SvelteKitAuth } from "@auth/sveltekit"
import Google from "@auth/sveltekit/providers/google"
import { env } from "$env/dynamic/private"

export const { handle, signIn, signOut } = SvelteKitAuth(async () => ({
  trustHost: true,
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET
    })
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = ["jmgant@cleareyeconsulting.com"];
      return allowedEmails.includes(user.email ?? "");
    }
  }
}))
