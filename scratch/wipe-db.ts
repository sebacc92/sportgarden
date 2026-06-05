import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import {
  users,
  bookings,
  guestRequests,
  groupTransactions,
  pitchSubscriptions,
  cashMovements,
  transactions,
  cashRegisters,
  cashSessions,
} from "../src/db/schema";

config({ path: ".env.local" });

async function main() {
  if (!process.env.TURSO_DATABASE_URL) {
    console.error("Error: TURSO_DATABASE_URL is not set in .env.local");
    process.exit(1);
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(client);

  console.log("Starting database cleanup...");

  try {
    // 1. Delete guest requests (references bookings)
    console.log("Deleting guest requests...");
    const guestReqRes = await db.delete(guestRequests);
    console.log(`Deleted guest requests successfully.`);

    // 2. Delete group transactions (references bookings)
    console.log("Deleting group transactions...");
    const groupTransRes = await db.delete(groupTransactions);
    console.log(`Deleted group transactions successfully.`);

    // 3. Delete pitch subscriptions (references users and pitches)
    console.log("Deleting pitch subscriptions...");
    const pitchSubRes = await db.delete(pitchSubscriptions);
    console.log(`Deleted pitch subscriptions successfully.`);

    // 4. Delete bookings
    console.log("Deleting bookings...");
    const bookingsRes = await db.delete(bookings);
    console.log(`Deleted bookings successfully.`);

    // 5. Delete cash movements (references cash registers)
    console.log("Deleting cash movements...");
    const cashMovementsRes = await db.delete(cashMovements);
    console.log(`Deleted cash movements successfully.`);

    // 6. Delete transactions (references cash sessions)
    console.log("Deleting transactions...");
    const transactionsRes = await db.delete(transactions);
    console.log(`Deleted transactions successfully.`);

    // 7. Delete cash registers
    console.log("Deleting cash registers...");
    const cashRegistersRes = await db.delete(cashRegisters);
    console.log(`Deleted cash registers successfully.`);

    // 8. Delete cash sessions
    console.log("Deleting cash sessions...");
    const cashSessionsRes = await db.delete(cashSessions);
    console.log(`Deleted cash sessions successfully.`);

    // 9. Delete clients (users with role GUEST or REGISTERED)
    console.log("Deleting non-staff client users...");
    const clientsRes = await db
      .delete(users)
      .where(inArray(users.role, ["GUEST", "REGISTERED"]));
    console.log(`Deleted client users successfully.`);

    console.log("Database cleanup completed successfully!");
  } catch (error) {
    console.error("Error during database cleanup:", error);
  } finally {
    client.close();
    process.exit(0);
  }
}

main().catch(console.error);
