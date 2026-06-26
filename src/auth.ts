import { SvelteKitAuth } from "@auth/sveltekit"
import Google from "@auth/sveltekit/providers/google"
import { env } from "$env/dynamic/private"

export const { handle, signIn, signOut } = SvelteKitAuth({
  trustHost: true,
  basePath: "/auth",
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET
    })
  ],
  callbacks: {
    async signIn({ user }) {
      // RESTRICT ACCESS: Only allow your work email
      // Note: You should update this with your actual work email
      const allowedEmails = ["jmgant@cleareyeconsulting.com"];
      return allowedEmails.includes(user.email ?? "");
    }
  }
})
