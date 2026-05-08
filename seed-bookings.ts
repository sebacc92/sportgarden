import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./src/db/schema";
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  const db = drizzle(turso, { schema });

  // Get all active pitches
  const allPitches = await db.query.pitches.findMany({
    where: (p, { eq }) => eq(p.isActive, true),
  });

  if (allPitches.length === 0) {
    console.error("No pitches found. Run the pitch seed first.");
    process.exit(1);
  }

  console.log(`Found ${allPitches.length} pitches.`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Helper to create a Date with given day and hour
  const makeDate = (base: Date, hour: number, minute = 0) => {
    const d = new Date(base);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const names = [
    { name: "Carlos Benitez", phone: "1122334455" },
    { name: "Marcos Gimenez", phone: "1133445566" },
    { name: "Diego Molina", phone: "1144556677" },
    { name: "Lucas Herrera", phone: "1155667788" },
    { name: "Andres Sosa", phone: "1166778899" },
    { name: "Roberto Paz", phone: "1177889900" },
    { name: "Fabian Torres", phone: "1188990011" },
    { name: "Nicolas Vega", phone: "1199001122" },
    { name: "Eduardo Rios", phone: "1100112233" },
    { name: "Pablo Suarez", phone: "1111223344" },
    { name: "Grupo Los Pibes", phone: "1122334466" },
    { name: "Equipo Aguante", phone: "1133445577" },
  ];

  // Slots: [hour, durationHours, status]
  const slots: Array<{ hour: number; duration: number; status: string }> = [
    { hour: 8, duration: 1, status: "CONFIRMED" },
    { hour: 9, duration: 1, status: "CONFIRMED" },
    { hour: 10, duration: 1.5, status: "PENDING_APPROVAL" },
    { hour: 12, duration: 1, status: "CONFIRMED" },
    { hour: 13, duration: 1, status: "CONFIRMED" },
    { hour: 14, duration: 1.5, status: "PENDING_APPROVAL" },
    { hour: 16, duration: 1, status: "CONFIRMED" },
    { hour: 17, duration: 1, status: "CONFIRMED" },
    { hour: 18, duration: 1, status: "CONFIRMED" },
    { hour: 19, duration: 1, status: "PENDING_APPROVAL" },
    { hour: 20, duration: 1.5, status: "CONFIRMED" },
    { hour: 22, duration: 1, status: "CONFIRMED" },
  ];

  let nameIdx = 0;
  let count = 0;

  for (const day of [today, tomorrow]) {
    const dayLabel = day === today ? "HOY" : "MAÑANA";
    // Pick a subset of pitches per day (up to 4 to avoid too many conflicts)
    const pitchesToUse = allPitches.slice(0, Math.min(4, allPitches.length));

    for (let pitchIdx = 0; pitchIdx < pitchesToUse.length; pitchIdx++) {
      const pitch = pitchesToUse[pitchIdx];
      // Each pitch gets a staggered set of slots so they don't all overlap
      const pitchSlots = slots.filter((_, i) => i % pitchesToUse.length === pitchIdx);

      for (const slot of pitchSlots) {
        const startTime = makeDate(day, slot.hour);
        const endTime = makeDate(day, slot.hour + Math.floor(slot.duration), (slot.duration % 1) * 60);
        const guest = names[nameIdx % names.length];
        const price = pitch.pricePerHour * slot.duration;

        const bookingId = crypto.randomUUID();

        await db.insert(schema.bookings).values({
          id: bookingId,
          pitchId: pitch.id,
          startTime,
          endTime,
          status: slot.status as any,
          totalPrice: price,
          paidAmount: slot.status === "CONFIRMED" ? price * 0.5 : 0,
          paymentStatus: slot.status === "CONFIRMED" ? "PARTIAL" : "PENDING",
        });

        await db.insert(schema.guestRequests).values({
          id: crypto.randomUUID(),
          bookingId,
          name: guest.name,
          phone: guest.phone,
        });

        console.log(`✅ [${dayLabel}] ${pitch.name} ${slot.hour}:00 → ${guest.name} (${slot.status})`);
        nameIdx++;
        count++;
      }
    }
  }

  console.log(`\n🎉 ${count} reservas creadas correctamente.`);
  process.exit(0);
}

main().catch(console.error);
