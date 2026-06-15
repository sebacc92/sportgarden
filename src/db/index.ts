import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RequestEventBase } from "@builder.io/qwik-city";

let globalSupabase: SupabaseClient | undefined;

export function getDB(requestEvent: RequestEventBase): SupabaseClient {
  const url =
    requestEvent.env.get("PUBLIC_SUPABASE_URL") ||
    (typeof process !== "undefined" ? process.env.PUBLIC_SUPABASE_URL : undefined);
  const key =
    requestEvent.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
    requestEvent.env.get("SUPABASE_ANON_KEY") ||
    (typeof process !== "undefined"
      ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
      : undefined);

  if (!url || !key) {
    console.warn(
      "WARNING: PUBLIC_SUPABASE_URL or SUPABASE_KEY (SERVICE_ROLE/ANON) is not defined. Returning mock client for build-time / SSG compatibility."
    );
    return new Proxy(
      {},
      {
        get() {
          return () => {
            throw new Error(
              "Supabase URL or Key is not defined. Cannot execute queries."
            );
          };
        },
      }
    ) as SupabaseClient;
  }

  if (!globalSupabase) {
    globalSupabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return globalSupabase;
}

export function camelize<T = any>(obj: any): T {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => camelize(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const n: any = {};
    for (const k of Object.keys(obj)) {
      const camelKey = k.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      n[camelKey] = camelize(obj[k]);
    }
    return n as T;
  }
  return obj as T;
}

export function snakize<T = any>(obj: any): T {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map((item) => snakize(item)) as any;
  }
  if (typeof obj === "object" && !(obj instanceof Date)) {
    const n: any = {};
    for (const k of Object.keys(obj)) {
      const snakeKey = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      n[snakeKey] = obj[k];
    }
    return n as T;
  }
  return obj as T;
}

export { getDB as getSupabase };
