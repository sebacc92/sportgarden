import { config } from "dotenv";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { pitches, users, bookings, guestRequests } from "./src/db/schema";
import crypto from "crypto";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

const db = drizzle(client);

async function seed() {
  console.log("Conectando a la base de datos Turso...");
  
  console.log("Limpiando datos anteriores...");
  await db.delete(guestRequests);
  await db.delete(bookings);
  await db.delete(pitches);
  await db.delete(users);

  console.log("Creando Usuarios...");
  const user1 = crypto.randomUUID();
  const user2 = crypto.randomUUID();
  
  await db.insert(users).values([
    { id: user1, name: "Administrador General", role: "ADMIN", email: "admin@sportgarden.com" },
    { id: user2, name: "Seba", role: "REGISTERED", email: "seba@example.com", phone: "11223344" }
  ]);

  console.log("Creando Canchas Premium...");
  const pitch1 = crypto.randomUUID();
  const pitch2 = crypto.randomUUID();
  const pitch3 = crypto.randomUUID();
  const pitch4 = crypto.randomUUID();

  await db.insert(pitches).values([
    { id: pitch1, name: "Camp Nou Sintético", type: "F5", isCovered: true, pricePerHour: 5000, reservationPercentage: 50, isActive: true },
    { id: pitch2, name: "Bernabéu Abierto", type: "F7", isCovered: false, pricePerHour: 8000, reservationPercentage: 30, isActive: true },
    { id: pitch3, name: "La Bombonera", type: "F11", isCovered: false, pricePerHour: 15000, reservationPercentage: 50, isActive: true },
    { id: pitch4, name: "Monumental Techado", type: "F9", isCovered: true, pricePerHour: 12000, reservationPercentage: 50, isActive: true },
  ]);

  // Dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper to get relative date
  const getD = (days: number, hour: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    d.setHours(hour, 0, 0, 0);
    return d;
  };

  console.log("Creando Reservas...");
  const b1 = crypto.randomUUID();
  const b2 = crypto.randomUUID();
  const b3 = crypto.randomUUID();
  const b4 = crypto.randomUUID();
  
  await db.insert(bookings).values([
    // Confirmed booking for user2 today
    { id: b1, userId: user2, pitchId: pitch2, startTime: getD(0, 18), endTime: getD(0, 19), status: "CONFIRMED", totalPrice: 8000, paidAmount: 8000, paymentStatus: "PAID" },
    // Confirmed booking for guest tomorrow
    { id: b2, pitchId: pitch1, startTime: getD(1, 20), endTime: getD(1, 21), status: "CONFIRMED", totalPrice: 5000, paidAmount: 2500, paymentStatus: "PARTIAL" },
    // Pending booking today
    { id: b3, pitchId: pitch3, startTime: getD(0, 21), endTime: getD(0, 23), status: "PENDING_APPROVAL", totalPrice: 30000, paidAmount: 0, paymentStatus: "PENDING" },
    // Completed booking yesterday
    { id: b4, pitchId: pitch4, startTime: getD(-1, 19), endTime: getD(-1, 21), status: "COMPLETED", totalPrice: 24000, paidAmount: 24000, paymentStatus: "PAID" },
  ]);

  console.log("Creando Invitados (Guests)...");
  await db.insert(guestRequests).values([
    { id: crypto.randomUUID(), bookingId: b2, name: "Carlos Tevez", phone: "+541144445555" },
    { id: crypto.randomUUID(), bookingId: b3, name: "Lionel Messi", phone: "+541100001111", email: "lio@argentina.com" },
    { id: crypto.randomUUID(), bookingId: b4, name: "Juan Román Riquelme", phone: "+541199998888" },
  ]);

  console.log("¡Seeding completado! La base de datos Turso tiene datos de ejemplo.");
}

seed().catch(console.error);
