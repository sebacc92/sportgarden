import { config } from "dotenv";
import { createClient } from "@libsql/client";

config({ path: ".env.local" });

const client = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function checkCounts() {
  console.log("Conectando a Turso y contando registros...");
  try {
    const tables = [
      "bookings",
      "guest_requests",
      "cash_movements",
      "cash_registers",
      "group_transactions",
      "groups",
      "pitch_subscriptions",
      "student_payments",
      "student_subscriptions",
      "students"
    ];

    console.log("--- RESULTADOS DE BÚSQUEDA ---");
    for (const table of tables) {
      const res = await client.execute(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`${table}: ${res.rows[0].count}`);
    }
  } catch (error) {
    console.error("Error al contar registros:", error);
  } finally {
    client.close();
  }
}

checkCounts();
