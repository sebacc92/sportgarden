import type { RequestEventBase } from "@builder.io/qwik-city";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let globalClient: ReturnType<typeof postgres> | undefined;
let globalDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDB(requestEvent: RequestEventBase) {
  const connectionString =
    requestEvent.env.get("DATABASE_URL") ||
    (typeof process !== "undefined" ? process.env.DATABASE_URL : undefined);

  if (!connectionString) {
    console.warn(
      "WARNING: DATABASE_URL is not defined in getDB. Using dummy connection string for build-time / SSG compatibility."
    );
    return new Proxy(
      {},
      {
        get() {
          return () => {
            throw new Error(
              "DATABASE_URL is not defined. Cannot execute queries on mock database."
            );
          };
        },
      }
    ) as ReturnType<typeof drizzle<typeof schema>>;
  }

  if (!globalDb) {
    globalClient = postgres(connectionString, { prepare: false });
    globalDb = drizzle(globalClient, { schema });
  }

  return globalDb;
}

// Export global db for scripts/migrations compatibility (using lazy proxy to prevent top-level execution)
let lazyDb: any = null;
export const db = new Proxy(
  {},
  {
    get(target, prop) {
      if (!lazyDb) {
        const connectionString =
          typeof process !== "undefined" ? process.env.DATABASE_URL : undefined;
        if (!connectionString) {
          throw new Error("DATABASE_URL environment variable is not defined");
        }
        lazyDb = drizzle(postgres(connectionString, { prepare: false }), {
          schema,
        });
      }
      return (lazyDb as any)[prop];
    },
  }
) as ReturnType<typeof drizzle<typeof schema>>;
