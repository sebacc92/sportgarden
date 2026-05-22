import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { bookings, guestRequests, cashMovements, groupTransactions } from "./src/db/schema";
import { count } from "drizzle-orm";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function checkCounts() {
  console.log("Conectando a Turso y contando registros...");
  try {
    const [bookingsCount] = await db.select({ value: count() }).from(bookings);
    const [guestRequestsCount] = await db.select({ value: count() }).from(guestRequests);
    const [cashMovementsCount] = await db.select({ value: count() }).from(cashMovements);
    const [groupTransactionsCount] = await db.select({ value: count() }).from(groupTransactions);

    console.log("--- RESULTADOS DE BÚSQUEDA ---");
    console.log(`Reservas (bookings): ${bookingsCount.value}`);
    console.log(`Solicitudes de Invitados (guestRequests): ${guestRequestsCount.value}`);
    console.log(`Movimientos de Caja (cashMovements): ${cashMovementsCount.value}`);
    console.log(`Transacciones de Grupo (groupTransactions): ${groupTransactionsCount.value}`);
  } catch (error) {
    console.error("Error al contar registros:", error);
  } finally {
    client.close();
  }
}

checkCounts();
