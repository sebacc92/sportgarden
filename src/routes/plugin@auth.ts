import { QwikAuth$ } from "@auth/qwik";
import Google from "@auth/qwik/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDB } from "~/db";
import * as schema from "~/db/schema";
import { eq } from "drizzle-orm";

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  (event) => {
    const db = getDB(event);
    return {
      trustHost: true,
      providers: [
        Google({
          clientId: event.env.get("AUTH_GOOGLE_ID") || "dummy_google_id",
          clientSecret: event.env.get("AUTH_GOOGLE_SECRET") || "dummy_google_secret",
        }),
      ],
      adapter: DrizzleAdapter(db, {
        usersTable: schema.users,
        accountsTable: schema.accounts,
        sessionsTable: schema.sessions,
        verificationTokensTable: schema.verificationTokens,
      }),
      callbacks: {
        async session({ session, user }) {
          if (session?.user && user) {
            session.user.id = user.id;
          }
          return session;
        },
      },
      events: {
        async createUser(message) {
          if (!message.user.id) return;
          // When a user is created via Google sign-in, update their role to REGISTERED
          try {
            await db
              .update(schema.users)
              .set({ role: "REGISTERED" })
              .where(eq(schema.users.id, message.user.id));
          } catch (err) {
            console.error("Error setting role to REGISTERED in createUser event:", err);
          }
        },
      },
    };
  }
);
