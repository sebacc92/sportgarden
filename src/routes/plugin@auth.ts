import { QwikAuth$ } from "@auth/qwik";
import Google from "@auth/qwik/providers/google";
import { getDB, camelize, snakize } from "~/db";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken,
} from "@auth/core/adapters";

function SupabaseCustomAdapter(client: any): Adapter {
  return {
    async createUser(user: AdapterUser): Promise<AdapterUser> {
      const { data, error } = await client
        .from("users")
        .insert(snakize(user))
        .select()
        .single();
      if (error) throw error;
      return camelize<AdapterUser>(data);
    },
    async getUser(id: string): Promise<AdapterUser | null> {
      const { data, error } = await client
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return camelize<AdapterUser>(data);
    },
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const { data, error } = await client
        .from("users")
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return camelize<AdapterUser>(data);
    },
    async getUserByAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }): Promise<AdapterUser | null> {
      const { data, error } = await client
        .from("accounts")
        .select("*, user:users(*)")
        .eq("provider", provider)
        .eq("provider_account_id", providerAccountId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const user = camelize<AdapterUser>(data.user);
      return user;
    },
    async updateUser(
      user: Partial<AdapterUser> & Pick<AdapterUser, "id">
    ): Promise<AdapterUser> {
      const { data, error } = await client
        .from("users")
        .update(snakize(user))
        .eq("id", user.id)
        .select()
        .single();
      if (error) throw error;
      return camelize<AdapterUser>(data);
    },
    async deleteUser(userId: string): Promise<void> {
      const { error } = await client.from("users").delete().eq("id", userId);
      if (error) throw error;
    },
    async linkAccount(account: AdapterAccount): Promise<any> {
      const { data, error } = await client
        .from("accounts")
        .insert(snakize(account))
        .select()
        .single();
      if (error) throw error;
      return camelize<AdapterAccount>(data);
    },
    async unlinkAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }): Promise<void> {
      const { error } = await client
        .from("accounts")
        .delete()
        .eq("provider", provider)
        .eq("provider_account_id", providerAccountId);
      if (error) throw error;
    },
    async createSession(session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }): Promise<AdapterSession> {
      const { data, error } = await client
        .from("sessions")
        .insert(snakize(session))
        .select()
        .single();
      if (error) throw error;
      return camelize<AdapterSession>(data);
    },
    async getSessionAndUser(
      sessionToken: string
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const { data, error } = await client
        .from("sessions")
        .select("*, user:users(*)")
        .eq("session_token", sessionToken)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const session = camelize<AdapterSession>({ ...data, user: undefined });
      const user = camelize<AdapterUser>(data.user);
      return { session, user };
    },
    async updateSession(
      session: Partial<AdapterSession> & Pick<AdapterSession, "sessionToken">
    ): Promise<AdapterSession | null | undefined> {
      const { data, error } = await client
        .from("sessions")
        .update(snakize(session))
        .eq("session_token", session.sessionToken)
        .select()
        .single();
      if (error) throw error;
      return camelize<AdapterSession>(data);
    },
    async deleteSession(sessionToken: string): Promise<void> {
      const { error } = await client
        .from("sessions")
        .delete()
        .eq("session_token", sessionToken);
      if (error) throw error;
    },
    async createVerificationToken(
      verificationToken: VerificationToken
    ): Promise<VerificationToken | null | undefined> {
      const { data, error } = await client
        .from("verification_tokens")
        .insert(snakize(verificationToken))
        .select()
        .single();
      if (error) throw error;
      return camelize<VerificationToken>(data);
    },
    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }): Promise<VerificationToken | null> {
      const { data, error } = await client
        .from("verification_tokens")
        .delete()
        .eq("identifier", identifier)
        .eq("token", token)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return camelize<VerificationToken>(data);
    },
  };
}

// Export SupabaseAdapter so it is imported and exported/available as requested
export { SupabaseAdapter };

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
      session: {
        strategy: "jwt",
      },
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

