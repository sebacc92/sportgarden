import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pitchSubscriptions, bookings } from "../src/db/schema";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function inspect() {
  try {
    const subs = await db.select().from(pitchSubscriptions);
    console.log("Subscriptions:", JSON.stringify(subs, null, 2));

    for (const sub of subs) {
      console.log(`\nBookings for Sub ${sub.id}:`);
      const subBookings = await db.select().from(bookings).where(eq(bookings.notes, `subscription:${sub.id}`));
      for (const b of subBookings) {
        console.log(`Booking ID: ${b.id}, StartTime: ${new Date(Number(b.startTime)).toISOString()}, EndTime: ${new Date(Number(b.endTime)).toISOString()}, Status: ${b.status}`);
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    client.close();
  }
}

inspect();
