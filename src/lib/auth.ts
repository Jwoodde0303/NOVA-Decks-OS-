import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "@/db/client";
import { env } from "@/lib/env";

const globalForAuth = globalThis as unknown as { __novaAuth?: ReturnType<typeof createAuth> };

function createAuth() {
  return betterAuth({
    appName: "NOVA Decks OS",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
    }),
    emailAndPassword: { enabled: true, disableSignUp: !env.ALLOW_SIGNUP, minPasswordLength: 10 },
    session: { expiresIn: 60 * 60 * 24 * 14, updateAge: 60 * 60 * 24 },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
    plugins: [nextCookies()],
  });
}

export function getAuth() {
  if (!globalForAuth.__novaAuth) globalForAuth.__novaAuth = createAuth();
  return globalForAuth.__novaAuth;
}
