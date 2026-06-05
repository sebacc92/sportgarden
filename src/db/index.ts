import type { RequestEventBase } from "@builder.io/qwik-city";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let globalClient: ReturnType<typeof postgres> | undefined;
let globalDb: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDB(requestEvent: RequestEventBase) {
  const connectionString = requestEvent.env.get("DATABASE_URL") || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
  }
  
  if (!globalDb) {
    globalClient = postgres(connectionString, { prepare: false });
    globalDb = drizzle(globalClient, { schema });
  }
  
  return globalDb;
}

// Export global db for scripts/migrations compatibility
const connectionString = process.env.DATABASE_URL || "";
export const db = connectionString
  ? drizzle(postgres(connectionString, { prepare: false }), { schema })
  : null as any;
