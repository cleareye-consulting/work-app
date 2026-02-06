import { SvelteKitAuth } from "@auth/sveltekit"
import Google from "@auth/sveltekit/providers/google"
import { AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET } from "$env/static/private"

export const { handle, signIn, signOut } = SvelteKitAuth({
  trustHost: true,
  basePath: "/auth",
  providers: [
    Google({ 
      clientId: AUTH_GOOGLE_ID, 
      clientSecret: AUTH_GOOGLE_SECRET 
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
