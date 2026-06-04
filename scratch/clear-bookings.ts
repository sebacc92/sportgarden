import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(turso, { schema });

  console.log("Conectado a la base de datos Turso.");
  console.log("Eliminando registros dependientes...");
  
  await db.delete(schema.guestRequests);
  await db.delete(schema.groupTransactions);
  await db.delete(schema.transactions);
  
  console.log("Eliminando todas las reservas (bookings)...");
  await db.delete(schema.bookings);
  
  console.log("¡Todas las reservas y registros asociados han sido eliminados con éxito!");
  process.exit(0);
}

main().catch(console.error);
