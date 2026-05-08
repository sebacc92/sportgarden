import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./src/db/schema";
import { eq } from "drizzle-orm";
import { config } from "dotenv";
import bcrypt from "bcryptjs";

config({ path: ".env.local" });

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(turso, { schema });

  const newUsers = [
    { username: 'vanesa', role: 'MANAGER', pass: 'vanesa2026' },
    { username: 'agostina', role: 'MANAGER', pass: 'agostina2026' },
    { username: 'mariajose', role: 'EMPLOYEE', pass: 'mariajose2026' },
    { username: 'gardenclub', role: 'OWNER', pass: 'garden2026' },
    { username: 'diego', role: 'DEV', pass: 'diego2026' },
    { username: 'seba', role: 'DEV', pass: 'seba2026' },
  ];

  console.log("Creando/actualizando usuarios solicitados...");

  for (const u of newUsers) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.name, u.username) });
    const hashed = bcrypt.hashSync(u.pass, 10);
    
    if (existing) {
      await db.update(schema.users).set({ role: u.role as any, password: hashed }).where(eq(schema.users.id, existing.id));
      console.log(`✅ Usuario ${u.username} actualizado.`);
    } else {
      await db.insert(schema.users).values({
        id: crypto.randomUUID(),
        name: u.username,
        role: u.role as any,
        password: hashed
      });
      console.log(`✅ Usuario ${u.username} creado.`);
    }
  }

  console.log("Proceso terminado.");
  process.exit(0);
}

main().catch(console.error);
