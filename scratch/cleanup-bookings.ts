import { getDB } from "../src/db/index";
import {
  bookings,
  guestRequests,
  cashMovements,
  pitchSubscriptions,
} from "../src/db/schema";
import { sql } from "drizzle-orm";

async function cleanup() {
  // We need a mock request event or just use the env variables
  // Since we are running this as a script, we can bypass getDB and use the client directly if we want
  // but let's try to use the existing setup if possible.

  // Actually, let's just use the direct client for simplicity in a scratch script
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });

  const db = drizzle(client);

  console.log("Cleaning up bookings and related data...");

  try {
    // Delete in order of dependencies
    await db.delete(guestRequests);
    console.log("Deleted guest requests");

    // We only want to delete cash movements related to bookings if we want a surgical cleanup,
    // but usually if we clear bookings we clear the income records too.
    await db.delete(cashMovements);
    console.log("Deleted cash movements");

    await db.delete(bookings);
    console.log("Deleted bookings");

    await db.delete(pitchSubscriptions);
    console.log("Deleted subscriptions");

    console.log("Cleanup complete!");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    client.close();
  }
}

cleanup();
