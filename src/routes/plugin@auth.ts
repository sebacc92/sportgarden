import { QwikAuth$ } from "@auth/qwik";
import Google from "@auth/qwik/providers/google";
import { getDB, camelize, snakize } from "~/db";
import type { Adapter } from "@auth/core/adapters";

function SupabaseCustomAdapter(client: any): Adapter {
  return {
    async createUser(user) {
      const { data, error } = await client
        .from("users")
        .insert(snakize(user))
        .select()
        .single();
      if (error) throw error;
      return camelize<any>(data);
    },
    async getUser(id) {
      const { data, error } = await client
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return camelize<any>(data);
    },
    async getUserByEmail(email) {
      const { data, error } = await client
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      return camelize<any>(data);
    },
    async getUserByAccount({ providerAccountId, provider }) {
      const { data, error } = await client
        .from("accounts")
        .select("*, user:users(*)")
        .eq("provider", provider)
        .eq("provider_account_id", providerAccountId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const user = camelize<any>(data.user);
      return user;
    },
    async updateUser(user) {
      const { data, error } = await client
        .from("users")
        .update(snakize(user))
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
      return camelize<any>(data);
    },
    async deleteUser(userId) {
      const { error } = await client.from("users").delete().eq("id", userId);
      if (error) throw error;
    },
    async linkAccount(account) {
      const { data, error } = await client
        .from("accounts")
        .insert(snakize(account))
        .select()
        .single();
      if (error) throw error;
      return camelize<any>(data);
    },
    async unlinkAccount({ providerAccountId, provider }) {
      const { error } = await client
        .from("accounts")
        .delete()
        .eq("provider", provider)
        .eq("provider_account_id", providerAccountId);
      if (error) throw error;
    },
    async createSession(session) {
      const { data, error } = await client
        .from("sessions")
        .insert(snakize(session))
        .select()
        .single();
      if (error) throw error;
      return camelize<any>(data);
    },
    async getSessionAndUser(sessionToken) {
      const { data, error } = await client
        .from("sessions")
        .select("*, user:users(*)")
        .eq("session_token", sessionToken)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const session = camelize<any>({ ...data, user: undefined });
      const user = camelize<any>(data.user);
      return { session, user };
    },
    async updateSession(session) {
      const { data, error } = await client
        .from("sessions")
        .update(snakize(session))
        .eq("session_token", session.sessionToken)
        .select()
        .single();
      if (error) throw error;
      return camelize<any>(data);
    },
    async deleteSession(sessionToken) {
      const { error } = await client
        .from("sessions")
        .delete()
        .eq("session_token", sessionToken);
      if (error) throw error;
    },
    async createVerificationToken(verificationToken) {
      const { data, error } = await client
        .from("verification_tokens")
        .insert(snakize(verificationToken))
        .select()
        .single();
      if (error) throw error;
      return camelize<any>(data);
    },
    async useVerificationToken({ identifier, token }) {
      const { data, error } = await client
        .from("verification_tokens")
        .delete()
        .eq("identifier", identifier)
        .eq("token", token)
        .select()
        .maybeSingle();
      if (error) throw error;
      return camelize<any>(data);
    },
  };
}

export const { onRequest, useSession, useSignIn, useSignOut } = QwikAuth$(
  (event) => {
    const db = getDB(event);
    return {
      secret:
        event.env.get("AUTH_SECRET") ||
        (typeof process !== "undefined" ? process.env.AUTH_SECRET : undefined) ||
        "dummy_auth_secret_for_build_only",
      trustHost: true,
      providers: [
        Google({
          clientId: event.env.get("AUTH_GOOGLE_ID") || "dummy_google_id",
          clientSecret: event.env.get("AUTH_GOOGLE_SECRET") || "dummy_google_secret",
        }),
      ],
      adapter: SupabaseCustomAdapter(db),
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
          try {
            const { error } = await db
              .from("users")
              .update({ role: "REGISTERED" })
              .eq("id", message.user.id);
            if (error) throw error;
          } catch (err) {
            console.error("Error setting role to REGISTERED in createUser event:", err);
          }
        },
      },
    };
  }
);
