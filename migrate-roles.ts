import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { users } from "./src/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(turso);

  console.log("Migrando roles...");
  // Actually we need to just update where role = 'ADMIN' to 'OWNER'
  // But wait, the role column is just text, so we can run raw SQL or drizzle.

  // Drizzle way
  await db
    .update(users)
    .set({ role: "OWNER" })
    .where(eq(users.role, "ADMIN" as any));

  console.log("Roles migrados exitosamente. Todos los ADMIN ahora son OWNER.");
  process.exit(0);
}

main().catch(console.error);
